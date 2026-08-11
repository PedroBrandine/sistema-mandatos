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

## Quarantined (failed when applied — ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
