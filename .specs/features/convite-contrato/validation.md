# Convite por Contrato Validation

**Date**: 2026-08-11
**Spec**: `.specs/features/convite-contrato/spec.md`
**Diff range**: `ccc4ca4`..`d522668` (16 commits desta feature, não contíguos — o branch
`develop` tem commits de `regua-instanciacao` intercalados, fora do escopo desta verificação)
**Verifier**: independent sub-agent (author ≠ verifier), evidence-or-zero
**Verdict**: ❌ **FAIL** — 1 Blocker, 3 Major, 3 Minor

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 | ✅ Done | `20260812001921_convite_contrato_estrutura.sql` — 2 tabelas, 3 CHECKs, 2 índices, RLS+FORCE, trigger de auditoria |
| T1-fix | ✅ Done | `20260812002624_convite_contrato_grants_legisla.sql` — GRANT a `legisla_*` (o `authenticated` de T1 nunca é o role executor real; achado legítimo do gate de T2) |
| T2 | ✅ Done | `20260812002133_fn_emitir_convite.sql` + 5 testes de integração |
| T2-fix | ✅ Done | `20260812005114_fn_emitir_convite_defaults.sql` — `DEFAULT NULL` nos parâmetros opcionais (achado do gate de T11) |
| T3 | ✅ Done | `20260812003455_fn_consumir_convite.sql` + 8 testes de integração |
| T4 | ✅ Done | `20260812004014_fn_checar_rate_limit_convite.sql` + 4 testes de integração |
| T5 | ✅ Done | `database.types.ts` regenerado — `convite_contrato`/`convite_tentativa` + 3 RPCs presentes |
| T6 | ✅ Done | `convite-token.ts` + 5 testes |
| T7 | ✅ Done | `schemas/convite.ts` + 13 testes |
| T8 | ✅ Done | `rpc/convite.ts` + 4 testes; `errors.ts` com as 3 entradas novas |
| T9 | ✅ Done | `queries/convite.ts` + 6 testes |
| T10 | ✅ Done | `rpc/consumir-convite.ts` + 6 testes |
| T11 | ✅ Done | `convite-form.tsx` — sem teste (matriz: none, build gate) |
| T12 | ✅ Done | `vinculos/page.tsx` — 2º botão + `modoAtivo` `{ tipo: "convidar" }` |
| T13 | ⚠️ Parcial | `/convite/[token]/page.tsx` existe e compila, mas **é inalcançável em runtime** — ver Gap 1 |
| T14 | ✅ Done | `convite-consumo-form.tsx` — POST nativo pra `/convite/[token]/consumir` |
| T15 | ⚠️ Parcial | `consumir/route.ts` existe e compila, mas **é inalcançável em runtime** — ver Gap 1. `SPEC_DEVIATION` de caminho já documentado em `tasks.md` (legítimo: App Router proíbe `page.tsx`+`route.ts` no mesmo segmento) |
| T16 | ✅ Done | Comentário de `admin.ts` atualizado, cita AD-033 e as 2 categorias de uso |

---

## Spec-Anchored Acceptance Criteria

### P1: Gestora convida Mentor ou Assessor

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1 — Gestora/Admin preenche o formulário THEN grava hash + `id_contrato` + papel + dados do vínculo, expiração 7 dias (CVT-01/02/03) | linha em `convite_contrato` com `dt_expiracao = now()+7d`, e-mail/papel do convite, só o hash | `supabase/tests/convite/fn-emitir-convite.integration.test.ts:183` — `expect(Number(linha.dias_para_expirar)).toBe(7)`; `:180` — `expect(linha.email).toBe(CONVIDADO_EMAIL)`; `:181` — `expect(linha.papel_no_contrato).toBe("assessor")`; `src/backend/rpc/convite.test.ts:51` — `expect(params.p_token_hash).not.toBe(token)` | ✅ PASS |
| AC2 — convite criado THEN devolve a URL `/convite/<token>` uma única vez na tela | URL com o token em claro, nunca reexibida | `src/backend/rpc/convite.test.ts:36` — `expect(resultado.caminho).toMatch(/^\/convite\/[0-9a-f]{64}$/)` (caminho); a parte "uma única vez / nunca reexibida" vive só em `convite-form.tsx:78-95`, sem harness de componente | ⚠️ Parcial — caminho coberto; não-reexibição sem evidência (matriz declara `none` pra componentes) |
| AC3 — já existe convite pendente pro mesmo e-mail+contrato+papel THEN expira o anterior | `dt_expiracao <= now()` no anterior, novo permanece válido | `fn-emitir-convite.integration.test.ts:215` — `expect(primeiro.expirado).toBe(true)`; `:220` — `expect(segundo.expirado).toBe(false)` | ✅ PASS |
| AC4 — usuário sem vínculo (nem Admin/Gestora) tenta convidar THEN rejeita via RLS (CVT-05) | erro 42501, nenhuma linha escrita | `fn-emitir-convite.integration.test.ts:235` — `expect(error?.code).toBe("42501")`; `:240` — `expect(Number(rows[0].count)).toBe(0)` | ✅ PASS |

### P1: Convidado define nome e senha, conta nasce vinculada

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1 — convidado abre `/convite/<token>` válido THEN mostra contratante + produto + formulário | página renderiza nome do contratante/produto e o form | Estado do convite: `src/backend/queries/convite.test.ts:75-80` — `expect(resultado).toEqual({ estado: "valido", idContrato: 42, papelNoContrato: "assessor", cargo: "secretaria_executiva" })`. **Mas a rota devolve `307 → /login` sem sessão** (`src/backend/supabase/proxy.ts:43-56`), então o outcome definido pelo spec nunca ocorre | ❌ GAP (Blocker — ver Gap 1) |
| AC2 — submete nome/senha válidos THEN cria `auth.users` (`email_confirm: true`), `dim_usuario` com o papel do convite, `rel_usuario_contrato`, `dt_uso`, `log_auditoria`, com idempotência | conta + vínculo + `dt_uso` numa passagem; `email_confirm: true`; auditoria | `fn-consumir-convite.integration.test.ts:165` — `expect(data).toMatchObject({ conta_nova: true })`; `:171` — `expect(usuario.papel_global).toBe("assessor")`; `:184-187` — `expect(vinculo.papel_no_contrato).toBe("assessor")` / `cargo` / `grau_responsabilidade` / `expect(vinculo.areas).toEqual(["saude","educacao"])`; `:192` — `expect(convite.dt_uso).not.toBeNull()`; `src/backend/rpc/consumir-convite.test.ts:67-69` — `expect(spies.createUser).toHaveBeenCalledWith(expect.objectContaining({ email_confirm: true }))` | ⚠️ Parcial — banco/Admin API ✅; `log_auditoria` sem nenhuma asserção (ver Gap 5); alcançabilidade bloqueada (Gap 1) |
| AC3 — RPC de consumo tenta gravar `papel_global` fora de `('mentor','assessor')` THEN rejeita (CVT-07) | rejeição explícita, guarda redundante | Camada 1 (`ck_convite_papel`): `fn-emitir-convite.integration.test.ts:255` — `expect(error?.code).toBe("23514")`; `:256` — `expect(error?.message).toMatch(/ck_convite_papel/)`. Espelho client: `src/backend/schemas/convite.test.ts:28` — `expect(resultado.success).toBe(false)` pra `admin`/`gestora`/`leitura`. Camada 2 (`CNV04` em `fn_consumir_convite.sql:51-53`): **nenhum teste** | ⚠️ Parcial — camadas 1 e client ✅; guarda redundante sem evidência (ver Gap 6) |
| AC4 — submete com sucesso THEN redireciona pro login (ou loga automaticamente) com acesso restrito ao contrato | `sucesso_logado` → `/`; `sucesso_sem_login` → `/login?msg=conta_existente` | `src/backend/rpc/consumir-convite.test.ts:66` — `expect(resultado).toEqual({ tipo: "sucesso_logado" })`; `:97` — `expect(resultado).toEqual({ tipo: "sucesso_sem_login" })`. Tradução em redirect: `consumir/route.ts:44-50`, sem teste; rota inalcançável | ❌ GAP (Blocker — ver Gap 1) |

### P1: Token inválido, expirado ou já usado é rejeitado com clareza

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1 — token não bate nenhum hash THEN "convite inválido", sem detalhar (CVT-09) | `estado: 'invalido'` / `CNV01` | `src/backend/queries/convite.test.ts:30` — `expect(resultado).toEqual({ estado: "invalido" })`; `fn-consumir-convite.integration.test.ts:271` — `expect(error?.code).toBe("CNV01")`; `src/backend/rpc/consumir-convite.test.ts:121` — `expect(resultado).toEqual({ tipo: "erro", mensagem: "Convite inválido." })` | ✅ PASS (estado) / rota inalcançável |
| AC2 — `dt_expiracao < now()` THEN "convite expirado", orientando a pedir novo | `estado: 'expirado'` / `CNV03` / mensagem distinta | `src/backend/queries/convite.test.ts:60` — `expect(resultado).toEqual({ estado: "expirado" })`; `fn-consumir-convite.integration.test.ts:257` — `expect(error?.code).toBe("CNV03")`. **Mapeamento `CNV03 → "Convite expirado. Peça um novo à Gestora."` (`consumir-convite.ts:39-40`) não tem asserção** — mutante #8 sobreviveu | ⚠️ Spec-precision/discriminação (ver Gap 3) |
| AC3 — `dt_uso IS NOT NULL` THEN "convite já utilizado", nunca cria 2ª conta | `estado: 'usado'` / `CNV02` / sem duplicar vínculo | `src/backend/queries/convite.test.ts:45` — `expect(resultado).toEqual({ estado: "usado" })`; `fn-consumir-convite.integration.test.ts:236` — `expect(error?.code).toBe("CNV02")`; `:241` — `expect(Number(rows[0].count)).toBe(0)` (nenhum `dim_usuario` criado); `:294` — `expect(Number(rows[0].count)).toBe(1)` (reconsumo não duplica vínculo) | ✅ PASS — mas a **precedência** usado-vs-expirado quando ambos valem não é fixada por nenhum teste (mutante #5 sobreviveu, ver Gap 4) |
| AC4 — volume anormal THEN rate limit por IP, erro antes de consultar o banco (CVT-10) | 20/15min por IP; checado antes do lookup do token | `fn-checar-rate-limit-convite.integration.test.ts:42` — `expect(data).toBe(true)` (×20); `:49` — `expect(vigesimaPrimeira).toBe(false)`; `:60` — IP distinto ainda `true`; `:79` — limpeza de linhas antigas; ordem "antes do lookup": `page.tsx:40-50` (rate limit → `return` antes de `validarConvite`), sem teste | ✅ PASS (função) / ordem sem teste; rota inalcançável |

### Requisitos CVT — resumo

| CVT | Cobertura | Result |
| --- | --- | --- |
| CVT-01 Emissão | `fn-emitir-convite:156-184`, `rpc/convite.test.ts:24-52` | ✅ |
| CVT-02 Hash, nunca claro | `rpc/convite.test.ts:50-51`, `lib/convite-token.test.ts:8,27` | ✅ |
| CVT-03 Expiração 7 dias | `fn-emitir-convite:183` | ✅ |
| CVT-04 Invalida duplicado | `fn-emitir-convite:215,220` | ✅ |
| CVT-05 RLS na emissão | `fn-emitir-convite:235,240` | ✅ |
| CVT-06 Consumo cria conta+vínculo | `fn-consumir-convite:165-192`, `consumir-convite.test.ts:61-74` | ⚠️ lógica ✅, rota inalcançável |
| CVT-07 Guarda de papel | `fn-emitir-convite:255-256`, `schemas/convite.test.ts:28` (camada 2 sem teste) | ⚠️ |
| CVT-08 Idempotência de falha parcial | `consumir-convite.test.ts:85-86,97-99`, `fn-consumir-convite:207,212,287` | ✅ |
| CVT-09 Mensagens distintas | `queries/convite.test.ts:30,45,60`, `fn-consumir-convite:236,257,271` | ⚠️ mapeamento TS parcialmente sem asserção |
| CVT-10 Rate limit | `fn-checar-rate-limit-convite:42,49,60,79`, `queries/convite.test.ts:87,92` | ⚠️ função ✅, rota inalcançável |
| CVT-11 Auditoria | **nenhuma asserção em nenhum teste** | ❌ sem evidência |

**Status**: ❌ Gaps presentes — 2 ACs bloqueados por inalcançabilidade de rota, 1 CVT sem
nenhuma evidência de teste, 2 mutantes sobreviventes.

---

## Discrimination Sensor

**Tier**: P0-full (caminho de autenticação/criação de conta) — 8 mutações, todas aplicadas
**apenas na camada TypeScript**, por cópia temporária do arquivo em scratchpad, revertidas
imediatamente após cada execução. **Nenhuma função/migration Postgres do banco de dev
compartilhado foi mutada** (restrição de recurso compartilhado com a sessão paralela de
`regua-instanciacao`). Árvore de trabalho confirmada limpa ao final
(`git status --porcelain -- src/backend/` vazio; suíte 149/149 verde).

| # | File:line | Mutação | Comando | Killed? |
| --- | --- | --- | --- | --- |
| 1 | `src/backend/rpc/consumir-convite.ts:84` | `if (!usuarioExistente)` → `if (usuarioExistente)` (chamaria `createUser` justamente quando a conta já existe — CVT-08) | `npm run test:unit -- consumir-convite` | ✅ Killed (2 falhas: `:66`, `:98`) |
| 2 | `src/backend/rpc/consumir-convite.ts:104` | remove o guard `if (!contaNova)` — sempre tenta `signInWithPassword` (vetor de account-takeover do design.md) | idem | ✅ Killed (`:97` — `sucesso_logado` ≠ `sucesso_sem_login`) |
| 3 | `src/backend/rpc/consumir-convite.ts:91` | remove `!erroIndicaEmailJaRegistrado(erroCreate)` — "already registered" vira erro duro | idem | ✅ Killed (`:85` — vira `{tipo:"erro"}`) |
| 4 | `src/backend/schemas/convite.ts:21` | `z.enum(["mentor","assessor"])` → `+["admin","gestora","leitura"]` (CVT-07 espelhado no client) | `npm run test:unit -- schemas/convite` | ✅ Killed (`:28`) |
| 5 | `src/backend/queries/convite.ts:28-29` | troca a ordem de checagem `dt_uso` ↔ `dt_expiracao` em `validarConvite` | `npm run test:unit` (suíte inteira) | ❌ **Survived** — 149/149 passam |
| 6 | `src/backend/rpc/convite.ts:41` | `p_token_hash: tokenHash` → `p_token_hash: token` (grava o token em claro — viola CVT-02) | `npm run test:unit -- rpc/convite` | ✅ Killed (`:51`) |
| 7 | `src/backend/lib/convite-token.ts:19` | `new Uint8Array(32)` → `new Uint8Array(8)` (entropia abaixo do mínimo do spec) | `npm run test:unit -- convite-token rpc/convite` | ✅ Killed (`:8`, `:36`) |
| 8 | `src/backend/rpc/consumir-convite.ts:39-40` | `CNV03 → "Convite expirado. Peça um novo à Gestora."` vira `"Convite inválido."` (colapsa 2 das 3 mensagens distintas de CVT-09) | `npm run test:unit` (suíte inteira) | ❌ **Survived** — 149/149 passam |

**Result**: 6/8 killed — ❌ **FAIL** (2 mutantes sobreviventes → fix tasks abaixo)

**Observação analítica sobre a camada SQL** (não mutada, por restrição de recurso
compartilhado): a mesma cegueira do mutante #5 existe no fixture de integração —
`fn-consumir-convite.integration.test.ts:223-242` monta o convite "usado" com
`dt_expiracao` **no futuro** (default `now()+7d`) e `:244-263` monta o "expirado" com
`dt_uso NULL`. Nenhum fixture tem as duas condições ao mesmo tempo, então a precedência
`CNV02` antes de `CNV03` em `fn_consumir_convite.sql:40-46` também não está fixada por
teste. O caso é real e recorrente: todo convite consumido passa a ter `dt_expiracao` no
passado 7 dias depois, e a partir daí a mensagem correta continua sendo "já utilizado".

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | ✅ — reusa `p_por_contrato`, `app.trg_auditoria()`, `mapeiaErroRpc`, `buscarContratoParaFicha`, `uq_vinculo`; nenhuma infraestrutura nova |
| Surgical changes | ✅ — `errors.ts` ganhou 3 linhas; `vinculos/page.tsx` só o 2º botão + um `modoAtivo`; `admin.ts` só comentário |
| No scope creep | ✅ — sem tela de listagem/revogação, sem SMTP, sem pareamento PLL (todos Out of Scope) |
| Matches patterns | ✅ — `SECURITY INVOKER` (AD-024), RLS+FORCE no mesmo DDL (AD-001), rota pré-sessão fora de `(app)/` (AD-027), `service_role` só nas exceções da AD-010/AD-033 |
| Spec-anchored outcome check | ⚠️ — 2 mapeamentos de mensagem e 1 precedência não têm asserção sobre o valor exato |
| Per-layer Coverage Expectation met | ❌ — a matriz exige de `rpc/consumir-convite.ts` cobertura "1:1 a CVT-06/07/08/09"; `CNV01`/`CNV03`/`CNV04` do `mensagemDeErroConsumo` não são exercitados (só `CNV02`) |
| Every test maps to um requisito — sem testes órfãos | ✅ — os 34 unitários + 17 de integração novos mapeiam a ACs ou a "Done when" de tasks.md |
| Documented guidelines followed | ✅ — `CLAUDE.md` (migrations forward-only via `supabase migration new`, nunca SQL à mão; `db push` só em dev), `docs/ambientes.md` (ref `npnvoolkebhabjkjzqwn` confirmada antes de rodar) |

**Nota positiva**: os dois "fix" de migration (`..._grants_legisla`, `..._emitir_convite_defaults`)
são forward-only, com o motivo documentado no cabeçalho — exatamente o padrão que o
`CLAUDE.md` exige. Nenhuma migration já aplicada foi editada.

**Nota de higiene menor**: `consumir-convite.test.ts:102` tem título "…sem nenhuma chamada
Admin API", mas a asserção só cobre `signInWithPassword` (o próprio comentário `:111-112`
reconhece que `createUser` é chamado). Título e asserção divergem; não é defeito de código.

---

## Edge Cases

- [x] **E-mail já existe em `dim_usuario` sem `rel_usuario_contrato` ainda** — conta
  reaproveitada, nunca duas contas Auth pro mesmo e-mail.
  Evidência: `fn-consumir-convite.integration.test.ts:207` — `expect(data).toMatchObject({ conta_nova: false })`;
  `src/backend/rpc/consumir-convite.test.ts:98` — `expect(spies.createUser).not.toHaveBeenCalled()`.
- [x] **E-mail já existe com outro `papel_global`** — adiciona o vínculo sem alterar o papel.
  Evidência: `fn-consumir-convite.integration.test.ts:212` — `expect(usuario.papel_global).toBe("mentor")`
  (convite era `assessor`); `:220` — `expect(Number(rows[0].count)).toBe(1)`.
- [ ] **Gestora perde o vínculo antes do convite ser usado → convite continua válido** —
  correto por construção (`fn_consumir_convite.sql` nunca relê `id_usuario_convidou`, e o
  consumo roda por `service_role`, com RLS ignorada), mas **sem nenhum teste**. Sem evidência.
- [ ] **Convidado já tem sessão ativa → processa normalmente, sem misturar com a sessão
  corrente** — ❌ **NÃO tratado**. `consumir/route.ts:42` → `consumir-convite.ts:111`
  chama `server.auth.signInWithPassword` com o client cookie-aware (`supabase/server.ts:22-32`),
  que **sobrescreve o cookie de sessão vigente**. Um Admin que abrir o link de teste sai da
  própria sessão e entra na conta recém-criada — exatamente o "misturar com a sessão corrente"
  que o spec proíbe. Não há isolamento nenhum (nem `signOut` prévio, nem client sem cookie
  bridge, nem detecção de sessão ativa).

---

## Gate Check

- **Gate command (Build, de tasks.md)**: `npm run build && npm run lint:all`, mais
  `npm run test:unit` e `npx vitest run --config vitest.integration.config.ts supabase/tests/convite`
- **Projeto Supabase alvo**: `npnvoolkebhabjkjzqwn` (**dev**, confirmado em
  `supabase/.temp/project-ref` antes de qualquer execução). Nada rodou contra produção.

| Gate | Resultado |
| --- | --- |
| `npm run test:unit` | ✅ 149 passed, 0 failed, 0 skipped (18 arquivos) |
| `npx vitest run --config vitest.integration.config.ts supabase/tests/convite` | ✅ 17 passed, 0 failed, 0 skipped (3 arquivos) |
| `npm run build` | ✅ verde — rotas `/convite/[token]` e `/convite/[token]/consumir` presentes na tabela de rotas |
| `npm run lint:all` | ✅ 27 problems (13 errors, 14 warnings) = **baseline exata**; zero problemas em qualquer arquivo desta feature (grep por `convite` na saída: nenhum resultado) |

**Test Integrity Check**

- Testes unitários antes da feature (`ca5be45`): **111** (contagem direta de `it(`/`test(` nos
  12 arquivos `src/**/*.test.ts` daquele commit)
- Testes unitários agora: **149** — delta **+38**, dos quais **+34 desta feature**
  (`convite-token` 5, `schemas/convite` 13, `rpc/convite` 4, `rpc/consumir-convite` 6,
  `queries/convite` 6) e +4 da sessão paralela (`queries/etapa-contrato`)
- Testes de integração desta feature: **+17** (`fn-emitir-convite` 5, `fn-consumir-convite` 8,
  `fn-checar-rate-limit-convite` 4)
- Nenhum teste removido, nenhum `skip`, nenhuma asserção enfraquecida em teste pré-existente

---

## Fix Plans

### Fix 1 — `/convite/*` é bloqueado pelo proxy de autenticação (BLOCKER)

- **Root cause**: `src/backend/supabase/proxy.ts:43-50` define `isPublicRoute` como
  `/login` ∪ `/auth` ∪ `/admin/acesso`. `/convite/...` não está na lista, então
  `:52-56` (`if (!user && !isPublicRoute)`) redireciona **toda** requisição sem sessão pra
  `/login`. Estar fora do route group `(app)/` (AD-027) só remove o layout com sidebar — o
  proxy casa por `pathname`, não por route group, e o matcher de `src/frontend/proxy.ts:18`
  cobre tudo que não é asset estático. As duas rotas pré-sessão que o design.md cita como
  padrão a copiar (`app/auth/confirm/route.ts`, `app/admin/acesso/entrar/route.ts`) **estão**
  na whitelist; o convite copiou o padrão de Route Handler mas não a entrada correspondente.
- **Evidência empírica** (servidor `next dev` da árvore atual, sem cookies):
  - `GET  http://localhost:3000/convite/deadbeef` → `HTTP/1.1 307 Temporary Redirect`, `location: /login`
  - `POST http://localhost:3000/convite/deadbeef/consumir` → `HTTP/1.1 307 Temporary Redirect`, `location: /login`
  - Controle: `GET /login` → `200`
- **Impacto**: a metade de consumo da feature (US2 e US3 inteiras; CVT-06, CVT-08, CVT-09,
  CVT-10) é inalcançável **exatamente para o público que a feature existe para atender** —
  Mentor/Assessor externo, que por definição não tem conta nem sessão. O Success Criteria
  "um Mentor e um Assessor de teste, sem conta prévia, conseguem acessar o sistema de ponta a
  ponta só com o link de convite" não é atingível hoje.
- **Fix task**:
  - What: adicionar `pathname.startsWith("/convite")` a `isPublicRoute`, com comentário
    explicando por que é seguro (o token é o único segredo; rate limit por IP em
    `app.checar_rate_limit_convite` protege o espaço de tokens; nenhuma leitura de domínio
    acontece sem token válido) — mesmo racional já escrito pra `/admin/acesso`.
  - Where: `src/backend/supabase/proxy.ts:43-50`
  - Verify: `curl -i http://localhost:3000/convite/<token-invalido>` devolve `200` com
    "Convite inválido" em vez de `307 → /login`; e um teste que trave a lista de rotas
    públicas (a matriz de testes hoje não cobre o proxy — é o único ponto do sistema onde
    "rota nova pré-sessão" pode ser esquecida sem nenhum sinal).
  - Priority: **Blocker**

### Fix 2 — Sessão ativa é sobrescrita no consumo (edge case 4 do spec.md)

- **Root cause**: `src/backend/rpc/consumir-convite.ts:111` chama `signInWithPassword` no
  client cookie-aware de `supabase/server.ts`, que grava o cookie de sessão na resposta.
  Não há nenhuma checagem de sessão vigente nem isolamento.
- **Fix task**: decidir e implementar o comportamento que o spec pede ("processar o convite
  normalmente, sem misturar com a sessão corrente") — p.ex. detectar sessão ativa no
  `route.ts` e, nesse caso, pular o auto-login e redirecionar pra `/login?msg=conta_criada`,
  preservando a sessão do Admin; cobrir com teste unitário em `consumir-convite.test.ts`.
- Priority: **Major**

### Fix 3 — `mensagemDeErroConsumo` sem asserção por código (mutante #8)

- **Root cause**: `consumir-convite.test.ts` só exercita `CNV02`; `CNV01`, `CNV03` e `CNV04`
  não têm caso de teste, então colapsar mensagens distintas passa despercebido — contra a
  própria expectativa "1:1 a CVT-06/07/08/09" da Test Coverage Matrix.
- **Fix task**: um caso por código (`CNV01`, `CNV02`, `CNV03`, `CNV04`, default), assertando
  a string exata de `ResultadoConsumo.mensagem`.
- Priority: **Major**

### Fix 4 — Precedência usado-vs-expirado sem asserção (mutante #5)

- **Root cause**: todos os fixtures — unitários (`queries/convite.test.ts:33-61`) e de
  integração (`fn-consumir-convite.integration.test.ts:223-263`) — montam só uma condição por
  vez. Trocar a ordem das checagens não quebra nada.
- **Fix task**: adicionar um caso com `dt_uso` preenchido **e** `dt_expiracao` no passado,
  assertando `estado: "usado"` (e, no lado SQL, `CNV02`) — que é o comportamento que
  `spec.md` US3 AC3 descreve sem qualificar por expiração, e o que a implementação atual já
  faz. Documentar a precedência no `spec.md` (hoje ela é ambígua para o caso combinado).
- Priority: **Major**

### Fix 5 — CVT-11 (auditoria) sem nenhuma asserção

- **Root cause**: T1 declara `Tests: none` e delega a confirmação do trigger a "gate check de
  T2/T3", mas nenhum teste de T2/T3 consulta `log_auditoria` (as duas únicas menções, em
  `fn-emitir-convite:140` e `fn-consumir-convite:130`, são `DELETE` de limpeza).
- **Verificação manual do Verifier** (query read-only no dev): o trigger
  `trg_audit_convite_contrato` existe e está habilitado (`tgenabled = 'O'`), e
  `log_auditoria` tem linhas reais com `tabela = 'convite_contrato'` (`insert` 15,
  `update` 9). O mecanismo funciona — falta o teste de regressão.
- **Fix task**: assertar, em `fn-emitir-convite`, uma linha `log_auditoria` com
  `tabela='convite_contrato'`, `acao='insert'`, `id_registro = id_convite`; e em
  `fn-consumir-convite`, uma com `acao='update'`.
- Priority: **Minor**

### Fix 6 — Guarda de papel camada 2 (`CNV04`) sem evidência

- **Root cause**: `fn_consumir_convite.sql:51-53` é inalcançável enquanto `ck_convite_papel`
  existir — construir o fixture exigiria desabilitar a constraint, o que não é aceitável no
  banco de dev compartilhado.
- **Fix task**: assertar por inspeção (`pg_get_functiondef` contém o `NOT IN ('mentor','assessor')`)
  ou registrar explicitamente na matriz que esta guarda é verificada só por leitura de código.
- Priority: **Minor**

### Fix 7 — Edge case "Gestora perde o vínculo" sem evidência

- **Fix task**: em `fn-consumir-convite`, apagar o vínculo da Gestora emissora antes do
  consumo e assertar que o convite ainda é consumido com sucesso.
- Priority: **Minor**

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| CVT-01 | Implementing | ✅ Verified |
| CVT-02 | Implementing | ✅ Verified |
| CVT-03 | Implementing | ✅ Verified |
| CVT-04 | Implementing | ✅ Verified |
| CVT-05 | Implementing | ✅ Verified |
| CVT-06 | Implementing | ❌ Needs Fix (Fix 1 — inalcançável em runtime) |
| CVT-07 | Implementing | ⚠️ Verified com ressalva (Fix 6) |
| CVT-08 | Implementing | ✅ Verified (lógica) / bloqueado por Fix 1 na ponta a ponta |
| CVT-09 | Implementing | ❌ Needs Fix (Fix 1, Fix 3, Fix 4) |
| CVT-10 | Implementing | ❌ Needs Fix (Fix 1 — função ✅, rota inalcançável) |
| CVT-11 | Implementing | ❌ Needs Fix (Fix 5 — sem evidência de teste) |

---

## Summary

**Overall**: ❌ Not Ready

**Spec-anchored check**: 12 ACs do spec — 6 ✅ PASS, 4 ⚠️ parciais/spec-precision, 2 ❌ GAP
(bloqueados por inalcançabilidade de rota). Dos 11 CVT: 5 ✅, 2 ⚠️, 4 ❌.
**Sensor**: 8 mutações, 6 killed, 2 survived (P0-full tier, só camada TypeScript)
**Gate**: unit 149/149 ✅ · integration 17/17 ✅ · build ✅ · lint 27 = baseline ✅

**What works**:
- Emissão inteira (CVT-01..CVT-05) — RLS pelo predicado `p_por_contrato` reusado literalmente,
  invalidação de duplicado atômica, expiração de 7 dias fixa na função, token só como hash
- Consumo no lado do banco (CVT-06/07/08) — `FOR UPDATE`, `ON CONFLICT DO NOTHING` via
  `uq_vinculo`, `papel_global` preexistente nunca sobrescrito, reconsumo rejeitado
- As duas guardas de account-takeover do design (nunca `createUser` com conta existente,
  nunca `signInWithPassword` sem `conta_nova`) são reais e **discriminantes** — mutantes 1, 2 e 3
  morreram
- Rate limit em Postgres com limpeza embutida, `EXECUTE` travado a `service_role` nas duas
  funções pré-sessão
- Migrations forward-only, com os dois fixes documentados no cabeçalho; lint sem regressão

**Issues found**: ver Fix Plans 1–7, ranqueados. O Blocker (Fix 1) é de uma linha e está fora
do diff da feature (`proxy.ts`), o que é justamente por que passou por 16 tasks e 4 gate checks
sem sinal: build, lint e testes não exercitam o proxy.

**Next steps**: aplicar Fix 1 (Blocker) e Fix 2–4 (Major), depois re-verificar. Fix 5–7 (Minor)
podem entrar na mesma rodada — são todos aumento de asserção, sem mudança de código de produção.

---

## Re-verificação (Rodada 2)

**Date**: 2026-08-11
**Diff range**: `ba3aa67`..`34e4117` (4 commits de fix + 1 de docs), HEAD = `34e4117`
**Verifier**: independent sub-agent (author ≠ verifier), evidence-or-zero
**Escopo**: re-verificação dirigida dos 5 fixes aplicados — não uma re-auditoria da feature
inteira. Os itens já ✅ PASS da rodada 1 não foram reexaminados, exceto onde um fix os tocava.
**Verdict**: ✅ **PASS** — 5/5 fixes confirmados, 2/2 remutações mortas, gate completo verde.
2 gaps residuais Minor (sensor/cosmética), nenhum bloqueante.

### Os 5 fixes

| # | Fix | Evidência | Confirmado? |
| --- | --- | --- | --- |
| 1 | **Blocker** — proxy bloqueava `/convite` | `src/backend/supabase/proxy.ts:60` — `pathname.startsWith("/convite")` em `isPublicRoute`, com racional AD-033 em `:51-59`. **Empírico** (`next dev`, sem cookies): `GET /convite/token-que-nao-existe` → **200**, corpo renderiza `<h1>Convite inválido</h1>` + "Verifique o link recebido."; `POST /convite/token-que-nao-existe/consumir -d "nome=x&senha=senha123"` → **303**, `location: /convite/token-que-nao-existe?erro=Convite%20inv%C3%A1lido.` — volta pro convite, nunca pro login. **Controles de não-regressão**: `GET /contratos` → `307 → /login` (AD-002 intacta pro resto do sistema); `GET /login` → 200 | ✅ |
| 2 | **Major** — sessão ativa sobrescrita | `src/backend/rpc/consumir-convite.ts:119-122` — `deps.server.auth.getUser()` antes do `signInWithPassword` de `:124`; com sessão vigente devolve `sucesso_sem_login` sem tocar o cookie. Teste novo: `consumir-convite.test.ts:149-164` (`sessaoAtivaExistente`), que assere `signInWithPassword` **não** chamado e `createUser`/`rpc` **chamados** (o convite é processado normalmente — as duas metades do edge case do spec). Verde em `npm run test:unit -- consumir-convite` (12/12) | ✅ |
| 3 | **Major / mutante #8** — mensagem por código | `consumir-convite.test.ts:170-185` — `it.each` com CNV01/CNV02/CNV03/CNV04/default assertando a string exata. Remutação abaixo: **killed** | ✅ |
| 4 | **Major / mutante #5** — precedência usado-vs-expirado | `queries/convite.test.ts:68-81` — fixture com `dt_uso` preenchido **e** `dt_expiracao` no passado, assertando `estado: "usado"`. Precedência agora documentada em `queries/convite.ts:28-34`, com ponteiro explícito pra manter `app.consumir_convite` em sincronia. Remutação abaixo: **killed** | ✅ |
| 5 | **Minor** — auditoria (CVT-11) | `fn-emitir-convite.integration.test.ts:185-194` — linha de `log_auditoria` com `tabela='convite_contrato'`, `id_registro_alvo = id_convite`, `acao='insert'`; `fn-consumir-convite.integration.test.ts:206-215` — idem com `acao='update'`. Ambas discriminantes: sem o trigger, o destructuring devolve `undefined` e `toBeDefined()` falha antes do `.acao`. Timeouts de 60s/90s adicionados com motivo documentado (latência do round-trip via Management API), sem enfraquecer nenhuma asserção | ✅ |

### Gate completo

| Gate | Rodada 1 | Rodada 2 | Resultado |
| --- | --- | --- | --- |
| `npm run test:unit` | 149 passed (18 arquivos) | **156 passed, 0 failed, 0 skipped** (18 arquivos) | ✅ +7, nenhum removido |
| `npx vitest run --config vitest.integration.config.ts supabase/tests/convite` | 17 passed | **17 passed, 0 failed** (3 arquivos, 327s) | ✅ |
| `npm run build` | verde | **verde** — `/convite/[token]` e `/convite/[token]/consumir` na tabela de rotas | ✅ |
| `npm run lint:all` | 27 problems (13 errors, 14 warnings) | **27 problems (13 errors, 14 warnings)** — baseline exata, `grep -i convite` na saída: vazio | ✅ |

**Delta de testes (+7)**: `consumir-convite.test.ts` 6→12 (+1 sessão ativa, +5 do `it.each`),
`queries/convite.test.ts` 6→7 (+1 precedência). Nenhum teste removido, nenhum `skip`, nenhuma
asserção pré-existente enfraquecida.

**Projeto Supabase alvo**: `npnvoolkebhabjkjzqwn` (**dev**), confirmado em
`supabase/.temp/project-ref` imediatamente antes da execução de integração. Nada rodou contra
produção. **Nenhuma função/migration Postgres foi mutada** — restrição de banco compartilhado
mantida, igual à rodada 1.

### Remutações

Aplicadas só na camada TypeScript, por script em scratchpad, com
`git checkout -- <arquivo>` na mesma invocação de shell — o arquivo nunca ficou mutado entre
chamadas. Árvore confirmada limpa após cada uma (`git status --porcelain -- src/` vazio).

| # | Mutação | Comando | Killed? |
| --- | --- | --- | --- |
| #8 (rodada 1) | `consumir-convite.ts` — `case "CNV03"` devolve `"Convite inválido."` | `npm run test:unit -- consumir-convite` | ✅ **Killed** — 1 failed / 11 passed, em `consumir-convite.test.ts:184` (`- "Convite expirado. Peça um novo à Gestora." / + "Convite inválido."`) |
| #5 (rodada 1) | `queries/convite.ts` — checa `dt_expiracao` antes de `dt_uso` | `npm run test:unit -- queries/convite` | ✅ **Killed** — 1 failed / 6 passed, em `queries/convite.test.ts:80` (`- "usado" / + "expirado"`) |
| #9 (**nova**, rodada 2) | `proxy.ts` — remove `pathname.startsWith("/convite")` de `isPublicRoute` (desfaz o Blocker Fix 1) | `npm run test:unit` (suíte inteira) | ❌ **Survived** — 156/156 passam. Ver Gap Residual 1 |

**Result**: 2/2 das remutações exigidas — ✅ os dois mutantes sobreviventes da rodada 1 estão
mortos. A mutação #9 é acréscimo do Verifier desta rodada e não invalida os fixes (o
comportamento está empiricamente correto hoje), mas mede o risco de regressão silenciosa.

### Code Quality (seção 6 de validate.md) — arquivos tocados pelos fixes

| Check | Pass? |
| --- | --- |
| No features beyond what was asked | ✅ — nenhum fix adicionou superfície nova |
| No abstractions for single-use code | ✅ — `sessaoAtivaExistente` entra como flag na `MockConfig` já existente; nenhuma factory nova |
| No unnecessary "flexibility" added | ✅ |
| Only touched files required for task | ✅ — 3 de produção (`proxy.ts` +1 condição, `consumir-convite.ts` +4 linhas de código, `queries/convite.ts` **só comentário**) + 4 de teste |
| Didn't "improve" unrelated code | ✅ |
| Matches existing patterns/style | ✅ — a entrada de `/convite` em `isPublicRoute` segue o mesmo formato e racional comentado do `/admin/acesso` logo acima |
| Would senior engineer approve? | ✅ — cada fix cita o achado do Verifier no comentário, explicando *por que* a linha existe (protege contra remoção acidental por leitura) |
| Tests map to ACs, não-shallow | ✅ — `it.each` assere string exata por código; o teste de precedência combina as duas condições; as asserções de auditoria falham de verdade se o trigger não disparar |
| Spec-anchored outcome check | ✅ — corrigido: os 3 valores que a rodada 1 apontou sem asserção agora têm asserção sobre o valor exato |
| Per-layer Coverage Expectation met | ✅ — a expectativa "1:1 a CVT-06/07/08/09" de `rpc/consumir-convite.ts` agora é atendida (CNV01/02/03/04 + default) |
| Every test maps to um requisito | ✅ — os +7 mapeiam a CVT-09 e ao edge case 4 do `spec.md` |
| Documented guidelines followed | ✅ — nenhuma migration nova nesta rodada; `docs/ambientes.md` (ref dev conferida antes da integração) |

### Débito aceito — confirmação de que não há afirmação falsa

- **Fix 6 (guarda de papel camada 2, `CNV04`)** — inalcançável enquanto `ck_convite_papel`
  existir. Confirmado: a **única** menção a `CNV04` em teste é
  `consumir-convite.test.ts:174`, que cobre o *mapeamento de mensagem* em TypeScript, não a
  guarda SQL. Nenhum teste, comentário ou doc afirma que a guarda de `fn_consumir_convite.sql:51-53`
  foi exercitada. Sem regressão de honestidade. ✅
- **Fix 7 (Gestora perde vínculo antes do consumo)** — correto por construção. Confirmado:
  `grep -ni "perde|transferencia de carteira" supabase/tests/convite/` não retorna nada —
  nenhum teste alega cobrir este caso. ✅

Ambos seguem listados como Fix Plans 6 e 7 acima, com prioridade Minor — a decisão de aceitá-los
como débito está registrada, e nada no código ou nos docs os apresenta como cobertos.

### Gaps residuais (nenhum bloqueante)

**1. (Minor, sensor) — a lista de rotas públicas do proxy continua sem teste de regressão.**
A segunda metade do critério "Verify" do Fix 1 da rodada 1 ("um teste que trave a lista de rotas
públicas") não foi entregue. Evidência empírica: a mutação #9 acima — remover
`pathname.startsWith("/convite")` de `proxy.ts` — passa nos **156/156** testes unitários, e
(conforme já estabelecido na rodada 1) `build` e `lint` também não exercitam o proxy. Ou seja, o
Blocker que custou 16 tasks e 4 gate checks pra ser detectado pode ser reintroduzido hoje sem
nenhum sinal automatizado. Não é defeito de comportamento — o comportamento está verificado por
HTTP direto nesta rodada — é ausência de sensor. Atenuantes: o projeto **inteiro** não tem
harness pra middleware Next (nenhum arquivo `*proxy*.test.ts` existe), então o item é dívida de
infraestrutura de teste, não um teste esquecido; e a classe de erro já está destilada como
**L-009** em `.specs/LESSONS.md`. Recomendação (fora do escopo do Verifier): um unitário que
importe `updateSession` e assere `200`/redirect pra um conjunto congelado de pathnames.

**2. (Minor, cosmética, pré-existente) — `?msg=conta_existente` nunca é renderizado.**
`consumir/route.ts:48` redireciona pra `/login?msg=conta_existente`, mas
`src/frontend/app/login/page.tsx` (36 linhas) não lê `searchParams` em lugar nenhum — o
parâmetro é descartado. O usuário cai numa tela de login sem explicação. Já existia na rodada 1
(não foi introduzido pelos fixes) e não viola nenhuma AC — o `spec.md` US2 AC4 só exige
"redirecionar pro login (ou logar automaticamente)", o que acontece. Mas o Fix 2 passou a mandar
uma **classe nova** de usuário por esse caminho (Admin testando o link, agora com a sessão
preservada), então a imprecisão da mensagem ficou mais visível: para uma conta recém-criada,
"conta_existente" também é o rótulo errado.

### Requirement Traceability Update

| Requirement | Rodada 1 | Rodada 2 |
| --- | --- | --- |
| CVT-01 | ✅ Verified | ✅ Verified |
| CVT-02 | ✅ Verified | ✅ Verified |
| CVT-03 | ✅ Verified | ✅ Verified |
| CVT-04 | ✅ Verified | ✅ Verified |
| CVT-05 | ✅ Verified | ✅ Verified |
| CVT-06 | ❌ Needs Fix (rota inalcançável) | ✅ Verified — rota alcançável (200/303 empíricos) |
| CVT-07 | ⚠️ com ressalva (Fix 6) | ✅ Verified — camadas 1 + client; camada 2 aceita como débito documentado |
| CVT-08 | ✅ (lógica) / bloqueado ponta a ponta | ✅ Verified |
| CVT-09 | ❌ Needs Fix (Fix 1, 3, 4) | ✅ Verified — 3 mensagens distintas + precedência, mutantes #8 e #5 mortos |
| CVT-10 | ❌ Needs Fix (rota inalcançável) | ✅ Verified — função ✅ + rota alcançável |
| CVT-11 | ❌ sem evidência | ✅ Verified — `log_auditoria` assertado na emissão e no consumo |

### Summary

**Overall**: ✅ **Ready**

**Spec-anchored check**: os 2 ACs que a rodada 1 marcou como ❌ GAP (US2 AC1 e AC4, bloqueados
por inalcançabilidade de rota) agora passam com evidência empírica de HTTP; os 4 ⚠️ parciais
viraram ✅, exceto pela não-reexibição da URL em `convite-form.tsx` (matriz declara `none` pra
componentes — mesma posição da rodada 1). Dos 11 CVT: **11 ✅ Verified**.
**Sensor**: 2/2 remutações exigidas mortas. 1 mutação nova (#9, proxy) sobrevive → Gap Residual 1.
**Gate**: unit 156/156 ✅ · integration 17/17 ✅ · build ✅ · lint 27 = baseline ✅

**O que mudou desde a rodada 1**: o Blocker era de uma linha e está corrigido com o racional
documentado inline; a sessão ativa deixou de ser sobrescrita (a conta e o vínculo ainda são
criados — as duas metades do edge case); os dois pontos cegos do sensor viraram asserções sobre
valores exatos; e a auditoria (CVT-11) saiu de "nenhuma evidência" para asserção nos dois
sentidos. Os 5 fixes somam ~20 linhas de produção e 7 testes.

**Recomendação**: liberar a feature. Os 2 gaps residuais são dívida rastreada (o #1 já virou
L-009), não impedem o Success Criteria do `spec.md`.

---

## Pós-PASS: os 2 gaps residuais foram fechados (sessão principal, não pelo Verifier)

Depois do PASS da rodada 2, os dois itens listados como "dívida rastreada" acima foram corrigidos
na mesma sessão (commit `33b6a3a`), fora do laço fix→re-verify formal (nenhum dos dois era
bloqueante pro PASS):

1. **Gap Residual 1 (mutação #9, proxy sem sensor)** — `isPublicRoute` extraída de `proxy.ts` pra
   função pura exportada + `proxy.test.ts` novo (2 casos: rotas liberadas, rotas negadas). Agora
   remover `/convite` da allowlist quebra a suíte unitária, fechando exatamente a lacuna que a
   mutação #9 expôs.
2. **Gap Residual 2 (`?msg=conta_existente` incorreto pra conta nova)** — `ResultadoConsumo.sucesso_sem_login`
   ganhou `motivo: "conta_existente" | "sessao_ativa" | "login_automatico_falhou"`; `route.ts`
   repassa o motivo em `?msg=`; `login/page.tsx` (que nunca lia `searchParams`) passou a ler e
   mostrar a mensagem certa por motivo.

Gate após os dois fixes: unit **158/158** (156 + 2 novos), build ✅ (`/login` virou rota dinâmica,
esperado — agora lê `searchParams`), lint 27 = baseline exata. Nenhuma re-execução do Verifier foi
feita pra esta rodada (mudança estritamente aditiva sobre um PASS já confirmado, sem tocar nenhum
comportamento coberto pelas 2 remutações da rodada 2) — se uma auditoria futura quiser confirmar,
o commit `33b6a3a` é o ponto de partida.
