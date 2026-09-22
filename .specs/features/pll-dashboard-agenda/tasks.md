# PLL — Dashboard e Agenda Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow
and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth
for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/pll-dashboard-agenda/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase sampling. Guidelines found: `CLAUDE.md` (root — comandos `test:unit`/
> `test:integration`), `src/frontend/AGENTS.md` (Next.js version note, sem regra de teste própria), AD-042
> (profundidade completa em tela de escrita) e AD-046 (profundidade reduzida em tela de leitura,
> `.specs/STATE.md`). Sample: `src/backend/queries/estrategia-kpi.test.ts`, `agenda.test.ts`,
> `src/frontend/components/estrategia/kpi-row.test.tsx` (não lido nesta sessão, inferido por convenção de
> nome espelhado), `supabase/tests/estrategia/vw-estrategia-kpi.integration.test.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Query functions (`src/backend/queries/*`) | unit | Caminho feliz por função exportada + AD-005 (null vs 0) + erro do banco propaga (padrão de `estrategia-kpi.test.ts:69,181`) | `src/backend/queries/*.test.ts` | `npm run test:unit` |
| Componentes de leitura (KPI, gráfico, tabela, feed, painéis) | unit (component) | AD-046: caminho feliz de cada AC — carregando, erro, vazio, com dado | `src/frontend/components/pll/*.test.tsx` | `npm run test:unit` |
| Config estática (`ABAS_POR_PRODUTO`) | none | build gate apenas | — | `npm run lint:all && npm run build` |
| Migration `origem_encerramento` + `CHECK` | integration | Constraint aceita/rejeita valor certo; `nao_concluido` sem origem falha | `supabase/tests/pll/*.integration.test.ts` | `npm run test:integration` |
| Páginas (`app/(app)/produtos/[slug]/dashboard,agenda`) | unit (component), profundidade AD-046 | Roteamento por slug (pll vs. outros) + composição dos blocos | `src/frontend/app/(app)/produtos/[slug]/**/*.test.tsx` | `npm run test:unit` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após task só de função/componente com teste unitário | `npm run test:unit` |
| Full | Após task de migration/RLS | `npm run test:unit && npm run test:integration` |
| Build | Fim de cada fase | `npm run lint:all && npm run build` |

---

## Execution Plan

### Phase 1: Fundação (schema + shell)
```
T1 → T2 → T3
```

### Phase 2: Camada de dados do Dashboard
```
T4 → T5 → T6 → T7
```

### Phase 3: UI do Dashboard
```
T8 → T9 → T10 → T11 → T12
```

### Phase 4: Agenda
```
T13 → T14 → T15
```

### Phase 5: Painéis analíticos (P2 — depende de `pll-cadastro-participantes` Fase 1 para T16)
```
T16 → T17 → T18 → T19
```

---

## Task Breakdown

### T1: Migration `fat_contrato.origem_encerramento`

**What**: Coluna nova + 2 `CHECK` (D-1), com verificação prévia de linhas existentes que quebrariam o
segundo `CHECK`.
**Where**: `supabase/migrations/<timestamp>_pll_origem_encerramento.sql`
**Depends on**: None
**Reuses**: padrão de `ALTER TABLE ... ADD CONSTRAINT` já usado em `20260812151909_*` (buscar exemplo antes de escrever)
**Requirement**: PLL-DB-03

**Tools**: MCP: `supabase` (se disponível) ou `Bash`/`PowerShell` com `supabase db push` em dev. Skill: `supabase`.

**Done when**:
- [x] `SELECT count(*) FROM fat_contrato WHERE status = 'nao_concluido'` rodado em dev **antes** de escrever a migration; se > 0, o `CHECK` entra `NOT VALID` + `VALIDATE CONSTRAINT` numa segunda migration, documentado no commit — deu 0, `CHECK` entrou validado direto
- [x] Coluna e os 2 `CHECK` criados
- [x] Teste de integração cobre: insert com `status='nao_concluido'` sem `origem_encerramento` falha; com falha; `status='ativo'` sem a coluna passa
- [x] `npm run test:integration` verde (arquivo isolado; ver nota de risco no commit sobre `atualizarStatusContrato`)

**Tests**: integration
**Gate**: full

**Commit**: `feat(schema): adiciona fat_contrato.origem_encerramento para status Desistente/Desligado do PLL`

---

### T2: `ABAS_POR_PRODUTO` + `ProdutoShell` por slug

**What**: Extrai a lista de abas para um config por `ProdutoSlug`, PLL com o conjunto próprio (Dashboard,
Agenda, Participantes, Avaliações, Fatos Geradores).
**Where**: `src/frontend/components/produtos/abas-por-produto.ts` (novo); `src/frontend/components/produtos/produto-shell.tsx` (modifica); `produto-shell.test.tsx` (modifica)
**Depends on**: None
**Reuses**: `PRODUTO_SLUGS`/`ProdutoSlug` de `@backend/queries/produto`
**Requirement**: PLL-SH-01, PLL-SH-03

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [x] `ABAS_POR_PRODUTO` exportado com as 3 chaves de `ProdutoSlug`
- [x] `ProdutoShell` consome o config em vez do array hardcoded
- [x] Teste: Estratégia e Coalizão continuam com as 5 abas de hoje (regressão); PLL mostra as 5 abas novas na ordem certa
- [x] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(produtos): abas por produto configuráveis, PLL ganha conjunto próprio`

---

### T3: Roteamento por slug nas páginas de Dashboard e Agenda

**What**: `app/(app)/produtos/[slug]/dashboard/page.tsx` e `.../agenda/page.tsx` renderizam o componente PLL
quando `slug === "pll"`, mantendo o componente atual para os outros dois.
**Where**: `src/frontend/app/(app)/produtos/[slug]/dashboard/page.tsx`, `.../agenda/page.tsx` (modifica);
testes correspondentes
**Depends on**: T2
**Reuses**: `ProdutoDashboardPage`/`ProdutoAgendaPage` existentes (sem alteração) para os outros 2 produtos
**Requirement**: PLL-SH-03, PLL-SH-04

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [x] `slug === "pll"` renderiza um componente placeholder próprio (populado nas fases seguintes); outros slugs inalterados
- [x] Teste de regressão: Estratégia/Coalizão continuam batendo com o snapshot/asserts atuais
- [x] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): roteia dashboard e agenda do PLL para componentes próprios`

---

### T4: `buscarPllKpis`

**What**: Função de leitura dos 5 KPIs (PLL-DB-02), com `origem_encerramento` resolvendo Desistente/Desligado.
**Where**: `src/backend/queries/pll-dashboard.ts` (novo); `pll-dashboard.test.ts`
**Depends on**: T1
**Reuses**: padrão de `buscarEstrategiaKpi`
**Requirement**: PLL-DB-02, PLL-DB-03, PLL-DB-04

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [x] `buscarPllKpis` retorna os 5 valores de `PllKpi` (design.md)
- [x] Teste: recorte sem contrato devolve `null`/`0` conforme AD-005 (nunca 0 travestido de ausência); erro do banco propaga
- [x] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): buscarPllKpis`

---

### T5: `buscarStatusMentoriaPorMes`

**What**: Série mensal de Encontros por status (PLL-DB-05), agregada em uma query (`GROUP BY` por mês).
**Where**: `src/backend/queries/pll-dashboard.ts` (mesmo arquivo de T4); `pll-dashboard.test.ts`
**Depends on**: T4
**Reuses**: `intervaloDoMes` de `agenda.ts`
**Requirement**: PLL-DB-05

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [x] Retorna 1 linha por mês da janela (6 meses), 4 contagens por status
- [x] Teste: mês sem Encontro entra com todas as contagens 0 (não omitido)
- [x] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): buscarStatusMentoriaPorMes`

---

### T6: `buscarMentoradosPll`

**What**: Tabela de mentorados com busca/filtro/ordenação (PLL-DB-07…10).
**Where**: `src/backend/queries/pll-dashboard.ts`; `pll-dashboard.test.ts`
**Depends on**: T4
**Reuses**: nenhum componente — query nova
**Requirement**: PLL-DB-07, PLL-DB-08, PLL-DB-09, PLL-DB-10

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [x] Retorna `MentoradoPll[]` com todas as colunas do design
- [~] Teste: busca por nome de mentorado e por parlamentar — **SPEC_DEVIATION**: reconciliado a favor do
  "Reuses" do design.md ("mesmo formato de paginação/ordenação client-side já usado em TabelaPendencias"),
  que contradiz este Done-when. `buscarMentoradosPll` NÃO recebe `busca`/`ordenacao` (mesmo padrão de
  `ListaMandatos`); o teste de busca real pertence ao componente `TabelaMentoradosPll` (T10, fora do Lote 1).
  Coberto aqui: célula sem mentor pareado vem `null` (AD-005) ✅.
- [x] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): buscarMentoradosPll`

---

### T7: `buscarRegistrosMentores`

**What**: Feed de Registros dos mentores, 10 mais recentes (PLL-DB-12…14).
**Where**: `src/backend/queries/pll-dashboard.ts`; `pll-dashboard.test.ts`
**Depends on**: T4
**Reuses**: mesma tabela `fat_registro` já lida em `registros-agenda.ts` (função nova, recorte diferente)
**Requirement**: PLL-DB-12, PLL-DB-13, PLL-DB-14

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [x] Retorna os 10 `fat_registro` mais recentes do recorte, ordenados por `ocorrido_em desc`
- [x] Teste: `resumo` nulo chega como `null` (vira `—` no componente)
- [x] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): buscarRegistrosMentores`

---

### T8: `PllKpiRow`

**What**: Componente dos 5 KPIs em 5 colunas (PLL-DB-02, PLL-DB-06).
**Where**: `src/frontend/components/pll/pll-kpi-row.tsx`; `.test.tsx`
**Depends on**: T4
**Reuses**: layout de `kpi-row.tsx` como referência visual
**Requirement**: PLL-DB-02, PLL-DB-06

**Tools**: MCP: `figma` (conferir `44:477` antes de fechar). Skill: `figma-dominio-legisla`.

**Done when**:
- [ ] 5 cards em 5 colunas dentro do contêiner (sem estourar margem — corrige o defeito do frame)
- [ ] Atingimento sem afordância de edição (AD-003); `—` quando não há planejamento
- [ ] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): PllKpiRow`

---

### T9: `PllStatusMensalChart`

**What**: Gráfico de barras empilhadas por mês/status (PLL-DB-05).
**Where**: `src/frontend/components/pll/pll-status-mensal-chart.tsx`; `.test.tsx`
**Depends on**: T5
**Reuses**: Recharts (mesma lib de `evolucao-mensal.tsx`)
**Requirement**: PLL-DB-05

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [ ] 4 séries empilhadas, cores conforme D-6 (paleta única com a Agenda)
- [ ] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): PllStatusMensalChart`

---

### T10: `TabelaMentoradosPll`

**What**: Tabela com busca, ordenação por coluna, paginação, navegação para `/contratos/[id]` (PLL-DB-07…11).
**Where**: `src/frontend/components/pll/tabela-mentorados-pll.tsx`; `.test.tsx`
**Depends on**: T6
**Reuses**: `Table`/`TableHeader` de `components/ui`
**Requirement**: PLL-DB-07…11

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [ ] Busca, ordenação por coluna clicável, `—` em célula ausente, clique navega para o contrato
- [ ] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): TabelaMentoradosPll`

---

### T11: `FeedRegistrosMentores`

**What**: Lista dos 10 registros, formatação de data relativa (Hoje/Ontem) (PLL-DB-12…14).
**Where**: `src/frontend/components/pll/feed-registros-mentores.tsx`; `.test.tsx`
**Depends on**: T7
**Reuses**: nenhum componente existente diretamente
**Requirement**: PLL-DB-12, PLL-DB-13, PLL-DB-14

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [ ] "Hoje às HH:mm" / "Ontem às HH:mm" / "DD Mmm, AAAA" conforme a regra; `—` para `resumo` nulo
- [ ] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): FeedRegistrosMentores`

---

### T12: Montagem do `PllDashboardPage`

**What**: Página real do Dashboard PLL — filtros (mentor/edição), os 4 blocos acima, erro por bloco (AD-029).
**Where**: `src/frontend/app/(app)/produtos/[slug]/dashboard/page.tsx` (substitui o placeholder de T3 quando `slug === "pll"`); `page.test.tsx`
**Depends on**: T8, T9, T10, T11
**Reuses**: `FiltroDashboard` como referência de composição (props próprias, ver D-4)
**Requirement**: PLL-DB-01

**Tools**: MCP: `figma`. Skill: `figma-dominio-legisla`.

**Done when**:
- [ ] Filtro por mentor(a)/edição recorta todos os 4 blocos
- [ ] Falha de 1 bloco não derruba os outros (`ErroInline` local)
- [ ] `npm run lint:all && npm run build && npm run test:unit` verdes

**Tests**: unit
**Gate**: build

**Commit**: `feat(pll): monta PllDashboardPage com filtros e os 4 blocos P1`

---

### T13: `FiltrosAgendaPll`

**What**: Filtro por mentor(a)/mentorado/edição para a Agenda (D-4, PLL-AG-08).
**Where**: `src/frontend/components/pll/filtros-agenda-pll.tsx`; `.test.tsx`
**Depends on**: None (paralelo à Fase 2/3)
**Reuses**: `filtros-agenda.tsx` como referência de Select múltiplo
**Requirement**: PLL-AG-08

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [ ] 3 Selects múltiplos, mesmo padrão visual da Agenda atual
- [ ] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): FiltrosAgendaPll`

---

### T14: Queries de opções de filtro (mentor/mentorado/edição)

**What**: `buscarOpcoesMentorPll`, `buscarOpcoesMentoradoPll`, `buscarOpcoesEdicaoPll`.
**Where**: `src/backend/queries/pll-agenda.ts` (novo); `pll-agenda.test.ts`
**Depends on**: None
**Reuses**: mesmo padrão de `buscarOpcoesGestora`/`buscarOpcoesProjeto` de `agenda.ts`
**Requirement**: PLL-AG-08

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [ ] 3 funções retornam `OpcaoAgenda[]` recortadas a contratos do produto PLL
- [ ] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): queries de opções de filtro da Agenda`

---

### T15: Montagem do `PllAgendaPage`

**What**: Página real da Agenda PLL — grade (`AgendaMes` reaproveitado), lista "Encontros do mês" (D-6),
"Novo agendamento" habilitado só com 1 mentorado no filtro (D-10).
**Where**: `src/frontend/app/(app)/produtos/[slug]/agenda/page.tsx` (substitui o placeholder de T3 quando
`slug === "pll"`); `page.test.tsx`
**Depends on**: T13, T14
**Reuses**: `AgendaMes`, `EncontroPopover`, `buscarEncontrosDoMes` sem alteração
**Requirement**: PLL-AG-01…12

**Tools**: MCP: `figma`. Skill: `figma-dominio-legisla`.

**Done when**:
- [ ] Grade mostra todas as semanas do mês (corrige o defeito do frame `379:4`)
- [ ] Lista renomeada para "Encontros do mês", colunas Status/Data/Título/Mentor(a) (D-6)
- [ ] Botão "Novo agendamento" segue a regra de D-10
- [ ] `npm run lint:all && npm run build && npm run test:unit` verdes

**Tests**: unit
**Gate**: build

**Commit**: `feat(pll): monta PllAgendaPage`

---

### T16: `buscarAnaliseParticipantePll` + `buscarAfinidadeAgendaPll`

**What**: Leitura agregada de `fat_cadastro_participante` (identidade de gênero, orientação, cor/raça, tempo
na política; 4 pautas + outras) — **depende da tabela existir** (Fase 1 de `pll-cadastro-participantes`).
**Where**: `src/backend/queries/pll-dashboard.ts`; `pll-dashboard.test.ts`
**Depends on**: T4; `pll-cadastro-participantes` T1 (schema)
**Reuses**: nenhum
**Requirement**: PLL-DB-15, PLL-DB-17

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [ ] Agrega por categoria com contagem/percentual; supressão quando n < 5 (D-13) já no retorno (`suprimido: boolean`)
- [ ] Se a tabela não existir ainda (bloqueio de dependência), a task fica em espera — não implementar contra tabela fictícia
- [ ] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): buscarAnaliseParticipantePll e buscarAfinidadeAgendaPll`

---

### T17: `buscarAnaliseMandatoPll`

**What**: 5 agregações do painel de mandato (cor/raça do parlamentar, partido, UF, cargos/mandatos
anteriores) — sem dependência externa (D-5 da spec-irmã só usada em T16).
**Where**: `src/backend/queries/pll-dashboard.ts`; `pll-dashboard.test.ts`
**Depends on**: T4
**Reuses**: `dim_mandato`, `fat_contrato`, `rel_mandato_candidatura` já existentes
**Requirement**: PLL-DB-16

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [ ] `ds_raca` nulo entra em "sem resposta"; partido além dos 8 maiores agrupa em "Outros"
- [ ] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): buscarAnaliseMandatoPll`

---

### T18: Componentes dos 3 painéis analíticos

**What**: `PainelAnaliseParticipante`, `PainelAnaliseMandato`, `PainelAfinidadeAgenda` — rosca com `n` no
centro (não "100%"), legenda com percentuais, estado "Dados insuficientes (n < 5)".
**Where**: `src/frontend/components/pll/painel-analise-*.tsx` (3 arquivos); `.test.tsx` correspondentes
**Depends on**: T16, T17
**Reuses**: biblioteca de gráfico já escolhida em T9 (Recharts)
**Requirement**: PLL-DB-15…19

**Tools**: MCP: `figma`. Skill: `figma-dominio-legisla`.

**Done when**:
- [ ] Centro da rosca mostra `n`; soma da legenda fecha 100% ±1
- [ ] `n < 5` mostra o estado de supressão em vez do gráfico
- [ ] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): painéis de análise do participante, mandato e afinidade`

---

### T19: Wire dos 3 painéis no `PllDashboardPage`

**What**: Inclui os 3 painéis na página, com estado "Em desenvolvimento" caso `pll-cadastro-participantes`
ainda não tenha a tabela (Error Handling do design).
**Where**: `src/frontend/app/(app)/produtos/[slug]/dashboard/page.tsx` (modifica, `slug === "pll"`); `page.test.tsx`
**Depends on**: T12, T18
**Reuses**: mesmo padrão de erro por bloco de T12
**Requirement**: PLL-DB-15…19

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [ ] 3 painéis aparecem abaixo do feed, na ordem do Figma
- [ ] `npm run lint:all && npm run build && npm run test:unit` verdes

**Tests**: unit
**Gate**: build

**Commit**: `feat(pll): integra painéis analíticos ao Dashboard`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

Phase 1:  T1 ──→ T2 ──→ T3
Phase 2:  T4 ──→ T5 ──→ T6 ──→ T7
Phase 3:  T8 ──→ T9 ──→ T10 ──→ T11 ──→ T12
Phase 4:  T13 ──→ T14 ──→ T15
Phase 5:  T16 ──→ T17 ──→ T18 ──→ T19
```

19 tasks totais → 3 batches de ~7 (Fase 1+2 = 7; Fase 3 = 5 + Fase 4 = 3 → 8; Fase 5 = 4). Empacotamento
sugerido: **Lote 1** = Fases 1–2 (T1–T7, 7 tasks); **Lote 2** = Fases 3–4 (T8–T15, 8 tasks); **Lote 3** =
Fase 5 (T16–T19, 4 tasks, só inicia depois que `pll-cadastro-participantes` Fase 1 estiver commitada).

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | 1 migration | ✅ Granular |
| T2 | 1 config + 1 componente | ✅ Granular (cohesivo — o config só existe para o componente consumir) |
| T3 | 2 arquivos de rota, mesma mudança | ✅ Granular |
| T4–T7 | 1 função cada | ✅ Granular |
| T8–T11 | 1 componente cada | ✅ Granular |
| T12 | 1 página (monta os 4 blocos já prontos) | ✅ Granular |
| T13–T14 | 1 componente / 1 arquivo de 3 funções coesas | ✅ Granular |
| T15 | 1 página | ✅ Granular |
| T16–T17 | 1 arquivo, funções relacionadas | ✅ Granular |
| T18 | 3 componentes irmãos, mesmo padrão | ⚠️ OK — cohesivo (mesmo padrão de rosca, mesmo commit já existente no design) |
| T19 | 1 página (wire) | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | — | ✅ |
| T2 | None | — | ✅ |
| T3 | T2 | T2→T3 | ✅ |
| T4 | T1 | (Fase 2 após Fase 1) | ✅ |
| T5 | T4 | T4→T5 | ✅ |
| T6 | T4 | (paralelo lógico, sequencial na fase) | ✅ |
| T7 | T4 | (idem) | ✅ |
| T8 | T4 | Fase 3 após Fase 2 | ✅ |
| T9 | T5 | idem | ✅ |
| T10 | T6 | idem | ✅ |
| T11 | T7 | idem | ✅ |
| T12 | T8,T9,T10,T11 | T8→T9→T10→T11→T12 | ✅ |
| T13 | None | Fase 4, sem dependência externa | ✅ |
| T14 | None | idem | ✅ |
| T15 | T13,T14 | T13→T14→T15 | ✅ |
| T16 | T4 + spec-irmã T1 | Fase 5 após Fase 2, nota de dependência externa | ✅ |
| T17 | T4 | idem | ✅ |
| T18 | T16,T17 | T16→T17→T18 | ✅ |
| T19 | T12,T18 | T18→T19 (T12 já concluída na Fase 3) | ✅ |

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Migration | integration | integration | ✅ OK |
| T2 | Config + componente | none / unit | unit | ✅ OK |
| T3 | Página (roteamento) | unit | unit | ✅ OK |
| T4–T7 | Query function | unit | unit | ✅ OK |
| T8–T11 | Componente | unit | unit | ✅ OK |
| T12 | Página | unit | unit | ✅ OK |
| T13 | Componente | unit | unit | ✅ OK |
| T14 | Query function | unit | unit | ✅ OK |
| T15 | Página | unit | unit | ✅ OK |
| T16–T17 | Query function | unit | unit | ✅ OK |
| T18 | Componente | unit | unit | ✅ OK |
| T19 | Página | unit | unit | ✅ OK |
