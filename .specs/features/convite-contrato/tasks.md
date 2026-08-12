# Convite por Contrato Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its
Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is
the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review,
Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

**Nota desta sessão**: Pedro instruiu seguir Execute → Validate sem pausar pra confirmação
intermediária. 16 tasks > ~8 (limiar de oferta de sub-agente), mas a execução roda **inline, na
mesma sessão**, sem spawn de sub-agentes de batch — a oferta-então-confirmação do skill não se
aplica aqui porque não há delegação a decidir, só execução direta.

---

**Design**: `.specs/features/convite-contrato/design.md`
**Status**: Done — T1-T16 implementadas e comitadas (`ccc4ca4`..`d522668`); rodada 1 de
fix→re-verify aplicada (`ba3aa67`..`190f89e` — Blocker do proxy + 2 Major de sessão/mutante +
1 Major de precedência + 1 Minor de auditoria). Ver `validation.md` pro relatório completo
do Verifier independente e a rodada 2 (re-verificação) para o veredito final.

**SPEC_DEVIATION (T15)**: o Route Handler de consumo vive em
`/convite/[token]/consumir/route.ts`, não em `/convite/[token]/route.ts` como este
documento descrevia originalmente — o Next.js App Router não permite `page.tsx` e
`route.ts` no mesmo segmento (`Conflicting route and page`), descoberto no gate check de
T15. Mesmo padrão de separação já usado em `admin/acesso/page.tsx` vs.
`admin/acesso/entrar/route.ts`. `ConviteConsumoForm` (T14) posta para essa rota.

---

## Test Coverage Matrix

> Gerado por amostragem do codebase (`vitest.config.ts`/`vitest.integration.config.ts`,
> `src/backend/rpc/vinculo.test.ts`, `supabase/tests/fundacao/fn-substituir-vinculo.integration.test.ts`,
> `src/backend/queries/contrato.test.ts`) + `spec.md`. Nenhum guideline de teste formal encontrado
> em `AGENTS.md`/`CLAUDE.md` além dos comandos em `package.json` — os padrões de profundidade vêm
> da amostragem (piso) e dos ACs do `spec.md` (teto).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Postgres RPC (`app.emitir_convite`, `app.consumir_convite`, `app.checar_rate_limit_convite`) + RLS/GRANT/trigger da tabela que cada RPC exercita | integration | Todo AC de CVT-01 a CVT-11 relevante ao RPC, incluindo o caminho negativo de RLS (CVT-05) e o guard de papel (CVT-07) — mesma profundidade de `fn-substituir-vinculo.integration.test.ts` | `supabase/tests/convite/*.integration.test.ts` | `npm run test:integration` |
| DDL puro (tabelas, `CHECK`, índices) sem RPC ainda associado | none | — (verificado pelo próprio `db push` + exercido indiretamente pelas integrações dos RPCs) | — | build gate only (`db push` sem erro) |
| `src/backend/lib/convite-token.ts` | unit | Todas as branches (formato do token, determinismo do hash) | `src/backend/lib/convite-token.test.ts` | `npm run test:unit` |
| `src/backend/schemas/convite.ts` (Zod) | unit | 1:1 por campo/regra, válido+inválido — mesma profundidade de `usuario.test.ts`/`vinculo.test.ts` | `src/backend/schemas/convite.test.ts` | `npm run test:unit` |
| `src/backend/rpc/convite.ts` (wrapper de emissão) | unit | Sucesso + 4 códigos de erro mapeados — mesma profundidade de `vinculo.test.ts` | `src/backend/rpc/convite.test.ts` | `npm run test:unit` |
| `src/backend/queries/convite.ts` (leitura de estado + rate limit) | unit | 4 estados (válido/inválido/expirado/usado) + rate limit permitido/excedido, client mockado — mesma profundidade de `contrato.test.ts` | `src/backend/queries/convite.test.ts` | `npm run test:unit` |
| `src/backend/rpc/consumir-convite.ts` (orquestração do consumo — domínio, DI'd) | unit | 1:1 a CVT-06/07/08/09: conta nova vs. pré-existente, `createUser` sucesso/"already registered"/outro erro, `conta_nova` → tenta `signInWithPassword`, guard de papel recusado pela RPC | `src/backend/rpc/consumir-convite.test.ts` | `npm run test:unit` |
| `ConviteForm`, `ConviteConsumoForm`, `/convite/[token]/page.tsx`, `/convite/[token]/route.ts` | none | Projeto não tem teste de componente/rota Next.js hoje (débito documentado em `plataforma-ui-tanstack/design.md`) — build gate cobre compilação | — | build gate only |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tasks só com teste unitário | `npm run test:unit` |
| Full | Tasks com teste de integração | `npm run test:unit && npm run test:integration` |
| Build | Fim de fase / tasks sem teste (schema, componente, rota) | `npm run build && npm run lint:all` |

---

## Execution Plan

### Phase 1: Schema (Postgres)

```
T1 → T2 → T3 → T4 → T5
```

### Phase 2: Backend TypeScript (puro / mockado)

```
T6 → T7 → T8 → T9 → T10
```

### Phase 3: Frontend — emissão (dentro da sessão)

```
T11 → T12
```

### Phase 4: Frontend — consumo (pré-sessão)

```
T13 → T14 → T15
```

### Phase 5: Polish

```
T16
```

---

## Task Breakdown

### T1: Migration — `convite_contrato` + `convite_tentativa` (DDL + RLS + GRANT + trigger)

**What**: Uma migration (`supabase migration new convite_contrato_estrutura`) criando as duas
tabelas (colunas, `CHECK`s `ck_convite_papel`/`ck_convite_cargo`/`ck_convite_email`, índices),
habilitando RLS+FORCE nas duas, criando a política `p_por_contrato` em `convite_contrato`
(idêntica à de `docs/schema_sistema.sql:1576-1580`), revogando os GRANTs padrão de `anon`/
`authenticated` nas duas tabelas (mesmo padrão de
`20260810193545_catalogos_referencia_revoke_default_privileges.sql`), concedendo `INSERT,UPDATE`
em `convite_contrato` a `authenticated` (sem `SELECT` — não há tela de listagem), e anexando
`app.trg_auditoria()` a `convite_contrato` com PK `id_convite`.
**Where**: `supabase/migrations/<timestamp>_convite_contrato_estrutura.sql`
**Depends on**: None
**Reuses**: domínio `texto_limpo`, `app.trg_auditoria()`, predicado `p_por_contrato`
**Requirement**: CVT-02, CVT-03, CVT-04, CVT-05, CVT-07 (guarda camada 1), CVT-11

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `supabase db push` aplica sem erro no projeto **dev** (`npnvoolkebhabjkjzqwn` — confirmado via
  `cat supabase/.temp/project-ref` antes do push)
- [ ] `convite_contrato` e `convite_tentativa` existem com RLS+FORCE habilitados
- [ ] `anon` não tem nenhum GRANT nas duas tabelas (revogado explicitamente)
- [ ] Trigger de auditoria disparando em `convite_contrato` (confirmado no gate check de T2/T3)

**Tests**: none
**Gate**: build

**Commit**: `feat(convite-contrato): cria tabelas convite_contrato e convite_tentativa com RLS`

---

### T2: Migration — `app.emitir_convite` (RPC, `SECURITY INVOKER`)

**What**: Função que invalida (marca `dt_expiracao = now()`) qualquer convite pendente pro mesmo
e-mail+contrato+papel e insere o novo, numa transação; `dt_expiracao` do novo é sempre
`now() + interval '7 days'`, fixo na função. + teste de integração cobrindo: emissão simples,
invalidação de duplicado pendente, rejeição por RLS (usuário sem vínculo/papel_global não
admin/gestora), rejeição por `CHECK` de papel fora de `mentor`/`assessor`.
**Where**: `supabase/migrations/<timestamp>_fn_emitir_convite.sql`,
`supabase/tests/convite/fn-emitir-convite.integration.test.ts`
**Depends on**: T1
**Reuses**: padrão de `0017_fn_substituir_vinculo.sql` (`SECURITY INVOKER`, AD-024); fixture de
sessão de `fn-substituir-vinculo.integration.test.ts`
**Requirement**: CVT-01, CVT-02, CVT-03, CVT-04, CVT-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `app.emitir_convite` é `SECURITY INVOKER` (`prosecdef = false`, testado via `pg_proc` —
  mesmo padrão do teste de T23 de `substituirVinculo`)
- [ ] Emitir convite pro mesmo e-mail+contrato+papel duas vezes: o 1º fica com `dt_expiracao <=
  now()` depois do 2º ser criado
- [ ] Usuário sem vínculo ao contrato e sem papel_global admin/gestora recebe 42501
- [ ] Papel fora de `('mentor','assessor')` é rejeitado por `ck_convite_papel` (23514) antes de
  chegar na lógica da função
- [ ] Gate check passa: `npm run test:unit && npm run test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(convite-contrato): adiciona app.emitir_convite`

---

### T3: Migration — `app.consumir_convite` (RPC, `SECURITY INVOKER`)

**What**: Função que valida o convite (hash, uso, expiração — `SELECT ... FOR UPDATE`), garante
`dim_usuario` (cria se `email` não existir, reusa se existir), insere `rel_usuario_contrato`
(`ON CONFLICT DO NOTHING`, idempotente via `uq_vinculo`), marca `dt_uso = now()`, devolve
`{ id_usuario, conta_nova }`. Guarda redundante: recusa se `papel_no_contrato` fora de
`('mentor','assessor')` (nunca deveria acontecer — defesa em profundidade sobre o `CHECK` de T1).
**Where**: `supabase/migrations/<timestamp>_fn_consumir_convite.sql`,
`supabase/tests/convite/fn-consumir-convite.integration.test.ts`
**Depends on**: T1
**Reuses**: `uq_vinculo` (constraint existente); mesmo padrão de fixture/sign-in de T2

**Requirement**: CVT-06, CVT-07, CVT-08, CVT-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `app.consumir_convite` é `SECURITY INVOKER`
- [ ] Convite válido: cria `dim_usuario` novo (`conta_nova=true`), insere `rel_usuario_contrato`
  com papel/cargo/grau/áreas do convite, marca `dt_uso`
- [ ] Convite com `dt_uso IS NOT NULL`: rejeita sem alterar nada (mensagem "já utilizado")
- [ ] Convite com `dt_expiracao < now()`: rejeita sem alterar nada (mensagem "expirado")
- [ ] E-mail já existente em `dim_usuario` (outro papel_global): não sobrescreve `papel_global`,
  `conta_nova=false`, insere só o novo `rel_usuario_contrato`
- [ ] Reconsumo do mesmo convite (2ª chamada) depois de já usado: rejeita, sem duplicar vínculo
- [ ] Gate check passa: `npm run test:unit && npm run test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(convite-contrato): adiciona app.consumir_convite`

---

### T4: Migration — `app.checar_rate_limit_convite` (RPC, `SECURITY INVOKER`)

**What**: Registra uma tentativa (`INSERT INTO convite_tentativa`) e devolve `true`/`false` se o IP
está dentro do limite (20 tentativas / 15 minutos); faz limpeza leve de linhas fora da janela+1h.
**Where**: `supabase/migrations/<timestamp>_fn_checar_rate_limit_convite.sql`,
`supabase/tests/convite/fn-checar-rate-limit-convite.integration.test.ts`
**Depends on**: T1
**Reuses**: nenhuma lógica existente — mecanismo novo (ver design.md Tech Decisions)
**Requirement**: CVT-10

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] 20 chamadas com o mesmo IP dentro da janela devolvem `true`
- [ ] A 21ª chamada dentro da mesma janela devolve `false`
- [ ] IP diferente não é afetado pelo limite do primeiro
- [ ] Linhas mais antigas que janela+1h são removidas na chamada seguinte
- [ ] Gate check passa: `npm run test:unit && npm run test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(convite-contrato): adiciona app.checar_rate_limit_convite`

---

### T5: Regenerar `database.types.ts`

**What**: `npm run db:types` depois de T1-T4 aplicadas no dev, pra tipar `convite_contrato`,
`convite_tentativa` e os 3 RPCs novos.
**Where**: `src/backend/supabase/database.types.ts`
**Depends on**: T4
**Reuses**: script já existente (`npm run db:types`)
**Requirement**: — (infra, não mapeia a um CVT específico)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `database.types.ts` inclui `convite_contrato`/`convite_tentativa` em `Tables` e os 3 RPCs em
  `Functions` (schema `app`)
- [ ] `npm run build` continua verde depois da regeneração (nenhum outro arquivo referencia o type
  antigo de forma incompatível)

**Tests**: none
**Gate**: build

**Commit**: `chore(convite-contrato): regenera database.types.ts`

---

### T6: `src/backend/lib/convite-token.ts`

**What**: `gerarToken(): string` (32 bytes de entropia via `crypto.getRandomValues`, hex) e
`hashToken(token: string): Promise<string>` (SHA-256 via `crypto.subtle.digest`, hex) — Web Crypto
API, funciona igual no navegador (emissão) e no runtime Node do Route Handler (consumo).
**Where**: `src/backend/lib/convite-token.ts`, `src/backend/lib/convite-token.test.ts`
**Depends on**: None (independente do schema)
**Reuses**: nada — utilitário novo
**Requirement**: CVT-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `gerarToken()` devolve string hex de 64 chars (32 bytes), duas chamadas nunca colidem em
  1000 execuções
- [ ] `hashToken(x)` é determinístico (mesma entrada → mesmo hash) e produz hex de 64 chars (SHA-256)
- [ ] `hashToken` de dois tokens diferentes produz hashes diferentes
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(convite-contrato): adiciona geração e hash de token via Web Crypto`

---

### T7: `src/backend/schemas/convite.ts`

**What**: `convidarSchema` (email, `papel_no_contrato` enum `mentor`/`assessor`, cargo opcional,
grau_responsabilidade, areas) espelhando `ck_convite_*`; `consumirSenhaSchema` (nome, senha,
confirmarSenha com `.refine` de igualdade).
**Where**: `src/backend/schemas/convite.ts`, `src/backend/schemas/convite.test.ts`
**Depends on**: None
**Reuses**: `textoLimpoSchema`, mesmo padrão de refinamento de e-mail de `usuario.ts`
**Requirement**: CVT-01, CVT-07 (validação client-side espelhando a guarda)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `convidarSchema` aceita só `papel_no_contrato IN ('mentor','assessor')` (rejeita
  `admin`/`gestora`/`leitura`)
- [ ] `convidarSchema` rejeita e-mail fora do formato (mesmo padrão de `usuario.test.ts`)
- [ ] `consumirSenhaSchema` rejeita quando `senha !== confirmarSenha`
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(convite-contrato): adiciona schemas Zod de convite`

---

### T8: `src/backend/rpc/convite.ts` (wrapper de emissão) + extensão de `errors.ts`

**What**: `emitirConvite(client, input): Promise<{ url: string }>` — gera token (T6), hasheia,
chama `app.emitir_convite` via `.schema("app").rpc(...)`, monta
`${location.origin}/convite/${token}`. Estende `MENSAGENS_CHECK` em `errors.ts` com
`ck_convite_papel`/`ck_convite_cargo`/`ck_convite_email`.
**Where**: `src/backend/rpc/convite.ts`, `src/backend/rpc/convite.test.ts`,
`src/backend/rpc/errors.ts` (modificado)
**Depends on**: T6, T7
**Reuses**: `mapeiaErroRpc`, padrão de `vinculo.ts`
**Requirement**: CVT-01, CVT-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Sucesso: `rpc()` é chamado com `p_token_hash` = hash do token gerado, `url` devolvida contém
  o token em claro
- [ ] Erro 23514 com `ck_convite_papel` → `ViolacaoConstraintError` com a mensagem nova
- [ ] Erro 42501 → `PermissaoNegadaError` (mesmo mapeamento genérico já existente)
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(convite-contrato): adiciona wrapper emitirConvite`

---

### T9: `src/backend/queries/convite.ts`

**What**: `validarConvite(adminClient, tokenHash): Promise<EstadoConvite>` (single-table read,
sem RPC — devolve `valido`/`invalido`/`expirado`/`usado` + dados do convite quando válido);
`checarRateLimitConvite(adminClient, ip): Promise<boolean>` (wrapper de
`app.checar_rate_limit_convite`).
**Where**: `src/backend/queries/convite.ts`, `src/backend/queries/convite.test.ts`
**Depends on**: T5 (precisa do type de `convite_contrato`)
**Reuses**: padrão de `contrato.ts`/`produto.ts` (client mockado nos testes, mesmo estilo de
`contrato.test.ts`)
**Requirement**: CVT-09, CVT-10

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Token sem linha correspondente → `estado: 'invalido'`
- [ ] Linha com `dt_uso` preenchido → `estado: 'usado'`
- [ ] Linha com `dt_expiracao < now()` → `estado: 'expirado'`
- [ ] Linha válida → `estado: 'valido'` com `idContrato`/`papel`/`cargo`
- [ ] `checarRateLimitConvite` repassa o retorno booleano do RPC
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(convite-contrato): adiciona queries de validação e rate limit`

---

### T10: `src/backend/rpc/consumir-convite.ts` (orquestração do consumo)

**What**: `consumirConvite(deps: { admin: SupabaseClient; server: SupabaseClient }, params: {
tokenHash: string; nome: string; senha: string }): Promise<ResultadoConsumo>` — função de domínio,
testável por injeção de dependência (sem tocar Next.js): (1) checa `dim_usuario` por e-mail do
convite; (2) se não existe, chama `admin.auth.admin.createUser(...)`, ignorando deliberadamente o
erro "already registered"; se existe, pula `createUser` inteiramente; (3) chama
`app.consumir_convite` via `admin` client; (4) se `conta_nova=true`, tenta
`server.auth.signInWithPassword` com a senha submetida. `ResultadoConsumo` é uma union:
`{ tipo: 'sucesso_logado' } | { tipo: 'sucesso_sem_login' } | { tipo: 'erro'; mensagem: string }`.
**Where**: `src/backend/rpc/consumir-convite.ts`, `src/backend/rpc/consumir-convite.test.ts`
**Depends on**: T9
**Reuses**: `mapeiaErroRpc`
**Requirement**: CVT-06, CVT-07, CVT-08, CVT-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `dim_usuario` não existe → chama `createUser` com a senha submetida; RPC confirma
  `conta_nova=true` → tenta `signInWithPassword`; sucesso → `sucesso_logado`
- [ ] `createUser` devolve erro "already registered" (retry de falha parcial) → erro ignorado,
  segue pro RPC do mesmo jeito → `conta_nova=true` → tenta login com a senha atual
- [ ] `dim_usuario` já existe (conta pré-estabelecida) → **nunca chama `createUser` nem
  `signInWithPassword`** → RPC confirma `conta_nova=false` → `sucesso_sem_login`
- [ ] RPC recusa por token invalido/expirado/usado → `erro` com a mensagem correspondente, sem
  nenhuma chamada Admin API
- [ ] `signInWithPassword` falha depois de `conta_nova=true` (ex.: descompasso raro) → ainda
  devolve `sucesso_sem_login`, nunca `erro` (o vínculo já foi criado com sucesso pelo RPC)
- [ ] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(convite-contrato): adiciona orquestração de consumo (consumirConvite)`

---

### T11: `ConviteForm` (componente de emissão)

**What**: Formulário e-mail + papel (`mentor`/`assessor`) + cargo + grau + áreas (RHF + Zod,
`convidarSchema`); ao submeter com sucesso, substitui os campos por um painel mostrando a URL
(com botão "copiar") — nunca reexibida depois de fechado o painel.
**Where**: `src/frontend/components/fundacao/convite-form.tsx`
**Depends on**: T8
**Reuses**: layout/campos de `VinculoForm` modo "adicionar" (`vinculo-form.tsx`)
**Requirement**: CVT-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Campos e-mail/papel/cargo/grau/áreas presentes, validados por `convidarSchema`
- [ ] Sucesso mostra a URL completa + botão copiar; erro mostra `mapeiaErroRpc(...).message`
- [ ] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(convite-contrato): adiciona ConviteForm`

---

### T12: Wire "Convidar por e-mail" em `vinculos/page.tsx`

**What**: Segundo botão ao lado de "Adicionar vínculo", abrindo `ConviteForm` no mesmo painel
inline (`modoAtivo`) já existente.
**Where**: `src/frontend/app/(app)/contratos/[id]/vinculos/page.tsx` (modificado)
**Depends on**: T11
**Reuses**: estrutura existente de `modoAtivo`/painel inline
**Requirement**: CVT-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Botão "Convidar por e-mail" abre `ConviteForm` com `idContrato` da página
- [ ] Fechar o painel (Cancelar/Concluir) não altera a tabela de vínculos (convite não é vínculo)
- [ ] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(convite-contrato): adiciona ação de convidar na tela de vínculos`

---

### T13: `/convite/[token]/page.tsx` (Server Component, pré-sessão)

**What**: Lê `headers()` pro IP, chama `checarRateLimitConvite`; se permitido, hasheia o token
(T6) e chama `validarConvite` (T9); busca contrato via `buscarContratoParaFicha` (client admin)
quando válido; renderiza mensagem de erro específica (rate limit / inválido / expirado / usado) OU
nome do contratante+produto + `ConviteConsumoForm`.
**Where**: `src/frontend/app/convite/[token]/page.tsx`
**Depends on**: T9
**Reuses**: `buscarContratoParaFicha` (`src/backend/queries/contrato.ts`), `createAdminClient`
**Requirement**: CVT-09, CVT-10

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Rate limit excedido → mensagem específica, sem chamar `validarConvite`
- [ ] `estado: 'invalido'|'expirado'|'usado'` → mensagem específica pra cada um (nunca a mesma
  string genérica pros 3)
- [ ] `estado: 'valido'` → mostra nome do contratante + produto (via `buscarContratoParaFicha`) e
  o formulário
- [ ] Fora do route group `(app)/` — sem sidebar (AD-027)
- [ ] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(convite-contrato): adiciona página pré-sessão /convite/[token]`

---

### T14: `ConviteConsumoForm` (client component)

**What**: Campos nome + senha + confirmar senha; validação client-side de "senhas batem" (RHF +
Zod, `consumirSenhaSchema`) antes de permitir o submit nativo — sem `fetch`/JSON, `<form
method="POST" action="/convite/[token]">` real (progressive enhancement).
**Where**: `src/frontend/components/convite-consumo-form.tsx`
**Depends on**: T7
**Reuses**: `<Input type="password">` de `login-form.tsx`
**Requirement**: CVT-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Submit bloqueado no cliente quando senha ≠ confirmar senha, com mensagem clara
- [ ] Submit válido dispara POST nativo pra `/convite/[token]` (verificado por
  inspeção do form gerado, não por teste automatizado — sem infra de componente)
- [ ] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(convite-contrato): adiciona ConviteConsumoForm`

---

### T15: `/convite/[token]/route.ts` (POST, orquestra o consumo)

**What**: Adaptador fino: extrai `token`/`nome`/`senha` do form POST, chama `consumirConvite`
(T10) com `createAdminClient()` + `createClient()` (server), traduz o resultado em redirect —
`sucesso_logado` → `/`; `sucesso_sem_login` → `/login?msg=conta_existente`; `erro` →
`/convite/[token]?erro=<mensagem>`. Checa rate limit de novo antes de processar (defesa em
profundidade, mesma função de T13).
**Where**: `src/frontend/app/convite/[token]/route.ts`
**Depends on**: T10, T14
**Reuses**: padrão de redirect de `admin/acesso/entrar/route.ts`
**Requirement**: CVT-06, CVT-08, CVT-10

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Rate limit excedido no POST → redirect com `?erro=` de limite, sem chamar `consumirConvite`
- [ ] `sucesso_logado` → redirect `/` com sessão ativa (cookie setado pelo `createClient()` server)
- [ ] `sucesso_sem_login` → redirect `/login?msg=conta_existente`
- [ ] `erro` → redirect de volta pra `/convite/[token]?erro=<mensagem>` (nunca 500 pro usuário
  final num caso de erro esperado)
- [ ] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(convite-contrato): adiciona route handler de consumo do convite`

---

### T16: Atualiza comentário de `admin.ts` (Risks & Concerns)

**What**: Atualiza o comentário de `createAdminClient()` pra descrever as duas categorias de uso
hoje (dev-only via `admin/acesso/entrar` E as exceções ativas da AD-010, agora 5 — cita AD-033) em
vez do texto antigo que descrevia só o uso dev-only.
**Where**: `src/backend/supabase/admin.ts` (comentário apenas, sem mudança de código)
**Depends on**: T15
**Reuses**: —
**Requirement**: — (débito de documentação identificado em design.md Risks & Concerns)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Comentário não afirma mais que todo uso é dev-only
- [ ] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `docs(convite-contrato): atualiza comentário de createAdminClient sobre AD-033`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

Phase 1:  T1 ──→ T2 ──→ T3 ──→ T4 ──→ T5
Phase 2:  T6 ──→ T7 ──→ T8 ──→ T9 ──→ T10
Phase 3:  T11 ──→ T12
Phase 4:  T13 ──→ T14 ──→ T15
Phase 5:  T16
```

Execução estritamente sequencial, inline nesta sessão (sem sub-agentes de batch — ver nota no topo).

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | 1 migration (2 tabelas + RLS + grants, tratados juntos por AD-001) | ✅ Granular (coeso — AD-001 exige RLS no mesmo momento do DDL) |
| T2 | 1 função + 1 arquivo de teste | ✅ Granular |
| T3 | 1 função + 1 arquivo de teste | ✅ Granular |
| T4 | 1 função + 1 arquivo de teste | ✅ Granular |
| T5 | 1 comando | ✅ Granular |
| T6 | 1 módulo (2 funções coesas) + teste | ✅ Granular |
| T7 | 1 módulo (2 schemas coesos) + teste | ✅ Granular |
| T8 | 1 wrapper + 1 extensão de arquivo existente + teste | ✅ Granular |
| T9 | 1 módulo (2 funções coesas) + teste | ✅ Granular |
| T10 | 1 função de domínio + teste | ✅ Granular |
| T11 | 1 componente | ✅ Granular |
| T12 | 1 modificação de arquivo | ✅ Granular |
| T13 | 1 página | ✅ Granular |
| T14 | 1 componente | ✅ Granular |
| T15 | 1 route handler | ✅ Granular |
| T16 | 1 comentário | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | (início da Fase 1, sem seta de entrada) | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T1 | T1 → T2 → T3 (sequencial na fase) | ✅ Match |
| T4 | T1 | T3 → T4 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | None | (início da Fase 2) | ✅ Match |
| T7 | None | T6 → T7 (sequencial na fase, sem dependência real de dado — ordem de leitura) | ✅ Match |
| T8 | T6, T7 | T7 → T8 | ✅ Match |
| T9 | T5 | T8 → T9 (sequencial na fase; dependência real é T5, cruza fase — permitido, aponta pra trás) | ✅ Match |
| T10 | T9 | T9 → T10 | ✅ Match |
| T11 | T8 | (início da Fase 3; dependência real T8, fase anterior) | ✅ Match |
| T12 | T11 | T11 → T12 | ✅ Match |
| T13 | T9 | (início da Fase 4; dependência real T9, fase anterior) | ✅ Match |
| T14 | T7 | T13 → T14 (sequencial na fase; dependência real T7, fase anterior) | ✅ Match |
| T15 | T10, T14 | T14 → T15 | ✅ Match |
| T16 | T15 | (início da Fase 5) | ✅ Match |

Nenhuma dependência aponta pra uma fase posterior — todas apontam pra trás ou dentro da mesma fase.

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | DDL puro | none | none | ✅ OK |
| T2 | Postgres RPC (`app.emitir_convite`) | integration | integration | ✅ OK |
| T3 | Postgres RPC (`app.consumir_convite`) | integration | integration | ✅ OK |
| T4 | Postgres RPC (`app.checar_rate_limit_convite`) | integration | integration | ✅ OK |
| T5 | infra (types) | — | none | ✅ OK |
| T6 | `convite-token.ts` | unit | unit | ✅ OK |
| T7 | `schemas/convite.ts` | unit | unit | ✅ OK |
| T8 | `rpc/convite.ts` | unit | unit | ✅ OK |
| T9 | `queries/convite.ts` | unit | unit | ✅ OK |
| T10 | `rpc/consumir-convite.ts` | unit | unit | ✅ OK |
| T11 | `ConviteForm` | none | none | ✅ OK |
| T12 | `vinculos/page.tsx` (modificado) | none | none | ✅ OK |
| T13 | `/convite/[token]/page.tsx` | none | none | ✅ OK |
| T14 | `ConviteConsumoForm` | none | none | ✅ OK |
| T15 | `/convite/[token]/route.ts` | none | none | ✅ OK |
| T16 | comentário | — | none | ✅ OK |

Nenhuma violação — todo layer com teste exigido pela matriz tem o teste na própria task
(nunca "testado em outra task").
