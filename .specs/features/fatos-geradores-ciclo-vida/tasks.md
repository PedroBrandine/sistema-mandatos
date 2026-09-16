# Fatos Geradores — Linha do Tempo e Ciclo de Vida Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/fatos-geradores-ciclo-vida/design.md`
**Status**: Approved (2026-09-16) — execução por sub-agentes em lote, 1 por fase; skill `supabase` para T1-T6

---

## Test Coverage Matrix

> Gerado por leitura do repositório (sem `AGENTS.md`/`CONTRIBUTING.md` próprios de teste — os padrões vêm de `vitest.config.ts`, `vitest.integration.config.ts`, e da amostra de arquivos abaixo) e do "Nota de teste" do `design.md` (profundidade integral, AD-042/AD-044). Amostra usada: `schemas/fato-gerador.test.ts`, `rpc/fato-gerador.test.ts`, `queries/incidencia.test.ts`, `components/planejamento/planejamento-abas.test.tsx` (padrão de toggle), `supabase/tests/incidencia/*.integration.test.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Migrations / SQL (tabelas, constraints, RLS, views, funções) | integration | Cada tabela/coluna/constraint nova com 1 teste positivo + 1 negativo; RLS negando fora da carteira (`fat_pre_insight`); views cobrindo os casos do spec (cadeia de 1 fato, cadeia com origem comum, cadeia direta no fato sem `rel_fato_origem`, cadeia só-projetada; timeline com os 4 tipos + período + ordenação) | `supabase/tests/incidencia/*.integration.test.ts` | `npm run test:integration` |
| Zod schemas | unit | 1:1 com cada regra nova: `situacao`/`dt_prevista`/`dt_ocorrencia` condicionais, `titulo` obrigatório no client mesmo com coluna nullable, `contribuicao_legisla` 0–5 (já coberto, não regredir) | `src/backend/schemas/*.test.ts` | `npm run test:unit` |
| RPC / query wrappers (`backend/rpc`, `backend/queries`) | unit | Todo branch: sucesso, erro mapeado (`mapeiaErroRpc`), parâmetros opcionais omitidos vs. presentes | `src/backend/{rpc,queries}/*.test.ts` | `npm run test:unit` |
| Módulos puros novos (`frontend/lib`) | unit | Todos os branches + casos de borda do spec: `agrupaPorMes` (mês vazio, ordem decrescente), `rotulaCadeias` (origem comum, cadeia direta no fato, cadeia só-projetada, letra posicional nunca persistida) | `src/frontend/lib/*.test.ts` | `npm run test:unit` |
| Componentes React (forms, wizard, timeline, ciclo de vida, aba) | unit (component, jsdom) | Os dois lados de cada condicional + estado vazio + estado de erro — profundidade integral (design.md "Nota de teste"), nunca só o caminho feliz | `src/frontend/components/**/*.test.tsx`, `src/frontend/app/**/*.test.tsx` | `npm run test:unit` |

## Gate Check Commands

> Gerado a partir de `package.json` (raiz).

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após tasks só com unit (schemas, rpc/queries, módulos puros, componentes) | `npm run test:unit` |
| Full | Após tasks de migration (integration) ou que fecham uma fase que toca banco | `npm run test:unit && npm run test:integration` |
| Build | Última task da feature (antes do Verifier automático) | `npm run lint:all && npm run build && npm run test:unit && npm run test:integration` |

---

## Execution Plan

Phases são ordenadas e rodam em sequência — cada fase completa antes da próxima começar, e tasks dentro de uma fase rodam em ordem.

### Phase 1: Migrations (schema)

Sequência de escrita/push: `T1, T2 → T3, T4 → T5 → T6` (ver diagrama completo de dependências no Phase Execution Map).

### Phase 2: Backend (schemas, rpc, queries, módulos puros)

Sequência: `T7, T8, T10, T11 → T9, T12 → T13, T14`.

### Phase 3: Componentes novos

Sequência: `T15 → T16 → T17`; `T18`; `T19`; `T20`; `T21` convergem em `T22`.

### Phase 4: Migração dos formulários existentes + montagem final + retirada

Sequência: `T22 → T23, T24 → T25 → T26, T27`.

---

## Task Breakdown

### T1: Migration — `fat_pre_insight` (tabela + RLS + grants)

**What**: `supabase migration new incidencia_v2_pre_insight` — `CREATE TABLE fat_pre_insight` verbatim de `docs/schema_sistema.sql` (mesmo padrão de `fat_insight`: escopado por contrato, autor + timestamp), política RLS **no mesmo arquivo** (AD-001) espelhando `p_por_contrato` de `fat_insight`, e GRANTs para os papéis existentes.
**Where**: `supabase/migrations/<timestamp>_incidencia_v2_pre_insight.sql`
**Depends on**: None
**Reuses**: Predicado `p_por_contrato` de `20260813192341_incidencia_encontros_rls.sql:31-38` (`USING`/`WITH CHECK` por `id_contrato = ANY(app.contratos_do_usuario())`); padrão de `fat_insight` para colunas de autoria
**Requirement**: FGC-05

**Tools**:
- MCP: NONE
- Skill: `supabase` (padrões de RLS/migration Postgres)

**Done when**:
- [ ] Tabela criada com autor (`id_usuario_autor NOT NULL`) + `criado_em`, escopada por `id_contrato`
- [ ] RLS habilitada + forçada + política `p_por_contrato` no mesmo arquivo
- [ ] GRANTs concedidos (mesmos papéis de `fat_insight`)
- [ ] `supabase db push` (dev) aplicado sem erro
- [ ] Teste de integração: INSERT com usuário fora da carteira do contrato é negado pela RLS
- [ ] Gate check passa: `npm run test:unit && npm run test:integration`

**Tests**: integration
**Gate**: full
**Commit**: `feat(incidencia): fat_pre_insight com RLS (AD-001/006/055)`

---

### T2: Migration — `titulo` / `situacao` / `dt_prevista` em `fat_fato_gerador`

**What**: `supabase migration new incidencia_v2_fato_titulo_situacao` — adiciona `titulo TEXT` (nullable), `situacao TEXT NOT NULL DEFAULT 'realizado'` com CHECK `IN ('projetado','realizado')`, `dt_prevista DATE` (nullable); solta `dt_ocorrencia NOT NULL` e adiciona `ck_fato_situacao_data` condicional (ver design.md "A constraint mais delicada" — estruturalmente seguro, nenhuma linha existente pode violar).
**Where**: `supabase/migrations/<timestamp>_incidencia_v2_fato_titulo_situacao.sql`
**Depends on**: None
**Reuses**: Nenhum — coluna e constraint novas
**Requirement**: FGC-06, FGC-09, FGC-12

**Tools**:
- MCP: NONE
- Skill: `supabase`

**Done when**:
- [ ] 3 colunas novas + CHECK de `situacao` + `ck_fato_situacao_data` aplicados
- [ ] `supabase db push` (dev) aplicado sem erro
- [ ] Teste de integração: INSERT `situacao='projetado'` sem `dt_prevista` falha (`23514`); com `dt_prevista` e sem `dt_ocorrencia` sucede
- [ ] Teste de integração: fatos pré-existentes (se houver) continuam `SELECT`áveis sem erro
- [ ] Gate check passa: `npm run test:unit && npm run test:integration`

**Tests**: integration
**Gate**: full
**Commit**: `feat(incidencia): situacao/dt_prevista/titulo em fat_fato_gerador (AD-054)`

---

### T3: Migration — `rel_fato_origem` ganha as 4 origens

**What**: `supabase migration new incidencia_v2_origem_quatro` — adiciona `id_pre_insight BIGINT REFERENCES fat_pre_insight`, `id_registro BIGINT REFERENCES fat_registro` (ambos nullable); reescreve `ck_fato_origem` para exigir ao menos uma das 4 colunas quando existe linha.
**Where**: `supabase/migrations/<timestamp>_incidencia_v2_origem_quatro.sql`
**Depends on**: T1 (FK para `fat_pre_insight`)
**Reuses**: `ck_fato_origem` existente como base do novo CHECK
**Requirement**: FGC-15

**Tools**:
- MCP: NONE
- Skill: `supabase`

**Done when**:
- [ ] 2 colunas novas + `ck_fato_origem` reescrita (4 colunas, "ao menos uma")
- [ ] `supabase db push` (dev) aplicado sem erro
- [ ] Teste de integração: linha com só `id_registro` preenchido é aceita; linha com as 4 NULL é rejeitada; linha inexistente (fato sem vínculo) continua válido
- [ ] Gate check passa: `npm run test:unit && npm run test:integration`

**Tests**: integration
**Gate**: full
**Commit**: `feat(incidencia): rel_fato_origem com 4 origens (Pré-Insight/Registro/Insight/Meta)`

---

### T4: Migration — `mv_iip_contrato` filtra `situacao='realizado'`

**What**: `supabase migration new incidencia_v2_iip_so_realizados` — reescreve `mv_iip_contrato` (`CREATE OR REPLACE` via drop+create, é materialized view) com `WHERE situacao = 'realizado'` na CTE/join de fatos; `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_iip_contrato` ao final da migration.
**Where**: `supabase/migrations/<timestamp>_incidencia_v2_iip_so_realizados.sql`
**Depends on**: T2 (coluna `situacao` precisa existir)
**Reuses**: Definição atual de `mv_iip_contrato` (`20260813191715_incidencia_encontros_estrutura.sql`) como base
**Requirement**: FGC-07

**Tools**:
- MCP: NONE
- Skill: `supabase`

**Done when**:
- [ ] View filtra por `situacao='realizado'`
- [ ] Refresh incluído na própria migration
- [ ] `supabase db push` (dev) aplicado sem erro
- [ ] Teste de integração: criar fato `projetado` + `atualizaIipContrato()` → IIP/nr_fatos não mudam; realizar o fato → mudam
- [ ] Gate check passa: `npm run test:unit && npm run test:integration`

**Tests**: integration
**Gate**: full
**Commit**: `feat(incidencia): mv_iip_contrato considera só fatos realizados (AD-054/AD-014)`

---

### T5: Migration — `vw_timeline_incidencia` + `vw_cadeia_incidencia`

**What**: `supabase migration new incidencia_v2_views_timeline_cadeia` — cria as duas views: timeline une Pré-Insight/Registro/Insight/Fato Gerador por `id_contrato` com data e tipo unificados (ordenável, sem paginação embutida ainda — client pagina); cadeia agrupa por origem comum a partir de `rel_fato_origem`, cobrindo os 3 formatos do spec (comum, direta no fato, só-projetada).
**Where**: `supabase/migrations/<timestamp>_incidencia_v2_views_timeline_cadeia.sql`
**Depends on**: T1, T2, T3
**Reuses**: `vw_iip_contrato`/`vw_etapa_contrato` como padrão de view de leitura escopada por contrato (AD-003)
**Requirement**: FGC-13

**Tools**:
- MCP: NONE
- Skill: `supabase`

**Done when**:
- [ ] `vw_timeline_incidencia` retorna os 4 tipos com campo de data e tipo discriminador
- [ ] `vw_cadeia_incidencia` agrupa por origem comum sem persistir "cadeia" (nenhuma coluna de nome/letra)
- [ ] `supabase db push` (dev) aplicado sem erro
- [ ] Teste de integração cobrindo os 4 cenários de cadeia do spec (1 fato, N-fatos-origem-comum, direta no fato, só-projetada) e o cenário de timeline com os 4 tipos + filtro por período
- [ ] Gate check passa: `npm run test:unit && npm run test:integration`

**Tests**: integration
**Gate**: full
**Commit**: `feat(incidencia): vw_timeline_incidencia e vw_cadeia_incidencia (AD-003/AD-053)`

---

### T6: Migration — `app.criar_fato_gerador()` ganha os parâmetros novos

**What**: `supabase migration new incidencia_v2_fn_criar_fato_gerador` — `CREATE OR REPLACE FUNCTION app.criar_fato_gerador(...)` com `p_titulo TEXT DEFAULT NULL`, `p_situacao TEXT DEFAULT 'realizado'`, `p_dt_prevista DATE DEFAULT NULL`, `p_id_pre_insight_origem BIGINT DEFAULT NULL`, `p_id_registro_origem BIGINT DEFAULT NULL`; `p_dt_ocorrencia` deixa de ter `DEFAULT CURRENT_DATE` (passa a `DEFAULT NULL`, coerente com "projetado" não ter data de ocorrência); adiciona validação de mesmo-contrato para Pré-Insight e Registro (mesmo padrão das checagens já existentes de Meta/Insight); estende o `INSERT INTO rel_fato_origem` para as 4 colunas.
**Where**: `supabase/migrations/<timestamp>_incidencia_v2_fn_criar_fato_gerador.sql`
**Depends on**: T2, T3 (colunas/constraints que a função passa a gravar)
**Reuses**: Corpo da função atual (`20260813193050_incidencia_encontros_fn_criar_fato_gerador.sql`) como base — `CREATE OR REPLACE`, não reescrita do zero
**Requirement**: FGC-06, FGC-09, FGC-15

**Tools**:
- MCP: NONE
- Skill: `supabase`

**Done when**:
- [ ] Função aceita os 5 parâmetros novos e grava `titulo`/`situacao`/`dt_prevista`
- [ ] Validação de mesmo-contrato para `p_id_pre_insight_origem` e `p_id_registro_origem` (mesma forma de `RAISE EXCEPTION` das duas já existentes)
- [ ] `rel_fato_origem` grava as 4 colunas quando qualquer origem vier preenchida
- [ ] `supabase db push` (dev) aplicado sem erro
- [ ] Teste de integração: criar fato `projetado` com `p_id_registro_origem` de outro contrato → exceção; com o mesmo contrato → sucesso e linha em `rel_fato_origem` com `id_registro` preenchido
- [ ] Gate check passa: `npm run test:unit && npm run test:integration`

**Tests**: integration
**Gate**: full
**Commit**: `feat(incidencia): app.criar_fato_gerador aceita titulo/situacao/dt_prevista/pre_insight/registro`

---

### T7: `schemas/pre-insight.ts` (Zod, novo)

**What**: Schema Zod espelhando `fat_pre_insight` (mesmo molde de `schemas/insight.ts`: `id_contrato` obrigatório, conteúdo obrigatório, demais campos opcionais conforme colunas de T1).
**Where**: `src/backend/schemas/pre-insight.ts` (+ `pre-insight.test.ts`)
**Depends on**: T1
**Reuses**: `schemas/insight.ts` como molde de forma e de teste
**Requirement**: FGC-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Schema exportado + `PreInsightInput` inferido
- [ ] Testes cobrindo obrigatório vs. opcional (mesmo nível de `insight.test.ts`)
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(incidencia): schema Zod de Pré-Insight`

---

### T8: Estender `schemas/fato-gerador.ts`

**What**: Adiciona `titulo` (obrigatório no client, mesmo com coluna nullable — confirmado por Pedro), `situacao` (`'projetado'|'realizado'`, default `'realizado'`), `dt_prevista`, `id_pre_insight_origem`, `id_registro_origem`; novo `.refine()` condicional (`situacao==='realizado'` exige `dt_ocorrencia`; `situacao==='projetado'` exige `dt_prevista` e proíbe `dt_ocorrencia`).
**Where**: `src/backend/schemas/fato-gerador.ts` (+ `fato-gerador.test.ts`, estendido)
**Depends on**: T2, T3
**Reuses**: Estrutura de `.refine()` já usada em `ck_fato_niveis`/`ck_fato_preditores` no mesmo arquivo
**Requirement**: FGC-06, FGC-09, FGC-15

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Campos novos tipados corretamente
- [ ] Teste cobrindo os dois ramos do refine (projetado sem `dt_prevista` falha; realizado sem `dt_ocorrencia` falha) sem quebrar os testes existentes (níveis/preditores)
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(incidencia): fatoGeradorSchema com titulo/situacao/dt_prevista/4 origens`

---

### T9: Estender `rpc/fato-gerador.ts` (`criarFatoGerador`)

**What**: `CriarFatoGeradorInput` ganha `titulo`, `situacao`, `dtPrevista`, `idPreInsightOrigem`, `idRegistroOrigem`; chamada RPC passa os novos `p_*` para `app.criar_fato_gerador` (T6).
**Where**: `src/backend/rpc/fato-gerador.ts` (+ `fato-gerador.test.ts`, estendido)
**Depends on**: T6, T8
**Reuses**: Função `criarFatoGerador` existente, só estendida
**Requirement**: FGC-06, FGC-09, FGC-15

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Todos os `p_*` novos mapeados corretamente (mock de client)
- [ ] Teste cobrindo omissão dos campos novos (compat retroativa) e presença de todos
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(incidencia): criarFatoGerador aceita os campos novos do wizard`

---

### T10: Nova função `marcarFatoRealizado` (UPDATE direto)

**What**: Função que faz `UPDATE fat_fato_gerador SET situacao='realizado', dt_ocorrencia=$1 WHERE id_fato_gerador=$2` — direto via client, sem RPC nova (mesma classe de `RegistroForm`: RLS `p_por_contrato` já cobre UPDATE por ser `FOR ALL`, confirmado por leitura de `20260813192341_incidencia_encontros_rls.sql:31-38`).
**Where**: `src/backend/rpc/fato-gerador.ts` (função nova no mesmo arquivo) (+ teste)
**Depends on**: T2
**Reuses**: RLS `p_por_contrato` já existente (nenhuma policy nova necessária); `mapeiaErroRpc` para erro
**Requirement**: FGC-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Função exportada, aceita `idFatoGerador` + `dtOcorrencia`
- [ ] Teste cobrindo sucesso e erro mapeado (RLS negada fora da carteira, via mock)
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(incidencia): marcarFatoRealizado (transição projetado → realizado)`

---

### T11: Estender `queries/incidencia.ts`

**What**: `FatoGeradorResumo` ganha `titulo`, `situacao`, `dtPrevista`; `InsightResumo` sem mudança de campo (só reconferir leitura); nova `buscarPreInsightsDoContrato` (mesmo molde de `buscarInsightsDoContrato`).
**Where**: `src/backend/queries/incidencia.ts` (+ `incidencia.test.ts`, estendido)
**Depends on**: T1, T2, T3
**Reuses**: `buscarInsightsDoContrato`/`buscarFatosGeradoresDoContrato` como molde
**Requirement**: FGC-05, FGC-06, FGC-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Interfaces atualizadas, mapeamento snake_case → camelCase correto
- [ ] `buscarPreInsightsDoContrato` retorna `[]` quando não há dado (padrão `if (!data) return []`)
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(incidencia): queries de Pré-Insight e campos novos de Fato Gerador`

---

### T12: Novas queries — `buscarTimelineIncidencia` + `buscarCadeiasIncidencia`

**What**: Lê `vw_timeline_incidencia` (escopada por `id_contrato` + período opcional) e `vw_cadeia_incidencia` (escopada por `id_contrato`).
**Where**: `src/backend/queries/incidencia.ts` (funções novas no mesmo arquivo) (+ teste)
**Depends on**: T5
**Reuses**: Padrão de `buscarReguaDoContrato`/`buscarIipContrato` (client por parâmetro, `if (!data) return []`)
**Requirement**: FGC-10, FGC-13

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Duas funções exportadas com tipos de retorno próprios
- [ ] Teste cobrindo filtro de período (presente/ausente) e lista vazia
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(incidencia): queries de timeline e cadeia`

---

### T13: Módulo puro `incidencia-timeline.ts` (`agrupaPorMes`)

**What**: Função pura que recebe a lista de `buscarTimelineIncidencia` e devolve agrupado por mês, ordem decrescente, com cabeçalho de mês.
**Where**: `src/frontend/lib/incidencia-timeline.ts` (+ `incidencia-timeline.test.ts`)
**Depends on**: T12
**Reuses**: Padrão de `src/frontend/lib/planejamento-formato.ts` (módulo puro colocado em `lib/`)
**Requirement**: FGC-10, FGC-12

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `agrupaPorMes([])` retorna `[]` (estado vazio)
- [ ] Ordem decrescente testada com itens de meses diferentes
- [ ] Data formatada sem hora testada explicitamente (edge case do spec)
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(incidencia): agrupaPorMes (módulo puro da timeline)`

---

### T14: Módulo puro `incidencia-cadeia.ts` (`rotulaCadeias`)

**What**: Função pura que recebe a lista de `buscarCadeiasIncidencia` e devolve com rótulo posicional ("Cadeia A", "B", ...) gerado no render, separando as cadeias só-projetadas.
**Where**: `src/frontend/lib/incidencia-cadeia.ts` (+ `incidencia-cadeia.test.ts`)
**Depends on**: T12
**Reuses**: Mesmo padrão de `incidencia-timeline.ts` (função pura em `lib/`)
**Requirement**: FGC-13, FGC-14

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Letra é gerada pela função, nunca lida de um campo do dado de entrada (AD-053)
- [ ] Teste cobrindo: cadeia de 1 fato, N-fatos-origem-comum, cadeia direta no fato (sem `rel_fato_origem`), cadeia só-projetada isolada numa seção própria
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(incidencia): rotulaCadeias (módulo puro do Ciclo de Vida)`

---

### T15: `SeletorOrigem` (novo)

**What**: Componente com 4 abas (Pré-Insight, Registro, Insight, Meta) + busca textual + opção explícita "Fato sem origem" (caminho de primeira classe, nunca erro).
**Where**: `src/frontend/components/incidencia/seletor-origem.tsx` (+ `.test.tsx`)
**Depends on**: T7, T11
**Reuses**: `buscarPreInsightsDoContrato`, `buscarInsightsDoContrato`, `buscarFatosGeradoresDoContrato` (para Meta, se aplicável), `buscarRegistrosDaEtapa`/nova leitura de registros por contrato
**Requirement**: FGC-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] 4 abas + busca funcionando, escopadas ao contrato (AC4 do spec)
- [ ] "Sem origem" seleciona e conclui sem nenhuma marca de erro/pendência
- [ ] Estado vazio de busca oferece "sem origem" em vez de bloquear (Edge Case do spec)
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit (component)
**Gate**: quick
**Commit**: `feat(incidencia): SeletorOrigem (4 abas + sem origem)`

---

### T16: `FatoGeradorWizard` (novo, 2 passos)

**What**: Componente de 2 passos — passo 1 (natureza Já aconteceu/Ainda vai acontecer + `SeletorOrigem`), passo 2 (envolve `fato-gerador-form.tsx` estendido em T17). Voltar do passo 2 ao 1 preserva o preenchido.
**Where**: `src/frontend/components/incidencia/fato-gerador-wizard.tsx` (+ `.test.tsx`)
**Depends on**: T15
**Reuses**: `SeletorOrigem` (T15); `fato-gerador-form.tsx` como corpo do passo 2 (T17)
**Requirement**: FGC-01, FGC-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Passo 1 pergunta natureza + origem (AC1/AC2/AC3 do spec)
- [ ] Passo 2 recebe `situacao`/origem do passo 1 como props
- [ ] Voltar do passo 2 preserva os dados já preenchidos (Edge Case do spec) — teste explícito
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit (component)
**Gate**: quick
**Commit**: `feat(incidencia): FatoGeradorWizard (2 passos)`

---

### T17: Estender `fato-gerador-form.tsx`

**What**: Ganha campo **Título** (obrigatório), passa a receber `situacao`/origem do wizard (T16), alterna Data de ocorrência ↔ Data prevista conforme `situacao`, chama `criarFatoGerador` (T9) com os campos novos.
**Where**: `src/frontend/components/incidencia/fato-gerador-form.tsx` (+ `.test.tsx`, estendido)
**Depends on**: T9, T16
**Reuses**: Cascata Grupo→Tipologia→Estado e derivação de níveis/preditores já existentes (`:89-134`) — **não tocar**, é o "achado principal" do design
**Requirement**: FGC-01 a FGC-12 (campos do passo 2)

**Tools**:
- MCP: NONE
- Skill: `figma-dominio-legisla` (conferir rótulos: régua de 4, sem legenda D1/D2/D3, "Contribuição Legisla (0–5, opcional)")

**Done when**:
- [ ] Título obrigatório no form (mesmo com coluna nullable)
- [ ] `situacao='realizado'` exige Data de ocorrência sem hora; `situacao='projetado'` exige Data prevista e omite Data de ocorrência — os dois ramos testados
- [ ] Régua de níveis continua com 4 posições, sem legenda D1/D2/D3 (regressão coberta por teste, já que é reincidência catalogada)
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit (component)
**Gate**: quick
**Commit**: `feat(incidencia): fato-gerador-form com titulo e situacao`

---

### T18: `PreInsightForm` (novo)

**What**: Formulário de criação de Pré-Insight — INSERT direto (sem RPC, mesmo padrão de `RegistroForm`), autor resolvido por `usePapelGlobal`, nunca digitado.
**Where**: `src/frontend/components/incidencia/pre-insight-form.tsx` (+ `.test.tsx`)
**Depends on**: T7
**Reuses**: `registro-form.tsx` como molde estrutural (INSERT direto, autor via sessão, `ErroInline`)
**Requirement**: FGC-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] INSERT direto em `fat_pre_insight`, autor nunca vindo do formulário
- [ ] Erro de RLS exibido via `ErroInline`
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit (component)
**Gate**: quick
**Commit**: `feat(incidencia): PreInsightForm`

---

### T19: Ação "Registrar como realizado"

**What**: Controle (botão + diálogo pequeno pedindo só a Data de ocorrência) que chama `marcarFatoRealizado` (T10) sobre um Fato Gerador projetado.
**Where**: `src/frontend/components/incidencia/realizar-fato-dialog.tsx` (+ `.test.tsx`)
**Depends on**: T10
**Reuses**: `ErroInline`, padrão de diálogo pequeno (mesma forma dos dialogs em `ficha-contrato-chrome.tsx`, antes de serem retirados em T26)
**Requirement**: FGC-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Exige Data de ocorrência no ato (AC4 do spec)
- [ ] Sucesso muda a exibição de PROJETADO para realizado sem recarregar a página inteira
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit (component)
**Gate**: quick
**Commit**: `feat(incidencia): ação de registrar Fato Gerador como realizado`

---

### T20: `TimelineFeed` + `PainelDetalhe` (novos)

**What**: Feed cronológico agrupado por mês (usa `agrupaPorMes`, T13) com filtro por tipo e por período; painel lateral de detalhe mostrando atributos de classificação quando for Fato Gerador.
**Where**: `src/frontend/components/incidencia/timeline-feed.tsx`, `painel-detalhe.tsx` (+ `.test.tsx` para os dois)
**Depends on**: T12, T13
**Reuses**: `EstadoVazio`, `agrupaPorMes`
**Requirement**: FGC-10, FGC-11, FGC-12

**Tools**:
- MCP: NONE
- Skill: `figma-dominio-legisla` (conferir: tipo de Registro vem de `ref_tipo_registro`, Pilar dos 4 de `ref_pilar_insight`, sem badge "Não Conectado", data sem hora)

**Done when**:
- [ ] Desmarcar um tipo oculta só aquele tipo, mantendo ordem dos demais
- [ ] Fato sem origem renderiza **sem** marca de falha (regressão coberta — reincidência catalogada)
- [ ] Data de ocorrência exibida sem hora em todo lugar
- [ ] Período sem itens mostra `EstadoVazio` explícito, não lista vazia
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit (component)
**Gate**: quick
**Commit**: `feat(incidencia): TimelineFeed e PainelDetalhe`

---

### T21: `CadeiaLista` + `IncidenciaKpis` (novos)

**What**: Lista de cadeias com letra posicional gerada no render (usa `rotulaCadeias`, T14) + KPIs (contagem de realizados separada de "N projeções em aberto") + `IipCard` reaproveitado, rotulado (provisório).
**Where**: `src/frontend/components/incidencia/cadeia-lista.tsx`, `incidencia-kpis.tsx` (+ `.test.tsx` para os dois)
**Depends on**: T12, T14
**Reuses**: `iip-card.tsx` (sem mudança), `rotulaCadeias`
**Requirement**: FGC-13, FGC-14

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Cadeia com origem comum marcada explicitamente; cadeia direta no fato sem marca de incompletude; cadeia só-projetada numa seção "Cadeia Projetada (em análise)"
- [ ] KPI mostra realizados e "N projeções em aberto" **separados**, nunca somados num só número
- [ ] IIP exibido com rótulo "(provisório)"
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit (component)
**Gate**: quick
**Commit**: `feat(incidencia): CadeiaLista e IncidenciaKpis`

---

### T22: `AbaIncidencia` (novo) — casca com toggle de visão

**What**: Componente que alterna Linha do Tempo / Ciclo de Vida por querystring (`?visao=`, `router.replace`, sem histórico — mesma forma de `PlanejamentoAbas`) e hospeda o menu "Criar ▾" com as 4 entidades.
**Where**: `src/frontend/components/incidencia/aba-incidencia.tsx` (+ `.test.tsx`)
**Depends on**: T16, T18, T20, T21
**Reuses**: Forma de `components/planejamento/planejamento-abas.tsx` (não o componente em si — é específico de Planejamento)
**Requirement**: FGC-14, FGC-16

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Alternar visão não perde o estado já carregado (não remonta a timeline ao trocar pra Ciclo de Vida e voltar)
- [ ] Menu "Criar ▾" oferece as 4 entidades (Registro, Pré-Insight, Insight, Fato Gerador)
- [ ] Querystring desconhecida cai no padrão (Linha do Tempo), mesmo tratamento de `normalizaAba`
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit (component)
**Gate**: quick
**Commit**: `feat(incidencia): AbaIncidencia (toggle Linha do Tempo/Ciclo de Vida + Criar)`

---

### T23: Estender `registro-form.tsx` — edição + seletor de etapa

**What**: Ganha modo edição (valores iniciais + UPDATE em vez de INSERT quando `id` presente) e, para uso fora da tela de etapa, um Select de etapa alimentado por `buscarReguaDoContrato` (já existe — nenhuma query nova) quando `idEtapa` não vier fixado pelo contexto.
**Where**: `src/frontend/components/incidencia/registro-form.tsx` (+ `.test.tsx`, estendido)
**Depends on**: T22
**Reuses**: `buscarReguaDoContrato` (`queries/etapa-contrato.ts:26`); estrutura de INSERT direto existente, estendida para UPDATE condicional
**Requirement**: FGC-17

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Sem etapa fixada por prop, o form exige a seleção explícita antes de habilitar Salvar (AC4 do spec — nunca perde o vínculo)
- [ ] Modo edição preenche valores iniciais e faz UPDATE, não duplica linha
- [ ] Tela de etapa continua funcionando sem alteração de comportamento visível (regressão)
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit (component)
**Gate**: quick
**Commit**: `feat(incidencia): RegistroForm com edição e seletor de etapa`

---

### T24: Estender `insight-form.tsx` — edição

**What**: Ganha modo edição (valores iniciais + UPDATE quando `id` presente); nenhuma mudança de campo.
**Where**: `src/frontend/components/incidencia/insight-form.tsx` (+ `.test.tsx`, estendido)
**Depends on**: T22
**Reuses**: Estrutura existente do form, estendida para UPDATE condicional
**Requirement**: FGC-18

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Modo edição preenche valores iniciais e faz UPDATE
- [ ] Modo criação continua idêntico (regressão)
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit (component)
**Gate**: quick
**Commit**: `feat(incidencia): InsightForm com edição`

---

### T25: Página `/contratos/[id]/fatos-registros`

**What**: Monta `AbaIncidencia` com as 4 entidades (Registro/T23, Pré-Insight/T18, Insight/T24, Fato Gerador via Wizard/T16), a Linha do Tempo (T20) e o Ciclo de Vida (T21). Item da timeline acionado para edição abre o formulário da própria entidade sem sair da aba.
**Where**: `src/frontend/app/(app)/contratos/[id]/fatos-registros/page.tsx` (+ `page.test.tsx`, mesmo molde de `agenda/page.test.tsx`)
**Depends on**: T22, T23, T24
**Reuses**: Mesmo padrão de composição de `etapas/[codigo]/page.tsx` e `agenda/page.tsx`
**Requirement**: FGC-16

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] As 4 entidades se criam e se editam nesta página, sem sair da aba (AC1/AC2)
- [ ] Salvar atualiza a timeline sem recarregar a página inteira (AC8)
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit (component)
**Gate**: quick
**Commit**: `feat(incidencia): página da aba Fatos Geradores e Registros`

---

### T26: Retirar Insight/Fato Gerador de `ficha-contrato-chrome.tsx`

**What**: Remove os dois `Dialog` (Insight, Fato Gerador), os imports de `InsightForm`/`FatoGeradorForm` e o estado associado (`dialogInsightAberto`, `dialogFatoGeradorAberto`).
**Where**: `src/frontend/components/produtos/ficha-contrato-chrome.tsx` (+ `.test.tsx`, atualizado)
**Depends on**: T25
**Reuses**: —
**Requirement**: FGC-16, FGC-18

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Nenhum import/estado/dialog órfão restante
- [ ] Teste existente (`ficha-contrato-chrome.test.tsx`) atualizado, sem referência aos dois dialogs
- [ ] Aba "Fatos Geradores e Registros" continua acessível e funcional (T25)
- [ ] Gate check passa: `npm run lint:all && npm run build && npm run test:unit`

**Tests**: unit (component)
**Gate**: build
**Commit**: `refactor(incidencia): retira dialogs de Insight/Fato Gerador do chrome (AD-057)`

---

### T27: Retirar `RegistroForm` de `etapas/[codigo]/page.tsx`

**What**: Remove a renderização de `RegistroForm` da tela de etapa — a régua/leitura de registros da etapa permanece, só a escrita sai.
**Where**: `src/frontend/app/(app)/contratos/[id]/etapas/[codigo]/page.tsx` (+ `page.test.tsx`, atualizado)
**Depends on**: T25
**Reuses**: —
**Requirement**: FGC-16, FGC-17

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `RegistroForm` não é mais renderizado nesta página; leitura da régua/registros da etapa intacta
- [ ] Nenhum ponto de entrada órfão (usuário clica em algo e nada acontece)
- [ ] Gate check final passa: `npm run lint:all && npm run build && npm run test:unit && npm run test:integration`

**Tests**: unit (component)
**Gate**: build
**Commit**: `refactor(incidencia): retira RegistroForm da tela de etapa (AD-057)`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:  T1 ──┬─→ T3 ──┬─→ T5 ──→ T6
          T2 ──┴─→ T4 ──┘
Phase 2:  T7 ──┐
          T8 ──┼─→ T9
          T10 ─┤
          T11 ─┴─→ T12 ─┬─→ T13
                         └─→ T14
Phase 3:  T15 ─→ T16 ─→ T17
          T18
          T19
          T20
          T21
          (T15/T16 via T22, T18, T19 não bloqueia T22 diretamente mas converge) T16, T18, T20, T21 ─→ T22
Phase 4:  T22 ─┬─→ T23 ─┐
               ├─→ T24 ─┼─→ T25 ─┬─→ T26
               └────────┘         └─→ T27
```

Execução é estritamente sequencial dentro de cada fase — um único agente (ou worker de lote) trabalha uma task por vez, em ordem.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1–T6 | 1 migration cada | ✅ Granular |
| T7 | 1 schema Zod novo | ✅ Granular |
| T8 | 1 schema Zod estendido | ✅ Granular |
| T9, T10 | 1 função rpc cada | ✅ Granular |
| T11, T12 | 1 arquivo de queries estendido, funções coesas do mesmo domínio | ✅ OK (coeso) |
| T13, T14 | 1 módulo puro cada | ✅ Granular |
| T15, T16, T18, T19, T22 | 1 componente novo cada | ✅ Granular |
| T17, T23, T24 | 1 componente existente estendido | ✅ Granular |
| T20, T21 | 2 componentes irmãos, mesmo propósito (feed+detalhe / cadeia+kpi) | ✅ OK (coeso, mesmo padrão do design.md) |
| T25 | 1 página nova | ✅ Granular |
| T26, T27 | 1 remoção cada | ✅ Granular |

**Granularity check**: nenhuma task cobre múltiplos componentes não-relacionados; os únicos pares (T11/T12, T20/T21) são coesos — mesmo arquivo ou mesmo par funcional já tratado assim pelo `design.md`.

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | None | ✅ Match |
| T2 | None | None | ✅ Match |
| T3 | T1 | T1 | ✅ Match |
| T4 | T2 | T2 | ✅ Match |
| T5 | T1, T2, T3 | T1, T2, T3 | ✅ Match |
| T6 | T2, T3 | T2, T3 | ✅ Match |
| T7 | T1 | T1 | ✅ Match |
| T8 | T2, T3 | T2, T3 | ✅ Match |
| T9 | T6, T8 | T6, T8 | ✅ Match |
| T10 | T2 | T2 | ✅ Match |
| T11 | T1, T2, T3 | T1, T2, T3 | ✅ Match |
| T12 | T5 | T5 | ✅ Match |
| T13 | T12 | T12 | ✅ Match |
| T14 | T12 | T12 | ✅ Match |
| T15 | T7, T11 | T7, T11 | ✅ Match |
| T16 | T15 | T15 | ✅ Match |
| T17 | T9, T16 | T9, T16 | ✅ Match |
| T18 | T7 | T7 | ✅ Match |
| T19 | T10 | T10 | ✅ Match |
| T20 | T12, T13 | T12, T13 | ✅ Match |
| T21 | T12, T14 | T12, T14 | ✅ Match |
| T22 | T16, T18, T20, T21 | T16, T18, T20, T21 | ✅ Match |
| T23 | T22 | T22 | ✅ Match |
| T24 | T22 | T22 | ✅ Match |
| T25 | T22, T23, T24 | T22, T23, T24 | ✅ Match |
| T26 | T25 | T25 | ✅ Match |
| T27 | T25 | T25 | ✅ Match |

**Rules confirmadas**: nenhuma task depende de uma task de fase posterior; toda dependência da tabela tem seta correspondente no Phase Execution Map.

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1–T6 | Migrations/SQL | integration | integration | ✅ OK |
| T7–T11 | Zod schema / rpc / queries | unit | unit | ✅ OK |
| T12 | queries | unit | unit | ✅ OK |
| T13, T14 | Módulo puro (lib) | unit | unit | ✅ OK |
| T15–T25 | Componente React | unit (component) | unit (component) | ✅ OK |
| T26, T27 | Componente React (remoção) | unit (component) | unit (component), gate `build` (fecha a feature) | ✅ OK |

**Nenhuma violação** — nenhuma task usa "testado em outra task" como justificativa; toda task que cria/modifica uma camada com tipo de teste exigido inclui o teste na própria task.

---

## Tips

- **Reuses = Token saver** — Sempre referenciar código existente
- **`fato-gerador-form.tsx` não se reescreve** — é o achado principal do design; T17 estende, nunca substitui a cascata Grupo→Tipologia→Estado
- **T26/T27 são as últimas** — só depois da aba (T25) estar funcionando, para nunca deixar ponto de entrada órfão
- **Profundidade integral (AD-042/044)** — todo componente cobre os dois lados de cada condicional + vazio + erro, não só o caminho feliz
