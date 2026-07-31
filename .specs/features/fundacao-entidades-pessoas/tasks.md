# Fundação — entidades & pessoas Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/fundacao-entidades-pessoas/design.md`
**Status**: Approved

---

## Note on Phase 0

Fase 0 não é escopo de Fundação — é a fatia mínima de **Plataforma** (PLT-01/PLT-03) que a fase Design identificou como bloqueante: sem ela, nenhuma política de RLS desta feature é testável (a sessão `app.id_usuario()`/`app.papel_atual()` e os 5 ROLES de GRANT do schema não têm ligação com o Supabase Auth hoje). Decisão do usuário: incluir aqui, não pausar para especificar Plataforma à parte. Não cobre PLT-02 (log já existe via trigger aprovado) nem PLT-04 (impersonação do Admin) — ambos fora desta feature.

---

## Test Coverage Matrix

> Gerada a partir do design.md e da escolha do usuário (Vitest unitário + integração contra Supabase real; sem E2E nesta v1). Nenhum guideline de projeto encontrado (`AGENTS.md`/`CLAUDE.md`/`CONTRIBUTING.md`/config de teste — nenhum existe; projeto greenfield). Defaults fortes aplicados.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------- | --------------------- | ----------------- | ------------ |
| Migrações / funções `app.*` / RLS / GRANTs / triggers | integration | 1:1 com os ACs do spec que dependem de cada função/política (FND-TSE-02/04, FND-USR-05/07, duplicata, troca de vigente, RLS por papel); todo edge case listado no spec tem teste | `supabase/tests/**/*.integration.test.ts` | `npm run test:integration` |
| Zod schemas (`src/backend/schemas/**`) | unit | 1:1 por CHECK/domínio espelhado; todo edge case de validação do spec | `src/backend/schemas/**/*.test.ts` | `npm run test:unit` |
| RPC wrappers / queries (`src/backend/rpc/**`, `src/backend/queries/**`) | unit | Mapeamento de erro (ERRCODE→mensagem) e formatação de input, com cliente Supabase mockado | `src/backend/rpc/**/*.test.ts`, `src/backend/queries/**/*.test.ts` | `npm run test:unit` |
| Tipos compostos, config, scaffold (`src/backend/types/**`, configs) | none | — (build gate only) | — | build gate only |
| Componentes/páginas de frontend (`src/frontend/**`) | none | Sem E2E nesta v1 (escolha explícita do usuário) — build+lint garantem que compila e tipa | — | build gate only |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Depois de tasks só com teste unitário (Zod, RPC wrappers, queries) | `npm run test:unit` |
| Full | Depois de tasks que tocam migração, função Postgres, RLS, GRANT ou trigger | `npm run test:unit && npm run test:integration` (requer `supabase start` rodando localmente) |
| Build | Depois de completar uma fase, ou tasks só de componente/config/tipo | `npm run lint && npm run build` |

---

## Execution Plan

Phases are ordered and run sequentially — each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 0: Plataforma mínima — sessão e RBAC (pré-requisito)

```
T1 → T2 → T3 → T4 → T5
```

### Phase 1: Bootstrap do projeto

```
T6 → T7 → T8 → T9
```

### Phase 2: Migração de schema — Fundação

```
T10 → T11 → T12 → T13 → T14 → T15 → T16 → T17 → T18 → T19
```

### Phase 3: Funções RPC de negócio

```
T20 → T21 → T22 → T23
```

### Phase 4: Camada backend TypeScript

```
T24 → T25 → T26 → T27 → T28
```

### Phase 5: Componentes de frontend

```
T29 → T30 → T31 → T32 → T33 → T34 → T35 → T36 → T37
```

---

## Task Breakdown

### T1: Função `app.custom_access_token_hook` (claim `role`)

**What**: Criar função Postgres `app.custom_access_token_hook(event jsonb) RETURNS jsonb` que resolve `dim_usuario.papel_global` pelo e-mail do evento e injeta a claim `role` (`legisla_admin`/`legisla_gestora`/`legisla_mentor`/`legisla_assessor`; `legisla_app` se não houver `dim_usuario` ativo com esse e-mail).
**Where**: `supabase/migrations/0001_plataforma_auth_hook.sql`
**Depends on**: None
**Reuses**: `dim_usuario.papel_global`/`email` (`docs/schema_sistema.sql:309-321`)
**Requirement**: N/A — infraestrutura de Plataforma (PLT-01), pré-requisito de todo requisito FND-*

**Tools**:
- MCP: NONE
- Skill: `supabase`

**Done when**:
- [x] Função criada com `SECURITY DEFINER SET search_path = public, pg_temp`
- [x] Retorna `legisla_app` quando não encontra `dim_usuario` ativo pelo e-mail
- [x] Retorna `legisla_<papel_global>` quando encontra
- [x] Gate check passa: `npm run test:integration`

**Tests**: integration
**Gate**: full

**Status**: ✅ Complete — commit `0884255`. Renumerado para `0002_plataforma_auth_hook.sql` (0001 ocupado pelo pré-requisito `dim_usuario`/funções de sessão — ver commit `c1a20d7`).

---

### T2: Função `app.pre_request` (`SET app.id_usuario`)

**What**: Criar função Postgres `app.pre_request() RETURNS void` que resolve `dim_usuario.id_usuario` pelo e-mail do JWT (`request.jwt.claims`) e grava via `set_config('app.id_usuario', ..., true)`.
**Where**: `supabase/migrations/0002_plataforma_pre_request.sql`
**Depends on**: T1
**Reuses**: `app.id_usuario()`/`app.papel_atual()` já aprovadas (`docs/schema_sistema.sql:1451-1461`)
**Requirement**: N/A — infraestrutura de Plataforma (PLT-01)

**Tools**:
- MCP: NONE
- Skill: `supabase`

**Done when**:
- [x] Função criada com `SECURITY DEFINER SET search_path = public, pg_temp`
- [x] Sem e-mail no JWT ou sem `dim_usuario` correspondente: não grava nada (não derruba a requisição)
- [x] Com match: `current_setting('app.id_usuario', true)` retorna o `id_usuario` correto na mesma transação
- [x] Gate check passa: `npm run test:integration`

**Tests**: integration
**Gate**: full

**Status**: ✅ Complete — commit `4366b1a`. Renumerado para `0003_plataforma_pre_request.sql` (ver nota em T1).

---

### T3: Aplicar os 5 ROLES e GRANTs já aprovados

**What**: Extrair e aplicar a fatia de `docs/schema_sistema.sql:2061-2104` (criação de `legisla_app`/`legisla_admin`/`legisla_gestora`/`legisla_mentor`/`legisla_assessor` e os GRANTs por papel) e conceder `GRANT legisla_admin, legisla_gestora, legisla_mentor, legisla_assessor, legisla_app TO authenticator` para o PostgREST poder trocar de papel.
**Where**: `supabase/migrations/0003_plataforma_roles_grants.sql`
**Depends on**: T2
**Reuses**: `docs/schema_sistema.sql:2061-2104` (verbatim, sem redesenho — AD-008)
**Requirement**: N/A — infraestrutura de Plataforma (PLT-01)

**Tools**:
- MCP: NONE
- Skill: `supabase`, `supabase-postgres-best-practices`

**Done when**:
- [x] Os 5 ROLES existem (`CREATE ROLE ... NOLOGIN` idempotente, como no schema aprovado)
- [x] GRANTs aplicados exatamente como especificado no schema aprovado — escopado ao que existe hoje (ver SPEC_DEVIATION no arquivo de migração; tabelas de Planejamento/Incidência/Operação e schema `tse` ainda não existem)
- [x] `authenticator` tem membership nos 5 papéis
- [x] Gate check passa: `npm run test:integration`

**Tests**: integration
**Gate**: full

**Status**: ✅ Complete — commit `12611cc`. Renumerado para `0004_plataforma_roles_grants.sql` (ver nota em T1).

---

### T4: Registrar Auth Hook e `db-pre-request` na config do Supabase

**What**: Registrar `app.custom_access_token_hook` como Custom Access Token Hook e `app.pre_request` como `db-pre-request` — em `supabase/config.toml` (dev local) e documentar o passo equivalente no Dashboard para o projeto remoto (`mgoeloqdlpgkofgqqbjs`).
**Where**: `supabase/config.toml`
**Depends on**: T3
**Reuses**: —
**Requirement**: N/A — infraestrutura de Plataforma (PLT-01)

**Tools**:
- MCP: NONE
- Skill: `supabase`

**Done when**:
- [x] `supabase/config.toml` referencia `app.custom_access_token_hook` em `[auth.hook.custom_access_token]`
- [x] `supabase/config.toml` referencia `app.pre_request` em `db-pre-request` — SPEC_DEVIATION: não existe chave de config.toml para este hook (confirmado contra a doc de referência do CLI e do PostgREST); registrado via `ALTER ROLE authenticator SET pgrst.db_pre_request` em `0005_plataforma_pre_request_wiring.sql`, com comentário cruzado em config.toml
- [x] Passo equivalente para o Dashboard remoto documentado em comentário no próprio arquivo
- [x] Gate check — `npm run lint`/`npm run build` ainda não existem (T6-T9 os criam, na Fase 1 seguinte); config.toml não é JS/TS então nenhum dos dois o tocaria de qualquer forma. Verificação real usada: `supabase config push` (mostra diff aplicado + convergência para "up_to_date") e `supabase db push` para a migração de wiring, ambos confirmados. Revalidado com `npm run lint && npm run build` reais ao final de T9.

**Tests**: none
**Gate**: build

**Status**: ✅ Complete — commit `9b00688`.

---

### T5: Teste de integração de sessão fim-a-fim (4 papéis)

**What**: Criar 1 usuário de teste por papel (Gestora, Mentor, Assessor, Admin) no ambiente de teste, autenticar cada um, e confirmar que `app.papel_atual()`/`app.id_usuario()` resolvem certo e que SELECT/INSERT respeitam RLS+GRANT esperados para cada papel.
**Where**: `supabase/tests/plataforma/sessao.integration.test.ts`
**Depends on**: T4
**Reuses**: —
**Requirement**: N/A — valida a Fase 0 como um todo; pré-requisito de toda task de integração das fases seguintes

**Tools**:
- MCP: NONE
- Skill: `supabase`

**Done when**:
- [x] 4 usuários de teste criados (um por `papel_global`)
- [x] Para cada um: `app.papel_atual()` retorna o papel esperado após autenticar
- [x] Assessor não consegue `SELECT` em tabela negada por GRANT (ex.: `log_auditoria` — ver SPEC_DEVIATION no arquivo de teste: usa `dim_usuario` no lugar, `log_auditoria` é Fase 2/T13, fora deste batch)
- [x] Gate check passa: `npm run test:integration`
- [x] Test count: 4+ testes (um por papel, mínimo) passam — 7 testes no arquivo, 23/23 no gate combinado da Fase 0 (T1+T2+T3+T5)

**Tests**: integration
**Gate**: full

**Status**: ✅ Complete — commit `7e29ed1`. Gate combinado da Fase 0 (`npm run test:integration` rodando T1+T2+T3+T5 juntos) confirmado limpo: 4 arquivos, 23/23 testes. Duas correções de robustez de infra de teste feitas para isso (ambas no mesmo commit): (1) `sessao.integration.test.ts` fazia `beforeAll` sem limpar usuários Auth de uma execução isolada anterior que não chegou ao `afterAll` (interrompida por uma falha transiente 502 do Cloudflare na Management API do projeto remoto) — passou a listar e apagar por e-mail antes de criar, tornando a suíte idempotente entre execuções; (2) `supabase/tests/helpers/sql.ts` teve o retry de `runSql` endurecido (3→4 tentativas, backoff exponencial 2s/4s/8s ao invés de 1.5s fixo) depois que o mesmo 502 transiente da Management API derrubou 2 testes de `auth-hook.integration.test.ts` no meio do gate combinado — confirmado como falha de infra externa (Cloudflare `retryable: true`), não bug de código, revalidado re-executando a query manualmente após esperar o `retry_after`. Nenhuma asserção foi enfraquecida.

---

### T6: Inicializar Next.js (App Router + TypeScript + Tailwind)

**What**: Inicializar o projeto Next.js em `src/frontend` com App Router, TypeScript estrito e Tailwind CSS configurados.
**Where**: `src/frontend/`
**Depends on**: None
**Reuses**: —
**Requirement**: N/A — infraestrutura (AD-021)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `src/frontend/app/layout.tsx` e `src/frontend/app/page.tsx` existem e renderizam
- [x] Tailwind configurado e aplicando estilo numa página de teste
- [x] `tsconfig.json` com `strict: true`
- [x] Gate check passa: `npm run build` (após T9 configurar o script — nesta task, `next build` direto)

**Tests**: none
**Gate**: build

**Status**: ✅ Complete — commit `7f873d9`. `create-next-app` (App Router, TS estrito, Tailwind v4, ESLint) inicializado em `src/frontend` como projeto Next próprio (seu próprio `package.json`/lockfile, coerente com o root `package.json` cuidando só do Vitest da suíte de teste — ver T9). `npx next build` direto confirmado limpo (Turbopack). SPEC_DEVIATION: adicionado `turbopack.root` em `next.config.ts` para o build parar de inferir a raiz errada do workspace (o `package-lock.json` da raiz do monorepo, não deste app) — sem isso o build funcionava mas emitia um warning de lockfile duplicado a cada execução.
>
> **Atualização (T8)**: o modelo "projeto Next standalone com lockfile próprio" descrito acima foi substituído por um npm workspace (`src/frontend` como membro do `package.json` raiz) — necessário para `src/backend/**` (T8) ser importável a partir do frontend. `turbopack.root` foi removido (não é mais necessário, só existe 1 lockfile agora). Ver SPEC_DEVIATION completo em T8. Nenhum Done-when de T6 foi violado — build continua limpo.

---

### T7: Instalar e configurar shadcn/ui (componentes base)

**What**: Instalar shadcn/ui e gerar os componentes base necessários às telas desta feature: `button`, `input`, `select`, `dialog`, `table`, `form`, `label`, `badge`.
**Where**: `src/frontend/components/ui/**`
**Depends on**: T6
**Reuses**: —
**Requirement**: N/A — infraestrutura (AD-021)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `components.json` do shadcn/ui presente e apontando para `src/frontend`
- [x] Os 8 componentes base gerados e importáveis sem erro de tipo
- [x] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Status**: ✅ Complete — commit `7c74774`. `components/ui/{button,input,select,dialog,table,label,badge}.tsx` gerados via `shadcn add` (estilo `radix-nova`, pacote consolidado `radix-ui`). SPEC_DEVIATION: `shadcn add form` retorna um item de registry vazio (só `name`/`type`, sem `files`) tanto no preset "base" quanto no "radix" — confirmado com `shadcn view @shadcn/form`, mesmo resultado nos dois; bug do lado do registry hospedado (shadcn CLI 4.16.0), não algo corrigível trocando flag local. `components/ui/form.tsx` escrito à mão seguindo o padrão clássico e amplamente documentado do shadcn/ui (react-hook-form + Radix Slot/Label), adaptado ao import consolidado `radix-ui` já usado pelos outros componentes gerados neste mesmo projeto (`Slot.Root` em vez de `@radix-ui/react-slot` avulso). Verificado: página de verificação descartável importando e renderizando os 8 componentes juntos, `npx tsc --noEmit` limpo (exit 0) e `npx next build` limpo; página removida após a verificação (não faz parte do entregável de T7 — telas reais vêm em T29+).

---

### T8: Cliente Supabase tipado (`@supabase/ssr`)

**What**: Criar os clientes Supabase tipados de browser e servidor (`@supabase/ssr`) e `.env.example` com `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` vazios.
**Where**: `src/backend/supabase/client.ts`, `src/backend/supabase/server.ts`, `.env.example`
**Depends on**: T6
**Reuses**: —
**Requirement**: N/A — infraestrutura (AD-009, AD-011, AD-020)

**Tools**:
- MCP: NONE
- Skill: `supabase`

**Done when**:
- [x] Cliente de browser e de servidor exportados, ambos tipados por `Database` (placeholder até T24 gerar os tipos reais)
- [x] `.env.example` sem nenhum valor real, só `service_role`/segredo nunca presente (AD-009)
- [x] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Status**: ✅ Complete — commit `38ece3d`. `src/backend/supabase/client.ts` (browser, `createBrowserClient`) e `server.ts` (Server Components/Actions, `createServerClient` + `next/headers` cookies), ambos tipados por `Database` de `src/backend/supabase/database.types.ts` (placeholder — `Record<string, never>` em todas as seções — até T24 rodar `supabase gen types typescript`). `.env.example` já existia com o formato certo desde o bootstrap de T1 (01c0e54) — nenhuma mudança necessária.

SPEC_DEVIATION (infra, não muda nenhum "Where"/Done-when de T6/T7): `src/frontend` virou membro de npm workspace do `package.json` raiz (`"workspaces": ["src/frontend"]`), em vez de projeto Next standalone com lockfile próprio como T6/T7 haviam deixado. Motivo: o design (linha 68, "Dependencies: cliente Supabase tipado src/backend/supabase/client.ts") exige que `src/frontend` importe `src/backend/**` diretamente — com dois `node_modules` isolados e sem relação de ancestralidade, `next/headers` (usado por `server.ts`, vive só no `node_modules` do frontend) nunca resolveria a partir de `src/backend` (resolução Node só sobe por ancestrais, nunca olha diretórios irmãos). Convertido para workspace: um único `node_modules`/lockfile na raiz, hoisted, ancestral de `src/frontend` E de `src/backend`. Isso também eliminou o workaround de `turbopack.root` que T6 havia adicionado (o aviso de "múltiplos lockfiles" desapareceu por completo, já que agora só existe um). Adicionado alias `@backend/*` em `src/frontend/tsconfig.json` apontando para `../backend/*`. Verificado com página descartável importando `@backend/supabase/{client,server}` (sem invocar as funções, só checagem de tipo via `ReturnType`/`Awaited`, para não disparar acesso a env var ausente durante o prerender do build) — `npx tsc --noEmit` e `npx next build` limpos; página removida após a verificação. `npm run test:unit`/`test:integration` (T1-T5) reconferidos funcionando após a reinstalação como workspace.

---

### T9: Scripts npm e configs de teste/lint/build

**What**: Configurar `package.json` com os scripts `lint`, `build`, `test:unit` (Vitest), `test:integration` (Vitest contra Supabase local), `db:start` (`supabase start`), `db:types`; criar `vitest.config.ts` e `vitest.integration.config.ts`.
**Where**: `package.json`, `vitest.config.ts`, `vitest.integration.config.ts`, `.eslintrc*`
**Depends on**: T7, T8
**Reuses**: —
**Requirement**: N/A — infraestrutura (decisão de teste do usuário: unit + integration, sem E2E)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `npm run lint`, `npm run build` executam sem erro num projeto vazio
- [x] `npm run test:unit` executa (0 testes, sem falha) contra `src/backend/**/*.test.ts`
- [x] `npm run test:integration` executa (0 testes, sem falha) contra `supabase/tests/**/*.integration.test.ts`
- [x] Gate check passa: `npm run lint && npm run build`

**Tests**: none
**Gate**: build

**Status**: ✅ Complete — commit `060420e`. Adicionados ao `package.json` raiz: `lint` (`eslint .` sobre `src/backend`/`supabase/tests`/configs + delega para `npm run lint --workspace=frontend`), `build` (delega para `npm run build --workspace=frontend`), `db:start` (`supabase start`), `db:types` (`supabase gen types typescript --linked > src/backend/supabase/database.types.ts` — T24 só precisa rodar `npm run db:types`, não recriar o script). `vitest.config.ts`/`vitest.integration.config.ts` já existiam corretos desde o bootstrap de T1 (01c0e54) — nenhuma mudança necessária, só reconfirmados pelo gate.

SPEC_DEVIATION: "projeto vazio" e "0 testes" no Done-when descrevem o estado esperado se T9 rodasse antes da Fase 0 — mas a ordem real da Execution Plan é T1→...→T9, então ao chegar aqui `test:integration` já tem 23 testes reais (T1/T2/T3/T5) passando, não 0; e `lint`/`build` já cobrem código real (T6-T8), não um projeto vazio. Interpretado como: os comandos rodam limpos dado o que existe agora — mais forte que o caso vazio original, não mais fraco. `.eslintrc*` (formato legado) citado no "Where" foi substituído por `eslint.config.mjs` (flat config), formato exigido pelo ESLint 9 já em uso pelo template do Next (T6); nenhum `.eslintrc*` funcionaria com essa versão. Confirmado: `npm run lint` (exit 0), `npm run build` (exit 0, Turbopack limpo), `npm run test:unit` (0 testes, exit 0), `npm run test:integration` (23/23, exit 0).

---

### T10: Introspectar Supabase remoto — o que já existe

**What**: Rodar introspecção (`supabase db diff`/`db pull`) contra o projeto remoto (`mgoeloqdlpgkofgqqbjs`) e registrar em `supabase/migrations/README.md` quais das tabelas/funções de Fundação já estão provisionadas (AD-025) — para as tasks seguintes só criarem o que falta.
**Where**: `supabase/migrations/README.md`
**Depends on**: T5, T9
**Reuses**: —
**Requirement**: N/A — infraestrutura (AD-025)

**Tools**:
- MCP: NONE
- Skill: `supabase`

**Done when**:
- [x] Lista escrita com cada tabela/função de Fundação (catálogos dependentes, Plataforma, Fundação, âncora, TSE, `rel_mandato_candidatura`) marcada como "existe" ou "falta criar"
- [x] Gate check passa: `npm run lint`

**Tests**: none
**Gate**: build

**Status**: ✅ Complete — commit `d350946`. Confirmado via `supabase migration list` (local/remoto sincronizados em 0001-0005) e queries diretas em `pg_catalog`/`pg_extension`: só `dim_usuario`, `unaccent`, schema `app` e suas 6 funções existem hoje; tudo mais listado em `supabase/migrations/README.md` falta criar. Nenhuma colisão esperada nas próximas migrações.

---

### T11: Migração — extensões e helpers imutáveis

**What**: Aplicar (só o que faltar, conforme T10) `unaccent`, `btree_gin`, `pg_trgm` (nova — necessária para T18), os schemas `app`/`tse`/`stg`, `app.f_unaccent`, `app.normaliza_nome` e o domínio `texto_limpo`.
**Where**: `supabase/migrations/0004_extensoes_helpers.sql`
**Depends on**: T10
**Reuses**: `docs/schema_sistema.sql:84-125` (verbatim, exceto `pg_trgm` que é novo)
**Requirement**: N/A — pré-requisito de FND-TSE (busca por nome) e de deduplicação de contratante

**Tools**:
- MCP: NONE
- Skill: `supabase`, `supabase-postgres-best-practices`

**Done when**:
- [x] Extensões (`unaccent`, `btree_gin`, `pg_trgm`) instaladas
- [x] `app.f_unaccent`, `app.normaliza_nome` e domínio `texto_limpo` existem e rejeitam os sentinelas listados no schema
- [x] Gate check passa: `npm run test:integration`

**Tests**: integration
**Gate**: full

**Status**: ✅ Complete — commit `f922092`. Renumerado para `0006_extensoes_helpers.sql` (0001-0005 ocupados pelo pré-requisito + Batch 1). Migração já estava empurrada para o remoto antes da correção de disciplina desta sessão; teste isolado (20/20) e gate combinado (`npm run test:integration`, Batch 1 + T11, 6 arquivos/49 testes) confirmados limpos após dois fixes de infraestrutura de teste descobertos durante a implementação: (1) drift real no domínio `texto_limpo` já provisionado (só 2 dos 12 sentinelas aprovados estavam no CHECK ativo) — corrigido via `ALTER DOMAIN ... DROP/ADD CONSTRAINT` idempotente; (2) bug no helper compartilhado `supabase/tests/helpers/sql.ts` (`runSql`) que só expunha `.message` genérico do erro, nunca o texto real do erro Postgres (que vive em `.stdout`), e que retriava erros SQL determinísticos (ex.: violação de CHECK) 4x com backoff exponencial como se fossem transitórios, arriscando o timeout de 30s do teste — corrigido para expor `.stdout` e falhar rápido em "unexpected status 400" (erro determinístico), retriando só falhas genuinamente transitórias (ex.: Cloudflare 502, confirmado ocorrendo nesta mesma sessão).

---

### T12: Migração — catálogos dependentes + seeds

**What**: Aplicar (só o que faltar) `ref_produto`, `ref_projeto`, `ref_cargo`, `ref_partido`, com os seeds já definidos em `docs/schema_sistema.sql` §16 relevantes a estes 4 catálogos.
**Where**: `supabase/migrations/0005_catalogos_fundacao.sql`
**Depends on**: T11
**Reuses**: `docs/schema_sistema.sql:132-168` (DDL) + seeds correspondentes em §16
**Requirement**: N/A — pré-requisito de FND-CTR (produto/projeto), FND-TSE/mandato (cargo/partido)

**Tools**:
- MCP: NONE
- Skill: `supabase`

**Done when**:
- [x] As 4 tabelas existem com os CHECKs/UNIQUEs do schema aprovado
- [x] Seeds aplicados (produto, ao menos Estratégia/PLL/Coalizão; cargos com `nivel_federativo`)
- [x] Gate check passa: `npm run test:integration`

**Tests**: integration
**Gate**: full

**Status**: ✅ Complete — commit `51e160c`. Renumerado para `0007_catalogos_fundacao.sql` (ver nota de renumeração em T11). Gate combinado (Batch 1 + T11 + T12): 6 arquivos, 49/49 testes.

---

### T13: Migração — Plataforma (`dim_usuario`, `rel_usuario_contrato`, `log_auditoria`)

**What**: Aplicar (só o que faltar) as 3 tabelas de Plataforma, incluindo a partição de `log_auditoria` (`app.cria_particoes_log`).
**Where**: `supabase/migrations/0006_plataforma_tabelas.sql`
**Depends on**: T12
**Reuses**: `docs/schema_sistema.sql:309-384` (verbatim)
**Requirement**: FND-USR-01 a 08 (pré-requisito direto)

**Tools**:
- MCP: NONE
- Skill: `supabase`

**Done when**:
- [x] As 3 tabelas existem com CHECKs (`ck_usuario_papel`, `ck_vinculo_papel`, `ck_vinculo_cargo`, `ck_vinculo_periodo`) e `uq_vinculo`
- [x] Partições de `log_auditoria` criadas para os próximos 18 meses
- [x] Gate check passa: `npm run test:integration`

**Tests**: integration
**Gate**: full

**Status**: ✅ Complete — commit `5fabd80`. Renumerado para `0008_plataforma_tabelas.sql`. Bug real corrigido nesta sessão: o teste de `uq_vinculo` usava um `id_contrato` hardcoded/inexistente (888888), o que quebrava com `fk_vinculo_contrato` (adicionada só em T14) ativa — reescrito contra um fixture real de `fat_contrato`, movido para `beforeAll`/`afterAll` para não estourar o timeout de 30s do teste. Gate combinado (Batch 1 + T11-T13): 7 arquivos, 57/57 testes.

---

### T14: Migração — Fundação e âncora

**What**: Aplicar (só o que faltar) `dim_contratante`, `dim_mandato`, `dim_coalizao`, `fat_contrato`, `rel_coalizao_membro`.
**Where**: `supabase/migrations/0007_fundacao_tabelas.sql`
**Depends on**: T13
**Reuses**: `docs/schema_sistema.sql:391-512` (verbatim)
**Requirement**: FND-TSE-01 a 06, FND-CTR-01 a 05, FND-COL-01 a 06

**Tools**:
- MCP: NONE
- Skill: `supabase`

**Done when**:
- [x] As 5 tabelas existem com todos os CHECKs/UNIQUEs do schema aprovado (`ck_contratante_tipo`, `ck_mandato_titulo`, `ck_contrato_status`, `ck_contrato_motivo`, `ck_membro_papel`, `ck_membro_grupo`, etc.)
- [x] `ix_contratante_nome_norm` existe (suporte à checagem de duplicata)
- [x] Gate check passa: `npm run test:integration`

**Tests**: integration
**Gate**: full

**Status**: ✅ Complete — commit `791cdc8`. Renumerado para `0009_fundacao_tabelas.sql`. Não existia teste algum para esta task — escrito do zero nesta sessão (18 casos), cobrindo todos os CHECKs/UNIQUEs nomeados no Done-when e os não-nomeados (`ck_contratante_uf`, `ck_mandato_raca`/`origem`, `ck_contrato_profundidade`/`periodo`/`nao_e_proprio_anterior`, `ck_membro_periodo`, as 3 UNIQUEs), por conta do "todos os CHECKs/UNIQUEs" do Done-when. Gate combinado (Batch 1 + T11-T14): 8 arquivos, 75/75 testes.

---

### T15: Migração — schema TSE + `rel_mandato_candidatura`

**What**: Aplicar (só o que faltar) as 4 tabelas particionadas de `tse`, `tse.mv_candidatura_resumo` e `rel_mandato_candidatura`.
**Where**: `supabase/migrations/0008_tse_e_candidatura.sql`
**Depends on**: T14
**Reuses**: `docs/schema_sistema.sql:521-700` (verbatim)
**Requirement**: FND-TSE-01 a 06, FND-TSM-01/02

**Tools**:
- MCP: NONE
- Skill: `supabase`

**Done when**:
- [x] As 4 tabelas TSE (com partições 2022/2024/outras) e a MV existem
- [x] `rel_mandato_candidatura` existe com `uq_mandato_candidatura`, `uq_mandato_candidatura_vigente` (índice único parcial) e os CHECKs de método/confiança/status
- [x] Gate check passa: `npm run test:integration`

**Tests**: integration
**Gate**: full

**Status**: ✅ Complete — commit `dacc378`. Renumerado para `0010_tse_e_candidatura.sql`. Gate combinado (Batch 1 + T11-T15): 9 arquivos, 83/83 testes. Duas execuções desta sessão pegaram 502 transitório do Cloudflare na Management API (em testes já commitados, não relacionados) — confirmado como flake reexecutando os arquivos isolados e a suíte completa de novo, limpa.

---

### T16: Aplicar RLS já aprovada nas tabelas de Fundação

**What**: Extrair e aplicar a fatia de `docs/schema_sistema.sql:1615-1656` (funções `app.papel_atual()`/`app.contratos_do_usuario()`, políticas `p_usuario`, `p_vinculo_proprio`, `p_por_carteira` sobre `dim_contratante`/`dim_mandato`/`dim_coalizao`/`rel_mandato_candidatura`/`fat_contrato`, e o loop genérico que cobre `rel_coalizao_membro`).
**Where**: `supabase/migrations/0009_fundacao_rls.sql`
**Depends on**: T15
**Reuses**: `docs/schema_sistema.sql:1451-1473, 1615-1656` (verbatim — política já aprovada, não redesenhada)
**Requirement**: AD-001, AD-002 (todo requisito FND-* depende de RLS ativa)

**Tools**:
- MCP: NONE
- Skill: `supabase`, `supabase-postgres-best-practices`

**Done when**:
- [x] `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` em todas as tabelas de Fundação
- [x] Cada política aplicada exatamente como no schema aprovado
- [x] Gate check passa: `npm run test:integration` (usando a sessão de T5)

**Tests**: integration
**Gate**: full

**Status**: ✅ Complete — commit `1138ab4`. Renumerado para `0011_fundacao_rls.sql`. Dois bugs reais corrigidos nesta sessão: (1) a fixture do teste faz ~14 round-trips sequenciais de `runSql`, estourando o `hookTimeout` global de 30s (`beforeAll`/`afterAll` aumentados para 180s, timeout casado com o round-trip real); (2) o GRANT de `legisla_mentor` da própria migração cobria só `fat_contrato`/`dim_contratante`/`dim_mandato` — `dim_coalizao`, `rel_mandato_candidatura` e `rel_coalizao_membro` tinham RLS mas nenhum GRANT, então mentor recebia `42501` independente da política; estendido para as 6 tabelas com RLS nova + `rel_usuario_contrato` (já prevista no GRANT de mentor do schema aprovado, nunca concedida por nenhuma task anterior). Gate combinado (Batch 1 + T11-T16): 10 arquivos, 89/89 testes.

---

### T17: Estender auditoria a `dim_contratante`, `dim_coalizao`, `rel_coalizao_membro`

**What**: Adicionar `trg_audit_*` (reusando `app.trg_auditoria()` já aprovada) para as 3 tabelas que ficaram fora do loop original do schema — gap decidido com o usuário como aditivo, não redesenho.
**Where**: `supabase/migrations/0010_fundacao_auditoria_gap.sql`
**Depends on**: T16
**Reuses**: `app.trg_auditoria()` (`docs/schema_sistema.sql:1674-1710`) — mesma função, sem alteração
**Requirement**: AD-006 (toda escrita guarda autor e timestamp)

**Tools**:
- MCP: NONE
- Skill: `supabase`

**Done when**:
- [x] `trg_audit_dim_contratante`, `trg_audit_dim_coalizao`, `trg_audit_rel_coalizao_membro` criados com a mesma assinatura do padrão existente (PK correta por tabela)
- [x] INSERT/UPDATE/DELETE nas 3 tabelas gera linha em `log_auditoria`
- [x] Gate check passa: `npm run test:integration`

**Tests**: integration
**Gate**: full

**Scope adicional descoberto na revisão desta sessão (não estava no "What" original)**: o loop de trigger já aprovado (`docs/schema_sistema.sql:1712-1732`) também cobre `fat_contrato`, `dim_mandato`, `rel_usuario_contrato` e `rel_mandato_candidatura` — as 4 já criadas em escopo por T13/T14/T15 — e nenhuma task de T10-T19 aplicava essa fatia. Deixar de fora violaria AD-006 para as tabelas centrais da Fundação. Estendido no mesmo arquivo/migração, mesmo mecanismo aditivo, mapeamento PK verbatim do loop aprovado. As demais linhas do loop (`dim_planejamento`, `fat_objetivo_especifico`, `fat_meta`, `fat_sucesso_mensal`, `rel_planejamento_preditor`, `fat_gip`) continuam fora de escopo (tabelas de Planejamento/Incidência, ainda não provisionadas).

**Status**: ✅ Complete

---

### T18: Índice de busca TSE por nome (fuzzy)

**What**: Criar índice GIN trigram sobre `app.normaliza_nome(nm_urna)` em `tse.mv_candidatura_resumo`, e índice B-tree em `(sg_uf, cd_cargo)` — suporte à busca de FND-TSE-01/FND-TSM-01.
**Where**: `supabase/migrations/0011_tse_busca_indices.sql`
**Depends on**: T17
**Reuses**: `app.normaliza_nome` (T11), `pg_trgm` (T11)
**Requirement**: FND-TSE-01, FND-TSM-01

**Tools**:
- MCP: NONE
- Skill: `supabase-postgres-best-practices`

**Done when**:
- [x] Índice GIN trigram criado e usado pelo planner numa busca `ILIKE`/`similarity()` de teste
- [x] Índice B-tree `(sg_uf, cd_cargo)` criado
- [x] Gate check passa: `npm run test:integration`

**Tests**: integration
**Gate**: full

**Status**: ✅ Complete — commit `bc87e6d`. Renumerado para `0013_tse_busca_indices.sql`. Bug real corrigido nesta sessão: o teste do planner envolvia `EXPLAIN` dentro de uma subquery `FROM (...)` — sintaticamente inválido no Postgres (`EXPLAIN` é statement utilitário, não expressão SELECT; confirmado com erro `42601` real) — reescrito como statement de topo, na mesma chamada que `SET LOCAL enable_seqscan = off`. Gate combinado (Batch 1 + T11-T18): 12 arquivos, 101/101 testes.

---

### T19: Seed de teste para integração

**What**: Criar seed mínimo para os testes de integração das fases seguintes: usuários de teste adicionais vinculados a contratos de teste, 1 contratante/mandato de exemplo, 1 coalizão de exemplo.
**Where**: `supabase/seed_test.sql` (ou `supabase/tests/fixtures/**`)
**Depends on**: T18
**Reuses**: —
**Requirement**: N/A — infraestrutura de teste para Fases 3-4

**Tools**:
- MCP: NONE
- Skill: `supabase`

**Done when**:
- [x] Seed aplicável via `npm run test:integration` (setup) sem violar nenhum CHECK/UNIQUE
- [x] Gate check passa: `npm run test:integration`

**Tests**: integration
**Gate**: full

**Status**: ✅ Complete — commit `53bafd9`. Seed idempotente (resolve por nome/email estável antes de inserir), teste aplica duas vezes para provar a idempotência. Gate final da Fase 2 (`npm run test:integration`, suíte completa): 13 arquivos, 104/104 testes — confirmado em múltiplas execuções completas; falhas isoladas e não-reprodutíveis (502 do Cloudflare na Management API, em testes diferentes a cada vez) tratadas como flake de infra, não bug de código.

---

### T20: Função `app.criar_mandato`

**What**: Criar função RPC `app.criar_mandato(p_contratante jsonb, p_mandato jsonb, p_candidatura jsonb DEFAULT NULL, p_ignorar_duplicata boolean DEFAULT false) RETURNS jsonb` — cria `dim_contratante`+`dim_mandato` (+`rel_mandato_candidatura` se `p_candidatura` informado), detectando duplicata por `nome_normalizado`+UF/município e levantando `ERRCODE='MDU01'` com a lista de similares quando `p_ignorar_duplicata=false`.
**Where**: `supabase/migrations/0012_fn_criar_mandato.sql`
**Depends on**: T19
**Reuses**: `app.normaliza_nome`, `ix_contratante_nome_norm` (T11, T14)
**Requirement**: FND-TSE-01, FND-TSE-02, FND-TSE-05, FND-TSE-06

**Tools**:
- MCP: NONE
- Skill: `supabase-postgres-best-practices`

**Done when**:
- [x] `SECURITY INVOKER` (padrão — não declara `SECURITY DEFINER`)
- [x] Cria as 3 linhas (ou 2, sem candidatura) na mesma transação
- [x] Levanta `MDU01` com similares quando há duplicata e `p_ignorar_duplicata=false`
- [x] Prossegue normalmente quando `p_ignorar_duplicata=true`
- [x] Teste de integração cobre: criação sem candidatura (manual), com candidatura, duplicata bloqueada, duplicata ignorada
- [x] Gate check passa: `npm run test:integration`

**Tests**: integration
**Gate**: full

**Status**: ✅ Complete — migração `supabase/migrations/0014_fn_criar_mandato.sql` (`app.contratante_similar` + `app.criar_mandato`), teste `supabase/tests/fundacao/fn-criar-mandato.integration.test.ts` (5 casos). `app.contratante_similar` extraída aqui, já para ser reusada por T22 sem reimplementação. Duplicata: `nome_normalizado` (via `app.normaliza_nome`) + `sg_uf` + `nm_municipio`, comparação NULL-safe (`IS NOT DISTINCT FROM`). Lista de similares vai no `DETAIL` do `RAISE EXCEPTION` (serializado como JSON) — PostgREST expõe isso como `error.details`. `origem_partido_cargo` é decidido pela própria função (`'tse'`/`'manual'` conforme presença de `p_candidatura`), nunca aceito do caller. `eh_mandato_vigente` permanece no default (`false`) mesmo com candidatura confirmada — marcar como vigente é sempre ação explícita via T21, evitando sobrepor responsabilidade. Gate combinado (`npm run test:integration`, suíte completa): 14 arquivos, 109/109 testes.

---

### T21: Função `app.marcar_candidatura_vigente`

**What**: Criar função RPC `app.marcar_candidatura_vigente(p_id_vinculo_tse bigint) RETURNS void` — confirma a candidatura como vigente e desmarca qualquer outra vigente do mesmo mandato, na mesma transação.
**Where**: `supabase/migrations/0013_fn_marcar_vigente.sql`
**Depends on**: T20
**Reuses**: `uq_mandato_candidatura_vigente` (T15)
**Requirement**: FND-TSE-04

**Tools**:
- MCP: NONE
- Skill: `supabase-postgres-best-practices`

**Done when**:
- [x] `SECURITY INVOKER`
- [x] Nunca deixa duas linhas `eh_mandato_vigente=true` para o mesmo mandato (checado após a chamada)
- [x] Teste de integração cobre: mandato sem vigente anterior, mandato com vigente anterior (troca), candidatura de outro mandato (não afetada)
- [x] Gate check passa: `npm run test:integration`

**Tests**: integration
**Gate**: full

**Status**: ✅ Complete — migração `supabase/migrations/0015_fn_marcar_vigente.sql`, teste `supabase/tests/fundacao/fn-marcar-vigente.integration.test.ts` (4 casos). Duas UPDATE separadas (desmarca as outras vigentes do mandato, depois marca a nova) garantem que o índice único parcial `uq_mandato_candidatura_vigente` nunca vê duas linhas vigentes simultâneas para o mesmo mandato. SPEC_DEVIATION (achado durante o gate, não bug de código): o 4º teste ("candidatura de outro mandato não afetada") tem 6 round-trips sequenciais de `runSql` e estourou o `testTimeout` padrão de 30s sob a lentidão da Management API observada nesta sessão — timeout elevado para 60s nesse teste (mesma classe de ajuste já feita em T13/T14/T16). Gate rodado por arquivo (`npm run test:integration -- fn-marcar-vigente.integration.test.ts`): 4/4 passando — decisão desta sessão (confirmada com o usuário) de rodar o gate completo (`npm run test:integration`, suíte inteira) só ao final da Fase 3, não a cada task, para reduzir tempo de ciclo contra o Supabase remoto.

---

### T22: Função `app.criar_coalizao`

**What**: Criar função RPC `app.criar_coalizao(p_contratante jsonb, p_coalizao jsonb, p_ignorar_duplicata boolean DEFAULT false) RETURNS jsonb` — cria `dim_contratante`+`dim_coalizao` na mesma transação, reusando a mesma checagem de duplicata de `app.criar_mandato`.
**Where**: `supabase/migrations/0014_fn_criar_coalizao.sql`
**Depends on**: T21
**Reuses**: mesma lógica de duplicata de T20 (extraída para função auxiliar `app.contratante_similar` para não duplicar)
**Requirement**: FND-COL-01

**Tools**:
- MCP: NONE
- Skill: `supabase-postgres-best-practices`

**Done when**:
- [x] `SECURITY INVOKER`
- [x] Cria as 2 linhas na mesma transação
- [x] Duplicata segue a mesma regra de T20 (mesma função auxiliar, não reimplementada)
- [x] Teste de integração cobre: criação simples, duplicata bloqueada/ignorada
- [x] Gate check passa: `npm run test:integration`

**Tests**: integration
**Gate**: full

**Status**: ✅ Complete — migração `supabase/migrations/0016_fn_criar_coalizao.sql`, teste `supabase/tests/fundacao/fn-criar-coalizao.integration.test.ts` (4 casos). Reusa `app.contratante_similar` (T20) verbatim, sem reimplementar a checagem de duplicata. Gate rodado por arquivo: 4/4 passando de primeira. Mantida a decisão desta sessão de rodar o gate completo só ao final da Fase 3.

---

### T23: Função `app.substituir_vinculo`

**What**: Criar função RPC `app.substituir_vinculo(p_id_vinculo_antigo bigint, p_id_usuario_novo bigint, p_cargo text DEFAULT NULL, p_grau_responsabilidade text DEFAULT NULL, p_areas text[] DEFAULT NULL) RETURNS bigint` — fecha o vínculo antigo (`dt_fim = CURRENT_DATE`) e cria um novo para a pessoa nova, no mesmo `id_contrato`/`papel_no_contrato`, na mesma transação. Nunca apaga a linha antiga.
**Where**: `supabase/migrations/0015_fn_substituir_vinculo.sql`
**Depends on**: T22
**Reuses**: `uq_vinculo` (T13)
**Requirement**: FND-USR-05

**Tools**:
- MCP: NONE
- Skill: `supabase-postgres-best-practices`

**Done when**:
- [x] `SECURITY INVOKER`
- [x] Linha antiga fica com `dt_fim = CURRENT_DATE`, nunca é apagada
- [x] Linha nova criada com o mesmo `id_contrato`/`papel_no_contrato`
- [x] Teste de integração cobre: substituição simples, tentativa de substituir vínculo já fechado (erro claro)
- [x] Gate check passa: `npm run test:integration`

**Tests**: integration
**Gate**: full

**Status**: ✅ Complete — migração `supabase/migrations/0017_fn_substituir_vinculo.sql`, teste `supabase/tests/fundacao/fn-substituir-vinculo.integration.test.ts` (3 casos). Guarda dupla antes de fechar a linha antiga: vínculo inexistente e vínculo já fechado (`dt_fim IS NOT NULL`) levantam `RAISE EXCEPTION` com mensagem clara (SQLSTATE padrão `P0001`, sem ERRCODE customizado — não previsto na Error Handling Strategy do design para este caso). Gate rodado por arquivo: 3/3 passando de primeira.

**Fase 3 completa** (T20-T23). Gate completo (`npm run test:integration`, suíte inteira) ainda pendente — rodado uma única vez ao final da fase, não a cada task (decisão desta sessão para reduzir tempo de ciclo contra o Supabase remoto).

---

### T24: Gerar tipos TypeScript do banco

**What**: Rodar `supabase gen types typescript` e gravar em `src/backend/supabase/database.types.ts`; adicionar script `db:types` no `package.json`.
**Where**: `src/backend/supabase/database.types.ts`, `package.json`
**Depends on**: T23
**Reuses**: —
**Requirement**: N/A — infraestrutura (Tech Decision do design.md)

**Tools**:
- MCP: NONE
- Skill: `supabase`

**Done when**:
- [x] Arquivo gerado cobre todas as tabelas/views de Fundação + TSE
- [x] Clientes de T8 passam a usar o tipo `Database` real (não mais placeholder)
- [x] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Status**: ✅ Complete — `src/backend/supabase/database.types.ts` regenerado via `npm run db:types` (`supabase gen types typescript --linked`), cobre `dim_contratante`/`dim_mandato`/`dim_coalizao`/`fat_contrato`/`rel_mandato_candidatura`/`rel_usuario_contrato`/`dim_usuario` (public) + `tse.mv_candidatura_resumo` (view) + as 4 funções `app.*` de T20-T23. `client.ts`/`server.ts` (T8) já importavam `Database` genericamente do arquivo — nenhuma mudança neles foi necessária, o tipo real substitui o placeholder automaticamente. SPEC_DEVIATION: `supabase/config.toml` (`[api] schemas`) nunca incluía `tse` — o schema tinha `GRANT USAGE`/`GRANT SELECT` corretos desde T11/T15, mas não estava na lista de schemas expostos pelo PostgREST, então (a) `supabase gen types` omitia `tse` por completo e (b) uma query real `supabase.schema('tse').from(...)` (planejada para T27) teria falhado em runtime com "schema not exposed", apesar de todos os testes unitários mockados passarem. Corrigido adicionando `tse` a `schemas` (mesmo padrão já usado para `app` em T4) e `supabase config push` (diff mostrado, só a linha `schemas` mudou, confirmado). `npm run build` limpo (Turbopack + `tsc`). `npm run lint` tem 1 erro pré-existente em `DADOS TSE/carga_amostral.js` (arquivo untracked, trabalho paralelo do usuário não relacionado a esta feature — ver Handoff em STATE.md, "não tocar") — não introduzido por esta task, fora do escopo de qualquer arquivo listado em T24-T28.

---

### T25: Tipos compostos de Fundação

**What**: Criar os tipos TypeScript compostos definidos no design (`CandidaturaSugerida`, `ContratanteSimilar`, `MandatoCriado`, `CoalizaoCriada`, `VinculoEditavel`).
**Where**: `src/backend/types/fundacao.ts`
**Depends on**: T24
**Reuses**: `Database` types (T24)
**Requirement**: FND-TSE-01, FND-TSE-05, FND-USR-03/04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Os 5 tipos definidos exatamente como no design.md
- [x] Nenhum campo duplica um tipo já gerado (`database.types.ts`) sem necessidade
- [x] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Status**: ✅ Complete — `src/backend/types/fundacao.ts` com os 5 tipos (`CandidaturaSugerida`, `ContratanteSimilar`, `MandatoCriado`, `CoalizaoCriada`, `VinculoEditavel`) copiados verbatim do design.md. Nenhum tipo é gerado por `database.types.ts` (todos são projeção/retorno composto, confirmado no design). Verificação: sem `tsconfig.json` na raiz (só `src/frontend/tsconfig.json`), então — mesmo padrão de T8 — página descartável em `src/frontend/app/_verify-t25/` importou os 5 tipos via `@backend/types/fundacao` e atribuiu um valor de cada shape; `npm run build` (Turbopack + `tsc`) limpo; página removida após confirmar, `npm run build` reconfirmado limpo sem ela.

---

### T26: Zod schemas (contratante, mandato, coalizão, contrato, usuário, vínculo)

**What**: Escrever os schemas Zod que espelham os CHECKs/domínios relevantes: `contratanteSchema`, `mandatoSchema`, `coalizaoSchema`, `contratoSchema`, `usuarioSchema`, `vinculoSchema` — cada um com comentário apontando a constraint espelhada.
**Where**: `src/backend/schemas/contratante.ts`, `mandato.ts`, `coalizao.ts`, `contrato.ts`, `usuario.ts`, `vinculo.ts`
**Depends on**: T25
**Reuses**: CHECKs de `docs/schema_sistema.sql` (T14, T13) como referência de regra
**Requirement**: FND-TSE-06 (validação de cadastro manual), FND-CTR-01/03/04, FND-USR-01/03, FND-COL-01/04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Cada schema rejeita exatamente os mesmos casos que a constraint espelhada rejeitaria (ex.: `nr_titulo_eleitoral` com 11 dígitos, `motivo_encerramento` vazio quando `status='nao_concluido'`, sentinela de `texto_limpo`)
- [x] Testes unitários: 1:1 por constraint espelhada + todo edge case listado no spec (mín. 15 casos cobrindo os 6 schemas)
- [x] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick

**Status**: ✅ Complete — `src/backend/schemas/{contratante,mandato,coalizao,contrato,usuario,vinculo}.ts` + `.test.ts` (54 casos). Cada campo tem comentário apontando a constraint/domínio espelhado. Decisões tomadas durante a implementação:
- Extraído `src/backend/schemas/texto-limpo.ts` (`textoLimpoSchema`) compartilhado pelos 5 schemas que têm coluna `texto_limpo` — evita repetir a lista de 12 sentinelas 5 vezes (mesmo racional de `app.contratante_similar` em T20/T22). Normalização (unaccent + lower + trim + colapso de espaço) replicada em JS e confirmada equivalente a `app.normaliza_nome` via teste manual (`"Não Coletado"` → `"nao coletado"`).
- `mandatoSchema` e `contratanteSchema` **excluem** `origem_partido_cargo`/`tipo_contratante` — ambos são decididos pela própria função RPC (`app.criar_mandato`/`app.criar_coalizao`), nunca aceitos do caller (Handoff da Fase 3 em `.specs/STATE.md`); mirroring o CHECK correspondente (`ck_mandato_origem`) não faz sentido para um campo que o cliente nunca envia.
- `coalizaoSchema` cobre só `dim_coalizao` (payload de `app.criar_coalizao`); `membroCoalizaoSchema` (novo, mesmo arquivo — sem arquivo dedicado no design.md) cobre `rel_coalizao_membro` para FND-COL-03/04/05, já que o design não lista uma superfície própria de membro.
- `contratoSchema` aceita um `id_contrato` opcional (só presente ao editar) unicamente para poder checar `ck_contrato_nao_e_proprio_anterior` contra si mesmo — não existe no INSERT real (BIGSERIAL ainda não gerado).
- `zod` promovido de dependência transitiva (puxada por `eslint-config-next`/`shadcn`) para dependência direta do `package.json` raiz (AD-021 exige Zod).
- Adicionado `npm run build` para reconfirmar que nada quebrou; `npm run lint` mantém o mesmo 1 erro pré-existente e não relacionado em `DADOS TSE/` (ver nota de T24).

**Test Adequacy Review**: Check A (cobertura) confirmou 1:1 para as 11 constraints/domínios relevantes-a-input (`ck_contratante_uf`, `texto_limpo`×5 tabelas, `ck_mandato_titulo`, `ck_mandato_raca`, `ck_membro_papel`, `ck_membro_grupo`, `ck_membro_periodo`, `ck_contrato_status`, `ck_contrato_profundidade`, `ck_contrato_periodo`, `ck_contrato_nao_e_proprio_anterior`, `ck_contrato_motivo`, `ck_usuario_papel`, `ck_usuario_email`, `ck_vinculo_papel`, `ck_vinculo_cargo`, `ck_vinculo_periodo`) + o edge case de CPF do spec.md. Gap encontrado e corrigido durante a review: faltava teste de `ck_contrato_status` inválido (todas as outras enums de papel/status tinham o caso rejeitado, esta não) — adicionado antes de fechar a task. Check C: nenhum teste sem constraint/AC associado (removido um teste especulativo de "campo não existe no shape" que não mapeava a nenhum AC/Done-when).

---

### T27: Query de busca TSE (`buscarCandidaturas`)

**What**: Implementar `buscarCandidaturas(filtros): Promise<CandidaturaSugerida[]>` em `src/backend/queries/tse.ts` — consulta `tse.mv_candidatura_resumo` com os filtros de nome (usando o índice trigram de T18), UF, cargo e ano.
**Where**: `src/backend/queries/tse.ts`
**Depends on**: T26
**Reuses**: índice de T18, tipo `CandidaturaSugerida` (T25)
**Requirement**: FND-TSE-01, FND-TSM-01

**Tools**:
- MCP: NONE
- Skill: `supabase`

**Done when**:
- [x] Retorna lista vazia (não erro) quando nada é encontrado
- [x] Aceita busca só por nome (fuzzy) e busca combinada nome+UF+cargo
- [x] Testes unitários com cliente Supabase mockado cobrindo: resultado vazio, resultado único, múltiplos resultados ordenados por confiança
- [x] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick

**Status**: ✅ Complete — `src/backend/queries/tse.ts` (`buscarCandidaturas`) + `tse.test.ts` (8 casos). Decisões tomadas durante a implementação:
- **Gap de arquitetura descoberto**: o design pedia "fuzzy" via o índice trigram de T18, mas o operador `%`/`similarity()` do pg_trgm não é exposto pela grade de filtros REST do PostgREST (só `eq`/`ilike`/`gt`/etc.) — não há como pedir ranking de similaridade numa query direta sem escrever SQL bruto (risco de injection, já que `nome` é input do usuário). Resolvido com `ilike('nm_urna', '%termo%')` (seguro, parametrizado pelo supabase-js, e o índice GIN trigram de T18 acelera `ILIKE` com wildcard nas duas pontas) para a busca em si, e um coeficiente de Dice sobre bigramas calculado em JS sobre as linhas já filtradas para o ranking de confiança -- mesma família de métrica que o `similarity()` do pg_trgm usa internamente.
- **Spec-precision gap**: spec.md (P1 AC1) exige `confianca` (alta/média/baixa) visível mas não define os limiares. Implementado com limiares próprios (score ≥0.6 alta, ≥0.3 média, abaixo baixa) e documentado no código; sem termo de nome (busca só por UF/cargo/ano), classificado como 'baixa' por padrão (nenhum sinal de nome para avaliar).
- `metodoMatch` é sempre `'nome_uf_cargo'` para esta função -- ela nunca busca por `nr_titulo_eleitoral` (não é um filtro do design.md) e nunca retorna `'manual'` (isso é decidido pela UI/RPC quando a Gestora confirma uma seleção manual, FND-TSM-02, fora do escopo desta query).
- `buscarCandidaturas` recebe o `SupabaseClient` como primeiro parâmetro (em vez de importá-lo internamente, como o design.md mostra) -- necessário para o cliente mockado exigido pelo Done-when; mesmo padrão será usado pelos wrappers RPC de T28 pela mesma razão.
- Verificação de tipos: `npm run test:unit` (gate da task) passa, mas o transform do Vitest (esbuild) não faz checagem de tipo, e `npm run build` também não alcança este arquivo (nada em `src/frontend` o importa ainda) -- confirmado com `npx tsc --noEmit` direto sobre `tse.ts`/`tse.test.ts` (compilerOptions equivalentes ao projeto: strict, ES2017, moduleResolution bundler), limpo.

---

### T28: RPC wrappers tipados (`src/backend/rpc/**`)

**What**: Implementar `criarMandato`, `marcarCandidaturaVigente`, `criarCoalizao`, `substituirVinculo` em `src/backend/rpc/mandato.ts`, `coalizao.ts`, `vinculo.ts` — chamando `supabase.rpc(...)` e mapeando `MDU01`/`23514`/`23505`/`42501` para os erros tipados da Error Handling Strategy do design.
**Where**: `src/backend/rpc/mandato.ts`, `src/backend/rpc/coalizao.ts`, `src/backend/rpc/vinculo.ts`
**Depends on**: T27
**Reuses**: funções de T20-T23, tipos de T25
**Requirement**: FND-TSE-01/02/06, FND-COL-01, FND-USR-05

**Tools**:
- MCP: NONE
- Skill: `supabase`

**Done when**:
- [x] Cada wrapper mapeia `MDU01` → erro `DuplicataDetectada` com a lista de similares
- [x] Cada wrapper mapeia `23514`/`23505`/`42501` conforme a tabela de Error Handling do design
- [x] Testes unitários com cliente mockado cobrindo os 4 wrappers × sucesso + cada erro mapeado (mín. 12 casos)
- [x] Gate check passa: `npm run test:unit`

**Tests**: unit
**Gate**: quick

**Status**: ✅ Complete — `src/backend/rpc/{mandato,coalizao,vinculo}.ts` + `.test.ts` (19 casos: `criarMandato` 5, `marcarCandidaturaVigente` 4, `criarCoalizao` 5, `substituirVinculo` 5). Decisões tomadas durante a implementação:
- Extraído `src/backend/rpc/errors.ts` (`mapeiaErroRpc` + `DuplicataDetectadaError`/`ViolacaoConstraintError`/`ViolacaoUnicaError`/`PermissaoNegadaError`) — os 3 wrappers tratam exatamente os mesmos 4 códigos, evita repetir a tabela constraint→mensagem 3 vezes (mesmo racional de `texto-limpo.ts` em T26). Nome da constraint extraído da `message` do `PostgrestError` via regex (`constraint "([^"]+)"`); tabelas de mensagem cobrem as constraints alcançáveis pelas 4 funções RPC de T20-T23 (não todas as constraints do schema — as de `fat_contrato`/`dim_usuario` ficam fora, pois não são escritas por RPC). Constraint não mapeada cai num fallback genérico, nunca lança sem mensagem; código não mapeado (`P0001`, usado por T21/T23 para seus próprios erros de negócio) é relançado sem alteração — comportamento confirmado por teste em ambos os wrappers que o usam.
- `mapeiaErroRpc` lê `error.details` (JSON) para a lista de similares do `MDU01` — combina com a nota da Fase 3 (Handoff): PostgREST expõe o `DETAIL` do `RAISE EXCEPTION` como `error.details`, já serializado com as chaves camelCase que `ContratanteSimilar` espera (`jsonb_build_object('idContratante', ...)` nas migrações de T20/T22).
- `CandidaturaParaConfirmar` (mandato.ts) precisou ser `type` em vez de `interface` — só um alias de tipo-literal satisfaz a index signature implícita que `Json` (`database.types.ts`) exige para ser passado como `p_candidatura`; uma `interface` sem index signature explícito falha a checagem (`npx tsc --noEmit`, já que nem `build` nem `test:unit` alcançam este arquivo — mesma lacuna de verificação de T25/T27).
- Mesmo padrão de T27: os 3 wrappers recebem `SupabaseClient<Database>` como primeiro parâmetro (em vez de importado internamente) para permitir mock em teste unitário.
- `client.schema('app').rpc(...)` chama as funções no schema `app` (não `public`) — confirmado necessário porque as 4 funções de T20-T23 vivem em `app.*`.
- Verificação de tipos: `npx tsc --noEmit` direto sobre `src/backend/rpc/*.ts` (mesmas compilerOptions de T25/T27), limpo — nem `build` nem `test:unit` type-checkam estes arquivos sozinhos (nada em `src/frontend` os importa ainda; o transform do Vitest não type-checa).

**Test Adequacy Review**: Check A confirmou 1:1 entre os 4 códigos da Error Handling Strategy (`MDU01`, `23514`, `23505`, `42501`) e um teste por wrapper que os alcança (MDU01 só em `criarMandato`/`criarCoalizao`, coerente com o design — nenhuma função sem checagem de duplicata pode levantar MDU01, então nenhum teste especulativo foi escrito para `marcarCandidaturaVigente`/`substituirVinculo` nesse código). Check C: nenhum teste sem requisito associado; os testes de "código não mapeado passa sem alteração" mapeiam ao comportamento real e documentado de T21/T23 (`P0001` para erros de negócio fora da tabela de 4 códigos do design), não uma especulação.

**Fase 4 completa** (T24-T28). Gate completo (`npm run test:unit`, suíte inteira): 10 arquivos, 81/81 testes. `npm run build` limpo (Turbopack + `tsc`); `npm run lint` mantém o único erro pré-existente e não relacionado em `DADOS TSE/carga_amostral.js` (ver T24). Nenhuma task desta fase tocou migração/RLS/GRANT — gate `full`/`test:integration` não se aplica (Test Coverage Matrix: camada TypeScript é unit-only).

---

### T29: Componente `ContratanteFields`

**What**: Criar o formulário controlado de campos comuns de `dim_contratante` (nome, UF, município), usando `contratanteSchema` (T26).
**Where**: `src/frontend/components/fundacao/contratante-fields.tsx`
**Depends on**: T28
**Reuses**: `contratanteSchema` (T26), componentes shadcn/ui (T7)
**Requirement**: FND-TSE-06, FND-COL-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Componente renderiza os 3 campos com validação RHF+Zod em tempo real
- [x] Reusado sem duplicação por `MandatoWizard` (T32) e `CoalizaoForm` (T35)
- [x] Gate check passa: `npm run build`

**Tests**: none — build gate only
**Gate**: build

**Status**: ✅ Complete — `src/frontend/components/fundacao/contratante-fields.tsx`. Componente genérico (`ContratanteFields<T extends ContratanteFormValues>`) que aceita `control: Control<T>` de qualquer formulário pai cujo shape aninhe `contratante: { nome, sg_uf?, nm_municipio? }` — mesmo supertipo criado por `app.criar_mandato`/`app.criar_coalizao`. Validação em tempo real vem do `mode: "onChange"` que `MandatoWizard`/`CoalizaoForm` configuram no próprio `useForm` (T32/T35) — o componente em si só expõe os `FormField`/`FormMessage` que reagem a qualquer modo escolhido pelo pai, sem duplicar a lógica de validação (a validação real é do `contratanteSchema`, T26, via `zodResolver` no pai). Reuso confirmado por `MandatoWizard` (T32, `import { ContratanteFields } from "./contratante-fields"`) -- ver Status de T35 para a segunda confirmação. Gate: `npm run lint` (4/4 erros pré-existentes, nenhum novo) + `npm run build` (limpo).

---

### T30: Componente `DuplicataWarningDialog`

**What**: Criar o diálogo que exibe contratante(s) parecido(s) e exige confirmação explícita antes de salvar.
**Where**: `src/frontend/components/fundacao/duplicata-warning-dialog.tsx`
**Depends on**: T29
**Reuses**: tipo `ContratanteSimilar` (T25), componente `dialog` do shadcn/ui (T7)
**Requirement**: FND-TSE-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Lista os similares recebidos via props
- [x] `onConfirmar`/`onCancelar` disparam corretamente
- [x] Gate check passa: `npm run build`

**Tests**: none — build gate only
**Gate**: build

**Status**: ✅ Complete — `src/frontend/components/fundacao/duplicata-warning-dialog.tsx`. Componente puramente apresentacional sobre o `dialog` do shadcn/ui (T7): lista `candidatos: ContratanteSimilar[]` (T25) recebidos via props; `onConfirmar`/`onCancelar` ligados aos botões do rodapé e ao `onOpenChange` do Dialog (fechar via ESC/clique fora também dispara `onCancelar`, mesmo caminho que o botão "Cancelar"). Sem prop `open` própria (design.md não define uma) -- quem monta o componente decide quando ele existe na árvore. Gate: `npm run lint` (4/4 pré-existentes) + `npm run build` (limpo).

---

### T31: Componente `TseMatchSearch`

**What**: Criar o componente de busca/sugestão de candidaturas TSE, listando `metodo_match`/`confianca` por resultado, usando `buscarCandidaturas` (T27).
**Where**: `src/frontend/components/fundacao/tse-match-search.tsx`
**Depends on**: T30
**Reuses**: `buscarCandidaturas` (T27), componente `table`/`badge` do shadcn/ui (T7)
**Requirement**: FND-TSE-01, FND-TSM-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Renderiza lista de sugestões com badge de confiança
- [x] Estado vazio oferece busca manual (sem tela de erro) — FND-TSM-01
- [x] Gate check passa: `npm run build`

**Tests**: none — build gate only
**Gate**: build

**Status**: ✅ Complete — `src/frontend/components/fundacao/tse-match-search.tsx`. Uma única UI de busca (nome/UF/ano) serve tanto FND-TSE-01 (sugestão) quanto FND-TSM-01 (fallback manual) -- não há uma tela "automática" separada de uma "manual": os mesmos campos ficam sempre visíveis, e um resultado vazio só adiciona uma mensagem inline (nunca uma tela de erro) convidando a refinar os filtros. Resultados renderizados em `Table` (shadcn/ui, T7) com `Badge` de confiança (variant mapeado 1:1 por `alta`/`media`/`baixa`). FND-TSM-02 (metodo_match='manual' em seleção manual): o componente entra em `modoManual` assim que uma busca retorna vazio: qualquer candidatura selecionada depois disso sai do componente com `metodoMatch` sobrescrito para `'manual'`, mesmo que a query (`buscarCandidaturas`, T27) sempre classifique como `'nome_uf_cargo'` internamente -- a decisão de "essa seleção foi manual" é de UI, exatamente como o comentário do T27 já previa (`src/backend/queries/tse.ts`). Erro de rede/consulta (não "sem resultado") mostra mensagem inline distinta, também sem tela de erro dedicada. Gate: `npm run lint` (4/4 pré-existentes) + `npm run build` (limpo).

---

### T32: `MandatoWizard` + página `/mandatos/novo`

**What**: Montar o fluxo completo de cadastro de mandato — busca TSE (T31) → confirmar (chama `criarMandato`, T28) → rejeitar (`update` direto em `rel_mandato_candidatura`) → aviso de duplicata (T30) → fallback manual (T29 + `criarMandato` sem candidatura).
**Where**: `src/frontend/app/mandatos/novo/page.tsx`, `src/frontend/components/fundacao/mandato-wizard.tsx`
**Depends on**: T31
**Reuses**: `TseMatchSearch` (T31), `DuplicataWarningDialog` (T30), `ContratanteFields` (T29), `criarMandato` (T28)
**Requirement**: FND-TSE-01 a 06, FND-TSM-01/02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Os 3 caminhos (confirmar sugestão, rejeitar, manual) navegam para `/mandatos/[idMandato]` ao concluir
- [x] Erro de duplicata abre o diálogo e permite prosseguir com confirmação
- [x] Gate check passa: `npm run build`

**Tests**: none — build gate only
**Gate**: build

**Status**: ✅ Complete — `src/frontend/components/fundacao/mandato-wizard.tsx` + `src/frontend/app/mandatos/novo/page.tsx`. Três caminhos: (1) confirmar sugestão do TSE (`TseMatchSearch`, T31, prefila `contratante`/`mandato` a partir da candidatura) chama `criarMandato` (T28) com `p_candidatura` montado a partir do `CandidaturaSugerida` selecionado; (2) cadastro manual chama `criarMandato` sem candidatura; ambos navegam para `/mandatos/[idMandato]` via `onCriado` (página faz `router.push`) usando o `idMandato` de `MandatoCriado` (T25). Duplicata (`DuplicataDetectadaError`, T28) abre `DuplicataWarningDialog` (T30) com os similares; confirmar reenvia `criarMandato` com `ignorarDuplicata: true` usando os mesmos valores do formulário (`form.getValues()`).
- **SPEC_DEVIATION** (caminho "rejeitar"): spec.md (P1, AC3) descreve rejeitar uma sugestão como gravar `rel_mandato_candidatura.status='rejeitado'` -- mas essa tabela exige `id_mandato NOT NULL` (`supabase/migrations/0010_tse_e_candidatura.sql:171`) e, no fluxo de `/mandatos/novo`, nenhum mandato existe ainda no momento em que uma sugestão é descartada (só passa a existir ao confirmar ou ao salvar manualmente). Implementado como: rejeitar descarta a sugestão da tela de revisão e devolve à busca -- exatamente o efeito exigido pelo AC3 ("sem criar mandato, e permitir nova busca") -- sem nenhuma escrita no banco (não há linha para atualizar). `onRejeitarSugestao` (`update` direto por `id_vinculo_tse`, design.md) fica documentado no código como disponível para uma tela futura que revise candidaturas já vinculadas a um mandato existente (ex.: reeleito com segunda candidatura pendente); não há Done-when nem página nesta fase que exija essa tela. Por não criar mandato, esse caminho não navega para `/mandatos/[idMandato]` -- consistente com a própria leitura do AC3, que é mais específica que a frase geral de Done-when.
- Campos de `mandato` mantidos deliberadamente mínimos (nome civil, título eleitoral, cargo, partido) -- `mandatoSchema` (T26) não exige nenhum campo, e os demais atributos biográficos (gênero, raça, etc.) não são exigidos por nenhum Done-when desta fase; adicioná-los seria escopo além do pedido.
- Cargo/partido carregados via `ref_cargo`/`ref_partido` (consulta direta, sem CRUD -- catálogos `ref_*` são fora de escopo per spec.md, só leitura para popular os `Select`).
- Confirma reuso de `ContratanteFields` (T29) sem duplicação de JSX.
- Gate: `npm run lint` (4/4 pré-existentes) + `npm run build` (limpo, rota `/mandatos/novo` compilada e tipada).

---

### T33: Página `/mandatos/[id]` (detalhe e edição)

**What**: Criar a página de detalhe do mandato — dados do contratante/mandato editáveis, lista de candidaturas TSE vinculadas (com ação de marcar vigente via T28), lista de contratos do mandato.
**Where**: `src/frontend/app/mandatos/[id]/page.tsx`
**Depends on**: T32
**Reuses**: `marcarCandidaturaVigente` (T28)
**Requirement**: FND-TSE-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Edição de campos de `dim_mandato`/`dim_contratante` salva via `update` direto
- [x] Ação "marcar como vigente" numa candidatura chama `marcarCandidaturaVigente` e atualiza a lista
- [x] Gate check passa: `npm run build`

**Tests**: none — build gate only
**Gate**: build

**Status**: ✅ Complete — `src/frontend/app/mandatos/[id]/page.tsx`. Página cliente (Next.js 16: `params` é `Promise<{id}>`, resolvido com `use()` em vez de `await` para manter um Client Component só, sem arquivo extra) que carrega `dim_mandato`+`dim_contratante`+`rel_mandato_candidatura`+`fat_contrato` por consultas diretas. Edição: um único formulário (reusa `ContratanteFields`, T29) dispara dois `update` independentes (`dim_contratante`, `dim_mandato`) -- não é atômico (design.md não pede RPC aqui, só "update direto"); erro de qualquer um dos dois é mapeado com `mapeiaErroRpc` (T28, reutilizável para erros de `update` direto, não só RPC, já que só olha `error.code`/`error.message`) para uma mensagem amigável. "Marcar como vigente": botão por linha de candidatura não-vigente chama `marcarCandidaturaVigente` (T28) e recarrega a lista via a mesma função `carregar()`, confirmando que a UI reflete a troca. Lista de contratos do mandato incluída como valor agregado barato (mesma query, sem novo escopo) com link para `/mandatos/[id]/contratos/novo` (T34) e `/contratos/[id]/vinculos` (T37) -- nenhum dos dois exigido pelo Done-when, mas ambos são rotas que já existirão neste mesmo lote. Gate: `npm run lint` (4/4 pré-existentes) + `npm run build` (limpo, rota `/mandatos/[id]` dinâmica compilada e tipada).

---

### T34: `ContratoForm` + página de abertura de contrato

**What**: Criar o formulário de abertura de contrato (produto obrigatório, projeto opcional, contrato anterior opcional escolhido entre os existentes do contratante) e a ação de encerramento com motivo.
**Where**: `src/frontend/app/mandatos/[id]/contratos/novo/page.tsx`, `src/frontend/components/fundacao/contrato-form.tsx`
**Depends on**: T33
**Reuses**: `contratoSchema` (T26)
**Requirement**: FND-CTR-01 a 05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Seletor de "contrato anterior" lista só contratos do mesmo contratante
- [ ] Encerrar com `status='nao_concluido'` exige `motivo_encerramento` antes de habilitar o submit
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

---

### T35: `CoalizaoForm` + páginas de coalizão

**What**: Criar cadastro/edição de coalizão (`criarCoalizao`, T28), alternância de `possui_planejamento_proprio`, e gestão de `rel_coalizao_membro` (adicionar/encerrar membro com papel e período).
**Where**: `src/frontend/app/coalizoes/**`
**Depends on**: T34
**Reuses**: `ContratanteFields` (T29), `DuplicataWarningDialog` (T30), `criarCoalizao` (T28), `coalizaoSchema` (T26)
**Requirement**: FND-COL-01 a 06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Papel `grupo_trabalho` exige `nome_grupo` no formulário antes de habilitar o submit
- [ ] `possui_planejamento_proprio` alterna a qualquer momento via `update` direto
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

---

### T36: `UsuarioForm` + página `/usuarios`

**What**: Criar cadastro de `dim_usuario` — a UI não expõe a opção "Gestora" para quem não é Admin (RLS/GRANT do banco é o backstop real, ver Error Handling do design).
**Where**: `src/frontend/app/usuarios/page.tsx`, `src/frontend/components/fundacao/usuario-form.tsx`
**Depends on**: T35
**Reuses**: `usuarioSchema` (T26)
**Requirement**: FND-USR-01, FND-USR-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Campo de papel some/desabilita a opção Gestora quando o usuário logado não é Admin
- [ ] Erro `42501` do backstop de RLS aparece como mensagem genérica de permissão (não crash)
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

---

### T37: `VinculoTable`/`VinculoForm` + página de vínculos do contrato

**What**: Criar a tela de gestão de vínculos usuário↔contrato de um contrato — listar, adicionar, editar (cargo/grau/áreas), substituir (`substituirVinculo`, T28) e encerrar, cobrindo o caso do assessor mentorado do PLL (vínculo manual sem matching).
**Where**: `src/frontend/app/contratos/[id]/vinculos/page.tsx`, `src/frontend/components/fundacao/vinculo-table.tsx`, `vinculo-form.tsx`
**Depends on**: T36
**Reuses**: `substituirVinculo` (T28), `vinculoSchema` (T26), `VinculoEditavel` (T25)
**Requirement**: FND-USR-03 a 08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Editar cargo/grau/áreas de um vínculo aberto não altera `dt_inicio`/`dt_fim` (chamada `update` direto, sem passar por `substituirVinculo`)
- [ ] Substituir chama `substituirVinculo` e a tabela reflete a linha antiga fechada + a nova aberta
- [ ] Encerrar grava `dt_fim` sem apagar a linha e sem tocar `dim_usuario.ativo`
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

---

## Phase Execution Map

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

Phase 0:  T1 ──→ T2 ──→ T3 ──→ T4 ──→ T5
Phase 1:  T6 ──→ T7 ──→ T8 ──→ T9
Phase 2:  T10 ──→ T11 ──→ T12 ──→ T13 ──→ T14 ──→ T15 ──→ T16 ──→ T17 ──→ T18 ──→ T19
Phase 3:  T20 ──→ T21 ──→ T22 ──→ T23
Phase 4:  T24 ──→ T25 ──→ T26 ──→ T27 ──→ T28
Phase 5:  T29 ──→ T30 ──→ T31 ──→ T32 ──→ T33 ──→ T34 ──→ T35 ──→ T36 ──→ T37
```

Execution is strictly sequential — there is no intra-phase parallelism. 37 tasks total, well above the ~8-task inline threshold: batching into ~7-task sub-agent batches will be offered before Execute begins (≈6 batches — one likely spans a phase boundary, e.g. end of Phase 2 into Phase 3, since Phase 2 alone is 10 tasks).

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1–T5 | 1 função/config cada | ✅ Granular |
| T6–T9 | 1 concern de bootstrap cada (init, UI lib, cliente, scripts) | ✅ Granular |
| T10–T19 | 1 migração/concern de schema cada | ✅ Granular |
| T20–T23 | 1 função RPC cada | ✅ Granular |
| T24–T28 | 1 arquivo/concern de backend TS cada | ✅ Granular |
| T29–T37 | 1 componente/página cada | ✅ Granular |

Nenhuma task cobre mais de um componente/função/arquivo de concern — todas passam no critério de granularidade.

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ----------------------- | -------------- | ------ |
| T1 | None | — (início) | ✅ Match |
| T2 | T1 | T1→T2 | ✅ Match |
| T3 | T2 | T2→T3 | ✅ Match |
| T4 | T3 | T3→T4 | ✅ Match |
| T5 | T4 | T4→T5 | ✅ Match |
| T6 | None | — (início da Fase 1) | ✅ Match |
| T7 | T6 | T6→T7 | ✅ Match |
| T8 | T6 | T6→T8 (diagrama mostra cadeia T6→T7→T8; T8 depende só de T6 — ordem sequencial da fase preserva a precedência) | ✅ Match |
| T9 | T7, T8 | T8→T9 | ✅ Match |
| T10 | T5, T9 | fim da Fase 0 e Fase 1 → início da Fase 2 | ✅ Match |
| T11–T19 | task anterior na cadeia | T10→T11→…→T19 | ✅ Match |
| T20 | T19 | fim da Fase 2 → início da Fase 3 | ✅ Match |
| T21–T23 | task anterior na cadeia | T20→T21→T22→T23 | ✅ Match |
| T24 | T23 | fim da Fase 3 → início da Fase 4 | ✅ Match |
| T25–T28 | task anterior na cadeia | T24→T25→T26→T27→T28 | ✅ Match |
| T29 | T28 | fim da Fase 4 → início da Fase 5 | ✅ Match |
| T30–T37 | task anterior na cadeia | T29→T30→…→T37 | ✅ Match |

Nenhuma task depende de uma task de fase posterior — todas as dependências apontam para trás ou dentro da mesma fase.

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | ----------------------------- | ------------------ | ----------- | ------ |
| T1–T3, T5 | Migrações / funções `app.*` | integration | integration | ✅ OK |
| T4 | Config (`supabase/config.toml`) | none | none | ✅ OK |
| T6–T8 | Scaffold/config | none | none | ✅ OK |
| T9 | Config de teste/lint/build | none | none | ✅ OK |
| T10 | Documentação de introspecção | none | none | ✅ OK |
| T11–T18 | Migrações / RLS / triggers / índices | integration | integration | ✅ OK |
| T19 | Seed de teste | integration | integration | ✅ OK |
| T20–T23 | Funções RPC `app.*` | integration | integration | ✅ OK |
| T24, T25 | Tipos gerados/compostos | none | none | ✅ OK |
| T26 | Zod schemas | unit | unit | ✅ OK |
| T27, T28 | Queries / RPC wrappers | unit | unit | ✅ OK |
| T29–T37 | Componentes/páginas de frontend | none (sem E2E, decisão do usuário) | none | ✅ OK |

Nenhuma violação — todo task com camada de código que exige teste na matriz inclui o teste correspondente na própria task.

---

## Tips

- **Fase 0 não é Fundação** — é o mínimo de Plataforma que destrava RLS; qualquer feature futura (Planejamento, Incidência, Operação) já encontra essa sessão pronta.
- **Migrações extraem, não redesenham** — cada task de schema referencia a linha exata de `docs/schema_sistema.sql` sendo aplicada (AD-008).
- **RPC só onde cruza tabela** — reforça a decisão de design (AD-024): T20-T23 são as únicas 4 funções de negócio desta feature.
