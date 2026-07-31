# Primeira Tela de Cadastro Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/primeira-tela-cadastro/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase sampling. Guidelines found: `vitest.config.ts` (scopes `test:unit` to `src/backend/**/*.test.ts` only — frontend is out of scope for unit tests project-wide) and `.specs/features/fundacao-entidades-pessoas/tasks.md` (Fase 5, T29-T37: precedent for this exact kind of frontend work — "Tests: none — build gate only", no E2E tooling exists in this project — no Playwright/Testing Library/jsdom found anywhere).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------- | --------------------- | ------------------ | ------------ |
| Backend query functions (`src/backend/queries/tse.ts`) | unit | 1:1 to spec ACs (match found / not found / null field) + every listed edge case (dt_nascimento null, sem município principal) — same style as existing `buscarCandidaturas` (mocked client, no real Supabase) | `src/backend/queries/*.test.ts` | `npm run test:unit` |
| Migration / materialized view (`supabase/migrations/0019_*.sql`) | integration | Structural existence (pg_matviews, índice único) + correção da agregação com dado seedado (mesmo padrão de `tse-e-candidatura.integration.test.ts`) | `supabase/tests/fundacao/*.integration.test.ts` | `npm run test:integration` |
| Frontend (tema, sidebar, listagem em cards, extensão do detalhe) | none | Build + lint apenas — mesmo precedente já estabelecido na Fase 5 da feature Fundação (T29-T37), nenhuma ferramenta de teste de componente/E2E existe neste projeto | `src/frontend/**` | `npm run build && npm run lint` |

**Coverage Expectation values** — conforme guideline encontrada acima (`vitest.config.ts` + precedente da Fase 5), não o default forte da tabela padrão — frontend deste projeto é `none` por design estabelecido, não uma lacuna desta feature.

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ------------ | -------- |
| Quick | Tasks com teste unitário (backend queries) | `npm run test:unit -- <arquivo>` |
| Full | Task com teste de integração (migração) | `npm run test:integration -- <arquivo>` |
| Build | Tasks de frontend (sem teste) | `npm run build && npm run lint` |

---

## Execution Plan

Phases are ordered and run sequentially — each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Tema visual e fontes

```
T1 → T2
```

### Phase 2: App shell (sidebar + route group)

```
T3 → T4 → T5 → T6
```

### Phase 3: Migração TSE — perfil do eleitorado

```
T7 → T8
```

### Phase 4: Queries backend TSE

```
T9 → T10
```

### Phase 5: Listagem em cards (Mandatos + Coalizões)

```
T11 → T12 → T13 → T14 → T15
```

### Phase 6: Perfil TSE rico no detalhe do mandato

```
T16 → T17
```

---

## Task Breakdown

### T1: Sobrescrever CSS vars da marca em `globals.css`

**What**: Substituir os valores de `:root` em `globals.css` pelo mapeamento de cores da marca definido em `design.md` (Tech Decisions) — `--primary`, `--secondary` (novo token, ver nota), `--destructive`, `--background`, `--card`, `--border`, `--chart-1..5`, `--sidebar*`.
**Where**: `src/frontend/app/globals.css`
**Depends on**: None
**Reuses**: estrutura de CSS vars já existente (`cssVariables: true` do shadcn) — só os *valores*, não a estrutura, mudam.
**Requirement**: CAD-13

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Todas as cores listadas no mapeamento de `design.md` estão sobrescritas em `:root` (mantendo `.dark` intocado, por decisão de design)
- [ ] `npm run build` passa (nenhuma classe Tailwind quebra por causa de sintaxe de cor inválida)
- [ ] Verificação visual: abrir `/login` localmente e confirmar que o fundo/botões usam a paleta nova, não mais cinza

**Tests**: none
**Gate**: build

---

### T2: Trocar fontes para Anton + Commissioner

**What**: Substituir `Geist`/`Geist_Mono` por `Anton` (mapeado em `--font-heading`) e `Commissioner` (mapeado em `--font-sans`) via `next/font/google` em `layout.tsx`; atualizar `metadata.title`/`description` (hoje ainda é o placeholder "Create Next App").
**Where**: `src/frontend/app/layout.tsx`
**Depends on**: None
**Reuses**: o hook `--font-heading: var(--font-sans)` que já existe em `globals.css:12` — só aponta pra variável nova.
**Requirement**: CAD-13

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `Anton` carregada e exposta como variável CSS, referenciada por `--font-heading`
- [ ] `Commissioner` carregada e exposta como variável CSS, referenciada por `--font-sans`
- [ ] `metadata` deixa de dizer "Create Next App"
- [ ] `npm run build` passa
- [ ] Verificação visual: título de página usa Anton (caixa alta, condensada), corpo usa Commissioner

**Tests**: none
**Gate**: build

---

### T3: Componente `Sidebar`

**What**: Nav fixa com espaço reservado pro logo "Legisla Brasil" (ícone de bandeira/pennant do `lucide-react` como marcador) e links pra Mandatos, Coalizões, Usuários; destaca o item ativo via `usePathname()`.
**Where**: `src/frontend/components/app-shell/sidebar.tsx`
**Depends on**: None
**Reuses**: `next/link`, `lucide-react` (já em uso no projeto)
**Requirement**: CAD-14

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Renderiza os 3 links (Mandatos → `/mandatos`, Coalizões → `/coalizoes`, Usuários → `/usuarios`)
- [ ] Item da rota atual recebe destaque visual (cor de item ativo, vinho conforme design)
- [ ] `npm run build` passa

**Tests**: none
**Gate**: build

---

### T4: Layout aninhado `(app)/layout.tsx`

**What**: Criar o route group `(app)` com um `layout.tsx` que renderiza `<Sidebar />` + `{children}` num grid (sidebar fixa + área de conteúdo).
**Where**: `src/frontend/app/(app)/layout.tsx`
**Depends on**: T3
**Reuses**: `Sidebar` (T3). Layout aninhado, não root — `app/layout.tsx` continua sendo o único root layout (confirmado em `node_modules/next/dist/docs/.../route-groups.md`, ver design.md).
**Requirement**: CAD-14, CAD-15

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Layout renderiza sidebar + children lado a lado
- [ ] Nenhuma rota ainda foi movida pra dentro (isso é T5) — este layout existe mas ainda não é usado por nenhuma página
- [ ] `npm run build` passa

**Tests**: none
**Gate**: build

---

### T5: Mover rotas existentes pra dentro de `(app)/`

**What**: `git mv` de `mandatos/`, `coalizoes/`, `usuarios/`, `contratos/` (com todos os arquivos dentro, incluindo `[id]/`, `novo/`) de `src/frontend/app/` pra `src/frontend/app/(app)/`. Route group não muda a URL — `/mandatos` continua `/mandatos`.
**Where**: `src/frontend/app/(app)/mandatos/**`, `src/frontend/app/(app)/coalizoes/**`, `src/frontend/app/(app)/usuarios/**`, `src/frontend/app/(app)/contratos/**` (movidos de `src/frontend/app/mandatos/**` etc.)
**Depends on**: T4
**Reuses**: todo o código dessas páginas, sem alteração de conteúdo — só o caminho no disco muda.
**Requirement**: CAD-14, CAD-16

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Todas as 4 pastas existem em `(app)/` e não existem mais no nível antigo
- [ ] `npm run build` passa (nenhum import relativo quebrado — projeto usa aliases `@/`/`@backend/`, risco baixo, mas confirmar)
- [ ] Verificação manual: `/mandatos/[id]` carrega, e o link "Vínculos" de um contrato ainda navega pra `/contratos/[id]/vinculos` corretamente (CAD-16 — regressão)
- [ ] Sidebar (T3/T4) aparece nessas 4 rotas agora que estão dentro do grupo

**Tests**: none
**Gate**: build

---

### T6: Redirecionar `/` para `/mandatos`

**What**: Substituir o conteúdo placeholder de `page.tsx` (scaffold do `create-next-app`, nunca customizado) por um `redirect("/mandatos")`.
**Where**: `src/frontend/app/page.tsx`
**Depends on**: T5
**Reuses**: `redirect` de `next/navigation` (mesmo padrão já usado em `auth/confirm/route.ts`)
**Requirement**: Decisão de design (Tech Decisions de `design.md`) — não numerada na spec original, decorre da introdução da sidebar.

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Acessar `/` redireciona pra `/mandatos`
- [ ] `npm run build` passa

**Tests**: none
**Gate**: build

---

### T7: Migração — `tse.mv_perfil_eleitorado_candidatura`

**What**: Nova migração criando a materialized view em formato longo (`ano_eleicao, sq_candidato, nr_turno, dimensao, categoria, qt_eleitores`) que determina o município principal de cada candidatura (mesma lógica de desempate de `mv_candidatura_resumo` — mais votos, `NULLS LAST`) e agrega `tse.dim_perfil_eleitorado` por esse município em 3 dimensões (`genero`, `faixa_etaria`, `grau_escolaridade`), com índice e `GRANT SELECT` pros mesmos 3 papéis de `mv_candidatura_resumo` (`legisla_app`, `legisla_admin`, `legisla_gestora`). Inclui teste de integração: existência estrutural (pg_matviews + índice) e correção da agregação com dado seedado (candidatura + votação em 2 municípios diferentes + perfil eleitorado variado, confirmando que o município com mais votos é o escolhido e os números batem).
**Where**: `supabase/migrations/0019_mv_perfil_eleitorado_candidatura.sql`, `supabase/tests/fundacao/mv-perfil-eleitorado.integration.test.ts`
**Depends on**: None
**Reuses**: lógica de município principal de `tse.mv_candidatura_resumo` (`docs/schema_sistema.sql:625-664`); padrão de teste estrutural de `supabase/tests/fundacao/tse-e-candidatura.integration.test.ts`; helper `runSql`.
**Requirement**: CAD-11

**Tools**:
- MCP: NONE (usar `supabase db push` / `supabase migration` via Bash, mesmo padrão de todas as migrações anteriores)
- Skill: NONE

**Done when**:
- [ ] View existe em `pg_matviews` (schema `tse`), com índice
- [ ] `GRANT SELECT` explícito pra `legisla_app`, `legisla_admin`, `legisla_gestora` nesta view especificamente (não retroativo do grant antigo)
- [ ] Teste de integração cobre: existência estrutural + agregação correta com dado seedado (candidatura com votos em 2 municípios, confirma escolha do principal + soma correta por dimensão)
- [ ] Gate: `npm run test:integration -- supabase/tests/fundacao/mv-perfil-eleitorado.integration.test.ts` passa
- [ ] Nenhuma leitura de `tse.fat_votacao_zona` fora da definição SQL da própria view (confirma o Risk & Concern de `design.md`)

**Tests**: integration
**Gate**: full

---

### T8: Gerar tipos TypeScript da nova view

**What**: Rodar `npm run db:types` pra que `Database["tse"]["Views"]["mv_perfil_eleitorado_candidatura"]` exista tipado.
**Where**: `src/backend/supabase/database.types.ts` (gerado)
**Depends on**: T7
**Reuses**: script `db:types` já existente (`supabase gen types typescript --linked`)
**Requirement**: CAD-11 (enabler)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `database.types.ts` contém o tipo da nova view com as 6 colunas esperadas
- [ ] `npm run build` continua passando (nenhum tipo quebrado em outro lugar)

**Tests**: none
**Gate**: build

---

### T9: `buscarPerfilCandidatura`

**What**: Nova função de query em `tse.ts`, lendo `tse.dim_candidatura` por `(ano_eleicao, sq_candidato, nr_turno)`, retornando idade calculada (ou `null` se `dt_nascimento` for `null`), gênero, cor/raça, grau de instrução, ocupação, coligação — ou `null` se não houver linha.
**Where**: `src/backend/queries/tse.ts`, `src/backend/queries/tse.test.ts` (estender)
**Depends on**: None (tipos de `tse.dim_candidatura` já existem desde a Fundação, T24)
**Reuses**: padrão de `buscarCandidaturas` (client por parâmetro, mesmo arquivo); mock de cliente já existente em `tse.test.ts`.
**Requirement**: CAD-10

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Retorna `null` quando não há linha correspondente (sem lançar erro) — mock de teste cobre isso
- [ ] Retorna idade `null` quando `dt_nascimento` é `null` — mock de teste cobre isso
- [ ] Retorna idade calculada corretamente quando `dt_nascimento` existe — mock de teste cobre isso
- [ ] Lança o erro do Supabase (não engole) quando a query falha — mesmo padrão de `buscarCandidaturas`, mock de teste cobre isso
- [ ] Gate: `npm run test:unit -- src/backend/queries/tse.test.ts` passa

**Tests**: unit
**Gate**: quick

---

### T10: `buscarPerfilEleitoradoCandidatura`

**What**: Nova função de query em `tse.ts`, lendo `tse.mv_perfil_eleitorado_candidatura` por `(ano_eleicao, sq_candidato, nr_turno)` e agrupando o formato longo em 3 listas (`genero`, `faixaEtaria`, `grauEscolaridade`); retorna `null` quando não há nenhuma linha (sem município principal identificável).
**Where**: `src/backend/queries/tse.ts`, `src/backend/queries/tse.test.ts` (estender)
**Depends on**: T8
**Reuses**: mesmo padrão de client-por-parâmetro; mock de cliente já existente.
**Requirement**: CAD-11, CAD-12

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Retorna `null` quando a view não tem nenhuma linha pra essa chave — mock cobre isso
- [ ] Agrupa corretamente linhas de dimensões diferentes nas 3 listas certas — mock cobre isso
- [ ] Lança o erro do Supabase (não engole) quando a query falha — mock cobre isso
- [ ] Gate: `npm run test:unit -- src/backend/queries/tse.test.ts` passa

**Tests**: unit
**Gate**: quick

---

### T11: Instalar componente shadcn `Card`

**What**: `npx shadcn add card` (não existe hoje em `components/ui/`).
**Where**: `src/frontend/components/ui/card.tsx` (gerado)
**Depends on**: None
**Reuses**: CLI shadcn já configurada (`components.json`)
**Requirement**: CAD-01, CAD-05 (enabler)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `card.tsx` existe em `components/ui/`
- [ ] `npm run build` passa

**Tests**: none
**Gate**: build

---

### T12: Componente `MandatoCard`

**What**: Card individual pra listagem de mandatos — nome (nome de urna se houver, senão nome do contratante), UF, partido atual, cargo atual, cada campo ausente como `—`; clique navega pra `/mandatos/[id]`.
**Where**: `src/frontend/components/fundacao/mandato-card.tsx`
**Depends on**: T11
**Reuses**: shadcn `Card` (T11), `next/link`
**Requirement**: CAD-01, CAD-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Renderiza nome/UF/partido/cargo com fallback `—` pra campo `null` (AD-005)
- [ ] Cantos arredondados + sombra leve + hover perceptível (CAD-14 herdado do `Card` do shadcn, confirmar visualmente)
- [ ] Clique navega pro detalhe correto
- [ ] `npm run build` passa

**Tests**: none
**Gate**: build

---

### T13: Componente `CoalizaoCard`

**What**: Card individual pra listagem de coalizões — nome, UF, município, cada campo ausente como `—`; clique navega pra `/coalizoes/[id]`.
**Where**: `src/frontend/components/fundacao/coalizao-card.tsx`
**Depends on**: T11
**Reuses**: shadcn `Card` (T11), `next/link`
**Requirement**: CAD-05, CAD-07

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Renderiza nome/UF/município com fallback `—` pra campo `null`
- [ ] Clique navega pro detalhe correto
- [ ] `npm run build` passa

**Tests**: none
**Gate**: build

---

### T14: `/mandatos/page.tsx` — listagem em cards

**What**: Página cliente que busca todos os `dim_mandato` join `dim_contratante` (mesmo padrão de fetch direto de `/usuarios` hoje), renderiza grid de `MandatoCard`; estado vazio com CTA "Cadastrar mandato" → `/mandatos/novo`.
**Where**: `src/frontend/app/(app)/mandatos/page.tsx`
**Depends on**: T12, T5
**Reuses**: `MandatoCard` (T12); RLS já existente em `dim_mandato`/`dim_contratante` (nenhuma política nova)
**Requirement**: CAD-01, CAD-02, CAD-03, CAD-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Lista todos os mandatos cadastrados como cards
- [ ] Estado vazio (nenhum mandato) mostra CTA, sem erro
- [ ] Botão "Novo" navega pra `/mandatos/novo` (wizard existente, sem alteração)
- [ ] `npm run build` passa
- [ ] Verificação manual: cadastrar 1 mandato de teste, confirmar que aparece na listagem com os dados certos

**Tests**: none
**Gate**: build

---

### T15: `/coalizoes/page.tsx` — listagem em cards

**What**: Mesma estrutura de T14, pra coalizões — busca `dim_coalizao` join `dim_contratante`, grid de `CoalizaoCard`, estado vazio com CTA → `/coalizoes/novo`.
**Where**: `src/frontend/app/(app)/coalizoes/page.tsx`
**Depends on**: T13, T5
**Reuses**: `CoalizaoCard` (T13); RLS já existente
**Requirement**: CAD-05, CAD-06, CAD-07, CAD-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Lista todas as coalizões cadastradas como cards
- [ ] Estado vazio mostra CTA, sem erro
- [ ] Botão "Novo" navega pra `/coalizoes/novo`
- [ ] `npm run build` passa
- [ ] Verificação manual: cadastrar 1 coalizão de teste, confirmar que aparece na listagem

**Tests**: none
**Gate**: build

---

### T16: Componente `PerfilEleitoradoChart`

**What**: Mini-representação visual (barras CSS/Tailwind, largura proporcional ao percentual) das 3 dimensões (gênero, faixa etária, escolaridade) — sem lib de gráfico, usando as cores `--chart-1..5` do tema.
**Where**: `src/frontend/components/fundacao/perfil-eleitorado-chart.tsx`
**Depends on**: None
**Reuses**: cores do tema (T1)
**Requirement**: CAD-11

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Recebe uma lista de `{categoria, qtEleitores}` e renderiza barras proporcionais por dimensão
- [ ] Usa as cores do tema (`--chart-1` a `--chart-5`)
- [ ] `npm run build` passa

**Tests**: none
**Gate**: build

---

### T17: Estender `/mandatos/[id]/page.tsx` com o perfil TSE rico

**What**: Dentro da seção "Candidaturas TSE" já existente, adicionar por candidatura: bloco de votação (total de votos + município principal, via `mv_candidatura_resumo`), bloco de perfil pessoal (via `buscarPerfilCandidatura`, T9), bloco de perfil do eleitorado (via `buscarPerfilEleitoradoCandidatura` + `PerfilEleitoradoChart`, T10/T16). Qualquer bloco/campo sem dado aparece como `—` ou é omitido (perfil do eleitorado sem município principal), sem quebrar a tela.
**Where**: `src/frontend/app/(app)/mandatos/[id]/page.tsx` (extensão do arquivo já movido em T5)
**Depends on**: T9, T10, T16, T5
**Reuses**: tabela de candidaturas já existente (ano, status, confiança, vigente) — os 3 blocos novos entram como conteúdo adicional por linha, sem substituir nada.
**Requirement**: CAD-09, CAD-10, CAD-11, CAD-12, CAD-16

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Bloco de votação exibe total de votos + município principal por candidatura (CAD-09)
- [ ] Bloco de perfil pessoal exibe idade/gênero/raça-cor/instrução/ocupação/coligação (CAD-10)
- [ ] Bloco de perfil do eleitorado exibe o gráfico das 3 dimensões quando há município principal, omitido quando não há (CAD-11/CAD-12)
- [ ] Candidatura sem match real (cadastro manual) não quebra a tela — todos os blocos aparecem indisponíveis/omitidos (CAD-12)
- [ ] O link "Vínculos" de cada contrato, na mesma página, continua funcionando (CAD-16 — regressão, complementa a verificação de T5)
- [ ] `npm run build` passa
- [ ] Verificação manual: abrir o detalhe de um mandato com candidatura TSE real vinculada (via wizard existente), confirmar que os 3 blocos aparecem com dado correto

**Tests**: none
**Gate**: build

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6

Phase 1:  T1 ──→ T2
Phase 2:  T3 ──→ T4 ──→ T5 ──→ T6
Phase 3:  T7 ──→ T8
Phase 4:  T9 ──→ T10
Phase 5:  T11 ──→ T12 ──→ T13 ──→ T14 ──→ T15
Phase 6:  T16 ──→ T17
```

Execution is strictly sequential — there is no intra-phase parallelism. A single agent (or batch worker) works one task at a time, in order.

**Batching (17 tasks total, > ~8 → sub-agent offer applies):**

- Batch 1 = Phase 1 + Phase 2 + Phase 3 (T1–T8, 8 tasks)
- Batch 2 = Phase 4 + Phase 5 + Phase 6 (T9–T17, 9 tasks — Phase 6 is a 2-task tail, folded into Batch 2 per the tail-folding rule since it can't stand alone as a batch)

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: CSS vars da marca | 1 arquivo, 1 conjunto de valores | ✅ Granular |
| T2: Fontes Anton/Commissioner | 1 arquivo | ✅ Granular |
| T3: `Sidebar` | 1 componente | ✅ Granular |
| T4: `(app)/layout.tsx` | 1 arquivo | ✅ Granular |
| T5: Mover rotas pra `(app)/` | 1 operação (move), 4 pastas mas zero mudança de conteúdo | ✅ Granular (mecânico, não split de lógica) |
| T6: Redirect `/` | 1 arquivo | ✅ Granular |
| T7: Migração + teste | 1 migração, 1 arquivo de teste (par inseparável — migração sem teste não é aceitável, AD-001 espírito) | ✅ Granular |
| T8: `db:types` | 1 comando | ✅ Granular |
| T9: `buscarPerfilCandidatura` | 1 função + testes | ✅ Granular |
| T10: `buscarPerfilEleitoradoCandidatura` | 1 função + testes | ✅ Granular |
| T11: shadcn `Card` | 1 instalação | ✅ Granular |
| T12: `MandatoCard` | 1 componente | ✅ Granular |
| T13: `CoalizaoCard` | 1 componente | ✅ Granular |
| T14: `/mandatos/page.tsx` | 1 página | ✅ Granular |
| T15: `/coalizoes/page.tsx` | 1 página | ✅ Granular |
| T16: `PerfilEleitoradoChart` | 1 componente | ✅ Granular |
| T17: Estender detalhe do mandato | 1 arquivo, 3 blocos coesos (mesmo loop de candidaturas, mesma verificação visual) | ✅ Granular (cohesive — ver nota abaixo) |

**Nota sobre T17**: toca 3 fontes de dado (votação, pessoal, eleitorado), mas todas dentro do mesmo loop `candidaturas.map(...)` da mesma página já existente — dividir em 3 tasks criaria fronteiras artificiais dentro de uma única verificação visual (a linha da candidatura). Mantido como 1 task cohesiva, com os 4 Done-when cobrindo cada AC separadamente.

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ----------------------- | -------------- | ------- |
| T1 | None | (nenhuma seta) | ✅ Match |
| T2 | None | (nenhuma seta) | ✅ Match |
| T3 | None | (nenhuma seta) | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T5 | T5 → T6 | ✅ Match |
| T7 | None | (nenhuma seta) | ✅ Match |
| T8 | T7 | T7 → T8 | ✅ Match |
| T9 | None | (nenhuma seta) | ✅ Match |
| T10 | T8 | Fase 3 precede Fase 4 (dependência entre fases, não desenhada dentro da mesma fase) | ✅ Match |
| T11 | None | (nenhuma seta) | ✅ Match |
| T12 | T11 | T11 → T12 | ✅ Match |
| T13 | T11 | Fase 5 é sequencial (T11→T12→T13→T14→T15); T13 depende só de T11, não de T12 — dependência real é mais frouxa que a ordem desenhada, mas não há violação (T11 já rodou antes de T13 de qualquer forma) | ✅ Match |
| T14 | T12, T5 | T12 → T14 (mesma fase); T5 é de Fase 2 (anterior) | ✅ Match |
| T15 | T13, T5 | T13 → T14 → T15 (mesma fase); T5 é de Fase 2 (anterior) | ✅ Match |
| T16 | None | (nenhuma seta) | ✅ Match |
| T17 | T9, T10, T16, T5 | T16 → T17 (mesma fase); T9/T10 (Fase 4) e T5 (Fase 2) são fases anteriores | ✅ Match |

**Regra verificada**: nenhuma task depende de uma task de fase posterior — todas as dependências apontam pra trás ou pra dentro da mesma fase.

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | ---------------------------- | ----------------- | ----------- | ------- |
| T1 | Frontend (CSS) | none | none | ✅ OK |
| T2 | Frontend (fonts/layout) | none | none | ✅ OK |
| T3 | Frontend (component) | none | none | ✅ OK |
| T4 | Frontend (layout) | none | none | ✅ OK |
| T5 | Frontend (move) | none | none | ✅ OK |
| T6 | Frontend (page) | none | none | ✅ OK |
| T7 | Migration/materialized view | integration | integration | ✅ OK |
| T8 | Frontend/types (gerado) | none | none | ✅ OK |
| T9 | Backend query function | unit | unit | ✅ OK |
| T10 | Backend query function | unit | unit | ✅ OK |
| T11 | Frontend (component gerado) | none | none | ✅ OK |
| T12 | Frontend (component) | none | none | ✅ OK |
| T13 | Frontend (component) | none | none | ✅ OK |
| T14 | Frontend (page) | none | none | ✅ OK |
| T15 | Frontend (page) | none | none | ✅ OK |
| T16 | Frontend (component) | none | none | ✅ OK |
| T17 | Frontend (page, extensão) | none | none | ✅ OK |

Nenhuma violação — todas as tasks de camada backend (T7, T9, T10) têm o tipo de teste exigido pela matriz; todas as tasks de frontend seguem o `none` já estabelecido pelo precedente do projeto.

---

## Phase Execution Map (resumo)

17 tasks, 6 fases, 2 batches de sub-agent (8 + 9 tasks) se delegado — ver seção acima.
