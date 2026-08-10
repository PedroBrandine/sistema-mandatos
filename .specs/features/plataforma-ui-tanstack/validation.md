# Plataforma de UI — TanStack + Estados Padrão Validation

**Date**: 2026-08-10
**Spec**: `.specs/features/plataforma-ui-tanstack/spec.md`
**Diff surface**: exactly 6 commits — `1374f26`, `d19c59f`, `f581d82`, `dd45087`, `266dfba`, `932c1fd`
(reviewed individually via `git show <hash>`, never as a range — this branch has two other features
committing interleaved on `develop`)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

No formal `tasks.md` — Execute ran as an inline 5-step list per `spec.md`'s own Coverage note. Mapped
to commits:

| Step | Commit | Status | Notes |
| --- | --- | --- | --- |
| Instalar `@tanstack/react-query` + `@tanstack/react-table` | `1374f26` | ✅ Done | - |
| Montar `QueryClientProvider` + `Toaster` no layout raiz | `d19c59f` | ✅ Done | - |
| `<CarregandoSkeleton>` | `f581d82` | ✅ Done | - |
| `<ErroInline>` | `dd45087` | ✅ Done | - |
| `<EstadoVazio>` | `266dfba` | ✅ Done | - |
| Atualizar rastreabilidade do spec | `932c1fd` | ✅ Done | Status In Design → Implementing, coverage note atualizada |

File surface matches the assigned scope exactly — no file outside the 6-commit union was touched
(confirmed via `git show --stat` on each commit individually).

---

## Spec-Anchored Acceptance Criteria

### P1: Plataforma de dados no cliente pronta para uso (PUI-01..04)

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| AC1 — app carrega qualquer rota → layout raiz envolve `{children}` num único `QueryClientProvider` via `getQueryClient()` (nova instância por request no servidor, singleton por aba no browser) | Um único provider, instanciado por factory SSR-safe | `src/frontend/app/layout.tsx:33-35` — `<body>` renders `<Providers>{children}</Providers>`; `src/frontend/components/providers.tsx:14-22` — `Providers` calls `getQueryClient()` once and wraps `{children}` in `<QueryClientProvider client={queryClient}>`; `src/frontend/lib/query-client.ts:22-31` — `getQueryClient()`: `if (isServer) return makeQueryClient()` (always new) else singleton `browserQueryClient` | ✅ PASS |
| AC2 — tela existente (`/mandatos`, `/coalizoes`, `/usuarios`, `/contratos`, `/mandatos/[id]`) carregada depois desta mudança → continua funcionando exatamente como antes, zero import de `@tanstack/react-query` nesses 5 arquivos | Zero linha mudada nesses 5 arquivos | Confirmed via `git show --stat` on all 6 commits — none of the 5 files appear; `grep "@tanstack" src/frontend/app/(app)/**` → 0 matches; `npm run build` generates all 15 routes (including the 5 in question) with no errors | ✅ PASS |
| AC3 — `npm run build` (workspace frontend) termina com sucesso, com as 2 deps em `package.json["dependencies"]` | Build verde + deps declaradas | `src/frontend/package.json` (commit `1374f26`) — `"@tanstack/react-query": "^5.101.4"`, `"@tanstack/react-table": "^9.1.2"` added to `dependencies`; `npm run build` executed by this Verifier — `✓ Compiled successfully`, 15/15 routes generated, exit 0; `package-lock.json` resolves `@tanstack/react-query@5.101.4`, `@tanstack/react-table@9.1.2` | ✅ PASS |
| AC4 — tela futura importa `useQuery`/`useMutation`/`useReactTable` → importação resolve e funciona sem essa tela montar provider próprio | Resolve em build + funciona via contexto herdado | Module resolution confirmed by the same green `npm run build` (TS strict + bundler resolve both packages). Provider coverage is structural: `QueryClientProvider` wraps `{children}` at the true app root (`layout.tsx:33-35` — only root `layout.tsx` in the tree; `(app)/layout.tsx:12-17` only adds a `<Sidebar>`, no second provider), so React Context guarantees every descendant route receives the client without re-mounting one | ✅ PASS — *methodology note*: verified via code/build evidence, not via an executed smoke-test route. Spec's own Independent Test frames that smoke test as "descartável, não faz parte da entrega"; building one would require adding a file to the real tree, out of scope for a read-only Verifier. React Context propagation to descendants is a deterministic framework guarantee, not app-specific logic, so structural evidence is sufficient here. |

**Status**: ✅ All 4 ACs covered.

### P1: Toast global de fato visível (PUI-05..07)

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| AC1 — layout raiz renderiza, em qualquer rota → sistema monta exatamente um `<Toaster/>` global | Exatamente 1 `Toaster` na árvore, cobrindo toda rota | `src/frontend/components/providers.tsx:17-21` — exactly one `<Toaster />` rendered, sibling to `{children}` inside `QueryClientProvider`; `layout.tsx:33-35` mounts `Providers` at the true root (covers `/login`, `/auth/*`, `/admin/acesso`, and everything under `(app)/`); grep of `src/frontend/app/**` for `Toaster`/`QueryClientProvider` → 0 matches outside `layout.tsx`'s import — confirms `(app)/layout.tsx` does not mount a second one | ✅ PASS |
| AC2 — qualquer uma das 5 chamadas `toast.success`/`toast.error` já existentes dispara → toast visível aparece, sem editar os 5 arquivos | Toast passa a aparecer visualmente | Wiring confirmed: `sonner`'s `toast()` writes to a module-level global store independent of the React tree location (not a React Context) — as soon as any `<Toaster/>` exists anywhere in the mounted tree, every `toast()` call renders through it; the 5 call sites are untouched (confirmed above) and `<Toaster/>` is now mounted (AC1). Mechanism verified by code; the literal visual outcome ("toast visível aparece" on screen) is a browser-observable fact | ⚠️ **Requer UAT manual humano** for the visual confirmation itself — this is the exact scenario the spec's own Independent Test names ("excluir um mandato de teste e confirmar visualmente que o toast aparece"). Code evidence strongly supports the wiring is correct; not marked PASS or FAIL, per instruction to treat browser-only confirmations as their own category. |
| AC3 — feature futura chama `toast(...)` de qualquer parte do app → renderiza pelo mesmo `<Toaster/>` único, nunca precisando montar outro | Toast futuro reusa o mesmo Toaster | Structural: since exactly one `<Toaster/>` exists in the entire tree (AC1) and `sonner`'s architecture is a single global store read by whichever `Toaster` instances are mounted, any future `toast()` call has nowhere else to render — no wrapper/hook is needed to "connect" to it | ✅ PASS |

**Status**: ⚠️ 2/3 ACs PASS via code evidence; 1/3 (AC2 — the actual bug this story fixes) needs a
human to open `/mandatos`, delete a test record, and confirm the toast is visible. This is Category 3
of `validate.md` (interactive UAT), not a code gap.

### P1: 3 componentes de estado padronizados (PUI-08..12)

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| AC1 — tela precisa de placeholder de carregamento → pode renderizar `<CarregandoSkeleton variante="cards"\|"table"\|"list" />` | 3 variantes disponíveis, "cards" default | `src/frontend/components/ui/carregando-skeleton.tsx:3-6` — `variante?: "cards" \| "table" \| "list"`; `:14-17` default `variante = "cards"`; `:18-36` implements `"table"` and `"list"` branches; `:38-48` implements the `"cards"` grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, matching the pattern generalized from `mandatos/page.tsx`) | ✅ PASS |
| AC2 — query/fetch falha → pode renderizar `<ErroInline mensagem={string} onRetry={() => void}/>`, mensagem persistente + botão opcional de retry | `mensagem` obrigatória, `onRetry` opcional, sem auto-hide | `src/frontend/components/ui/erro-inline.tsx:6-10` — `mensagem: string` required, `onRetry?: () => void` optional; `:22-42` renders `<Alert variant="destructive">` with `<AlertDescription><p>{mensagem}</p>{onRetry ? <Button onClick={onRetry}>...</Button> : null}</AlertDescription></Alert>` — plain React render, no timer/auto-dismiss logic (unlike `sonner` toasts) | ✅ PASS |
| AC3 — lista/query retorna vazia → pode renderizar `<EstadoVazio titulo={string} mensagem={string?} acao={ReactNode?}/>`, CTA opcional | `titulo` obrigatório, `mensagem`/`acao` opcionais | `src/frontend/components/ui/estado-vazio.tsx:1-5` — `titulo: string`, `mensagem?: string`, `acao?: React.ReactNode`; `:12-22` renders título always, `mensagem` conditionally, `{acao}` at the end | ✅ PASS |
| AC4 — qualquer um dos 3 componentes importado → puramente apresentacional, nenhum lê banco/RPC/RLS | Zero dependência de dado | Grepped all 3 files for `supabase|createClient|rpc(|@backend` → 0 matches in all three; only imports are `Skeleton`/`Alert`/`Button`/`lucide-react`/`cn` — all presentational | ✅ PASS |
| AC5 — os 3 componentes existem em `src/frontend/components/ui/`, tipados, kebab-case | Local + convenção de nome | `src/frontend/components/ui/carregando-skeleton.tsx`, `erro-inline.tsx`, `estado-vazio.tsx` — all in `components/ui/`, all kebab-case, all export a typed `*Props` interface (`CarregandoSkeletonProps`, `ErroInlineProps`, `EstadoVazioProps`) | ✅ PASS |

**Status**: ✅ All 5 ACs covered.

**Overall spec-anchored check**: 11/12 ACs PASS via code evidence, 1/12 (PUI-06) requires human UAT
for its literal visual claim — not a code gap, a category-3 verification step per `validate.md`
§7. 0 spec-precision gaps (every AC in this feature has a precise, checkable outcome). 0 evidence-or-zero
failures (every AC has a `file:line` citation).

---

## Discrimination Sensor

No automated test suite exists for frontend components in this project (pre-existing, documented in
`design.md`'s Risks section and in prior features' handoffs — not a gap introduced by this feature).
Per task instructions, the sensor was run against the only deterministic gate that exists:
`npm run build` (workspace frontend) + scoped `eslint`. All 3 mutations were injected directly into
the real tracked files (git-stash-equivalent: edit → run gate → `git checkout --` to restore),
verified via `git diff --stat` to leave zero trace afterward — the real tree was never left mutated.

| # | File:line | Mutation | Build | Lint | Killed? |
| --- | --- | --- | --- | --- | --- |
| 1 | `src/frontend/components/providers.tsx:20` | Removed `<Toaster />` from `Providers` (toast bug reintroduced) | ✅ exit 0, 15/15 routes | Exit 0 overall; scoped `eslint components/providers.tsx` → 1 **warning** (`'Toaster' is defined but never used`), not an error | ❌ **Survived** — build/lint both exit 0; the leftover unused import produced a warning, but warnings don't fail `lint:all`'s exit code |
| 2 | `src/frontend/lib/query-client.ts:23` | Inverted `if (isServer)` → `if (!isServer)` (SSR cache would now leak across requests) | ✅ exit 0, 15/15 routes | ✅ exit 0, 0 warnings, 0 errors | ❌ **Survived** — pure logic inversion, still type-correct, no runtime test exists to observe cross-request cache leakage |
| 3 | `src/frontend/components/ui/erro-inline.tsx:28-39` | Removed the `onRetry ? (...) : null` guard — retry button now always renders even with `onRetry` undefined (violates the spec's own Edge Case: "sem botão vazio ou quebrado") | ✅ exit 0, 15/15 routes | ✅ exit 0, 0 warnings, 0 errors | ❌ **Survived** — `onClick={undefined}` is valid TypeScript; no test observes the rendered DOM |

**Sensor depth**: lightweight (default tier — 3 targeted mutations, no P0/critical-path code here).
**Result**: 0/3 killed by the automated gate — **expected and not a failure of this feature**. This is
exactly what `design.md`'s own Risks section already documents: "Verificação depende de build/lint +
inspeção visual manual, não de suíte automatizada." TypeScript strict + ESLint validate *types* and
*static patterns*, not rendered behavior — none of these 3 mutations produce a type error or a
lint-blocking error, only mutation 1 produced an incidental (non-blocking) lint warning as a side
effect of the resulting unused import, not because the missing `<Toaster/>` itself was detected.

---

## Code Quality

| Principle | Status | Note |
| --- | --- | --- |
| No features beyond what was asked | ✅ | `CarregandoSkeleton`'s `"table"`/`"list"` variants have no consumer yet, but this is a pre-approved design decision recorded in `spec.md`'s Assumptions table, not scope creep introduced silently |
| No abstractions for single-use code | ✅ | `providers.tsx`/`query-client.ts` are minimal, no speculative generality |
| No unnecessary "flexibility" added | ✅ | - |
| Only touched files required for task | ✅ | Confirmed file-by-file against the assigned scope; nothing extra |
| Didn't "improve" unrelated code | ✅ | The 5 existing Fundação screens are untouched (confirmed via `git show --stat` on all 6 commits) |
| Matches existing patterns/style | ✅ | kebab-case in `components/ui/`, same precedent as `confirm-delete-dialog.tsx`; `Skeleton` installed via shadcn CLI, matching every other primitive in the project |
| Would senior engineer approve? | ✅ | Yes — small, well-scoped, correctly justified against AD-021/AD-027 |
| Tests map to acceptance criteria (non-shallow) | N/A | No test suite exists project-wide for frontend (pre-existing, documented debt) |
| Spec-anchored outcome check | ✅ | See AC table above — every AC's asserted evidence targets the exact spec wording |
| Per-layer Coverage Expectation | N/A | No domain logic / no routes in this feature — pure presentational + provider wiring |
| Every test maps to a requirement | N/A | No tests exist to map |
| Documented guidelines followed | ✅ | `components.json` (shadcn CLI convention) followed for `Skeleton`; no other written frontend testing/quality guideline exists beyond `design.md`'s own Risks section, which this Verifier followed |

One minor, non-blocking implementation-vs-design drift: `design.md`'s Component spec for
`<EstadoVazio>` lists `cn` as a dependency, but `src/frontend/components/ui/estado-vazio.tsx` uses a
plain template string and never imports `cn` (no dynamic className composition is actually needed
since the component exposes no `className` prop). Not a spec violation — `spec.md` never requires
`cn` usage — and does not affect any AC.

---

## Edge Cases

| Edge Case (spec.md) | Evidence | Status |
| --- | --- | --- |
| `getQueryClient()` no SSR sempre cria instância nova, nunca reaproveita entre requests | `src/frontend/lib/query-client.ts:22-25` — `if (isServer) return makeQueryClient();` never touches `browserQueryClient` | ✅ Handled |
| Dois toasts quase simultâneos → empilhamento nativo do `sonner`, zero dedup customizada | `src/frontend/components/ui/sonner.tsx:10-28` — thin wrapper, only overrides `theme`/`className`/CSS vars; no custom stacking/dedup logic added | ✅ Handled |
| `<ErroInline>` sem `onRetry` → só mensagem, sem botão vazio/quebrado | `src/frontend/components/ui/erro-inline.tsx:28-39` — `{onRetry ? (<Button/>) : null}` omits the button entirely | ✅ Handled (this exact edge case is what sensor mutation 3 above targeted and confirmed would silently break if regressed) |
| `<EstadoVazio>` sem `acao` → sem espaço reservado vazio | `src/frontend/components/ui/estado-vazio.tsx:19` — `{acao}` renders nothing when `undefined`, no wrapper markup reserved | ✅ Handled |
| Tela existente sem nenhum dos 3 componentes novos é aceitável | Grep of `src/frontend/app/(app)/**` for `CarregandoSkeleton\|ErroInline\|EstadoVazio` → 0 matches — no forced retroactive adoption | ✅ Handled |

**Status**: ✅ All 5 edge cases handled correctly.

---

## Gate Check

- **Gate commands**: `npm run build` (root, delegates to `frontend` workspace); `npm run lint:all`
  (root `eslint .` + `frontend` `eslint`)
- **Build result**: ✅ `Compiled successfully in 11.8s`, TypeScript finished clean, 15/15 routes
  generated (`/`, `/admin/acesso`, `/admin/acesso/entrar`, `/auth/confirm`, `/auth/error`,
  `/coalizoes`, `/coalizoes/[id]`, `/coalizoes/novo`, `/contratos`, `/contratos/[id]/vinculos`,
  `/login`, `/mandatos`, `/mandatos/[id]`, `/mandatos/[id]/contratos/novo`, `/mandatos/novo`,
  `/usuarios`) — exit 0
- **Lint result**: ❌ `lint:all` exits 1 — **but every failing line is pre-existing debt outside this
  feature's scope**: `35 problems (15 errors, 20 warnings)`, all in
  `app/(app)/{coalizoes,contratos,mandatos,usuarios}/page.tsx`,
  `app/(app)/mandatos/[id]/{page.tsx,contratos/novo/page.tsx}`,
  `app/(app)/contratos/[id]/vinculos/page.tsx`, `app/(app)/page.tsx`,
  `components/fundacao/{contratante-fields,contrato-form,mandato-card,mandato-wizard,tse-match-search}.tsx`
  — confirmed by grepping the full lint output for every filename touched by this feature's 6 commits
  (`providers.tsx`, `sonner.tsx`, `query-client.ts`, `carregando-skeleton.tsx`, `skeleton.tsx`,
  `erro-inline.tsx`, `estado-vazio.tsx`, `app/layout.tsx`) → **0 matches**.
- **Scoped lint (this feature's files only)**: `npx eslint components/providers.tsx
  components/ui/sonner.tsx lib/query-client.ts components/ui/carregando-skeleton.tsx
  components/ui/skeleton.tsx components/ui/erro-inline.tsx components/ui/estado-vazio.tsx
  app/layout.tsx` → **0 errors, 0 warnings, exit 0**.
- **Test count before/after**: N/A — no test suite covers frontend in this project.
- **Failures**: none attributable to this feature.

---

## Interactive UAT — Not Performed (no browser available to this Verifier)

Per task instructions, ACs/Independent Tests that require visual/browser confirmation are their own
category — not PASS, not FAIL. Flagged explicitly for a human to run:

| # | Test | Why it needs a human |
| --- | --- | --- |
| 1 | Open `/mandatos`, delete a test record, confirm the success toast is visible | This is the actual bug (PUI-06) this feature fixes — literal visual confirmation, spec's own Independent Test example |
| 2 | Force an RLS-blocked delete, confirm the error toast is visible | Same story, error path |
| 3 | Open `/mandatos`, `/coalizoes`, `/usuarios`, `/contratos` and confirm they list/filter/delete exactly as before | Story 1's Independent Test — regression-by-eye check |
| 4 | Render the 3 new state components with sample data and visually confirm all 3 states (loading, error+retry, empty+CTA) look correct | Story 3's Independent Test — visual smoke test, explicitly described as disposable, not part of the delivery |

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status | Note |
| --- | --- | --- | --- |
| PUI-01 | Implementing | ✅ Verified | Single provider, SSR-safe factory — code evidence complete |
| PUI-02 | Implementing | ✅ Verified | Zero edits to the 5 existing screens, confirmed across all 6 commits |
| PUI-03 | Implementing | ✅ Verified | Build green, deps declared and resolved |
| PUI-04 | Implementing | ✅ Verified | Structural/Context evidence; no live smoke-test route built (out of scope for read-only Verifier) |
| PUI-05 | Implementing | ✅ Verified | Exactly one `<Toaster/>`, mounted at true root |
| PUI-06 | Implementing | ⚠️ **Verified (código) — confirmação visual pendente de UAT manual** | Wiring is correct by code evidence; the literal "toast visível aparece" claim needs a human to click delete in `/mandatos` |
| PUI-07 | Implementing | ✅ Verified | Single global Toaster architecture, no future wrapper needed |
| PUI-08 | Implementing | ✅ Verified | 3 variantes implemented, typed |
| PUI-09 | Implementing | ✅ Verified | Persistent message + optional retry, edge case covered |
| PUI-10 | Implementing | ✅ Verified | Optional `mensagem`/`acao`, edge case covered |
| PUI-11 | Implementing | ✅ Verified | Zero DB/RPC/RLS dependency confirmed via grep |
| PUI-12 | Implementing | ✅ Verified | Correct location, naming, typing |

---

## Summary

**Overall**: ✅ Ready (with 1 flagged item for human UAT, not a code gap)

**Spec-anchored check**: 11/12 ACs PASS via code evidence; 1/12 (PUI-06) code-verified but its
literal visual claim requires human UAT — 0 spec-precision gaps, 0 evidence-or-zero failures
**Sensor**: 0/3 mutations killed by the build/lint gate — expected for a presentational feature with
no test infrastructure; consistent with `design.md`'s own documented risk
**Gate**: build ✅ green (15/15 routes); `lint:all` ❌ fails on 15 pre-existing errors, all outside
this feature's file surface (confirmed by scoped lint on this feature's exact files → 0 errors, 0
warnings)

**What works**: `QueryClientProvider` + `Toaster` mounted once at the true root, covering every route;
zero changes to the 5 existing Fundação screens; both TanStack packages installed, declared, and
resolving in build; all 3 state components (`CarregandoSkeleton`, `ErroInline`, `EstadoVazio`) exist,
typed, kebab-case, in `components/ui/`, purely presentational, and correctly handle both documented
edge cases (missing `onRetry`, missing `acao`); the production toast bug this feature exists to fix is
wired correctly end-to-end by code inspection.

**Issues found**: None that are code-level gaps. One flagged item: PUI-06's literal "toast visível
aparece" claim needs a human to open `/mandatos` and confirm visually — recommend as the next
interactive UAT step before closing out this feature completely.

**Next steps**: Route PUI-06 to an interactive UAT session (delete a test mandato in `/mandatos`,
confirm toast appears; force an RLS-blocked delete, confirm error toast appears). No fix tasks are
warranted — this is a verification-method gap (no browser available to this Verifier), not an
implementation gap.
