# Pente-Fino 2026-09-23 (Lote 2) Validation

**Date**: 2026-09-23
**Spec**: `.specs/features/pente-fino-2026-09-23-lote2/spec.md`
**Diff range**: `f461c69^..c0b815b` (5 commits: `f461c69`, `beba6b4`, `6afb3ab`, `71fe6c7`, `c0b815b`)
**Verifier**: independente (author ≠ verifier)

---

## Task Completion

| Commit | Story | Status | Notes |
| --- | --- | --- | --- |
| `f461c69` | PF3-01 | ✅ Done | `lista-participantes-pll.tsx` — link "Ver ficha" condicional a `idContrato` |
| `beba6b4` | PF3-05 | ✅ Done | `pll-dashboard.ts` — coluna Edição via `fat_edicao.nome`/`id_edicao`, troca `id_projeto` |
| `6afb3ab` | PF3-03 | ✅ Done | `mandatos-lista.ts` + `fatos-geradores/page.tsx` + `filtros-fatos-geradores.tsx` — filtro Mentor no PLL |
| `71fe6c7` | PF3-02 | ✅ Done | Extração de `composicao-partidaria-casa.tsx` + `RoscaAnalise ocultarTitulo` |
| `c0b815b` | PF3-04 | ✅ Done | Só teste novo em `informacoes-gerais-pll.test.tsx`; zero diff em código de produção (confirmado — ver abaixo) |

Confirmado por `git diff f461c69^..c0b815b -- src/frontend/components/pll/informacoes-gerais-pll.tsx`: diff vazio. PF3-04 é exatamente o que a spec descreve ("sem código novo").

---

## Spec-Anchored Acceptance Criteria

### P1: Coluna Edição (PF3-05)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1 — `id_edicao` preenchido → mostra `fat_edicao.nome` | `nomeEdicao` = nome real da edição (ex. "PLL 2026.1"), não o nome do projeto (fixture usa "Bancada do Clima" propositalmente diferente) | `src/backend/queries/pll-dashboard.test.ts:294` — `nomeEdicao: "PLL 2026.1"` dentro do objeto esperado por `toEqual` (linha 237-296, caso "caminho feliz") | ✅ PASS |
| AC2 — `id_edicao` nulo → "—" (nunca nome do projeto) | `nomeEdicao === null` (o "—" é responsabilidade da UI, consistente com o padrão AD-005 do restante do arquivo) | `pll-dashboard.test.ts:343` — `expect(resultado[0].nomeEdicao).toBeNull()` | ✅ PASS |

### P1: Filtro Mentor em Fatos Geradores do PLL (PF3-03)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1 — produto PLL mostra "Mentor" com opções de `buscarOpcoesMentorPll` | Rótulo exato "Mentor", chamada à função certa | `src/frontend/app/(app)/produtos/[slug]/fatos-geradores/page.test.tsx:319-327` — `expect(screen.getByTestId("rotulo-pessoa")).toHaveTextContent("Mentor")` + `expect(mocks.buscarOpcoesMentorPll).toHaveBeenCalledWith({}, 1)` + `expect(mocks.buscarGestorasAtivas).not.toHaveBeenCalled()` | ✅ PASS |
| AC2 — mentor(es) selecionados restringe a `papel_no_contrato='mentor'`, `dt_fim IS NULL` | Query exata (`.eq("papel_no_contrato","mentor")`) + resultado restrito | `src/backend/queries/mandatos-lista.test.ts:287-299` — `expect(chamadaVinculo?.args).toEqual(["papel_no_contrato", "mentor"])` (o `.or(filtroVinculoAtivo())`, que resolve `dt_fim IS NULL OR >= hoje`, é chamado incondicionalmente pela função compartilhada `idsContratoPorPapel`, já coberto pelo teste espelho de gestora na mesma suíte — não há teste isolado que confira `dt_fim` para o caso mentor especificamente, mas a mecânica é idêntica e compartilhada, não duplicada) + `page.test.tsx:328-341` prova o encadeamento produto→`idsMentor` | ✅ PASS (com nota — ver Spec-precision abaixo) |
| AC3 — produto NÃO-PLL continua "Gestora", sem regressão | Rótulo "Gestora" e `idsGestora` continuam sendo usados | `page.test.tsx:342-354` (`describe` "lado oposto") — `toHaveBeenLastCalledWith({}, { idProduto: 1, idsGestora: [5], idsMentor: undefined, idsProjeto: undefined })` + `filtros-fatos-geradores.test.tsx:100-107` — `rotuloPessoa` default continua "Gestora" | ✅ PASS |

**Nota de escopo (contexto do prompt)**: a spec documenta em Out of Scope que `fn_estrategia_kpi` não tem parâmetro de mentor e que o código contorna isso passando `idsContrato` já resolvido em vez do filtro de pessoa. Isso está implementado em `src/frontend/app/(app)/produtos/[slug]/fatos-geradores/page.tsx:126-140` (comentário explícito + `idsContrato: listaOuUndefined(ehPll ? idsContrato : idsContratoEscolhidos)`), mas **não há teste que exercite esse caminho especificamente para PLL** (nenhum teste em `page.test.tsx` afirma o valor de `idsContrato` passado a `buscarEstrategiaKpi` quando `ehPll=true` e um mentor é selecionado). Os 3 novos testes do describe "PLL (PF3-03)" cobrem `buscarMandatosLista`, não `buscarEstrategiaKpi`. → ❌ NOT COVERED (o contorno documentado no Out of Scope não tem `file:line` de prova).

### P1: Gráfico de Composição Partidária (PF3-02)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1 — renderiza donut (`RoscaAnalise`) com siglas/quantidades/percentuais | `role="img"` com `n` = soma de quantidades, sigla e percentual visíveis | `src/frontend/components/pll/composicao-partidaria-casa.test.tsx:15-31` — `getByRole("img", {name:...})` presente, `getByText("20")` (soma 12+8), `getByText("PT")`, `getByText("60%")` | ✅ PASS |
| AC2 — vazio continua `EstadoVazio` | Mensagem "Dados indisponíveis para esta Casa/ano", sem gráfico | `composicao-partidaria-casa.test.tsx:53-58` — `getByText(...)` + `queryByRole("img",...)).not.toBeInTheDocument()` | ✅ PASS |
| AC3 — mesmo componente em `/produtos/pll/participantes/[id]` e `/contratos/[id]/diagnostico` mostra igual | Ambas as rotas renderizam o mesmo `ComposicaoPartidariaCasa` | `src/frontend/app/(app)/produtos/pll/participantes/[id]/page.test.tsx:240-249` prova a rota de participante (via `findAllByText` — 2 ocorrências, uma delas sr-only, ver nota abaixo). Rota `/contratos/[id]/diagnostico` reaproveita `DiagnosticoParticipantePll` que importa o mesmo `ComposicaoPartidariaCasa` (`diagnostico-participante-pll.tsx:13`), mas **não há teste próprio de `/contratos/[id]/diagnostico` verificando a presença do gráfico nessa segunda rota** — a garantia é só estrutural (mesmo import), não testada nas duas pontas | ⚠️ Spec-precision gap (AC3 parcialmente coberto — só uma das duas rotas citadas tem teste direto) |

### P2: Rota única para participante já vinculado (PF3-01)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1 — `id_contrato` preenchido → `/contratos/[idContrato]/informacoes` | Href exato com o id do contrato | `src/frontend/components/pll/lista-participantes-pll.test.tsx:118-122` — `expect(screen.getByRole("link", { name: "Ver ficha" })).toHaveAttribute("href", "/contratos/42/informacoes")` | ✅ PASS |
| AC2 — sem `id_contrato` → continua `/produtos/pll/participantes/[idCadastroParticipante]` | Href exato com o id de cadastro, comportamento igual a hoje | `lista-participantes-pll.test.tsx:124-134` — `toHaveAttribute("href", "/produtos/pll/participantes/7")` | ✅ PASS |

### P3: Confirmar remoção de "Etapa do produto" (PF3-04)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1 — campo "Etapa do produto" ausente na aba Informações Gerais de um contrato PLL | `queryByText("Etapa do produto")` não encontrado | `src/frontend/components/pll/informacoes-gerais-pll.test.tsx:77-83` — `expect(screen.queryByText("Etapa do produto")).not.toBeInTheDocument()` | ✅ PASS |

**Status**: ✅ 9/10 ACs cobertos com outcome exato · 1 NOT COVERED (contorno do KPI mentor em PF3-03, item do Out of Scope) · 1 spec-precision gap (PF3-02 AC3, segunda rota sem teste direto).

---

## Discrimination Sensor

Executado em estado de rascunho real (edição direta nos arquivos-fonte de produção, restaurados via `git checkout -- <path>` logo após cada rodada; `git status` confirmado idêntico ao estado inicial — só os arquivos já sujos de sessão concorrente, não tocados por esta verificação — depois de cada restauração).

| # | File:line | Mutação | Testes rodados | Killed? |
| --- | --- | --- | --- | --- |
| 1 | `src/frontend/components/pll/lista-participantes-pll.tsx:333` | `participante.idContrato !== null` → `=== null` (inverte a condição do link "Ver ficha", PF3-01) | `lista-participantes-pll.test.tsx` | ✅ Killed (2/2 falharam: os dois hrefs saem trocados) |
| 2 | `src/backend/queries/mandatos-lista.ts:202` | `"mentor"` → `"gestora"` no chamador de `idsContratoPorPapel` para `idsMentor` (PF3-03) | `mandatos-lista.test.ts` | ✅ Killed (assert do papel enviado à query falha) |
| 3 | `src/backend/queries/pll-dashboard.ts:585` | `idEdicao !== null` → `idEdicao === null` (inverte a condição de `nomeEdicao`, PF3-05) | `pll-dashboard.test.ts` | ✅ Killed (2/2 falharam: caso com edição vira null, caso "mais recente" perde o valor) |
| 4 | `src/frontend/components/pll/composicao-partidaria-casa.tsx:36` | Removida a prop `ocultarTitulo` da chamada a `RoscaAnalise` (PF3-02) | `composicao-partidaria-casa.test.tsx` | ✅ Killed (teste de não-duplicação visual falha: 2 títulos visíveis em vez de 1) |
| 5 | `src/frontend/components/estrategia/filtros-fatos-geradores.tsx:83` | `placeholderPessoa` deixa de depender de `rotuloPessoa` (sempre "Todas as gestoras", PF3-03) | `filtros-fatos-geradores.test.tsx` | ✅ Killed (assert do placeholder "Todos os mentores" falha) |

**Sensor depth**: lightweight (5 mutações, uma por task/commit; feature não é P0/crítica de pagamento/auth)
**Result**: 5/5 killed — ✅ PASS

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | ✅ — cada commit toca só os arquivos necessários pro seu bug |
| Surgical changes | ✅ |
| No scope creep | ✅ — `lista-participantes-pll.tsx` também ganhou `InfoComparacaoTse`/`onEditar`/`Legenda...` nesse diff, mas isso é de uma sessão concorrente já marcada como `?? ` (untracked) no `git status`, não faz parte dos 5 commits deste lote (confirmado via `git diff f461c69^..c0b815b`, que só mostra o trecho do link "Ver ficha" tocado por PF3-01 dentro desse arquivo — o restante do diff do arquivo, incluindo `InfoComparacaoTse`, também está no range dos 5 commits porque foi commitado junto em `f461c69`; é um único commit "fix(pll): Ver ficha leva pra contrato..." que trouxe também popover de comparação TSE e botão Editar, fora do que PF3-01 pede) — **ver observação abaixo** |
| Matches patterns | ✅ — reuso de `RoscaAnalise`/`MultiSelectPesquisavel` já validados |
| Spec-anchored outcome check | ⚠️ 9/10 PASS, 1 NOT COVERED, 1 spec-precision gap (ver acima) |
| Per-layer Coverage Expectation | ✅ — domínio (`mandatos-lista.ts`, `pll-dashboard.ts`) com 1:1 AC; componentes com teste de presença/ausência/estado |
| Every test maps to spec AC/edge case | ✅ — nenhum teste "solto" fora do escopo dos 5 commits identificado |
| Documented guidelines followed | `CLAUDE.md` (padrão de testes por camada, MultiSelectPesquisavel como filtro padrão) — seguido |

**Observação — scope creep no commit `f461c69`**: o diff de `f461c69` (`fix(pll): Ver ficha leva pra contrato quando participante já está vinculado`) inclui, além do link "Ver ficha" (PF3-01), a adição do popover `InfoComparacaoTse`, o botão `onEditar`/`Pencil` e `LegendaCamposPlanilhaPll` em `lista-participantes-pll.tsx` — nenhum desses itens está nos 5 Goals da spec `pente-fino-2026-09-23-lote2`. São mudanças legítimas (comentário no código as atribui à "Sessão 23/09", provavelmente uma tarefa paralela de UX pedida pelo Pedro), mas **misturadas no mesmo commit da task PF3-01** em vez de atômicas por task, quebrando a premissa "5 bugs implementados em 5 commits atômicos, um por task" do prompt desta verificação. Não é um problema de cobertura de teste (os campos extras têm teste próprio em `lista-participantes-pll.test.tsx`, fora do escopo desta spec), mas é uma quebra de atomicidade que vale registrar.

---

## Edge Cases (spec.md)

- [x] `fat_cadastro_participante` com mais de uma linha por `id_contrato` (troca de vínculo) → `id_edicao` segue a mesma linha "mais recente" de `nomeMentorado` — `pll-dashboard.test.ts:350-391`, testado e killed pelo sensor #3
- [ ] Nenhum mentor com vínculo ativo em nenhum contrato PLL → filtro de Mentor mostra lista vazia sem erro — **não verificado por teste específico**. `buscarOpcoesMentorPll` (a função de origem das opções) já tem teste de "recorte sem nenhum contrato devolve []" (`pll-dashboard.test.ts:512`), mas nenhum teste do lote 2 cobre o caminho "produto PLL, zero mentores, filtro renderiza vazio sem erro" na tela de Fatos Geradores especificamente — NOT COVERED nesta rodada (o comportamento provavelmente funciona por reuso do padrão de `MultiSelectPesquisavel` com array vazio, mas não há assert direto)

---

## Gate Check

- **Gate command**: `npm run test:unit` (suíte completa) + lint direcionado (`eslint` nos arquivos tocados, backend e frontend)
- **test:unit result**: 1891 passed, 15 failed, 1906 total (173/174 arquivos de teste passaram)
- **Falhas**: todas em `src/frontend/app/(app)/contratos/[id]/fatos-registros/page.test.tsx`, mesmo erro `Cannot read properties of undefined (reading 'getUser')` em `src/frontend/hooks/use-papel-global.ts:30` já documentado como pré-existente na validação do lote irmão (`pente-fino-2026-09-23/validation.md`). Nenhum dos 8 arquivos tocados pelos 5 commits deste lote aparece na lista de falhas — não é regressão.
- **Arquivos tocados por este lote, rodados isoladamente**: 8 arquivos de teste, 108/108 testes passaram (`mandatos-lista.test.ts`, `pll-dashboard.test.ts`, `fatos-geradores/page.test.tsx`, `filtros-fatos-geradores.test.tsx`, `composicao-partidaria-casa.test.tsx`, `participantes/[id]/page.test.tsx`, `lista-participantes-pll.test.tsx`, `informacoes-gerais-pll.test.tsx`)
- **lint (backend, arquivos tocados)**: `npx eslint src/backend/queries/mandatos-lista.ts src/backend/queries/pll-dashboard.ts` — 0 erros, 0 warnings
- **lint (frontend, arquivos tocados)**: `npx eslint` (via config do frontend) nos 6 arquivos `.tsx` de produção tocados — 0 erros, 0 warnings
- **Build**: não executado nesta rodada (fora do orçamento da tarefa; recomendação: rodar antes de qualquer merge para `master`, mesma recomendação pendente do lote irmão)
- **Test count antes do lote**: não medido diretamente; delta observável é de +7 arquivos de teste modificados/1 novo (`composicao-partidaria-casa.test.tsx`) com testes novos consistentes com os 5 commits
- **Skipped tests**: nenhum

---

## Fix Plans

### Fix 1: PF3-03 — contorno de `idsContrato` no KPI para PLL sem teste

- **Root cause**: `fatos-geradores/page.tsx:126-140` implementa o contorno documentado no Out of Scope (passar `idsContrato` já resolvido em vez do filtro de pessoa pro `fn_estrategia_kpi`, que não tem parâmetro de mentor), mas nenhum teste em `page.test.tsx` afirma o valor de `idsContrato` passado a `buscarEstrategiaKpi` no caminho PLL com mentor selecionado.
- **Fix task**: adicionar um teste em `page.test.tsx` (describe "PLL (PF3-03)") que selecione um mentor e assira `buscarEstrategiaKpi` chamado com `idsGestora: undefined` e `idsContrato` igual à lista resolvida por `buscarMandatosLista` para aquele mentor (não `idsContratoEscolhidos`).
- **Priority**: Minor — comportamento documentado como decisão de design de baixo risco, mas sem rede de segurança de teste.

### Fix 2: PF3-02 AC3 — segunda rota (`/contratos/[id]/diagnostico`) sem teste direto do gráfico

- **Root cause**: `DiagnosticoParticipantePll` (usado em ambas as rotas) importa `ComposicaoPartidariaCasa`, mas só existe teste de tela para a rota `/produtos/pll/participantes/[id]`; a rota `/contratos/[id]/diagnostico` não tem suite própria cobrindo esse bloco.
- **Fix task**: se existir (ou for criado) um `page.test.tsx` para `/contratos/[id]/diagnostico`, adicionar um assert equivalente ao de `participantes/[id]/page.test.tsx:240-249` confirmando a presença do gráfico (`role="img"`) nessa rota também.
- **Priority**: Minor — garantia estrutural (mesmo componente reaproveitado) reduz o risco, mas o AC pede explicitamente as duas rotas.

### Fix 3: Edge case "nenhum mentor com vínculo ativo" sem teste na tela de Fatos Geradores PLL

- **Root cause**: o array vazio de opções de mentor não tem um teste que confirme "sem erro, lista vazia" especificamente no contexto da tela de Fatos Geradores do PLL (só a query de origem, `buscarOpcoesMentorPll`, tem esse teste isolado).
- **Fix task**: no describe "PLL (PF3-03)" de `page.test.tsx`, adicionar um teste com `mocks.buscarOpcoesMentorPll.mockResolvedValue([])` e assert de que a tela renderiza sem erro (ex. `MultiSelectPesquisavel` sem opções, sem exceção lançada).
- **Priority**: Minor.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| PF3-01 | Implementing | ✅ Verified |
| PF3-02 | Implementing | ⚠️ Needs Fix (AC3 spec-precision gap) |
| PF3-03 | Implementing | ⚠️ Needs Fix (contorno de KPI sem teste + edge case sem teste) |
| PF3-04 | Implementing | ✅ Verified |
| PF3-05 | Implementing | ✅ Verified |

---

## Summary

**Overall**: ⚠️ Issues (não bloqueante para o valor de negócio — os 5 bugs do backup foram corrigidos e o comportamento crítico de cada um está sob teste com outcome exato — mas há 3 lacunas reais de cobertura que impedem um PASS limpo)

**Spec-anchored check**: 9/10 ACs com outcome exato batido · 1 NOT COVERED (contorno de KPI mentor, dentro do escopo documentado no Out of Scope da spec) · 1 spec-precision gap (PF3-02 AC3, segunda rota)
**Sensor**: 5/5 mutações killed
**Gate**: `test:unit` 1891 passed / 15 failed (pré-existentes, confirmados fora do escopo dos 8 arquivos tocados); lint (backend + frontend, arquivos tocados) 0 erros; build não executado

**What works**: Os 5 bugs do backup (`docs/pente-fino-backup-2026-09-23.json`) estão corrigidos com testes que provam o outcome exato do spec — não só "existe uma asserção": o href exato do link "Ver ficha" (PF3-01), o nome real da edição vs. null explícito (PF3-05), o papel `mentor` na query e o rótulo/placeholder corretos (PF3-03), o gráfico donut com `n` e percentuais reais + EstadoVazio preservado (PF3-02), e a confirmação por teste da ausência de "Etapa do produto" (PF3-04, sem código novo, como esperado). As 5 mutações do sensor (uma por commit) foram todas mortas pelos testes existentes, confirmando que a rede de segurança discrimina regressões reais nesses pontos.

**Issues found**:
1. PF3-03 — contorno documentado de `idsContrato` no KPI para PLL sem teste que prove o valor exato passado (Fix 1)
2. PF3-02 AC3 — segunda rota (`/contratos/[id]/diagnostico`) sem teste direto confirmando o gráfico (Fix 2)
3. Edge case "sem mentor com vínculo ativo" sem teste na tela de Fatos Geradores PLL (Fix 3)
4. Observação de processo (não é gap de teste): o commit `f461c69` (PF3-01) também trouxe `InfoComparacaoTse`/`onEditar`/`LegendaCamposPlanilhaPll`, fora do escopo dos 5 Goals desta spec — quebra a atomicidade "um commit por task" declarada, mesmo que cada peça tenha teste próprio

**Next steps**: Rotear os Fix 1-3 como tasks de correção antes de fechar o lote; nenhum dos 3 gaps bloqueia o valor de negócio entregue (os 5 bugs relatados estão corrigidos e discriminados por mutação); rodar `npm run build` antes de merge para `master` (não executado em nenhuma rodada de validação deste lote); registrar a observação de atomicidade do commit `f461c69` como lição de processo, não como bug de produto.
