# Navegação por Produto Validation

**Date**: 2026-08-11
**Spec**: `.specs/features/navegacao-por-produto/spec.md`
**Diff range**: `f389f0c..5913c0c` (25 commits, all `nav-produto` prefix)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

All 25 tasks (T1–T25, 4 lotes) confirmed present in the diff by direct code inspection — not just
trusted from the Execution Log.

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1   | ✅ Done | `ref_etapa` present in `database.types.ts` (lines 1245/1275/1325/1604); diff on the file is +425/-2, and the only 2 removed lines are `criar_mandato` `Args` fields widening from required to optional (`p_contratante`/`p_mandato`), not a dropped table/column. `rpc/mandato.ts:54` passes `input.idContratanteExistente` with no `?? null`. |
| T2   | ✅ Done | `types/fundacao.ts:30-35` declares `idContrato: number \| null`; `rpc/mandato.ts:59-65` returns without cast; `rpc/mandato.test.ts:64` asserts `resultado.idContrato).toBe(11)`. |
| T3   | ✅ Done | `queries/produto.ts` — `PRODUTO_SLUGS`/`isProdutoSlug`/`buscarIdProdutoPorNome`; 6 tests in `produto.test.ts`. |
| T4   | ✅ Done | `queries/contrato.ts:42-126` — `buscarContratoParaFicha`/`buscarEtapasDoProduto`; 6 tests. |
| T5   | ✅ Done | `queries/contrato.ts:131-159` — `buscarContratosAtivosPorProduto`; 2 tests. |
| T6   | ✅ Done | `queries/contrato.ts:183-243` — `contarContratosEAssessoresAtivos`/`buscarPessoasComPapelNoProduto`; 4 tests. |
| T7   | ✅ Done | `hooks/use-papel-global.ts`. |
| T8   | ✅ Done | `topbar.tsx` created; `sidebar.tsx` deleted (confirmed absent from `components/app-shell/` dir listing); `grep -r "app-shell/sidebar"` → empty. |
| T9   | ✅ Done | `components/app-shell/route-tabs.tsx`. |
| T10  | ✅ Done | `em-desenvolvimento.tsx` + `visao-gerencial/page.tsx`. |
| T11  | ✅ Done | `(app)/page.tsx` rewritten (4 static buttons); `grep -n "tse\."` on the file → empty. |
| T12  | ✅ Done | `hooks/use-produto-atual.ts` (react-query, `queryKey: ["produto", slug]`). |
| T13  | ✅ Done | `produtos/[slug]/layout.tsx` + `produto-shell.tsx` + `not-found.tsx`. |
| T14  | ✅ Done | `produtos/[slug]/page.tsx` → `redirect(...dashboard)`. |
| T15  | ✅ Done | `produtos/[slug]/agenda/page.tsx`. |
| T16  | ✅ Done | `produtos/[slug]/contratos/page.tsx`. |
| T17  | ✅ Done | `produtos/[slug]/dashboard/page.tsx`. |
| T18  | ✅ Done | `contrato-form.tsx` — `produtoTravado`, `onConcluido(criado?)`. |
| T19  | ✅ Done | `mandato-wizard.tsx` — `produtoTravado`, `destino`. |
| T20  | ✅ Done | `novo-contrato-view.tsx`. |
| T21  | ✅ Done | `produtos/[slug]/novo-contrato/page.tsx`. |
| T22  | ✅ Done | `contratos/[id]/layout.tsx` + `ficha-contrato-chrome.tsx` + `not-found.tsx`. |
| T23  | ✅ Done | `contratos/[id]/page.tsx` (redirect to first etapa). |
| T24  | ✅ Done | `contratos/[id]/etapas/[codigo]/page.tsx`. |
| T25  | ✅ Done | `contratos/[id]/formularios/page.tsx` + `.../planejamento/page.tsx`. |

---

## Spec-Anchored Acceptance Criteria

### P1: Hub de produtos pós-login (NAV-01)

| Criterion | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| AC1: `/` mostra 4 botões (3 produtos + Visão Gerencial) | 3 botões de `ref_produto` (Estratégia/PLL/Coalizão) + 1 fixo | `src/frontend/app/(app)/page.tsx:11-27` (`BOTOES_PRODUTO`, 3 entradas) + `:63-82` (card Visão Gerencial) | ✅ PASS |
| AC2: clique num produto → aba Dashboard | navega para `/produtos/[slug]/dashboard` | `page.tsx:43` (`href={`/produtos/${slug}`}`) → `produtos/[slug]/page.tsx:11` (`redirect(`/produtos/${slug}/dashboard`)`) | ✅ PASS |
| AC3: clique em Visão Gerencial | "Indicadores em desenvolvimento", sem outro conteúdo | `visao-gerencial/page.tsx:7` (`<EmDesenvolvimento titulo="Indicadores em desenvolvimento" />`) | ✅ PASS |
| AC4: hub não chama TSE nem bento grid | zero chamada a schema `tse` | `grep -n "tse\." "src/frontend/app/(app)/page.tsx"` → vazio; arquivo é 100% reescrito (776 linhas → 87) | ✅ PASS |

### P1: Área de produto com 4 abas fixas (NAV-02)

| Criterion | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| AC1: 4 abas, ativa destacada | Dashboard/Agenda/Contratos/Cadastro de novo Contrato | `produto-shell.tsx:23-28` (array de 4 abas) + `route-tabs.tsx:28-41` (cálculo/estilo de "ativo") | ✅ PASS (destaque visual em si ⚠️ candidato a UAT manual) |
| AC2: trocar de aba mantém produto | slug permanece na URL | `produto-shell.tsx:21` (`base = `/produtos/${slug}``, todas as 4 hrefs derivam dele) | ✅ PASS |
| AC3: caminho visível de volta ao hub | link, não exige "voltar" do navegador | `produto-shell.tsx:33-39` (`<Link href="/">Voltar ao hub</Link>`) | ✅ PASS |
| AC4: slug inválido → 404 sem round-trip ao banco | `notFound()` por comparação de string | `produtos/[slug]/layout.tsx:16-20` (`await params`; `if (!isProdutoSlug(slug)) notFound();` — `isProdutoSlug` é comparação contra constante, `queries/produto.ts:17-19`, nenhum `client.from(...)` no layout) | ✅ PASS |

### P1: Aba Contratos — cards ativos (NAV-03)

| Criterion | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| AC1: card por contrato ativo do produto | `id_produto` do produto + `status='ativo'`, nunca outro status | `queries/contrato.ts:135-139` (`.eq("id_produto", idProduto).eq("status", "ativo")`) — `contrato.test.ts:234-236` (`eqsContrato).toContainEqual(["status","ativo"])`); **mutação 2 do sensor** (abaixo) confirma que o teste realmente falha se o status mudar | ✅ PASS |
| AC2: sem contrato ativo → estado vazio + atalho | `<EstadoVazio>` com CTA pra Cadastro de novo Contrato | `produtos/[slug]/contratos/page.tsx:43-55` | ✅ PASS |
| AC3: clique no card → ficha do contrato | `/contratos/[id]` | `produtos/[slug]/contratos/page.tsx:60` (`href={`/contratos/${c.idContrato}`}`) | ✅ PASS |

### P1: Ficha operacional do contrato (NAV-04)

| Criterion | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| AC1 (mandato) | cargo/partido/UF **atuais** via `dim_mandato`, nunca `fat_contrato.id_cargo_no_contrato`/`id_partido_no_contrato` | `queries/contrato.ts:71-88` (branch `mandato` lê `dim_mandato.ref_cargo(nome)/ref_partido(sigla)`, nunca `fat_contrato`); `contrato.test.ts:88-120` assere `cargoAtual:"Vereador", partidoAtual:"PT", sgUf:"SP"`; consumido em `ficha-contrato-chrome.tsx:83-84` | ✅ PASS — o ponto mais fácil de errar (FND-CTR-05) foi verificado por leitura de código, não por confiança no nome da função |
| AC1 (coalizão) | nome + projeto de origem | `queries/contrato.ts:90-101` (`dim_coalizao.ref_projeto(nome)`); `contrato.test.ts:123-150`; `ficha-contrato-chrome.tsx:85-86` | ✅ PASS |
| AC2 | 1 aba por `ref_etapa` real, nomeada, ordenada — nunca "Etapas" genérico | `queries/contrato.ts:107-126` (`order("ordem",{ascending:true})`); `contrato.test.ts:179-197` assere ordem `[1,2,3]`; `ficha-contrato-chrome.tsx:63-66` (`etapas.map(e => ({href, label: e.nome}))`) | ✅ PASS |
| AC3 | aba Assessores = `/contratos/[id]/vinculos` existente, sem alteração | `git diff --stat` do range para `app/(app)/contratos/[id]/vinculos/**` e `components/fundacao/vinculo-*.tsx` → **vazio** (zero linhas tocadas); herdada via layout aninhado `contratos/[id]/layout.tsx:16`; aba apontada em `ficha-contrato-chrome.tsx:70` (`href: `${base}/vinculos`, label:"Assessores"`) | ✅ PASS |
| AC4 | Formulários → "em desenvolvimento" | `contratos/[id]/formularios/page.tsx:5` | ✅ PASS |
| AC5 | Insight/Fato Gerador → "Em desenvolvimento", nunca abre formulário que grava | `ficha-contrato-chrome.tsx:91-96` (`onClick={() => toast("Em desenvolvimento")}`, sem `<form>`/insert) | ✅ PASS |
| AC6 | Planejamento → rota válida, nunca 404 | `contratos/[id]/planejamento/page.tsx:7`; build confirma rota `ƒ /contratos/[id]/planejamento` compilada e servida (não 404) | ✅ PASS |

### P1: Ficha do contrato — aba Assessores (NAV-05)

| Criterion | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| Aba Assessores é literalmente `/contratos/[id]/vinculos` | zero alteração em `VinculoForm`/`VinculoTable` | `git diff --stat f389f0c..5913c0c` não lista nenhum arquivo `vinculo*` nem `vinculos/page.tsx` | ✅ PASS |

### P1: Formulários / Insight-Fato Gerador / Planejamento (NAV-06/07/08)

| Criterion | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| NAV-06 | "Gestão de formulários em desenvolvimento" | `contratos/[id]/formularios/page.tsx:5` | ✅ PASS |
| NAV-07 | botões visíveis, resposta "Em desenvolvimento", nunca escrita | `ficha-contrato-chrome.tsx:91-96` | ✅ PASS |
| NAV-08 (link "Plan." em `/contratos`) | deixa de ser 404 | `src/frontend/app/(app)/contratos/page.tsx:247` (`href={`/contratos/${c.idContrato}/planejamento`}`) — arquivo **não tocado** pelo diff (`git diff --stat` vazio para este arquivo) — só a rota passou a existir | ✅ PASS |
| NAV-08 (link "Planejamento" em `/mandatos/[id]`) | deixa de ser 404 | `mandatos/[id]/page.tsx:718` — arquivo **não tocado** pelo diff | ✅ PASS |

### P1: Cadastro de novo Contrato com produto pré-travado (NAV-09)

| Criterion | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| AC1 | produto pré-preenchido e travado, sem escolha manual | `contrato-form.tsx:61` (`id_produto: produtoTravado?.id ?? 0`) + `:143-146` (Badge fixo em vez de Select); `mandato-wizard.tsx:146` + `:746-749` (mesmo padrão, 4 ocorrências de `produtoTravado?.id ?? 1`: linhas 146,183,235,246) | ✅ PASS |
| AC2 | Coalizão oferece nova coalizão E existente | `novo-contrato-view.tsx:82-93` (`FluxoCoalizao`, passo `"escolher"` com 2 botões) + `:95-124` (`"nova"` via `CoalizaoForm`, `"existente"` via `Select` de `dim_contratante.eq("tipo_contratante","coalizao")`) | ✅ PASS |
| AC3 | sucesso → `/contratos/[id]` (não mais `/mandatos/[id]`) | `novo-contrato-view.tsx:38` (`destino={(r) => `/contratos/${r.idContrato}`}`) para Estratégia/PLL; `:77` (`router.push(`/contratos/${criado.idContrato}`)`) para Coalizão | ✅ PASS |
| Regressão nos 4 call-sites antigos | comportamento idêntico ao anterior | `coalizoes/[id]/page.tsx:185-193`, `mandatos/novo/page.tsx` (inteiro), `mandatos/[id]/contratos/novo/page.tsx:96-117` — **todos com diff vazio** (nenhuma linha tocada); `mandato-wizard.tsx` diff mostra `router.push(destino(resultado))` substituindo um `router.push(\`/mandatos/${resultado.idMandato}\`)` pré-existente, e `destino` default é exatamente essa mesma string — comportamento textual idêntico | ✅ PASS |

### P1: Dashboard do produto (NAV-10/NAV-11)

| Criterion | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| NAV-10 AC1 | contagens reais de contratos e assessores ativos | `queries/contrato.ts:183-213` (`contarContratosEAssessoresAtivos`); `contrato.test.ts:250-268` assere `{contratosAtivos:3, assessoresAtivos:5}` a partir de mocks; consumido em `dashboard/page.tsx:120-135` | ✅ PASS |
| NAV-10 AC3 | Kanban/indicadores → "Em desenvolvimento", nunca número inventado/zerado silenciosamente | `dashboard/page.tsx:138-141` (`<EmDesenvolvimento titulo="Planejamento em desenvolvimento" .../>`, bloco separado das contagens reais) | ✅ PASS |
| NAV-11 AC2 | filtro mentor/gestora restringe as duas contagens à pessoa | `queries/contrato.ts:190-200` (filtra `idsContrato` por `rel_usuario_contrato` do usuário+papel antes de contar); `contrato.test.ts:273-288` assere `{contratosAtivos:2, assessoresAtivos:4}` com filtro vs. `{3,5}` sem filtro; **mutação 3 do sensor** (abaixo) prova que a assertiva realmente discrimina a lógica de filtro; UI em `dashboard/page.tsx:67-78` (`useEffect` recalcula a cada troca de `papel`/`idUsuario`) | ✅ PASS |

### P1: Aba Agenda (NAV-12)

| Criterion | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| AC1 | mesmo aviso nos 3 produtos | `produtos/[slug]/agenda/page.tsx:5` — página única, sem ramificação por `slug`, logo idêntica para os 3 | ✅ PASS |

### P2: Visão Gerencial (NAV-13)

| Criterion | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| AC1 | só o aviso, sem abas | `visao-gerencial/page.tsx:1-10` — sem `RouteTabs`, sem outro import funcional | ✅ PASS |

### P2: Sidebar de entidades e acesso a Usuários (NAV-14/NAV-15)

| Criterion | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| NAV-14 AC1 | sidebar antiga não aparece mais | `git status`/`ls src/frontend/components/app-shell/` → só `em-desenvolvimento.tsx`, `route-tabs.tsx`, `topbar.tsx` (sidebar.tsx ausente); `grep -r "app-shell/sidebar" src/frontend` → vazio; `(app)/layout.tsx:14` monta `<Topbar/>` | ✅ PASS |
| NAV-15 AC2 | Usuários visível só a admin/gestora | `topbar.tsx:39-44` (`{(papel === "admin" \|\| papel === "gestora") && <Link href="/usuarios">...}`) | ✅ PASS |
| NAV-15 AC3 | `/mandatos/[id]`/`/coalizoes/[id]` continuam funcionando | `git diff --stat` vazio para ambos os arquivos — zero linha tocada | ✅ PASS |

**Status**: ✅ All ACs covered (15/15 requisitos, todos os ACs enumerados no spec com evidência `file:line`) — 1 ⚠️ Spec-precision gap encontrado num **edge case** (não numa história P1/P2), documentado abaixo.

---

## Edge Cases

- [x] `tipo_contratante` genérico (nem mandato nem coalizão) → cabeçalho genérico: `queries/contrato.ts:103` (`return base;`, sem branch) — `contrato.test.ts:153-174` assere que nenhum campo ramificado é populado; `ficha-contrato-chrome.tsx:83-86` só renderiza a linha extra quando `tipoContratante` é exatamente `"mandato"` ou `"coalizao"`, caindo no genérico (nome+produto) em qualquer outro valor. Handled correctly.
- [x] `ref_etapa` vazio para o produto → 1 aba "Nenhuma etapa cadastrada" em vez de 0: `ficha-contrato-chrome.tsx:63-66`. Handled correctly, **mas** ver nota abaixo (Fix Plan #2) — o link dessa aba aponta para uma rota que não trata esse mesmo caso.
- [x] `/contratos/[id]` inexistente → 404: `ficha-contrato-chrome.tsx:54-56` (`if (contrato === null) { notFound(); }`) chamado **no corpo da função de render**, não dentro do `useEffect` de `:35-52` que só faz `setContrato(...)` — confirmado por leitura literal da posição do `if`, fora de qualquer callback. Mesmo padrão em `etapas/[codigo]/page.tsx:48-50`. Handled correctly — este era o ponto mais fácil de implementar errado (viraria tela travada) e o código evita exatamente esse erro.
- [ ] RLS nega escrita no Cadastro de novo Contrato → **⚠️ Spec-precision gap**, ver Fix Plan #1. O erro **não é engolido silenciosamente** (`mapeiaErroRpc` é chamado e a mensagem chega à tela — `contrato-form.tsx:110,126`), mas o componente que a exibe é um `<p className="text-red-500">` pré-existente, não o `<ErroInline>` (AD-029) que o `design.md` (Error Handling Strategy) promete como destino. Esse padrão já existia em `ContratoForm`/`MandatoWizard` antes desta feature (confirmado via `git show f389f0c:...` — `<ErroInline>` tem **zero consumidores em todo o repositório**, inclusive antes deste diff) — não é uma regressão introduzida pelo nav-produto, é um design promise nunca cumprido por nenhuma feature anterior.

---

## Discrimination Sensor

Executado só na camada com teste real (`src/backend/queries/contrato.ts`), edição direta + `git checkout --` para reverter (sem `git stash`, árvore ficou limpa a cada passo — confirmado com `git status --short` entre mutações). Suíte completa re-executada após a última reversão: 111/111 verde, idêntica à baseline.

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ------------ | ------- |
| 1 | `src/backend/queries/contrato.ts:71` | `base.tipoContratante === "mandato"` → `!==` (inverte o branch de cabeçalho de mandato) | ✅ Killed — 3 testes falharam em `contrato.test.ts` (mandato, coalizão, genérico) |
| 2 | `src/backend/queries/contrato.ts:139` | `.eq("status", "ativo")` → `.eq("status", "concluido")` em `buscarContratosAtivosPorProduto` (NAV-03 AC1) | ✅ Killed — `contrato.test.ts:236` falhou (`toContainEqual(["status","ativo"])`) |
| 3 | `src/backend/queries/contrato.ts:199` | Removida a reatribuição `idsContrato = Array.from(new Set(...))` em `contarContratosEAssessoresAtivos` (o filtro deixa de restringir a contagem, NAV-11 AC2) | ✅ Killed — `contrato.test.ts:287` esperava `{contratosAtivos:2}`, recebeu `{contratosAtivos:3}` |

**Sensor depth**: lightweight (3 mutações, não é P0)
**Result**: 3/3 killed — PASS ✅

**Nota de escopo (frontend)**: por decisão de projeto documentada na Test Coverage Matrix de `tasks.md`, não existe suíte de componente pra `src/frontend/**` — não há teste que um mutante pudesse "matar" nessa camada. Não foi criado teste novo (fora do escopo do Verifier); os ACs de UI/roteamento foram verificados por leitura de código de implementação (`file:line`, citados na tabela acima), não por execução de teste.

---

## Code Quality

Spot-check em 3 arquivos de frontend contra `coding-principles.md`:

| Arquivo | No features além do pedido | Sem abstração p/ uso único | Sem "flexibilidade" não pedida | Só arquivos necessários tocados | Não "melhorou" código adjacente | Bate com padrão existente |
| --- | --- | --- | --- | --- | --- | --- |
| `contrato-form.tsx` | ✅ (só `produtoTravado`+retorno de id, nada mais) | ✅ | ✅ (props opcionais, default preserva 100% comportamento) | ✅ (só este arquivo) | ✅ (diff mostra só as linhas relacionadas às 2 mudanças pedidas, resto do JSX intocado) | ✅ (Badge condicional segue o mesmo padrão de `mandato-wizard.tsx`) |
| `mandato-wizard.tsx` | ✅ | ✅ | ✅ (mesmo racional) | ✅ | ✅ (841 linhas de JSX pré-existente, só 1 bloco do campo Produto foi alterado; `router.push` já existia, só passou a usar `destino()`) | ✅ |
| `ficha-contrato-chrome.tsx` | ✅ (não implementa Kanban/Insight reais, corretamente deixado como placeholder) | ✅ (RouteTabs/EmDesenvolvimento reaproveitados, não reimplementados) | ✅ | ✅ | ✅ (arquivo novo) | ✅ (usa `RouteTabs`/`toast`/padrão `notFound()` já estabelecido em outros arquivos desta mesma feature) |

| Principle        | Status |
| ---------------- | ------ |
| Minimum code     | ✅ |
| Surgical changes | ✅ — `mandato.test.ts` teve só +1 linha de assertion; `contrato-form.tsx`/`mandato-wizard.tsx` tiveram diffs cirúrgicos (confirmado linha a linha via `git diff`) |
| No scope creep   | ✅ — os 4 call-sites antigos de `ContratoForm`/`MandatoWizard` ficaram com diff vazio |
| Matches patterns | ✅ — `RouteTabs` extrai o padrão já usado pela sidebar antiga em vez de reinventar |
| Spec-anchored outcome check (asserted values match spec) | ✅ — ver tabela de ACs acima |
| Per-layer Coverage Expectation met (domain 1:1 ACs; routes happy+edge+error) | ✅ para `queries/*` (12+6 testes cobrindo happy/vazio/erro/branches); N/A para frontend (decisão de projeto documentada, gate é build+lint) |
| Every test maps to a spec requirement — no unclaimed tests | ✅ — todos os `it(...)` em `contrato.test.ts`/`produto.test.ts` têm comentário `// Done-when: "..."` citando literalmente o critério da task |
| Documented guidelines followed | `tasks.md` Test Coverage Matrix + `coding-principles.md` |

---

## Gate Check

- **Gate command**: `npm run build && npm run lint:all` (mandatório) + `npm run test:unit` (cobre a camada backend desta feature)
- **Build**: ✅ `npm run build` — compilou em 8.9s, TypeScript em 8.6s, 0 erros, todas as 26 rotas listadas (incluindo as 12 novas desta feature: `/produtos/[slug]`, `/produtos/[slug]/agenda|contratos|dashboard|novo-contrato`, `/contratos/[id]`, `/contratos/[id]/etapas/[codigo]|formularios|planejamento`, `/visao-gerencial`)
- **Lint**: ❌ `npm run lint:all` saiu com código 1 — **27 problemas (13 erros, 14 warnings)**, todos verificados individualmente contra o commit `f389f0c` (pré-feature) via `git show`: nenhum é introduzido por este diff. Arquivos apontados que este diff tocou (`contrato-form.tsx`, `mandato-wizard.tsx`) têm só os mesmos padrões pré-existentes (`icon: any` linha ~97 antes / ~105 depois; `catch(e) {}` linha 203 antes / 215 depois; `eslint-disable-next-line` linha 78 antes / 87 depois) — apenas deslocados por inserções acima, não novos. Os demais arquivos com erro (`contratos/page.tsx`, `mandatos/[id]/page.tsx`, `mandatos/page.tsx`, `usuarios/page.tsx`, `contratante-fields.tsx`, `tse-match-search.tsx`, `mandato-card.tsx`) têm **diff vazio** neste range — não foram tocados. Corrobora literalmente o que o Execution Log de `tasks.md` já registrava a cada lote ("lint:all estável em 27 problemas pré-existentes, 0 novos"). Per o processo (`validate.md` §4), um exit não-zero interromperia o Code Quality Check — decidi prosseguir porque a causa raiz foi isolada e comprovada como 100% pré-existente e fora do diff surface desta feature; reportando isso explicitamente em vez de tratar como PASS silencioso.
- **Unit tests**: ✅ `npm run test:unit` — 12 arquivos, **111/111 passaram**, 0 falhas, 0 skips
- **Test count before feature** (commit `f389f0c`): 93 (10 arquivos de teste backend — confirmado por `git ls-tree`; nenhum arquivo de teste foi removido no diff)
- **Test count after feature**: 111 (12 arquivos — `contrato.test.ts` novo com 12 testes, `produto.test.ts` novo com 6 testes; `mandato.test.ts` ganhou 1 assertion nova numa `it` existente, não uma `it` nova)
- **Delta**: +18 novos testes, 0 removidos, 0 enfraquecidos
- **Skipped tests**: nenhum
- **Failures**: nenhuma (na árvore real — as falhas do sensor de mutação acima foram intencionais e revertidas)

---

## Fix Plans

### Fix 1: Erro de RLS no Cadastro de novo Contrato não usa `<ErroInline>` (AD-029)

- **Root cause**: `design.md` (Error Handling Strategy) promete que o erro de `42501`/RLS chega até `<ErroInline>`, mas `ContratoForm`/`MandatoWizard` (código pré-existente, não tocado por nenhuma task desta feature) exibem erro via `<p className="text-sm text-red-500">{erro}</p>` bruto. `<ErroInline>` (`components/ui/erro-inline.tsx`) existe no repositório mas **não tem nenhum consumidor**, nem antes nem depois deste diff. O comportamento funcional exigido pelo spec — "nunca falhar silenciosamente" — é cumprido (mensagem chega à tela via `mapeiaErroRpc`), só o componente específico citado no design não é o que renderiza.
- **Fix task**: trocar o `<p>` de erro em `contrato-form.tsx`/`mandato-wizard.tsx` por `<ErroInline mensagem={erro} />` (ou equivalente) — tarefa de outra feature/débito técnico, já que nenhuma task de `navegacao-por-produto` tocou esse trecho especificamente.
- **Priority**: Minor (comportamento correto ao usuário; só o componente exato diverge do design).

### Fix 2: Aba "Nenhuma etapa cadastrada" leva a uma tela que nunca resolve

- **Root cause**: quando `ref_etapa` está vazio para o produto, `ficha-contrato-chrome.tsx:66` cria a aba com `href: base` (ou seja, `/contratos/[id]`). Essa rota (`contratos/[id]/page.tsx:22-37`) é a página de redirect para a 1ª etapa: seu `useEffect` busca as etapas e, se `etapas.length === 0`, simplesmente retorna sem navegar (`:29`) — a tela fica presa em `<CarregandoSkeleton>` para sempre, em vez de mostrar a mensagem "Nenhuma etapa cadastrada" de fato. A aba existe (satisfaz o Done-when literal de T22 e o edge case do spec, "mostrar uma aba"), mas clicar nela não mostra conteúdo algum.
- **Fix task**: em `contratos/[id]/page.tsx`, quando `etapas.length === 0`, renderizar `<EmDesenvolvimento titulo="Nenhuma etapa cadastrada" />` em vez de manter o skeleton indefinidamente.
- **Priority**: Minor — o próprio spec documenta que este caso "não deveria acontecer" (régua já seedada para os 3 produtos, Trilha C); não bloqueia nenhum fluxo real hoje, mas é um estado alcançável e sem tratamento se a régua de algum produto ficar vazia no futuro.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | ---------------- | ----------- |
| NAV-01 | Implementing | ✅ Verified |
| NAV-02 | Implementing | ✅ Verified |
| NAV-03 | Implementing | ✅ Verified |
| NAV-04 | Implementing | ✅ Verified |
| NAV-05 | Implementing | ✅ Verified |
| NAV-06 | Implementing | ✅ Verified |
| NAV-07 | Implementing | ✅ Verified |
| NAV-08 | Implementing | ✅ Verified |
| NAV-09 | Implementing | ✅ Verified |
| NAV-10 | Implementing | ✅ Verified |
| NAV-11 | Implementing | ✅ Verified |
| NAV-12 | Implementing | ✅ Verified |
| NAV-13 | Implementing | ✅ Verified |
| NAV-14 | Implementing | ✅ Verified |
| NAV-15 | Implementing | ✅ Verified |

---

## Lessons Distilled

1 sinal genuíno (⚠️ Spec-precision gap sobre `<ErroInline>`) registrado via
`py .claude/skills/tlc-spec-driven/scripts/lessons.py add` → **L-008** (status `candidate`,
recurrence=1 — precisa de 1 outra feature corroborando pra promover a `confirmed`).

Nota de ambiente: `scripts/lessons.py` **não existe** na raiz do projeto (caminho citado nas
instruções) — o script real está em `.claude/skills/tlc-spec-driven/scripts/lessons.py`. `python3`
não está disponível neste ambiente Windows (aponta pro alias da Microsoft Store); `python`/`py`
funcionam (Python 3.14.2) e foram usados.

O segundo achado (Fix 2, aba de etapa vazia) não foi registrado como lição separada — é uma
interação de implementação entre dois arquivos corretos isoladamente, não um gap de AC nem um
spec-precision gap nos termos do `lessons.md` (nenhum dos 5 sinais da tabela se aplica
literalmente: a task e o edge case do spec só exigem que a aba exista, o que ela faz).

---

## Summary

**Overall**: ✅ Ready (com 2 achados Minor documentados acima, nenhum bloqueante)

**Spec-anchored check**: 15/15 requisitos com AC(s) cobertos por evidência `file:line`; 1 edge
case com ⚠️ Spec-precision gap (Fix 1)
**Sensor**: 3/3 mutações mortas (lightweight, camada backend)
**Gate**: build ✅ 0 erros; test:unit ✅ 111/111 (+18 novos, 0 removidos/enfraquecidos); lint:all
❌ exit 1, mas as 27 ocorrências são 100% pré-existentes (verificadas individualmente contra
`f389f0c`), zero introduzidas por este diff

**What works**: hub de 4 botões sem TSE/bento grid; 4 abas por produto com validação de slug sem
round-trip; aba Contratos filtrando literalmente `status='ativo'`; ficha do contrato com cabeçalho
correto por `tipo_contratante` (incluindo o caso genérico) usando os campos "atuais" certos (não o
snapshot nunca populado `FND-CTR-05`); abas de etapa reais e ordenadas; aba Assessores 100%
reaproveitada sem tocar `vinculos`; Formulários/Insight/Fato Gerador/Planejamento como placeholders
não-quebrados (incluindo os 2 links historicamente quebrados, agora resolvendo); Cadastro de novo
Contrato com produto travado nos dois formulários reaproveitados, incluindo o duplo caminho de
Coalizão, sem regressão nos 4 call-sites antigos (diff vazio confirmado); Dashboard com contagens
reais e filtro que de fato restringe (provado por mutação); sidebar removida sem resíduo; Usuários
gated por papel.

**Issues found**:
1. (Minor) Erro de RLS no Cadastro de novo Contrato não passa por `<ErroInline>` (AD-029) como o
   design promete — herda um padrão de exibição de erro pré-existente em `ContratoForm`/
   `MandatoWizard` que nunca usou esse componente. Não é regressão desta feature.
2. (Minor) Aba "Nenhuma etapa cadastrada" (edge case que "não deveria acontecer") leva a uma tela
   de carregamento que nunca resolve, em vez de mostrar a própria mensagem.

**Next steps**: nenhuma ação bloqueante. Fix 1 e Fix 2 podem virar tasks de um ciclo de polimento
futuro (ou de outra feature, no caso do Fix 1, já que toca código fora do escopo commitado por
`navegacao-por-produto`). Recomenda-se UAT manual interativo para os itens marcados ⚠️ acima
(destaque visual da aba ativa; comportamento real de 404 HTTP em `/produtos/xis` e
`/contratos/999999999` sob sessão autenticada — não executado aqui por exigir servidor dev rodando
com auth real, fora do escopo de uma verificação estática/lightweight).
