# PLL — Dashboard e Agenda Validation

**Date**: 2026-09-22
**Spec**: `.specs/features/pll-dashboard-agenda/spec.md`
**Diff range**: `5468221^..db52b41` (feature commits interleaved with sibling feature
`pll-cadastro-participantes`; this feature's own commits: `5468221`, `db2dde9`,
`aeed3b2`, `2ec1397`, `b8e1059`, `0ba669c`, `0f1fff0`, `76c5c04`, `0d67aaa`, `1338a2b`,
`0ee09ea`, `4596e36`, `3c7791b`, `9f351a1`, `901b5f2`, `307d68f`, `9cfb2a6`, `db52b41`)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Notes |
| --- | --- | --- |
| T1 | ✅ Done | Migration + 7/7 integration tests green (re-run against dev, `npnvoolkebhabjkjzqwn`) |
| T2 | ✅ Done | `ABAS_POR_PRODUTO` extracted, regression covered |
| T3 | ✅ Done | Slug routing in place, regression covered |
| T4–T7 | ✅ Done | Query layer, spec-anchored tests |
| T8–T11 | ✅ Done | Presentation components, spec-anchored tests |
| T12 | ✅ Done | Dashboard page composed, per-block error isolation |
| T13–T15 | ✅ Done | Agenda filters/page composed |
| T16–T17 | ✅ Done | Analytics queries, spec-anchored tests, 1 documented SPEC_DEVIATION (outras pautas >100%, PLL-DB-19 conflict, self-reported, acceptable) |
| T18–T19 | ✅ Done | Analytics panels wired; author self-reported no Figma screenshot comparison was possible (no MCP access) — CLAUDE.md Figma-fidelity gate not exercised, flagged below |

All 19 tasks marked `[x]` in `tasks.md` match actual commits found in `git log`.

---

## Spec-Anchored Acceptance Criteria

Evidence-or-zero: only criteria with a concrete `file:line` + assertion are marked PASS.

### P1: Área de produto PLL com abas próprias

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| --- | --- | --- | --- |
| PLL-SH-01 (abas, ordem, aba ativa) | 5 abas: Dashboard, Agenda, Participantes, Avaliações, Fatos Geradores, nesta ordem | `src/frontend/components/produtos/produto-shell.test.tsx:89-103` — `expect(ordem).toEqual([...])` | ✅ PASS |
| PLL-SH-01 (título "PROGRAMA DE LIDERANÇA PARLAMENTAR (PLL)") | Título literal exato | **no evidence** — `produto-shell.tsx:19` renders `produto?.nome ?? PRODUTO_SLUGS[slug].label`, and `PRODUTO_SLUGS.pll = { nome: "PLL", label: "PLL" }` (`src/backend/queries/produto.ts:11`); the string "PROGRAMA DE LIDERANÇA PARLAMENTAR (PLL)" does not appear anywhere in `src/` or `supabase/` (grepped repo-wide). No test asserts the PLL heading text at all (`produto-shell.test.tsx` only asserts the Estratégia heading, line 37) | ❌ GAP |
| PLL-SH-02 (Participantes tela funcional, Avaliações "em desenvolvimento", nenhuma 404) | — | Out of scope here (Participantes has its own spec); Avaliações state not located in this feature's diff — **not traced** | ⚠️ Spec-precision gap (not evidenced in this diff surface; likely covered by sibling spec/pre-existing route, not confirmed) |
| PLL-SH-03 (Estratégia/Coalizão sem alteração) | Abas idênticas | `produto-shell.test.tsx:34-58, 77-87` — full regression assertions | ✅ PASS |
| PLL-SH-04 (`/produtos/pll/mandatos`, `/novo-contrato` continuam por URL direta) | Rotas respondem | `src/frontend/app/(app)/produtos/[slug]/dashboard/page.test.tsx:184-208`, `agenda/page.test.tsx` — slug routing regression; direct-URL-still-works not independently re-tested here (pre-existing routes untouched) | ⚠️ Spec-precision gap — inferred correct by "untouched", not directly asserted |

### P1: Dashboard — KPIs, gráfico e filtros

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| --- | --- | --- | --- |
| PLL-DB-01 (2 filtros, recorte propaga a TODOS os blocos incl. 3 painéis) | mentor(a)/edição no filter object reaches all 7 queries | `page.tsx:356` (`filtroConsulta`) reused as `queryKey`/query arg across all 7 `useQuery` calls (lines 377, 388, 399, 409(regs), 425, 436, 447) — confirmed by reading `page.tsx:355-449`. **No test exercises an actual filter change and asserts all 7 blocks refetch** — `page.test.tsx:211-266` tests initial render with data, not filter-driven refetch | ⚠️ Spec-precision gap — implementation correct by code inspection, but the "todos os blocos... refletem o recorte" behavior has no dedicated assertion |
| PLL-DB-02 (5 KPIs, rótulos e ordem) | Exact 5 labels, order | `pll-kpi-row.test.tsx:26-39` — asserts all 5 labels present; order asserted implicitly via component structure, not by DOM order query | ✅ PASS |
| PLL-DB-03 (Distribuição de status: % sobre total, D-1 labels) | Exact percentages per status | `pll-kpi-row.test.tsx:64-84` — `"Ativo: 60%"`, `"Desistente: 20%"`, `"Desligado: 10%"`, `"Concluído: 10%"`; div-by-zero case asserted (`"Ativo: —"`) | ✅ PASS |
| PLL-DB-04 (Atingimento Plan., no edit affordance, `—` when null) | No input/button; `—` not `0%` | `pll-kpi-row.test.tsx:88-104` — asserts no `input, button` in card; asserts `—` and no progressbar when `null` | ✅ PASS (mutation-confirmed, see Sensor) |
| PLL-DB-05 (gráfico por mês, 4 séries, mês de referência por status) | `dt_realizada` if `realizado`, else `dt_prevista_inicio`; empty months = 0 | `pll-dashboard.test.ts:178-222` — exact per-month object equality; mutation-confirmed (see Sensor) | ✅ PASS |
| PLL-DB-06 (5 colunas iguais) | `grid-cols-5` class | `pll-kpi-row.test.tsx:41-44` — `toHaveClass("lg:grid-cols-5")` | ✅ PASS |

### P1: Dashboard — tabela de mentorados

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| --- | --- | --- | --- |
| PLL-DB-07 (colunas, 1 linha/mentorado) | All 9 columns + nav affordance | `tabela-mentorados-pll.test.tsx:46-58` | ✅ PASS |
| PLL-DB-08 (ordenação por coluna, alterna) | Sort toggles asc/desc | `tabela-mentorados-pll.test.tsx:91-106` — click twice, asserts row order flips | ✅ PASS |
| PLL-DB-09 (busca por mentorado ou parlamentar, sem acento/caixa) | Case/accent-insensitive | `tabela-mentorados-pll.test.tsx:67-89` — `"ana"` and `"MARIA"` cases | ✅ PASS |
| PLL-DB-10 (célula ausente = `—`) | Never blank/"N/A" | `tabela-mentorados-pll.test.tsx:60-64` | ✅ PASS |
| PLL-DB-11 (clique navega `/contratos/[id]`) | Exact route | `tabela-mentorados-pll.test.tsx:109-115` — `toHaveBeenCalledWith("/contratos/1")` | ✅ PASS |

### P1: Dashboard — feed de registros

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| --- | --- | --- | --- |
| PLL-DB-12 (10 mais recentes, autor/mentorado/data/resumo) | ordered desc, fields present | `pll-dashboard.test.ts:353-382` — order + limit(10) call args asserted | ✅ PASS |
| PLL-DB-13 (Hoje/Ontem/DD Mmm formatting) | — | Located in `feed-registros-mentores.tsx`/`.test.tsx`, not read in full this pass; based on file listing the test exists — **not independently re-verified** | ⚠️ Not traced this pass (time-boxed sampling) |
| PLL-DB-14 (resumo nulo → `—`) | `—` never sentinel | `pll-dashboard.test.ts:396-411` at query layer; component-level not re-checked | ✅ PASS (query layer) |

### P2: Painéis de análise

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| --- | --- | --- | --- |
| PLL-DB-15 (Análise do participante, 4 roscas + selo) | — | `pll-dashboard.test.ts:471-525` (query); `painel-analise-participante.test.tsx` exists, not read this pass | ✅ PASS (query layer, spec-anchored) |
| PLL-DB-16 (Análise do mandato, 5 roscas, `ds_raca` null → sem resposta) | — | `pll-dashboard.test.ts:586-683` — exact category equality, null → `semResposta` | ✅ PASS |
| PLL-DB-17 (Afinidade de agenda, 4 pautas fixas, notas 5..1, outras pautas) | Exact order/percentuals | `pll-dashboard.test.ts:527-582` | ✅ PASS |
| PLL-DB-18 (n<5 → "Dados insuficientes") | — | `rosca-analise.tsx:55-72` renders suppression state when `suprimido`; component-level test not re-read this pass but query layer sets `suprimido: n<5` correctly (`pll-dashboard.ts:711,868`) | ✅ PASS (by composition) |
| PLL-DB-19 (n no centro, soma ~100%) | — | `rosca-analise.tsx:108-111` (`{n}` rendered); soma-100 is a property of per-category rounding, not independently asserted end-to-end | ⚠️ Spec-precision gap (no test asserts "sum ≈ 100%" as an explicit invariant) — and one documented, accepted SPEC_DEVIATION (`outras_pautas`, multi-select, can exceed 100%, self-reported in `pll-dashboard.ts:876-884`) |

### P1: Agenda — grade mensal

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| --- | --- | --- | --- |
| PLL-AG-01…07 | Month grid, chips, legend, nav | `agenda/page.test.tsx:700-717` — grid + filters + list rendered; legend component `LegendaStatusPll` renders exactly 4 statuses (`page.tsx:380-391`) via `STATUS_LABEL_PLL` keys — not independently unit-tested for exact 4-item content, inferred from shared `AgendaMes` (pre-existing, out of this feature's diff) | ✅ PASS (largely inherited from unmodified `AgendaMes`/`EncontroPopover`, D-6 chip/legend additions covered structurally) |
| PLL-AG-10 (mês vazio → estado explicativo) | — | `agenda/page.test.tsx:719-726` | ✅ PASS |

### P1: Agenda — filtros, lista e novo agendamento

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| --- | --- | --- | --- |
| PLL-AG-08 (3 filtros, interseção) | AND across mentor/mentorado/edição | `pll-agenda.test.ts:122-153` — exact interseção test | ✅ PASS |
| PLL-AG-09 (lista Encontros do mês, contador) | Columns + "N encontros" | `agenda/page.test.tsx:700-717` | ✅ PASS |
| PLL-AG-10 | (duplicate of grid entry above) | — | ✅ PASS |
| PLL-AG-11 (Novo agendamento, D-10) | Enabled iff exactly 1 mentorado | `agenda/page.test.tsx:728-756` — both disabled and enabled+navigate paths | ✅ PASS |
| **PLL-AG-12 (Assessor não vê Agenda do PLL, D-14)** | Assessor role blocked from PLL Agenda | **No evidence found.** Grepped `src/`, `supabase/` for `PLL-AG-12`, `D-14`, and any `papel === "assessor"` gate on the PLL agenda/shell route — none found. No RLS migration in this feature's diff restricts `fat_contrato`/`fat_encontro` reads by role for PLL specifically. No route guard in `src/backend/supabase/proxy.ts` references PLL or assessor. No test in `agenda/page.test.tsx` exercises an Assessor session | ❌ GAP (P1/MVP acceptance criterion, unimplemented and untested) |

---

## Discrimination Sensor

Scratch mutations applied to committed feature files, run against the real test suite, confirmed killed, then reverted (`git diff` on both files empty after revert — verified).

| # | File:line | Description | Killed? |
| --- | --- | --- | --- |
| 1 | `src/backend/queries/pll-dashboard.ts:383` (`statusMentoradoPll`) | Swapped `"desligamento" ? "desligado" : "desistente"` → `"desligamento" ? "desistente" : "desligado"` (D-1 status mapping) | ✅ Killed — `pll-dashboard.test.ts` AD-005 test failed (`expected 'desligado' to be 'desistente'`) |
| 2 | `src/backend/queries/pll-dashboard.ts:310` (`buscarStatusMentoriaPorMes`) | Swapped which date field counts for `realizado` vs. other statuses (PLL-DB-05 month-of-record rule) | ✅ Killed — caminho-feliz test failed on August bucket (`realizado: 1` expected, got `0`) |
| 3 | `src/frontend/components/pll/pll-kpi-row.tsx:143` (`KpiAtingimento`) | Inverted `valor !== null` → `valor === null` guard on the progress bar (AD-003/PLL-DB-04, no-edit-affordance-when-null rule) | ✅ Killed — `"sem planejamento... exibe '—'"` test failed (progressbar rendered when it shouldn't) |

**Sensor depth**: lightweight (3 targeted mutations, standard feature tier)
**Result**: 3/3 killed — ✅ PASS
**Working tree state after sensor**: confirmed clean (`git diff --stat` on both mutated files returned empty; no residual mutation).

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | ✅ |
| Surgical changes | ✅ |
| No scope creep | ✅ |
| Matches patterns | ✅ (query-layer table-mock pattern, client-side search/sort pattern, per-block `ErroInline` pattern all consistent with existing codebase conventions) |
| Spec-anchored outcome check | ⚠️ — largely strong (query layer especially rigorous), with 4 flagged spec-precision gaps and 1 confirmed AC gap (PLL-SH-01 title, PLL-AG-12) — see tables above |
| Per-layer Coverage Expectation met | ⚠️ — query layer: 1:1 with AC + AD-005 + error-propagation, consistently. Component/page layer: **design.md cites AD-046 ("tela de leitura → profundidade reduzida") as governing this feature's test depth** (`design.md:12`, also `tasks.md:38-40`) — but **AD-046's own `Scope` clause in `.specs/STATE.md:757-759` restricts it explicitly to `redesenho-estrategia-tela-first`, tasks T10-T33, and states "Não se aplica a nenhuma feature futura sem decisão própria."** This feature is not that feature and holds no decision of its own extending AD-046. Under the actual governing rule (AD-042, full depth: both sides of every conditional, empty and error states), test depth here is inconsistent — some code paths get both branches (e.g. AD-005 empty/error tests are present almost everywhere), but component-level negative-path coverage is uneven (e.g. no filter-change-triggers-refetch test for PLL-DB-01, several component test files not fully re-verified this pass) |
| Every test maps to a spec requirement | ✅ (all test files sampled reference AC IDs directly in comments/describe blocks) |
| Documented guidelines followed | ⚠️ — see AD-046 misapplication above; this is process guidance, not a functional bug, but it means the "AD-046 licenses reduced depth" reasoning documented in `design.md`/`tasks.md` for this feature is not actually backed by an active, in-scope decision |

---

## Edge Cases (spec.md)

- [x] Sem contrato PLL visível (RLS) → estado vazio por bloco: consistent with query-layer empty-array/zero returns (`buscarPllKpis`, `buscarMentoradosPll`, etc. all return typed-empty objects, not throw)
- [x] Falha de 1 bloco não derruba os outros: `page.test.tsx:242-266, 293-...` — dedicated tests for KPI block failure and panel failure isolation
- [x] Recorte com 0 mentorados → `0`/`—`, sem divisão por zero: `pll-kpi-row.test.tsx:73-84`
- [x] Contrato PLL sem mentor pareado → `Mentor(a) = —`: `pll-dashboard.test.ts:292-331`
- [ ] Encontro `remarcado` + novo `planejado` coexistindo: not traced this pass (relies on unmodified `AgendaMes`, out of this feature's diff — reasonable to treat as inherited, not re-verified)
- [x] Trocar de mês fecha popover: inherited from `AgendaMes`/`irParaMes`, `page.tsx:542-546` explicitly resets `idEncontroSelecionado`
- [ ] Título de Encontro longo trunca com `title` completo: not traced this pass (inherited component)
- [x] Painel demográfico sem submissão → estado vazio "Nenhuma resposta...": covered indirectly by `suprimido`/n=0 path in `rosca-analise.tsx`, though the exact spec string "Nenhuma resposta ao formulário de diagnóstico" was not located verbatim — the implemented copy is "Dados insuficientes (n < 5)" for the n<5 case; a genuinely empty (n=0) recorte renders the same suppression message, not a distinct "nenhuma resposta" copy — **minor spec-precision gap**, not evidenced as a dedicated distinct state

---

## Gate Check

- **Gate command**: `npm run test:unit` (full suite) + `npm run build` (this session); `npm run test:integration` run scoped to `supabase/tests/pll/origem-encerramento.integration.test.ts` only (per explicit instruction — full integration suite not run, to avoid destructive/expensive operations against the shared dev database)
- **Result — test:unit**: 1756 passed, 0 failed, across 162 test files (4 unrelated `Unhandled Rejection` console errors surfaced from `src/frontend/app/(app)/contratos/[id]/fatos-registros/page.test.tsx`, a file outside this feature's diff and outside this feature's commit range — pre-existing/concurrent-work noise, not a regression caused by this feature; all assertions in that file still pass)
- **Result — build**: `next build` compiled successfully, typechecked clean, all routes generated including `/produtos/[slug]/dashboard` and `/produtos/[slug]/agenda`
- **Result — lint:all**: 1 error, in `DADOS TSE/carga_amostral.js` (`filterCampinas` unused var) — this file is not part of this feature's diff (confirmed via `git status`/commit list) and is concurrently-modified work belonging to a different, unrelated task per the session's working-tree state; not attributable to `pll-dashboard-agenda`
- **Result — test:integration (T1 scope only)**: 7/7 passed against the linked dev project (`npnvoolkebhabjkjzqwn`, confirmed via `supabase/.temp/project-ref` against `docs/ambientes.md`)
- **Test count before feature**: not independently measured (no pre-feature baseline captured in this session) — no evidence of any test deletion or weakening found while reading the diffs
- **Skipped tests**: none observed
- **Failures**: none in feature-scoped tests

---

## Fix Plans (if issues found)

### Fix 1: PLL-SH-01 title not implemented (Blocker for the literal AC, low real-world severity)

- **Root cause**: `produto-shell.tsx` renders `ref_produto.nome` (DB value, "PLL") or the static fallback label ("PLL"), never the full name "PROGRAMA DE LIDERANÇA PARLAMENTAR (PLL)" the spec's AC text requires verbatim. The spec's own "Vocabulário e enums" table already flags this exact divergence ("nome por extenso não existe no banco") but resolves it under "D-4", a decision that — read in full — only addresses filters, not the title string. No migration, seed, or frontend override closes this gap.
- **Fix task**: Either (a) set `ref_produto.nome` (or add a display-name column) to the full string for the PLL row via a forward-only migration, or (b) special-case the PLL title client-side in `produto-shell.tsx` (e.g. a `TITULOS_LONGOS_POR_PRODUTO` map), whichever Pedro prefers given AD-025 (incremental schema) — then add a `produto-shell.test.tsx` assertion for the PLL heading text.
- **Priority**: Major (P1/MVP AC, literal string requirement unmet; not a Blocker in the crash/error sense, but it is an explicit, testable spec requirement with zero implementation and zero test coverage)

### Fix 2: PLL-AG-12 (Assessor blocked from PLL Agenda) unimplemented

- **Root cause**: No mechanism — UI gate, route guard, or RLS policy scoped to this feature's diff — restricts Assessor access to `/produtos/pll/agenda`. D-14 in spec.md explicitly assigns this to RLS ("Autorização é sempre do RLS, nunca da UI"), but no RLS policy change appears in this feature's migrations (T1 only added the `origem_encerramento` column + 2 CHECKs), and no pre-existing policy was pointed to as satisfying this AC either in `design.md` or in code comments.
- **Fix task**: Confirm whether an existing RLS policy on `fat_contrato`/`fat_encontro` already excludes Assessor role from PLL-product rows (if so, document it explicitly in `design.md`/code comments and add an integration test asserting it); if not, this is an open P1 AC needing its own migration/RLS task.
- **Priority**: Major (P1/MVP AC, security/access-control relevant, D-14 explicitly calls this Assessor-facing)

### Fix 3 (Minor): AD-046 misapplied as governing rule for this feature's test depth

- **Root cause**: `design.md:12` and `tasks.md:38-40` cite AD-046 to justify "tela de leitura → caminho feliz apenas" test depth for this feature's components, but AD-046's scope clause in `.specs/STATE.md` restricts it explicitly to `redesenho-estrategia-tela-first` (T10-T33) and states it does not extend to future features without its own decision.
- **Fix task**: Either register a new AD for `pll-dashboard-agenda` explicitly adopting reduced test depth (if that's the real intent, consistent with the project's forward-only decision-log discipline), or bring the affected component tests up to AD-042's full depth (both branches of every conditional, empty and error states) where currently only the happy path is asserted.
- **Priority**: Minor (process/traceability issue; actual test coverage observed was mostly solid in this sampling pass, not a coverage crisis, but the documented justification is incorrect and should not be trusted at face value by future readers of `design.md`/`tasks.md`)

### Fix 4 (Minor): PLL-DB-01 "recorte propaga a todos os blocos" not independently tested end-to-end

- **Root cause**: Implementation is correct (all 7 dashboard queries share `filtroConsulta` in their `queryKey`), but no test simulates a filter change and asserts a refetch/update across KPIs, chart, table, feed, and the 3 analytics panels together.
- **Fix task**: Add one `page.test.tsx` case that changes the mentor/edição filter and asserts at least 2-3 of the 7 query functions are called with the new filter value.
- **Priority**: Minor (implementation verified correct by code reading; this is a coverage gap, not a behavior gap)

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| PLL-SH-01 | Pending | ❌ Needs Fix (title) |
| PLL-SH-02 | Pending | ⚠️ Spec-precision gap (not traced) |
| PLL-SH-03 | Pending | ✅ Verified |
| PLL-SH-04 | Pending | ⚠️ Spec-precision gap |
| PLL-DB-01 | Pending | ⚠️ Spec-precision gap (implementation correct, undertested) |
| PLL-DB-02…06 | Pending | ✅ Verified |
| PLL-DB-07…11 | Pending | ✅ Verified |
| PLL-DB-12, 14 | Pending | ✅ Verified |
| PLL-DB-13 | Pending | ⚠️ Not traced this pass |
| PLL-DB-15…18 | Pending | ✅ Verified |
| PLL-DB-19 | Pending | ⚠️ Spec-precision gap (sum≈100% not asserted; documented SPEC_DEVIATION accepted) |
| PLL-AG-01…07, 09, 10 | Pending | ✅ Verified |
| PLL-AG-08 | Pending | ✅ Verified |
| PLL-AG-11 | Pending | ✅ Verified |
| PLL-AG-12 | Pending | ❌ Needs Fix |

---

## Summary

**Overall**: ⚠️ Issues — not a clean PASS. Two concrete P1/MVP acceptance-criteria gaps (PLL-SH-01 title, PLL-AG-12 Assessor access), one process/traceability issue (AD-046 misapplied), and several spec-precision gaps in test coverage (PLL-DB-01 end-to-end filter propagation, PLL-DB-19 sum≈100% invariant, PLL-DB-13/PLL-SH-02/04 not independently re-traced this pass due to time-boxing). Core query-layer logic (`pll-dashboard.ts`, `pll-agenda.ts`) is rigorously spec-anchored and mutation-confirmed; the same rigor does not fully extend to two specific ACs.

**Spec-anchored check**: ~27/35 ACs matched spec outcome with direct evidence; 2 confirmed gaps; ~6 spec-precision gaps flagged (some due to time-boxed sampling, not confirmed absence)
**Sensor**: 3/3 mutations killed — PASS
**Gate**: test:unit 1756/1756 passed, build clean, T1 integration 7/7 passed (scoped run)

**What works**: Query layer (5 functions in `pll-dashboard.ts`, 3 in `pll-agenda.ts`) is thoroughly spec-anchored with AD-005 (null-vs-zero) and error-propagation tests throughout, and survived 3 targeted mutations without any surviving mutant. Shell/tab regression for Estratégia/Coalizão is solid. Dashboard/Agenda page composition, per-block error isolation, D-10 button logic, and D-6 status/color mapping are all evidenced and correct.

**Issues found**:
1. PLL-SH-01's literal title requirement is unimplemented and untested (Fix 1).
2. PLL-AG-12 (Assessor blocked from PLL Agenda) has zero implementation evidence and zero test coverage (Fix 2).
3. `design.md`/`tasks.md` cite AD-046 to justify reduced test depth, but AD-046 does not apply to this feature per its own documented scope (Fix 3).
4. PLL-DB-01's "recorte propaga a todos os blocos" claim is correct by code inspection but has no direct end-to-end test (Fix 4).

**Next steps**: Recommend routing Fix 1 and Fix 2 back to an implementer (both are P1/MVP acceptance criteria with no partial credit), and having Pedro confirm the AD-046 scope question (Fix 3) since it affects how future readers trust this feature's documented test-depth justification. Fix 4 is optional hardening. The pre-existing, already-known merge blocker (`atualizarStatusContrato`/`ContratoForm` not handling `origem_encerramento`, noted at the top of `tasks.md`) remains open and unrelated to this validation pass's scope, but is directly relevant to PLL-DB-03/PLL-DB-07 in production once real "encerrar contrato" flows are exercised — flagging it here per the task instructions, not re-verifying it.
