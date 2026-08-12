# LESSONS — auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation — do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 — When testing a date-based age/period calculation with a branch for 'has not yet reached' vs 'already reached', include a test case for each branch, not just one.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `backend/queries` · harmful: 0
- features: primeira-tela-cadastro
- evidence: src/backend/queries/tse.ts:155 (calculaIdade) -- mutant #1 in validation.md (backend/queries)
- last seen: 2026-07-31T16:36:17Z

### L-002 — When a spec asks to derive a value from a date field without naming a reference date, pick and document an explicit reference date in the implementation rather than defaulting to wall-clock now().
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `spec-authoring` · harmful: 0
- features: primeira-tela-cadastro
- evidence: spec.md CAD-10 (P1 perfil TSE AC2, age from dt_nascimento) -- validation.md (spec-authoring)
- last seen: 2026-07-31T16:36:25Z

### L-003 — When a constraint-to-message lookup table maps multiple distinct constraints to distinct user-facing messages, add one assertion per constraint, not just one representative case for the whole table.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `backend/rpc/errors` · harmful: 0
- features: cadastro-mandato-contrato-unificado
- evidence: src/backend/rpc/errors.ts:70 (dim_mandato_nr_titulo_eleitoral_key message) (backend/rpc/errors)
- last seen: 2026-08-10T19:40:57Z

### L-004 — When an RPC wrapper adds a new pass-through parameter, assert that exact parameter's presence and value in the success-path test, not just the pre-existing parameters.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `backend/rpc` · harmful: 0
- features: cadastro-mandato-contrato-unificado
- evidence: src/backend/rpc/mandato.ts (p_id_contratante_existente passthrough) (backend/rpc)
- last seen: 2026-08-10T19:41:01Z

### L-005 — When a spec explicitly requires reusing an existing shared schema, verify the implementation imports that schema rather than redeclaring an equivalent shape inline, since equivalent-looking duplicates drift silently when the shared schema changes.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `frontend/forms` · harmful: 0
- features: cadastro-mandato-contrato-unificado
- evidence: spec.md CMU-05 AC1/AC2 vs mandato-wizard.tsx:56-60,30-51 (frontend/forms)
- last seen: 2026-08-10T19:41:05Z

### L-006 — This project has no UI-component test harness (no jsdom/testing-library configured); acceptance criteria satisfied purely by React component code have zero automated-test evidence and must be reported as a standing test-infrastructure gap, not silently treated as equivalent to a passing test.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `frontend/testing-infra` · harmful: 0
- features: cadastro-mandato-contrato-unificado
- evidence: vitest.config.ts:6 (include: src/backend/**/*.test.ts only) -- 11+ UI-behavior ACs in this feature have zero automated-test evidence, only code-reading (frontend/testing-infra)
- last seen: 2026-08-10T19:41:46Z

### L-007 — TypeScript strict and ESLint do not observe rendered JSX output or runtime branch outcomes -- removing a rendered element, inverting a server/client branch condition, or dropping a conditional-prop render guard all pass build/lint clean; treat frontend render/branch logic as unverified by the gate until a component-level test harness exists.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `frontend/testing-infra` · harmful: 0
- features: plataforma-ui-tanstack
- evidence: src/frontend/components/providers.tsx:20, src/frontend/lib/query-client.ts:23, src/frontend/components/ui/erro-inline.tsx:28-39 (validation.md discrimination sensor, 3 mutants) (frontend/testing-infra)
- last seen: 2026-08-10T22:27:46Z

### L-008 — When a design's Error Handling Strategy names a specific shared error-display component (e.g. ErroInline) as the propagation endpoint for a reused form, verify the reused component's actual JSX renders through it -- a form can map errors correctly and still surface them via an ad-hoc element instead of the named standard component.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `frontend-error-display` · harmful: 0
- features: navegacao-por-produto
- evidence: spec.md Edge Cases (RLS nega escrita) / design.md Error Handling Strategy row 5 / src/frontend/components/fundacao/contrato-form.tsx:239 (frontend-error-display)
- last seen: 2026-08-11T13:52:02Z

### L-009 — When adding a route that must work without a session, add it to the auth middleware's public-route allowlist in the same task, since being outside the authenticated route group does not exempt a path from middleware that matches by pathname.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `frontend/routing` · harmful: 0
- features: convite-contrato
- evidence: validation.md Fix 1 -- src/backend/supabase/proxy.ts:43-50 (isPublicRoute) vs app/convite/[token]/page.tsx (frontend/routing)
- last seen: 2026-08-12T01:34:40Z

### L-010 — When a function maps distinct error codes to distinct user-facing messages, add one assertion per code, not just one representative case for the whole switch.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `backend/rpc` · harmful: 0
- features: convite-contrato
- evidence: validation.md mutant #8 -- src/backend/rpc/consumir-convite.ts:35-47 (mensagemDeErroConsumo) (backend/rpc)
- last seen: 2026-08-12T01:34:49Z

### L-011 — When a function checks several mutually-non-exclusive conditions in a fixed order, add a fixture where two conditions hold at once so the precedence is pinned, not just one fixture per condition.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `backend/queries` · harmful: 0
- features: convite-contrato
- evidence: validation.md mutant #5 -- src/backend/queries/convite.ts:28-29 (validarConvite) (backend/queries)
- last seen: 2026-08-12T01:34:49Z

### L-012 — When a spec lists several rejection states that can hold simultaneously on the same record, state which one wins so the implementation and its test have a defined outcome.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `spec-authoring` · harmful: 0
- features: convite-contrato
- evidence: validation.md Edge Cases -- spec.md US3 AC2/AC3 (expirado vs usado quando ambos valem) (spec-authoring)
- last seen: 2026-08-12T01:35:01Z

### L-013 — When a requirement is satisfied by attaching an existing generic trigger, assert the resulting row in the target table from a test, since reusing a proven mechanism is not evidence that it was wired to this table.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `supabase/migrations` · harmful: 0
- features: convite-contrato
- evidence: validation.md CVT-11 -- supabase/migrations/20260812001921_convite_contrato_estrutura.sql:95-97 (trg_audit_convite_contrato) (supabase/migrations)
- last seen: 2026-08-12T01:35:02Z

### L-014 — In this Next.js App Router project a page.tsx and a route.ts cannot share a path segment, so plan a POST handler for a rendered page as a child segment from the start.
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `frontend/routing` · harmful: 0
- features: convite-contrato
- evidence: tasks.md SPEC_DEVIATION (T15) -- app/convite/[token]/consumir/route.ts (frontend/routing)
- last seen: 2026-08-12T01:35:02Z

### L-015 — When a fix's only evidence is a manual HTTP/CLI check because no test harness covers that layer, add a test that freezes the value the fix set, since a fix nothing asserts can be reverted as silently as the bug it replaced.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `frontend/routing` · harmful: 0
- features: convite-contrato
- evidence: validation.md rodada 2 mutante #9 -- src/backend/supabase/proxy.ts:43-60 (isPublicRoute) (frontend/routing)
- last seen: 2026-08-12T02:24:26Z

## Quarantined (failed when applied — ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
