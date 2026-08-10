# Catálogos de Referência (Trilha C) Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute
flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source
of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier,
discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Spec**: `.specs/features/catalogos-referencia/spec.md`
**Design**: `.specs/features/catalogos-referencia/design.md`
**Status**: ✅ Done — T1-T4 implementadas e commitadas (single batch inline, sem sub-agentes, ≤8 tasks). Aguardando Verifier independente.

| Task | Status | Commit | Testes |
| ---- | ------ | ------ | ------ |
| T1 | ✅ Done | `50640f7` | 26/26 |
| T2 | ✅ Done | `d996a67` | 6/6 (inclui achado real: default privileges de `anon`/`authenticated`, corrigido com migração de follow-up) |
| T3 | ✅ Done | `e88ac11` | 10/10 |
| T4 | ✅ Done | `93e5e67` | 13/13 (arquivo estendido de T3+T4) |

**Desvio do plano registrado**: T2 previu 1 migração; devido ao achado dos default privileges do Supabase (ver commit `d996a67`), tornou-se 2 migrações (`catalogos_referencia_grants` + `catalogos_referencia_revoke_default_privileges`), ambas no mesmo commit/task. Não é SPEC_DEVIATION (não diverge do spec/design), é ampliação de escopo dentro do próprio requisito CAT-13/AC15 -- a garantia "anon não tem acesso" ficou mais completa que o inicialmente desenhado (RLS+GRANT explícito), fechando também o gap de ALTER DEFAULT PRIVILEGES que nem `context.md` nem `design.md` haviam identificado.

**Pre-flight verificado (AD-025) antes de escrever qualquer DDL**: `supabase migration list` confirma
as 32 migrações locais == remotas no projeto `npnvoolkebhabjkjzqwn` (dev); consulta direta a
`pg_class` confirma que nenhuma das 12 tabelas novas existe hoje no schema `public`. Nenhuma colisão
com trabalho paralelo de outra feature.

---

## Test Coverage Matrix

> Gerada por amostragem de `supabase/tests/fundacao/catalogos.integration.test.ts` (estrutura/CHECK/UNIQUE),
> `supabase/tests/plataforma/roles-grants.integration.test.ts` e
> `supabase/tests/fundacao/catalogos-anon-grant.integration.test.ts` (GRANT via `has_table_privilege`,
> sem sessão JWT por papel). Nenhum guideline de cobertura em `CLAUDE.md` alem do já reusado; o padrão
> observado no repo (100% dos CHECK/UNIQUE/FK relevantes testados, 100% dos GRANTs por papel testados)
> é adotado como piso e como meta — não há camada de aplicação (frontend/backend) nesta feature.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------- | --------------------- | ----------------- | ------------ |
| Migração DDL (`CREATE TABLE`, `CHECK`, `UNIQUE`, `FK`) | integration | 1:1 com CAT-01..12 do spec + todos os Edge Cases de constraint listados | `supabase/tests/catalogos/catalogos-referencia.integration.test.ts` | `npm run test:integration -- supabase/tests/catalogos/catalogos-referencia.integration.test.ts` |
| Migração GRANT/RLS-disable (acesso por papel) | integration | 1:1 com CAT-13, CAT-18, AC14-16 (5 roles `legisla_*` + `authenticated` com SELECT, `anon` negado, mentor/assessor sem escrita) | `supabase/tests/catalogos/catalogos-referencia-grants.integration.test.ts` | `npm run test:integration -- supabase/tests/catalogos/catalogos-referencia-grants.integration.test.ts` |
| Migração seed (conteúdo aprovado + clonagem Coalizão) | integration | 1:1 com CAT-15/CAT-17, contagem exata de linha por tabela (Success Criteria do spec) + idempotência (reaplicação não duplica) | `supabase/tests/catalogos/catalogos-referencia-seed.integration.test.ts` | `npm run test:integration -- supabase/tests/catalogos/catalogos-referencia-seed.integration.test.ts` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Full (por task) | Depois de cada migração aplicada ao dev + teste correspondente escrito | `npm run test:integration -- supabase/tests/catalogos/<arquivo-da-task>` |
| Build (fase final / Validate) | Depois da última task, antes do Verifier | `npm run lint:all && npm run build && npm run test:unit && npm run test:integration` |

> Não há gate "Quick" nesta feature — não existe código TypeScript de aplicação, só migrações SQL e
> testes de integração que batem no Supabase de dev (sem Docker local, `SUPABASE_TEST_TARGET` não
> setado ⇒ target `--linked`).

---

## Execution Plan

Fases executam em sequência estrita — cada uma depende da anterior (mesma cadeia de dependência do
diagrama de `design.md`: DDL → GRANT → seed 9 tabelas → seed Coalizão).

### Phase 1: Estrutura (DDL das 12 tabelas)
```
T1
```

### Phase 2: Acesso (RLS-disable + GRANT)
```
T2
```

### Phase 3: Seed do conteúdo aprovado (9 tabelas)
```
T3
```

### Phase 4: Seed da régua da Coalizão (D9/CAT-17)
```
T4
```

---

## Task Breakdown

### T1: Migração DDL — as 12 tabelas `ref_*`

**What**: Criar as 12 tabelas (`ref_preditor`, `ref_agenda_tematica`, `ref_perfil_atuacao`,
`ref_pilar_insight`, `ref_indicador`, `ref_nivel_iip`, `ref_dimensao_gip`, `ref_tipologia`,
`ref_etapa`, `ref_tipo_registro`, `ref_formulario`, `ref_metrica_formulario`) com colunas/`CHECK`/
`UNIQUE`/`FK` idênticos a `docs/schema_sistema.sql:170-301`, na ordem de dependência do diagrama de
`design.md` (Grupo A → Grupo C → Grupo B), usando `CREATE TABLE IF NOT EXISTS` (idempotência, AC17).
**Where**: `supabase/migrations/<timestamp>_catalogos_referencia_estrutura.sql` (via
`supabase migration new catalogos_referencia_estrutura`)
**Depends on**: None (pré-requisito único: `ref_produto`, já existe)
**Reuses**: `supabase/migrations/0007_catalogos_fundacao.sql` (padrão de header + `CREATE TABLE IF NOT EXISTS`)
**Requirement**: CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, CAT-06, CAT-07, CAT-08, CAT-09, CAT-10, CAT-11, CAT-12, CAT-14 (parcial — existência)

**Tools**:
- MCP: NONE (Supabase CLI via Bash; nenhum MCP conectado nesta sessão além dos que exigem auth interativa)
- Skill: `supabase` (referência de sintaxe/CLI se necessário)

**Done when**:
- [ ] `supabase link --project-ref npnvoolkebhabjkjzqwn` confirmado antes do push (dev, nunca prod)
- [ ] `supabase db push` aplica a migração sem erro
- [ ] As 12 tabelas existem em `public` com as constraints exatas do schema aprovado
- [ ] Nenhuma das 4 tabelas existentes (`ref_produto`/`ref_projeto`/`ref_cargo`/`ref_partido`) é tocada
- [ ] Gate check passa: `npm run test:integration -- supabase/tests/catalogos/catalogos-referencia.integration.test.ts`
- [ ] Reaplicar a migração (`supabase db push` de novo) não falha (idempotência)

**Tests**: integration (novo arquivo `catalogos-referencia.integration.test.ts`, cobre CAT-01..12 + Edge Cases de CHECK/UNIQUE/FK do spec.md)
**Gate**: full

**Commit**: `feat(db): cria as 12 tabelas ref_* do catálogo de referência (CAT-01..14)`

---

### T2: Migração GRANT/RLS-disable — acesso uniforme por papel

**What**: Desabilitar RLS explicitamente nas 12 tabelas novas (exceção documentada AD-030) e conceder
GRANT: `SELECT, INSERT, UPDATE, DELETE` a `legisla_app`/`legisla_admin`/`legisla_gestora` via re-GRANT
obrigatório `ALL TABLES IN SCHEMA public` (AD-025); `SELECT` explícito a `authenticated`,
`legisla_mentor`, `legisla_assessor` nas 12 tabelas; `anon` **excluído** (AD-002/AD-030).
**Where**: `supabase/migrations/<timestamp>_catalogos_referencia_grants.sql` (via
`supabase migration new catalogos_referencia_grants`)
**Depends on**: T1 (tabelas precisam existir para `ALTER TABLE`/`GRANT`)
**Reuses**: `supabase/migrations/0024_ref_tables_rls_fix.sql` (padrão RLS-disable+GRANT), `0007`/`0004` (padrão de re-GRANT em bloco)
**Requirement**: CAT-13, CAT-18 (parcial — setup), AC14, AC15, AC16

**Tools**:
- MCP: NONE
- Skill: `supabase`

**Done when**:
- [ ] `supabase db push` aplica sem erro (projeto dev confirmado)
- [ ] `has_table_privilege` confirma SELECT verdadeiro para as 5 roles `legisla_*` + `authenticated`, nas 12 tabelas
- [ ] `has_table_privilege` confirma SELECT falso para `anon`, nas 12 tabelas
- [ ] `has_table_privilege` confirma INSERT falso para `legisla_mentor`/`legisla_assessor`, INSERT verdadeiro para `legisla_app`/`legisla_admin`/`legisla_gestora`, nas 12 tabelas
- [ ] `pg_class.relrowsecurity = false` para as 12 tabelas
- [ ] Gate check passa: `npm run test:integration -- supabase/tests/catalogos/catalogos-referencia-grants.integration.test.ts`

**Tests**: integration (novo arquivo `catalogos-referencia-grants.integration.test.ts`, cobre CAT-13/CAT-18/AC14-16)
**Gate**: full

**Commit**: `feat(db): RLS-disable + GRANT por papel nas 12 tabelas ref_* (CAT-13, CAT-18, AD-030)`

---

### T3: Migração seed — conteúdo aprovado das 9 tabelas

**What**: Popular `ref_nivel_iip`, `ref_preditor`, `ref_perfil_atuacao`, `ref_pilar_insight`,
`ref_dimensao_gip`, `ref_etapa` (Estratégia + PLL, sem Coalizão), `ref_tipo_registro`,
`ref_formulario`, `ref_metrica_formulario` com os `INSERT`s verbatim de
`docs/schema_sistema.sql:2178-2316`, via `INSERT ... ON CONFLICT DO NOTHING` (idempotência).
**Where**: `supabase/migrations/<timestamp>_catalogos_referencia_seed.sql` (via
`supabase migration new catalogos_referencia_seed`)
**Depends on**: T1 (tabelas precisam existir; `ref_tipo_registro`/`ref_formulario` semeiam via `JOIN` contra `ref_etapa` já semeada nesta mesma migração)
**Reuses**: `supabase/migrations/0020_seed_ref_partido.sql`, `0021_seed_ref_projeto.sql` (padrão de proveniência citada em comentário)
**Requirement**: CAT-15

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `supabase db push` aplica sem erro
- [ ] Contagem de linha exata por tabela: 3 (`ref_nivel_iip`), 5 (`ref_preditor`), 3 (`ref_perfil_atuacao`), 4 (`ref_pilar_insight`), 4 (`ref_dimensao_gip`), 7 (`ref_etapa` Estratégia), 5 (`ref_etapa` PLL), 11 (`ref_tipo_registro`), 16 (`ref_formulario`), 1 métrica NPS por formulário `avaliacao%` (`ref_metrica_formulario`)
- [ ] Reaplicar a migração não duplica linha (idempotência, `ON CONFLICT DO NOTHING`)
- [ ] Gate check passa: `npm run test:integration -- supabase/tests/catalogos/catalogos-referencia-seed.integration.test.ts`

**Tests**: integration (novo arquivo `catalogos-referencia-seed.integration.test.ts`, cobre CAT-15 + Success Criteria de contagem do spec.md)
**Gate**: full

**Commit**: `feat(db): semeia conteúdo aprovado das 9 tabelas ref_* (CAT-15, schema_sistema.sql §16)`

---

### T4: Migração seed — régua da Coalizão (D9/CAT-17)

**What**: Rodar o `INSERT` de clonagem já escrito e comentado em `docs/schema_sistema.sql:2254-2259`
(D9 resolvida por Pedro em 2026-08-10: Coalizão clona a régua da Estratégia), como migração de seed
separada da estrutura.
**Where**: `supabase/migrations/<timestamp>_catalogos_referencia_seed_coalizao.sql` (via
`supabase migration new catalogos_referencia_seed_coalizao`)
**Depends on**: T3 (clona linhas de `ref_etapa` que só existem depois do seed de Estratégia)
**Reuses**: `INSERT` verbatim de `docs/schema_sistema.sql:2254-2259`
**Requirement**: CAT-17

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `supabase db push` aplica sem erro
- [ ] `ref_etapa WHERE id_produto = (SELECT id_produto FROM ref_produto WHERE nome = 'Coalizão')` retorna 7 linhas, nomes/ordem idênticos à Estratégia
- [ ] Reaplicar a migração não duplica linha
- [ ] Estratégia e PLL continuam com suas 7/5 linhas inalteradas (sem regressão)
- [ ] Gate check passa: `npm run test:integration -- supabase/tests/catalogos/catalogos-referencia-seed.integration.test.ts` (mesmo arquivo de T3, estendido com os casos da Coalizão)

**Tests**: integration (extensão do arquivo `catalogos-referencia-seed.integration.test.ts` de T3, cobre CAT-17 + Independent Test da User Story P2 Coalizão)
**Gate**: full

**Commit**: `feat(db): clona a régua de etapas da Estratégia para o produto Coalizão (D9, CAT-17)`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:  T1
Phase 2:  T2
Phase 3:  T3
Phase 4:  T4
```

Execução sequencial — 4 tasks totais, uma por fase, cadeia de dependência linear (cada migração
depende da anterior já aplicada ao dev). **≤8 tasks: execução inline nesta sessão, sem oferta de
sub-agentes** (regra do skill, confirmada com o usuário nas instruções desta rodada).

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: DDL das 12 tabelas | 1 migração (1 arquivo SQL) + 1 arquivo de teste | ✅ Granular (cadeia de dependência interna única — ver `design.md` Tech Decisions) |
| T2: GRANT/RLS-disable | 1 migração + 1 arquivo de teste | ✅ Granular |
| T3: Seed 9 tabelas | 1 migração + 1 arquivo de teste | ✅ Granular |
| T4: Seed Coalizão | 1 migração + extensão de 1 arquivo de teste | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ----------------------- | -------------- | ------ |
| T1 | None | Fase 1, sem seta de entrada | ✅ Match |
| T2 | T1 | Fase 2 ← Fase 1 | ✅ Match |
| T3 | T1 | Fase 3 ← Fase 1 (via tabelas já criadas); ordenado depois de T2 só por convenção de fase, sem dependência real de GRANT | ✅ Match (nota: T3 não depende de T2 tecnicamente, mas a ordem de fase é preservada por clareza de revisão — não é uma dependência falsa, é sequenciamento deliberado) |
| T4 | T3 | Fase 4 ← Fase 3 | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | ---------------------------- | ----------------- | ---------- | ------ |
| T1: DDL 12 tabelas | Migração DDL | integration | integration | ✅ OK |
| T2: GRANT/RLS-disable | Migração GRANT/RLS-disable | integration | integration | ✅ OK |
| T3: Seed 9 tabelas | Migração seed | integration | integration | ✅ OK |
| T4: Seed Coalizão | Migração seed | integration | integration | ✅ OK |

---

## Tools

Nenhum MCP de banco está conectado nesta sessão (Supabase CLI via Bash cobre 100% da necessidade:
`migration new`, `db push`, `db query --linked`). `claude.ai Slack`/`claude.ai Supabase` MCP aparecem
como exigindo autorização interativa — não usados nesta feature, que não precisa deles. Skill
`supabase` carregada por referência quando a sintaxe exata de algum comando precisar de confirmação.

---

## Notes fora do código (rastreamento, sem task)

- **CAT-16** (levantamento com Monitoramento: `ref_agenda_tematica`, `ref_indicador`, `ref_tipologia`)
  — sem task nesta feature. As 3 tabelas nascem vazias em T1; conteúdo é trabalho humano futuro.
- **Regeneração de `database.types.ts`** — deliberadamente fora desta feature (decisão já registrada
  em `design.md` Tech Decisions: não há consumidor de aplicação nesta fatia). Quem construir a
  primeira tela/feature que leia estas 12 tabelas deve rodar `npm run db:types` como parte daquele
  trabalho, não deste.
