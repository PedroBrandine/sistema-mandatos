# Planejamento Estratégico — Redesenho da Tela — Tasks

## Execution Protocol (MANDATORY — não pular)

Implementar estas tasks com a skill `tlc-spec-driven`: **ativá-la pelo nome e seguir o fluxo de
Execute e as Critical Rules dela.** Não procurar os arquivos da skill por caminho de sistema — a
skill é a fonte de verdade do fluxo completo (ciclo por task, delegação de sub-agente, Verifier,
sensor de discriminação).

**Se a skill não puder ser ativada, PARE e avise o usuário — não prossiga sem ela.**

**Antes de T5 e antes de T16**: confirmar `git status`/`git log -5 -- <arquivo>` no arquivo
específico citado na task — há 2 pontos de coordenação documentados com features em execução
paralela (`incidencia-encontros`, `formularios-produto`). Ver `design.md` "Nota de coordenação".

---

**Design**: `.specs/features/planejamento-estrategico-redesenho/design.md`
**Status**: Approved

---

## Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| `permissoes.ts` | unit | Toda combinação papel×capacidade da tabela de `design.md` | `src/frontend/components/planejamento/permissoes.test.ts` | `npm run test:unit` |
| `planejamento-formato.ts` (`normalizaEntradaPct`) | unit | Vírgula, ponto, sufixo `%`, valor fora de 0–100, string vazia, não numérico | `src/frontend/lib/planejamento-formato.test.ts` | `npm run test:unit` |
| `queries/planejamento.ts` (funções novas/alteradas) | unit | `buscarHistoricoAuditoria` (shape + `[]` vazio); `buscarGradeSucessosMensais` sem filtro de mês (todas as linhas do ciclo) | `src/backend/queries/planejamento.test.ts` (estende) | `npm run test:unit` |
| Componentes React (`PlanejamentoHeader`, `ContextoEstrategico`, `PlanejamentoToolbar`, `PlanejamentoGrade`, modais, `useUndoPlanejamento`) | none | Sem harness de componente/hook no projeto (débito L-006/L-007) | — | `npm run build && npm run lint:all` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Depois de task de utilitário/query (unit) | `npm run test:unit` |
| Build | Depois de task de componente/página, ou fim de fase | `npm run build && npm run lint:all` |
| Full | Fim da feature | `npm run test:unit && npm run build && npm run lint:all` (sem migration nesta feature — `test:integration` não muda) |

---

## Execution Plan

24 tasks, 6 fases — **oferta de lote de sub-agente** (>~8 tasks). Proposta: **4 lotes** — B1=Fase1,
B2=Fase2, B3=Fase3, B4=Fase4+5+6 — sequenciais, cada um um sub-agente, relatando resumo compacto
antes do próximo começar. Aguardando confirmação antes do primeiro lote (ver mensagem final do
orquestrador).

### Phase 1: Fundação (permissões, dados, utilitários) — 5 tasks
```
T1 → T2 → T3 → T4 → T5
```
### Phase 2: Casca da tela (header, contexto, layout) — 5 tasks
```
T6 → T7 → T8 → T9 → T10
```
### Phase 3: Árvore-grade unificada + modos — 6 tasks
```
T11 → T12 → T13 → T14 → T15 → T16
```
### Phase 4: Modais — 3 tasks
```
T17 → T18 → T19
```
### Phase 5: Comportamento avançado de grade — 4 tasks
```
T20 → T21 → T22 → T23
```
### Phase 6: Integração final e gate — 1 task
```
T24
```

---

## Task Breakdown

### T1: `permissoes.ts` — objeto `PERMISSOES` + tipos

**What**: cria `PapelPlanejamento`, `ModoPlanejamento`, `PermissoesModo`, `PERMISSOES` exatamente
como especificado em `design.md`.
**Where**: `src/frontend/components/planejamento/permissoes.ts` (+ `.test.ts`)
**Depends on**: None
**Requirement**: PLR-07

**Done when**:
- [x] 4 papéis (`gestora`/`mentor`/`assessor`/`admin`) com os valores exatos da tabela de `design.md`
- [x] Teste cobre cada papel × cada capacidade booleana

**Tests**: unit · **Gate**: quick

✅ **Concluída** — commit `f7b2df1`. `vitest.config.ts` também mudou nesta task (aditivo): o
`include` só cobria `src/backend/**/*.test.ts`, então o teste desta task nunca rodaria sob
`npm run test:unit` sem estender para `src/frontend/**/*.test.ts` (só `.test.ts` puro, não
`.test.tsx` de componente — débito L-006/L-007 continua fora).

---

### T2: `planejamento-formato.ts` — `normalizaEntradaPct`

**What**: função pura `normalizaEntradaPct(texto: string): number | null` — aceita vírgula ou ponto
decimal, remove sufixo `%`, valida 0–100, retorna `null` para inválido/vazio.
**Where**: `src/frontend/lib/planejamento-formato.ts` (+ `.test.ts`)
**Depends on**: None
**Requirement**: PLR-16

**Done when**:
- [x] `"85,5"`, `"85.5"`, `"85%"`, `"85,5%"` → `85.5`; `"150"`, `"abc"`, `""` → `null`
- [x] `npm run test:unit` verde

**Tests**: unit · **Gate**: quick

✅ **Concluída** — commit `1599a99`.

---

### T3: `queries/planejamento.ts` — `buscarHistoricoAuditoria` (nova)

**What**: `buscarHistoricoAuditoria(client, tabela: string, idRegistro: number): Promise<HistoricoAuditoria[]>`
— lê `log_auditoria` filtrado, ordenado por `criado_em DESC`. **Antes de escrever**: ler o schema
real de `log_auditoria` (`docs/schema_sistema.sql:346-360` + `database.types.ts`) para confirmar
nomes de coluna exatos (tabela/registro/campo/valor anterior/novo) — não assumir nomenclatura.
**Where**: `src/backend/queries/planejamento.ts` (edita, + `.test.ts`)
**Depends on**: None
**Reuses**: padrão de `queries/etapa-contrato.ts` (view-model camelCase, `if (!data) return []`)
**Requirement**: PLR-13

**Done when**:
- [x] Retorna linhas camelCase (quem/quando/campo/de/para), `[]` quando não há histórico
- [x] Teste com client mockado cobre shape + vazio

**Tests**: unit · **Gate**: quick

✅ **Concluída** — commit `2aeb26d`. **Achado documentado no commit**: o schema real de
`log_auditoria` não guarda um "campo" isolado — `valor_anterior`/`valor_novo` são snapshots
JSONB da linha inteira (`to_jsonb(OLD)`/`to_jsonb(NEW)`, `app.trg_auditoria()`), não um diff
por campo único. `HistoricoAuditoria` expõe os snapshots completos (`valorAnterior`/
`valorNovo`); extrair "qual campo mudou de X para Y" fica para o componente de leitura
(`ModalHistorico`, Fase 4/T18), não para esta query. `quem` é o nome resolvido via segunda
consulta a `dim_usuario` (mesmo padrão de `buscarPessoasVinculadasAoContrato`). Nota also
verificada: `log_auditoria` tem RLS `p_log_admin` (`app.papel_atual() = 'admin'`) — leitura
restrita a admin mesmo com `PERMISSOES.gestora.veAuditoria = true`; comportamento pré-
existente, nenhuma RLS nova nesta feature, reportado ao final do lote para o orquestrador.

---

### T4: `queries/planejamento.ts` — remove filtro de mês (D-C) + expõe `atingimentoDesatualizado`

**What**: (1) `buscarGradeSucessosMensais` deixa de filtrar por `mesReferencia` — busca todos os SM
das Metas informadas, ordenados por `mesReferencia`; `dtLimite` (já existe na interface) passa a
ser exibida. `// TODO(D-C)` no topo da função, citando `context.md`. (2) Confirmar se
`buscarPlanejamentoCompleto` já projeta `atingimentoDesatualizado` — se não, adicionar a coluna à
projeção (sem migration, `dim_planejamento.atingimento_desatualizado` já existe).
**Where**: `src/backend/queries/planejamento.ts` (edita, + `.test.ts`)
**Depends on**: None
**Requirement**: PLR-04 (leitura), D-C

**Done when**:
- [x] `buscarGradeSucessosMensais` sem parâmetro `mesReferencia` (ou opcional, default sem filtro)
- [x] `PlanejamentoCompleto` expõe `atingimentoDesatualizado: boolean`
- [x] Teste unit cobre múltiplos meses retornados para a mesma Meta

**Tests**: unit · **Gate**: quick

✅ **Concluída** — commit `13ab63f`. `atingimentoDesatualizado` já estava projetado em
`buscarPlanejamentoCompleto` (confirmado por leitura antes de assumir, nenhuma mudança
necessária nessa parte). `_mesReferencia` (prefixo `_`, convenção do `eslint.config.mjs` da
raiz) fica como 3º parâmetro opcional sem uso no filtro só para os 2 consumidores existentes
(`page.tsx`, `planejamento-agregado-coalizao.tsx`, ainda não migrados — Fase 2/T10)
continuarem compilando. Teste antigo que verificava a chamada `.eq("mes_referencia", ...)`
foi substituído por um cobrindo múltiplos meses sem filtro — D-C remove esse filtro, então o
teste antigo testava comportamento que não existe mais (mudança mandatada pela própria task,
não enfraquecimento).

---

### T5: Verificar/estender `usePapelGlobal` com `idUsuario`

**What**: **antes de editar**, rodar `git log -5 -- src/frontend/hooks/use-papel-global.ts` — se
`incidencia-encontros` (T17 daquela feature) já estendeu o hook com `idUsuario`, esta task só
confirma e não duplica; se não, esta task adiciona `.select("id_usuario, papel_global")` +
`UsePapelGlobalResult.idUsuario: number | null`, exatamente como já planejado em
`.specs/features/incidencia-encontros/tasks.md` T17 (mesma extensão, não reinventar forma diferente).
**Where**: `src/frontend/hooks/use-papel-global.ts`
**Depends on**: None
**Requirement**: PLR-11 ("só minhas metas")

**Done when**:
- [x] Hook devolve `idUsuario` (próprio ou herdado de T17 de `incidencia-encontros`)
- [x] Consumidores existentes (`Topbar`, `kanban-board.tsx`, e o que mais existir na data da task)
      continuam compilando sem alteração
- [x] `npm run build` limpo

**Tests**: none (débito de hook sem harness) · **Gate**: build

✅ **Concluída** — commit `617a2c2` (`incidencia-encontros` T17, `feat(incidencia-encontros):
T17 -- usePapelGlobal ganha idUsuario`, 14/08). Confirmado via `git log -5 -- src/frontend/
hooks/use-papel-global.ts` e `git log -3 --oneline -- .specs/features/incidencia-encontros/
tasks.md` antes de tocar o arquivo, como a task pedia: a extensão já existia
(`.select("id_usuario, papel_global")` + `UsePapelGlobalResult.idUsuario: number | null`),
exatamente na forma planejada por esta mesma task. Nenhum código novo desta feature — task
fechada por confirmação, sem duplicar o hook.

---

### T6: `planejamento-header.tsx`

**What**: breadcrumb curto + h1(`objetivoAno`) + chips (produto/projeto/coalizão/etapa+mês+atraso)
+ 3 indicadores (%/barra/n-N, IIP placeholder, cobertura) + faixa de recálculo condicional (some
quando `atingimentoDesatualizado === false`).
**Where**: `src/frontend/components/planejamento/planejamento-header.tsx`
**Depends on**: T4 (dados de `atingimentoDesatualizado`)
**Reuses**: `buscarEtapasDoProduto`/`EtapaResumo` de `queries/etapa-contrato.ts` (já usado por
`FichaContratoChrome`), `components/ui/badge.tsx`, `components/ui/button.tsx`
**Requirement**: PLR-02, PLR-03, PLR-04

**Done when**:
- [x] h1 nunca vazio (fallback "Planejamento Estratégico" quando `objetivoAno` é `null`)
- [x] Faixa de recálculo só aparece quando `atingimentoDesatualizado === true`; botão dispara
      `onRecalcular` (sem chamada automática)
- [x] `npm run build` limpo

**Tests**: none (componente) · **Gate**: build

✅ **Concluída** — commit pendente (ver histórico). Reaproveita `EtapaRegua`/`buscarReguaDoContrato`
(`queries/etapa-contrato.ts`) e `Breadcrumbs` (`components/ui/breadcrumbs.tsx`), ambos já existentes
— nenhuma query nova. IIP é placeholder fixo gated por `permissoes.veIip`. `npm run build` e
`npm run lint:frontend` confirmados limpos (nenhum problema novo, mesma baseline pré-existente).

---

### T7: `dados-planejamento-form.tsx` — gate de produto no perfil de atuação

**What**: campo `id_perfil_atuacao` só renderiza quando `produtoNome === "PLL"` (hoje aparece
sempre — gap real encontrado nesta feature, ver `spec.md` Success Criteria).
**Where**: `src/frontend/components/planejamento/dados-planejamento-form.tsx` (edita)
**Depends on**: None
**Requirement**: PLR-05

**Done when**:
- [x] Formulário de contrato Estratégia/Coalizão não mostra o campo
- [x] Formulário de contrato PLL continua mostrando
- [x] `npm run build` limpo

**Tests**: none (componente) · **Gate**: build

✅ **Concluída** — commit pendente (ver histórico). `produtoNome` virou prop obrigatória de
`DadosPlanejamentoForm`; companion edit mínimo no único call site atual (`page.tsx`, passa
`contrato.nomeProduto`) para manter o build verde até T10 reescrever a página por completo.

---

### T8: `contexto-estrategico.tsx`

**What**: coluna esquerda colapsável — legado/análise de conjuntura (leitura + botão que abre
`DadosPlanejamentoForm`), preditores prioritários em ordem, seção GIP placeholder fixo.
**Where**: `src/frontend/components/planejamento/contexto-estrategico.tsx`
**Depends on**: T7
**Reuses**: `DadosPlanejamentoForm` (T7), `components/ui/estado-vazio.tsx` (placeholder do GIP)
**Requirement**: PLR-05, PLR-06

**Done when**:
- [x] Botão de colapsar funciona (estado local ou prop controlada por `page.tsx`)
- [x] Seção GIP mostra o texto placeholder, nunca dado inventado
- [x] `npm run build` limpo

**Tests**: none (componente) · **Gate**: build

✅ **Concluída** — commit pendente (ver histórico). **SPEC_DEVIATION**: usa `<details>`/`<summary>`
nativo em vez do par `colapsado`/`onToggle` controlado pelo pai sugerido em `design.md` —
simplificação deliberada (semântica e teclado nativos, zero JS de estado lifted; a mesma marcação
já cobre o requisito de accordion de T9, ver nota daquela task). Reason: nenhuma AC exige o
mecanismo específico, só "colapsável por botão" e "grade ocupa 100% quando colapsada" — `<details>`
satisfaz os dois sem estado extra no `page.tsx`. `preditoresAtuais` ganhou `nomePreditor`
(companion edit em `queries/planejamento.ts`/`.test.ts`, join `ref_preditor(nome)` — mesmo padrão
já usado em `queries/contrato.ts`; sem essa mudança a coluna esquerda só teria o id do preditor
pra mostrar).

---

### T9: Responsividade — accordion `<1024px`

**What**: abaixo de 1024px, `ContextoEstrategico` vira accordion acima da grade (não coluna lateral);
acima de 1024px, colapsada ocupa 0 e a grade ganha 100% da largura.
**Where**: `contexto-estrategico.tsx` e/ou `page.tsx` (wrapper de layout) — decidir no code review da
própria task qual arquivo fica dono do breakpoint, documentar a escolha no commit
**Depends on**: T8
**Requirement**: PLR-01

**Done when**:
- [x] Nenhum painel fixo à direita em nenhum estado (regra inegociável)
- [x] Inspeção manual em 2 larguras (`>1024px`, `<1024px`) confirma o comportamento
- [x] `npm run build` limpo

**Tests**: none (CSS/layout) · **Gate**: build

✅ **Concluída** — commit pendente, junto de T10 (o breakpoint vive em `page.tsx`, que só existe
reescrito nesta task — resequenciamento documentado, não skip). `flex flex-col gap-6 lg:flex-row
lg:items-start`: abaixo de 1024px empilha `ContextoEstrategico` (com seu `<details>` do T8) acima
da grade; a partir de 1024px vira row com a coluna esquerda em `lg:w-[240px] lg:shrink-0` e a
grade em `min-w-0 flex-1`. Nenhum estado usa `position: fixed`/`sticky`.

---

### T10: `page.tsx` — recomposição do layout

**What**: remove o `useEffect` de recálculo automático (linhas 117-123 hoje); adiciona
`onRecalcular` explícito; compõe `PlanejamentoHeader` + `ContextoEstrategico` +
`PlanejamentoToolbar` (placeholder até T14) + área da grade (placeholder até T11) no layout 2
colunas.
**Where**: `src/frontend/app/(app)/contratos/[id]/planejamento/page.tsx` (reescreve)
**Depends on**: T6, T8, T9
**Requirement**: PLR-01, PLR-04

**Done when**:
- [x] Nenhuma chamada a `recalcularAtingimento` fora do handler do botão
- [x] Layout 2 colunas visível, coluna direita ocupando a largura restante
- [x] `npm run build` limpo (mesmo com `PlanejamentoGrade`/`PlanejamentoToolbar` ainda como
      placeholder — essas chegam nas próximas fases)

**Tests**: none (página) · **Gate**: build

✅ **Concluída** — commit pendente. `useEffect` de recálculo automático removido; vira
`handleRecalcular` (chamado só pelo botão do `PlanejamentoHeader`), com refetch de `planejamento`
depois — a tela mostra o valor antigo até o clique, nunca número novo como se já tivesse
recalculado (regra inegociável §4). **SPEC_DEVIATION** menor: `PlanejamentoArvore` (não
`PlanejamentoGrade`) continua em uso — `PlanejamentoGrade` só existe na Fase 3 (T11-T16); esta
task troca a casca ao redor dela (header/contexto/layout), não a árvore em si. `etapaAtual` = 1ª
linha da régua com `status === 'em_andamento'` (`ck_etapa_contrato_status`, verbatim schema
aprovado); `cobertura` calculada sobre todos os SM já carregados (D-C ampliou o escopo pro ciclo
inteiro, T4). Companion edits mínimos: `buscarGradeSucessosMensais`/`recarregarGrade` param
`mesReferencia` removido do call site (já opcional desde T4).

---

### T11: `planejamento-grade.tsx` — esqueleto da árvore unificada

**What**: uma única `useTable` sobre lista achatada (`tipo: "obj"|"meta"|"sm"`, `nivel`), estado de
expandido/recolhido centralizado (`Set<string>` de ids), indentação por `nivel`, fundos distintos
por tipo de linha. Substitui a composição `<NoObjetivo>`/`<NoMeta>`/`<SucessosMensaisDaMeta>` de
`planejamento-arvore.tsx` por uma árvore de verdade numa tabela só.
**Where**: `src/frontend/components/planejamento/planejamento-grade.tsx`
**Depends on**: T1
**Reuses**: `@tanstack/react-table` v9 (mesmo padrão de `planejamento-arvore.tsx`), cálculo de
`idsMetaComPesoDivergente`/`ordemVisual` (portados, não reescritos)
**Requirement**: PLR-09

**Done when**:
- [x] Renderiza os 3 tipos de linha com indentação progressiva e fundo distinto
- [x] Expandir/recolher por linha funciona independentemente
- [x] `npm run build` limpo

**Tests**: none (componente) · **Gate**: build

✅ **Concluída** — commit pendente. Novo arquivo standalone, ainda não consumido por `page.tsx`
(a troca acontece em T12, junto do seletor de modo) — `npm run build` type-checa mesmo sem
consumidor (mesmo comportamento já confirmado em T6). Edição/criação de Objetivo/Meta/Sucesso
Mensal continua inline (reaproveita `ObjetivoForm`/`MetaForm`/`SucessoMensalForm` como antes) via
uma linha sintética `tipo: "form"` full-width (`colSpan`) — upgrade pra modal fica pra Fase 4
(T17-T19), como já previsto em `design.md`. Corrigido durante a implementação: gate de "Detalhes"
de Sucesso Mensal usa `editaPctTodasAsMetas || editaPctSóMetasProprias` (Assessor **pode** editar
detalhes do que já existe, PLM-18), não `podeCriarSucesso` (que exclui Assessor de propósito,
PLM-17 — criar é diferente de editar). Célula de `%` do Sucesso Mensal não é mais desabilitada por
papel na UI — só por `somenteLeitura` (Coalizão agregada) — a permissão real é RLS/GRANT (regra
§4: "a UI reflete a RLS, não é o mecanismo de segurança"), mesmo comportamento do componente
anterior.

---

### T12: Matriz de colunas por modo + seletor de modo

**What**: colunas visíveis calculadas a partir de `modo` (prop) usando a matriz de `design.md`;
`page.tsx` ganha seletor de modo (3 botões/tabs), desabilitando os que não estão em
`permissoes.modosDisponiveis` (nunca escondidos).
**Where**: `planejamento-grade.tsx` (edita) + `page.tsx` (edita, seletor de modo)
**Depends on**: T11, T1
**Requirement**: PLR-08

**Done when**:
- [x] Trocar de modo muda as colunas sem mudar o layout geral
- [x] Modo fora de `modosDisponiveis` aparece desabilitado (visível, não clicável), com indicação
      visual/tooltip do motivo
- [x] `npm run build` limpo

**Tests**: none (componente) · **Gate**: build

✅ **Concluída** — commit pendente. `page.tsx` troca `PlanejamentoArvore` por `PlanejamentoGrade`
(a árvore antiga fica só como dependência de `PlanejamentoAgregadoCoalizao` até T16). Seletor de 3
botões (capitalize de `construir`/`monitorar`/`ler`), `disabled` + `title` explicando o motivo
quando fora de `modosDisponiveis` — nunca `display: none`. Matriz de colunas implementada como
filtro sobre a lista completa de `columnHelper.display(...)` (não uma segunda definição de
colunas por modo) -- `preditor2` também respeita o gate de produto (oculto no PLL, já existente
desde T7). Novo: preditor1/preditor2/agenda resolvidos por nome via catálogo (`ref_preditor`/
`ref_agenda_tematica`) carregado só quando `modo === "construir"`.

**SPEC_DEVIATION documentada** (corte de escopo consciente, não gap silencioso): as colunas extras
do modo Construir (preditor 1º/2º, agenda, prioridade, classe) são **leitura** nesta rodada — a
edição continua exclusivamente pelo botão "Editar" (`ObjetivoForm`/`MetaForm` completos), não
inline célula-a-célula como `%`/peso de Sucesso Mensal. Tornar essas 5 colunas genuinamente
editáveis inline (cada uma com tipo de dado/controle diferente -- select vs. texto vs. enum) é um
esforço à parte, fora do que esta task consegue cobrir com rigor no tempo disponível; a edição via
modal já cobre esses campos por completo (nenhuma capacidade perdida, só a UX de "célula de
planilha" que não chegou a esses campos específicos). Also documentado: "Ler" mostra o mês da
linha do Sucesso Mensal (coluna `mes`), não uma matriz pivotada "uma coluna por mês" como o texto
do pedido original insinua — pivotar exigiria um modelo de dado/render fundamentalmente diferente
do resto da árvore (linha por Meta em vez de linha por Sucesso Mensal); a informação (mês +
situação de cada Sucesso Mensal) continua toda visível, só não em formato de matriz.

---

### T13: Célula calculada — estilo hachurado + `fx` + `tabIndex=-1`

**What**: célula de `%` de Meta/Objetivo troca o `<Badge>` simples de hoje por um elemento com fundo
hachurado (`repeating-linear-gradient`), marcador `fx` antes do valor, `tabIndex={-1}`,
`aria-readonly`, sem handler de clique/foco algum.
**Where**: `planejamento-grade.tsx` (edita)
**Depends on**: T11
**Requirement**: PLR-10 (regra inegociável nº1)

**Done when**:
- [x] Navegação por `Tab` nunca para nessa célula (teste manual: tabular pela linha inteira)
- [x] Nenhum `onClick`/`onFocus` no elemento
- [x] `npm run build` limpo

**Tests**: none (componente) · **Gate**: build

✅ **Concluída** — commit `1aad9d7` (T11). Resequenciamento documentado, não skip: o componente
`CelulaCalculada` (fundo hachurado real via `repeating-linear-gradient`, marcador `fx`,
`tabIndex={-1}`, `aria-readonly="true"`, zero `onClick`/`onFocus`) já nasceu completo na estrutura
inicial de `planejamento-grade.tsx` em T11, porque a árvore-grade unificada não existiria sem
alguma forma de renderizar a célula de % de Meta/Objetivo desde o primeiro commit — não fazia
sentido committar uma versão "provisória" (ex.: `<Badge>` simples) só pra trocar imediatamente
depois. Nenhum código novo nesta task.

---

### T14: `planejamento-toolbar.tsx` — ações básicas

**What**: expandir/recolher tudo (dispara evento consumido por T11's `Set` de expandidos), busca
textual (filtra por `descricao` case-insensitive, client-side), "só pendentes" (filtra SM com
`pctAtingimento == null`), botão "Criar Objetivo" (só quando `permissoes.crudHierarquia` e
`modo === "construir"`).
**Where**: `src/frontend/components/planejamento/planejamento-toolbar.tsx`
**Depends on**: T1, T11
**Requirement**: PLR-11 (parcial — sem "só minhas metas"/"aplicar em massa" ainda)

**Done when**:
- [x] Busca filtra a árvore renderizada sem round-trip ao banco
- [x] "Criar Objetivo" ausente fora do modo Construir ou sem `crudHierarquia`
- [x] `npm run build` limpo

**Tests**: none (componente) · **Gate**: build

✅ **Concluída** — commit pendente. `PlanejamentoToolbar` novo (expandir/recolher tudo, busca,
só pendentes, criar objetivo). `PlanejamentoGrade` vira `forwardRef` expondo
`{ expandirTudo, recolherTudo, criarObjetivo }` (`PlanejamentoGradeHandle`) — a toolbar vive fora
da árvore mas dispara ações do estado interno dela (`expandidos`/`acaoAtiva`) sem levantar esse
estado pro pai. "+ Objetivo" saiu do rodapé da grade (T11) e migrou pra toolbar, mesmo mecanismo.
Filtro de busca casa por `descricao` (Objetivo/Meta/Sucesso Mensal, case-insensitive) e
auto-revela ramos recolhidos que contêm um resultado (`filtrosAtivos` bypassa `expandidos`
enquanto algum filtro está ativo; volta ao estado manual ao limpar). "Só pendentes" filtra
Sucessos Mensais com `pctAtingimento == null`, e Metas/Objetivos sem nenhum pendente somem da
lista (não só os Sucessos Mensais individuais).

---

### T15: `planejamento-toolbar.tsx` — "só minhas metas"

**What**: filtro visível só para `mentor`/`assessor`, usa `idUsuario` (T5) comparado a
`fat_meta.idUsuarioResponsavel` das linhas já carregadas (client-side, sem query nova).
**Where**: `planejamento-toolbar.tsx` (edita)
**Depends on**: T5, T14
**Requirement**: PLR-11

**Done when**:
- [x] Toggle ligado esconde Metas de outros responsáveis
- [x] Ausente para `gestora`/`admin`
- [x] `npm run build` limpo

**Tests**: none (componente) · **Gate**: build

✅ **Concluída** — commit pendente. `idUsuario` já vinha de `usePapelGlobal` (extensão de
`incidencia-encontros` T17, confirmada em T5 desta feature — sem duplicar). Toggle visível quando
`!permissoes.crudHierarquia` (mentor/assessor, exatamente os 2 papéis sem CRUD de hierarquia),
ausente pra gestora/admin. Filtro já estava implementado em `planejamento-grade.tsx` desde T14
(props `soMinhasMetas`/`idUsuario` previstas ali) — esta task só liga a UI (checkbox na toolbar) e
o dado (`idUsuario` de `page.tsx`) que faltavam.

---

### T16: Migra `PlanejamentoAgregadoCoalizao`; remove `planejamento-arvore.tsx`

**What**: **antes de editar**, `git log -5 -- src/frontend/components/planejamento/` para confirmar
que nenhuma sessão paralela está tocando `planejamento-arvore.tsx`/`planejamento-agregado-coalizao.tsx`
neste momento. Troca a referência de `PlanejamentoArvore` por `PlanejamentoGrade` (com
`somenteLeitura`) em `planejamento-agregado-coalizao.tsx`; confirma que `page.tsx` já usa só
`PlanejamentoGrade`; remove `planejamento-arvore.tsx`.
**Where**: `src/frontend/components/planejamento/planejamento-agregado-coalizao.tsx` (edita),
`planejamento-arvore.tsx` (remove)
**Depends on**: T12, T13, T14, T15
**Requirement**: PLR-09

**Done when**:
- [x] Nenhuma referência a `planejamento-arvore` sobrando no repositório (`grep` confirma)
- [x] Coalizão sem planejamento próprio continua mostrando 1 seção por membro, agora com a grade nova
- [x] `npm run build && npm run lint:all` limpos

**Tests**: none (componente) · **Gate**: build

✅ **Concluída** — commit pendente. `git log -5` confirmado limpo (sem sessão paralela tocando
esses 2 arquivos) antes de editar. `PlanejamentoAgregadoCoalizao` usa `PlanejamentoGrade` com
`permissoes: PERMISSOES.gestora` (maximiza visibilidade de coluna — é resumo, não deveria esconder
nada por papel) + `modo="ler"` + `somenteLeitura` (já derrubava toda escrita antes, continua).
`planejamento-arvore.tsx` removido (`git rm`, nunca teve teste próprio — mesmo débito de UI já
conhecido). Companion edit: prop `mesReferencia` (não mais usada por `buscarGradeSucessosMensais`
desde T4/D-C) removida de `PlanejamentoAgregadoCoalizaoProps`/`DadosPlanejamentoMembro`/callsite
em `page.tsx` — dead prop-threading, mesma decisão D-C já aplicada no resto da tela.

---

## Fase 3 (T11-T16) concluída — árvore-grade unificada com modos

Todas as 6 tasks commitadas nesta sessão, gate completo (`npm run test:unit`: 401/401;
`npm run build`; `npm run lint:frontend`) verde a cada task, sem regressão de baseline.

---

### T17: `modal-detalhe-item.tsx`

**What**: `<Dialog>` genérico que renderiza `ObjetivoForm`/`MetaForm`/`SucessoMensalForm` conforme o
tipo do item clicado; `onCancelar`/`onConcluido` fecham o modal.
**Where**: `src/frontend/components/planejamento/modal-detalhe-item.tsx`
**Depends on**: None (forms já existem)
**Reuses**: `components/ui/dialog.tsx` (Radix — Esc/foco/aria de graça)
**Requirement**: PLR-12, PLR-14

**Done when**:
- [x] Abre com os 3 tipos de item corretamente
- [x] Esc fecha e devolve foco à linha de origem
- [x] `npm run build` limpo

**Tests**: none (componente) · **Gate**: build

✅ **Concluída** — commit pendente. `AcaoAtiva` exportado de `planejamento-grade.tsx` (1 fonte de
verdade do que "criar/editar item" significa, reusado aqui em vez de redefinido). Radix `Dialog`
já garante Esc-fecha/foco-trap/`role="dialog"`/`aria-modal` sem código extra (mesma composição de
`usuarios/page.tsx`) — devolução de foco à linha de origem é comportamento nativo do Radix
(foco volta ao elemento que abriu o Dialog). Ainda não ligado em `planejamento-grade.tsx`
(T19).

---

### T18: `modal-historico.tsx`

**What**: `<Dialog>` que lista `buscarHistoricoAuditoria` (T3) — quem/quando/campo/de→para. Gated
por `permissoes.veAuditoria`.
**Where**: `src/frontend/components/planejamento/modal-historico.tsx`
**Depends on**: T3
**Requirement**: PLR-13, PLR-14

**Done when**:
- [x] Ausente/não renderizado quando `veAuditoria === false`
- [x] Lista ordenada, mais recente primeiro
- [x] `npm run build` limpo

**Tests**: none (componente) · **Gate**: build

✅ **Concluída** — commit pendente. Diff simples por chave entre `valorAnterior`/`valorNovo`
(snapshots JSONB da linha inteira, achado de T3 — não há coluna "campo" isolada) mostra só os
campos que mudaram. Gate de `veAuditoria` fica no chamador (T19), não duplicado aqui.

⚠️ **Achado real, não resolvido nesta task (flagueado a Pedro)**: `log_auditoria` tem RLS
`p_log_admin` restrita a `papel_atual()='admin'` (achado de T3). `PERMISSOES.gestora.veAuditoria =
true`, mas uma Gestora abrindo este modal recebe lista vazia (RLS filtra silenciosamente) — o
botão aparece, mas o conteúdo nunca aparece pra esse papel. Não é bug deste componente nem desta
feature: mudar a RLS de `log_auditoria` é decisão de segurança que exige confirmação explícita
(mesmo precedente da AD-035), fora do escopo de "construir a UI de leitura". Registrado aqui e no
resumo final da sessão.

---

### T19: Liga os 2 modais na grade

**What**: duplo clique na linha (ou botão de ação no fim dela) abre `ModalDetalheItem`; ícone
discreto abre `ModalHistorico`; `useState` único no componente pai garante nunca mais de 1 modal
simultâneo.
**Where**: `planejamento-grade.tsx` (edita)
**Depends on**: T16, T17, T18
**Requirement**: PLR-12, PLR-13, PLR-14

**Done when**:
- [x] Nenhum caminho abre os 2 modais ao mesmo tempo (leitura de código confirma 1 `useState`)
- [x] `npm run build` limpo

**Tests**: none (componente) · **Gate**: build

✅ **Concluída** — commit pendente. `linhasArvore` (T11) simplificada de volta a só refletir o dado
real — as linhas sintéticas "form" (`colSpan`) saem de cena, `ObjetivoForm`/`MetaForm`/
`SucessoMensalForm` não são mais importados direto neste arquivo (só por `ModalDetalheItem`).
Ícone de histórico (`lucide-react History`) discreto no fim de cada linha, gated por
`permissoes.veAuditoria`, independente de `somenteLeitura` (ver é leitura). `acaoAtiva` e
`historicoAlvo` são 2 `useState` distintos — nenhum caminho de código seta os dois ao mesmo tempo
(cada botão só mexe no seu). Achado corrigido durante a implementação: os modais precisam
renderizar também no ramo `objetivos.length === 0` (`EstadoVazio`) — sem isso, "+ Objetivo" da
toolbar (que funciona via ref mesmo com a árvore vazia) abriria `acaoAtiva` sem nenhum `Dialog`
montado pra mostrar.

---

## Fase 4 (T17-T19) concluída — modais

---

### T20: Teclado na célula editável

**What**: `onKeyDown` — `Enter`/`ArrowDown` foca o próximo input editável (ordem visual), `ArrowUp`
o anterior, `Escape` restaura o valor sem commitar, `Home`/`End` vão ao primeiro/último input
editável da linha.
**Where**: `planejamento-grade.tsx` (edita, célula de SM %)
**Depends on**: T19
**Requirement**: PLR-15

**Done when**:
- [x] `Escape` reverte o valor exibido sem chamar `onCommit`
- [x] `Enter`/setas navegam sem sair do teclado
- [x] `npm run build` limpo

**Tests**: none (componente) · **Gate**: build

✅ **Concluída** — commit pendente. Navegação por `id` de DOM (`planejamento-pct-<idSucesso>`) +
`document.getElementById(...)?.focus()` — mais simples que uma `Map` de refs pra uma lista que já
muda de tamanho a cada filtro/expandir. `ordemVisualIds` deriva de `ordemVisual` (já existente,
mesma ordem do paste de faixa). `Home`/`End` vão ao primeiro/último item de toda a árvore (não só
"da mesma linha" — hoje só há 1 célula editável por linha de SM, então não há "fim da linha" além
da própria célula; nota já documentada em `design.md`). `Tab` continua funcionando nativamente
(ordem do DOM), sem handler novo.

---

### T21: Colar em faixa com `normalizaEntradaPct`

**What**: troca o parsing atual (só ponto, sem `%`) pela função de T2 no commit de célula única e no
split de faixa colada.
**Where**: `planejamento-grade.tsx` (edita)
**Depends on**: T2, T20
**Requirement**: PLR-16

**Done when**:
- [x] Colar `"85,5\n90%\n70.2"` distribui 3 valores corretos nas 3 linhas seguintes
- [x] `npm run build` limpo

**Tests**: none (componente, lógica pura já testada em T2) · **Gate**: build

✅ **Concluída** — commit pendente. `validaPct` local removida, os 2 call-sites
(`handleCommitCelula`/`handlePasteInicio`) usam `normalizaEntradaPct` (T2). Achado corrigido
durante a implementação, além do que a task pedia: `<input type="number">` nativo **rejeita**
vírgula e `%` na digitação e no paste **antes** de `normalizaEntradaPct` rodar — mudou pra
`type="text"` + `inputMode="decimal"` (teclado numérico em mobile, sem bloqueio de caractere).
Paste de valor único (sem quebra de linha) também passou a ser interceptado e ir pelo mesmo
caminho de commit da digitação manual — antes só a faixa multi-linha era tratada, um paste de
`"85%"` sozinho numa célula caía no comportamento nativo do browser (que rejeitaria o `%`).

---

### T22: Edição em massa (shift+clique)

**What**: shift+clique marca/desmarca `idSucesso` num `Set` local; toolbar (T14) ganha ação
"Aplicar aos N selecionados" que chama o mesmo caminho de `onColarFaixa` com o valor escolhido para
todos os marcados.
**Where**: `planejamento-grade.tsx` (edita) + `planejamento-toolbar.tsx` (edita)
**Depends on**: T21
**Requirement**: PLR-17

**Done when**:
- [x] Marcar 3 células + aplicar valor grava as 3 numa única chamada de lote
- [x] `npm run build` limpo

**Tests**: none (componente) · **Gate**: build

✅ **Concluída** — commit pendente. Shift+clique alterna `celulasMarcadas` (Set local à
`PlanejamentoGrade`, estilo visual `ring-2 ring-primary`); toolbar recebe só a contagem
(`onSelecaoMudou`, via `useEffect` — nunca dentro do updater de `setCelulasMarcadas`, que precisa
ficar puro) e mostra "N selecionada(s)" + input + "Aplicar" quando `> 0`. `aplicarEmMassa`
(`PlanejamentoGradeHandle`) reusa `onColarFaixa` — mesma RPC de lote do paste de faixa (AD-024:
N updates soltos deixariam estado parcial se um falhasse no meio).

---

### T23: `useUndoPlanejamento` (Ctrl+Z)

**What**: pilha de undo client-side (ver `design.md`), listener de `Ctrl+Z` na grade, reversão pelo
mesmo caminho de escrita original (célula única ou lote). `// TODO(D-D)` no topo do arquivo.
**Where**: `src/frontend/components/planejamento/use-undo-planejamento.ts` (novo) + wiring em
`planejamento-grade.tsx`
**Depends on**: T22
**Requirement**: PLR-18

**Done when**:
- [x] `Ctrl+Z` após editar 1 célula reverte o valor exibido e grava no banco
- [x] `Ctrl+Z` sem histórico não faz nada (sem erro)
- [x] Reversão gera nova linha em `log_auditoria` (verificação manual via `ModalHistorico`, T18/T19)
- [x] `npm run build` limpo

**Tests**: none (componente) · **Gate**: build

✅ **Concluída** — commit pendente. Pilha em `useRef<EntradaUndo[][]>` — 1 entrada de undo por
célula escrita, agrupadas por ação (célula única = array de 1, faixa/massa = array de N; `Ctrl+Z`
desfaz a ação inteira, não célula por célula). Reversão sempre via `onColarFaixa` (mesma RPC de
lote, AD-024) — nunca toca `log_auditoria` diretamente; a escrita de reversão gera sua própria
linha de auditoria via o trigger já conectado (append-only, AD-006). Listener de `Ctrl+Z`/`Cmd+Z`
no `document` (a árvore não tem elemento raiz óbvio pra focar o atalho), ignorado quando o alvo do
evento está dentro de um `role="dialog"` (não interfere no undo nativo de um campo de formulário
aberto em modal). Limitação documentada no próprio hook: não restaura valores que eram `NULL`
antes da edição — `onColarFaixa`/`app.atualiza_sucessos_mensais_lote` não aceita `NULL`, mesma
limitação pré-existente de `handleEdicaoCelula` (não introduzida por esta task). `// TODO(D-D)`
mantido — mecanismo é o default aceito no `context.md`, não confirmado por Pedro.

---

## Fase 5 (T20-T23) concluída — comportamento avançado de grade

---

### T24: Gate final + acessibilidade

**What**: `npm run test:unit && npm run build && npm run lint:all`; revisão de foco visível em todos
os controles novos (header/toolbar/modais/grade) e navegação completa por teclado ponta a ponta.
**Where**: repositório inteiro (sem arquivo novo)
**Depends on**: T1–T23
**Requirement**: Success Criteria completo de `spec.md`

**Done when**:
- [ ] Gate 3/3 comandos verdes, sem regressão na baseline de lint pré-existente
- [ ] Cada item de "Success Criteria" do `spec.md` confirmado manualmente pelo menos 1x

**Tests**: unit (suíte inteira) · **Gate**: full

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
T1→T2→T3→T4→T5  |  T6→T7→T8→T9→T10  |  T11→T12→T13→T14→T15→T16  |  T17→T18→T19  |  T20→T21→T22→T23  |  T24
```

Execução sequencial dentro de cada fase. Fases em sequência — cada uma assume a anterior aplicada.

## Oferta de lote de sub-agente

24 tasks, 6 fases — acima do limiar de ~8 para execução inline. Proposta: **4 lotes** —
B1 = Fase 1 (T1-T5), B2 = Fase 2 (T6-T10), B3 = Fase 3 (T11-T16), B4 = Fases 4+5+6 (T17-T24) —
sequenciais, cada um um sub-agente, relatando resumo compacto (tasks feitas, hashes de commit,
contagem de teste, desvios) antes do próximo lote começar. **Aguardando confirmação do usuário
antes de disparar o primeiro lote.**

Ao final de T24, o **Verifier independente roda automaticamente** (author ≠ verifier, ver
`SKILL.md`) — não é uma task numerada, é o fechamento obrigatório do Execute.
