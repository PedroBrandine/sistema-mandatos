# Navegação por Produto Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its
Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is
the source of verdade for the full flow (per-task cycle, sub-agent delegation, adequacy review,
Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/navegacao-por-produto/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase sampling. Guidelines found: `vitest.config.ts` (unit tests escopados a
> `src/backend/**/*.test.ts` — não inclui `src/frontend/**`), `vitest.integration.config.ts`
> (integration escopado a `supabase/tests/**/*.integration.test.ts` — só RLS/RPC/SQL), `CLAUDE.md`
> (comandos + regra de `npx tsc --noEmit` manual pra arquivo `src/backend/**` sem consumidor ainda),
> `.specs/STATE.md` (handoff de `plataforma-ui-tanstack`: "projeto não tem suíte de teste de
> componente de UI, débito preexistente documentado" — confirmado por zero arquivos `*.test.tsx`
> em todo o repositório, incluindo dezenas de páginas/componentes já existentes). Amostra: `queries/tse.test.ts`, `rpc/mandato.test.ts`, `rpc/coalizao.test.ts` (todos backend puro).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------- | --------------------- | ----------------- | ------------ |
| `src/backend/queries/*.ts` (funções de leitura puras) | unit | Todo caminho de query novo (happy path + lista vazia + erro repassado, mesmo padrão de `queries/tse.test.ts`) | `src/backend/queries/*.test.ts` | `npm run test:unit` |
| `src/backend/rpc/*.ts` / `src/backend/types/*.ts` (wrappers de RPC e tipos compartilhados) | unit | Mudança de tipo/assinatura coberta pelo teste existente do wrapper (`rpc/mandato.test.ts`) | `src/backend/rpc/*.test.ts` | `npm run test:unit` |
| `src/frontend/**` (páginas, layouts, componentes, hooks — inclusive `ContratoForm`/`MandatoWizard`) | none | Sem suíte de componente no projeto (débito preexistente, não introduzido por esta feature) — gate é o build + lint | `src/frontend/**` | `npm run build` + `npm run lint:all` |
| Nenhuma migration/RLS nova nesta feature | none | — (não há código em `supabase/tests/**` a escrever) | — | `npm run test:integration` não se aplica |

**Nota (CLAUDE.md)**: arquivos novos em `src/backend/queries/contrato.ts`/`produto.ts` ficam sem
consumidor no frontend por 1-2 tasks (até as páginas que os importam existirem) — `npm run build`
não os type-checa nesse intervalo. Enquanto isso, o gate inclui rodar manualmente:
`npx tsc --noEmit --strict --target ES2017 --module esnext --moduleResolution bundler --esModuleInterop --skipLibCheck --lib ES2017,DOM` no arquivo.

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ------------ | ------- |
| Quick | Após tasks que tocam `src/backend/queries\|rpc\|types` (camada com teste unitário) | `npm run test:unit` |
| Build | Após tasks que tocam só `src/frontend/**` (páginas/componentes/hooks, sem teste) | `npm run build && npm run lint:all` |
| Full | Não se aplica nesta feature — zero migration/RLS nova | `npm run test:integration` (não necessário) |

---

## Execution Plan

Phases are ordered and run sequentially — each phase completes before the next begins, and tasks
within a phase execute in order.

### Phase 1: Dados e tipos (backend, sem UI)

```
T1 → T2 → T3 → T4 → T5 → T6
```

### Phase 2: Infraestrutura de UI compartilhada

```
T7 → T8 → T9 → T10
```

### Phase 3: Hub pós-login

```
T11
```

### Phase 4: Área de produto (hub → dashboard/agenda/contratos)

```
T12 → T13 → T14 → T15 → T16 → T17
```

### Phase 5: Cadastro de novo Contrato

```
T18 → T19 → T20 → T21
```

### Phase 6: Ficha operacional do contrato

```
T22 → T23 → T24 → T25
```

---

## Task Breakdown

### T1: Regenerar `database.types.ts` (inclui `ref_etapa`)

**What**: Rodar `npm run db:types` contra o projeto Supabase dev já linkado
(`npnvoolkebhabjkjzqwn`) pra que `ref_etapa` (provisionada pela Trilha C, nunca tipada) passe a
existir em `Database["public"]["Tables"]`.
**Where**: `src/backend/supabase/database.types.ts` (gerado, não editar à mão), mais o ajuste de
escopo abaixo em `src/backend/rpc/mandato.ts`
**Depends on**: None
**Reuses**: script `db:types` já existente em `package.json`
**Requirement**: infra (habilita NAV-04)

**Ajuste de escopo (achado na 1ª tentativa de execução, 2026-08-11):** os types antigos nunca
declaravam `p_id_contratante_existente` no `Args` de `app.criar_mandato` (gap pré-existente,
mascarado pelo type antigo incompleto — a chamada nunca era checada estruturalmente contra esse
campo). O type regenerado agora declara `p_id_contratante_existente?: number` (sem `null` no
union, ao contrário dos parâmetros `jsonb`, cujo tipo `Json` já inclui `null`). Isso quebra
`npm run build` em `rpc/mandato.ts:54`, que passa `input.idContratanteExistente ?? null`. Correção
de 1 linha, dentro do escopo desta task (é consequência direta de regenerar o type, não scope
creep): trocar `?? null` por `input.idContratanteExistente` puro (`CriarMandatoInput.idContratanteExistente` já é `number | undefined`, sem necessidade de coerção). Não mexer em mais nada
de `rpc/mandato.ts` nesta task — a correção do cast de retorno (linha 65) é da T2.

**Tools**:
- MCP: NONE (CLI `supabase` já linkado localmente)
- Skill: NONE

**Done when**:
- [ ] `ref_etapa` aparece em `database.types.ts` com as colunas `id_etapa, id_produto, codigo, nome, ordem, duracao_prevista_dias, gera_registro`
- [ ] Nenhuma tabela/coluna existente desaparece do arquivo gerado (diff só adiciona)
- [ ] `rpc/mandato.ts:54` passa `input.idContratanteExistente` sem `?? null`
- [ ] `npm run build` continua verde

**Tests**: none
**Gate**: build

**Commit**: `chore(nav-produto): regenera database.types.ts com ref_etapa`

---

### T2: Corrigir tipo `MandatoCriado` (+ `idContrato`) e remover cast em `rpc/mandato.ts`

**What**: `MandatoCriado` (`types/fundacao.ts`) ganha `idContrato: number | null`; remover o cast
`as MandatoCriado & { idContrato?: number | null }` em `rpc/mandato.ts:65`, já que o campo passa a
ser parte legítima do tipo; estender `rpc/mandato.test.ts` pra asserir `resultado.idContrato`
tipado (sem cast) no teste que já usa `id_contrato: 11` no mock (linha ~50).
**Where**: `src/backend/types/fundacao.ts`, `src/backend/rpc/mandato.ts`
**Depends on**: None
**Reuses**: teste existente `rpc/mandato.test.ts` (caso "CMU-01/02: repassa idContratanteExistente")
**Requirement**: infra (habilita NAV-09 AC3)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `MandatoCriado` declara `idContrato: number | null`
- [ ] `rpc/mandato.ts` retorna o objeto sem cast adicional
- [ ] `rpc/mandato.test.ts` assere `resultado.idContrato === 11` no caso que já usa `id_contrato: 11` no mock
- [ ] `npm run test:unit` passa, contagem de testes igual ou maior que antes (nenhum teste removido)

**Tests**: unit
**Gate**: quick (`npm run test:unit`)

**Commit**: `fix(nav-produto): tipa idContrato em MandatoCriado, remove cast`

---

### T3: Criar `src/backend/queries/produto.ts`

**What**: `PRODUTO_SLUGS` (mapa fixo `estrategia|pll|coalizao` → `{ nome, label }`), tipo
`ProdutoSlug`, `isProdutoSlug(v): v is ProdutoSlug`, `buscarIdProdutoPorNome(client, nome): Promise<number | null>`.
**Where**: `src/backend/queries/produto.ts` (novo) + `produto.test.ts` (novo)
**Depends on**: None
**Reuses**: `ref_produto` já tipado; padrão de mock de query builder de `queries/tse.test.ts:77-107`
**Requirement**: infra (habilita NAV-01, NAV-02)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `PRODUTO_SLUGS` mapeia exatamente `estrategia→'Estratégia'`, `pll→'PLL'`, `coalizao→'Coalizão'` (valores confirmados em `supabase/migrations/0007_catalogos_fundacao.sql:67`)
- [ ] `isProdutoSlug` rejeita string arbitrária
- [ ] `buscarIdProdutoPorNome` retorna `null` quando a query não encontra linha (não lança)
- [ ] `buscarIdProdutoPorNome` propaga erro do Supabase em vez de engolir (mesmo padrão de `buscarCandidaturas`)
- [ ] `npx tsc --noEmit --strict --target ES2017 --module esnext --moduleResolution bundler --esModuleInterop --skipLibCheck --lib ES2017,DOM src/backend/queries/produto.ts` sem erro (ainda sem consumidor no frontend)
- [ ] `npm run test:unit` passa, com pelo menos 3 testes novos (isProdutoSlug válido/inválido, buscarIdProdutoPorNome encontrado/não-encontrado/erro)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(nav-produto): cria mapeamento de slug de produto e resolver de id_produto`

---

### T4: Criar `buscarContratoParaFicha` e `buscarEtapasDoProduto` em `queries/contrato.ts`

**What**: Duas funções de leitura consumidas pela ficha do contrato: `buscarContratoParaFicha(client, idContrato): Promise<ContratoParaFicha | null>` (join manual `fat_contrato`+`dim_contratante`+ramo `dim_mandato`/`dim_coalizao` conforme `tipo_contratante`, usando `id_cargo_atual`/`id_partido_atual` — nunca o snapshot `id_cargo_no_contrato`/`id_partido_no_contrato`, ver design.md Risks) e `buscarEtapasDoProduto(client, idProduto): Promise<EtapaResumo[]>` (ordenado por `ordem`).
**Where**: `src/backend/queries/contrato.ts` (novo) + `contrato.test.ts` (novo)
**Depends on**: T1 (`ref_etapa` tipada)
**Reuses**: `ContratoParaFicha`/interface do design.md; padrão de mock de `queries/tse.test.ts`
**Requirement**: NAV-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `buscarContratoParaFicha` retorna `null` (não lança) quando `id_contrato` não existe
- [ ] Ramo `tipo_contratante === 'mandato'` popula `cargoAtual`/`partidoAtual`/`sgUf`; ramo `'coalizao'` popula `nomeProjetoOrigem`; qualquer outro valor não popula nenhum dos dois (edge case do spec)
- [ ] `buscarEtapasDoProduto` retorna a lista ordenada por `ordem` ascendente
- [ ] `buscarEtapasDoProduto` retorna `[]` (não lança) quando o produto não tem etapa cadastrada
- [ ] `npx tsc --noEmit ...` (mesmos flags de T3) sem erro
- [ ] `npm run test:unit` passa, com pelo menos 5 testes novos (contrato de mandato, de coalizão, de tipo genérico, não encontrado, etapas ordenadas, etapas vazias)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(nav-produto): cria buscarContratoParaFicha e buscarEtapasDoProduto`

---

### T5: Adicionar `buscarContratosAtivosPorProduto` a `queries/contrato.ts`

**What**: `buscarContratosAtivosPorProduto(client, idProduto): Promise<ContratoAtivoResumo[]>` — `fat_contrato` com `id_produto` e `status='ativo'`, join manual com `dim_contratante` pro nome (mesmo padrão de `contratos/page.tsx` hoje, sem `vw_contrato`).
**Where**: `src/backend/queries/contrato.ts` (mesmo arquivo de T4) + teste
**Depends on**: T4 (mesmo arquivo, edição sequencial)
**Reuses**: mesmo padrão de join manual já usado em `app/(app)/contratos/page.tsx`
**Requirement**: NAV-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Filtra corretamente por `id_produto` e `status='ativo'` (nunca outro status)
- [ ] Retorna `[]` (não lança) quando não há contrato ativo
- [ ] `npm run test:unit` passa, com pelo menos 2 testes novos (lista não vazia, lista vazia)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(nav-produto): cria buscarContratosAtivosPorProduto`

---

### T6: Adicionar `contarContratosEAssessoresAtivos` e `buscarPessoasComPapelNoProduto` a `queries/contrato.ts`

**What**: `contarContratosEAssessoresAtivos(client, idProduto, filtro?: { papel: "gestora"|"mentor"; idUsuario: number })` (conta linhas de `fat_contrato` ativas do produto e linhas de `rel_usuario_contrato` com `papel_no_contrato='assessor'` e `dt_fim IS NULL OR dt_fim >= hoje`, restrito ao filtro quando presente) e `buscarPessoasComPapelNoProduto(client, idProduto, papel)` (pessoas com vínculo ativo naquele papel em algum contrato ativo do produto).
**Where**: `src/backend/queries/contrato.ts` (mesmo arquivo) + teste
**Depends on**: T5 (mesmo arquivo, edição sequencial)
**Reuses**: mesmo padrão de contagem via `.select(..., { count: "exact", head: true })` do PostgREST
**Requirement**: NAV-10, NAV-11

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Sem filtro, conta todos os contratos ativos e todos os vínculos de assessor ativos do produto
- [ ] Com filtro `{ papel, idUsuario }`, restringe as duas contagens aos contratos onde aquela pessoa tem vínculo ativo naquele papel (AC2 do NAV-11, literal)
- [ ] `buscarPessoasComPapelNoProduto` retorna `[]` quando ninguém tem aquele papel no produto
- [ ] `npm run test:unit` passa, com pelo menos 4 testes novos (contagem sem filtro, contagem com filtro, pessoas encontradas, pessoas vazio)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(nav-produto): cria contagens do dashboard e busca de pessoas por papel`

---

### T7: Criar hook `usePapelGlobal`

**What**: `usePapelGlobal(): { papel: "admin"|"gestora"|"mentor"|"assessor"|null; carregando: boolean }` — extrai o padrão hoje ad-hoc em `usuarios/page.tsx:56-63` (`auth.getUser()` + `dim_usuario.select("papel_global")`).
**Where**: `src/frontend/hooks/use-papel-global.ts` (novo — pasta `hooks/` não existe ainda)
**Depends on**: None
**Reuses**: padrão de `usuarios/page.tsx:56-63` (sem alterar esse arquivo)
**Requirement**: NAV-15

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Retorna `papel: null` enquanto carrega, depois o `papel_global` do usuário autenticado
- [ ] Não lança se `dim_usuario` não tiver linha pro email autenticado (retorna `null`)
- [ ] `npm run build` continua verde

**Tests**: none
**Gate**: build

**Commit**: `feat(nav-produto): cria hook usePapelGlobal`

---

### T8: Criar `Topbar`, deletar `Sidebar`, atualizar `(app)/layout.tsx`

**What**: Novo componente `Topbar` (marca + link "voltar ao hub" + "Usuários" condicionado a `papel_global` admin/gestora via `usePapelGlobal`); `(app)/layout.tsx` troca `<Sidebar/>` por `<Topbar/>` e o layout flex vira coluna (barra em cima, conteúdo abaixo) em vez de sidebar lateral; `sidebar.tsx` é deletado (único consumidor era este layout).
**Where**: `src/frontend/components/app-shell/topbar.tsx` (novo), `src/frontend/app/(app)/layout.tsx` (modifica), `src/frontend/components/app-shell/sidebar.tsx` (deletado)
**Depends on**: T7
**Reuses**: estrutura visual (`cn`, ícones lucide) de `sidebar.tsx` antes de deletá-lo
**Requirement**: NAV-14, NAV-15

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `Sidebar` não aparece em nenhuma tela de `(app)/` (arquivo deletado, nenhum import restante — `grep -r "app-shell/sidebar"` vazio)
- [ ] Link "Usuários" só renderiza quando `papel === 'admin' || papel === 'gestora'`
- [ ] `npm run build` continua verde (nenhuma outra tela quebra com a mudança de layout)

**Tests**: none
**Gate**: build

**Commit**: `feat(nav-produto): substitui Sidebar por Topbar`

---

### T9: Criar `RouteTabs`

**What**: Componente de abas baseado em rota — `RouteTabs({ items }: { items: { href: string; label: string; ativoSe?: (pathname: string) => boolean }[] })`, extraindo o padrão `Link`+`usePathname`+`cn` de `sidebar.tsx:44-47` (já removido em T8, então a extração usa o histórico do arquivo/design.md como referência, não o arquivo vivo).
**Where**: `src/frontend/components/app-shell/route-tabs.tsx` (novo)
**Depends on**: None
**Reuses**: lógica de "ativo" documentada no design.md (Components → `RouteTabs`)
**Requirement**: infra (habilita NAV-02, NAV-04)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Aba cujo `href` é prefixo do `pathname` atual (ou `ativoSe` customizado) recebe estilo "ativo"
- [ ] `npm run build` continua verde

**Tests**: none
**Gate**: build

**Commit**: `feat(nav-produto): cria componente RouteTabs`

---

### T10: Criar `EmDesenvolvimento` + `/visao-gerencial/page.tsx`

**What**: Componente `EmDesenvolvimento({ titulo, mensagem }` sobre `<EstadoVazio>` (AD-029); primeiro consumidor real é a página `/visao-gerencial`, que resolve NAV-13 por completo (sem abas, só o aviso).
**Where**: `src/frontend/components/app-shell/em-desenvolvimento.tsx` (novo), `src/frontend/app/(app)/visao-gerencial/page.tsx` (novo)
**Depends on**: None
**Reuses**: `EstadoVazio` (`components/ui/estado-vazio.tsx`)
**Requirement**: NAV-13

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `/visao-gerencial` mostra "Indicadores em desenvolvimento", sem abas, sem outro conteúdo funcional (AC1 do NAV-13)
- [ ] `npm run build` continua verde

**Tests**: none
**Gate**: build

**Commit**: `feat(nav-produto): cria EmDesenvolvimento e a tela Visão Gerencial`

---

### T11: Reescrever `(app)/page.tsx` (Hub)

**What**: Substituir os 739 linhas atuais (bento grid + explorador TSE) pelos 4 botões grandes
(Estratégia → `/produtos/estrategia`, PLL → `/produtos/pll`, Coalizão → `/produtos/coalizao`,
Visão Gerencial → `/visao-gerencial`), sempre visíveis (decisão confirmada — RLS decide dentro).
**Where**: `src/frontend/app/(app)/page.tsx` (mesma rota, conteúdo 100% novo)
**Depends on**: None
**Reuses**: `Card`/`Button` shadcn; `PRODUTO_SLUGS` (T3) pros 3 primeiros hrefs
**Requirement**: NAV-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] 4 botões renderizam sempre, sem checagem de papel/vínculo (AC1, decisão confirmada)
- [ ] Nenhuma chamada a `tse.mv_candidatura_resumo` nem a qualquer tabela do schema TSE sobrevive nesta página (AC4 — `grep -n "tse\." src/frontend/app/\(app\)/page.tsx` vazio)
- [ ] `npm run build` continua verde

**Tests**: none
**Gate**: build

**Commit**: `feat(nav-produto): substitui a landing page pelo hub de 4 produtos`

---

### T12: Criar hook `useProdutoAtual`

**What**: `useProdutoAtual(slug: ProdutoSlug): UseQueryResult<{ idProduto: number; nome: string }>` — usa `useQuery` (`@tanstack/react-query`, primeiro consumidor real do provider da Trilha D) com `queryKey: ["produto", slug]`, chamando `buscarIdProdutoPorNome` (T3).
**Where**: `src/frontend/hooks/use-produto-atual.ts` (novo)
**Depends on**: T3
**Reuses**: `QueryClientProvider` já montado em `app/layout.tsx` raiz (AD-029)
**Requirement**: infra (habilita NAV-02)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Duas montagens simultâneas com o mesmo `slug` não disparam 2 requisições de rede (cache do react-query — verificável via devtools ou contagem de chamadas do mock em teste manual)
- [ ] `npm run build` continua verde

**Tests**: none
**Gate**: build

**Commit**: `feat(nav-produto): cria hook useProdutoAtual com react-query`

---

### T13: Criar `/produtos/[slug]/layout.tsx` + `ProdutoShell` + `not-found.tsx` de produto

**What**: `layout.tsx` (Server Component, Next 16 — `params` é `Promise`) valida `slug` contra
`isProdutoSlug` e chama `notFound()` se inválido (AC4 do NAV-02); renderiza
`<ProdutoShell slug={slug}>{children}</ProdutoShell>` (client) com cabeçalho (nome do produto +
link "voltar ao hub") e `RouteTabs` com as 4 abas fixas.
**Where**: `src/frontend/app/(app)/produtos/[slug]/layout.tsx` (novo),
`src/frontend/components/produtos/produto-shell.tsx` (novo),
`src/frontend/app/(app)/produtos/[slug]/not-found.tsx` (novo)
**Depends on**: T9, T12
**Reuses**: `RouteTabs` (T9), `useProdutoAtual` (T12), `isProdutoSlug`/`PRODUTO_SLUGS` (T3)
**Requirement**: NAV-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `/produtos/xis` (slug inválido) responde 404 com o `not-found.tsx` novo (AC4)
- [ ] `/produtos/estrategia` (e `pll`, `coalizao`) renderiza as 4 abas com a ativa destacada (AC1)
- [ ] Trocar de aba mantém o produto selecionado — não repete escolha (AC2)
- [ ] Existe um link visível de volta ao hub (AC3)
- [ ] `npm run build` continua verde

**Tests**: none
**Gate**: build

**Commit**: `feat(nav-produto): cria layout e shell da área de produto com validação de slug`

---

### T14: Criar `/produtos/[slug]/page.tsx` (redirect → dashboard)

**What**: Server Component que faz `redirect(`/produtos/${slug}/dashboard`)` — alvo fixo, não
depende de nenhum dado.
**Where**: `src/frontend/app/(app)/produtos/[slug]/page.tsx` (novo)
**Depends on**: T13
**Reuses**: `redirect` de `next/navigation`
**Requirement**: NAV-01 AC2

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Acessar `/produtos/estrategia` (sem sub-rota) redireciona pra `/produtos/estrategia/dashboard`
- [ ] `npm run build` continua verde

**Tests**: none
**Gate**: build

**Commit**: `feat(nav-produto): redireciona /produtos/[slug] pra aba Dashboard`

---

### T15: Criar `/produtos/[slug]/agenda/page.tsx`

**What**: Placeholder único ("Agenda em desenvolvimento") pros 3 produtos.
**Where**: `src/frontend/app/(app)/produtos/[slug]/agenda/page.tsx` (novo)
**Depends on**: T13, T10
**Reuses**: `EmDesenvolvimento` (T10)
**Requirement**: NAV-12

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Os 3 produtos mostram exatamente o mesmo aviso na aba Agenda (AC1)
- [ ] `npm run build` continua verde

**Tests**: none
**Gate**: build

**Commit**: `feat(nav-produto): cria placeholder da aba Agenda`

---

### T16: Criar `/produtos/[slug]/contratos/page.tsx`

**What**: Card por `fat_contrato` ativo do produto (nome contratante, data início), estado vazio
com atalho pra aba Cadastro de novo Contrato, clique navega pra `/contratos/[id]`.
**Where**: `src/frontend/app/(app)/produtos/[slug]/contratos/page.tsx` (novo)
**Depends on**: T13, T5
**Reuses**: `buscarContratosAtivosPorProduto` (T5), `EstadoVazio`, `Card`
**Requirement**: NAV-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Lista só contratos com `status='ativo'` do produto (AC1)
- [ ] Sem contrato ativo, mostra `<EstadoVazio>` com atalho pra aba Cadastro de novo Contrato (AC2)
- [ ] Clique no card navega pra `/contratos/${idContrato}` (AC3)
- [ ] `npm run build` continua verde

**Tests**: none
**Gate**: build

**Commit**: `feat(nav-produto): cria aba Contratos com cards de contratos ativos`

---

### T17: Criar `/produtos/[slug]/dashboard/page.tsx`

**What**: Contagem de contratos ativos e assessores ativos do produto, filtro em cascata
papel(gestora/mentor)→pessoa que recalcula as duas contagens, placeholder de Kanban/indicadores
de planejamento.
**Where**: `src/frontend/app/(app)/produtos/[slug]/dashboard/page.tsx` (novo)
**Depends on**: T13, T6, T10
**Reuses**: `contarContratosEAssessoresAtivos`/`buscarPessoasComPapelNoProduto` (T6),
`EmDesenvolvimento` (T10), `Select` shadcn
**Requirement**: NAV-10, NAV-11

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Contagens batem com consulta direta nas tabelas pra um contrato/vínculo de teste (AC1)
- [ ] Aplicar o filtro por mentor ou gestora recalcula as duas contagens (AC2)
- [ ] Bloco de Kanban/indicadores mostra "Em desenvolvimento", nunca número zerado/inventado (AC3)
- [ ] `npm run build` continua verde

**Tests**: none
**Gate**: build

**Commit**: `feat(nav-produto): cria Dashboard do produto com contagens reais e filtro`

---

### T18: Modificar `ContratoForm` (produto travado + retorno do `id_contrato`)

**What**: `ContratoFormProps` ganha `produtoTravado?: { id: number; nome: string }` (quando
presente, o campo Produto vira rótulo fixo em vez de `Select`, e `defaultValues.id_produto` nasce
com esse valor); `onConcluido` passa a `(criado?: { idContrato: number }) => void` — o `insert` de
"abrir" ganha `.select("id_contrato").single()` pra poder repassar o id criado.
**Where**: `src/frontend/components/fundacao/contrato-form.tsx` (modifica)
**Depends on**: None
**Reuses**: mesmo componente, mesma validação (`contratoSchema`)
**Requirement**: NAV-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Com `produtoTravado`, o Produto aparece como rótulo fixo, sem exigir escolha manual (AC1 do NAV-09)
- [ ] Sem `produtoTravado`, o comportamento é idêntico ao de hoje (Select editável)
- [ ] `onConcluido` recebe `{ idContrato }` no modo "abrir" bem-sucedido
- [ ] Reteste manual dos 2 call-sites existentes que ignoram o novo argumento (`coalizoes/[id]/page.tsx`, `mandatos/[id]/contratos/novo/page.tsx`) continua funcionando sem alteração de código neles
- [ ] `npm run build` continua verde

**Tests**: none
**Gate**: build

**Commit**: `feat(nav-produto): ContratoForm aceita produto travado e devolve id_contrato criado`

---

### T19: Modificar `MandatoWizard` (produto travado + destino de navegação)

**What**: `MandatoWizardProps` ganha `produtoTravado?: { id: number; nome: string }` (substitui o
`id_produto: 1` hardcoded nas 4 ocorrências — linhas 134/171/223/234 — por
`produtoTravado?.id ?? 1`; campo Produto vira rótulo fixo quando travado) e
`destino?: (resultado: MandatoCriado) => string` (default `(r) => `/mandatos/${r.idMandato}`` —
preserva o comportamento atual de `/mandatos/novo`).
**Where**: `src/frontend/components/fundacao/mandato-wizard.tsx` (modifica)
**Depends on**: T2 (precisa de `MandatoCriado.idContrato` tipado)
**Reuses**: mesmo componente, mesmo fluxo buscar/revisar/manual/existente
**Requirement**: NAV-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Com `produtoTravado`, as 4 chamadas de `form.reset`/`defaultValues` usam o produto travado, campo Produto vira rótulo fixo
- [ ] Sem `produtoTravado`/`destino`, o comportamento é idêntico ao de hoje (`/mandatos/${idMandato}`)
- [ ] Com `destino` fornecido, navega para o resultado da função em vez do path hardcoded
- [ ] Reteste manual de `/mandatos/novo` (contratante novo via TSE, contratante manual, contratante já existente) continua funcionando sem alteração de código nessa rota
- [ ] `npm run build` continua verde

**Tests**: none
**Gate**: build

**Commit**: `feat(nav-produto): MandatoWizard aceita produto travado e destino configurável`

---

### T20: Criar `NovoContratoView`

**What**: Orquestrador — Estratégia/PLL renderizam `<MandatoWizard produtoTravado=... destino={(r) => `/contratos/${r.idContrato}`} />`; Coalizão ramifica em estado local `"escolher"|"nova"|"existente"` (nova coalizão via `CoalizaoForm` ou coalizão existente via `Select`), ambos convergindo em `<ContratoForm produtoTravado=... onConcluido={(criado) => router.push(`/contratos/${criado.idContrato}`)} />`.
**Where**: `src/frontend/components/produtos/novo-contrato-view.tsx` (novo)
**Depends on**: T18, T19
**Reuses**: `MandatoWizard`, `CoalizaoForm`, `ContratoForm` — nenhum formulário novo
**Requirement**: NAV-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Slug `estrategia`/`pll` renderiza `MandatoWizard` com produto travado
- [ ] Slug `coalizao` oferece "nova coalizão" e "coalizão existente" (AC2 do NAV-09)
- [ ] Qualquer um dos 2 caminhos de Coalizão termina abrindo `ContratoForm` com o mesmo `idContrato` de destino
- [ ] Sucesso em qualquer caminho navega pra `/contratos/${idContrato}` (AC3)
- [ ] `npm run build` continua verde

**Tests**: none
**Gate**: build

**Commit**: `feat(nav-produto): cria orquestrador de Cadastro de novo Contrato`

---

### T21: Criar `/produtos/[slug]/novo-contrato/page.tsx`

**What**: Página fina que resolve `idProduto`/`nome` via `useProdutoAtual` (T12) e renderiza
`<NovoContratoView slug={slug} idProduto={...} nomeProduto={...} />`.
**Where**: `src/frontend/app/(app)/produtos/[slug]/novo-contrato/page.tsx` (novo)
**Depends on**: T13, T20
**Reuses**: `useProdutoAtual` (T12), `NovoContratoView` (T20)
**Requirement**: NAV-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Criar contrato de Estratégia pra mandato novo e pra mandato já existente, ambos a partir desta aba, gravam `fat_contrato.id_produto` certo sem seleção manual (Independent Test do spec)
- [ ] `npm run build` continua verde

**Tests**: none
**Gate**: build

**Commit**: `feat(nav-produto): cria a aba Cadastro de novo Contrato`

---

### T22: Criar `/contratos/[id]/layout.tsx` + `FichaContratoChrome` + `not-found.tsx` de contrato

**What**: `layout.tsx` (Server, resolve `id`) renderiza `<FichaContratoChrome idContrato={id}>{children}</FichaContratoChrome>` (client) — cabeçalho ramificado por `tipo_contratante` (mandato: cargo/partido/UF atuais; coalizão: nome + projeto de origem; outro: genérico), `RouteTabs` com uma aba por `ref_etapa` (ordenada) + Assessores (`/vinculos`) + Formulários, e ação row com botões Insight/Fato Gerador (`toast()`) + link Planejamento. Se `buscarContratoParaFicha` retorna `null`, chama `notFound()` **no corpo do render** (nunca dentro do `useEffect` que popula o estado).
**Where**: `src/frontend/app/(app)/contratos/[id]/layout.tsx` (novo),
`src/frontend/components/produtos/ficha-contrato-chrome.tsx` (novo),
`src/frontend/app/(app)/contratos/[id]/not-found.tsx` (novo)
**Depends on**: T4, T9, T10
**Reuses**: `buscarContratoParaFicha`/`buscarEtapasDoProduto` (T4), `RouteTabs` (T9), `EmDesenvolvimento`/toast do `sonner` (AD-029)
**Requirement**: NAV-04, NAV-07

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Cabeçalho de um contrato de mandato mostra cargo/partido/UF atuais (não o snapshot nunca populado do contrato — AC1)
- [ ] Cabeçalho de um contrato de coalizão mostra nome + projeto de origem (AC1)
- [ ] Cabeçalho de um `tipo_contratante` fora de mandato/coalizão mostra só nome + produto, sem quebrar (edge case)
- [ ] Uma aba por `ref_etapa` do produto, ordenada por `ordem`, nomeada de verdade — nunca uma aba genérica "Etapas" (AC2)
- [ ] Produto sem nenhuma `ref_etapa` mostra 1 aba "Nenhuma etapa cadastrada" em vez de 0 abas (edge case)
- [ ] Clique em "Registrar Insight"/"Registrar Fato Gerador" mostra aviso "Em desenvolvimento", nunca abre formulário que grava (AC5)
- [ ] `/contratos/999999` (id inexistente) responde 404 com o `not-found.tsx` novo
- [ ] `npm run build` continua verde

**Tests**: none
**Gate**: build

**Commit**: `feat(nav-produto): cria layout, cabeçalho e abas da ficha do contrato`

---

### T23: Criar `/contratos/[id]/page.tsx` (redirect → 1ª etapa)

**What**: Client component que aguarda `buscarEtapasDoProduto` (via `FichaContratoChrome`/query
própria) e faz `router.replace(`/contratos/${id}/etapas/${codigo}`)` pra primeira etapa (menor
`ordem`), mostrando `<CarregandoSkeleton>` enquanto isso.
**Where**: `src/frontend/app/(app)/contratos/[id]/page.tsx` (novo)
**Depends on**: T22
**Reuses**: `CarregandoSkeleton` (AD-029)
**Requirement**: NAV-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Acessar `/contratos/[id]` (sem sub-rota) redireciona pra `/contratos/[id]/etapas/[primeiroCodigo]`
- [ ] `npm run build` continua verde

**Tests**: none
**Gate**: build

**Commit**: `feat(nav-produto): redireciona /contratos/[id] pra primeira etapa`

---

### T24: Criar `/contratos/[id]/etapas/[codigo]/page.tsx`

**What**: Mostra nome/ordem da etapa (via `ref_etapa`), `<EmDesenvolvimento>` no lugar do conteúdo
(dependeria de `fat_etapa_contrato`, não provisionada); `codigo` que não corresponde a nenhuma
etapa do produto responde 404.
**Where**: `src/frontend/app/(app)/contratos/[id]/etapas/[codigo]/page.tsx` (novo)
**Depends on**: T22
**Reuses**: `EmDesenvolvimento` (T10)
**Requirement**: NAV-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Etapa válida mostra nome/ordem + "Em desenvolvimento" no lugar do conteúdo
- [ ] `codigo` inválido pro produto daquele contrato responde 404 (mesma técnica de T22: `notFound()` no corpo do render)
- [ ] `npm run build` continua verde

**Tests**: none
**Gate**: build

**Commit**: `feat(nav-produto): cria página placeholder por etapa`

---

### T25: Criar `/contratos/[id]/formularios/page.tsx` e `/contratos/[id]/planejamento/page.tsx`

**What**: Dois placeholders triviais e idênticos em forma — "Gestão de formulários em
desenvolvimento" e "Planejamento Estratégico em desenvolvimento". O segundo **corrige** os links
já existentes (e hoje quebrados) em `contratos/page.tsx` (botão "Plan.") e `mandatos/[id]/page.tsx`
(link "Planejamento") sem tocar nenhum dos dois arquivos — eles já apontavam pra essa rota, só
faltava a página existir.
**Where**: `src/frontend/app/(app)/contratos/[id]/formularios/page.tsx` (novo),
`src/frontend/app/(app)/contratos/[id]/planejamento/page.tsx` (novo)
**Depends on**: T22, T10
**Reuses**: `EmDesenvolvimento` (T10)
**Requirement**: NAV-06, NAV-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Aba Formulários mostra "Gestão de formulários em desenvolvimento" (AC4 do NAV-04)
- [ ] `/contratos/[id]/planejamento` responde 200 com "em desenvolvimento", nunca 404 (AC6 do NAV-04)
- [ ] O botão "Plan." em `/contratos` e o link "Planejamento" em `/mandatos/[id]` deixam de resultar em 404 (verificação manual, nenhum código nesses 2 arquivos muda)
- [ ] `npm run build` continua verde

**Tests**: none
**Gate**: build

**Commit**: `feat(nav-produto): cria placeholders de Formulários e Planejamento, corrige link quebrado`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6

Phase 1:  T1 → T2 → T3 → T4 → T5 → T6
Phase 2:  T7 → T8 → T9 → T10
Phase 3:  T11
Phase 4:  T12 → T13 → T14 → T15 → T16 → T17
Phase 5:  T18 → T19 → T20 → T21
Phase 6:  T22 → T23 → T24 → T25
```

Execução é sequencial dentro de cada fase — 25 tasks no total, 6 fases, nenhuma com mais de 6
tasks (dentro do limite de ~10 do processo de Tasks).

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 | 1 arquivo gerado | ✅ Granular |
| T2 | 2 arquivos (tipo + wrapper), 1 conceito (fechar o gap de tipo) | ✅ Granular |
| T3 | 1 arquivo novo + teste | ✅ Granular |
| T4 | 1 arquivo (2 funções cohesas, mesmo consumidor) + teste | ✅ Granular |
| T5 | 1 função no mesmo arquivo de T4 + teste | ✅ Granular |
| T6 | 2 funções cohesas (mesmo consumidor: Dashboard) + teste | ✅ Granular |
| T7 | 1 hook | ✅ Granular |
| T8 | 1 componente + 1 delete + 1 edição de layout, 1 conceito (trocar nav) | ✅ Granular |
| T9 | 1 componente | ✅ Granular |
| T10 | 1 componente + 1 página (1º consumidor, trivial) | ✅ Granular |
| T11 | 1 arquivo (reescrita completa) | ✅ Granular |
| T12 | 1 hook | ✅ Granular |
| T13 | 1 layout + 1 componente + 1 not-found, 1 conceito (shell da área de produto) | ✅ Granular |
| T14 | 1 arquivo (redirect) | ✅ Granular |
| T15 | 1 arquivo (placeholder) | ✅ Granular |
| T16 | 1 arquivo (lista) | ✅ Granular |
| T17 | 1 arquivo (dashboard) | ✅ Granular |
| T18 | 1 arquivo (modificação de componente existente) | ✅ Granular |
| T19 | 1 arquivo (modificação de componente existente) | ✅ Granular |
| T20 | 1 componente (orquestrador) | ✅ Granular |
| T21 | 1 arquivo (página fina) | ✅ Granular |
| T22 | 1 layout + 1 componente + 1 not-found, 1 conceito (chrome da ficha) | ✅ Granular |
| T23 | 1 arquivo (redirect) | ✅ Granular |
| T24 | 1 arquivo (placeholder por etapa) | ✅ Granular |
| T25 | 2 arquivos triviais e idênticos em forma, mesmo consumidor (layout de T22) | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ----------------------- | -------------- | ------ |
| T1 | None | (início da Phase 1) | ✅ Match |
| T2 | None | T1 → T2 (ordem de fase, sem dependência real) | ✅ Match |
| T3 | None | T2 → T3 (ordem de fase, sem dependência real) | ✅ Match |
| T4 | T1 | T3 → T4 no diagrama de fase; dependência real declarada é T1 | ✅ Match (diagrama é ordem de execução da fase, não grafo de dependência — nenhuma seta contradiz `Depends on`) |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T5 | T5 → T6 | ✅ Match |
| T7 | None | (início da Phase 2) | ✅ Match |
| T8 | T7 | T7 → T8 | ✅ Match |
| T9 | None | T8 → T9 (ordem de fase) | ✅ Match |
| T10 | None | T9 → T10 (ordem de fase) | ✅ Match |
| T11 | None | (Phase 3, task única) | ✅ Match |
| T12 | T3 | (início da Phase 4) — T3 é de fase anterior, seta implícita entre fases | ✅ Match |
| T13 | T9, T12 | T12 → T13 | ✅ Match |
| T14 | T13 | T13 → T14 | ✅ Match |
| T15 | T13, T10 | T14 → T15 (ordem de fase); T10 é de fase anterior | ✅ Match |
| T16 | T13, T5 | T15 → T16 (ordem de fase); T5 é de fase anterior | ✅ Match |
| T17 | T13, T6, T10 | T16 → T17 (ordem de fase); T6/T10 são de fases anteriores | ✅ Match |
| T18 | None | (início da Phase 5) | ✅ Match |
| T19 | T2 | T18 → T19 (ordem de fase); T2 é de fase anterior | ✅ Match |
| T20 | T18, T19 | T19 → T20 | ✅ Match |
| T21 | T13, T20 | T20 → T21 (ordem de fase); T13 é de fase anterior | ✅ Match |
| T22 | T4, T9, T10 | (início da Phase 6) — todas de fases anteriores | ✅ Match |
| T23 | T22 | T22 → T23 | ✅ Match |
| T24 | T22 | T23 → T24 (ordem de fase); dependência real declarada é T22 | ✅ Match |
| T25 | T22, T10 | T24 → T25 (ordem de fase); T22/T10 são de fases anteriores | ✅ Match |

**Regra aplicada**: nenhuma task depende de uma task de fase posterior; toda dependência declarada
aponta pra trás (fase igual ou anterior). Setas de diagrama de fase representam ordem de execução
sequencial, não implicam dependência de dado — quando task e diagrama "divergem" (ex.: T4 depende
de T1, não de T3), a dependência real do corpo da task é a que vale; o diagrama nunca contradiz
essa dependência (não existe seta T3→T4 sem que T3 preceda T4 na mesma fase, o que é verdade).

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | ---------------------------- | ----------------- | ---------- | ------ |
| T1 | `database.types.ts` (gerado) | none (config/gerado) | none | ✅ OK |
| T2 | `src/backend/types/`, `src/backend/rpc/` | unit | unit | ✅ OK |
| T3 | `src/backend/queries/` | unit | unit | ✅ OK |
| T4 | `src/backend/queries/` | unit | unit | ✅ OK |
| T5 | `src/backend/queries/` | unit | unit | ✅ OK |
| T6 | `src/backend/queries/` | unit | unit | ✅ OK |
| T7 | `src/frontend/hooks/` | none | none | ✅ OK |
| T8 | `src/frontend/components/`, `src/frontend/app/` | none | none | ✅ OK |
| T9 | `src/frontend/components/` | none | none | ✅ OK |
| T10 | `src/frontend/components/`, `src/frontend/app/` | none | none | ✅ OK |
| T11 | `src/frontend/app/` | none | none | ✅ OK |
| T12 | `src/frontend/hooks/` | none | none | ✅ OK |
| T13 | `src/frontend/app/`, `src/frontend/components/` | none | none | ✅ OK |
| T14 | `src/frontend/app/` | none | none | ✅ OK |
| T15 | `src/frontend/app/` | none | none | ✅ OK |
| T16 | `src/frontend/app/` | none | none | ✅ OK |
| T17 | `src/frontend/app/` | none | none | ✅ OK |
| T18 | `src/frontend/components/` | none | none | ✅ OK |
| T19 | `src/frontend/components/` | none | none | ✅ OK |
| T20 | `src/frontend/components/` | none | none | ✅ OK |
| T21 | `src/frontend/app/` | none | none | ✅ OK |
| T22 | `src/frontend/app/`, `src/frontend/components/` | none | none | ✅ OK |
| T23 | `src/frontend/app/` | none | none | ✅ OK |
| T24 | `src/frontend/app/` | none | none | ✅ OK |
| T25 | `src/frontend/app/` | none | none | ✅ OK |

Nenhuma violação — todas as tasks que tocam camada com teste obrigatório (`src/backend/queries|rpc|types`) declaram `Tests: unit`; todas as tasks só-frontend declaram `Tests: none`, consistente com a matriz (débito de teste de UI é preexistente e documentado, não introduzido aqui).

---

## Execution Log

| Lote | Fases | Tasks | Status | Commits |
| ---- | ----- | ----- | ------ | ------- |
| 1 | Phase 1 | T1-T6 | ✅ Concluído (111 testes unitários, build verde) | `8c186bf` `96d5c7f` `db85d05` `fc91be5` `2cd1059` `f559f82` |
| 2 | Phase 2+3 | T7-T11 | ✅ Concluído (build verde; lint:all só acusa 15 erros/20 warnings pré-existentes fora do escopo desta feature) | `24bc4d6` `f77b6c6` `c235923` `4c1b7ac` `e7dfe69` |
| 3 | Phase 4 | T12-T17 | ✅ Concluído (build verde; lint:all estável em 27 problemas pré-existentes, 0 nos arquivos desta feature) | `5253557` `4f0e707` `4d20993` `13d72f2` `882db6a` `ac1a0f2` |
| 4 | Phase 5+6 | T18-T25 | ✅ Concluído (build verde; lint:all estável em 27 problemas pré-existentes, 0 novos; regressão manual dos 4 call-sites de `ContratoForm`/`MandatoWizard` confirmada) | `52cf42e` `85f41b6` `0faa9ad` `6b079d3` `7a72abc` `f628568` `5f21d24` `5913c0c` |

**Execute concluído — 25/25 tasks, 4 lotes, todos os gates verdes.** Próximo passo: Verifier
independente (Validate).

**Nota de execução (T1)**: escopo ampliado em 1 linha durante a execução — `rpc/mandato.ts:54`
tinha um gap de tipo pré-existente (`p_id_contratante_existente ?? null` incompatível com o
`Args` corretamente tipado após a regeneração) mascarado pelo type antigo incompleto. Corrigido
dentro da própria T1 com aprovação explícita do orquestrador antes de prosseguir — ver histórico
do commit `8c186bf`.

## Tools per Task

Nenhum MCP disponível nesta sessão se aplica a este trabalho (Slack e Supabase MCP exigem
autorização interativa, indisponível aqui) — todas as tasks usam apenas os tools de arquivo/Bash
padrão já usados no resto do projeto (edição direta + `npm run` via shell). Nenhuma skill adicional
além da própria `tlc-spec-driven` que já está conduzindo o Execute.
