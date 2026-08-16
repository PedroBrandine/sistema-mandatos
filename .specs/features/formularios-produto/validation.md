# Formulários dos Produtos Validation

**Date**: 2026-08-15
**Spec**: `.specs/features/formularios-produto/spec.md`
**Diff range**: `337baa9` (T1) .. `97ab0a5` (T21) — 22 commits on `develop`, filtered from
`git log --oneline --grep="formularios-produto"` (branch had 3-4 other trilhas committing
interleaved in the same window; only commits matching the feature's own file scope were audited).
One commit (`61ea838`, T9 final) also carries 2 files from `visao-gerencial-g3-g6`
(`20260814211638_visao_gerencial_vw_carteira_ponderada_mensal.sql` +
`vw-carteira-ponderada-mensal.integration.test.ts`) picked up by a concurrent `git add` race,
documented in `STATE.md`; excluded from this audit's scope.
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Notes |
| --- | --- | --- |
| T1–T15 | ✅ Done | `337baa9`..`c082dcd`, confirmed by commit content (not just message) |
| T16–T21 | ✅ Done | `e2d09f0`..`97ab0a5` — **`tasks.md`'s own status header is stale**, still reads "Lote C (T16-T21) não iniciado"; `git log`/working tree confirm all 6 frontend files exist and are committed. Cosmetic doc gap, flagged below (Fix 5). |

All 21 tasks verified complete by direct inspection of the resulting files/migrations, not by trusting commit messages or `tasks.md`'s progress annotations.

---

## Spec-Anchored Acceptance Criteria

### P1: Abrir/fechar e responder um formulário genérico

| # | Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| - | --- | --- | --- | --- |
| AC1 (FRM-01) | Gestora/Admin aciona "abrir" | `estado='aberto'`, `dt_abertura=now()`, `id_usuario_abriu=app.id_usuario()` | UI: `src/frontend/components/produtos/formularios-lista.tsx:60-73` (mutation payload). **No `file:line` test exercises the write as an authenticated Gestora/Mentor client** — évidence-or-zero. | ❌ **GAP** (test coverage) — see Fix 1 |
| AC2 (FRM-02) | Gestora/Admin aciona "fechar" | `estado='fechado'`, `dt_fechamento=now()` | Same file/lines as AC1. No dedicated test. | ❌ **GAP** — see Fix 1 |
| AC3 (FRM-03) | Mentor/Assessor tenta abrir/fechar | Negado via RLS (nenhum GRANT UPDATE fora Gestora/Admin) | No `file:line` test asserts a Mentor/Assessor client is denied UPDATE on `rel_formulario_contrato`. Empirically re-verified read-only via `has_table_privilege` against the linked dev project (not a repo test, not evidence for this report's evidence-or-zero rule): `legisla_mentor`/`legisla_assessor` → `can_update=false`; `legisla_gestora`/`legisla_admin`/`legisla_app` → `can_update=true`. Current behavior is correct but **unguarded by any regression test**. | ❌ **GAP** (test coverage, behavior currently correct) — see Fix 1 |
| AC4 (FRM-04) | Respondente acessa formulário aberto com métrica ativa | Renderiza 1 campo por métrica ativa via RHF+Zod | `src/frontend/components/produtos/formulario-generico-form.tsx:220-227,309-354` — code-reviewed, matches design.md. Frontend = `none` per Test Coverage Matrix (accepted mitigation, L-006/L-007), covered by `build`+`lint` (both green, see Gate Check). | ✅ PASS (accepted mitigation) |
| AC5 (FRM-05) | Nenhuma métrica ativa | Aviso de bloqueio, sem botão de envio | `formulario-generico-form.tsx:147-155` (`EstadoVazio`, early return before form renders). | ✅ PASS (accepted mitigation) |
| AC6 (FRM-06) | 1º envio | INSERT em `fat_submissao` com os campos exigidos | `supabase/tests/operacao/formularios-submissao.integration.test.ts:212-233` — `expect(data?.id_submissao).toBeGreaterThan(0)`. `versao_formulario`/`enviada_em` sourced correctly per code review (`formulario-generico-form.tsx:270`), not independently asserted (accepted mitigation, low risk — DDL default). | ✅ PASS |
| AC7 (FRM-07) | `exige_anexo=true` | Aceite obrigatório antes de habilitar envio, grava `aceite_em` | `formulario-generico-form.tsx:223-226` (Zod `.refine`), `:259,273` (`aceite_em: agora`). Accepted mitigation (frontend). | ✅ PASS (accepted mitigation) |
| AC8 (FRM-08) | Submissão gravada | Trigger repovoa `fat_resposta_metrica`, mesmo sem GRANT direto do papel que grava | `formularios-submissao.integration.test.ts:235-275` — `expect(Number(metricaRows[0].valor_num)).toBe(9)`, then after UPDATE `expect(Number(metricaAposReenvio[0].valor_num)).toBe(3)`, run as the **Assessor** client (no direct GRANT on `fat_resposta_metrica`, confirmed by the negative GRANT test at `:184-210`). Exact value match. | ✅ PASS |
| AC9 (FRM-09) | Formulário fechado | Respondente não acessa a página de resposta | DB: `formularios-submissao.integration.test.ts:318-334` — `expect(error?.code).toBe("42501")`, `count=0`. UI: `formulario-generico-form.tsx:157-161` (message, no submit path). Accepted mitigation for UI half. | ✅ PASS |
| AC10 (FRM-10) | `permite_edicao_aberta=true`, reenvio | UPDATE na mesma linha, nunca 2ª linha | Constraint evidence: `supabase/tests/operacao/formularios-gip.integration.test.ts:183-224` (`uq_submissao_respondente` triggers `23505` on a duplicate insert attempt; UPDATE path succeeds without creating a 2nd row) — same unique index used by all formulários, not GIP-specific. UI: `formulario-generico-form.tsx:251-264` (`update` by `id_submissao`, never `upsert`). | ✅ PASS |
| AC11 (FRM-11) | `permite_edicao_aberta=false`, já respondido | Somente leitura p/ respondente comum; Gestora/Admin têm ação de reabrir | DB (Gestora/Admin path): `formularios-submissao.integration.test.ts:295-316` — exact match, Gestora UPDATEs another user's row, `id_usuario_respondente` preserved. **DB (respondente-comum denial path): NO ENFORCEMENT EXISTS.** The `WITH CHECK` clause added in T4 (`supabase/migrations/20260814032705_formularios_produto_trigger_metricas.sql:27-47`) checks contract/form-open state and authorship, but never references `permite_edicao_aberta` — confirmed by `grep -rn permite_edicao_aberta supabase/migrations/ docs/schema_sistema.sql` returning only the column's `CREATE TABLE` declaration, no RLS/trigger use anywhere in the repo. A respondent whose form has `permite_edicao_aberta=false` can still call `.from("fat_submissao").update(...)` directly via the Supabase client and have it succeed — the "somente leitura" restriction is enforced **only by the UI's disabled submit button** (`formulario-generico-form.tsx:218`, `somenteLeitura` flag). This contradicts AD-002 ("autorização é sempre decidida pela RLS, nunca pela UI") and `context.md:95-101`'s explicit decision that "o respondente comum não pode editar." | ❌ **GAP (Major)** — see Fix 2 |
| AC12 (FRM-12) | Autoria falsificada | RLS `WITH CHECK` nega | `formulario-submissao.integration.test.ts:277-293` — `expect(error?.code).toBe("42501")`, `count=0`. Exact match. | ✅ PASS |
| AC13 (FRM-13) | `fat_contrato.status<>'ativo'` | Impede abrir formulário novo **e** nova submissão | Submissão half: `formularios-submissao.integration.test.ts:336-352` — exact match (`42501`, `count=0`). **"Abrir formulário novo" half: unimplemented.** `rel_formulario_contrato`'s RLS (`supabase/migrations/20260812001234_regua_instanciacao_rls.sql:23-29`, pre-existing, untouched by this feature) has no contract-status clause, and `formularios-lista.tsx`'s `alternarEstado` mutation (`:59-76`) never checks `fat_contrato.status` before allowing the "Abrir" toggle. Gestora/Admin can currently open a formulário on an encerrado contract. | ⚠️ **PARTIAL (Minor)** — see Fix 3 |
| AC14 (FRM-14) | Aba Formulários | Lista filtrada por papel | `src/backend/queries/formulario.test.ts:115-182` — 4 tests, exact branch coverage (Gestora sees all 4, Mentor sees only its 1 addressed+open form, Assessor sees direct+mapped `mentorado`, fechado+never-answered hidden). | ✅ PASS |

### P2: GIP

| # | Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| - | --- | --- | --- | --- |
| AC1 (FRM-15) | GIP 1ª vez, momento=inicio | `fat_gip` + 4 `fat_gip_dimensao` linhas, `eixo='regua_sonhos'` | `supabase/tests/operacao/formularios-gip.integration.test.ts:128-154` — `expect(dims).toHaveLength(4)`, `expect(d.eixo).toBe("regua_sonhos")`, `expect(d.valor).toBe(2)`. Exact. | ✅ PASS |
| AC2 (FRM-16) | momento meio/fim | `fat_gip_dimensao` com `eixo='onde_chegamos'` | `:156-181` — tested for **`meio`** only (`porEixo.get("onde_chegamos")).toEqual([3,3,3,3])`). `fim` is only exercised by the out-of-range rejection test (`:226-242`), which never reaches the success path. Same code path handles both (`v_eixo := CASE WHEN momento='inicio' THEN ... ELSE 'onde_chegamos' END`, `supabase/migrations/20260814211302_formularios_produto_gip_propaga_regua_sonhos.sql:51`), so risk is low — flagged as a spec-precision note, not a functional gap. | ✅ PASS (minor precision note) |
| AC3 (FRM-17) | Reaplicar mesmo momento | `uq_gip_contrato_momento` impede 2ª linha | `:183-224` — `expect(erroDuplicado?.code).toBe("23505")` on raw duplicate insert; `expect(Number(depois)).toBe(Number(antes))` after the real reenvio-via-UPDATE path. Exact. | ✅ PASS |
| AC4 (FRM-18) | Valor fora da faixa | Rejeitado por `app.trg_valida_gip_dimensao` | `:226-242` — value `9` against real `valor_min`/`valor_max` looked up from `ref_dimensao_gip`, `expect(error).not.toBeNull()`, `count=0`. | ✅ PASS |
| AC5 (FRM-19) | 2 eixos existem | `vw_gip_evolucao` expõe os 2 + `gap` | `:244-264` — `expect(r.gap).toBe(-1)`, `expect(r.situacao).toBe("proximo")`. Exact numeric match. | ✅ PASS |

### P3: NPS

| # | Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| - | --- | --- | --- | --- |
| AC1 (FRM-20) | ≥1 resposta NPS, refresh | Agrega promotores/neutros/detratores/score | `supabase/tests/operacao/formularios-nps.integration.test.ts:174-192` — `nr_respostas=3`, `promotores=2`, `neutros=0`, `detratores=1`, `nps≈33.33`. Exact, matches hand-computed fixture (2 promoters + 1 detractor). | ✅ PASS |
| AC2 (FRM-21) | Gestora/Admin aciona refresh | `REFRESH MATERIALIZED VIEW CONCURRENTLY` via RPC | `:169-172` (integration, Gestora, no error) + `src/backend/rpc/formulario.test.ts:31-37` (unit, calls `atualiza_avaliacao_nps` with no params). UI: `nps-avaliacoes-card.tsx:46-53,63-71` (button → mutation → refetch), accepted mitigation. | ✅ PASS |
| AC3 (FRM-23) | Mentor/Assessor lê `mv_avaliacao_nps` (direto ou refresh) | Negado — nem GRANT nem RLS autorizam a leitura | `:194-210` — both roles: RPC call succeeds (`error).toBeNull()`), direct `SELECT` fails (`error?.code).toBe("42501")`). Exact, both roles independently tested. | ✅ PASS |

### Cross-cutting

| Requirement | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| FRM-22 (Auditoria) | `fat_submissao`/`fat_gip` entram na auditoria padrão (`log_auditoria`, `trg_auditoria`, AD-006) | **No migration in this feature attaches `trg_auditoria` to any of the 4 new tables.** `grep -rln trg_auditoria supabase/migrations/` lists 6 prior features' dedicated audit-trigger migrations (`convite-contrato`, `kanban-etapas`, `planejamento-planilha-monitoramento`, `incidencia-encontros`) but none for `formularios-produto`. Empirically re-confirmed read-only against the linked dev project (`information_schema.triggers` for `fat_submissao`/`fat_resposta_metrica`/`fat_gip`/`fat_gip_dimensao`): only `trg_submissao_metricas`, `trg_submissao_gip`, `trg_gip_dimensao_faixa` exist — **zero audit triggers**. Every write this feature makes (opening/closing forms is exempt — that table isn't in scope — but every `fat_submissao`/`fat_gip` insert/update) is invisible to `log_auditoria`. | ❌ **GAP (Major)** — see Fix 4 |

**Status**: ❌ Gaps present (5 GAP + 1 PARTIAL out of 23 FRM requirements; 1 minor spec-precision note on an otherwise-passing AC)

---

## Discrimination Sensor

DB-level mutation (a 5th planned mutation on `app.trg_valida_gip_dimensao()`, applied via `supabase db query --linked`) was **blocked by the auto-mode sandbox classifier** as a live write to the shared dev database — correctly, since the Verifier must never mutate real state, and this environment has no local Postgres/Docker to sandbox a DB-level mutation against. All 4 mutations below were instead applied to local TypeScript source (git-tracked, reverted via `git checkout --` immediately after each run, `git status`/`git diff --stat` confirmed clean before and after each one — no DB-level mutation was attempted or left in place).

| # | File:line | Description | Killed? |
| - | --- | --- | --- |
| 1 | `src/backend/queries/formulario.ts:144` | Flipped `||` → `&&` in the Mentor/Assessor visibility filter (`item.estado==='aberto' \|\| item.jaRespondeu`) | ✅ Killed — 2/11 tests in `formulario.test.ts` failed (`Mentor: vê só...`, `Assessor: vê 'assessor'...`) |
| 2 | `src/backend/rpc/formulario.ts:15` | Replaced `throw mapeiaErroRpc(error)` with a silent `return` on RPC error | ✅ Killed — 2/3 tests in `rpc/formulario.test.ts` failed (both error-path tests expected a rejection) |
| 3 | `src/backend/queries/formulario.ts` (`buscarAvaliacaoNps`) | Changed `if (error) throw error;` to `if (error) return [];` (swallows the 42501 into an empty list) | ✅ Killed — the dedicated FRM-23 test ("propaga o erro de permissão... em vez de devolver lista vazia") failed, resolved `[]` instead of rejecting |
| 4 | `src/backend/queries/formulario.ts:190` (`buscarSubmissaoPropria`) | Swapped the `momento ? eq : is` branches (momento omitted now queries `eq('momento', undefined)`, momento present now queries `IS NULL`) | ✅ Killed — both tests in the `buscarSubmissaoPropria` describe block failed |

**Sensor depth**: lightweight (4 targeted mutations; a 5th DB-level mutation was attempted and blocked by the sandbox, see above)
**Result**: 4/4 killed — ✅ PASS (tests that exist are discriminating; this does not offset the coverage gaps above, which are about tests that don't exist at all)

---

## Interactive UAT

Not performed. This environment has no browser/screenshot tool (stated constraint). T16–T21 (all 6 frontend deliverables) were verified by direct code reading against `design.md`/`spec.md`, plus `npm run build && npm run lint:all` (both green, 0 problems in files touched by this feature). This is the Test Coverage Matrix's own documented mitigation for the frontend layer (L-006/L-007, no component-test harness in the project) — not a gap introduced by this validation round, but the UI-only enforcement found in AC11 above was only discoverable by reading the RLS policy text next to the UI code, which a browser-only UAT pass would not have surfaced either.

---

## Code Quality

| Principle | Status | Note |
| --- | --- | --- |
| Minimum code | ✅ | No speculative abstractions found; GIP kept as a bespoke screen (per explicit decision), no generic form-engine built |
| Surgical changes | ✅ | Each migration touches only its own concern; `T4`'s `ALTER POLICY` and `T9`'s 2 fix migrations are honestly labeled `SPEC_DEVIATION`/"achado real" rather than silently folded in |
| No scope creep | ✅ | `FormulariosLista`'s dropped `idProduto` prop (documented `SPEC_DEVIATION`) is a legitimate dead-parameter removal, not scope creep |
| Matches patterns | ✅ | RLS/GRANT/trigger patterns consistently reuse `p_por_contrato`/`p_heranca`/`SECURITY DEFINER` precedents (AD-035); RHF+Zod matches `sucesso-mensal-form.tsx` precedent |
| Spec-anchored outcome check (asserted values match spec) | ⚠️ | True for every AC that HAS a test (see table above); 5 ACs have none |
| Per-layer Coverage Expectation met (domain 1:1 ACs; routes happy+edge+error) | ❌ | RLS+GRANT layer's own Test Coverage Matrix line ("1 teste por papel × operação relevante") is unmet for `rel_formulario_contrato` open/close (AC1-3) |
| Every test maps to a spec requirement — no unclaimed tests | ✅ | All 19 integration + 14 new unit tests carry an explicit spec/FRM anchor in a header comment |
| Documented guidelines followed | `tasks.md` Test Coverage Matrix + `coding-principles.md` — followed for code style; **matrix's RLS+GRANT coverage promise not fully delivered** (see AC1-3) |

---

## Edge Cases (spec.md)

- [x] Input validation & bounds — Zod client-side (escala_0_10/escala_1_5) + DB trigger for GIP dimensions (tested, AC4/P2)
- [x] Failure/partial-failure — atomic single insert/update by design, no partial-state possible; RHF preserves in-progress input by default on mutation error (not independently tested, low risk)
- [x] Idempotency/retry — `uq_submissao_respondente` evidenced via `23505` test
- [x] Auth boundaries — RLS by contract + own authorship (AC3/AC12), **with the AC11 gap above being the one place this boundary is UI-only, not RLS**
- [x] Concurrency — "formulário fechado" mechanism tested (AC9); exact "Gestora closes mid-fill" race not literally simulated, same underlying guard
- [x] Data lifecycle — N/A, correctly so (no TTL requirement)
- [ ] **Observability — log_auditoria — NOT satisfied.** Spec explicitly claims this Edge Case is covered ("fat_submissao/fat_gip/fat_gip_dimensao entram na auditoria padrão... mesmo trigger genérico já usado nas demais tabelas fato do projeto, AD-006") — confirmed false, see FRM-22 above.
- [x] External-dependency failure — N/A, correctly so
- [x] State-transition integrity — `estado` CHECK pre-existing; GIP momento order intentionally unconstrained (documented assumption)

---

## Gate Check

- **Gate command**: `npm run test:unit` (Quick) + `npx vitest run --config vitest.integration.config.ts` scoped to the 3 feature files (Full, faster than the whole suite per the orchestrator's guidance) + `npm run build && npm run lint:all` (Build)
- **Unit result**: 460/460 passed, 41 files, 0 failed
- **Integration result (feature-scoped)**: 19/19 passed — `formularios-submissao.integration.test.ts` (8), `formularios-gip.integration.test.ts` (5), `formularios-nps.integration.test.ts` (6)
- **This feature's test contribution**: +14 unit tests (`queries/formulario.test.ts`: 11, `rpc/formulario.test.ts`: 3) + 19 integration tests = 33 new tests, all green
- **Build**: clean, 0 errors, all 31 routes generated including the 2 new formulários routes
- **Lint**: 30 problems (15 errors, 15 warnings) — **0 in any file touched by this feature** (`grep -i formulario` on the full lint output returns nothing); pre-existing baseline in `mandatos/`, `usuarios/`, `fundacao/`, `incidencia/` files, matches the documented ~30-problem baseline from other features, confirmed unrelated
- **Skipped tests**: none observed
- **Failures**: none

---

## Fix Plans

### Fix 1: FRM-01/02/03 have no automated RLS/GRANT regression test

- **Root cause**: `design.md` correctly identified that `rel_formulario_contrato`'s existing RLS+GRANT (from `regua-instanciacao`) already satisfies these ACs without a new migration, and reasonably concluded no *migration* task was needed — but this got conflated with "no *test* is needed either." `regua-rls.integration.test.ts` (the sibling feature's own test file) only exercises `SELECT` visibility (`RGI-07`) on this table, never `UPDATE`.
- **Fix task**: Add an integration test (new file or appended to `formularios-submissao.integration.test.ts`) that: (a) Gestora/Admin `UPDATE rel_formulario_contrato SET estado='aberto', dt_abertura=now(), id_usuario_abriu=...` succeeds; (b) Mentor/Assessor attempting the same `UPDATE` gets `42501`.
- **Priority**: Minor (behavior independently confirmed correct via read-only `has_table_privilege` check against the linked dev project; this is test-debt, not a functional break)

### Fix 2: FRM-11's "somente leitura" restriction is UI-only, not RLS-enforced

- **Root cause**: T4's `ALTER POLICY` (`20260814032705_formularios_produto_trigger_metricas.sql:27-47`) added checks for `estado='aberto'` and `fat_contrato.status='ativo'`, but never added a check on `ref_formulario.permite_edicao_aberta`. The column is read by the UI (`formulario-generico-form.tsx`'s `somenteLeitura` flag) but never referenced by any RLS policy or trigger in the entire repo.
- **Fix task**: Extend the `WITH CHECK` clause on `fat_submissao`'s `p_por_contrato` policy (new forward-only migration) to require, for non-admin/gestora updaters, that either `ref_formulario.permite_edicao_aberta=true` OR the row didn't previously have a non-null `enviada_em`/this is the first write — mirroring the existing `estado='aberto'`/contract-active pattern already in that same policy.
- **Priority**: Major — violates AD-002 ("autorização é sempre decidida pela RLS, nunca pela UI") and the explicit decision recorded in `context.md:95-101`; any respondent who bypasses the UI (browser devtools, direct API call with their own valid session) can silently alter a "closed" single-submission answer (e.g., a signed Termo de Compromisso) after the fact.

### Fix 3: FRM-13's "impedir abrir formulário novo" half is unimplemented

- **Root cause**: Only the `fat_submissao` side of AC13 was fixed in T4's `SPEC_DEVIATION` note; the `rel_formulario_contrato` RLS (pre-existing, from `regua-instanciacao`) was never revisited to add a contract-status check, and `FormulariosLista`'s toggle mutation doesn't check `fat_contrato.status` either.
- **Fix task**: Add a `fat_contrato.status='ativo'` check (bypassable by admin/gestora per the existing pattern, or genuinely blocking even for them per spec.md's literal text — needs a 1-line confirmation with Pedro since it's ambiguous whether Gestora herself should be blocked) to `rel_formulario_contrato`'s RLS `WITH CHECK`, plus a corresponding integration test.
- **Priority**: Minor — the higher-consequence half (blocking actual submissions) is implemented and tested; this is an edge operator action (opening a form on an already-closed contract) with low real-world likelihood.

### Fix 4: FRM-22 — no audit trail for any write in this feature

- **Root cause**: Every other feature that introduced `fat_*` tables in this project (`convite-contrato`, `kanban-etapas`, `planejamento-planilha-monitoramento`, `incidencia-encontros`) shipped a dedicated migration attaching `app.trg_auditoria()`. `formularios-produto` never did, despite `spec.md`'s Edge Cases section explicitly claiming this is covered and `FRM-22` being a named, numbered requirement.
- **Fix task**: New forward-only migration attaching `app.trg_auditoria()` (`AFTER INSERT OR UPDATE`) to `fat_submissao` and `fat_gip` (the 2 tables spec.md names — `fat_resposta_metrica`/`fat_gip_dimensao` are pure derived/trigger-written tables, consistent with how other derived tables in the project are excluded from direct audit), plus a test confirming `log_auditoria` gains a row on submission.
- **Priority**: Major — named requirement (FRM-22), zero implementation, confirmed empirically (0 audit triggers on any of the 4 new tables in the linked dev project).

### Fix 5: `tasks.md` status header is stale

- **Root cause**: Never updated after Lote C (T16-T21) was completed — still reads "Lote A (T1-T9) e Lote B (T10-T15) concluídos... Lote C (T16-T21) não iniciado."
- **Fix task**: Update the `tasks.md` header line to reflect all 21 tasks done.
- **Priority**: Cosmetic

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| FRM-01 | Pending | ❌ Needs Fix (test coverage) |
| FRM-02 | Pending | ❌ Needs Fix (test coverage) |
| FRM-03 | Pending | ❌ Needs Fix (test coverage) |
| FRM-04 | Pending | ✅ Verified |
| FRM-05 | Pending | ✅ Verified |
| FRM-06 | Pending | ✅ Verified |
| FRM-07 | Pending | ✅ Verified |
| FRM-08 | Pending | ✅ Verified |
| FRM-09 | Pending | ✅ Verified |
| FRM-10 | Pending | ✅ Verified |
| FRM-11 | Pending | ❌ Needs Fix (Major — RLS enforcement gap) |
| FRM-12 | Pending | ✅ Verified |
| FRM-13 | Pending | ⚠️ Partial (Minor) |
| FRM-14 | Pending | ✅ Verified |
| FRM-15 | Pending | ✅ Verified |
| FRM-16 | Pending | ✅ Verified |
| FRM-17 | Pending | ✅ Verified |
| FRM-18 | Pending | ✅ Verified |
| FRM-19 | Pending | ✅ Verified |
| FRM-20 | Pending | ✅ Verified |
| FRM-21 | Pending | ✅ Verified |
| FRM-22 | Pending | ❌ Needs Fix (Major — unimplemented) |
| FRM-23 | Pending | ✅ Verified |

(`spec.md`'s own Requirement Traceability table was left untouched, per this Verifier's read-only mandate over the real implementation — the orchestrator/next implementer should apply this table there.)

---

## Summary

**Overall**: ❌ Not Ready

**Spec-anchored check**: 17/23 FRM requirements matched their spec-defined outcome with real, precise evidence; 5 gaps (FRM-01, FRM-02, FRM-03, FRM-11, FRM-22), 1 partial (FRM-13), 1 minor spec-precision note (FRM-16, low risk — shared code path)

**Sensor**: 4/4 mutations killed (a 5th, DB-level, was blocked by the environment's own write-sandbox — not a sensor failure)

**Gate**: 460 unit + 19 integration (feature-scoped) passed, 0 failed; build clean; lint clean in this feature's files (30 pre-existing problems elsewhere, confirmed unrelated)

**What works**: The entire P1 core mechanism (submit/reenvio/extraction trigger/RLS authorship guard/closed-form blocking), 100% of P2 (GIP derivation, faixa validation, evolução view with correct gap math), and 100% of P3 (NPS aggregation, refresh RPC, role-gated MV read) are implemented correctly and covered by precise, spec-anchored tests. The discrimination sensor confirms the tests that do exist are load-bearing, not decorative.

**Issues found**:
1. FRM-22 (Major): zero audit trail for any write this feature makes — no `trg_auditoria` on any of the 4 new tables, despite it being a named requirement and an explicit spec.md claim.
2. FRM-11 (Major): the "somente leitura para respondente comum" restriction on closed single-submission forms is enforced only by a disabled UI button, never by RLS — violates AD-002 and is bypassable by any authenticated respondent via direct API call.
3. FRM-13 (Minor): "impedir abrir formulário novo" on an encerrado contract is unimplemented (only the submission half is blocked).
4. FRM-01/02/03 (Minor): the open/close RLS+GRANT behavior — core to this feature's P1 MVP story — has no automated regression test anywhere in the repo, though independently confirmed correct via a read-only permission check.
5. `tasks.md` header stale (Cosmetic).

**Next steps**: Fix 2 and Fix 4 (both Major) should be addressed before calling this feature done — they are real, unenforced gaps against named requirements, not spec-precision ambiguity. Fix 1 and Fix 3 are lower priority (test-debt / low-likelihood edge). Fix 5 is a 1-line doc update.
