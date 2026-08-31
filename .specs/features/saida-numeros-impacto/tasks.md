# Saída — Números de Impacto, Visão do Mandato e Evolução do GIP Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its
Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is
the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review,
Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/saida-numeros-impacto/design.md`
**Status**: Approved

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute. Guidelines
> found: `CLAUDE.md` (comando de type-check manual pra arquivo novo sem consumidor; migrations
> forward-only; regra de ouro de ambientes). Sem guideline de cobertura numérica — inferido por
> amostragem de `supabase/tests/incidencia/iip.integration.test.ts`,
> `src/backend/rpc/iip.ts`/`iip.test.ts`, `src/backend/queries/visao-gerencial.ts`/`.test.ts`,
> `src/frontend/app/(app)/visao-gerencial/page.tsx` (sem teste de componente — débito conhecido
> L-006/L-007, convenção vigente do projeto, não desta feature reabrir).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| SQL — MV/view/função (`mv_numeros_impacto`, `vw_visao_mandato`, `app.atualiza_numeros_impacto`, GRANT de `vw_gip_evolucao`) | integration | Toda migration: agregação correta (window functions) + acesso por papel (Gestora/Admin permitido, Mentor/Assessor negado com `42501`) — 1:1 por task, nenhum "análogo" | `supabase/tests/saida/*.integration.test.ts` | `npm run test:integration -- supabase/tests/saida` |
| Backend TS — `rpc/numeros-impacto.ts`, `queries/numeros-impacto.ts`, `queries/planejamento.ts` (função nova) | unit | 1:1 com os ACs do spec.md que a função sustenta; mock de `SupabaseClient` (padrão `iip.test.ts`/`visao-gerencial.test.ts`) | `src/backend/{rpc,queries}/*.test.ts` (co-localizado) | `npm run test:unit` |
| Frontend — Hub tile, `/numeros-impacto`, `/numeros-impacto/[idContratante]`, `ContextoEstrategico` (GIP) | none | Sem harness de componente no projeto (débito conhecido, L-006/L-007) — verificado por `build`+`lint` e inspeção de código, nunca tratado como equivalente a teste passando | `src/frontend/**` | `npm run build && npm run lint:all` |
| `database.types.ts` (regeneração) | none | Entidade/config — gate de build apenas | `src/backend/supabase/database.types.ts` | `npm run build` |

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após task com só teste unitário (backend TS) | `npm run test:unit` |
| Full | Após task com migration + teste de integração (SQL) | `npm run test:unit && npm run test:integration -- supabase/tests/saida` |
| Build | Após task de frontend/regeneração de types, ou fechamento de fase | `npm run build && npm run lint:all` |

---

## Execution Plan

Phases are ordered and run sequentially — each phase completes before the next begins, and tasks
within a phase execute in order.

### Phase 1: Schema — `mv_numeros_impacto`, `vw_visao_mandato`, GRANT de `vw_gip_evolucao`

```
T1 → T2 → T3 → T4
```

### Phase 2: Types

```
T5
```

### Phase 3: Backend TS — RPC + queries

```
T6 → T7 → T8 → T9
```

### Phase 4: Frontend — Números de Impacto + Visão do Mandato

```
T10 → T11 → T12
```

### Phase 5: Evolução do GIP — wiring em `ContextoEstrategico`

```
T13
```

---

## Task Breakdown

### T1: `mv_numeros_impacto` — DDL verbatim + índice + comentário + refresh inicial

**What**: Migration `supabase migration new saida_numeros_impacto_estrutura` com
`CREATE MATERIALIZED VIEW mv_numeros_impacto` verbatim (`docs/schema_sistema.sql:1205-1245`,
AD-008), `CREATE UNIQUE INDEX uq_mv_numeros_impacto`, `COMMENT ON MATERIALIZED VIEW` (verbatim), e
`REFRESH MATERIALIZED VIEW mv_numeros_impacto;` (sem `CONCURRENTLY`) ao final da mesma migration —
pré-requisito pra `REFRESH ... CONCURRENTLY` funcionar depois (Risks & Concerns do design.md).
**Where**: `supabase/migrations/<timestamp>_saida_numeros_impacto_estrutura.sql`
**Depends on**: None
**Reuses**: padrão de `mv_iip_contrato`/`mv_avaliacao_nps` (MV `WITH NO DATA` + refresh inicial na
mesma migration)
**Requirement**: SAI-01, SAI-03

**Tools**:
- MCP: NONE (Supabase CLI via Bash)
- Skill: `supabase` (referência de sintaxe/CLI se necessário)

**Done when**:
- [x] `supabase db push` aplica a migration sem erro no projeto de dev linkado
- [x] `SELECT * FROM mv_numeros_impacto` retorna dado real (fixture de 2+ contratos do mesmo
      contratante) com `nr_contratos_contratante`/`dt_primeira_contratacao`/`ordem_contrato`
      corretos, sem filtro de `status`
- [x] Gate check passa: `npm run test:integration -- supabase/tests/saida`
- [x] Test count: teste de integração novo cobrindo a agregação (contratante com 1 contrato e
      contratante com 2+ contratos, ordem por `dt_inicio`)

**Tests**: integration
**Gate**: full

**Commit**: `feat(saida-numeros-impacto): T1 -- mv_numeros_impacto DDL + refresh inicial`

---

### T2: `app.atualiza_numeros_impacto()` + `GRANT SELECT` na MV (AD-036)

**What**: Migration com `CREATE OR REPLACE FUNCTION app.atualiza_numeros_impacto() RETURNS void
SECURITY DEFINER SET search_path = public, pg_temp` rodando `REFRESH MATERIALIZED VIEW
CONCURRENTLY mv_numeros_impacto;` (AD-035, mesmo padrão de `app.atualiza_iip_contrato`) +
`GRANT SELECT ON mv_numeros_impacto TO legisla_gestora, legisla_admin;` (AD-036 — nunca
`legisla_mentor`/`legisla_assessor`).
**Where**: `supabase/migrations/<timestamp>_saida_numeros_impacto_refresh.sql`
**Depends on**: T1
**Reuses**: `app.atualiza_iip_contrato`/`app.atualiza_avaliacao_nps` (mesmo padrão exato de função)
**Requirement**: SAI-02, SAI-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `supabase db push` aplica sem erro
- [x] Sessão `legisla_gestora`/`legisla_admin` chama `rpc("atualiza_numeros_impacto")` sem erro e
      `SELECT` na MV funciona depois
- [x] Sessão `legisla_mentor`/`legisla_assessor` recebe `42501` ao tentar `SELECT` na MV
      diretamente (a função em si pode ser chamada por qualquer papel — default do Postgres,
      EXECUTE liberado a `PUBLIC` — mas o resultado continua ilegível sem o `GRANT`)
- [x] Gate check passa: `npm run test:integration -- supabase/tests/saida`
- [x] Test count: +1 caso pra cada papel (gestora/admin permitido, mentor/assessor negado) + 1
      caso confirmando que o refresh concorrente atualiza dado alterado desde T1

**Tests**: integration
**Gate**: full

**Commit**: `feat(saida-numeros-impacto): T2 -- app.atualiza_numeros_impacto + GRANT (AD-036)`

---

### T3: `vw_visao_mandato` — DDL verbatim + `GRANT SELECT`

**What**: Migration com `CREATE VIEW vw_visao_mandato WITH (security_invoker = true)` verbatim
(`docs/schema_sistema.sql:1304-1324`) + `GRANT SELECT ON vw_visao_mandato TO legisla_gestora,
legisla_admin;` (nunca mentor/assessor — "uso exclusivo de usuários Legisla", Constituição §2.6).
**Where**: `supabase/migrations/<timestamp>_saida_visao_mandato.sql`
**Depends on**: None (independente de T1/T2 — relação distinta)
**Reuses**: nenhum padrão de refresh (não é MV); mesmo padrão de `GRANT` explícito pós-AD-025 já
usado em toda relação nova do projeto
**Requirement**: SAI-05, SAI-06, SAI-07

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `supabase db push` aplica sem erro
- [ ] Sessão `legisla_gestora` lê `vw_visao_mandato` filtrada por `id_contratante` e recebe as
      linhas ordenadas por `ordem_contrato`, com `id_contrato_anterior` presente quando existir
- [ ] Sessão `legisla_mentor`/`legisla_assessor` recebe `42501` ao tentar `SELECT`
- [ ] Gate check passa: `npm run test:integration -- supabase/tests/saida`
- [ ] Test count: +1 caso de conteúdo/ordem (contratante com 2+ contratos) + 1 caso de negação por
      papel

**Tests**: integration
**Gate**: full

**Commit**: `feat(saida-numeros-impacto): T3 -- vw_visao_mandato DDL + GRANT`

---

### T4: `GRANT SELECT` em `vw_gip_evolucao` (achado real de Design)

**What**: Migration só de `GRANT SELECT ON vw_gip_evolucao TO legisla_gestora, legisla_admin;` —
a view já existe (`formularios-produto`, T9) mas nunca recebeu grant nenhum (achado de Design, ver
`design.md` Risks & Concerns). Sem esta task, P3 inteira (Evolução do GIP) é inalcançável mesmo com
o frontend pronto.
**Where**: `supabase/migrations/<timestamp>_saida_gip_evolucao_grant.sql`
**Depends on**: None
**Reuses**: mesmo padrão de grant explícito de views novas (T3); escopo de papel idêntico ao de
`fat_gip`/`fat_gip_dimensao` (T7 de `formularios-produto` — só `legisla_app/admin/gestora`)
**Requirement**: SAI-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `supabase db push` aplica sem erro
- [ ] Sessão `legisla_gestora` consegue `SELECT * FROM vw_gip_evolucao WHERE id_contrato = X` sem
      erro (regressão: confirmar que ANTES desta migration a mesma query falhava com `42501` —
      documentar no teste como comentário, não precisa reproduzir o estado pré-fix)
- [ ] Gate check passa: `npm run test:integration -- supabase/tests/saida`
- [ ] Test count: +1 caso (gestora lê `vw_gip_evolucao` com dado real de GIP aplicado, incluindo
      caso `momento='meio'` com `gap`/`situacao` calculados — reaproveitar fixture de
      `supabase/tests/operacao/formularios-gip.integration.test.ts` se possível)

**Tests**: integration
**Gate**: full

**Commit**: `fix(saida-numeros-impacto): T4 -- GRANT SELECT em vw_gip_evolucao (achado: nunca tinha grant)`

---

### T5: `npm run db:types` — regenerar `database.types.ts`

**What**: Rodar `npm run db:types` contra o projeto de dev linkado para tipar `mv_numeros_impacto`,
`vw_visao_mandato` e `app.atualiza_numeros_impacto` (novos desde T1-T4).
**Where**: `src/backend/supabase/database.types.ts` (gerado)
**Depends on**: T1, T2, T3, T4 (precisa de todo o schema desta feature já aplicado em dev)
**Reuses**: script já existente, sem mudança de config
**Requirement**: SAI-01, SAI-05, SAI-08 (pré-requisito de tipo para as tasks de backend TS)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `database.types.ts` contém `mv_numeros_impacto`, `vw_visao_mandato` e
      `atualiza_numeros_impacto` com colunas/assinatura corretas
- [ ] Gate check passa: `npm run build`
- [ ] `git diff` do arquivo gerado não remove nenhuma entrada pré-existente (regressão comum de
      regeneração — conferir antes de commitar)

**Tests**: none
**Gate**: build

**Commit**: `chore(saida-numeros-impacto): T5 -- regenera database.types.ts`

---

### T6: `src/backend/rpc/numeros-impacto.ts` — `atualizaNumerosImpacto`

**What**: Wrapper único de `client.schema("app").rpc("atualiza_numeros_impacto")`, sem parâmetro.
**Where**: `src/backend/rpc/numeros-impacto.ts` (novo arquivo) + `numeros-impacto.test.ts`
**Depends on**: T5
**Reuses**: `src/backend/rpc/iip.ts` como molde exato (`mapeiaErroRpc`, mock de erro)
**Requirement**: SAI-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `atualizaNumerosImpacto(client)` chama `rpc("atualiza_numeros_impacto")` sem parâmetro e
      propaga erro via `mapeiaErroRpc`
- [ ] Gate check passa: `npm run test:unit`
- [ ] Test count: 2 testes (sucesso sem parâmetro; erro propagado via `mapeiaErroRpc`) — mesmo
      formato de `iip.test.ts`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(saida-numeros-impacto): T6 -- rpc/numeros-impacto.ts`

---

### T7: `src/backend/queries/numeros-impacto.ts` — `buscarNumerosImpacto`

**What**: `buscarNumerosImpacto(client): Promise<LinhaNumerosImpacto[]>` lendo `mv_numeros_impacto`
sem filtro de status (D4, verbatim), ordenado por `nome_contratante` no backend (a MV não define
ordem).
**Where**: `src/backend/queries/numeros-impacto.ts` (novo arquivo) + `numeros-impacto.test.ts`
**Depends on**: T5
**Reuses**: convenção `LinhaXxx`/`RowXxx` de `visao-gerencial.ts`/`produto.ts`
**Requirement**: SAI-01, SAI-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Mapeia todas as colunas listadas no `design.md` (`Data Models — LinhaNumerosImpacto`) de
      `snake_case` para `camelCase`
- [ ] Gate check passa: `npm run test:unit`
- [ ] Test count: 3 testes (mapeamento de campos com mock de linha completa; ordenação por
      `nomeContratante`; `nr_contratos_contratante`/`ordem_contrato` repassados sem recálculo —
      spec.md P1.AC1/AC3)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(saida-numeros-impacto): T7 -- queries/numeros-impacto.ts, buscarNumerosImpacto`

---

### T8: `src/backend/queries/numeros-impacto.ts` — `buscarVisaoMandato`

**What**: `buscarVisaoMandato(client, idContratante: number): Promise<LinhaVisaoMandato[]>`
lendo `vw_visao_mandato` filtrada por `id_contratante`, `.order("ordem_contrato")`.
**Where**: `src/backend/queries/numeros-impacto.ts` (mesmo arquivo de T7, função nova) +
`numeros-impacto.test.ts` (mesmo arquivo de teste)
**Depends on**: T5
**Reuses**: mesmo arquivo/convenção de T7
**Requirement**: SAI-05, SAI-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Filtra por `id_contratante` e ordena por `ordem_contrato`
- [ ] Mapeia `id_contrato_anterior` (nullable) corretamente
- [ ] Gate check passa: `npm run test:unit`
- [ ] Test count: 2 testes (mapeamento completo; contratante com `id_contrato_anterior` presente
      em 1 linha e ausente em outra — spec.md P2.AC2)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(saida-numeros-impacto): T8 -- queries/numeros-impacto.ts, buscarVisaoMandato`

---

### T9: `src/backend/queries/planejamento.ts` — `buscarEvolucaoGip` (função nova em arquivo existente)

**What**: `buscarEvolucaoGip(client, idContrato: number): Promise<LinhaEvolucaoGip[]>` lendo
`vw_gip_evolucao` filtrada por `id_contrato`, `.order("momento").order("ordem")`.
**Where**: `src/backend/queries/planejamento.ts` (edição) + `planejamento.test.ts` (edição)
**Depends on**: T5
**Reuses**: mesmo arquivo que já exporta `PlanejamentoCompleto`/`PreditorPrioritarioLinha`
(import site de `ContextoEstrategico`)
**Requirement**: SAI-08, SAI-09, SAI-10

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Mapeia todas as colunas de `LinhaEvolucaoGip` (`design.md`, incluindo `momento`/`situacao`
      como union types, não `string` genérico)
- [ ] Gate check passa: `npm run test:unit`
- [ ] Test count: 3 testes (mapeamento completo; `regua_sonhos` presente e `onde_chegamos`/`gap`/
      `situacao` `null` — momento `inicio` isolado, spec.md P3.AC2; lista vazia quando não há
      `fat_gip` pro contrato)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(saida-numeros-impacto): T9 -- queries/planejamento.ts, buscarEvolucaoGip`

---

### T10: Hub — novo tile "Números de Impacto"

**What**: Novo `<Link href="/numeros-impacto">` em `(app)/page.tsx`, mesmo padrão visual do tile
"Visão Gerencial" já existente (ícone próprio, ex. `TrendingUp` do lucide-react).
**Where**: `src/frontend/app/(app)/page.tsx` (edição)
**Depends on**: None (não depende de dado real — é só navegação)
**Reuses**: bloco `<Link href="/visao-gerencial">...</Link>` (linhas 62-84) como molde exato
**Requirement**: SAI-04 (rota nova, parte da navegação)

**Tools**:
- MCP: NONE
- Skill: `frontend-design` (se precisar calibrar o ícone/cor do card novo)

**Done when**:
- [ ] Tile navega para `/numeros-impacto`
- [ ] Visual consistente com os tiles existentes (mesmo componente `Card`, mesma estrutura)
- [ ] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(saida-numeros-impacto): T10 -- tile Numeros de Impacto no Hub`

---

### T11: `/numeros-impacto` — Server Component, gate + refresh + lista

**What**: Página nova: gate de papel server-side (`buscarPapelGlobalAtual`, bloqueia
`mentor`/`assessor` com `<NaoAutorizado>`, mesmo padrão de `visao-gerencial/page.tsx`), refresh
síncrono (`atualizaNumerosImpacto`) seguido de leitura (`buscarNumerosImpacto`), lista por
contratante com link de cada linha para `/numeros-impacto/[idContratante]`.
**Where**: `src/frontend/app/(app)/numeros-impacto/page.tsx` (novo arquivo)
**Depends on**: T6, T7, T10
**Reuses**: gate de `visao-gerencial/page.tsx:52-66`; `<CarregandoSkeleton>`/`<ErroInline>`/
`<EstadoVazio>` (AD-029)
**Requirement**: SAI-01, SAI-02, SAI-03, SAI-04

**Tools**:
- MCP: NONE
- Skill: `frontend-design` (layout da lista — tabela vs. cards, Agent's Discretion do context.md)

**Done when**:
- [ ] Mentor/Assessor acessando a URL direto recebe `<NaoAutorizado>` antes de qualquer dado
      renderizar
- [ ] Gestora/Admin veem a lista com nome do contratante, produto, projeto, status, ano de início,
      `nrContratosContratante`, `dtPrimeiraContratacao`, `ordemContrato`
- [ ] Cada linha/card linka para `/numeros-impacto/[idContratante]`
- [ ] Refresh roda antes da leitura em toda abertura da página (sem erro de "relation is not
      scannable" mesmo numa MV recém-migrada)
- [ ] Erro de refresh mostra `<ErroInline>` com retry, nunca tela quebrada
- [ ] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(saida-numeros-impacto): T11 -- pagina /numeros-impacto`

---

### T12: `/numeros-impacto/[idContratante]` — Visão do Mandato

**What**: Página nova: mesmo gate de papel (repetido — rota acessível por URL direta), leitura de
`buscarVisaoMandato`, timeline por `ordemContrato` com produto/projeto/cargo/partido/status/datas,
indicador visual de continuidade quando `idContratoAnterior` existir.
**Where**: `src/frontend/app/(app)/numeros-impacto/[idContratante]/page.tsx` (novo arquivo)
**Depends on**: T8, T11
**Reuses**: mesmo gate de T11; `<EstadoVazio>` para contratante sem contrato (defensivo, AD-005)
**Requirement**: SAI-05, SAI-06, SAI-07

**Tools**:
- MCP: NONE
- Skill: `frontend-design` (layout da timeline — Agent's Discretion do context.md)

**Done when**:
- [ ] Mentor/Assessor acessando a URL direto recebe `<NaoAutorizado>`
- [ ] Timeline ordenada por `ordemContrato`, cada contrato mostrando produto/projeto/cargo/
      partido/datas/status
- [ ] Contrato com `idContratoAnterior` presente é visualmente distinto de um contrato novo
      desconexo
- [ ] Contratante sem nenhum contrato mostra `<EstadoVazio>`, nunca erro
- [ ] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(saida-numeros-impacto): T12 -- pagina Visao do Mandato`

---

### T13: `ContextoEstrategico` — substitui placeholder de GIP por leitura real

**What**: (1) Em `contratos/[id]/planejamento/page.tsx`: novo estado `evolucaoGip`, buscado no
mesmo `useEffect` que já busca `preditoresAtuais` (via `buscarEvolucaoGip`), passado como nova prop
para `<ContextoEstrategico>`. (2) Em `contexto-estrategico.tsx`: nova prop `evolucaoGip:
LinhaEvolucaoGip[]`, substituindo o bloco placeholder (linhas 89-99) por: `<EstadoVazio>` quando
vazio, ou lista por dimensão mostrando `reguaSonhos`/`ondeChegamos`/`gap`/`situacao` por `momento`
quando houver dado (layout exato: Agent's Discretion do `context.md`).
**Where**: `src/frontend/app/(app)/contratos/[id]/planejamento/page.tsx` (edição),
`src/frontend/components/planejamento/contexto-estrategico.tsx` (edição)
**Depends on**: T9
**Reuses**: mesmo `useEffect`/`useState` client-side já usado por `preditoresAtuais` nesse arquivo
(não o padrão Server Component de T11/T12 — este arquivo já é `"use client"`); `<EstadoVazio>`
(AD-029)
**Requirement**: SAI-08, SAI-09, SAI-10

**Tools**:
- MCP: NONE
- Skill: `frontend-design` (layout da seção GIP — Agent's Discretion do context.md)

**Done when**:
- [ ] Contrato com GIP aplicado (`momento='inicio'` + `momento='meio'`, dado real de dev ou
      fixture equivalente) mostra `reguaSonhos`/`ondeChegamos`/`gap`/`situacao` por dimensão
- [ ] Contrato só com `momento='inicio'` mostra `reguaSonhos` e os demais campos ausentes (nunca
      `0` nem traço genérico sem explicação — AD-005, spec.md P3.AC2)
- [ ] Contrato sem nenhuma aplicação de GIP mostra `<EstadoVazio>`, não mais o texto placeholder
      fixo "Em desenvolvimento..."
- [ ] Placeholder antigo (comentário `PLR-06`) removido do código
- [ ] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(saida-numeros-impacto): T13 -- ContextoEstrategico consome vw_gip_evolucao real`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

Phase 1:  T1 ──→ T2 ──→ T3 ──→ T4
Phase 2:  T5
Phase 3:  T6 ──→ T7 ──→ T8 ──→ T9
Phase 4:  T10 ──→ T11 ──→ T12
Phase 5:  T13
```

Execution is strictly sequential within each phase. T3 e T4 não dependem tecnicamente de T1/T2
(relações distintas), mas seguem na mesma fase por serem todas migrações de schema desta feature —
sem ganho real em paralelizar dentro do batch (execução de sub-agente já é sequencial, Critical
Rules do skill).

**Batching proposto (13 tasks, acima do limiar de ~8 — oferecer sub-agentes)**:
- **Lote 1** (Fases 1+2+3, 9 tasks: T1-T9) — schema, types, backend TS. Cadeia de dependência
  apertada (schema → types → queries), cabe num único worker mesmo levemente acima do budget de
  ~7 (regra do skill: "só deixe uma fase acima do budget quando for uma cadeia de dependência
  apertada que genuinamente não pode ser dividida" — aqui são 3 fases inteiras, não 1 fase
  superdimensionada, mas a mesma lógica de coesão se aplica: nenhuma tem sentido isolada das
  demais).
- **Lote 2** (Fases 4+5, 4 tasks: T10-T13) — frontend completo (Números de Impacto, Visão do
  Mandato, wiring do GIP).

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: `mv_numeros_impacto` DDL + refresh inicial | 1 migration | ✅ Granular |
| T2: `app.atualiza_numeros_impacto` + GRANT | 1 migration (função + grant, mesmo objeto) | ✅ Granular (coeso — mesmo padrão de `mv_iip_contrato`) |
| T3: `vw_visao_mandato` DDL + GRANT | 1 migration | ✅ Granular |
| T4: GRANT em `vw_gip_evolucao` | 1 migration (1 statement) | ✅ Granular |
| T5: `db:types` | 1 comando/1 arquivo gerado | ✅ Granular |
| T6: `rpc/numeros-impacto.ts` | 1 função | ✅ Granular |
| T7: `buscarNumerosImpacto` | 1 função | ✅ Granular |
| T8: `buscarVisaoMandato` | 1 função (mesmo arquivo de T7, função distinta) | ✅ Granular |
| T9: `buscarEvolucaoGip` | 1 função (arquivo existente) | ✅ Granular |
| T10: Tile do Hub | 1 componente (edição pontual) | ✅ Granular |
| T11: Página `/numeros-impacto` | 1 rota | ✅ Granular |
| T12: Página Visão do Mandato | 1 rota | ✅ Granular |
| T13: Wiring GIP (2 arquivos, 1 prop nova) | 2 arquivos, 1 conceito coeso (não testável em partes separadas — ver "Resolving compilation dependencies") | ✅ Granular (2-3 coisas relacionadas no mesmo conceito = OK) |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Nenhuma seta de entrada | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | None | T2 → T3 (sequencial na fase, sem dependência real declarada) | ✅ Match — seta de fase (ordem de execução), não de dependência de dado; texto abaixo do diagrama já esclarece isso |
| T4 | None | T3 → T4 (idem) | ✅ Match — mesma nota acima |
| T5 | T1, T2, T3, T4 | Phase 1 → Phase 2 | ✅ Match |
| T6 | T5 | Phase 2 → Phase 3 (T5 → T6) | ✅ Match |
| T7 | T5 | T6 → T7 (sequencial na fase) | ✅ Match — mesma nota de ordem-de-execução-não-dependência-de-dado |
| T8 | T5 | T7 → T8 (idem) | ✅ Match |
| T9 | T5 | T8 → T9 (idem) | ✅ Match |
| T10 | None | Phase 3 → Phase 4 (T9 → T10) | ✅ Match — ordem de fase, T10 não depende de dado de T9 |
| T11 | T6, T7, T10 | T10 → T11 | ✅ Match |
| T12 | T8, T11 | T11 → T12 | ✅ Match |
| T13 | T9 | Phase 4 → Phase 5 (T12 → T13) | ✅ Match — ordem de fase; dependência real é só de T9 (dado), não de T10-T12 |

**Nota**: dentro de uma mesma fase, a seta no diagrama reflete ordem de execução sequencial (regra
do skill — "tasks dentro de uma fase executam em ordem"), não necessariamente uma dependência de
dado real entre elas. Cada task acima declara sua dependência de dado real em `Depends on`; nenhum
`Depends on` aponta pra uma fase posterior.

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | SQL — MV | integration | integration | ✅ OK |
| T2 | SQL — função + grant | integration | integration | ✅ OK |
| T3 | SQL — view + grant | integration | integration | ✅ OK |
| T4 | SQL — grant | integration | integration | ✅ OK |
| T5 | Entity/config (types gerados) | none | none | ✅ OK |
| T6 | Backend TS — rpc | unit | unit | ✅ OK |
| T7 | Backend TS — query | unit | unit | ✅ OK |
| T8 | Backend TS — query | unit | unit | ✅ OK |
| T9 | Backend TS — query | unit | unit | ✅ OK |
| T10 | Frontend | none | none | ✅ OK |
| T11 | Frontend | none | none | ✅ OK |
| T12 | Frontend | none | none | ✅ OK |
| T13 | Frontend | none | none | ✅ OK |

---

## Progresso

_(preenchido durante Execute — task, commit, status)_

- **T1** (`mv_numeros_impacto` DDL + índice + comentário + refresh inicial): ✅ Concluída.
  Migration `20260831021516_saida_numeros_impacto_estrutura.sql`. Teste de integração novo
  `supabase/tests/saida/numeros-impacto.integration.test.ts` (4 testes, todos verdes) cobrindo
  contratante com 1 contrato, contratante com 2 contratos (agregação + ordem por `dt_inicio`) e
  ausência de filtro de `status` (D4). Gate `full` (unit 460 + integration 4) verde.
- **T2** (`app.atualiza_numeros_impacto()` + `GRANT SELECT` na MV, AD-036): ✅ Concluída.
  Migration `20260831022144_saida_numeros_impacto_refresh.sql`. Testes de integração
  adicionados ao mesmo arquivo (`numeros-impacto.integration.test.ts`, +5 casos): gestora/admin
  chamam a função e leem a MV depois; mentor/assessor chamam a função (EXECUTE PUBLIC) mas
  recebem `42501` ao tentar `SELECT` direto na MV; refresh concorrente reflete contrato novo
  inserido depois da última leitura. Gate `full` (unit 460 + integration 9) verde.
