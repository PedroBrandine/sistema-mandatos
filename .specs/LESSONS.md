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

## Quarantined (failed when applied — ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
