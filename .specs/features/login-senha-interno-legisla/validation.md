# Login com senha (Interno Legisla) Validation

**Date**: 2026-07-31
**Spec**: `.specs/features/login-senha-interno-legisla/spec.md`
**Diff range**: `86426df..defbef7` (commits `0633abd` login-form.tsx, `defbef7` provisionar-senhas.ts + package.json)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

No `tasks.md` for this feature (scope Medium — Design/Tasks inline per spec.md and `STATE.md` Handoff). The Handoff's "Next step" bullet enumerates two implementation units; both are present in the diff:

| Unit | Status | Notes |
| ---- | ------ | ----- |
| `login-form.tsx`: `signInWithOtp` → `signInWithPassword`, password field, magic-link UI removed | ✅ Done | commit `0633abd` |
| `scripts/provisionar-senhas.ts`: batch create/reset via `admin.createUser`/`admin.updateUserById`, domain gate, summary | ✅ Done | commit `defbef7` |

---

## Spec-Anchored Acceptance Criteria

| Requirement | Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- | --- |
| AUTHPWD-01 | Correct email+password on `/login` → authenticate + redirect to existing post-login destination | Same session mechanism as magic link (httpOnly cookie), unchanged redirect target | `src/frontend/components/login-form.tsx:40-50` — `signInWithPassword({email,password})`, on success `router.push("/")` + `router.refresh()` | ✅ PASS — live-verified: `POST /auth/v1/token?grant_type=password` with correct password → HTTP 200, valid `access_token`/session for `teste-verificacao@legislabrasil.org` |
| AUTHPWD-02 | Wrong email or password → generic error, no email-existence leak | Generic message, stay on login screen | `src/frontend/components/login-form.tsx:45-48` — `setStatus({type:"error", message: error.message})`, rendered verbatim at line 75 (no redirect on error path) | ✅ PASS — live-verified: wrong password for existing test user → HTTP 400 `{"error_code":"invalid_credentials","msg":"Invalid login credentials"}`; nonexistent email → **identical** HTTP 400 body — confirms the message does not distinguish "wrong password" from "no such account" |
| AUTHPWD-03 | `/login` loads → only email+password form, magic-link UI removed | Magic-link form absent while AD-026 active | `src/frontend/components/login-form.tsx` (whole file, no `signInWithOtp`/"sent" branch remains); `src/frontend/app/login/page.tsx:8` renders only `<LoginForm />` | ✅ PASS — grep for `signInWithOtp`/"magic link"/"Link de acesso" across `src/` returns zero hits in `login-form.tsx` or `login/page.tsx` (remaining hits are the unrelated, out-of-scope `/admin/acesso` dev bypass and a `next.config.ts` comment) |
| AUTHPWD-04 | Admin runs command with password + email list → for each not-yet-existing `@legislabrasil.org` email, create user with email confirmed, no email sent | New `auth.users` row, `email_confirm: true`, no email dispatched | `scripts/provisionar-senhas.ts:57-66` — `admin.auth.admin.createUser({email, password, email_confirm: true})` | ✅ PASS — live-verified: ran script against fresh `teste-verificacao@legislabrasil.org`; resulting `auth.users` row has `email_confirmed_at`/`confirmed_at` set at creation instant (no confirmation-email flow triggered — `admin.createUser` never sends mail regardless of flag) |
| AUTHPWD-05 | Email already exists → reset password to the same value, no duplicate/`dim_usuario` change | Same `auth.users` id, same password applied, `dim_usuario` row untouched | `scripts/provisionar-senhas.ts:68-94` — on `createError.code === "email_exists"`, finds user via `encontrarUsuarioPorEmail`, calls `admin.auth.admin.updateUserById(existente.id, {password})` | ✅ PASS — live-verified: re-ran script against the same test email with a new password; summary reported "Redefinidos", `auth.users.id` unchanged (`03f882f7-...`), `dim_usuario.id_usuario`/`atualizado_em` unchanged; new password → HTTP 200 login; old password → HTTP 400 `invalid_credentials` |
| AUTHPWD-06 | Off-domain email in the list → reject just that one, don't abort the batch | Skip + warn, continue processing rest of list | `scripts/provisionar-senhas.ts:51-55` — `if (!email.endsWith("@legislabrasil.org")) { console.error(...); recusados.push(email); continue; }` inside the `for` loop | ✅ PASS — live-verified: ran script with `teste-verificacao@legislabrasil.org` + `teste-verificacao@outrodominio.com` in one call → summary showed 1 criado, 1 recusado, valid email still processed |
| AUTHPWD-07 | Command finishes → print summary (created/reset/rejected) + password in clear text, terminal only | No file write, no external service call | `scripts/provisionar-senhas.ts:97-101` — `console.log` of `criados`/`redefinidos`/`recusados` arrays and the raw `password`; no `fs`/network-logging import anywhere in the file | ✅ PASS — live-verified terminal output matches this shape exactly across all three script runs; file has zero filesystem-write calls (only `dotenv.config` reads `.env.local`) |

**Status**: ✅ All 7 ACs covered, all matched to a precise spec-defined outcome (no spec-precision gaps).

---

## Edge Cases

- [x] **No emails / no args** → usage instructions printed, no API call made. `scripts/provisionar-senhas.ts:15-20` guard runs and calls `process.exit(1)` *before* `createAdminClient()` (line 29) is ever reached. Live-verified with both `provisionar-senhas -- somenteASenha` (password, no emails) and no args at all — both printed usage and exited 1, no error indicating any network call was attempted.
- [x] **`dim_usuario.papel_global` preserved on password reset** → confirmed by absence: `provisionar-senhas.ts` contains zero references to `dim_usuario` (grep confirms no `.from("dim_usuario")` call in the file) — the tool structurally cannot write to that table. Belt-and-suspenders: even the `admin.createUser` path is protected by migration `0018_provisiona_usuario_dominio_legisla.sql:31-33`'s `INSERT ... ON CONFLICT (email) DO NOTHING`, and `updateUserById` never issues an `INSERT` into `auth.users` so the trigger doesn't re-fire on reset. Live-verified: `dim_usuario` row's `atualizado_em` and `papel_global` were bit-for-bit unchanged after the password-reset run.
- [x] **`proxy.ts` / auth gate unchanged, no new exception needed** → confirmed by absence: `git diff --stat 86426df..HEAD -- src/backend/supabase/proxy.ts` is empty; the file is untouched by either commit in this feature's range.
- [x] **Manual password rotation, no automation/expiry** → confirmed by absence: the script has no scheduling, TTL, or expiry logic; rotation is exactly "re-run the command with a new password," which is what was exercised live (second run above).

---

## Discrimination Reasoning (substitutes mutation sensor — no automated test suite exists for this feature by design)

No test files exist for `login-form.tsx` or `provisionar-senhas.ts`, per spec.md's own Independent Test sections (manual/E2E verification only). A git-stash mutation-and-run-tests sensor is not applicable since there are no tests to run. Instead, per the task instructions, read-based discrimination reasoning was applied to the 3 highest-risk behaviors, and cross-checked against the live E2E runs above (which independently exercise the same code paths):

1. **Domain-gate order and abort semantics** (`scripts/provisionar-senhas.ts:51-55`). A plausible wrong implementation would check the domain *after* calling `admin.createUser` (so a rejected email could still create a real `auth.users` row before being flagged), or would `throw`/`process.exit` on the first bad email instead of `continue`-ing (aborting the rest of a valid batch — violating AC3/AUTHPWD-06's "sem abortar o processamento dos demais"). The actual code performs the `.endsWith("@legislabrasil.org")` check and `continue`s *before* any call to `admin.auth.admin.createUser`, inside a `for...of` loop with no early return on rejection. Live-verified: a batch of one valid + one off-domain email produced exactly 1 created + 1 rejected, both accounted for in the summary — the invalid email never reached the Auth API and the valid one wasn't blocked by it.
2. **`email_exists` branch distinguishing create vs. update** (`scripts/provisionar-senhas.ts:63-94`). A plausible wrong implementation would either (a) not branch on the error code at all and misreport a reset as a "creation" in the summary, or (b) match on a fragile substring of `error.message` instead of the structured `error.code`, which would silently break if Supabase's wording changed. The actual code branches on `createError.code !== "email_exists"` (structured code, not string-matched message) and only proceeds to `updateUserById` in the `email_exists` case, pushing to `redefinidos` (not `criados`). Live-verified twice: first run against a new email reported "Criados", second run against the same email reported "Redefinidos" with zero entries in "Criados" — the branch correctly discriminated create vs. reset in practice, not just in theory.
3. **Login form surfaces the raw Supabase error unmodified** (`src/frontend/components/login-form.tsx:45-48,75`). A plausible wrong implementation would wrap/translate the message (e.g., prefix "Erro: ", or map to a custom string), which the spec's Assumptions table explicitly rules out ("Repassa `error.message` da Supabase... sem tradução"). The actual code does `setStatus({type:"error", message: error.message})` with no transformation, rendered as `{status.message}` with no wrapping. Live-verified at the REST layer (same error shape the JS client surfaces as `error.message`): wrong password and nonexistent email both returned the byte-identical `"Invalid login credentials"` string — confirming the passthrough carries a message that is already generic at the source, so no additional scrubbing is needed or performed.

**Sensor depth**: read-based reasoning (3 behaviors) + live E2E cross-check, substituting for mutation testing — no test suite exists for this feature by design (spec.md Independent Test sections specify manual/E2E verification only).
**Result**: 3/3 reasoned-through, none found to have the plausible flaw — all confirmed correct by both code reading and live re-execution.

---

## Live E2E Verification Performed (fresh, not reusing author's prior test users)

Using a new test address (`teste-verificacao@legislabrasil.org`, not previously used by the author's session) against the real dev Supabase project (`.env.local` credentials):

1. Ran `npm run provisionar-senhas -- <senha> teste-verificacao@legislabrasil.org teste-verificacao@outrodominio.com` → 1 created, 1 rejected (off-domain), summary + plaintext password printed to terminal only.
2. Verified via `service_role` that `auth.users` row was created with `email_confirmed_at` set and `dim_usuario` auto-provisioned via migration 0018's trigger with `papel_global='gestora'`.
3. `POST /auth/v1/token?grant_type=password` with the provisioned password → HTTP 200, valid session token.
4. Same endpoint with a wrong password → HTTP 400 `{"error_code":"invalid_credentials","msg":"Invalid login credentials"}`.
5. Same endpoint with a nonexistent `@legislabrasil.org` email → **identical** HTTP 400 body (confirms no existence leak).
6. Re-ran the provisioning script against the same email with a new password → reported "Redefinidos" (not "Criados"); `auth.users.id` and `dim_usuario.id_usuario`/`atualizado_em` unchanged (no duplication, no dim_usuario write).
7. New password → HTTP 200; old (pre-reset) password → HTTP 400 (confirms actual reset, not merely additive).
8. Ran the script with password-only (no emails) and with zero args → both printed usage and exited 1 without reaching `createAdminClient()`.
9. **Cleanup**: deleted the test user from `dim_usuario` (`id_usuario 337`) and `auth.users` (`id 03f882f7-c194-4e3f-81e3-4f3925b1af89`) via `service_role`; confirmed zero rows remain in `dim_usuario` for that email. No other data touched. Throwaway verification script (`scripts/_scratch-verify-check.ts`) removed; `git status` is clean.

---

## Code Quality

| Principle        | Status |
| ---------------- | ------ |
| Minimum code     | ✅ — thin CLI + form change, no framework/abstraction introduced beyond what's needed |
| Surgical changes | ✅ — only the 2 files + `package.json` script entry named in the Handoff's "Next step" were touched |
| No scope creep   | ✅ — magic-link dev bypass tools (`gerar-link-acesso.ts`, `/admin/acesso`) correctly left untouched, matching spec's explicit Out of Scope row |
| Matches patterns | ✅ — reuses `createAdminClient()` from `src/backend/supabase/admin.ts` rather than duplicating a service_role client, matching `scripts/gerar-link-acesso.ts`'s established pattern |
| Spec-anchored outcome check (asserted values match spec) | ✅ — all 7 ACs traced to exact behavior, live-confirmed |
| Per-layer Coverage Expectation met | N/A — no automated test suite for this feature by design; live E2E substitutes (see above) |
| Every behavior maps to a spec requirement — no unclaimed code | ✅ — no code beyond the 7 ACs + 4 edge cases found (e.g., no extra validation, no extra UI states beyond idle/error) |
| Documented guidelines followed | none — no project-specific testing guideline file found for this feature type; strong defaults applied (manual E2E per spec's own Independent Test sections) |

---

## Gate Check

- **Gate command**: no dedicated `tasks.md` Gate Check Commands section exists (Design/Tasks inline, scope Medium); used `npm run lint` and `npm run build` as the closest equivalent, per the Handoff's "Next step" instruction to run lint.
- **`npm run lint`**: 4 pre-existing errors, all **outside** this feature's diff surface and unrelated to it (`DADOS TSE/carga_amostral.js:48` unused var; `src/backend/rpc/{coalizao,mandato,vinculo}.test.ts:13` unused `_nome`) — none introduced by commits `0633abd`/`defbef7`. `login-form.tsx` and `provisionar-senhas.ts` produced 0 errors (one benign "file ignored" warning from an unrelated ignore pattern, not a lint failure).
- **`npm run build`**: ✅ compiled and type-checked cleanly, including `/login` route.
- **Test count before feature**: N/A — no automated tests for this feature by design.
- **Test count after feature**: N/A — no automated tests for this feature by design.
- **Skipped tests**: N/A.
- **Failures**: none introduced by this feature.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | ---------------- | ----------- |
| AUTHPWD-01 | Pending | ✅ Verified |
| AUTHPWD-02 | Pending | ✅ Verified |
| AUTHPWD-03 | Pending | ✅ Verified |
| AUTHPWD-04 | Pending | ✅ Verified |
| AUTHPWD-05 | Pending | ✅ Verified |
| AUTHPWD-06 | Pending | ✅ Verified |
| AUTHPWD-07 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 7/7 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 3/3 read-based discrimination checks confirmed correct (no test suite exists for this feature by design; live E2E cross-check performed instead)
**Gate**: lint clean on touched files (4 pre-existing, out-of-scope repo errors noted but not blocking), build passing

**What works**: Password login (success + generic-error path), magic-link UI removal, batch provisioning (create/reset/domain-gate/summary) — all independently re-verified against the real dev Supabase project with a fresh test account, not reused author state.

**Issues found**: none.

**Next steps**: none required for this feature. Two pre-existing, out-of-scope items surfaced incidentally during the gate check (unrelated lint errors in `DADOS TSE/carga_amostral.js` and 3 `*.test.ts` files) — not part of this feature's diff and not blocking, but worth a separate cleanup pass whenever convenient.
