# Incidência & Encontros — Tasks

## Execution Protocol (MANDATORY — não pular)

Implementar estas tasks com a skill `tlc-spec-driven`: **ativá-la pelo nome e seguir o fluxo de
Execute e as Critical Rules dela.** Não procurar os arquivos da skill por caminho de sistema — a
skill é a fonte de verdade do fluxo completo (ciclo por task, delegação de sub-agente, Verifier,
sensor de discriminação).

**Se a skill não puder ser ativada, PARE e avise o usuário — não prossiga sem ela.**

---

**Design**: `.specs/features/incidencia-encontros/design.md`
**Status**: Approved (aprovado por Pedro em 2026-08-13, incluindo o SPEC_DEVIATION de Encontro)

---

## Test Coverage Matrix

> Gerado a partir de amostragem do repositório (`supabase/tests/{kanban,planejamento,visao-gerencial}/`,
> `src/backend/**/*.test.ts`) + `CLAUDE.md`. Nenhum guideline formal de cobertura (sem
> `jest.config`/threshold) — projeto segue convenção observada: schema/RLS/RPC/trigger cobertos por
> teste de **integração** (banco real de dev), lógica de validação/leitura/wrapper coberta por teste
> de **unidade** (vitest, sem harness de componente React — débito conhecido L-006/L-007, aplica-se
> também a hooks React, nunca testados isoladamente em todo o repo).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Migrations (DDL/RLS/grants/triggers/RPC/view/MV) | integration | RLS `USING`+`WITH CHECK` nos 2 sentidos por papel; `GRANT` por role; todo `CHECK`/`UNIQUE` novo com 1 caso violador; as 2 RPCs cobrindo caminho feliz + validação de mesmo-contrato; `mv_iip_contrato`/`vw_iip_contrato` com fixture real (fato com/sem indicador) | `supabase/tests/incidencia/*.integration.test.ts` | `npm run test:integration` |
| `vw_carteira` (extensão AD-032) | integration | Colunas novas (`iip_provisorio`/`nr_fatos`/`dt_ultimo_registro`) com valor real e com `NULL` | `supabase/tests/visao-gerencial/vw-carteira.integration.test.ts` (estende arquivo existente) | `npm run test:integration` |
| Zod schemas (`registro`/`insight`/`fato-gerador`/`encontro`) | unit | 1:1 com cada `CHECK`/`.refine()` mapeado no design; todo Edge Case do `spec.md` que é validável em schema | `src/backend/schemas/*.test.ts` | `npm run test:unit` |
| `errors.ts` (extensão) | unit | Toda constraint nova mapeada retorna a classe/mensagem certa | `src/backend/rpc/errors.test.ts` (novo — arquivo não existe ainda; criar) | `npm run test:unit` |
| RPC wrappers (`rpc/fato-gerador.ts`/`insight.ts`/`iip.ts`) | unit | Payload correto ao `client.schema("app").rpc(...)`; erro mapeado via `mapeiaErroRpc` | `src/backend/rpc/*.test.ts` | `npm run test:unit` |
| Queries (`queries/incidencia.ts`) | unit | Shape de retorno camelCase; `if (!data) return []`; todo campo `NULL`-safe (AD-005) | `src/backend/queries/incidencia.test.ts` | `npm run test:unit` |
| `usePapelGlobal` (hook estendido) | none | Hook React sem harness de teste em todo o repo (0 hooks testados hoje) — mesmo débito de componente | — | `npm run build && npm run lint:all` |
| Componentes React (`IipCard`, 4 forms, `EncontrosLista`, páginas) | none | Sem harness de componente no projeto (L-006/L-007) | — | `npm run build && npm run lint:all` |

## Gate Check Commands

> Gerado do repositório — `package.json` scripts + `CLAUDE.md`.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Depois de task de schema Zod/RPC-wrapper/query (unit) | `npm run test:unit` |
| Full | Depois de task de migration (schema/RLS/grants/RPC/view) | `npm run test:integration` |
| Build | Depois de task de frontend, ou fim de fase | `npm run build && npm run lint:all` |

---

## Execution Plan

35 tasks, 5 fases — **oferta de lote de sub-agente** (>~8 tasks, ver abaixo). Uma migration/commit
por task de schema (convenção de toda feature anterior); tasks de código de app agrupam por
preocupação única (1 arquivo/1 conceito).

### Phase 1: Schema (DB) — 9 tasks

```
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9
```

### Phase 2: Integration Tests — Schema — 6 tasks

```
T10 → T11 → T12 → T13 → T14 → T15
```

### Phase 3: Backend TS — Infra — 7 tasks

```
T16 → T17 → T18 → T19 → T20 → T21 → T22
```

### Phase 4: Backend TS — RPC Wrappers & Queries — 5 tasks

```
T23 → T24 → T25 → T26 → T27
```

### Phase 5: Frontend — 8 tasks

```
T28 → T29 → T30 → T31 → T32 → T33 → T34 → T35
```

---

## Task Breakdown

### T1: Seed `ref_nivel_iip.maximo` + `ref_tipologia` (51 linhas do CSV)

**What**: migration `incidencia_encontros_seed_catalogos` — `INSERT` de `ref_nivel_iip`
(`codigo='maximo'`, `valor=4`, `ordem=4`) + `INSERT` das 51 linhas de
`docs/DB_Fatos_Geradores - Ref_Tipologias.csv`, mapeando `Preditor_1`/`Preditor_2` → nome completo
de `ref_preditor` (tabela `VALUES` intermediária), `"—"` → `NULL`.
**Where**: `supabase/migrations/<ts>_incidencia_encontros_seed_catalogos.sql`
**Depends on**: None
**Reuses**: padrão `ON CONFLICT DO NOTHING` de `20260810193327_catalogos_referencia_seed.sql`
**Requirement**: INC-19, INC-20

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] `ref_nivel_iip` tem 4 linhas (`baixo`/`medio`/`alto`/`maximo`)
- [x] `ref_tipologia` tem 51 linhas, nenhuma com `id_preditor_1`/`id_preditor_2` incorreto (spot-check manual de 3 linhas contra o CSV)
- [x] `supabase db push` idempotente (rodar 2x não duplica)

**Tests**: none (validado pela integração de T14) · **Gate**: build (push sem erro)

✅ **Concluída** — commit `0968ee2`.

---

### T2: DDL das 7 tabelas + `mv_iip_contrato`

**What**: migration `incidencia_encontros_estrutura` — `fat_encontro`+`rel_encontro_participante`,
`fat_registro`, `fat_insight`+`rel_insight_origem`, `fat_fato_gerador`+`rel_fato_origem`,
`mv_iip_contrato` (`WITH NO DATA` + `REFRESH` inicial sem `CONCURRENTLY` — ver design.md, "Achado
real de Design"), todos verbatim `docs/schema_sistema.sql` (linhas no design.md).
**Where**: `supabase/migrations/<ts>_incidencia_encontros_estrutura.sql`
**Depends on**: None (tabelas referenciadas — `ref_etapa`/`ref_tipo_registro`/`ref_tipologia`/
`ref_pilar_insight`/`ref_nivel_iip`/`ref_preditor` — já existem desde a Trilha C)
**Reuses**: `CREATE TABLE IF NOT EXISTS` idempotente
**Requirement**: INC-01 a INC-03, INC-09, INC-12, INC-15 a INC-17 (estrutura)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] As 7 tabelas + `mv_iip_contrato` existem no dev (`supabase db push` sem erro)
- [x] `uq_mv_iip_contrato`, `uq_encontro_sequencia`, `uq_registro_sequencia`, `uq_insight_origem_*`, `uq_fato_origem_*`, `uq_encontro_participante_usuario` existem
- [x] Rodar a migration 2x não falha (idempotente)

**Tests**: none (validado por T11/T14) · **Gate**: build (push sem erro)

✅ **Concluída** — commit `d6ea4d7`.

---

### T3: Triggers verbatim + auditoria

**What**: migration `incidencia_encontros_triggers` — `app.trg_valida_registro_produto`
(`:1908-1928`) + `app.trg_valida_insight_contrato` (`:1931-1945`), verbatim, **sem** `ERRCODE`
novo; reaplica `app.trg_auditoria()` às 7 tabelas (padrão idempotente `0012`/kanban/planejamento).
**Where**: `supabase/migrations/<ts>_incidencia_encontros_triggers.sql`
**Depends on**: T2
**Reuses**: `IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = ...)` de `0012_fundacao_auditoria_gap.sql`
**Requirement**: INC-09, INC-12

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] `INSERT` em `fat_registro` com tipo de registro fora da régua do produto é rejeitado
- [x] `INSERT`/`UPDATE` em `fat_insight.id_registro` de outro contrato é rejeitado
- [x] `log_auditoria` recebe linha em `INSERT` nas 7 tabelas

**Tests**: none (validado por T11) · **Gate**: build (push sem erro)

✅ **Concluída** — commit `66e1e23`. (Checagem viva feita nesta task: rejeição de
`trg_valida_registro_produto` confirmada contra o banco de dev. Cobertura formal
completa dos 3 itens fica com os testes de integração de T11/Phase 2.)

---

### T4: RLS — `p_por_contrato` (×4) + `EXISTS` filho (×3) + `WITH CHECK` extra em `fat_registro`

**What**: migration `incidencia_encontros_rls` — `ENABLE`/`FORCE ROW LEVEL SECURITY` + policy
`p_por_contrato` (`USING`+`WITH CHECK` explícitos) em `fat_encontro`/`fat_registro`/`fat_insight`/
`fat_fato_gerador`; policy por `EXISTS` em `rel_encontro_participante`/`rel_insight_origem`/
`rel_fato_origem`. `fat_registro.WITH CHECK` ganha `AND id_usuario_autor = app.id_usuario()`.
**Where**: `supabase/migrations/<ts>_incidencia_encontros_rls.sql`
**Depends on**: T2
**Reuses**: `DO $$ FOREACH` de `20260812001234_regua_instanciacao_rls.sql`; `EXISTS` de `0011_fundacao_rls.sql`
**Requirement**: todos (RLS transversal)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] `pg_policies` mostra `qual`+`with_check` não nulos nas 7 tabelas
- [x] `relforcerowsecurity = true` nas 7
- [x] `fat_registro` tem a cláusula extra de autoria no `with_check`

**Tests**: none (validado por T10) · **Gate**: build (push sem erro)

✅ **Concluída** — commit `e4ba0d6`.

---

### T5: Grants — bloco + mentor/assessor scoped + sequence fix do Assessor

**What**: migration `incidencia_encontros_grants` — re-`GRANT` em bloco (`legisla_app`/`admin`/
`gestora`) + `GRANT SELECT`+`INSERT` scoped a `legisla_mentor`/`legisla_assessor` em
`fat_registro`/`fat_insight`/`fat_fato_gerador`/`rel_insight_origem`/`rel_fato_origem`;
`INSERT`+`UPDATE` a `legisla_mentor`+`legisla_assessor` em `fat_encontro`/
`rel_encontro_participante` (SPEC_DEVIATION aprovado). **Inclui**
`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO legisla_assessor`.
**Where**: `supabase/migrations/<ts>_incidencia_encontros_grants.sql`
**Depends on**: T2, T4
**Reuses**: padrão de `20260812145817_planejamento_planilha_grants.sql`
**Requirement**: todos (GRANT transversal)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] `pg_class.relacl` mostra o GRANT esperado por role em cada uma das 7 tabelas
- [x] `legisla_assessor` tem `USAGE`+`SELECT` em `ALL SEQUENCES`

**Tests**: none (validado por T10) · **Gate**: build (push sem erro)

✅ **Concluída** — commit `90faaa7`. Achado documentado no commit: schema
aprovado (`docs/schema_sistema.sql:2093-2098`) nunca deu ao Assessor nenhum
acesso a estas 7 tabelas — extensão feita per spec.md P1 + SPEC_DEVIATION de
Encontro já aprovado em design.md, não é desvio novo desta task.

---

### T6: RPC `app.criar_fato_gerador`

**What**: migration `incidencia_encontros_fn_criar_fato_gerador` — função nova, `SECURITY INVOKER`,
insere `fat_fato_gerador` + (se houver origem) `rel_fato_origem`, com validação de mesmo-contrato
pra `p_id_meta_origem`/`p_id_insight_origem` (ver design.md, Data Models).
**Where**: `supabase/migrations/<ts>_incidencia_encontros_fn_criar_fato_gerador.sql`
**Depends on**: T2, T4, T5
**Reuses**: `app.id_usuario()` (`0012_fundacao_auditoria_gap.sql`)
**Requirement**: INC-01, INC-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] Chamada válida cria 1 linha em `fat_fato_gerador` (+ `rel_fato_origem` quando houver origem)
- [x] Meta/Insight de outro contrato é rejeitada com mensagem clara
- [x] Nenhum parâmetro aceita `id_usuario_autor` do chamador

**Tests**: none (validado por T12) · **Gate**: build (push sem erro)

✅ **Concluída** — commit `2c7fcce`.

---

### T7: RPC `app.criar_insight`

**What**: migration `incidencia_encontros_fn_criar_insight` — mesma forma de T6, pra `fat_insight` +
até 2 linhas em `rel_insight_origem` (Meta e/ou Sucesso), validando mesmo-contrato via cadeia
`EXISTS` de 4 níveis (Sucesso→Meta→Objetivo→Planejamento).
**Where**: `supabase/migrations/<ts>_incidencia_encontros_fn_criar_insight.sql`
**Depends on**: T2, T4, T5
**Reuses**: mesma cadeia `EXISTS` de `p_heranca` (planejamento-planilha-monitoramento)
**Requirement**: INC-12, INC-13, INC-14

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] Chamada válida cria 1 linha em `fat_insight` (+ até 2 em `rel_insight_origem`)
- [x] Meta/Sucesso/Registro de outro contrato é rejeitado

**Tests**: none (validado por T13) · **Gate**: build (push sem erro)

✅ **Concluída** — commit `31b5c35`. Nota de implementação: quando Meta e
Sucesso são informados juntos, a função grava **1 linha** em
`rel_insight_origem` com as duas colunas preenchidas (mesmo padrão de T6/
`rel_fato_origem`), não 2 linhas separadas — `ck_insight_origem` e os 2
índices UNIQUE parciais aceitam essa forma; comportamento equivalente ao
descrito em design.md.

---

### T8: `vw_iip_contrato` + `app.atualiza_iip_contrato()` (`SECURITY DEFINER`) + grants

**What**: migration `incidencia_encontros_iip` — `CREATE OR REPLACE VIEW vw_iip_contrato`
(`security_invoker = true`) + `app.atualiza_iip_contrato()` (`SECURITY DEFINER SET search_path =
public, pg_temp`, `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_iip_contrato`) + `GRANT SELECT` na
view a `legisla_mentor`/`legisla_assessor` (demais já cobertos pelo bloco).
**Where**: `supabase/migrations/<ts>_incidencia_encontros_iip.sql`
**Depends on**: T2
**Reuses**: `SECURITY DEFINER SET search_path` de `20260812151909_planejamento_planilha_cascata_security_definer_fix.sql` (AD-035)
**Requirement**: INC-03, INC-04, INC-07, INC-08

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] `legisla_mentor` consegue chamar `app.atualiza_iip_contrato()` sem `42501`
- [x] `vw_iip_contrato` retorna 1 linha por contrato (nunca 0, mesmo sem Fato Gerador)

**Tests**: none (validado por T14) · **Gate**: build (push sem erro)

✅ **Concluída** — commit `5e62d77`. **Achado real não previsto em design.md/
tasks.md**: `vw_iip_contrato` é `security_invoker=true`, o que faz o Postgres
checar GRANT nas tabelas de base (não só na view) contra o papel que chama —
sem `SELECT` direto em `mv_iip_contrato` (nenhuma role tinha) e em
`fat_contrato` (Assessor nunca teve), Mentor/Assessor teriam "permission
denied" ao consultar a view mesmo com o `GRANT SELECT` nela previsto pela
task. Corrigido nesta mesma migration com os 2 grants que faltavam;
verificado ao vivo nos dois papéis.

---

### T9: `vw_carteira` completa (resolve AD-032)

**What**: migration `incidencia_encontros_vw_carteira_completa` — `CREATE OR REPLACE VIEW
vw_carteira` pela versão completa aprovada (`docs/schema_sistema.sql:1327-1352`), incluindo
`iip_provisorio`/`nr_fatos`/`dt_ultimo_registro`. Substitui a redução de
`20260812175507_visao_gerencial_vw_carteira.sql` — **tarefa obrigatória** desta trilha.
**Where**: `supabase/migrations/<ts>_incidencia_encontros_vw_carteira_completa.sql`
**Depends on**: T2
**Reuses**: `CREATE OR REPLACE VIEW`, mesmo padrão idempotente de `vw_etapa_contrato`
**Requirement**: INC-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] `vw_carteira` tem as 3 colunas novas
- [x] Nenhum consumidor existente quebra (hoje: nenhum — só `database.types.ts`)

**Tests**: none (validado por T15) · **Gate**: build (push sem erro)

✅ **Concluída** — commit `e3ee5e4`. Nota: a marcação de AD-032 como resolvida
em `.specs/STATE.md` (spec.md AC8) ficou **fora** deste lote — esse arquivo é
de outra sessão em paralelo na mesma branch (fora do escopo de Phase 1:
Schema, T1-T9); precisa ser feita por quem tiver ownership de `STATE.md`
nesta janela, ou no handoff final da feature.

---

### T10: Testes de integração — RLS + Grants

**What**: `supabase/tests/incidencia/incidencia-rls-grants.integration.test.ts` — cobre `USING`+
`WITH CHECK` (2 sentidos) das 7 tabelas por papel (admin/gestora/mentor/assessor/outro contrato) +
o `GRANT` scoped + o fix de sequence do Assessor + a cláusula de autoria de `fat_registro`.
**Where**: `supabase/tests/incidencia/incidencia-rls-grants.integration.test.ts`
**Depends on**: T4, T5
**Reuses**: `signInAs`/fixture/`afterAll` de `supabase/tests/kanban/kanban-etapas-rls-grants.integration.test.ts`
**Requirement**: todos (RLS/GRANT transversal)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] Assessor consegue `INSERT` em `fat_registro`/`fat_insight`/`fat_fato_gerador`/`fat_encontro` do próprio contrato
- [x] Assessor **não** consegue em contrato de outro
- [x] `INSERT` em `fat_registro` com `id_usuario_autor` de outra pessoa é rejeitado
- [x] `npm run test:integration` verde (contagem de testes documentada no commit)

**Tests**: integration · **Gate**: full

✅ **Concluída** — commit `378d194`. 12 casos. **Achado documentado no
teste** (não bug de migration): `trg_valida_registro_produto` é `SECURITY
INVOKER` e faz `JOIN fat_contrato` (protegida por RLS) — pro Assessor
tentando escrever em `fat_registro` de um contrato fora da carteira, o
trigger dispara primeiro com `P0001` (não `42501`), antes da `WITH CHECK`
de `p_por_contrato` ser avaliada. Resultado protegido é o mesmo (nenhuma
linha escrita); só o código/mensagem do erro difere do padrão das outras 3
tabelas (que não têm trigger tocando `fat_contrato`).

---

### T11: Testes de integração — Triggers + CHECK/UNIQUE

**What**: `supabase/tests/incidencia/incidencia-triggers-constraints.integration.test.ts` — cobre
`trg_valida_registro_produto`, `trg_valida_insight_contrato`, `ck_fato_niveis`,
`ck_encontro_planejado`, `ck_encontro_realizado`, `ck_participante_identificacao`,
`uq_registro_sequencia`, `uq_encontro_sequencia`, `uq_encontro_participante_usuario`.
**Where**: `supabase/tests/incidencia/incidencia-triggers-constraints.integration.test.ts`
**Depends on**: T3
**Reuses**: estrutura de `supabase/tests/operacao/regua-rls.integration.test.ts` (fixture + asserção por código de erro)
**Requirement**: INC-09, INC-12, INC-15, INC-16, INC-17

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] 1 caso positivo + 1 negativo por constraint listada (9 constraints/triggers, ≥9 casos)
- [x] Asserção por código de erro (`23514`/`23505`/mensagem do trigger), não só "deu erro"

**Tests**: integration · **Gate**: full

✅ **Concluída** — commit `348924e`. 9 casos (1 positivo + 1 negativo cada).

---

### T12: Testes de integração — `app.criar_fato_gerador`

**What**: `supabase/tests/incidencia/fn-criar-fato-gerador.integration.test.ts` — caminho feliz
(com e sem origem), rejeição de Meta/Insight de outro contrato, `ck_fato_niveis` via RPC.
**Where**: `supabase/tests/incidencia/fn-criar-fato-gerador.integration.test.ts`
**Depends on**: T6
**Requirement**: INC-01, INC-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] ≥4 casos (feliz sem origem, feliz com Meta, feliz com Insight, rejeição cross-contrato)
- [x] `npm run test:integration` verde

**Tests**: integration · **Gate**: full

✅ **Concluída** — commit `ee6744b`. 5 casos (feliz sem origem, feliz com
Meta, feliz com Insight, rejeição de Meta de outro contrato, rejeição de
Insight de outro contrato).

---

### T13: Testes de integração — `app.criar_insight`

**What**: `supabase/tests/incidencia/fn-criar-insight.integration.test.ts` — caminho feliz (sem
origem, com Registro, com Meta+Sucesso simultâneos), rejeição cross-contrato nos 3 vínculos.
**Where**: `supabase/tests/incidencia/fn-criar-insight.integration.test.ts`
**Depends on**: T7
**Requirement**: INC-12, INC-13, INC-14

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] ≥5 casos (feliz sem origem, com Registro, com Meta, com Sucesso, rejeição cross-contrato ×1 pelo menos)
- [x] `npm run test:integration` verde

**Tests**: integration · **Gate**: full

✅ **Concluída** — commit `5c393b7`. 8 casos: os 4 pedidos + Meta+Sucesso
simultâneos + rejeição nos 3 vínculos (Registro/Meta/Sucesso), não só 1.

---

### T14: Testes de integração — IIP (`mv_iip_contrato`/`app.atualiza_iip_contrato`/`vw_iip_contrato`)

**What**: `supabase/tests/incidencia/iip.integration.test.ts` — fixture com Fato Gerador real
(tipologia do seed T1, sem `id_indicador`) confirma `nr_fatos` correto e `iip_provisorio = NULL`
(Assumption #1b); contrato sem Fato Gerador confirma as 2 colunas `NULL` (Edge Case); refresh via
`app.atualiza_iip_contrato()` chamado por `legisla_mentor` sem erro.
**Where**: `supabase/tests/incidencia/iip.integration.test.ts`
**Depends on**: T1, T8
**Requirement**: INC-03, INC-04, INC-07, INC-08

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] ≥3 casos (com fato/sem peso → `NULL`; sem fato nenhum → `NULL`; refresh não quebra por role)
- [x] `npm run test:integration` verde

**Tests**: integration · **Gate**: full

✅ **Concluída** — commit `1a85cef`. 3 casos.

---

### T15: Estende testes de integração de `vw_carteira` (AD-032)

**What**: adiciona casos a `supabase/tests/visao-gerencial/vw-carteira.integration.test.ts`
confirmando `iip_provisorio`/`nr_fatos`/`dt_ultimo_registro` presentes e corretos (valor real e
`NULL`).
**Where**: `supabase/tests/visao-gerencial/vw-carteira.integration.test.ts` (edita, não cria)
**Depends on**: T9, T14
**Requirement**: INC-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] Casos novos passam sem quebrar os existentes do arquivo
- [x] `npm run test:integration` verde (contagem total documentada)

**Tests**: integration · **Gate**: full

✅ **Concluída** — commit `0c7fcfd`. 3 casos no arquivo (1 estrutural +
2 de fixture, sendo 1 novo). **Achado/decisão**: a asserção estrutural
original ("as 3 colunas NÃO existem") testava o estado anterior a T9 desta
mesma feature — corrigida para refletir a versão completa (T9 já a
substituiu), não é uma mudança especulativa. Novo caso usa `ref_indicador`/
`ref_tipologia` de teste (isolados, cleanup em `afterAll`) para provar
`iip_provisorio` com valor real (4, fórmula verbatim calculada manualmente)
— satisfaz o "Independent Test" de spec.md P1 "Fato Gerador + IIP", que
pede exatamente essa prova via `vw_carteira`.

---

### T16: `npm run db:types`

**What**: regenera `database.types.ts` a partir do projeto de dev linkado (agora com as 7 tabelas + `vw_iip_contrato` + `vw_carteira` completa).
**Where**: `src/backend/supabase/database.types.ts`
**Depends on**: T1–T15 (schema completo + testado)
**Requirement**: pré-requisito de todo backend TS abaixo

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `database.types.ts` inclui as 7 tabelas + `vw_iip_contrato` com colunas corretas
- [ ] `vw_carteira` no arquivo tem as 3 colunas novas

**Tests**: none · **Gate**: build

---

### T17: Estende `usePapelGlobal` com `idUsuario`

**What**: `.select("papel_global")` → `.select("id_usuario, papel_global")`; `UsePapelGlobalResult`
ganha `idUsuario: number | null`.
**Where**: `src/frontend/hooks/use-papel-global.ts`
**Depends on**: T16
**Reuses**: hook existente, edição mínima
**Requirement**: INC-09 (payload de `RegistroForm`)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] 3 consumidores existentes (`Topbar`, `planejamento-arvore.tsx`, `kanban-board.tsx`) continuam compilando sem alteração
- [ ] `npm run build` limpo

**Tests**: none (débito de hook sem harness, ver matrix) · **Gate**: build

---

### T18: Estende `errors.ts` com as constraints novas

**What**: adiciona entradas em `MENSAGENS_CHECK` (`ck_fato_niveis`, `ck_encontro_planejado`,
`ck_encontro_realizado`, `ck_participante_identificacao`) e `MENSAGENS_UNICA`
(`uq_registro_sequencia`, `uq_encontro_sequencia`, `uq_encontro_participante_usuario`). Cria
`src/backend/rpc/errors.test.ts` (não existe ainda) cobrindo as 7 entradas novas + fallback.
**Where**: `src/backend/rpc/errors.ts` (+ `errors.test.ts`, novo)
**Depends on**: None
**Requirement**: Error Handling Strategy (design.md)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] 7 constraints novas mapeadas + teste de cada uma + teste do fallback genérico
- [ ] `npm run test:unit` verde, contagem documentada

**Tests**: unit · **Gate**: quick

---

### T19: `src/backend/schemas/registro.ts`

**What**: Zod `registroSchema` — `id_contrato`/`id_tipo_registro` (`number`), `nr_sequencia`
opcional (`positive`), `id_encontro` opcional, `ocorrido_em`, `canal` enum opcional, `resumo`
opcional, `conteudo` (`z.record` ou `z.object({})`, default `{}`).
**Where**: `src/backend/schemas/registro.ts` (+ `.test.ts`)
**Depends on**: None
**Reuses**: padrão `.refine()` de `schemas/planejamento.ts`
**Requirement**: INC-09, INC-10, INC-11

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Teste cobre válido + cada `CHECK` mapeável (canal inválido, sequência ≤0)
- [ ] `npm run test:unit` verde

**Tests**: unit · **Gate**: quick

---

### T20: `src/backend/schemas/insight.ts`

**What**: Zod `insightSchema` — `id_contrato`, `conteudo` (obrigatório), `desdobramentos`/
`comprovacao_dados`/`ocorrido_em` opcionais, `id_pilar` opcional, `id_registro` opcional,
`id_meta_origem`/`id_sucesso_origem` opcionais (ambos, nenhum, ou 1).
**Where**: `src/backend/schemas/insight.ts` (+ `.test.ts`)
**Depends on**: None
**Requirement**: INC-12, INC-13, INC-14

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Teste cobre válido sem origem, com Registro, com Meta+Sucesso simultâneos
- [ ] `npm run test:unit` verde

**Tests**: unit · **Gate**: quick

---

### T21: `src/backend/schemas/fato-gerador.ts`

**What**: Zod `fatoGeradorSchema` — `id_contrato`, `id_tipologia`, `nivel_d1`/`d2`/`d3` opcionais
com `.refine()` espelhando `ck_fato_niveis` ("ao menos um"), `id_preditor_1`/`2` com `.refine()`
espelhando `ck_fato_preditores`, `contribuicao_legisla` (0-5), `dt_ocorrencia`, origem opcional
(`id_meta_origem`/`id_insight_origem`).
**Where**: `src/backend/schemas/fato-gerador.ts` (+ `.test.ts`)
**Depends on**: None
**Requirement**: INC-01, INC-02, INC-08

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Teste cobre válido, rejeição de nenhum nível preenchido, rejeição de preditor 2 = preditor 1
- [ ] `npm run test:unit` verde

**Tests**: unit · **Gate**: quick

---

### T22: `src/backend/schemas/encontro.ts`

**What**: Zod `encontroSchema` com `.refine()` espelhando `ck_encontro_planejado`/
`ck_encontro_realizado`/`ck_encontro_modalidade`/`ck_encontro_sequencia`; `participanteSchema`
separado com `.refine()` XOR (`id_usuario`/`nome_livre`) espelhando `ck_participante_identificacao`.
**Where**: `src/backend/schemas/encontro.ts` (+ `.test.ts`)
**Depends on**: None
**Requirement**: INC-15, INC-16, INC-17

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Teste cobre `planejado` sem `dt_prevista_inicio` (rejeita), `realizado` sem `dt_realizada` (rejeita), participante com os 2 campos e com nenhum (rejeita ambos)
- [ ] `npm run test:unit` verde

**Tests**: unit · **Gate**: quick

---

### T23: `src/backend/rpc/fato-gerador.ts`

**What**: wrapper `criarFatoGerador(client, input)` → `client.schema("app").rpc("criar_fato_gerador", {...})`, erro via `mapeiaErroRpc`.
**Where**: `src/backend/rpc/fato-gerador.ts` (+ `.test.ts`)
**Depends on**: T16, T21
**Reuses**: assinatura de `rpc/kanban.ts`
**Requirement**: INC-01, INC-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Teste (client mockado) cobre payload correto e propagação de erro mapeado
- [ ] `npm run test:unit` verde

**Tests**: unit · **Gate**: quick

---

### T24: `src/backend/rpc/insight.ts`

**What**: wrapper `criarInsight(client, input)`, mesma forma de T23.
**Where**: `src/backend/rpc/insight.ts` (+ `.test.ts`)
**Depends on**: T16, T20
**Requirement**: INC-12, INC-13, INC-14

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Teste cobre payload correto e erro mapeado
- [ ] `npm run test:unit` verde

**Tests**: unit · **Gate**: quick

---

### T25: `src/backend/rpc/iip.ts`

**What**: wrapper `atualizaIipContrato(client)` → `client.schema("app").rpc("atualiza_iip_contrato")`, sem parâmetro.
**Where**: `src/backend/rpc/iip.ts` (+ `.test.ts`)
**Depends on**: T16
**Requirement**: INC-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Teste cobre chamada sem parâmetro e erro mapeado
- [ ] `npm run test:unit` verde

**Tests**: unit · **Gate**: quick

---

### T26: `src/backend/queries/incidencia.ts` — parte 1 (IIP + catálogos)

**What**: `buscarIipContrato`, `buscarTipologiasAtivas`, `buscarPilaresInsight`, `buscarNiveisIip`,
`buscarTiposRegistroDaEtapa`.
**Where**: `src/backend/queries/incidencia.ts` (novo, + `.test.ts`)
**Depends on**: T16
**Reuses**: shape de `queries/etapa-contrato.ts`
**Requirement**: INC-04, INC-05, INC-07, INC-08, INC-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Teste cobre `if (!data) return []`/`null` de cada função + mapeamento camelCase
- [ ] `npm run test:unit` verde

**Tests**: unit · **Gate**: quick

---

### T27: `src/backend/queries/incidencia.ts` — parte 2 (listas por contrato)

**What**: `buscarRegistrosDaEtapa`, `buscarEncontrosDoContrato`, `buscarInsightsDoContrato`,
`buscarFatosGeradoresDoContrato`.
**Where**: `src/backend/queries/incidencia.ts` (edita, mesmo arquivo de T26, + `.test.ts`)
**Depends on**: T26
**Requirement**: INC-09, INC-11, INC-12, INC-16

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Teste cobre as 4 funções novas (shape + `[]` vazio)
- [ ] `npm run test:unit` verde, contagem total do arquivo documentada

**Tests**: unit · **Gate**: quick

---

### T28: `IipCard` + wire em `ficha-contrato-chrome.tsx`

**What**: componente novo — chama `atualizaIipContrato` (síncrono ao montar) e depois
`buscarIipContrato`; mostra "IIP (provisório): X · Y fatos geradores" ou "sem dado suficiente"
(`iipProvisorio === null`, INC-07/08). Adiciona `<IipCard idContrato={idContrato} />` no chrome.
**Where**: `src/frontend/components/incidencia/iip-card.tsx` (novo) + `ficha-contrato-chrome.tsx` (edita)
**Depends on**: T25, T26
**Reuses**: `<ErroInline>`/`<CarregandoSkeleton>` (AD-029)
**Requirement**: INC-04, INC-05, INC-06, INC-07, INC-08

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `npm run build` inclui o componente sem erro
- [ ] Leitura de código confirma que o card nunca mostra `0` quando `iipProvisorio` é `null` (AD-005)

**Tests**: none (componente React, ver matrix) · **Gate**: build

---

### T29: `FatoGeradorForm`

**What**: RHF+Zod (`fatoGeradorSchema`), campos Tipologia (`buscarTipologiasAtivas`)/níveis
(`buscarNiveisIip`)/preditores (inline `ref_preditor`, mesmo padrão de `objetivo-form.tsx`)/
contribuição/data/vínculo opcional (Meta OU Insight); chama `criarFatoGerador`.
**Where**: `src/frontend/components/incidencia/fato-gerador-form.tsx`
**Depends on**: T23, T21, T26
**Reuses**: shape de `objetivo-form.tsx` (fetch de catálogo em `useEffect`, `Select`+`RefOption[]`, erro via `mapeiaErroRpc`)
**Requirement**: INC-01, INC-02, INC-08

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `npm run build` limpo
- [ ] Leitura de código confirma que o formulário não trava se `ref_tipologia` viesse vazia (defesa, mesmo com as 51 linhas seedadas)

**Tests**: none · **Gate**: build

---

### T30: `InsightForm`

**What**: RHF+Zod (`insightSchema`), campos conteúdo/desdobramentos/comprovação/data/Pilar
(`buscarPilaresInsight`)/vínculo opcional (Registro de origem do próprio contrato + Meta e/ou
Sucesso); chama `criarInsight`.
**Where**: `src/frontend/components/incidencia/insight-form.tsx`
**Depends on**: T24, T20, T26, T27
**Requirement**: INC-12, INC-13, INC-14

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `npm run build` limpo
- [ ] Seletor de Registro de origem só lista Registros do próprio contrato (leitura de código)

**Tests**: none · **Gate**: build

---

### T31: Liga `FatoGeradorForm`/`InsightForm` como `Dialog` no chrome

**What**: os 2 `<Button onClick={() => toast(...)}>` de `ficha-contrato-chrome.tsx` viram
`<Dialog><DialogTrigger>...</DialogTrigger><DialogContent><FatoGeradorForm .../></DialogContent></Dialog>`
— padrão de `usuarios/page.tsx`.
**Where**: `src/frontend/components/produtos/ficha-contrato-chrome.tsx` (edita)
**Depends on**: T29, T30
**Requirement**: INC-18

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Nenhum `toast("Em desenvolvimento")` remanescente nesses 2 botões
- [ ] `npm run build` limpo

**Tests**: none · **Gate**: build

---

### T32: `RegistroForm` + wire na aba de etapa

**What**: RHF+Zod (`registroSchema`), campo Tipo de Registro escopado à etapa
(`buscarTiposRegistroDaEtapa`)/sequência/canal/resumo/Encontro de origem opcional (só do próprio
contrato); payload inclui `id_usuario_autor` via `usePapelGlobal` estendido; `INSERT` direto.
Adiciona seção + lista (`buscarRegistrosDaEtapa`) abaixo da tabela de régua em
`etapas/[codigo]/page.tsx`.
**Where**: `src/frontend/components/incidencia/registro-form.tsx` (novo) + `contratos/[id]/etapas/[codigo]/page.tsx` (edita)
**Depends on**: T19, T27, T17
**Reuses**: shape inline (sem Dialog) de `objetivo-form.tsx`
**Requirement**: INC-09, INC-10, INC-11

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `npm run build` limpo
- [ ] Leitura de código confirma `id_usuario_autor` sempre preenchido antes do `INSERT`

**Tests**: none · **Gate**: build

---

### T33: `EncontroForm`

**What**: RHF+Zod (`encontroSchema`), status/datas condicionais (`planejado`/`realizado`)/
modalidade/local; `INSERT`/`UPDATE` direto.
**Where**: `src/frontend/components/incidencia/encontro-form.tsx`
**Depends on**: T22
**Requirement**: INC-15, INC-17

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `npm run build` limpo

**Tests**: none · **Gate**: build

---

### T34: `EncontrosLista` (+ participantes)

**What**: lista de `fat_encontro` do contrato (`buscarEncontrosDoContrato`) + gestão de
participantes por encontro (`INSERT`/`DELETE` direto em `rel_encontro_participante`, usuário do
sistema ou `nome_livre`).
**Where**: `src/frontend/components/incidencia/encontros-lista.tsx`
**Depends on**: T33, T27
**Requirement**: INC-16

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `npm run build` limpo
- [ ] Leitura de código confirma XOR `id_usuario`/`nome_livre` respeitado na UI (mesmo com `ck_participante_identificacao` como defesa de banco)

**Tests**: none · **Gate**: build

---

### T35: Rota `/contratos/[id]/encontros` + aba "Encontros" no chrome

**What**: página nova ligando `EncontrosLista`+`EncontroForm` (Dialog de criação). Adiciona
`{ href: `${base}/encontros`, label: "Encontros" }` ao array `abas` de `ficha-contrato-chrome.tsx`.
**Where**: `src/frontend/app/(app)/contratos/[id]/encontros/page.tsx` (novo) + `ficha-contrato-chrome.tsx` (edita)
**Depends on**: T33, T34
**Requirement**: INC-15, INC-16, INC-17, INC-18

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `npm run build` inclui a rota nova sem erro
- [ ] Aba "Encontros" aparece pra todos os tipos de contrato (mandato e coalizão — spec não restringe)

**Tests**: none · **Gate**: build (+ gate final da feature: `npm run test:unit && npm run test:integration && npm run build && npm run lint:all`)

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

Phase 1 (Schema):                    T1→T2→T3→T4→T5→T6→T7→T8→T9
Phase 2 (Integration Tests):         T10→T11→T12→T13→T14→T15
Phase 3 (Backend TS — Infra):        T16→T17→T18→T19→T20→T21→T22
Phase 4 (Backend TS — RPC/Queries):  T23→T24→T25→T26→T27
Phase 5 (Frontend):                  T28→T29→T30→T31→T32→T33→T34→T35
```

Execução estritamente sequencial dentro de cada fase — sem paralelismo intra-fase. Fases rodam em
sequência; cada uma assume a anterior 100% aplicada/testada.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1–T9 | 1 migration/arquivo cada | ✅ Granular |
| T10–T15 | 1 arquivo de teste de integração cada (T15 edita 1 arquivo existente) | ✅ Granular |
| T16 | 1 comando, 1 arquivo gerado | ✅ Granular |
| T17 | 1 hook, edição mínima | ✅ Granular |
| T18 | 1 arquivo (`errors.ts`) + 1 teste novo | ✅ Granular |
| T19–T22 | 1 schema Zod + 1 teste cada | ✅ Granular |
| T23–T25 | 1 wrapper RPC + 1 teste cada | ✅ Granular |
| T26–T27 | mesmo arquivo (`incidencia.ts`), split por grupo coeso de funções (5 + 4) — 2-3 funções relacionadas por task, dentro do limite "OK se coeso" | ✅ Granular (coeso) |
| T28 | 1 componente + 1 edição de wire | ✅ Granular |
| T29, T30, T33, T34 | 1 componente cada | ✅ Granular |
| T31 | 1 edição focada (troca toast→Dialog) | ✅ Granular |
| T32 | 1 componente + 1 edição de wire (mesmo padrão de T28) | ✅ Granular |
| T35 | 1 rota nova + 1 edição de wire | ✅ Granular |

Nenhuma task cria mais de 1 arquivo novo de "conceito" (arquivo de teste co-locado não conta como
2º conceito).

---

## Diagram-Definition Cross-Check

| Task | Depends On (corpo) | Diagrama mostra | Status |
| --- | --- | --- | --- |
| T1 | None | (fora do diagrama de fases — fase 1 é uma cadeia linear) | ✅ |
| T2 | None | T1→T2 | ✅ (T2 não *precisa* de T1, mas a cadeia linear da fase não quebra a regra "nunca depende de task futura") |
| T3 | T2 | T2→T3 | ✅ |
| T4 | T2 | T3→T4 (cadeia linear da fase) — dependência real é T2, não T3, mas T3 já rodou antes por ordem de fase | ✅ (sem violação: T4 nunca depende de task futura) |
| T5 | T2, T4 | T4→T5 | ✅ |
| T6 | T2, T4, T5 | T5→T6 | ✅ |
| T7 | T2, T4, T5 | T6→T7 | ✅ |
| T8 | T2 | T7→T8 | ✅ (mesma nota de T4) |
| T9 | T2 | T8→T9 | ✅ |
| T10 | T4, T5 | T9→T10 (fronteira de fase) | ✅ |
| T11 | T3 | T10→T11 | ✅ |
| T12 | T6 | T11→T12 | ✅ |
| T13 | T7 | T12→T13 | ✅ |
| T14 | T1, T8 | T13→T14 | ✅ |
| T15 | T9, T14 | T14→T15 | ✅ |
| T16 | T1–T15 | T15→T16 (fronteira de fase) | ✅ |
| T17–T22 | T16 (T18–T22 na prática independentes, sequenciadas pela fase) | T16→T17→...→T22 | ✅ |
| T23 | T16, T21 | T22→T23 (fronteira de fase) | ✅ |
| T24 | T16, T20 | T23→T24 | ✅ |
| T25 | T16 | T24→T25 | ✅ |
| T26 | T16 | T25→T26 | ✅ |
| T27 | T26 | T26→T27 | ✅ |
| T28 | T25, T26 | T27→T28 (fronteira de fase) | ✅ |
| T29 | T23, T21, T26 | T28→T29 | ✅ |
| T30 | T24, T20, T26, T27 | T29→T30 | ✅ |
| T31 | T29, T30 | T30→T31 | ✅ |
| T32 | T19, T27, T17 | T31→T32 | ✅ |
| T33 | T22 | T32→T33 | ✅ |
| T34 | T33, T27 | T33→T34 | ✅ |
| T35 | T33, T34 | T34→T35 | ✅ |

Nenhuma task depende de uma task de fase posterior. Onde a dependência real (corpo) é "mais
frouxa" que a seta do diagrama (ex.: T4/T8/T9 dependem só de T2, não da task imediatamente
anterior), a ordem ainda é segura porque a execução é estritamente sequencial dentro da fase —
nunca há execução fora de ordem que exponha essa diferença.

---

## Test Co-location Validation

| Task | Code Layer Criado/Modificado | Matrix Exige | Task Diz | Status |
| --- | --- | --- | --- | --- |
| T1–T9 | Migrations (DDL/RLS/grants/RPC/view/MV) | integration (validado em T10–T15, mesma fase seguinte) | none (task de schema) → validado por T10–T15 | ✅ OK (merge-forward explícito: SQL só é testável depois do push, convenção de toda feature anterior) |
| T10–T14 | Testes de integração novos | integration | integration | ✅ OK |
| T15 | Estende teste de integração existente | integration | integration | ✅ OK |
| T16 | `database.types.ts` gerado | none (config/gerado) | none | ✅ OK |
| T17 | Hook React | none (débito de hook sem harness) | none | ✅ OK |
| T18 | `errors.ts` | unit | unit | ✅ OK |
| T19–T22 | Zod schemas | unit | unit | ✅ OK |
| T23–T25 | RPC wrappers | unit | unit | ✅ OK |
| T26–T27 | Queries | unit | unit | ✅ OK |
| T28–T35 | Componentes/páginas React | none (débito de componente sem harness) | none | ✅ OK |

Nenhuma violação. `Tests: none` só aparece onde a matrix diz `none` (schema antes do push, hook/
componente React sem harness) ou onde a validação está explicitamente na fase imediatamente
seguinte (schema → integração, nunca "outra task" vaga).

---

## Oferta de lote de sub-agente

35 tasks, 5 fases — acima do limiar de ~8 tasks pra execução inline. Proposta: **5 lotes**, um por
fase (T1–T9, T10–T15, T16–T22, T23–T27, T28–T35), sequenciais, cada um um sub-agente via
Agent/Task tool, relatando resumo compacto (tasks feitas, hashes de commit, contagem de teste,
desvios) antes do próximo lote começar. Aguardando confirmação do usuário antes de disparar o
primeiro lote.
