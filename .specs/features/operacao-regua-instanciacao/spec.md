# Régua de Etapas e Instanciação Specification

## Problem Statement

A Definição de Pronto da Constituição (§6) exige que "no sistema o contrato já nasce com suas
tabelas" — mas hoje `fat_contrato` nasce sozinho: sem régua de etapas, sem planejamento vazio, sem
controle de formulários. `app.instancia_contrato` já existe **inteira e aprovada** em
`docs/schema_sistema.sql:1529-1559`, mas nunca foi provisionada no banco, e nada a chama. Sem isso,
nenhuma tabela de Operação (`fat_etapa_contrato`), Planejamento (`dim_planejamento`) ou controle de
Formulários (`rel_formulario_contrato`) pode existir — é o gargalo estrutural que trava G1, G2, o
Kanban e a Planilha de Monitoramento (roadmap §1.2, §5.1).

## Goals

- [ ] `fat_etapa_contrato`, `rel_formulario_contrato`, `dim_planejamento` provisionadas com RLS,
      exatamente como aprovado em `docs/schema_sistema.sql:708-889`.
- [ ] `app.instancia_contrato(p_id_contrato)` provisionada verbatim (`:1529-1559`) e **chamada
      automaticamente** para todo `fat_contrato` novo, sem depender de um call-site do frontend
      lembrar de invocá-la.
- [ ] Contratos já existentes na base (criados antes desta feature) recebem a régua retroativamente.
- [ ] Tela da régua no detalhe do contrato: previsto × realizado por etapa, atraso **derivado**
      (`vw_etapa_contrato.dias_atraso`, `GREATEST`, nunca coluna digitada — AD-005, nota C2 do schema).

## Out of Scope

| Item | Reason |
| --- | --- |
| Kanban / escrita de transição de etapa (arrastar card) | Feature própria (`kanban-etapas`, AD-023) — consome `fat_etapa_contrato`, não a cria. |
| G1 / G2 (indicadores de gestão) | Feature própria (`visao-gerencial-g1-g2`, AD-032) — lê `vw_etapa_contrato`/`vw_carteira`. |
| Hierarquia de Planejamento (Objetivo → Meta → Sucesso Mensal) | `dim_planejamento` nasce vazia aqui (só `id_contrato`); populá-la é `planejamento-planilha-monitoramento`. |
| Gestão de Formulários (abrir/fechar, submissão) | `rel_formulario_contrato` nasce com `estado = 'fechado'` pra cada formulário aplicável; a tela de gestão é OPR-02 (fora desta feature). |
| Alterar a assinatura ou o corpo de `app.instancia_contrato` | É schema aprovado (AD-008) — esta feature provisiona verbatim, não reprojeta. Qualquer mudança de comportamento é uma decisão nova, registrada abaixo como Assumption. |
| Editar `ref_etapa`/`ref_formulario` (conteúdo dos catálogos) | Já seedados pela Trilha C — esta feature só lê. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Ponto de integração da chamada | Trigger `AFTER INSERT ON fat_contrato` que chama `app.instancia_contrato(NEW.id_contrato)` | Hoje `fat_contrato` nasce em 3 lugares (`mandato-wizard.tsx`, `coalizoes/[id]/page.tsx` via CMU-15, rota órfã `/mandatos/[id]/contratos/novo`); um trigger elimina o risco de esquecer um 4º call-site futuro (roadmap §5.1) | y |
| Backfill dos contratos já existentes em dev | A mesma migration chama `SELECT app.instancia_contrato(id_contrato) FROM fat_contrato` uma vez, após criar o trigger — cobre também produção quando a migration chegar lá | Sem isso, contratos de teste já criados (CMU-15, wizard) ficam sem régua para sempre; a função já é idempotente via `ON CONFLICT DO NOTHING` | y |
| **A função aprovada NÃO marca nenhuma etapa como iniciada nem grava `fat_contrato.id_etapa_atual`** — verificado linha a linha em `docs/schema_sistema.sql:1536-1547`: todas as linhas de `fat_etapa_contrato` nascem com `status = 'nao_iniciada'`, e a função nunca faz `UPDATE fat_contrato` | Manter como está (não "corrigir" o schema aprovado). `id_etapa_atual` e a 1ª etapa em `em_andamento` só passam a existir quando o Kanban (`AD-023`) registrar a primeira transição real | Consistente com AD-005 ("ausência de dado é NULL, nunca um estado que não foi observado") — instanciar não é o mesmo que começar a trabalhar. Mas é uma leitura, não um fato: fica registrado aqui para não ser silenciosamente perdido | y |
| Quem escreve em `fat_contrato.id_etapa_atual` depois | Exclusivamente o Kanban (feature separada) | Consequência direta do ponto acima — esta feature nunca grava nessa coluna | y |
| RLS das 3 tabelas novas | Réplica literal de `p_por_contrato` (`docs/schema_sistema.sql:1565-1582`) — `USING (papel_atual() IN ('admin','gestora') OR id_contrato = ANY(contratos_do_usuario()))` — **mais um `WITH CHECK` explícito idêntico**, não apenas a reutilização implícita da `USING` | O schema aprovado declara só `USING`; a lição da FND-USR-02 desta mesma sprint (política `FOR ALL` sem `WITH CHECK` explícito permitiu escrita indevida) exige nunca depender do reuso implícito, mesmo quando a condição pareceria idêntica | y |
| Datas previstas de etapa | Exatamente como a função calcula: `dt_prevista_inicio` da 1ª etapa = `fat_contrato.dt_inicio`; das demais, acumula `duracao_prevista_dias` das etapas anteriores em sequência | É o comportamento já implementado na função aprovada — não há decisão nova aqui, só confirmação de leitura | y |
| Etapa com `duracao_prevista_dias IS NULL` | `dt_prevista_conclusao` daquela etapa (e o acumulado das seguintes) reflete isso via `COALESCE(...,0)` — nunca quebra, mas pode subestimar a data prevista de etapas depois de uma sem duração cadastrada | Comportamento literal da função aprovada; risco baixo — checar contra o seed de `ref_etapa` se alguma linha está sem duração antes de confiar na data prevista em produção | y |
| Tela de régua — edição manual de datas previstas | Fora desta fatia: `dt_prevista_*` só é escrita pela instanciação; ajuste manual (replanejamento) não está no MVP | Não foi pedido; simplicidade da primeira entrega | y |

**Open questions:** nenhuma. Todos os 7 pontos confirmados por Pedro (assumindo o default proposto em
cada um, sem alteração) no início da fase Design desta sessão — ver `design.md`.

---

## User Stories

### P1: Contrato nasce com sua régua instanciada automaticamente ⭐ MVP

**User Story**: Como Gestora, ao criar um contrato (mandato, coalizão, qualquer produto), quero que
ele já nasça com as etapas do produto, o planejamento vazio e os formulários aplicáveis prontos —
sem precisar de nenhuma ação extra minha.

**Why P1**: É a base estrutural de tudo que vem depois (Kanban, G1/G2, Planejamento) — sem isso não
existe fato datado nenhum pra essas features lerem.

**Acceptance Criteria**:

1. WHEN um `INSERT` novo acontece em `fat_contrato`, por qualquer call-site (wizard de mandato,
   contrato próprio de coalizão, ou qualquer futuro) THEN o sistema SHALL disparar
   `app.instancia_contrato(NEW.id_contrato)` automaticamente via trigger, sem exigir chamada
   explícita do frontend.
2. WHEN a instanciação roda THEN o sistema SHALL criar uma linha em `fat_etapa_contrato` para cada
   linha de `ref_etapa` do produto do contrato, todas com `status = 'nao_iniciada'` e datas
   previstas calculadas em sequência a partir de `fat_contrato.dt_inicio`.
3. WHEN a instanciação roda THEN o sistema SHALL criar exatamente uma linha em `dim_planejamento`
   vinculada ao contrato (demais colunas `NULL`, sem perfil de atuação nem % de atingimento).
4. WHEN a instanciação roda THEN o sistema SHALL criar uma linha em `rel_formulario_contrato`,
   `estado = 'fechado'`, para cada `ref_formulario` cuja `ref_etapa.id_produto` seja o produto do
   contrato e `ativo = true`.
5. WHEN a instanciação é chamada mais de uma vez para o mesmo contrato (reentrância do trigger, ou
   reprocessamento manual) THEN o sistema SHALL não duplicar nenhuma linha (`ON CONFLICT DO
   NOTHING`, já implementado na função aprovada).

**Independent Test**: Criar um contrato de Estratégia novo pelo wizard e um contrato de Coalizão via
CMU-15; para os dois, consultar `fat_etapa_contrato`/`dim_planejamento`/`rel_formulario_contrato` e
confirmar as linhas esperadas sem nenhuma chamada manual.

---

### P1: Contratos já existentes recebem a régua retroativamente ⭐ MVP

**User Story**: Como Gestora, quero que os contratos que já existiam antes desta feature também
tenham régua, planejamento e controle de formulário — não só os criados a partir de agora.

**Why P1**: Sem backfill, todo contrato de teste já cadastrado (CMU-15, wizard) fica permanentemente
sem régua, e a tela nova (US seguinte) não teria nada pra mostrar neles.

**Acceptance Criteria**:

1. WHEN a migration desta feature roda THEN o sistema SHALL chamar `app.instancia_contrato` para
   todo `id_contrato` já existente em `fat_contrato`, na mesma migration que cria o trigger.
2. WHEN o backfill roda mais de uma vez (ex.: reaplicado em produção depois de já ter corrido em
   dev) THEN o sistema SHALL não duplicar nenhuma linha (mesma garantia `ON CONFLICT` da US
   anterior).

**Independent Test**: Rodar a migration numa base de dev com contratos pré-existentes (os criados
pela Trilha A/CMU-15) e confirmar que todos passam a ter linhas em `fat_etapa_contrato`.

---

### P1: RLS das 3 tabelas novas segue o padrão do projeto ⭐ MVP

**User Story**: Como Admin de segurança do sistema, quero que ninguém veja ou grave etapa,
formulário ou planejamento de um contrato ao qual não tem vínculo — mesma regra de todas as
tabelas ancoradas em `id_contrato`.

**Why P1**: AD-001 (RLS obrigatória) e o incidente FND-USR-02 desta mesma sprint deixaram claro que
pular o `WITH CHECK` explícito é o erro mais caro de repetir.

**Acceptance Criteria**:

1. WHEN qualquer usuário autenticado consulta `fat_etapa_contrato`, `rel_formulario_contrato` ou
   `dim_planejamento` THEN o sistema SHALL retornar apenas linhas de contratos onde
   `app.papel_atual() IN ('admin','gestora')` ou `id_contrato = ANY(app.contratos_do_usuario())`.
2. WHEN um usuário sem vínculo ao contrato tenta `INSERT`/`UPDATE` direto nessas 3 tabelas (fora da
   função `SECURITY DEFINER`) THEN a policy SHALL rejeitar via `WITH CHECK` explícito — não apenas
   via reuso implícito da `USING`.
3. WHEN Admin ou Gestora consultam ou escrevem THEN a policy SHALL permitir, sem essa restrição de
   vínculo.

**Independent Test**: Réplica do padrão de teste de `usuario-with-check.integration.test.ts` —
Mentor sem vínculo tenta ler/inserir linha em `fat_etapa_contrato` de um contrato de outra carteira e
recebe erro de RLS; Mentor com vínculo, Gestora ou Admin conseguem.

**Correção de Design (2026-08-11)**: o texto original deste Independent Test dizia "Gestora sem
vínculo... recebe erro de RLS" — mas o próprio AC1/AC3 acima (idêntico ao predicado já em produção em
`fat_contrato`/`dim_contratante` desde `0011_fundacao_rls.sql`) faz `papel_atual() IN ('admin',
'gestora')` sempre passar, **independente de vínculo** — não existe "Gestora sem vínculo bloqueada"
em nenhuma tabela deste padrão hoje, de propósito (AD-018: Gestora enxerga tudo). O sujeito correto do
teste é o Mentor (única role com grant de leitura nestas 3 tabelas e sem o bypass de papel) — corrigido
aqui antes de escrever `regua-rls.integration.test.ts`, ver `design.md`/`validation.md`.

---

### P2: Tela da régua no detalhe do contrato

**User Story**: Como Gestora ou Mentora, ao abrir o detalhe de um contrato, quero ver a régua de
etapas com previsto × realizado e o atraso calculado, sem precisar consultar o banco diretamente.

**Why P2**: É o primeiro consumidor real do TanStack Query/Table instalado pela Trilha D — mostra o
dado que a US anterior passou a garantir que existe, mas não é bloqueante pras features de escrita
(Kanban) que vêm depois.

**Acceptance Criteria**:

1. WHEN o usuário abre a régua de um contrato THEN o sistema SHALL listar as etapas do produto,
   ordenadas por `ref_etapa.ordem`, com status, data prevista e data realizada.
2. WHEN uma etapa está atrasada (`vw_etapa_contrato.esta_atrasada = true`) THEN o sistema SHALL
   destacar isso visualmente, usando o valor já derivado da view — nunca recalculando no cliente.
3. WHEN nenhuma etapa tem `status <> 'nao_iniciada'` (contrato recém-criado, antes do Kanban existir)
   THEN o sistema SHALL mostrar a régua completa mesmo assim, sem tratar isso como erro ou estado
   vazio.

**Independent Test**: Abrir a régua de um contrato recém-instanciado (todas as etapas
`nao_iniciada`) e de um contrato com alguma etapa manualmente marcada `concluida` via SQL de teste;
confirmar que os dois renderizam corretamente.

---

## Edge Cases

- WHEN um contrato é criado para um produto sem nenhuma linha em `ref_etapa` (não deveria acontecer
  — os 3 produtos já têm régua seedada pela Trilha C) THEN a instanciação SHALL rodar sem erro e o
  contrato SHALL nascer sem etapas — a tela da régua (US 4) trata isso como o mesmo estado vazio
  padrão (`<EstadoVazio>`, AD-029), nunca como falha silenciosa.
- WHEN o trigger falha por qualquer motivo (ex.: `ref_etapa` temporariamente indisponível) THEN a
  criação do próprio `fat_contrato` SHALL falhar junto (mesma transação) — nunca deixar um contrato
  "pela metade", sem régua e sem erro visível.
- WHEN dois contratos são criados na mesma transação em lote (ex.: script de backfill futuro) THEN
  cada um SHALL receber sua própria régua isoladamente — a função já opera por `p_id_contrato`
  único, sem estado compartilhado entre chamadas.
- WHEN uma coalizão sem planejamento próprio (Constituição §2.3/§2.4, OPR-06) tem contrato
  instanciado por esta feature THEN o sistema SHALL instanciar normalmente — a leitura "sem
  planejamento próprio" é uma decisão de **exibição** (Trilha F/visão gerencial), não impede a
  tabela de existir vazia.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| RGI-01 | P1: Instanciação automática via trigger | Execute | ✅ Verified |
| RGI-02 | P1: `fat_etapa_contrato` criada por etapa do produto | Execute | ✅ Verified |
| RGI-03 | P1: `dim_planejamento` criada vazia | Execute | ✅ Verified |
| RGI-04 | P1: `rel_formulario_contrato` criada por formulário aplicável | Execute | ✅ Verified |
| RGI-05 | P1: Idempotência (`ON CONFLICT DO NOTHING`) | Execute | ✅ Verified |
| RGI-06 | P1: Backfill dos contratos já existentes | Execute | ✅ Verified |
| RGI-07 | P1: RLS de leitura por vínculo ao contrato | Execute | ✅ Verified |
| RGI-08 | P1: RLS de escrita — `WITH CHECK` explícito | Execute | ✅ Verified |
| RGI-09 | P2: Tela da régua — listagem previsto × realizado | Execute | ✅ Verified (dados; renderização por leitura de código) |
| RGI-10 | P2: Tela da régua — atraso derivado, destaque visual | Execute | ✅ Verified (dados; renderização por leitura de código) |

**ID format:** `RGI-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 10/10 verificados. Verifier independente (author ≠ verifier): PASS ✅ — 10/10 ACs
spec-anchored, gate 5/5 comandos verdes (14+53+158 testes automatizados), sensor 3/3 mutações
mortas, 0 sobreviventes. Relatório completo em `validation.md`. Duas observações Minor não-bloqueantes
(sem teste de componente para a UI — padrão vigente do projeto inteiro; edge case de coalizão sem
asserção de contagem dedicada).

**Coverage:** 10 total, 0 mapped to tasks, 10 unmapped ⚠️ (aguardando fase Design/Tasks)

---

## Success Criteria

- [ ] Todo `fat_contrato` novo nasce com régua, planejamento vazio e controle de formulário sem
      nenhuma chamada manual do frontend.
- [ ] Todo `fat_contrato` já existente em dev recebe a régua depois da migration, sem duplicar nada
      se reaplicada.
- [ ] RLS das 3 tabelas comprovada por teste de integração nos dois sentidos (nega sem vínculo,
      permite com vínculo/Admin/Gestora), com `WITH CHECK` explícito.
- [ ] A régua aparece na tela do contrato com atraso sempre derivado da view, nunca digitado.
