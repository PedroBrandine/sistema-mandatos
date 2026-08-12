# Kanban de Etapas Specification

## Problem Statement

`fat_etapa_contrato` (criada pela feature `operacao-regua-instanciacao`) só guarda o estado real de
uma etapa se alguém escrever nela — e hoje não existe nenhuma tela que escreva. Sem essa escrita,
G1 (carteira ponderada) e G2 (tempo de ciclo) ficam permanentemente vazios: os dois dependem de
etapa ser **fato datado** (AD-013), não campo de formulário esquecido. A AD-023 já decidiu que o
Kanban **é** essa superfície de escrita — arrastar o card entre colunas é a ação que grava a
transição, não uma tela de leitura bonita em cima de dado que já existiria de outro jeito.

## Goals

- [ ] Board Kanban por produto/projeto, uma coluna por `ref_etapa` (ordenada por `ordem`), um card
      por `fat_contrato` na etapa correspondente ao seu `id_etapa_atual`.
- [ ] Arrastar um card entre colunas grava a transição em `fat_etapa_contrato` (datas + status) e
      atualiza `fat_contrato.id_etapa_atual` — a única forma de essas colunas mudarem depois da
      instanciação (`operacao-regua-instanciacao` deixa tudo `nao_iniciada`, `id_etapa_atual = NULL`).
- [ ] Toda transição é auditada (AD-006) — quem moveu, quando, de onde pra onde.
- [ ] RLS de escrita: só quem tem vínculo ativo com o contrato (ou Admin/Gestora) pode mover o card
      daquele contrato.
- [ ] Recortes por Gestora, Mentor, produto e projeto (roadmap §5.2).

## Out of Scope

| Item | Reason |
| --- | --- |
| Escolha da biblioteca de drag-and-drop | Decisão técnica de implementação, não de requisito — cabe à fase Design, com pesquisa via Context7/web (nenhuma lib está instalada hoje; nenhuma foi avaliada ainda nesta conversa). |
| G1 / G2 (cálculo dos indicadores) | Feature própria (`visao-gerencial-g1-g2`) — **consome** a transição que esta feature grava, não a calcula. |
| Marcar etapa como "dispensada" | Ambiguidade de UX real (é uma 3ª ação, não uma posição no board) — ver Assumption abaixo; proposto como ação separada, fora do MVP de arrastar-e-soltar. |
| Reordenar as colunas do board (mudar `ref_etapa.ordem`) | Catálogo de referência, edição administrada — fora desta feature. |
| Notificação/alerta de etapa atrasada | Pertence a Integrações ou feature de notificação própria — não discutido, não pedido. |
| Histórico visual de todas as transições passadas de um contrato (linha do tempo) | O log de auditoria guarda o dado; uma tela dedicada pra visualizá-lo é extensão futura, não pedida agora. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| **Transição válida (state-transition integrity)** | Só entre colunas **adjacentes** (`ordem` N ↔ N+1) — pular uma etapa arrastando direto de N para N+2 é rejeitado pela UI/RLS | AD-023 exige "validação de transição" mas não define a regra; permitir só adjacente é o default mais seguro contra erro de arraste acidental. Pular de fato uma etapa é a ação "dispensada" (fora de escopo, ver acima), não um salto de drag | y |
| **Mover pra frente** (N → N+1) | Etapa N: `status = 'concluida'`, `dt_conclusao = hoje` (se ainda não setada). Etapa N+1: `status = 'em_andamento'`, `dt_inicio = hoje` (se ainda não setada). `fat_contrato.id_etapa_atual = id_etapa` de N+1 | É a leitura literal de "arrastar o card é a ação que grava a transição" (AD-023) | y |
| **Mover pra trás** (N+1 → N, correção de erro) | Permitido só para Admin/Gestora (não Mentor/Assessor). Reabre a etapa N (`status = 'em_andamento'`, `dt_conclusao = NULL`) e marca N+1 de volta como `nao_iniciada` (datas realizadas limpas) | É correção de erro, não fluxo normal — nível de permissão mais alto que mover pra frente. Zerar as datas realizadas de N+1 evita um `dt_inicio` "fantasma" de uma etapa que nunca de fato aconteceu | y |
| **Primeira etapa nunca teve card movido** | O card da etapa 1 nasce no board mesmo com `fat_contrato.id_etapa_atual = NULL` (herdado de `operacao-regua-instanciacao`) — a coluna 1 trata `id_etapa_atual IS NULL` como "está aqui" | Sem isso, todo contrato recém-criado ficaria invisível no board até a primeira transição, o que não faz sentido — precisa aparecer na coluna 1 desde o início | y |
| **Concorrência** — dois usuários movem o mesmo card quase ao mesmo tempo | Última escrita vence (`UPDATE` simples, sem lock otimista); o board revalida via TanStack Query ao reconectar/focar a aba | MVP não pede lock otimista explícito; contratos raramente têm duas pessoas movendo o mesmo card no mesmo segundo. Registrado como risco aceito, não ausência de decisão | y |
| **Auditoria (AD-006)** — `fat_etapa_contrato` não tem coluna de autor | Trigger `AFTER UPDATE` grava em `log_auditoria` (`tabela='fat_etapa_contrato'`, `valor_anterior`/`valor_novo` = status+datas antes/depois, `id_usuario` = quem moveu) | `log_auditoria` é a tabela genérica de auditoria (`docs/schema_sistema.sql:346-358`) já desenhada pra isso — replicar o padrão em vez de adicionar coluna nova a uma tabela de schema aprovado | y |
| **Auth boundary** — quem pode mover card de qual contrato | RLS de escrita em `fat_etapa_contrato`: `WITH CHECK` explícito exigindo `app.papel_atual() IN ('admin','gestora')` ou vínculo ativo em `rel_usuario_contrato` pro `id_contrato` do card | Mesma regra de leitura já herdada de `operacao-regua-instanciacao` (`p_por_contrato`), replicada no `WITH CHECK` — nenhuma exceção nova de AD-010 é necessária, isto não é escrita privilegiada fora de RLS | y |
| **Rate limit / abuso** | N/A — não se aplica: ação é de uso interno autenticado, com RLS por vínculo; não é superfície pública nem de alto volume | AD-023/§5.5 da Constituição só exige rate limit em superfícies que tocam público externo ou e-mail | y (N/A) |
| **Idempotência / retry** | `UPDATE` do estado alvo é idempotente por natureza (mover pra "em_andamento" de novo não duplica linha, `fat_etapa_contrato` já existe por `id_contrato`+`id_etapa` único) | Consequência direta do `UNIQUE (id_contrato, id_etapa)` já no schema aprovado | y |
| **Data lifecycle/expiry** | N/A — transições não expiram nem são arquivadas nesta feature | Fora do domínio: é fato histórico permanente, retenção é preocupação de `log_auditoria` (24 meses), não da tabela de fato | y (N/A) |
| Recorte do board | Filtros por Gestora, Mentor, produto e projeto — combináveis, não mutuamente exclusivos | Citado explicitamente no roadmap §5.2 | y |

**Open questions:** nenhuma. Todos os 9 pontos confirmados por Pedro (assumindo o default proposto em
cada um, sem alteração) no início da fase Design desta sessão — ver `context.md`/`design.md`. Durante
a pesquisa de Design, 2 gaps reais de infraestrutura foram encontrados por leitura de migration (não
eram assumption — são fato do banco hoje): `fat_contrato.p_por_carteira` nunca teve `WITH CHECK`
explícito (só `USING`), e `legisla_mentor`/`legisla_assessor` nunca receberam `UPDATE` em
`fat_contrato`/`fat_etapa_contrato` em nenhuma migration — sem corrigir os dois, a US "Mentor move pra
frente" (P1) seria fisicamente impossível pelo GRANT, não só pela RLS. Ambos endereçados em
`design.md` (Risks & Concerns) e vão a task própria.

---

## User Stories

### P1: Board Kanban por produto ⭐ MVP

**User Story**: Como Gestora, quero ver um quadro Kanban com uma coluna por etapa do produto e um
card por contrato na etapa em que ele está, pra entender de um olhar só onde cada contrato da minha
carteira se encontra.

**Why P1**: É a superfície inteira da feature — sem o board não há onde arrastar nada.

**Acceptance Criteria**:

1. WHEN o usuário abre o Kanban de um produto THEN o sistema SHALL mostrar uma coluna por
   `ref_etapa` daquele produto, ordenada por `ordem`.
2. WHEN um contrato tem `id_etapa_atual` preenchido THEN seu card SHALL aparecer na coluna
   correspondente; WHEN `id_etapa_atual IS NULL` (contrato recém-instanciado, nenhuma transição
   ainda) THEN o card SHALL aparecer na coluna da 1ª etapa (`ordem = 1`).
3. WHEN o usuário aplica um filtro (Gestora, Mentor, produto, projeto) THEN o board SHALL mostrar
   somente os cards de contratos que passam nesse filtro, sem recarregar a página inteira.
4. WHEN o board carrega THEN cada card SHALL mostrar ao menos o nome do contratante e há quantos
   dias está na etapa atual.

**Independent Test**: Abrir o Kanban de Estratégia com ao menos 2 contratos de teste em etapas
diferentes, confirmar que cada aparece na coluna certa, e aplicar um filtro por Gestora pra ver a
lista reduzir.

---

### P1: Mover card pra frente grava a transição ⭐ MVP

**User Story**: Como Gestora, ao arrastar um card pra próxima coluna, quero que o sistema registre
que aquele contrato avançou de etapa, com data e meu nome — sem precisar preencher nenhum
formulário separado.

**Why P1**: É o cerne da AD-023 — a ação de gestão do dia a dia É a escrita do dado que sustenta
G1/G2.

**Acceptance Criteria**:

1. WHEN o usuário arrasta um card da coluna N pra coluna N+1 (adjacente, avançando) THEN o sistema
   SHALL marcar a etapa N como `concluida` (`dt_conclusao = hoje`, se ainda vazia) e a etapa N+1
   como `em_andamento` (`dt_inicio = hoje`, se ainda vazia).
2. WHEN a transição grava THEN o sistema SHALL atualizar `fat_contrato.id_etapa_atual` para a
   etapa N+1.
3. WHEN a transição grava THEN o sistema SHALL inserir uma linha em `log_auditoria` com o usuário
   autor, a tabela, o registro alvo e o estado anterior/novo.
4. WHEN o usuário tenta arrastar o card pra uma coluna **não-adjacente** avançando (ex.: N pra N+2)
   THEN o sistema SHALL rejeitar a operação e devolver o card pra coluna original, com uma mensagem
   explicando que etapas não podem ser puladas por aqui.

**Independent Test**: Arrastar um card da coluna 1 pra 2, conferir `fat_etapa_contrato` (etapa 1
concluída, etapa 2 em andamento com datas de hoje), `fat_contrato.id_etapa_atual` atualizado e uma
linha nova em `log_auditoria`. Tentar arrastar da coluna 1 pra 3 e confirmar rejeição.

---

### P1: RLS de escrita — só quem tem vínculo pode mover ⭐ MVP

**User Story**: Como Admin de segurança, quero que só Gestora/Admin ou quem tem vínculo ativo com o
contrato consiga mover o card dele — Mentor/Assessor de outra carteira não deve conseguir alterar
etapa de um contrato que não é seu.

**Why P1**: É superfície de escrita nova (AD-023, trade-off explícito) — sem RLS de escrita
correta, qualquer usuário autenticado poderia alterar a régua de qualquer contrato.

**Acceptance Criteria**:

1. WHEN um usuário sem vínculo ativo ao contrato (e sem papel admin/gestora) tenta mover o card
   daquele contrato THEN o sistema SHALL rejeitar via `WITH CHECK` de RLS, nunca só escondendo o
   botão na UI.
2. WHEN Admin ou Gestora movem qualquer card THEN o sistema SHALL permitir, independente de vínculo.
3. WHEN Mentor ou Assessor com vínculo ativo movem o card do próprio contrato THEN o sistema SHALL
   permitir.

**Independent Test**: Réplica do padrão dos testes de RLS já usados no projeto (`*-with-check.
integration.test.ts`) — tentativa de `UPDATE` direto em `fat_etapa_contrato` por um usuário sem
vínculo falha; por um com vínculo ou Admin/Gestora funciona.

---

### P2: Mover card pra trás corrige erro (Admin/Gestora)

**User Story**: Como Gestora, se eu arrastar um card errado, quero poder voltá-lo pra etapa
anterior e desfazer o efeito, sem precisar pedir acesso ao banco.

**Why P2**: É correção de erro operacional — importante, mas não bloqueia demonstrar o fluxo
principal (mover pra frente).

**Acceptance Criteria**:

1. WHEN Admin ou Gestora arrastam um card da coluna N+1 de volta pra coluna N (adjacente, voltando)
   THEN o sistema SHALL reabrir a etapa N (`em_andamento`, `dt_conclusao = NULL`) e resetar a etapa
   N+1 pra `nao_iniciada` (datas realizadas limpas).
2. WHEN Mentor ou Assessor tentam o mesmo movimento (voltar) THEN o sistema SHALL rejeitar — mover
   pra trás exige papel Admin ou Gestora.
3. WHEN a reversão grava THEN o sistema SHALL auditar do mesmo jeito que o avanço (US anterior, AC3).

**Independent Test**: Como Gestora, avançar um card e depois voltá-lo; confirmar que os dados
realizados da etapa N+1 são limpos e a N reabre. Tentar o mesmo como Mentor e confirmar rejeição.

---

### P2: Recortes do board

**User Story**: Como Mentora, quero filtrar o board só pelos contratos onde sou mentora, sem ver a
carteira inteira da equipe.

**Why P2**: Melhora usabilidade em carteiras grandes, mas o board já é funcional sem filtro (US 1
cobre o caso sem filtro).

**Acceptance Criteria**:

1. WHEN o usuário aplica o filtro "Minha carteira" THEN o sistema SHALL restringir aos contratos
   onde o usuário tem vínculo ativo em `rel_usuario_contrato`, independente do papel.
2. WHEN o usuário combina filtro de produto + projeto THEN o sistema SHALL aplicar os dois ao mesmo
   tempo (AND, não OR).

**Independent Test**: Logar como Mentora com carteira restrita, aplicar "Minha carteira" e
confirmar que só os contratos vinculados aparecem.

---

## Edge Cases

- WHEN o `ref_etapa` do produto tem uma etapa com `gera_registro = false` (não gera registro
  formal) THEN o board SHALL ainda mostrar a coluna normalmente — esse campo não afeta a mecânica
  de transição, só o registro (Incidência, fora desta feature).
- WHEN a transição falha no meio (ex.: rede cai depois do drag, antes da resposta do servidor) THEN
  o sistema SHALL devolver o card pra posição original — nunca deixar o board mostrar um estado que
  o banco não confirmou.
- WHEN dois usuários movem o mesmo card quase ao mesmo tempo pra colunas diferentes THEN a última
  escrita que chegar ao banco SHALL prevalecer, e o board de quem perdeu a corrida SHALL revalidar
  e mostrar o estado real na próxima consulta (ver Assumption de concorrência).
- WHEN um contrato tem `status = 'concluido'` ou `'nao_concluido'` (fora de `'ativo'`) THEN o
  sistema SHALL mostrar o card com indicação visual de contrato encerrado, mas SHALL permitir que
  ele continue visível no board (não remove silenciosamente contratos encerrados).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| KAN-01 | P1: Board — colunas por etapa | T4 | Implementing (backend pronto, T4 `98ba773`; frontend T6-T11 pendente) |
| KAN-02 | P1: Board — posicionamento do card por `id_etapa_atual` | T4 | Implementing (backend pronto, T4 `98ba773`; frontend T6-T11 pendente) |
| KAN-03 | P1: Board — filtros combináveis | T4 | Implementing (backend pronto, T4 `98ba773`; frontend T6-T11 pendente) |
| KAN-04 | P1: Mover pra frente — grava transição | T3, T5 | Implementing (DB+backend completos; frontend T9 pendente) |
| KAN-05 | P1: Mover pra frente — atualiza `id_etapa_atual` | T3 | Implementing (DB completo `8ede5c1`; frontend T9 pendente) |
| KAN-06 | P1: Mover pra frente — auditoria | T2, T3 | Verified (DB — `c34137c`/`8ede5c1`, gate `npm run test:integration` verde) |
| KAN-07 | P1: Rejeita salto de coluna não-adjacente | T3, T5 | Implementing (DB+backend completos; guard client-side T9 pendente) |
| KAN-08 | P1: RLS de escrita por vínculo | T1, T3 | Verified (DB — `d355788`/`8ede5c1`, gate `npm run test:integration` verde) |
| KAN-09 | P2: Mover pra trás (Admin/Gestora) | T3, T5 | Implementing (DB+backend completos; guard client-side T9 pendente) |
| KAN-10 | P2: Recorte "Minha carteira" | T4 | Implementing (backend pronto, T4 `98ba773`; frontend T10 pendente) |

**ID format:** `KAN-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 10 total, 5 mapped to tasks concluídas (T1-T5), 5 aguardando frontend (T6-T11) — 2
(KAN-06, KAN-08) já com evidência completa de ponta a ponta (DB), sem pendência de UI.

---

## Success Criteria

- [ ] Um contrato de teste avança 2 etapas via drag-and-drop e `fat_etapa_contrato`/
      `fat_contrato.id_etapa_atual`/`log_auditoria` refletem exatamente o esperado.
- [ ] Usuário sem vínculo não consegue mover card de contrato fora da sua carteira (RLS comprovada
      por teste, não só por UI escondida).
- [ ] Salto de coluna não-adjacente é rejeitado de ponta a ponta (UI + banco).
- [ ] G1/G2 (feature seguinte) já encontram dado real pra consumir assim que esta feature fechar.
