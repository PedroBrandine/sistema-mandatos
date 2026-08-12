# G1 + G2 — Primeira Fatia de Visão Gerencial Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its
Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is
the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review,
Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/visao-gerencial-g1-g2/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase sampling (`supabase/tests/catalogos/catalogos-referencia-grants.integration.test.ts`,
> `supabase/tests/operacao/regua-instanciacao.integration.test.ts`, `src/backend/queries/kanban.test.ts`)
> + `CLAUDE.md`. No project-wide coverage-threshold config found (no `jest.config`/`.nycrc`/CI gate
> beyond green tests) — strong default applied where no sample exists (frontend: none, confirmed
> project debt L-006/L-007, no component harness).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| DB — DDL/constraints (`ref_peso_etapa`, views novas) | integration | Shape (colunas/constraints) + smoke fixture confirmando o comportamento do AC (ex.: soma/mediana correta sobre dado real) | `supabase/tests/visao-gerencial/*.integration.test.ts` | `npm run test:integration` |
| DB — GRANT/RLS-disable | integration | Todo papel do design.md testado (SELECT concedido/negado), `anon` sempre excluído (AD-002) — mesmo padrão de `catalogos-referencia-grants.integration.test.ts` | `supabase/tests/visao-gerencial/*.integration.test.ts` | `npm run test:integration` |
| Backend queries (`buscarCarteiraPonderada`, `buscarCicloEtapa`) | unit | 1:1 com as ACs de GG-03 a GG-06 + todo Edge Case listado em `spec.md` que a função cobre | `src/backend/queries/visao-gerencial.test.ts` | `npm run test:unit` |
| Frontend (componentes + página) | none | Sem harness de componente no projeto (débito conhecido, lições L-006/L-007) — gate só por build+lint | `src/frontend/**` | `npm run build && npm run lint:all` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Depois de tasks só com teste unitário (Fase 3) | `npm run test:unit` |
| Full | Depois de tasks com migration/teste de integração (Fases 1-2) | `npm run test:integration && npm run test:unit` |
| Build | Depois de tasks de frontend (Fase 4) e ao fechar cada fase | `npm run build && npm run lint:all` |

---

## Execution Plan

### Phase 1: `ref_peso_etapa` (catálogo GRANT-only, AD-030)

```
T1 → T2 → T3
```

### Phase 2: Views da camada Saída

```
T4 → T5 → T6 → T7
```

### Phase 3: Backend (TypeScript)

```
T8 → T9 → T10
```

### Phase 4: Frontend

```
T11 → T12 → T13
```

---

## Task Breakdown

### T1: DDL de `ref_peso_etapa`

**What**: Migration `CREATE TABLE ref_peso_etapa (id_etapa PK/FK, peso NUMERIC(5,2) NOT NULL DEFAULT 1, CHECK peso > 0)`.
**Where**: `supabase/migrations/<timestamp>_visao_gerencial_peso_etapa_estrutura.sql`
**Depends on**: None
**Reuses**: Padrão `CREATE TABLE IF NOT EXISTS` de `20260810191659_catalogos_referencia_estrutura.sql`
**Requirement**: GG-02

**Tools**: MCP: NONE (nenhum MCP disponível neste projeto — Context7 indisponível, AD-034) · Skill: NONE

**Done when**:
- [x] Tabela criada com `id_etapa BIGINT PRIMARY KEY REFERENCES ref_etapa(id_etapa)` e `peso NUMERIC(5,2) NOT NULL DEFAULT 1`
- [x] `CHECK (peso > 0)` presente
- [x] `supabase db push` aplica sem erro no projeto de dev
- [x] Teste de integração confirma colunas/constraint (insert com peso negativo rejeitado)

**Tests**: integration
**Gate**: full
**Commit**: `feat(visao-gerencial-g1-g2): T1 -- DDL ref_peso_etapa`

---

### T2: GRANT-only + RLS-disable de `ref_peso_etapa`

**What**: Migration com `DISABLE ROW LEVEL SECURITY`, re-GRANT em bloco (AD-025) pra `legisla_app/admin/gestora`, `GRANT SELECT` pra `authenticated + legisla_mentor + legisla_assessor`, `REVOKE ALL FROM anon` e `REVOKE INSERT,UPDATE,DELETE FROM authenticated` (defesa em profundidade, mesmo padrão de `20260810193545_catalogos_referencia_revoke_default_privileges.sql`).
**Where**: `supabase/migrations/<timestamp>_visao_gerencial_peso_etapa_grants.sql`
**Depends on**: T1
**Reuses**: `20260810192209_catalogos_referencia_grants.sql` + `20260810193545_catalogos_referencia_revoke_default_privileges.sql` (combinados num só arquivo — o achado que motivou o 2º arquivo na Trilha C já é conhecido aqui, não precisa de migration de correção separada)
**Requirement**: GG-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] `authenticated` + 5 roles `legisla_*` têm `SELECT`
- [x] `legisla_app/admin/gestora` têm `INSERT/UPDATE/DELETE`
- [x] `anon` não tem nenhum privilégio (`REVOKE ALL`)
- [x] `authenticated` não tem `INSERT/UPDATE/DELETE`
- [x] Teste de integração cobre os 4 pontos acima via `has_table_privilege` (mesmo padrão de `catalogos-referencia-grants.integration.test.ts`)

**Tests**: integration
**Gate**: full
**Commit**: `feat(visao-gerencial-g1-g2): T2 -- grants ref_peso_etapa (AD-030)`

---

### T3: Seed de `ref_peso_etapa`

**What**: `INSERT INTO ref_peso_etapa (id_etapa, peso) SELECT id_etapa, 1 FROM ref_etapa ON CONFLICT (id_etapa) DO NOTHING`.
**Where**: `supabase/migrations/<timestamp>_visao_gerencial_peso_etapa_seed.sql`
**Depends on**: T2
**Reuses**: Padrão idempotente `ON CONFLICT DO NOTHING` de `20260810193327_catalogos_referencia_seed.sql`
**Requirement**: GG-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] Toda linha de `ref_etapa` hoje existente tem uma linha correspondente em `ref_peso_etapa` com `peso = 1`
- [x] Reexecutar a migration não duplica nem falha (idempotência)
- [x] Teste de integração confirma `COUNT(ref_peso_etapa) = COUNT(ref_etapa)` e todo `peso = 1`

**Tests**: integration
**Gate**: full
**Commit**: `feat(visao-gerencial-g1-g2): T3 -- seed peso=1 em ref_peso_etapa`

---

### T4: `vw_carteira` reduzida (AD-032 + adendo)

**What**: `CREATE VIEW vw_carteira WITH (security_invoker = true)` — definição aprovada
(`docs/schema_sistema.sql:1327-1349`) **sem** `iip_provisorio`/`nr_fatos`/`LEFT JOIN mv_iip_contrato`
e **sem** `dt_ultimo_registro` (adendo à AD-032 registrado em `.specs/STATE.md` nesta sessão — a
subquery original lê `fat_registro`, não provisionada).
**Where**: `supabase/migrations/<timestamp>_visao_gerencial_vw_carteira.sql`
**Depends on**: None
**Reuses**: Estrutura de `vw_etapa_contrato` (`security_invoker = true`, `CREATE OR REPLACE VIEW`)
**Requirement**: GG-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] View criada com as colunas do design.md (sem as 3 omitidas)
- [x] `CREATE VIEW` roda sem erro (sem depender de `mv_iip_contrato`/`fat_registro`)
- [x] Teste de integração confirma via `information_schema.columns`: as 3 colunas omitidas NÃO existem; as colunas esperadas existem
- [x] Teste de integração com fixture real (1 vínculo + 1 contrato ativo) retorna a linha esperada

**Tests**: integration
**Gate**: full
**Commit**: `feat(visao-gerencial-g1-g2): T4 -- vw_carteira reduzida (AD-032)`

---

### T5: `vw_carteira_ponderada` (G1)

**What**: `CREATE VIEW vw_carteira_ponderada` conforme `design.md` (Data Models) — 1 linha por
vínculo ativo × contrato ativo, `peso` resolvido via `COALESCE(id_etapa_atual, 1ª etapa do produto)`,
`LEFT JOIN ref_peso_etapa` (nunca `INNER JOIN` — preserva a lacuna de seed como `peso IS NULL`, não
some a linha).
**Where**: `supabase/migrations/<timestamp>_visao_gerencial_vw_carteira_ponderada.sql`
**Depends on**: T1 (precisa de `ref_peso_etapa` existir para o `LEFT JOIN` — não precisa do seed de T3)
**Reuses**: Padrão de `vw_carteira` (join com `rel_usuario_contrato`/`fat_contrato`/`ref_produto`)
**Requirement**: GG-05, GG-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] View criada, `security_invoker = true`
- [x] `WHERE c.status = 'ativo'`
- [x] `LEFT JOIN ref_peso_etapa` (peso `NULL` quando falta seed, linha não desaparece)
- [x] Teste de integração: fixture com 2 contratos ativos em etapas de peso diferente confirma peso correto por linha; fixture com `id_etapa_atual IS NULL` confirma peso da 1ª etapa (`ordem = 1`)

**Tests**: integration
**Gate**: full
**Commit**: `feat(visao-gerencial-g1-g2): T5 -- vw_carteira_ponderada (G1)`

---

### T6: `vw_ciclo_etapa` (G2)

**What**: `CREATE VIEW vw_ciclo_etapa` conforme `design.md` — view-on-view sobre `vw_etapa_contrato`,
`WHERE status = 'concluida'`, `dias_ciclo = dt_conclusao - dt_inicio`, `id_produto`/`nome_produto`/
`id_usuario_gestora`/`nome_gestora` denormalizados.
**Where**: `supabase/migrations/<timestamp>_visao_gerencial_vw_ciclo_etapa.sql`
**Depends on**: None (só usa objetos já existentes — `vw_etapa_contrato`, `fat_contrato`, `rel_usuario_contrato`, `dim_usuario`, `ref_produto`)
**Reuses**: `vw_etapa_contrato` (view-on-view, evita duplicar `JOIN ref_etapa`)
**Requirement**: GG-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] View criada, `security_invoker = true`
- [x] `WHERE vec.status = 'concluida'`
- [x] `dias_ciclo` calculado corretamente (`dt_conclusao - dt_inicio`)
- [x] Teste de integração: fixture com 2 contratos concluindo a mesma etapa em datas diferentes confirma os 2 `dias_ciclo` esperados; fixture com etapa `nao_iniciada`/`em_andamento` confirma que NÃO aparece na view

**Tests**: integration
**Gate**: full
**Commit**: `feat(visao-gerencial-g1-g2): T6 -- vw_ciclo_etapa (G2)`

---

### T7: Grants das 3 views novas

**What**: Migration de re-GRANT (AD-025: `GRANT ... ON ALL TABLES IN SCHEMA public TO legisla_app,
legisla_admin, legisla_gestora` de novo, agora cobrindo as 3 views) + `GRANT SELECT` explícito em
`vw_carteira, vw_carteira_ponderada, vw_ciclo_etapa` pra `legisla_mentor, legisla_assessor`.
**Where**: `supabase/migrations/<timestamp>_visao_gerencial_views_grants.sql`
**Depends on**: T4, T5, T6
**Reuses**: `20260812001310_regua_instanciacao_grants.sql` (mesmo padrão de re-GRANT)
**Requirement**: GG-01, GG-03, GG-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `legisla_app/admin/gestora` têm `SELECT` nas 3 views (via re-GRANT em bloco)
- [ ] `legisla_mentor/assessor` têm `SELECT` explícito nas 3 views
- [ ] Teste de integração cobre os 5 papéis × 3 views (`has_table_privilege`)

**Tests**: integration
**Gate**: full
**Commit**: `feat(visao-gerencial-g1-g2): T7 -- grants das views G1/G2`

---

### T8: Regenerar `database.types.ts`

**What**: Rodar `npm run db:types` — 1ª feature a expor `ref_peso_etapa`/`vw_carteira`/
`vw_carteira_ponderada`/`vw_ciclo_etapa` ao frontend.
**Where**: `src/backend/supabase/database.types.ts`
**Depends on**: T7
**Reuses**: Comando já existente (`package.json`)
**Requirement**: (infra — sustenta GG-03 a GG-06)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `database.types.ts` inclui os 4 objetos novos com as colunas corretas
- [ ] `npx tsc --noEmit` (ou `npm run build`) não gera erro de tipo relacionado

**Tests**: none
**Gate**: build
**Commit**: `chore(visao-gerencial-g1-g2): T8 -- regenera database.types.ts`

---

### T9: `buscarCarteiraPonderada` (G1)

**What**: Função em `src/backend/queries/visao-gerencial.ts` — busca `vw_carteira_ponderada`
filtrada por `papel_no_contrato` + `id_produto` opcional, agrega em TS por `id_usuario`: soma `peso`
(ignorando `NULL`), conta `qtdContratosSemPeso`, calcula `atingimentoMedio` (`AVG` ignorando `NULL`).
**Where**: `src/backend/queries/visao-gerencial.ts`
**Depends on**: T8
**Reuses**: Padrão de agregação em `Map` de `buscarBoardKanban` (`src/backend/queries/kanban.ts`)
**Requirement**: GG-05, GG-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Soma pondera corretamente por Gestora/Mentor (GG-05 AC1/AC2)
- [ ] Atingimento médio ignora `NULL` (GG-06 AC3)
- [ ] Gestora sem contrato ativo retorna `somaPeso: 0` (Edge Case — zero é contagem real)
- [ ] Contrato com peso `NULL` (lacuna de seed) é excluído da soma e contado em `qtdContratosSemPeso`, nunca assume peso 1
- [ ] `id_etapa_atual IS NULL` já resolvido pela view (T5) — teste confirma que a função não reintroduz lógica duplicada
- [ ] Gate: `npm run test:unit`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(visao-gerencial-g1-g2): T9 -- buscarCarteiraPonderada (G1)`

---

### T10: `buscarCicloEtapa` (G2)

**What**: Função em `src/backend/queries/visao-gerencial.ts` — busca `vw_ciclo_etapa` filtrada por
`id_produto`/`id_usuario_gestora` opcionais, agrupa em TS por `id_etapa`, calcula mediana de
`dias_ciclo` (`null` quando amostra vazia).
**Where**: `src/backend/queries/visao-gerencial.ts` (mesmo arquivo de T9)
**Depends on**: T9
**Reuses**: Mesmo arquivo/estilo de T9
**Requirement**: GG-03, GG-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Mediana calculada corretamente sobre 2+ ocorrências concluídas de uma mesma etapa (GG-03 AC1)
- [ ] Filtro por produto e por Gestora restringe a amostra sem misturar outro produto/Gestora na mesma mediana (GG-04 AC2)
- [ ] Etapa sem nenhuma ocorrência `concluida` retorna `mediana: null` (nunca `0`) (GG-03 AC3)
- [ ] Gate: `npm run test:unit`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(visao-gerencial-g1-g2): T10 -- buscarCicloEtapa (G2)`

---

### T11: `CarteiraPonderadaCard` (componente G1)

**What**: Componente que renderiza `buscarCarteiraPonderada` — cards por Gestora/Mentor (soma
ponderada + atingimento médio + alerta quando `qtdContratosSemPeso > 0`), filtro produto + papel.
**Where**: `src/frontend/components/visao-gerencial/carteira-ponderada-card.tsx`
**Depends on**: T9
**Reuses**: `<CarregandoSkeleton>`/`<ErroInline>`/`<EstadoVazio>` (AD-029), padrão de Select do filtro do Dashboard (`produtos/[slug]/dashboard/page.tsx`)
**Requirement**: GG-05, GG-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Mostra soma ponderada + atingimento médio por Gestora/Mentor
- [ ] Filtro produto + papel funcional
- [ ] Estados de carregando/erro/vazio cobertos
- [ ] `npm run build && npm run lint:all` limpo (mesma baseline pré-existente)

**Tests**: none
**Gate**: build
**Commit**: `feat(visao-gerencial-g1-g2): T11 -- CarteiraPonderadaCard (G1)`

---

### T12: `CicloEtapaCard` (componente G2)

**What**: Componente que renderiza `buscarCicloEtapa` — mediana por etapa (ou "sem dado suficiente"),
filtro produto + Gestora.
**Where**: `src/frontend/components/visao-gerencial/ciclo-etapa-card.tsx`
**Depends on**: T10
**Reuses**: Mesmo padrão de T11
**Requirement**: GG-03, GG-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Mostra mediana por etapa, "sem dado suficiente" quando `mediana === null`
- [ ] Filtro produto + Gestora funcional
- [ ] Estados de carregando/erro/vazio cobertos
- [ ] `npm run build && npm run lint:all` limpo

**Tests**: none
**Gate**: build
**Commit**: `feat(visao-gerencial-g1-g2): T12 -- CicloEtapaCard (G2)`

---

### T13: Página `/visao-gerencial` — monta G1 + G2 + link Kanban

**What**: Substitui o `<EmDesenvolvimento>` único do placeholder (NAV-13) por
`<CarteiraPonderadaCard>` + `<CicloEtapaCard>` + link pro Kanban do produto (via `PRODUTO_SLUGS`) +
`<EmDesenvolvimento titulo="G3-G6 em desenvolvimento" />` pro restante.
**Where**: `src/frontend/app/(app)/visao-gerencial/page.tsx` (arquivo já existe, rota não muda)
**Depends on**: T11, T12
**Reuses**: `PRODUTO_SLUGS`/`ProdutoSlug` (`src/backend/queries/produto.ts`)
**Requirement**: GG-07

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] G1 e G2 na mesma tela, cada um com seu filtro (P2 AC1)
- [ ] Link pro Kanban navega pro board do produto correto (`/produtos/{slug}/dashboard`) (P2 AC2)
- [ ] Placeholder "G3-G6 em desenvolvimento" visível (P2 AC3)
- [ ] `npm run build && npm run lint:all` limpo

**Tests**: none
**Gate**: build
**Commit**: `feat(visao-gerencial-g1-g2): T13 -- monta página de Visão Gerencial (G1+G2+link Kanban)`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:  T1 ──→ T2 ──→ T3
Phase 2:  T4 ──→ T5 ──→ T6 ──→ T7
Phase 3:  T8 ──→ T9 ──→ T10
Phase 4:  T11 ──→ T12 ──→ T13
```

Execução estritamente sequencial — sem paralelismo intra-fase.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: DDL `ref_peso_etapa` | 1 tabela | ✅ Granular |
| T2: Grants `ref_peso_etapa` | 1 migration, 1 propósito (acesso) | ✅ Granular |
| T3: Seed `ref_peso_etapa` | 1 migration | ✅ Granular |
| T4: `vw_carteira` reduzida | 1 view | ✅ Granular |
| T5: `vw_carteira_ponderada` | 1 view | ✅ Granular |
| T6: `vw_ciclo_etapa` | 1 view | ✅ Granular |
| T7: Grants das 3 views | 1 migration, 1 propósito | ✅ Granular |
| T8: `db:types` | 1 comando | ✅ Granular |
| T9: `buscarCarteiraPonderada` | 1 função | ✅ Granular |
| T10: `buscarCicloEtapa` | 1 função | ✅ Granular |
| T11: `CarteiraPonderadaCard` | 1 componente | ✅ Granular |
| T12: `CicloEtapaCard` | 1 componente | ✅ Granular |
| T13: Página `visao-gerencial` | 1 arquivo, wiring | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | — (início Fase 1) | ✅ Match |
| T2 | T1 | T1→T2 | ✅ Match |
| T3 | T2 | T2→T3 | ✅ Match |
| T4 | None | — (início Fase 2) | ✅ Match |
| T5 | T1 (cross-fase, Fase 1 já concluída) | T4→T5 (ordem de execução; dependência real é T1) | ✅ Match — execução sequencial garante T1 concluído antes |
| T6 | None (objetos pré-existentes) | T5→T6 (ordem de execução) | ✅ Match — execução sequencial, sem dependência real bloqueante |
| T7 | T4, T5, T6 | T6→T7 | ✅ Match |
| T8 | T7 | T7→T8 | ✅ Match |
| T9 | T8 | T8→T9 | ✅ Match |
| T10 | T9 | T9→T10 | ✅ Match |
| T11 | T9 (cross-fase, Fase 3 já concluída) | T10→T11 (ordem de execução; dependência real é T9) | ✅ Match |
| T12 | T10 (cross-fase) | T11→T12 (ordem de execução; dependência real é T10) | ✅ Match |
| T13 | T11, T12 | T12→T13 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | DB DDL | integration | integration | ✅ OK |
| T2 | DB GRANT/RLS-disable | integration | integration | ✅ OK |
| T3 | DB seed | integration | integration | ✅ OK |
| T4 | DB view | integration | integration | ✅ OK |
| T5 | DB view | integration | integration | ✅ OK |
| T6 | DB view | integration | integration | ✅ OK |
| T7 | DB GRANT | integration | integration | ✅ OK |
| T8 | Config/types (gerado) | none | none | ✅ OK |
| T9 | Backend query | unit | unit | ✅ OK |
| T10 | Backend query | unit | unit | ✅ OK |
| T11 | Frontend componente | none | none | ✅ OK |
| T12 | Frontend componente | none | none | ✅ OK |
| T13 | Frontend página | none | none | ✅ OK |

**Nenhuma violação.**
