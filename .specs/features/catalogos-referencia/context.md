# Catálogos de Referência (Trilha C) — Context

**Gathered:** 2026-08-10
**Spec:** `.specs/features/catalogos-referencia/spec.md`
**Status:** Ready for design — com uma pergunta explícita em aberto para Pedro (D9) e duas notas de tensão com decisões ativas do `STATE.md` que ficam registradas, não resolvidas por este agente.

---

## Feature Boundary

Provisionar as 12 tabelas `ref_*` que faltam do modelo aprovado (`docs/schema_sistema.sql`), pré-requisito estrutural de Operação/Planejamento/Incidência (roadmap §4, Trilha C): `ref_etapa`, `ref_tipo_registro`, `ref_formulario`, `ref_metrica_formulario`, `ref_preditor`, `ref_agenda_tematica`, `ref_perfil_atuacao`, `ref_pilar_insight`, `ref_indicador`, `ref_nivel_iip`, `ref_tipologia`, `ref_dimensao_gip`. Estrutura + RLS/GRANT + seed do conteúdo já aprovado + smoke test de leitura por papel. Sem UI, sem migração real nesta sessão (Design é o teto desta rodada).

---

## Implementation Decisions

### Padrão de acesso das 12 tabelas novas (RLS vs. GRANT)

Esta não é uma pergunta em aberto para Pedro — é uma constatação de código, resolvida por precedente (Knowledge Verification Chain, passo 1: codebase antes de qualquer outra fonte):

- Os 4 catálogos já provisionados (`ref_produto`, `ref_projeto`, `ref_cargo`, `ref_partido`) **desabilitam RLS explicitamente** (`supabase/migrations/0024_ref_tables_rls_fix.sql`) e usam **GRANT** como único mecanismo de controle de acesso.
- Isso não é um desvio acidental: o próprio `docs/schema_sistema.sql` (fonte aprovada, AD-008) nunca liga RLS em nenhuma tabela `ref_*` — a seção 11 (RLS) só cobre tabelas com `id_contrato` ou vínculo de carteira, e a asserção de deploy da seção 15 ("nenhuma tabela sem RLS") filtra explicitamente por `WHERE ... a.attname = 'id_contrato'` — catálogos são isentos por construção. A seção 14 documenta a intenção: *"Catálogos: leitura para todos, escrita só para admin."*
- **Decisão para as 12 tabelas novas:** seguir o mesmo padrão (RLS desabilitada, GRANT como controle) — consistência com o que já está em produção, e alinhado à intenção do schema aprovado.
- **Ressalva registrada para Pedro, fora do escopo desta feature decidir:** o texto de AD-001 ("Nenhuma tabela é criada sem política de RLS definida") não abre essa exceção explicitamente — ela só existe por construção no schema aprovado e por precedente de migração. Recomendação: uma emenda curta a AD-001 (ou um AD novo) que module a exceção pra catálogo, para que a próxima feature não precise reconstruir esse raciocínio do zero. Não fiz essa emenda — está fora do que esta sessão pode tocar (`STATE.md` é read-only aqui).

### Escopo de GRANT — quem lê, quem escreve

- **Leitura:** todas as 5 roles `legisla_*` (app, admin, gestora, mentor, assessor) recebem `SELECT` nas 12 tabelas novas — não apenas as 3 que o precedente (`0024`) cobriu nos 4 catálogos antigos. Justificativa: o próprio §14 do schema aprovado already GRANTa `SELECT ON ALL TABLES IN SCHEMA public TO legisla_mentor` e grants específicos de catálogo para `legisla_assessor` (`ref_formulario`, `ref_preditor`, `ref_agenda_tematica`) — a leitura ampla é a intenção documentada, o precedente de 2024 só não tinha ainda mentor/assessor como roles com uso real. Completar o padrão evita repetir a mesma lacuna 12 vezes.
- **`anon`:** **excluído** do GRANT nas 12 tabelas novas — diferente do precedente de `0024`, que inclui `anon` no `GRANT SELECT` dos 4 catálogos antigos. AD-002 ("Nenhum acesso é anônimo — nem leitura, nem resposta de formulário. Login sempre.") é uma regra inegociável (Constituição §6, regra 4) sem exceção documentada para catálogo. Conceder a `anon` contradiz o texto ativo de AD-002; a leitura de catálogo por um usuário autenticado sem papel específico (`authenticated`) já é suficiente para qualquer combobox/formulário do frontend, que nunca opera sem sessão (AD-002 de novo).
- **Escrita:** `legisla_admin`, `legisla_gestora`, `legisla_app` recebem `SELECT, INSERT, UPDATE, DELETE` (mesmo padrão do `GRANT ... ON ALL TABLES IN SCHEMA public` já em vigor desde a `0004`/`0007`/`0009` — re-grant obrigatório por AD-025 a cada tabela nova em `public`). `legisla_mentor`/`legisla_assessor` recebem só `SELECT`.
- **Ressalva registrada para Pedro:** isso também diverge, na prática, do texto do §14 ("escrita só para admin") — hoje `legisla_gestora` já escreve nos 4 catálogos antigos via o GRANT em bloco `ALL TABLES IN SCHEMA public`, e ninguém revogou isso. Não tentei corrigir esse gap nos 4 catálogos antigos (fora do escopo, exigiria migração tocando tabela que não é desta feature) nem inventar um mecanismo novo de "escrita só admin" sem RLS (não é trivial em Postgres puro sem policy) — as 12 tabelas novas replicam o padrão real em produção, não o comentário do schema. Fica registrado como tensão a resolver formalmente se Pedro quiser fechar esse gap um dia (provável candidato à Trilha E).

### Estratégia de seed — o que entra nesta feature vs. o que é levantamento humano

- **9 das 12 tabelas já têm conteúdo real aprovado, verbatim em `docs/schema_sistema.sql` §16** (linhas 2172-2317): `ref_nivel_iip`, `ref_preditor`, `ref_perfil_atuacao`, `ref_pilar_insight`, `ref_dimensao_gip`, `ref_etapa` (Estratégia + PLL, não Coalizão — ver D9), `ref_tipo_registro`, `ref_formulario` (os 16 formulários), `ref_metrica_formulario` (métrica NPS). Este conteúdo **entra na migração desta feature**, como `INSERT ... ON CONFLICT DO NOTHING`, no mesmo padrão de `0007`/`0020`/`0021` — é dado de negócio aprovado, não dado de teste, então vai tanto para dev quanto para produção (nunca via `seed_test.sql`, que é dev-only).
- **3 tabelas não têm conteúdo real ainda:** `ref_agenda_tematica`, `ref_indicador`, `ref_tipologia`. O próprio comentário do schema aprovado admite isso: *"Partido, tipologia, indicador e agenda temática vêm por ETL/carga"* — ou seja, mesmo o autor do schema não inventou esse conteúdo, ele está marcado para vir de fora. **Isto é trabalho humano do time de Monitoramento, não deste agente nem desta feature**: grupo/tipologia/estado dos fatos geradores, peso de cada indicador no IIP, e a lista de agendas temáticas reais.
- **Decisão:** as 3 tabelas entram nesta feature **vazias** (estrutura + RLS/GRANT completos, smoke test roda contra tabela vazia), com o levantamento de conteúdo tratado como follow-up explícito, sem bloquear a criação da tabela. Isso é o que o roadmap já nomeia como "levantamento de dado (sem código)" — registrado aqui como User Story P2, não P1.

---

## Agent's Discretion

- Agrupamento das 12 tabelas em uma ou mais migrações (ordem de dependência interna: `ref_etapa` → `ref_tipo_registro`/`ref_formulario` → `ref_metrica_formulario`; `ref_preditor`+`ref_nivel_iip`+`ref_indicador` → `ref_tipologia`; as demais são independentes). Fica com o Design.
- Nome exato dos testes de integração/smoke test e onde vivem (`supabase/tests/catalogos/` vs. reaproveitar `supabase/tests/fundacao/`). Fica com o Design.

---

## Declined / Undiscussed Gray Areas → Assumptions

Nenhuma foi declinada por Pedro nesta sessão — não há Pedro disponível neste turno (agente não-interativo). As três tensões acima (RLS-vs-GRANT, escopo de GRANT/`anon`, seed real-vs-levantamento) foram resolvidas por **precedente de código + decisão ativa mais específica** (AD-002 é regra inegociável da Constituição, tem prioridade sobre replicar um gap de `0024`), e ficam registradas nas Assumptions do `spec.md` com essa mesma rationale. A única pergunta que este agente **não** resolveu, porque a task explicitamente pede que só Pedro decida, é:

## D9 — Régua de etapas da Coalizão — **RESOLVIDA por Pedro em 2026-08-10: clona a régua da Estratégia**

**A pergunta, tal como está em `docs/schema_sistema.sql` (D9, linha 35) e no roadmap (§2, linha 101):** a régua de etapas da Coalizão (`ref_etapa` para o produto "Coalizão") **clona a régua da Estratégia** (Cadastro → Pontapé → Raio-X → Imersão → Governança/Organograma → Monitoramento → Replicação) ou tem etapas próprias?

- O schema aprovado já deixa o `INSERT` de clonagem **escrito e pronto** (comentado, linhas 2251-2262) para o dia em que a operação confirmar a hipótese.
- **Hipótese registrada, não confirmada:** clonar a régua da Estratégia. O próprio schema chama isso de hipótese, não decisão.
- **Por que importa agora e não pode esperar:** sem essa resposta, `ref_etapa` não tem linha para o produto Coalizão — e a instanciação de contrato de Coalizão (roadmap §5.1, `app.instanciar_contrato`) não tem o que instanciar. Não bloqueia as outras 11 tabelas nem as linhas de Estratégia/PLL de `ref_etapa`, mas bloqueia especificamente a Coalizão operar como produto com planejamento próprio (`dim_coalizao.possui_planejamento_proprio = true`).
- **Este agente não decide isso.** Fica registrado como requisito bloqueado (CAT-17 no `spec.md`) e como a pergunta nº 1 a levar a Pedro no relatório final.

---

## Specific References

- `docs/schema_sistema.sql:35-36` (D9), `:2251-2262` (INSERT de clonagem pronto, comentado).
- `.specs/roadmap.md:101` (D9 na tabela de decisões pendentes), `:189-199` (Trilha C).
- Precedente de migração a reusar: `supabase/migrations/0007_catalogos_fundacao.sql` (DDL + seed no mesmo arquivo), `0020_seed_ref_partido.sql`/`0021_seed_ref_projeto.sql` (seed real via migração separada, nunca `seed_test.sql`), `0024_ref_tables_rls_fix.sql` (RLS desabilitada + GRANT).

---

## Deferred Ideas

- `/admin/catalogos` (CRUD administrado dos catálogos) — já explicitamente fora de escopo pelo roadmap §4 Trilha C ("Fora de escopo nesta fatia... A tela de edição é conveniência e entra quando o Admin tiver mais o que administrar") e pelo precedente da spec de Fundação (FND-05, mesma exclusão). Não repescado aqui.
- Fechar o gap de "escrita só para admin" nos 4 catálogos antigos (`ref_produto`/`ref_projeto`/`ref_cargo`/`ref_partido`) — mencionado como tensão acima, não é escopo desta feature (exigiria migração tocando tabela que já existe, potencial candidato à Trilha E).
- Emenda a AD-001 explicitando a exceção de catálogo — mencionado como tensão acima; é decisão de `STATE.md`, fora do que este agente pode escrever nesta sessão.
