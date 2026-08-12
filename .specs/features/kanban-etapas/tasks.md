# Kanban de Etapas Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute
flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source
of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier,
discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/kanban-etapas/design.md`
**Status**: Approved

---

## Test Coverage Matrix

> Generated from codebase sampling (`supabase/tests/**/*.integration.test.ts`,
> `src/backend/**/*.test.ts`, `vitest.config.ts`, `vitest.integration.config.ts`) — no
> project-level testing guideline document exists beyond the commands in `CLAUDE.md`. Confirmed
> before Execute.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| DB — RLS/GRANT fix + audit trigger (T1, T2) | integration | Cada gap fechado (WITH CHECK explícito, GRANT column-scoped, trigger ligado) comprovado contra o Postgres real, mesmo padrão de `regua-rls.integration.test.ts`/`auditoria-gap.integration.test.ts` | `supabase/tests/kanban/*.integration.test.ts` | `npm run test:integration` |
| DB — RPC `app.mover_etapa_kanban` (T3) | integration | 1:1 com KAN-04/05/06/07/08/09 — avanço, retrocesso (papel certo e negado), salto não-adjacente, `SECURITY INVOKER` confirmado, auditoria gerada — mesmo padrão de `fn-substituir-vinculo.integration.test.ts` | `supabase/tests/kanban/fn-mover-etapa-kanban.integration.test.ts` | `npm run test:integration` |
| Backend queries (T4) | unit | Toda função exportada; filtros combináveis por AND; `id_etapa_atual IS NULL` tratado como etapa 1; resultado vazio — mock-client, mesmo padrão de `contrato.test.ts` | `src/backend/queries/kanban.test.ts` | `npm run test:unit` |
| Backend RPC wrapper + `errors.ts` (T5) | unit | Sucesso + cada código mapeado (`KAN01`, `42501`) + código não mapeado passa direto — mesmo padrão de `vinculo.test.ts` | `src/backend/rpc/kanban.test.ts` | `npm run test:unit` |
| Frontend — componentes (T7-T11) | none | Sem harness de componente neste projeto (`vitest.config.ts` só inclui `src/backend/**`) — débito já documentado (lições L-006/L-007, `plataforma-ui-tanstack`/`navegacao-por-produto`). Verificado por build+lint e UAT manual, registrado em `validation.md` | `src/frontend/**` | `npm run build` |
| Frontend — instalação de dependência (T6) | none | — (config, não lógica) | `src/frontend/package.json` | `npm run build` (gate only) |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após T4/T5 (só unit) | `npm run test:unit` |
| Full | Após T1/T2/T3 (integration) | `npm run test:integration && npm run test:unit` |
| Build | Após T6-T11 (frontend) e ao final de cada fase | `npm run build && npm run lint:all` |

---

## Execution Plan

Phases are ordered and run sequentially — each phase completes before the next begins, and tasks
within a phase execute in order.

### Phase 1: DB — fecha os 2 gaps de infraestrutura + auditoria

```
T1 → T2
```

### Phase 2: DB — função de transição

```
T3
```

### Phase 3: Backend TS — queries e RPC wrapper

```
T4 → T5
```

### Phase 4: Frontend — board e integração na tela

```
T6 → T7 → T8 → T9 → T10 → T11
```

---

## Task Breakdown

### T1: Migration — `WITH CHECK` explícito em `fat_contrato` + `GRANT UPDATE` column-scoped

**What**: Uma migration (`supabase migration new kanban_etapas_rls_grants`) que roda
`ALTER POLICY p_por_carteira ON fat_contrato WITH CHECK (app.papel_atual() IN ('admin','gestora') OR id_contrato = ANY(app.contratos_do_usuario()));`
e `GRANT UPDATE (status, dt_inicio, dt_conclusao) ON fat_etapa_contrato TO legisla_mentor, legisla_assessor;`
+ `GRANT UPDATE (id_etapa_atual) ON fat_contrato TO legisla_mentor, legisla_assessor;`
**Where**: `supabase/migrations/<timestamp>_kanban_etapas_rls_grants.sql`
**Depends on**: None
**Reuses**: predicado idêntico ao já usado em `p_por_carteira`/`p_por_contrato` (`0011_fundacao_rls.sql`, `20260812001234_regua_instanciacao_rls.sql`)
**Requirement**: KAN-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Migration aplicada via `supabase db push` no projeto de dev linkado (confirmar `supabase/.temp/project-ref` antes)
- [x] `pg_policies.with_check` de `p_por_carteira`/`fat_contrato` não é mais `NULL`
- [x] Mentor com vínculo ativo consegue `UPDATE status` direto em `fat_etapa_contrato` do seu contrato (antes falhava com 42501 por falta de GRANT); Mentor sem vínculo continua bloqueado
- [x] Mentor consegue `UPDATE id_etapa_atual` direto em `fat_contrato` do seu contrato; não consegue em outras colunas (`status`, por ex.)
- [x] Gate check passa: `npm run test:integration`
- [x] Test count: 4 testes novos (with_check não-nulo, mentor grant fat_etapa_contrato ok/nega, mentor grant fat_contrato coluna certa)

**Tests**: integration
**Gate**: full

**Commit**: `fix(kanban-etapas): WITH CHECK explícito em fat_contrato + GRANT UPDATE column-scoped pra mentor/assessor` — `d355788`

**Status**: ✅ Complete. SPEC_DEVIATION documentado inline: o GRANT novo fez `regua-rls.integration.test.ts`
(RGI-08) regredir de propósito errado (o `.update()` que o teste exercia passou a funcionar
legitimamente); trocado para o `.insert()` que o título do teste sempre disse testar. Corrigido no
mesmo commit.

---

### T2: Migration — liga `trg_audit_fat_etapa_contrato`

**What**: Uma migration que executa
`CREATE TRIGGER trg_audit_fat_etapa_contrato AFTER INSERT OR UPDATE OR DELETE ON fat_etapa_contrato FOR EACH ROW EXECUTE FUNCTION app.trg_auditoria('id_etapa_contrato');`
(guardado com `IF NOT EXISTS` no `pg_trigger`, mesmo padrão de `0012_fundacao_auditoria_gap.sql`).
**Where**: `supabase/migrations/<timestamp>_kanban_etapas_audit_trigger.sql`
**Depends on**: None (independente de T1 — mesma fase, ordem só por conveniência de revisão)
**Reuses**: `app.trg_auditoria()` (já provisionada, `0012_fundacao_auditoria_gap.sql`)
**Requirement**: KAN-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Trigger existe em `pg_trigger` com o argumento `'id_etapa_contrato'` correto (`pg_get_triggerdef`)
- [x] INSERT/UPDATE/DELETE em `fat_etapa_contrato` gera exatamente as 3 linhas esperadas em `log_auditoria` (`acao` = insert/update/delete), mesmo padrão de `auditoria-gap.integration.test.ts`
- [x] Gate check passa: `npm run test:integration`
- [x] Test count: 2 testes novos

**Tests**: integration
**Gate**: full

**Commit**: `feat(kanban-etapas): liga trigger de auditoria genérico em fat_etapa_contrato` — `c34137c`

**Status**: ✅ Complete.

---

### T3: Migration — `app.mover_etapa_kanban` (RPC, `SECURITY INVOKER`)

**What**: Cria a função `app.mover_etapa_kanban(p_id_contrato BIGINT, p_id_etapa_destino BIGINT) RETURNS void` com a lógica completa de avanço/retrocesso/rejeição descrita em `design.md` → Components → "DB — `app.mover_etapa_kanban`".
**Where**: `supabase/migrations/<timestamp>_kanban_etapas_fn_mover_etapa.sql`
**Depends on**: T1 (sem o GRANT/WITH CHECK, os testes de avanço por Mentor falhariam por causa raiz errada), T2 (testes de auditoria da própria função dependem do trigger já ligado)
**Reuses**: estilo/estrutura de `app.substituir_vinculo` (`0017_fn_substituir_vinculo.sql`); `app.papel_atual()`, `ref_etapa`
**Requirement**: KAN-04, KAN-05, KAN-06, KAN-07, KAN-08, KAN-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `prosecdef = false` (confirmado via `pg_proc`, é `SECURITY INVOKER`)
- [x] Avanço (etapa 1, `id_etapa_atual IS NULL` → etapa 2): etapa 1 fica `concluida`/`dt_conclusao = hoje`, etapa 2 fica `em_andamento`/`dt_inicio = hoje`, `fat_contrato.id_etapa_atual` atualizado
- [x] Avanço encadeado (etapa 2 → etapa 3) funciona a partir de `id_etapa_atual` não-nulo
- [x] Avanço não-adjacente (etapa 1 → etapa 3) rejeitado com código `KAN01`, nenhuma linha alterada
- [x] Retrocesso (etapa 2 → etapa 1) por Admin/Gestora: etapa 1 reabre (`em_andamento`, `dt_conclusao = NULL`), etapa 2 zera (`nao_iniciada`, `dt_inicio = NULL`, `dt_conclusao = NULL`)
- [x] Retrocesso tentado por Mentor/Assessor com vínculo: rejeitado com `42501`, nenhuma linha alterada
- [x] Avanço por Mentor com vínculo ativo: permitido (prova que T1 realmente desbloqueou a US)
- [x] Avanço tentado num contrato sem vínculo do usuário: rejeitado (mensagem genérica, sem revelar existência)
- [x] Cada avanço/retrocesso bem-sucedido gera linhas correspondentes em `log_auditoria` (via trigger de T2, sem INSERT explícito no código da função)
- [x] Gate check passa: `npm run test:integration`
- [x] Test count: 9 testes novos

**Tests**: integration
**Gate**: full

**Commit**: `feat(kanban-etapas): app.mover_etapa_kanban -- RPC SECURITY INVOKER de transição de etapa` — `8ede5c1`

**Status**: ✅ Complete. `database.types.ts` regenerado (`npm run db:types`) no mesmo commit.

---

### T4: `src/backend/queries/kanban.ts` — leitura do board e filtros

**What**: `buscarBoardKanban(client, idProduto, filtro?)` (colunas `ref_etapa` + cards `fat_contrato` posicionados, filtros papel/pessoa/projeto/minha-carteira combinados por AND) e `buscarProjetosDoProduto(client, idProduto)`.
**Where**: `src/backend/queries/kanban.ts`
**Depends on**: None (lê tabelas já existentes; não depende das migrations de T1-T3)
**Reuses**: padrão de join manual + filtro combinável de `src/backend/queries/contrato.ts` (`buscarContratosAtivosPorProduto`, `contarContratosEAssessoresAtivos`); mock-client de `contrato.test.ts`
**Requirement**: KAN-01, KAN-02, KAN-03, KAN-10

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `buscarBoardKanban` retorna uma coluna por `ref_etapa` do produto, ordenada por `ordem`
- [x] Card de contrato com `id_etapa_atual` preenchido cai na coluna certa; card com `id_etapa_atual IS NULL` cai na coluna `ordem = 1`
- [x] Filtro por papel+pessoa, projeto e "minha carteira" cada um restringe corretamente isoladamente, e dois juntos aplicam AND (não OR)
- [x] `diasNaEtapaAtual` usa `fat_etapa_contrato.dt_inicio` da etapa atual quando setado, senão `fat_contrato.dt_inicio` (regra do design.md)
- [x] `buscarProjetosDoProduto` retorna só projetos distintos entre os contratos do produto
- [x] Produto sem nenhum contrato retorna colunas vazias (`cards: []`), nunca lança
- [x] Gate check passa: `npm run test:unit`
- [x] Test count: 12 testes novos (2 acima da estimativa de 10)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(kanban-etapas): buscarBoardKanban + buscarProjetosDoProduto` — `98ba773`

**Status**: ✅ Complete.

---

### T5: `src/backend/rpc/kanban.ts` + extensão de `errors.ts`

**What**: `moverEtapaKanban(client, { idContrato, idEtapaDestino })` chamando `.schema("app").rpc("mover_etapa_kanban", ...)`; nova classe `TransicaoInvalidaError` em `errors.ts` mapeando o código `KAN01`.
**Where**: `src/backend/rpc/kanban.ts` (novo), `src/backend/rpc/errors.ts` (editado)
**Depends on**: T3 (a função no banco precisa existir com a assinatura final antes do wrapper travar nela — mas o teste unitário usa mock, então na prática só a ASSINATURA de `design.md` é necessária; ordem de dependência é por precisão de contrato, não por bloqueio técnico de teste)
**Reuses**: `mapeiaErroRpc`, padrão de `src/backend/rpc/vinculo.ts`/`vinculo.test.ts`
**Requirement**: KAN-04, KAN-07, KAN-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Sucesso: chama `rpc("mover_etapa_kanban", { p_id_contrato, p_id_etapa_destino })` com os params corretos
- [x] `KAN01` → lança `TransicaoInvalidaError`
- [x] `42501` → lança `PermissaoNegadaError` (reuso, sem linha nova em `MENSAGENS_*`)
- [x] Código não mapeado é relançado sem alteração
- [x] Gate check passa: `npm run test:unit`
- [x] Test count: 4 testes novos

**Tests**: unit
**Gate**: quick

**Commit**: `feat(kanban-etapas): moverEtapaKanban + TransicaoInvalidaError (KAN01)` — `093c46f`

**Status**: ✅ Complete. Único achado desta task: o batch worker original (T1-T5) caiu por limite de
sessão da API no meio desta task — `rpc/kanban.ts` já existia, mas `errors.ts` e o teste próprio
ainda não. Concluído inline pelo orquestrador (sem sub-agente novo) depois de validar T1-T4 com o
gate real.

---

### T6: Instala `@dnd-kit/core` + `@dnd-kit/utilities`

**What**: `npm install @dnd-kit/core @dnd-kit/utilities --workspace=frontend`.
**Where**: `src/frontend/package.json`, `package-lock.json`
**Depends on**: None
**Reuses**: N/A (primeira lib de drag-and-drop do projeto, AD-034)
**Requirement**: KAN-01 (pré-requisito técnico do board)

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `@dnd-kit/core` e `@dnd-kit/utilities` aparecem em `src/frontend/package.json` dependencies
- [x] `npm run build` continua verde (nenhum conflito de peer dep com React 19.2.4/Next 16.2.12)

**Tests**: none
**Gate**: build

**Commit**: `chore(kanban-etapas): instala @dnd-kit/core + @dnd-kit/utilities (AD-034)` — `2df7f79`

**Status**: ✅ Complete. `npm run lint:all` mantém a baseline pré-existente de 27 problemas (13
erros, 14 warnings) documentada em `.specs/STATE.md` — nenhum novo, gate tratado como verde pelo
mesmo critério já usado em features anteriores (lint escopado às mudanças da feature).

---

### T7: `kanban-card.tsx`

**What**: Componente de apresentação do card — nome do contratante, badge de status quando `statusContrato !== 'ativo'`, "há N dias na etapa atual".
**Where**: `src/frontend/components/kanban/kanban-card.tsx`
**Depends on**: T4 (usa o shape `CardKanban`)
**Reuses**: `Badge` (shadcn), mesmo padrão visual de `STATUS_VARIANT`/`STATUS_LABEL` já usado em `contratos/[id]/etapas/[codigo]/page.tsx`
**Requirement**: KAN-01 (AC4)

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Renderiza nome do contratante e "há N dias" sempre
- [x] Mostra badge visual quando `statusContrato` é `concluido`/`nao_concluido`, sem esconder o card
- [x] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(kanban-etapas): componente de apresentação do card` — `a729a7e`

**Status**: ✅ Complete. Puramente apresentacional, sem `useDraggable` -- o drag é wireado em T8
(ver Assumptions de T8 abaixo), conforme a ordem de dependência já definida em tasks.md (T7 não
depende de T6/`@dnd-kit`; T8 depende de T6 e T7).

---

### T8: `kanban-coluna.tsx`

**What**: Componente de coluna — cabeçalho com nome da etapa, área `useDroppable` (`@dnd-kit/core`) contendo a lista de `KanbanCard`.
**Where**: `src/frontend/components/kanban/kanban-coluna.tsx`
**Depends on**: T6, T7
**Reuses**: `Card`/`CardHeader` (shadcn)
**Requirement**: KAN-01 (AC1)

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Renderiza o nome da etapa e todos os cards da coluna
- [x] `useDroppable` expõe um `id` que o board consegue resolver de volta pro `idEtapa`
- [x] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(kanban-etapas): componente de coluna droppable` — `fda180b`

**Status**: ✅ Complete. `useDroppable({ id: coluna.idEtapa })` -- o id do droppable É o idEtapa
(identidade, sem payload extra necessário). Cada card é envolto num `useDraggable({ id:
card.idContrato })` local a este arquivo (`KanbanCardArrastavel`), decisão de onde o drag do card
vive (ver nota em T7).

---

### T9: `kanban-board.tsx` — orquestração de drag-and-drop

**What**: `DndContext` + `useQuery(buscarBoardKanban)` + `useMutation(moverEtapaKanban)` com atualização otimista/rollback, guard client-side de adjacência e de papel (via `usePapelGlobal`), toast de rejeição.
**Where**: `src/frontend/components/kanban/kanban-board.tsx`
**Depends on**: T4, T5, T8
**Reuses**: `usePapelGlobal` (`src/frontend/hooks/use-papel-global.ts`), `<CarregandoSkeleton>`/`<ErroInline>`/`<EstadoVazio>`, `sonner` (toast já montado no layout raiz, AD-029)
**Requirement**: KAN-01, KAN-04, KAN-05, KAN-06, KAN-07, KAN-08, KAN-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Board renderiza colunas+cards a partir de `buscarBoardKanban`
- [x] `onDragEnd`: coluna não-adjacente OU retrocesso por não-admin/gestora → toast de rejeição, nenhum request, card volta pra posição original
- [x] `onDragEnd` válido → `useMutation` com atualização otimista do cache; `onError` restaura o snapshot anterior (Edge Case: "devolve o card pra posição original"); `onSettled` invalida a query do board
- [x] Estados padrão (`<CarregandoSkeleton>`/`<EstadoVazio>`) cobrem carregando e produto sem etapas
- [x] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(kanban-etapas): KanbanBoard -- dnd-kit + mutation otimista + guards client-side` — `60e2495`

**Status**: ✅ Complete. `onSettled` invalida só a query do board (`["kanban-board", idProduto,
filtro]`) -- o "e a de `buscarReguaDoContrato`" do design.md não se aplica: essa tela
(`contratos/[id]/etapas/[codigo]/page.tsx`) usa `useEffect`+`useState` puro, não TanStack Query, sem
queryKey para invalidar; ela já refaz o fetch no próximo mount. Segue o "Done when" literal de T9
(que só pede invalidar a query do board), não a prosa mais ampla do design.md. Toasts de
`KAN01`/`42501` no `onError` reusam `new TransicaoInvalidaError().message`/`new
PermissaoNegadaError().message` (mesma mensagem do guard client-side e da rejeição servidor,
DRY).

---

### T10: Filtro do board — projeto + "Minha carteira"

**What**: Estende a barra de filtro já existente em `ProdutoDashboardPage` (papel+pessoa) com um `Select` de projeto (`buscarProjetosDoProduto`) e um `Switch`/`Checkbox` "Minha carteira".
**Where**: `src/frontend/app/(app)/produtos/[slug]/dashboard/page.tsx` (editado)
**Depends on**: T4
**Reuses**: `Select`/`Switch` (shadcn), o próprio filtro papel+pessoa já implementado nesse arquivo
**Requirement**: KAN-03, KAN-10

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Select de projeto lista só projetos com contrato no produto atual
- [x] "Minha carteira" combina por AND com papel+pessoa/projeto quando todos estão ativos
- [x] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(kanban-etapas): filtro de projeto + minha carteira no Dashboard do produto` — `8655c3d`

**Status**: ✅ Complete. SPEC_DEVIATION documentado inline no commit e no código:
`design.md` assumia "Switch/Checkbox (shadcn)" já instalado; nenhum dos dois existia em
`components/ui/`. Adicionado `src/frontend/components/ui/switch.tsx` usando o primitivo `Switch` já
disponível via `radix-ui` (dependência existente, mesmo import unificado de `select.tsx`/
`label.tsx`) -- nenhum `npm install` novo necessário. A combinação AND real (`filtroBoard`) é
computada em T11, não aqui: computá-la em T10 sem consumidor ainda geraria `no-unused-vars` no gate
de lint (a checagem de "combina por AND" desta task foi feita por leitura de código +
`npm run build` tipando `FiltroBoard` corretamente, já que T10 não tem harness de componente
para exercitar a combinação em runtime -- mesmo débito de T6-T11 registrado na Test Coverage
Matrix).

---

### T11: Substitui o placeholder pelo `KanbanBoard`

**What**: Remove `<EmDesenvolvimento>` de `ProdutoDashboardPage` e renderiza `<KanbanBoard idProduto={produto.idProduto} filtro={filtro} />` no lugar, mantendo os 2 cards de contagem acima.
**Where**: `src/frontend/app/(app)/produtos/[slug]/dashboard/page.tsx` (editado)
**Depends on**: T9, T10
**Reuses**: nada novo — é a integração final
**Requirement**: KAN-01 a KAN-10 (ponto de entrada de todas)

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `<EmDesenvolvimento>` removido de `ProdutoDashboardPage`
- [x] `<KanbanBoard>` recebe o `idProduto` do produto atual e o `filtro` combinado do T10
- [x] Gate check passa: `npm run build && npm run lint:all`

**Tests**: none
**Gate**: build

**Commit**: `feat(kanban-etapas): board substitui o placeholder no Dashboard do produto` — `de8c3cf`

**Status**: ✅ Complete. `filtroBoard` (KAN-03/KAN-10, AND das 3 dimensões) passou a existir aqui,
junto do seu único consumidor (`<KanbanBoard filtro={filtroBoard} />`) -- ver nota de T10 sobre por
que a combinação não foi materializada uma task antes. `<KanbanBoard>` só é montado quando
`produto` já resolveu (`useProdutoAtual`), evitando passar `idProduto` indefinido; `EmDesenvolvimento`
continua em uso em outras 5 páginas (grep confirmado), nada órfão.

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:  T1 ──→ T2
Phase 2:  T3
Phase 3:  T4 ──→ T5
Phase 4:  T6 ──→ T7 ──→ T8 ──→ T9 ──→ T10 ──→ T11
```

Execution is strictly sequential — there is no intra-phase parallelism.

**Batching (11 tasks > ~8 → sub-agents, offer aceita por instrução prévia do usuário — "assumir
sempre a opção recomendada", sem pausar para perguntar):**

- **Batch 1** (Phases 1+2+3, 5 tasks): T1 → T2 → T3 → T4 → T5
- **Batch 2** (Phase 4, 6 tasks): T6 → T7 → T8 → T9 → T10 → T11

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: RLS/GRANT fix | 1 migration | ✅ Granular |
| T2: audit trigger | 1 migration | ✅ Granular |
| T3: RPC function | 1 função | ✅ Granular |
| T4: queries | 1 arquivo, 2 funções coesas | ✅ Granular |
| T5: RPC wrapper + errors | 1 arquivo novo + 1 edição coesa | ✅ Granular |
| T6: install deps | 1 mudança de config | ✅ Granular |
| T7: card | 1 componente | ✅ Granular |
| T8: coluna | 1 componente | ✅ Granular |
| T9: board | 1 componente (orquestração) | ✅ Granular |
| T10: filtro | 1 edição coesa de arquivo existente | ✅ Granular |
| T11: integração final | 1 edição coesa de arquivo existente | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Fase 1 início, sem seta de entrada | ✅ Match |
| T2 | None | Fase 1, `T1 → T2` (ordem de revisão, não bloqueio real) | ✅ Match |
| T3 | T1, T2 | Fase 2 após Fase 1 | ✅ Match |
| T4 | None | Fase 3 início | ✅ Match |
| T5 | T3 | Fase 3, `T4 → T5`; T3 é de fase anterior | ✅ Match |
| T6 | None | Fase 4 início | ✅ Match |
| T7 | T4 | Fase 4, `T6 → T7`; T4 é de fase anterior | ✅ Match |
| T8 | T6, T7 | Fase 4, `T7 → T8` | ✅ Match |
| T9 | T4, T5, T8 | Fase 4, `T8 → T9` | ✅ Match |
| T10 | T4 | Fase 4, `T9 → T10` (ordem de execução, não bloqueio — T10 só depende de T4) | ✅ Match |
| T11 | T9, T10 | Fase 4, `T10 → T11` | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | DB RLS/GRANT | integration | integration | ✅ OK |
| T2 | DB audit trigger | integration | integration | ✅ OK |
| T3 | DB RPC function | integration | integration | ✅ OK |
| T4 | Backend queries | unit | unit | ✅ OK |
| T5 | Backend RPC wrapper + errors | unit | unit | ✅ OK |
| T6 | Frontend dependency install | none | none | ✅ OK |
| T7 | Frontend component | none | none | ✅ OK |
| T8 | Frontend component | none | none | ✅ OK |
| T9 | Frontend component | none | none | ✅ OK |
| T10 | Frontend page edit | none | none | ✅ OK |
| T11 | Frontend page edit | none | none | ✅ OK |
