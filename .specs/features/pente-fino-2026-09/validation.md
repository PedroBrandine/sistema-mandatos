# Pente-Fino 2026-09 Validation

**Date**: 2026-09-18
**Spec**: `.specs/features/pente-fino-2026-09/spec.md`
**Diff range**: `84d37cc..HEAD` (16 commits: af55db8, e50bc6c, 4dc1c25, 44c59b9, 2e89115, d0d841f, dcf3240, 43bfe76, 76e7628, 462f7fd, 7c991ef, 46dc3d8, dc7f1ef, 6aae252, e244ae1, 250192f)
**Verifier**: independent sub-agent (author ≠ verifier) — fresh session, no implementation context inherited

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 | ✅ Done | Gestoras field in `mandato-wizard.tsx` (novo-contrato) |
| T2 | ✅ Done | "Vincular usuário" for Gestoras in `card-ponto-focal.tsx` |
| T3 | ✅ Done | `atualizarStatusContrato` in `src/backend/rpc/contrato.ts` — investigation confirmed no migration needed (write path/RLS/constraint pre-existed) |
| T4 | ⚠️ Done, with a code-quality regression | Status/Etapa edit on `informacoes/page.tsx`; introduces a new `react-hooks/set-state-in-effect` lint error (see Code Quality / Gate Check) |
| T5 | ✅ Done | No migration — pre-existing RLS/GRANT on `fat_submissao` already permits UPDATE (confirmed by reading migrations, not by trusting the commit message) |
| T6 | ✅ Done | Edit action for applied GIP moment in `gip-regua.tsx` |
| T7 | ✅ Done | No new RPC/migration — direct single-row `UPDATE fat_sucesso_mensal` via Supabase client, justified by AD-024 (RPC only for multi-row writes) |
| T8 | ✅ Done | Edit mode in `sucesso-mensal-form.tsx`, Situação now derived, never manual |
| T9 | ✅ Done | Migration `20260918193822_planejamento_prazo_relativo_ao_mes.sql` |
| T10 | ✅ Done | Month filter + "Mês/Ano" formatting in planejamento toolbar/grade |
| T11 | ✅ Cancelled (documented) | Investigation found `/vinculos` already serves this need (`ficha-mandato-contrato`, FMC-03) — correctly not implemented, matches spec.md's cancellation note. Not treated as a gap. |
| T12 | ✅ Done | `IipCard` removed from `ficha-contrato-chrome.tsx`, replaced with link + back button |
| T13 | ✅ Done | Fato Gerador form restacked per Figma frames 118-6/118-96 |
| T14 | ✅ Done | Projetado/realizado visual distinction + realizar action + "Registrar Registro" removed |
| T15 | ✅ Done, code claim confirmed | KPIs on Ciclo de Vida genuinely render today (pre-existing `IncidenciaKpis`, mounted at `fatos-registros/page.tsx:255`) — independently verified, not taken on faith |
| T16 | ✅ Done | Click-to-detail wired in `cadeia-lista.tsx` + page |

No task left partial/blocked without explanation.

---

## Spec-Anchored Acceptance Criteria

### PF-01: Editar GIP após submissão

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: edit action visible on applied moment | Edit action replaces read-only state | `gip-regua.tsx:89-91` ("Editar" button); `gip-regua.test.tsx:273` | ✅ PASS |
| AC2: saving does UPDATE, not 2nd INSERT, tipo/status unchanged | `UPDATE` on same row, `respostas` only | `gip-regua.tsx:113-123`; `gip-regua.test.tsx:287-303` asserts `updateMock` called once, `insertMock` NOT called | ✅ PASS |
| AC3: permission refusal same as create | Same error path as create/apply | `gip-regua.test.tsx:329-334`, `42501` rejection reuses shared `mapeiaErroRpc` catch | ✅ PASS |

Edge case (implicit, not in spec's Edge Cases list but relevant): `uq_gip_contrato_momento` still blocks a 2nd INSERT — `supabase/tests/operacao/gip-submissao-update.integration.test.ts` (run live against dev, see Gate Check) — PASS.

### PF-02: Editar Sucesso Mensal já lançado

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: edit mês/data-limite/peso | Editable fields, persisted | `sucesso-mensal-form.tsx:393` (`update` payload incl. `mes_referencia`, `dt_limite`, `peso`) | ✅ PASS |
| AC2: Situação recalculated from %, never manual | Derived, no manual Select | `derivaSituacao` at `sucesso-mensal-form.tsx:56-59`; manual Select removed; `sucesso-mensal-form.test.tsx:258-301` | ✅ PASS |
| AC3: reflects without manual reload | In-memory grid refresh, no `location.reload` | `onConcluido()` callback wiring, `sucesso-mensal-form.tsx:399` | ✅ PASS |

Edge case (spec.md line 272, "% doesn't change → Situação doesn't change"): tested at `sucesso-mensal-form.test.tsx:283-291` — ✅ PASS.

### PF-03: Prazo do Sucesso Mensal relativo ao mês

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: multi-month, day-of-prazo applied per month | Same day, each month of assignment | `20260918193822_planejamento_prazo_relativo_ao_mes.sql:52-69`; `prazo-relativo-ao-mes.integration.test.ts:91-110` asserts `["2026-07-10","2026-08-10","2026-09-10"]` for a 3-month lot with prazo "dia 10" | ✅ PASS |
| AC2: single month, no regression | Same behavior as before | `prazo-relativo-ao-mes.integration.test.ts:112-127` | ✅ PASS |

Both run live against dev Supabase in this session — see Gate Check.

### PF-04: Editar Status e Etapa do mandato na Ficha

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: edit fields for Status + Etapa shown | Both fields rendered | `informacoes/page.tsx:223` ("Status do contrato"), `:259` ("Etapa do produto"); `page.test.tsx` AC1 test | ✅ PASS |
| AC2: Etapa change reflects in Kanban (same data source) | Same RPC/column as Kanban, no duplicate field | `page.tsx:203` calls `moverEtapaKanban` (same RPC Kanban uses); `contrato.ts` comment confirms same `fat_contrato.id_etapa_atual` column | ✅ PASS |
| AC3: invalid transition rejected, same rule as Kanban | Same `TransicaoInvalidaError` surfaced | `page.test.tsx` AC3 test, mocks `moverEtapaKanbanMock` rejecting; **independently confirmed by discrimination sensor** (mutation 4 below) | ✅ PASS |
| `ck_contrato_motivo` (status=nao_concluido needs motivo) | Reject without motivo | `contrato.ts:23-25`; `contrato.test.ts:59-75` | ✅ PASS |

### PF-05: Vincular gestoras no cadastro de contrato

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: field to select gestoras in new-contract form | Field present, optional | `mandato-wizard.tsx` "Gestoras (opcional)" section; `mandato-wizard.test.tsx:313-319` | ✅ PASS |
| AC2: persists `rel_usuario_contrato` per gestora, same uniqueness rule | Insert row per gestora, `uq_vinculo` constraint | `mandato-wizard.tsx` insert loop; `mandato-wizard.test.tsx:333-345` | ✅ PASS |
| AC3: no gestora selected still saves | Optional, no blocking | `mandato-wizard.tsx` guard `gestorasSelecionadas.length > 0`; `mandato-wizard.test.tsx:322` | ✅ PASS |

### PF-06: Botão "vincular usuário" também para gestoras

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: button shown for gestora role | Button in Gestoras section | `card-ponto-focal.tsx`; `card-ponto-focal.test.tsx:207-220` | ✅ PASS |
| AC2: same flow/validation as other roles | Same table/constraint/error handling | `salvarGestora()` inserts into `rel_usuario_contrato`, same `uq_vinculo`; `card-ponto-focal.test.tsx` insert-payload + error tests | ✅ PASS |

### PF-07: Redesenho do formulário de Fato Gerador

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: layout matches Figma frames, no overlap | Visual match to node-id 118-6/118-96 | `fato-gerador-form.tsx:328-336, 389-405, 412-470` (fields stacked/regrouped per commit 6aae252) | ⚠️ Spec-precision gap — "no overlap in any supported resolution" is inherently visual; no automated assertion exists or could reasonably exist for pixel-overlap. Code change is real and traceable; only the "no overlap" claim itself is unverifiable by test. |
| AC2: all fields/validations preserved | No data/validation change | Zero test-file diff in commit 6aae252 — same 23 tests (`fato-gerador-form.test.tsx` + `fato-gerador-wizard.test.tsx`) pass unchanged | ✅ PASS |

### PF-08: Linha do Tempo e Ciclo de Vida — ajustes de UI e navegação

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: projetado visually differentiated, both views | Dashed border / "Projetado" tag in both | `cadeia-lista.tsx:93-94,106-108` (Ciclo de Vida), `timeline-feed.tsx:260-261` (Linha do Tempo) | ✅ PASS |
| AC2: action to mark realizado on card, both views | `RealizarFatoDialog` on card | `cadeia-lista.tsx:159,199`; `timeline-feed.tsx:283` | ✅ PASS |
| AC3: KPIs shown on Ciclo de Vida (today absent) | KPIs visible | **Author's claim independently re-verified, not trusted**: `IncidenciaKpis` (pre-existing component from `fatos-geradores-ciclo-vida`) is actively mounted at `fatos-registros/page.tsx:255`, inside the `cicloDeVida` JSX block, directly above `<CadeiaLista>` — genuinely rendered, not dead code. ✅ PASS, but flagged: no page-level test asserts KPI visibility specifically on the ciclo-de-vida tab (only component-level tests in `incidencia-kpis.test.tsx`) — thin coverage for this specific AC, not a gap in behavior. |
| AC4: click card opens detail (origem + fato) | Detail modal/dialog opens | `cadeia-lista.tsx:35,155,176-184` (`onAbrirDetalhe`); `cadeia-lista.test.tsx` (+48 lines) and `page.test.tsx` (+98 lines) in commit 250192f | ✅ PASS |
| AC5: "Registrar Registro" absent in both views | Button removed, stays in Agenda | Commit e244ae1, `fatos-registros/page.tsx` menu entry removed; `page.test.tsx` diff same commit | ✅ PASS |

### PF-09: Filtro por mês no planejamento estratégico

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: month filter shown | Filter control present | `planejamento-toolbar.tsx:85-92` (`<input type="month">`); `planejamento-toolbar.test.tsx:70-79` | ✅ PASS |
| AC2: Mês column as "Mês/Ano" (e.g. "Junho/26") | Exact format, not raw date | `planejamento-grade.tsx:132-136` (`formatarMesAno`); `planejamento-grade.test.tsx:236-238` asserts literal `"Junho/26"` | ✅ PASS |

### PF-10: Aviso "em construção" — CANCELLED

Not scored — cancelled per user decision (2026-09-18), original request already resolved by pre-existing `/vinculos` tab from `ficha-mandato-contrato` (FMC-03). No code was expected. Confirmed: `todasAbas` in `ficha-contrato-chrome.tsx` already routes "Gestão da equipe" to `${base}/vinculos`, a real functional page, not a placeholder.

### PF-11: Remover IIP provisório e padronizar botões

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: IipCard removed from all subtelas | Zero remaining mount points | `ficha-contrato-chrome.tsx` (commit dc7f1ef); repo-wide grep for `IipCard`/`iip-card` shows only 4 files: the chrome (comment only), `planejamento-header.tsx` (comment only), `incidencia-kpis.tsx` (real consumer, ties to PF-08 AC3 KPIs), and the definition itself — no orphaned/unremoved mount point | ✅ PASS |
| AC2: replaced with link to "Fatos Geradores e Registros", not inline forms | Single link/button | `ficha-contrato-chrome.tsx:133-135`; `ficha-contrato-chrome.test.tsx:169-175` | ✅ PASS |
| AC3: back button to `/produtos/[slug]/estrategia/dashboard` | Exact route per spec text | Implementation uses `/produtos/[slug]/dashboard` (`ficha-contrato-chrome.tsx:127`) — **spec.md's literal route does not exist in the App Router** (`app/(app)/produtos/[slug]/dashboard/page.tsx` exists; `.../[slug]/estrategia/` does not). Commit message documents this explicitly. | ⚠️ Spec-precision gap — spec.md text is stale, not the implementation; functionally correct and tested (`ficha-contrato-chrome.test.tsx:189`). Recorded as L-048. |
| Edge case: any un-mapped IIP consumer found by search | Search-driven, not route-list-driven | Same grep as AC1 — confirmed complete | ✅ PASS |

**Status**: ✅ All ACs covered for PF-01–PF-09, PF-11 — 3 spec-precision gaps flagged (PF-07 AC1 inherently visual; PF-08 AC3 thin test coverage on an otherwise-confirmed-true claim; PF-11 AC3 spec text drift), 0 uncovered/GAP criteria, 0 NOT FOUND.

---

## Discrimination Sensor

Run in the real working tree with git-tracked revert (`git checkout -- <file>` after each), never left applied — working tree confirmed clean before and after. Lightweight tier (4 mutations, standard feature).

| # | File:line | Description | Killed? |
| - | --------- | ------------ | ------- |
| 1 | `sucesso-mensal-form.tsx:57` | `pctAtingimento >= 100` → `> 100` (PF-02 AC2, Situação threshold) | ✅ Killed — 2 tests failed (`sucesso-mensal-form.test.tsx`) |
| 2 | `planejamento-grade.tsx:630` | `sm.mesReferencia === mes` → `!== mes` (PF-09 AC1, month filter) | ✅ Killed — 1 test failed (`planejamento-grade.test.tsx`) |
| 3 | `cadeia-lista.tsx:154` | `situacao === "projetado"` → `!== "projetado"` (PF-08 AC1, visual flag) | ✅ Killed — 3 tests failed (`cadeia-lista.test.tsx`) |
| 4 | `informacoes/page.tsx:206-207` | Removed `setErroEtapa(...)` from the invalid-transition catch block (PF-04 AC3) | ✅ Killed — 1 test failed (`informacoes/page.test.tsx`) |

**Sensor depth**: lightweight (4/4 mutations, above the 1–3 minimum)
**Result**: 4/4 killed — ✅ PASS (no weak/non-discriminating tests found in the sampled new behavior)

---

## Code Quality

| Principle | Status |
| --- | --- |
| No features beyond what was asked | ✅ |
| No abstractions for single-use code | ✅ |
| No unnecessary "flexibility" added | ✅ |
| Only touched files required for task | ✅ |
| Didn't "improve" unrelated code | ✅ |
| Matches existing patterns/style | ✅ (mostly — see gate note below) |
| Would senior engineer approve? | ⚠️ Yes, with one fix: T4 introduced a real `react-hooks/set-state-in-effect` violation |
| Tests map to ACs, non-shallow (spot-checked PF-02, PF-08) | ✅ |
| Spec-anchored outcome check | ✅ (see AC tables above — asserted values match spec-defined outcomes, e.g. exact `"Junho/26"`, exact 3-month date list) |
| Per-layer coverage: domain 1:1 AC mapping, routes happy+edge+error | ✅ |
| Every test maps to a spec AC/edge case/Done-when (no unclaimed tests) | ✅ |
| Documented guidelines followed | `.specs/features/pente-fino-2026-09/tasks.md` Test Coverage Matrix + Gate Check Commands — followed |

---

## Edge Cases (from spec.md)

- [x] Situação stays unchanged when % doesn't change — `sucesso-mensal-form.test.tsx:283-291`
- [x] Contract with no gestoras yet shows empty state without breaking form — covered by AC3 tests (PF-05)
- [x] Etapa changed via Kanban while Ficha open elsewhere reflects on next read — same-column read (`buscarContratoParaFicha`), no client cache layer introduced
- [x] IIP card removal covers any real consumer, not just cited routes — confirmed by repo-wide grep, not route-list assumption

---

## Gate Check

- **Gate command**: `npm run lint:all && npm run build`, split per instructions since lint fails on confirmed pre-existing debt; `npm run build` and `npm run test:unit` run regardless (real correctness gate)

**Build**: ✅ PASS (`npm run build` — exit 0, all routes compiled, no type errors)

**Lint** (`npm run lint:all`): ❌ FAILS — 19 errors (17× `react-hooks/set-state-in-effect`, 2× unrelated `no-explicit-any`/`prefer-const`), 18 warnings.
Independently classified against `git diff 84d37cc..HEAD --stat` (not taken from the authors' claim):
- **16 of 17** `set-state-in-effect` errors are in files/effects **not touched** by this feature, or in effects inside touched files that this feature never modified (e.g. `gip-regua.tsx:52` — the effect predates the feature, confirmed via `git merge-base --is-ancestor` showing its authoring commit is an ancestor of `84d37cc`). **Confirmed pre-existing debt, out of scope.**
- **1 of 17** (`src/frontend/app/(app)/contratos/[id]/informacoes/page.tsx:71`) is a **real, new gap introduced by T4/PF-04**: the feature rewrote this effect and added a new nested `.then()` chain (`buscarEtapasDoProduto(...).then((lista) => { if (!cancelado) setEtapas(lista); })`) that itself violates the rule — this exact code did not exist before this feature. **In scope, real code-quality regression.** Recorded as L-047.

**Unit tests** (`npm run test:unit`): ✅ 1379/1379 passed (1 file initially timed out at 5000ms under full-suite parallel load — `mandato-wizard.test.tsx`; re-run in isolation with default timeout: 19/19 passed in 12.6s, confirmed flaky/resource-contention, not a real failure).

**Integration tests** (`npm run test:integration`): confirmed dev project linked (`npnvoolkebhabjkjzqwn` = `sistema-mandatos-dev` per `docs/ambientes.md`) before running; read-only, no migration/push executed.
- Full suite: 622 passed, 25 failed (8 files) — **all 25 failures are in `regua-instanciacao.integration.test.ts`, `peso-etapa-seed.integration.test.ts`, `formularios-gip.integration.test.ts`**, none of which belong to this feature's diff surface (RGI-01..06, GG-02, vw_gip_evolucao are pre-existing suites from other features). Failure pattern (count mismatches, e.g. expected 6 got 8) is consistent with accumulated state on the shared, non-CASCADE dev database (per project memory), not a regression caused by this feature's commits.
- **T5/T9-specific** (the two tests this feature added): re-run in isolation — `gip-submissao-update.integration.test.ts` (2/2 passed) and `prazo-relativo-ao-mes.integration.test.ts` (2/2 passed). **4/4 passed.**
- T7 has no dedicated integration test file — correctly so, since the investigation (commit 76e7628) established no new RPC/migration was needed; per the Test Coverage Matrix, integration tests are only required for "RPC de banco / migration," which T7 did not end up producing.

- **Test count before feature**: not measured (no pre-feature baseline captured) — no evidence of deleted/weakened tests found; diff stat shows only added test files and net-positive test line counts across every touched test file.
- **Skipped tests**: 16 skipped in unit run — pre-existing, unrelated to this feature (not introduced by these commits).
- **Failures relevant to this feature**: none.

---

## Fix Plans

### Fix 1: `set-state-in-effect` violation introduced by T4 (PF-04)

- **Root cause**: `informacoes/page.tsx`'s `useEffect` (lines 69-80) chains a second async call (`buscarEtapasDoProduto`) inside the `.then()` of the first (`carregarContrato`), calling `setEtapas` synchronously inside that nested callback — inside an effect body, this is exactly the pattern `react-hooks/set-state-in-effect` flags.
- **Fix task**: Split into two effects — the first sets `contrato` from `carregarContrato()`; a second effect, keyed on the resolved `contrato`/`idProduto`, independently fetches and sets `etapas`. This removes the nested nested-nested nature of the nested `.then()` and lets each effect own one `setState`.
- **Priority**: Minor (lint-only, does not affect behavior — confirmed via discrimination sensor mutation 4 that AC3's actual behavior is correctly tested and passes) but should be fixed before merge since `lint:all` is a documented CI gate (`docs/fluxo-de-trabalho.md`).

### Fix 2 (optional, doc-only): spec.md PF-11 AC3 route text

- **Root cause**: spec.md was written before Design discovered `/produtos/[slug]/estrategia/dashboard` doesn't exist in the App Router; implementation correctly used the real route (`/produtos/[slug]/dashboard`) but the spec text was never corrected.
- **Fix task**: Update spec.md PF-11 AC3 wording to reference the real route, so future readers of spec.md don't need to re-discover this via the commit message.
- **Priority**: Cosmetic (documentation only, zero behavior impact).

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | ---------------- | ---------- |
| PF-01 | Design/Pending | ✅ Verified |
| PF-02 | Design/Pending | ✅ Verified |
| PF-03 | Design/Pending | ✅ Verified |
| PF-04 | Design/Pending | ✅ Verified (with a non-blocking lint fix task open — Fix 1) |
| PF-05 | Design/Pending | ✅ Verified |
| PF-06 | Design/Pending | ✅ Verified |
| PF-07 | Design/Pending | ✅ Verified (spec-precision gap noted, inherently visual AC) |
| PF-08 | Design/Pending | ✅ Verified |
| PF-09 | Design/Pending | ✅ Verified |
| PF-10 | Design/Pending | Cancelled (unchanged — not scored) |
| PF-11 | Design/Pending | ✅ Verified (spec-precision gap noted — Fix 2) |

---

## Summary

**Overall**: ⚠️ Issues (both non-blocking, neither is a functional/behavioral gap)

**Spec-anchored check**: 24/24 scoreable ACs matched spec-defined outcomes across PF-01–PF-09 and PF-11; 3 spec-precision gaps flagged (PF-07 AC1 inherently visual, PF-08 AC3 thin coverage on a confirmed-true claim, PF-11 AC3 stale spec route text)
**Sensor**: 4/4 mutations killed
**Gate**: build ✅, unit tests 1379/1379 ✅, integration tests for this feature's new suites 4/4 ✅ (full suite has 25 pre-existing failures unrelated to this feature's diff), lint ❌ 1 real new error (T4) + 18 confirmed pre-existing

**What works**: All 6 P1 edit/cadastro gaps (PF-01–PF-06) function end-to-end with real UPDATE/insert paths and passing tests, including two live integration tests against the dev database. Fato Gerador form redesign, Ciclo de Vida/Linha do Tempo UI adjustments (including the independently-reverified KPI claim), planning filter, and IIP-card removal are all implemented and tested as specified. T11 was correctly not implemented (genuine no-op, matches user's confirmed decision).

**Issues found**:
1. T4/PF-04 introduced one real `react-hooks/set-state-in-effect` lint error in `informacoes/page.tsx:71` (nested `.then()` inside a `useEffect`) — see Fix 1.
2. spec.md PF-11 AC3 cites a route (`/produtos/[slug]/estrategia/dashboard`) that doesn't exist; implementation correctly uses the real route (`/produtos/[slug]/dashboard`) — see Fix 2.

**Next steps**: Apply Fix 1 (split the two-step effect in `informacoes/page.tsx`) so `npm run lint:all` is clean before merge to `master`; optionally apply Fix 2 to keep spec.md accurate for future readers. Neither blocks functionality — all behavioral ACs pass, and the discrimination sensor confirms the tests genuinely catch regressions in the touched logic.

---

## Lessons Recorded

- **L-047** (`gate_fail`): nested `.then()` chains inside `useEffect` should be split into separate effects — source `informacoes/page.tsx:71`.
- **L-048** (`spec_precision_gap`): confirm a spec-cited App Router path exists before writing the AC — source `spec.md PF-11 AC3` vs `ficha-contrato-chrome.tsx:127`.

Both are `candidate` status (recurrence=1); no lesson recorded for PF-07 AC1 or PF-08 AC3 thin coverage — both are inherent-to-the-AC-type observations (visual criteria, confirmed-true-but-thinly-tested claim) rather than grounded execution failures, so no rule would generalize cleanly from them per the phrasing/scope-discipline rules in `lessons.md`.
