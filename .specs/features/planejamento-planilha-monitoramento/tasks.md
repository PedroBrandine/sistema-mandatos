# Planejamento do Contrato / Planilha de Monitoramento — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its
Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is
the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review,
Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/planejamento-planilha-monitoramento/design.md`
**Status**: Draft — aguardando decisão de execução (inline vs. sub-agente de batch, ver nota abaixo)

**Nota de execução**: 17 tasks > ~8 (limiar de oferta de sub-agente do skill). As duas features mais
recentes deste mesmo projeto com escopo comparável (`convite-contrato`, 16 tasks; e o próprio
`operacao-regua-instanciacao`) rodaram **inline, sem sub-agente de batch**, por pedido explícito do
Pedro em cada uma. Esta sessão apresenta a oferta formalmente (protocolo "offer-then-confirm" do
skill — nunca despachar sub-agente sem aceite explícito) antes de iniciar Execute.

---

## Test Coverage Matrix

> Gerado por amostragem do codebase (`vitest.config.ts`, `vitest.integration.config.ts`,
> `supabase/tests/operacao/regua-rls.integration.test.ts`, `src/backend/rpc/kanban.test.ts`,
> `src/backend/queries/etapa-contrato.ts`, `src/backend/schemas/contrato.test.ts`) + `spec.md`.
> Nenhum guideline de teste formal em `AGENTS.md`/`CLAUDE.md` além dos comandos de `package.json` —
> profundidade vem da amostragem (piso) e dos ACs de PLM-01 a PLM-11 (teto).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| RLS/GRANT das 4 tabelas novas (cadeia `EXISTS` de 4 níveis) | integration | PLM-05/06 completos: Assessor `UPDATE` em toda coluna de `fat_sucesso_mensal` do contrato vinculado (sucesso) e em `fat_meta`/`fat_objetivo_especifico`/`dim_planejamento` (falha `42501`); mesmo teste em contrato não vinculado (falha); Mentor `INSERT` (prova o fix de sequence) — mesma profundidade de `regua-rls.integration.test.ts` | `supabase/tests/planejamento/planejamento-rls.integration.test.ts` | `npm run test:integration` |
| Cascata (`app.recalcula_atingimento` + 5 triggers de marcação) | integration | PLM-07/08/09 completos: fórmula ponderada por `peso` na Meta, média simples no Objetivo (excluindo `pausada`/`descartada`) e no Planejamento, `atingimento_desatualizado` true→false nos 3 gatilhos (INSERT/UPDATE/DELETE de `fat_sucesso_mensal`) e 2 (INSERT/UPDATE de `fat_meta`) | `supabase/tests/planejamento/planejamento-cascata.integration.test.ts` | `npm run test:integration` |
| RPC nova `app.atualiza_sucessos_mensais_lote` | integration | PLM-03: atomicidade (1 valor inválido reverte a faixa inteira, nenhuma célula parcial salva), RLS/GRANT respeitados (Assessor só na própria linha vinculada) | `supabase/tests/planejamento/planejamento-lote.integration.test.ts` | `npm run test:integration` |
| `src/backend/schemas/planejamento.ts` (Zod) | unit | 1:1 por `CHECK` espelhado (`ck_sucesso_pct`/`ck_sucesso_mes`/`ck_meta_preditores`/`ck_objetivo_preditores`/`ck_meta_classe`), válido+inválido — mesma profundidade de `contrato.test.ts` | `src/backend/schemas/planejamento.test.ts` | `npm run test:unit` |
| `src/backend/queries/planejamento.ts` | unit | mapeamento campo a campo, agrupamento por Meta, lista vazia sem lançar — mesma profundidade de `kanban.test.ts` | `src/backend/queries/planejamento.test.ts` | `npm run test:unit` |
| `src/backend/rpc/planejamento.ts` (+ 6 entradas novas em `errors.ts`) | unit | Sucesso + cada código de erro mapeado (`42501`, `23514` por constraint) por função exportada — mesma profundidade de `kanban.test.ts`/`convite.test.ts` | `src/backend/rpc/planejamento.test.ts` | `npm run test:unit` |
| `GradeSucessosMensais`, `HierarquiaPlanejamento`, `PlanejamentoAgregadoCoalizao`, dialogs, `planejamento/page.tsx` | none | Projeto não tem teste de componente/rota Next.js hoje (débito documentado em `plataforma-ui-tanstack/design.md`, reafirmado em `convite-contrato`/`operacao-regua-instanciacao`) — build gate cobre compilação | — | build gate only |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tasks só com teste unitário | `npm run test:unit` |
| Full | Tasks com teste de integração | `npm run test:unit && npm run test:integration` |
| Build | Fim de fase / tasks sem teste (schema, componente, rota) | `npm run build && npm run lint:all` |

---

## Execution Plan

Phases são ordenadas e rodam sequencialmente — cada fase completa antes da próxima começar, e as
tasks dentro de uma fase rodam em ordem.

### Phase 1: Schema (Postgres)

```
T1 → T2 → T3 → T4 → T5 → T6
```

### Phase 2: Backend TypeScript + Testes de Integração

```
T7 → T8 → T9 → T10 → T11 → T12 → T13
```

### Phase 3: Frontend

```
T14 → T15 → T16 → T17
```

**Packing sugerido** (caso o sub-agente de batch seja aceito): Batch A = Phase 1 (T1-T6, 6 tasks),
Batch B = Phase 2 (T7-T13, 7 tasks), Batch C = Phase 3 (T14-T17, 4 tasks) — cada corte cai em
fronteira de fase, nenhuma fase dividida.

---

## Task Breakdown

### T1: Migration — DDL das 4 tabelas + view (verbatim)

**What**: `supabase migration new planejamento_planilha_estrutura` criando `rel_planejamento_preditor`,
`fat_objetivo_especifico`, `fat_meta`, `fat_sucesso_mensal` (`CREATE TABLE IF NOT EXISTS`, verbatim
`docs/schema_sistema.sql:895-980`, incluindo todos os `CHECK`/`UNIQUE`/comentários de coluna) +
`vw_sucesso_mensal` (`CREATE OR REPLACE VIEW ... WITH (security_invoker = true)`, verbatim `:1196-1200`).
**Where**: `supabase/migrations/<timestamp>_planejamento_planilha_estrutura.sql`
**Depends on**: None (`dim_planejamento` já existe, de `operacao-regua-instanciacao`)
**Reuses**: nenhuma tabela — extração pura do schema aprovado (AD-025)
**Requirement**: PLM-01 (fonte de dados)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `supabase db push` aplica sem erro no projeto de dev
- [ ] As 4 tabelas + a view existem (`supabase db diff` limpo contra o texto aprovado)
- [ ] Rodar a migration de novo não falha (`CREATE TABLE IF NOT EXISTS` idempotente)

**Tests**: none
**Gate**: build

---

### T2: Migration — RLS `p_heranca` (cadeia `EXISTS`, `WITH CHECK` explícito)

**What**: `ENABLE`/`FORCE ROW LEVEL SECURITY` + `CREATE POLICY p_heranca` nas 4 tabelas de T1,
predicados `EXISTS` verbatim (`docs/schema_sistema.sql:1589-1597`), com `WITH CHECK` idêntico à
`USING` acrescentado explicitamente (mesmo desvio deliberado já estabelecido por
`20260812001234_regua_instanciacao_rls.sql`).
**Where**: `supabase/migrations/<timestamp>_planejamento_planilha_rls.sql`
**Depends on**: T1
**Reuses**: padrão `DO $$ FOREACH ... CREATE POLICY` de `regua_instanciacao_rls.sql`
**Requirement**: PLM-05, PLM-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `pg_policies` mostra `p_heranca` com `qual` E `with_check` não nulos nas 4 tabelas
- [ ] `relforcerowsecurity = true` nas 4 tabelas

**Tests**: none
**Gate**: build

---

### T3: Migration — Grants (re-run ALL TABLES + mentor/assessor + fix de sequence)

**What**: Re-`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO legisla_app,
legisla_admin, legisla_gestora` + sequences (AD-025) + fatia do GRANT aprovado
(`docs/schema_sistema.sql:2080-2098`, verbatim): Mentor `SELECT, INSERT, UPDATE` em
`fat_sucesso_mensal` + `SELECT` em `fat_objetivo_especifico, fat_meta, vw_sucesso_mensal`; Assessor
`SELECT, UPDATE` (tabela inteira) em `fat_sucesso_mensal` + `SELECT` em `fat_objetivo_especifico,
fat_meta, vw_sucesso_mensal`; **e** `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO
legisla_mentor` (achado de Design — primeira feature a dar `INSERT` real ao Mentor desde o
bootstrap).
**Where**: `supabase/migrations/<timestamp>_planejamento_planilha_grants.sql`
**Depends on**: T1
**Reuses**: padrão de `20260812001310_regua_instanciacao_grants.sql`
**Requirement**: PLM-05, PLM-06 (mecanismo)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `pg_class.relacl` mostra `legisla_app/admin/gestora` com `arwd` nas 4 tabelas + view
- [ ] Mentor com `rwa` em `fat_sucesso_mensal`, `r` em `fat_objetivo_especifico`/`fat_meta`/`vw_sucesso_mensal`
- [ ] Assessor com `rw` em `fat_sucesso_mensal`, `r` em `fat_objetivo_especifico`/`fat_meta`/`vw_sucesso_mensal`
- [ ] `rel_planejamento_preditor` sem GRANT a mentor/assessor (leitura literal do aprovado)

**Tests**: none
**Gate**: build

---

### T4: Migration — Cascata (função + 5 triggers de marcação, verbatim)

**What**: `app.recalcula_atingimento(p_id_planejamento BIGINT)` (verbatim `:1476-1512`) +
`app.recalcula_pendentes(p_limite INT DEFAULT 200)` (verbatim `:1515-1525`, sem consumidor nesta
feature — extraída por completude, AD-008) + `app.trg_marca_desatualizado_novos/antigos/upd()` +
`app.trg_marca_por_meta_upd/ins()` (verbatim `:1738-1831`) + os 5 `CREATE TRIGGER`
(`trg_sm_ins/upd/del` em `fat_sucesso_mensal`, `trg_meta_upd/ins` em `fat_meta`). Todas
`SECURITY INVOKER` (sem cláusula), AD-024.
**Where**: `supabase/migrations/<timestamp>_planejamento_planilha_cascata.sql`
**Depends on**: T1
**Reuses**: nenhuma — extração pura
**Requirement**: PLM-07, PLM-08, PLM-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] As 2 funções + os 5 triggers existem (`\df app.*`/`\dy` no psql, ou `supabase db diff`)
- [ ] `INSERT`/`UPDATE`/`DELETE` cru em `fat_sucesso_mensal` marca `dim_planejamento.atingimento_desatualizado = true` do planejamento correspondente

**T4 fix (achado ao rodar T11)**: as 6 funções (recalcula_atingimento + 5 trg_marca_*) escrevem em
tabelas onde Mentor/Assessor só têm SELECT — qualquer escrita deles em fat_sucesso_mensal disparava
o trigger e falhava com 42501 tentando marcar dim_planejamento. Corrigido com migration própria
(`20260812151909_planejamento_planilha_cascata_security_definer_fix.sql`, `ALTER FUNCTION ...
SECURITY DEFINER`), confirmado com o usuário antes de aplicar. Registrado como AD-035 em STATE.md.
Ver design.md "Achado de Execute".

**Tests**: none (exercitado de fato em T12)
**Gate**: build

---

### T5: Migration — Auditoria (conecta `app.trg_auditoria` às 5 tabelas)

**What**: `CREATE TRIGGER trg_audit_<tabela> AFTER INSERT OR UPDATE OR DELETE ON <tabela> FOR EACH
ROW EXECUTE FUNCTION app.trg_auditoria('<pk>')` para `dim_planejamento`, `fat_objetivo_especifico`,
`fat_meta`, `fat_sucesso_mensal`, `rel_planejamento_preditor` (pks de
`docs/schema_sistema.sql:1716-1720`). `app.trg_auditoria()` **não é recriada** — já existe desde
`0012_fundacao_auditoria_gap.sql`. Guarda `IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname =
'trg_audit_' || tabela)`, mesmo padrão idempotente de `0012`/kanban.
**Where**: `supabase/migrations/<timestamp>_planejamento_planilha_auditoria.sql`
**Depends on**: T1
**Reuses**: `app.trg_auditoria()` (0012), padrão de guarda de `20260812090853_kanban_etapas_audit_trigger.sql`
**Requirement**: AD-006 (achado de Design, gap documentado em `0012` como pertencente a esta feature)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `UPDATE`/`INSERT`/`DELETE` em qualquer uma das 5 tabelas grava linha em `log_auditoria` com `tabela`/`acao`/`valor_anterior`/`valor_novo` corretos
- [ ] Rodar a migration de novo não duplica trigger (guarda `IF NOT EXISTS` funciona)

**Tests**: none
**Gate**: build

---

### T6: Migration — RPC nova `app.atualiza_sucessos_mensais_lote` (paste de faixa)

**What**: Função nova (fora do texto aprovado, justificada em `design.md` Tech Decisions por
AD-024) `app.atualiza_sucessos_mensais_lote(p_valores JSONB) RETURNS void`, `SECURITY INVOKER`, 1
`UPDATE fat_sucesso_mensal SET pct_atingimento = v.pct FROM jsonb_to_recordset(p_valores) AS
v(id_sucesso BIGINT, pct_atingimento NUMERIC) WHERE fat_sucesso_mensal.id_sucesso = v.id_sucesso`
— atômico (transação única, qualquer `CHECK` violado reverte a faixa inteira). Escopo travado em
`pct_atingimento` (não abre `peso`/`descricao`/`mes_referencia`/`dt_limite` — esses ficam no dialog
por linha, T15).
**Where**: `supabase/migrations/<timestamp>_planejamento_planilha_fn_lote.sql`
**Depends on**: T1, T2, T3 (RLS/GRANT precisam existir para a função herdar o privilégio certo do invoker)
**Reuses**: padrão `SECURITY INVOKER` de `app.instancia_contrato`
**Requirement**: PLM-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Chamar a função com uma faixa válida atualiza todas as linhas
- [ ] Chamar com 1 valor fora de 0–100 no meio da faixa não salva NENHUMA linha (rollback atômico), erro `23514` propagado

**Tests**: none (exercitado em T13)
**Gate**: build

---

### T7: `npm run db:types`

**What**: Regenerar `src/backend/supabase/database.types.ts` a partir do projeto de dev, agora com
as 4 tabelas + view novas tipadas.
**Where**: `src/backend/supabase/database.types.ts`
**Depends on**: T1-T6 (schema precisa estar 100% aplicado em dev)
**Reuses**: script já existente (`package.json`)
**Requirement**: pré-requisito de T8-T17

**Tools**: MCP: `supabase` (se disponível) · Skill: NONE

**Done when**:
- [ ] `database.types.ts` inclui `rel_planejamento_preditor`, `fat_objetivo_especifico`, `fat_meta`, `fat_sucesso_mensal`, `vw_sucesso_mensal` com colunas corretas
- [ ] `npm run build` continua compilando (nenhum tipo quebrado em consumidor existente)

**Tests**: none
**Gate**: build

---

### T8: Zod schemas — `objetivoEspecificoSchema`, `metaSchema`, `sucessoMensalSchema`

**What**: 3 schemas em um arquivo, padrão `.refine()` por `CHECK` (réplica de `contrato.ts`):
`objetivoEspecificoSchema` (`ck_objetivo_pct`, `ck_objetivo_preditores`), `metaSchema`
(`ck_meta_pct`, `ck_meta_classe`, `ck_meta_prioridade`, `ck_meta_status`, `ck_meta_preditores`),
`sucessoMensalSchema` (`ck_sucesso_mes` — dia 1 do mês, `ck_sucesso_peso`, `ck_sucesso_pct`,
`ck_sucesso_status`).
**Where**: `src/backend/schemas/planejamento.ts` (+ `planejamento.test.ts`)
**Depends on**: T7
**Reuses**: padrão de `src/backend/schemas/contrato.ts`
**Requirement**: PLM-04, PLM-10, PLM-11

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Todo `CHECK` das 3 tabelas tem `.refine()` ou validação de campo correspondente
- [ ] `npm run test:unit` verde, casos válido+inválido por regra
- [ ] `export type <Entidade>Input = z.infer<...>` para as 3

**Tests**: unit
**Gate**: quick

---

### T9: Query `buscarPlanejamentoCompleto` + `buscarGradeSucessosMensais`

**What**: `src/backend/queries/planejamento.ts` — `buscarPlanejamentoCompleto(client, idContrato)`
(lê `dim_planejamento` + `fat_objetivo_especifico` + `fat_meta` num só round-trip, monta a árvore
`ObjetivoComMetas[]` em memória) e `buscarGradeSucessosMensais(client, idPlanejamento,
mesReferencia)` (lê `vw_sucesso_mensal` join `fat_meta` filtrado por mês, retorna
`SucessoMensalGrade[]` flat pro grupo-por-Meta acontecer no client).
**Where**: `src/backend/queries/planejamento.ts` (+ `planejamento.test.ts`)
**Depends on**: T7
**Reuses**: padrão de `src/backend/queries/etapa-contrato.ts`/`kanban.ts`
**Requirement**: PLM-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Mapeamento snake_case→camelCase completo, sem campo esquecido
- [ ] Lista vazia retorna `[]`, nunca lança
- [ ] `npm run test:unit` verde com client mockado

**Tests**: unit
**Gate**: quick

---

### T10: RPC wrappers — `recalcularAtingimento`, `atualizarSucessosEmLote` (+ entradas em `errors.ts`)

**SPEC_DEVIATION (achado ao implementar)**: o `design.md`/redação original desta task listava
também `criarObjetivoEspecifico`/`criarMeta` como RPC wrappers. Não são — são `INSERT` de uma linha
só (`fat_objetivo_especifico`/`fat_meta`), sem invariante multi-tabela, então AD-024 manda ir
**direto via PostgREST**, não por função. Confirmado pelo padrão real do repo
(`contrato-form.tsx:96-115`: `.insert()` inline no componente, erro via `mapeiaErroRpc(error).message`
mesmo sem ser um RPC de verdade). Essas duas criações movem para T15 (dialogs), inline no componente
— sem wrapper de backend dedicado, mesma convenção de `contrato-form.tsx`/`usuario-form.tsx`.

**What**: `src/backend/rpc/planejamento.ts` com as 2 funções que são RPC de verdade (padrão
`(client, input) => Promise<T>`, `client.schema("app").rpc(...)`, erro via `mapeiaErroRpc`) + 6
entradas novas em `MENSAGENS_CHECK` (`src/backend/rpc/errors.ts`): `ck_sucesso_pct`, `ck_sucesso_mes`,
`ck_objetivo_pct`, `ck_meta_pct`, `ck_meta_preditores`, `ck_objetivo_preditores` (consumidas pelos
`INSERT`s diretos de T15 via `mapeiaErroRpc`, mesmo sem RPC).
**Where**: `src/backend/rpc/planejamento.ts` (+ `.test.ts`), `src/backend/rpc/errors.ts` (edição)
**Depends on**: T6, T7, T8
**Reuses**: padrão de `src/backend/rpc/convite.ts`/`kanban.ts`; `mapeiaErroRpc` existente
**Requirement**: PLM-02, PLM-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `atualizarSucessosEmLote` chama `app.atualiza_sucessos_mensais_lote` com o array serializado certo
- [ ] `recalcularAtingimento` chama `app.recalcula_atingimento`
- [ ] Cada função tem teste de sucesso + de cada erro mapeado que ela pode produzir
- [ ] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

---

### T11: Teste de integração — RLS (cadeia `EXISTS`, 4 níveis)

**What**: `supabase/tests/planejamento/planejamento-rls.integration.test.ts`, réplica estrutural de
`regua-rls.integration.test.ts` (`signInAs`, fixture via `runSql`, `afterAll` limpando na ordem
inversa das FKs). Cobre: Assessor `UPDATE` em toda coluna de `fat_sucesso_mensal` do contrato
vinculado (sucesso); Assessor `UPDATE`/`INSERT` em `fat_meta`/`fat_objetivo_especifico`/
`dim_planejamento` (falha `42501`); Assessor em `fat_sucesso_mensal` de contrato não vinculado
(falha); Mentor `INSERT` em `fat_sucesso_mensal` (prova o fix de sequence de T3); Gestora/Admin sem
vínculo específico (sucesso, papel global).
**Where**: `supabase/tests/planejamento/planejamento-rls.integration.test.ts`
**Depends on**: T1, T2, T3
**Reuses**: `supabase/tests/helpers/sql.ts` (`runSql`), estrutura de `regua-rls.integration.test.ts`
**Requirement**: PLM-05, PLM-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Todos os casos acima cobertos com asserção de código de erro (`42501`), não só "deu erro"
- [ ] `npm run test:integration` verde

**Tests**: integration
**Gate**: full

---

### T12: Teste de integração — Cascata

**What**: `supabase/tests/planejamento/planejamento-cascata.integration.test.ts`. Monta hierarquia
via `runSql` (1 Objetivo → 2 Metas, uma `ativa` uma `pausada` → Sucessos Mensais com pesos
25/25/50 somando 100 na Meta ativa); edita `pct_atingimento` de 3 Sucessos; chama
`app.recalcula_atingimento`; confere os 3 níveis batendo com cálculo manual (média ponderada na
Meta ativa, a Meta pausada excluída da média do Objetivo, média simples no Objetivo e no
Planejamento); confirma `atingimento_desatualizado` `true`→`false` nos 3 gatilhos de
`fat_sucesso_mensal` (INSERT/UPDATE/DELETE) e nos 2 de `fat_meta` (INSERT/UPDATE).
**Where**: `supabase/tests/planejamento/planejamento-cascata.integration.test.ts`
**Depends on**: T1, T4
**Reuses**: `runSql`, estrutura de fixture de `regua-instanciacao.integration.test.ts`
**Requirement**: PLM-07, PLM-08, PLM-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Valores calculados batem exatamente com o cálculo manual esperado (não só "não é null")
- [ ] Meta pausada comprovadamente fora do cálculo do Objetivo (teste falha se ela entrar)
- [ ] `npm run test:integration` verde

**Tests**: integration
**Gate**: full

---

### T13: Teste de integração — RPC de lote (paste de faixa)

**What**: `supabase/tests/planejamento/planejamento-lote.integration.test.ts`. Faixa válida de N
Sucessos Mensais atualiza todos numa chamada; faixa com 1 valor fora de 0–100 no meio não salva
NENHUM (rollback atômico, comparado ao estado antes da chamada); Assessor só consegue atualizar em
lote linhas do próprio contrato vinculado (RLS ainda vale dentro da RPC `SECURITY INVOKER`).
**Where**: `supabase/tests/planejamento/planejamento-lote.integration.test.ts`
**Depends on**: T6
**Reuses**: `runSql`, `signInAs`
**Requirement**: PLM-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Atomicidade comprovada (estado inalterado após faixa inválida)
- [ ] RLS comprovadamente ainda ativa dentro da função `SECURITY INVOKER`
- [ ] `npm run test:integration` verde

**Tests**: integration
**Gate**: full

---

### T14: Componente `GradeSucessosMensais` (grade editável)

**What**: `@tanstack/react-table` (`useReactTable`, agrupado por `idMeta`); célula de
`pctAtingimento` vira `<input>` no foco, `Tab`/`blur` chama `UPDATE` direto (PostgREST, 1 linha);
seleção de faixa + `Ctrl+V` chama `atualizarSucessosEmLote` (T10); validação 0–100 no `onChange`
antes de qualquer round-trip; `Badge` de status/atraso a partir de `vw_sucesso_mensal` (nunca
recalculado no client).
**Where**: `src/frontend/components/planejamento/grade-sucessos-mensais.tsx`
**Depends on**: T9, T10
**Reuses**: `components/ui/table.tsx`, `components/ui/badge.tsx`
**Requirement**: PLM-01, PLM-02, PLM-03, PLM-04

**Tools**: MCP: NONE · Skill: `frontend-design` (opcional, pra UX da célula/paste)

**Done when**:
- [ ] `npm run build` compila a rota sem erro
- [ ] Tab entre células funciona; colar uma faixa de texto (`\n`/`\t`) distribui nas células certas
- [ ] Valor fora de 0–100 é rejeitado inline, nunca chega a disparar `UPDATE`/RPC

**Tests**: none (débito de UI documentado, build gate cobre)
**Gate**: build

---

### T15: Componente `HierarquiaPlanejamento` + formulários de Objetivo/Meta

**SPEC_DEVIATION (achado ao implementar, 2 correções)**: (1) não existe precedente de `<Dialog>`
de criação neste repo — `ContratoForm`/`CoalizaoForm` renderizam condicionalmente **inline** na
própria página (`coalizoes/[id]/page.tsx:184-190`), só `ConfirmDeleteDialog` usa dialog de verdade
(pra confirmação de exclusão). `objetivo-form.tsx`/`meta-form.tsx` seguem o padrão real (inline, sem
`<Dialog>`), renomeados sem o sufixo `-dialog`. (2) O dialog "editar detalhes" por linha de Sucesso
Mensal (`peso`/`descricao`/`mes_referencia`/`dt_limite`) foi **cortado do escopo** — nenhuma AC do
`spec.md` exige uma UI de edição desses campos (só PLM-05/06 exigem que o *banco* permita, o que já
está provado por T11); adicionar um 4º componente sem ancoragem em AC seria escopo além do spec.
Registrado em `context.md` como Deferred Idea.

**What**: Árvore Objetivo → Meta com `pct_atingimento` de cada nível (`Badge`) e alerta visual
(não bloqueio) quando a soma de `peso` das Metas de um Objetivo ≠ 100; botões "+ Objetivo"/"+ Meta"
visíveis só para `gestora`/`mentor`/`admin`; `objetivo-form.tsx`/`meta-form.tsx` fazem `INSERT`
direto (`fat_objetivo_especifico`/`fat_meta` via PostgREST, sem RPC — ver SPEC_DEVIATION de T10),
erro via `mapeiaErroRpc`, mesmo padrão de `contrato-form.tsx`; `meta-form.tsx` esconde o campo
preditor secundário quando o produto do contrato é PLL (PLM-11).
**Where**: `src/frontend/components/planejamento/hierarquia-planejamento.tsx`,
`objetivo-form.tsx`, `meta-form.tsx`
**Depends on**: T8, T9, T10
**Reuses**: RHF+Zod (padrão de `contrato-form.tsx`), `usePapelGlobal` (`kanban-board.tsx`)
**Requirement**: PLM-08 (exibição), PLM-10, PLM-11

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `npm run build` compila sem erro
- [ ] Campo preditor secundário ausente no formulário de Meta quando produto = PLL
- [ ] Alerta de soma de peso ≠ 100 aparece sem impedir salvar `pct_atingimento`

**Tests**: none (débito de UI documentado)
**Gate**: build

---

### T16: Componente `PlanejamentoAgregadoCoalizao`

**What**: Para contrato de Coalizão com `dim_coalizao.possui_planejamento_proprio = false`, lista os
`id_contrato` dos membros (`rel_coalizao_membro`) e renderiza `HierarquiaPlanejamento` +
`GradeSucessosMensais` uma vez por membro (seção/aba), sem agregação nova nem escrita.
**Where**: `src/frontend/components/planejamento/planejamento-agregado-coalizao.tsx`
**Depends on**: T14, T15
**Reuses**: os dois componentes acima, sem alteração
**Requirement**: Edge Case (`spec.md`, "Coalizão sem planejamento próprio")

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `npm run build` compila sem erro
- [ ] Nenhum formulário de criação de Objetivo aparece nesta visão (só leitura agregada)

**Tests**: none (débito de UI documentado)
**Gate**: build

---

### T17: Página — substitui o placeholder + chama recálculo ao abrir

**What**: `src/frontend/app/(app)/contratos/[id]/planejamento/page.tsx` troca `<EmDesenvolvimento
titulo="Planejamento Estratégico em desenvolvimento" />` pelo conteúdo real: busca produto do
contrato + `dim_coalizao.possui_planejamento_proprio` (quando aplicável), chama
`recalcularAtingimento` (T10) uma vez ao montar a página, e renderiza `HierarquiaPlanejamento` +
`GradeSucessosMensais` ou `PlanejamentoAgregadoCoalizao` conforme o caso.
**Where**: `src/frontend/app/(app)/contratos/[id]/planejamento/page.tsx`
**Depends on**: T14, T15, T16
**Reuses**: a própria rota já reservada (NAV-08) — nenhuma rota nova
**Requirement**: PLM-01, PLM-07 (ponto de disparo do recálculo síncrono)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `npm run build` inclui a rota sem erro
- [ ] Abrir a página chama `app.recalcula_atingimento` exatamente uma vez (não a cada re-render)
- [ ] `npm run lint:all` sem novo erro nos arquivos desta feature

**Tests**: none (débito de UI documentado)
**Gate**: build

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3

Phase 1:  T1 → T2 → T3 → T4 → T5 → T6
Phase 2:  T7 → T8 → T9 → T10 → T11 → T12 → T13
Phase 3:  T14 → T15 → T16 → T17
```

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | (início da Phase 1) | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T1 | T1 → T2 → T3 (sequencial na fase) | ✅ Match |
| T4 | T1 | T3 → T4 (sequencial na fase) | ✅ Match |
| T5 | T1 | T4 → T5 (sequencial na fase) | ✅ Match |
| T6 | T1, T2, T3 | T5 → T6 (sequencial na fase) | ✅ Match |
| T7 | T1-T6 | Phase 1 → Phase 2 | ✅ Match |
| T8 | T7 | T7 → T8 | ✅ Match |
| T9 | T7 | T8 → T9 (sequencial na fase) | ✅ Match |
| T10 | T6, T7, T8 | T9 → T10 (sequencial na fase) | ✅ Match |
| T11 | T1, T2, T3 | T10 → T11 (sequencial na fase) | ✅ Match |
| T12 | T1, T4 | T11 → T12 (sequencial na fase) | ✅ Match |
| T13 | T6 | T12 → T13 (sequencial na fase) | ✅ Match |
| T14 | T9, T10 | Phase 2 → Phase 3 | ✅ Match |
| T15 | T8, T9, T10 | T14 → T15 (sequencial na fase) | ✅ Match |
| T16 | T14, T15 | T15 → T16 (sequencial na fase) | ✅ Match |
| T17 | T14, T15, T16 | T16 → T17 (sequencial na fase) | ✅ Match |

Nenhuma task depende de uma task de fase posterior — todas as setas apontam pra trás ou dentro da
mesma fase.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1-T6 | 1 migration cada | ✅ Granular |
| T7 | 1 comando + regeneração de 1 arquivo | ✅ Granular |
| T8 | 3 schemas Zod cohesivos no mesmo arquivo de domínio | ✅ OK (cohesivo, mesmo domínio) |
| T9 | 2 funções de query cohesivas no mesmo arquivo | ✅ OK (cohesivo) |
| T10 | 4 wrappers RPC + edição de `errors.ts` | ✅ OK (cohesivo, mesmo arquivo de domínio + dependência direta) |
| T11-T13 | 1 arquivo de teste de integração cada | ✅ Granular |
| T14 | 1 componente | ✅ Granular |
| T15 | 1 componente + 3 dialogs do mesmo domínio (hierarquia) | ✅ OK (cohesivo, mesma tela) |
| T16 | 1 componente | ✅ Granular |
| T17 | 1 arquivo de rota | ✅ Granular |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | DDL puro | none | none | ✅ OK |
| T2 | RLS puro | none | none | ✅ OK |
| T3 | GRANT puro | none | none | ✅ OK |
| T4 | Função/trigger SQL (exercitado em T12) | none (schema) | none | ✅ OK |
| T5 | Trigger de auditoria | none | none | ✅ OK |
| T6 | RPC SQL (exercitado em T13) | none (schema) | none | ✅ OK |
| T7 | Tipos gerados | none | none | ✅ OK |
| T8 | Zod schema | unit | unit | ✅ OK |
| T9 | Query | unit | unit | ✅ OK |
| T10 | RPC wrapper + errors.ts | unit | unit | ✅ OK |
| T11 | RLS (integração) | integration | integration | ✅ OK |
| T12 | Cascata (integração) | integration | integration | ✅ OK |
| T13 | RPC de lote (integração) | integration | integration | ✅ OK |
| T14-T17 | Componentes/rota | none | none | ✅ OK |

Nenhuma violação — todo `Tests: none` corresponde a uma linha "none" da matriz (débito de teste de
UI documentado no projeto inteiro, não desta feature).
