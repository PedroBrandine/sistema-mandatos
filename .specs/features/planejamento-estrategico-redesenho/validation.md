# Planejamento Estratégico — Redesenho da Tela Validation

## Ciclo 2/3 (2026-08-14) — reverificação direcionada dos 3 gaps do Ciclo 1

**Verifier**: independente (author ≠ verifier) — sessão fresca nova, sem herdar o modelo mental do
autor dos fixes T25-T27.
**Diff range desta rodada**: `43928c3^..d781b53` (`43928c3` T25, `7099e79` docs do relatório do
ciclo 1, `3d740a4` T26+T27, `d781b53` docs de tasks.md) — âncora por hash explícito (instrução do
orquestrador), não "desde o último commit da branch", porque `develop` tem sessões paralelas
(`incidencia-encontros`) commitando concorrentemente. Código tocado nesta fase, confirmado por
`git diff --stat 9a2d997..3d740a4`: só `src/frontend/app/(app)/contratos/[id]/planejamento/page.tsx`
(+45/-19) e `src/frontend/components/planejamento/planejamento-grade.tsx` (+242/-76). Nenhum outro
arquivo de código nesta fase (os demais arquivos do diff — `incidencia-encontros/validation.md`,
`fn-criar-insight.integration.test.ts` — pertencem a `9644936`/`5b0d807`, commits intercalados de
sessão paralela, fora do range âncora).

Escopo desta rodada: só os 3 gaps ranqueados no Ciclo 1 + regressão nos arquivos tocados — as 19
PLR-NN já ✅ Verified no Ciclo 1 não foram reauditadas (não foram tocadas por T25-T27, exceto onde
os 3 gaps abaixo se sobrepõem a PLR-19/16).

### Gap #1 (PLR-19) — salvamento otimista + indicador de "salvando" + reversão em erro — ✅ CORRIGIDO

**Indicador visual real (não só comentário)**: `CelulaPct` recebe `salvando: boolean`
(`planejamento-grade.tsx:153`) e renderiza um `<Loader2 className="... animate-spin" />` sobreposto
ao input (`planejamento-grade.tsx:242-247`) sempre que `salvando === true`; o próprio `<input>` fica
`disabled={somenteLeitura || salvando}` e `aria-busy={salvando}` (`:191-192`), com opacidade reduzida
(`salvando && "opacity-60"`, `:198`). `salvando` é lido de `celulasSalvando.has(item.linha.idSucesso)`
no cell renderer da coluna `pct` (`:792`) — não é um placeholder estático, reflete o `Set` de estado.

**Reversão de fato em erro** (rastreado o caminho completo): `escreverCelulas(ids,
valoresAnteriores, acao)` (`planejamento-grade.tsx:339-359`) marca `celulasSalvando` antes do
`await acao()`; no `catch`, reescreve `valoresAnteriores.get(id)` diretamente no DOM de cada
`<input>` via `document.getElementById(idCampoPct(id))` (`:348-351`) — necessário porque `CelulaPct`
é não-controlado (`defaultValue`, não `value`). Isso só dispara se `acao()` rejeitar, o que exige que
`onEdicaoCelula`/`onColarFaixa` (as duas funções passadas de `page.tsx`) relancem o erro depois do
toast em vez de engolir: confirmado em `page.tsx:235-238`
(`handleEdicaoCelula` — `toast.error(...)` seguido de `throw error;`) e `page.tsx:250-254`
(`handleColarFaixa` — `toast.error(...)` seguido de `throw erro;`). Cadeia completa confirmada:
erro Supabase/RPC → `mapeiaErroRpc`/toast em `page.tsx` → `throw` → `escreverCelulas` catch em
`planejamento-grade.tsx` → reescreve o DOM. Sem o `throw`, a Promise resolveria "com sucesso" e o
`catch` nunca rodaria — é exatamente o que a mutação #2 do sensor (abaixo) confirma.

**4 caminhos passam pelo mesmo envelope**: `handleCommitCelula` (célula única, linhas `:511`/`:524`),
`handlePasteInicio` (faixa colada, `:564-568`), `aplicarEmMassa` no `useImperativeHandle` (massa,
`:395`), e `restaurarComSalvando` (`:365-375`), que o próprio `useUndoPlanejamento` chama em vez de
`onColarFaixa` direto (`use-undo-planejamento.ts:46`, `aoRestaurar` = `restaurarComSalvando`, ligado
em `planejamento-grade.tsx:376`) — os 4 chamam `escreverCelulas`, nenhum bypassa o envelope.

**Veredito**: ✅ Corrigido — indicador real, reversão real, 4/4 caminhos cobertos.

### Gap #2 (Success Criteria "limpar célula grava NULL", spec.md:124) — ✅ CORRIGIDO

`handleCommitCelula` (`planejamento-grade.tsx:499-527`) checa `valorTexto.trim() === ""`
(`:507`) **antes** de chamar `normalizaEntradaPct` (`:515`) — a única forma de diferenciar "vazio
intencional" de "inválido", já que a função retorna `null` para os dois casos
(`planejamento-formato.ts:8`, comportamento inalterado, correto — a distinção é responsabilidade do
chamador, não da função pura). Ramo do vazio: `if (valorAnterior == null) return;` (`:508`) — célula
já `NULL`, blur sem digitar nada, não dispara `empilharUndo` nem `escreverCelulas`, confirmando o
"Done when" de T26 ("campo já vazio ... não dispara escrita nem entrada de undo"). Caso contrário
(`valorAnterior` não nulo): `empilharUndo([{ idSucesso, valorAnterior }])` +
`escreverCelulas([idSucesso], ..., () => onEdicaoCelula(idSucesso, null))` (`:509-511`).

Tipagem: `onEdicaoCelula: (idSucesso: number, pctAtingimento: number | null) => Promise<void>`
(`planejamento-grade.tsx:70`); `handleEdicaoCelula(idSucesso: number, pctAtingimento: number | null)`
(`page.tsx:229`), que faz `.update({ pct_atingimento: pctAtingimento })` (`page.tsx:233`) sem
conversão — aceita `null` diretamente. Coluna real aceita `NULL`: `database.types.ts` — `Row.
pct_atingimento: number | null` e `Update.pct_atingimento?: number | null` confirmados em múltiplos
pontos (ex. linhas 1183/1196, tabela `fat_sucesso_mensal`), consistente com AD-005 ("NULL nunca
sentinela").

Escopo do fix mantido estrito ao Success Criterion literal (célula única via blur/paste de valor
único) — faixa colada e aplicar em massa não ganharam semântica de "limpar" (nenhum dos dois tinha
esse requisito no spec), e o undo continua com a limitação pré-existente e já documentada em T23 (não
restaura valores que eram `NULL` antes da edição, porque `atualiza_sucessos_mensais_lote` não aceita
`NULL`) — nada disso é regressão, é o mesmo corte de escopo já registrado no commit `3d740a4`.

**Veredito**: ✅ Corrigido — `NULL` grava de fato, mensagem de erro incorreta não aparece mais para
campo vazio, sem escrita/undo desnecessários no caso já-vazio.

### Gap #3 (Edge Case Assessor, spec.md:97-99) — ✅ CORRIGIDO

`page.tsx:100-104`:
```tsx
const [papelParaFiltroPadrao, setPapelParaFiltroPadrao] = useState<typeof papel>(null);
if (papel !== null && papel !== papelParaFiltroPadrao) {
  setPapelParaFiltroPadrao(papel);
  if (PERMISSOES[papel].editaPctSóMetasProprias) setSoMinhasMetas(true);
}
```
Padrão "ajustar estado durante o render" (recomendado pelo React para derivar estado de uma prop
assíncrona, em vez de `useEffect` + `setState` síncrono) — a checagem roda dentro do corpo da função
do componente, não em um efeito; `papelParaFiltroPadrao` garante que dispara **exatamente 1 vez**, na
primeira vez que `papel` resolve para não-`null` (depois disso `papel === papelParaFiltroPadrao`
sempre, o `if` externo nunca mais entra) — confirmado que não é `useEffect` + `setState` síncrono (o
padrão que `react-hooks/set-state-in-effect` rejeitaria; `npm run lint:frontend` desta rodada confirma
zero problemas em arquivos `planejamento`, ver Gate abaixo).

Decisão via `PERMISSOES[papel].editaPctSóMetasProprias`, não `papel === "assessor"` direto —
confirmado em `permissoes.ts`: `assessor.editaPctSóMetasProprias: true` (`:55`), `gestora`/`mentor`/
`admin` todos `false` (`:33`/`:44`/`:66`) — único papel `true` é `assessor`, satisfaz PLR-07 (nenhuma
checagem de string de papel bruto decide capacidade).

**Outros papéis não regrediram**: para `gestora`/`mentor`/`admin`, `PERMISSOES[papel].
editaPctSóMetasProprias` é `false`, então o `if` interno nunca chama `setSoMinhasMetas(true)` — o
`useState(false)` inicial (`page.tsx:83`) permanece o valor efetivo, idêntico ao comportamento
pré-fix para esses 3 papéis. Usuário continua livre para ligar/desligar manualmente pela toolbar depois
(o ajuste roda só 1x, na resolução inicial de `papel`).

**Veredito**: ✅ Corrigido — Assessor abre com "só minhas metas" já marcado; demais papéis preservam o
comportamento anterior (filtro desligado por padrão).

### Sensor de discriminação (ciclo 2 — reverificação direcionada, escopo pequeno)

Ambas as mutações aplicadas em árvore limpa (`git status` vazio antes, confirmado por
`git status --short -- src/frontend/components/planejamento/ ".../planejamento/"`), revertidas com
`git checkout --` imediatamente após avaliar, `git status`/`git diff` vazios confirmados ao final.

| # | File:line | Mutação | Killed? |
| - | --- | --- | --- |
| 1 | `planejamento-grade.tsx:507` | `valorTexto.trim() === ""` → `valorTexto.trim() !== ""` (inverte o gate do Gap #2) | ⚠️ Sobrevive a `npm run test:unit` (404/404 continuam verdes) — **esperado**, nenhum teste unitário cobre `handleCommitCelula`/componentes de grade (débito conhecido L-006/L-007, mesma classe já registrada no Ciclo 1). Avaliado por inspeção: a mutação faria QUALQUER texto não-vazio cair no ramo de "limpar" (nunca valida/escreve um `%` real) e o texto vazio cair em `normalizaEntradaPct("")` → erro "Valor deve estar entre 0 e 100" (reintroduz exatamente o bug original do Gap #2) — quebra funcional óbvia e severa, mas sem harness de componente não há teste automatizado capaz de matá-la hoje. |
| 2 | `page.tsx:237` | Remove `throw error;` de `handleEdicaoCelula` (deixa só o `toast.error`, sem relançar) | ⚠️ Sobrevive a `npm run test:unit` pelo mesmo motivo (sem harness) — avaliado por inspeção: sem o `throw`, a Promise retornada por `onEdicaoCelula` resolveria normalmente após um erro real, `escreverCelulas` nunca entraria no `catch`, e a célula ficaria mostrando o valor digitado como se tivesse sido salvo mesmo com a escrita tendo falhado no banco — quebra exatamente o mecanismo central do Gap #1 (reversão em erro). Confirma por inspeção que o `throw` é o elo indispensável da cadeia erro→reversão. |

**Sensor depth**: lightweight (reverificação direcionada, escopo pequeno conforme instrução do
orquestrador — 2 mutações, não 1-3 genéricas)
**Result**: 0/2 mortas por automação (nenhum harness cobre estes arquivos — débito pré-existente,
não uma lacuna nova desta feature); 2/2 avaliadas por inspeção confirmam que os fixes dos Gaps #1/#2
são o mecanismo real de comportamento (não código morto/decorativo) — nenhuma ação nova necessária,
mesma classe de achado do Ciclo 1 (mutação #3, `CelulaCalculada`). Não gera fix task nova: o gap real
(ausência de harness) já é débito conhecido rastreado como L-006/L-007, não desta rodada.

### Gate (ciclo 2, árvore limpa após reverter o sensor)

- `npm run test:unit` → **404/404 passed**, 36 arquivos de teste, 0 falhas (mesma contagem do Ciclo 1
  — T25-T27 não adicionaram nem removeram testes, consistente com "Tests: none" declarado nas 3 tasks)
- `npm run build` → sucesso, Next.js 16.2.12/Turbopack, 30 rotas geradas (16 App Router entries do
  Ciclo 1 seguem presentes, incluindo `/contratos/[id]/planejamento`), TypeScript limpo. `.next`
  removido logo em seguida (`rm -rf src/frontend/.next`, disciplina de disco do handoff)
- `npm run lint:frontend` → 30 problemas (15 erros, 15 avisos) — **idêntico ao Ciclo 1**;
  `grep -i planejamento` na saída completa retorna **zero ocorrências** — todos os 30 problemas
  seguem em `incidencia/*` e `fundacao/tse-match-search.tsx` (features paralelas rodando na mesma
  branch), confirmado por leitura das mensagens (`encontros-lista.tsx`, `iip-card.tsx`,
  `tse-match-search.tsx`, `encontro-form.tsx`) — nenhum arquivo em `components/planejamento/**` ou
  `app/.../planejamento/**`

**Nenhuma regressão encontrada** nos arquivos tocados por T25-T27 além dos 3 gaps já fechados — as
demais PLR-NN (já ✅ Verified no Ciclo 1) não foram tocadas por este fix e permanecem válidas por
inspeção do diff (`git diff --stat 9a2d997..3d740a4` confirma só os 2 arquivos esperados).

### Lessons

Nenhum sinal novo nesta rodada (os 3 gaps foram corrigidos exatamente como diagnosticado no Ciclo 1,
sem nova mutação sobrevivente que revele um problema não coberto por L-024/L-025/L-026 já candidatas,
sem novo `SPEC_DEVIATION`, sem nova lacuna de AC). `.specs/lessons.json`/`.specs/LESSONS.md` não
foram tocados nesta rodada — nada a distilar além do que o Ciclo 1 já registrou.

### Requirement Traceability Update (ciclo 2)

| Requirement | Status Ciclo 1 | Status Ciclo 2 |
| --- | --- | --- |
| PLR-01 a PLR-18 | ✅ Verified | ✅ Verified (inalterado, não retocado) |
| PLR-19 | ❌ Needs Fix | ✅ Verified |

### Summary (ciclo 2)

**Overall**: ✅ Ready

**Spec-anchored check**: 19/19 requisitos PLR-NN + os 2 achados de Success Criteria/Edge Case fora da
tabela — todos com outcome do spec batendo com o código, evidência `file:line` para os 3 antes
marcados FAIL.
**Sensor**: 2/2 mutações direcionadas avaliadas por inspeção (sem harness, débito conhecido) —
nenhuma revela comportamento decorativo; ambas confirmam que os fixes são o mecanismo real.
**Gate**: 3/3 comandos verdes (404/404 testes, build limpo, lint sem regressão — 0 problemas em
arquivos `planejamento`).

**What works**: os 3 gaps do Ciclo 1 — indicador de "salvando" real + reversão em erro nos 4 caminhos
de escrita (PLR-19), limpar célula grava `NULL` de fato (Success Criteria), Assessor abre com "só
minhas metas" já marcado sem regredir os outros papéis (Edge Case) — todos confirmados por leitura de
código ponta a ponta, não só por existência de código.

**Issues found**: nenhum novo. Nenhuma regressão nos arquivos tocados.

**Next steps**: nenhum — feature pronta para ser considerada `✅ Verified` de ponta a ponta
(PLR-01 a PLR-19 + Success Criteria + Edge Cases do `spec.md`).

---

## Ciclo 1/3 (2026-08-14) — relatório original (FAIL, 3 gaps)

**Date**: 2026-08-14
**Spec**: `.specs/features/planejamento-estrategico-redesenho/spec.md`
**Diff range**: `f7b2df1^..9a2d997` (T1 "objeto PERMISSOES" até T24 "gate final"), filtrado a
`src/frontend/components/planejamento/**`, `src/frontend/app/(app)/contratos/[id]/planejamento/**`,
`src/backend/queries/planejamento.ts(.test.ts)`, `src/frontend/lib/planejamento-formato.ts(.test.ts)`,
`src/frontend/hooks/use-papel-global.ts` (0 linhas de diff — T5 foi confirmação, extensão real veio
de `incidencia-encontros` T17, commit `617a2c2`). Nota: o commit `afe1a1b` (spec/context/design.md)
tem timestamp *posterior* a T1-T4 (`f7b2df1`..`13ab63f`) — os docs de planejamento foram commitados em
lote depois da implementação inicial, não antes; isso não afeta a cobertura, só a ordem de commit no
histórico (`git log --date=iso` confirma).
**Verifier**: independente (author ≠ verifier) — sessão fresca, sem herdar o modelo mental do autor.

---

## Task Completion

Todas as 24 tasks (T1–T24) marcadas `✅ Concluída` em `tasks.md`, gate verde reportado a cada uma.
Confirmado por leitura de código que os artefatos descritos realmente existem no diff (nenhuma task
"concluída" sem arquivo correspondente).

| Task | Status | Notas |
| --- | --- | --- |
| T1–T24 | ✅ Done | Verificado por leitura de código linha a linha (ver seção de ACs abaixo) |

---

## Spec-Anchored Acceptance Criteria

| Requirement | Spec-defined outcome | `file:line` + evidência | Result |
| --- | --- | --- | --- |
| PLR-01 | Layout 2 colunas; esquerda colapsável, accordion `<1024px`; nunca painel fixo à direita | `page.tsx:268` (`flex flex-col gap-6 lg:flex-row lg:items-start`); `contexto-estrategico.tsx:42` (`<details open className="w-full lg:w-[240px] lg:shrink-0">`, sem `position: fixed/sticky`) | ✅ PASS |
| PLR-02 | Breadcrumb curto + h1=`objetivo_ano` + chips (produto/projeto/coalizão/etapa+mês+atraso) | `planejamento-header.tsx:72-95` | ✅ PASS |
| PLR-03 | 3 indicadores: % com barra + n/N; IIP placeholder oculto p/ Assessor | `planejamento-header.tsx:98-123` (`permissoes.veIip` gate; `PERMISSOES.assessor.veIip=false` → indicador ausente) | ✅ PASS |
| PLR-04 | Faixa de recálculo substitui recálculo silencioso no `useEffect` | `planejamento-header.tsx:125-135` (renderiza só se `atingimentoDesatualizado===true`); `page.tsx` inteiro lido — nenhum `useEffect` chama `recalcularAtingimento` automaticamente; só `handleRecalcular` (`page.tsx:163-172`) via botão | ✅ PASS |
| PLR-05 | Reaproveita `DadosPlanejamentoForm`; corrige gate PLL do perfil de atuação | `contexto-estrategico.tsx:49-58`; `dados-planejamento-form.tsx:161-189` (`{produtoNome === "PLL" && (...)}`) | ✅ PASS |
| PLR-06 | GIP placeholder "em desenvolvimento" | `contexto-estrategico.tsx:93-99` | ✅ PASS |
| PLR-07 | `PERMISSOES` único, 4 papéis, substitui checagens inline | `permissoes.ts:12-79`; `permissoes.test.ts` (44 casos, matriz completa papel×capacidade) | ✅ PASS — sensor mutação A matou |
| PLR-08 | 3 modos, colunas por modo, modo padrão por papel, indisponíveis desabilitados (não escondidos) | `planejamento-grade.tsx:833-847` (`colunasVisiveisPorModo`); `page.tsx:283-301` (`disabled={!disponivel}`, sempre renderizado) | ✅ PASS |
| PLR-09 | Árvore-grade unificada: 1 tabela, 3 tipos de linha, recolhível por nível | `planejamento-grade.tsx:39-42` (`LinhaObj\|LinhaMeta\|LinhaSm`); `:892-926` (1 único `<Table>`) | ✅ PASS |
| PLR-10 | Célula calculada: não focável, sem clique, estilo distinto | `planejamento-grade.tsx:125-139` (`CelulaCalculada`: `tabIndex={-1}`, `aria-readonly`, `repeating-linear-gradient`, marcador `fx`, zero `onClick`/`onFocus`) | ✅ PASS — sensor mutação C avaliada por inspeção (ver Sensor) |
| PLR-11 | Toolbar completa (expandir/recolher, busca, só pendentes, só minhas metas, aplicar % massa, criar Objetivo) | `planejamento-toolbar.tsx` inteiro; `page.tsx:303-317` | ⚠️ PASS mecânico, mas ver Edge Case gap abaixo (estado inicial do Assessor) |
| PLR-12 | Modal detalhe/edição envolve os 3 forms | `modal-detalhe-item.tsx:39-122` | ✅ PASS |
| PLR-13 | Modal histórico (`log_auditoria`), nova leitura | `modal-historico.tsx`; `queries/planejamento.ts` `buscarHistoricoAuditoria` (camelCase, `ORDER BY ocorrido_em DESC`, testado em `planejamento.test.ts`) | ✅ PASS funcionalmente — RLS `p_log_admin` (`docs/schema_sistema.sql:1627`) bloqueia Gestora de ver o conteúdo; **achado real, corretamente documentado** em `tasks.md` T18, não é gap silencioso |
| PLR-14 | Esc fecha, foco retorna, `role="dialog"`/`aria-modal`, nunca empilhados | Radix `Dialog` (`components/ui/dialog.tsx`) garante Esc/foco/aria; `planejamento-grade.tsx:259,263` (`acaoAtiva`/`historicoAlvo`, 2 `useState` distintos, nenhum handler seta os dois) | ✅ PASS |
| PLR-15 | Teclado: Tab/Enter/setas/Esc/Home/End | `planejamento-grade.tsx:199-216` | ✅ PASS |
| PLR-16 | Colar aceita vírgula/ponto/`%` | `planejamento-formato.ts:6-15` (`normalizaEntradaPct`); usado em `planejamento-grade.tsx:184-198,432-469`; `planejamento-formato.test.ts` (11 casos) | ✅ PASS — sensor mutação B matou. Ver gap #1 (limpar célula) |
| PLR-17 | Edição em massa shift+clique | `planejamento-grade.tsx:270-280` (`alternarMarcada`), `:307-314` (`aplicarEmMassa`); `planejamento-toolbar.tsx:101-127` | ✅ PASS na escrita (RPC de lote atômica) — ver nota de baixa confiança sobre reflexo visual em "Code Quality" |
| PLR-18 | Undo Ctrl+Z, nunca apaga/edita `log_auditoria` | `use-undo-planejamento.ts`; `planejamento-grade.tsx:326-339` (listener `document`, ignora dentro de `[role='dialog']`); reversão via `onColarFaixa` (mesmo caminho validado) | ✅ PASS — limitação "não restaura NULL" corretamente documentada em `tasks.md` T23 e no próprio hook |
| PLR-19 | Salvamento otimista + reversão em erro + indicador de "salvando" por célula, estendido a massa/undo | **Nenhuma evidência encontrada.** `grep -rn -i "salvando\|saving\|optimist"` em todo `src/frontend/components/planejamento/` só retorna botões de submit de formulário (`enviando ? "Salvando..." : ...` em `dados-planejamento-form.tsx:217`, `meta-form.tsx:323`, etc. — nada ligado a células da grade). `page.tsx:201-228` (`handleEdicaoCelula`/`handleColarFaixa`): em erro, só `toast.error(...)`, sem reverter o valor exibido. Nunca aparece como campo "Requirement" de nenhuma task T1-T24 (`grep -n "PLR-19" tasks.md` = 0 resultados); só existe como citação de faixa no título de seção do `design.md:195` ("PLR-15 a PLR-19") | ❌ **GAP — não implementado, não decomposto em task, não documentado como SPEC_DEVIATION** |

**Status**: ❌ 1 gap real (PLR-19, zero evidência) + 2 gaps adicionais fora da tabela PLR-NN, achados
nas Success Criteria / Edge Cases do próprio `spec.md` (ver abaixo) — nenhum spec-precision gap (todas
as ACs com outcome preciso tinham evidência clara o suficiente pra julgar PASS/FAIL sem ambiguidade).

---

## Success Criteria e Edge Cases (spec.md) — achados além da tabela PLR-NN

### Gap A — "Limpar uma célula de `%` grava `NULL`" (Success Criteria, spec.md:124) — NÃO SATISFEITO

**O que o spec pede**: *"Limpar uma célula de `%` grava `NULL` e a linha passa a exibir '—' e
'pendente'."*

**O que o código faz**: `normalizaEntradaPct("")` retorna `null` (`planejamento-formato.ts:8`,
`texto.trim()===""` → `null`) — o mesmo valor de retorno usado para entrada **inválida**. Em
`handleCommitCelula` (`planejamento-grade.tsx:416-430`):

```ts
const pct = normalizaEntradaPct(valorTexto);
if (pct === null) {
  setErros((atual) => ({ ...atual, [idSucesso]: "Valor deve estar entre 0 e 100." }));
  return;   // <-- nunca chama onEdicaoCelula; NULL nunca é gravado
}
```

Limpar o campo (apagar tudo e sair, `onBlur` com `valorTexto === ""`) cai neste mesmo ramo — mostra o
erro **"Valor deve estar entre 0 e 100"** para o usuário (mensagem incorreta: o campo não está fora de
0–100, está vazio) e a escrita nunca acontece. `onEdicaoCelula`/`onColarFaixa` (assinatura em
`planejamento-grade.tsx:65-66`) só aceitam `pctAtingimento: number`, nunca `null` — o tipo nem permite
a operação. Confirmado que não existe caminho alternativo: `sucesso-mensal-form.tsx:20-26` documenta
explicitamente que `pct_atingimento` fica **fora** dos campos do modal ("é campo da grade") — logo não
há nenhuma outra UI que grave `NULL` nesse campo.

**Raiz**: comportamento idêntico ao `validaPct` original de `planejamento-planilha-monitoramento`
(`git show 5f31694:.../grade-sucessos-mensais.tsx:61-63,229-236` — mesma lógica, string vazia = erro).
A PLM nunca teve este Success Criterion no seu próprio `spec.md` (grep confirma), então isto não é uma
regressão de comportamento — é um Success Criterion **novo**, introduzido pelo próprio `spec.md` desta
feature, que o código porta fielmente do comportamento antigo sem de fato implementar.

**Severidade**: Major (funcionalidade ausente + mensagem de erro enganosa; não há como um usuário
limpar um Sucesso Mensal preenchido por engano, exceto editando o banco diretamente).

### Gap B — Edge Case Assessor: "modo inicial ... filtrado apenas às Metas com `id_usuario_responsavel = auth.uid()`" (spec.md:97-99) — NÃO SATISFEITO POR PADRÃO

**O que o spec pede**: *"WHEN o papel é `assessor` e ele abre a tela THEN o modo inicial SHALL ser
Monitorar, filtrado apenas às Metas com `id_usuario_responsavel = auth.uid()`"* — ao ABRIR a tela, não
depois de um clique.

**O que o código faz**: `modoPadrao` bate (`PERMISSOES.assessor.modoPadrao === "monitorar"`,
`permissoes.ts:52`) — mas o filtro "só minhas metas" nasce **desligado**, independente do papel:
`page.tsx:83` — `const [soMinhasMetas, setSoMinhasMetas] = useState(false);` (mesmo `useState(false)`
usado para todo mundo, sem ramo condicional por `papel`). Confirmado também que RLS não filtra a
leitura por responsável — `vw_sucesso_mensal` (`docs/schema_sistema.sql:1196-1200`,
`security_invoker=true`) e a policy `p_heranca` de `fat_meta`/`fat_sucesso_mensal`
(`supabase/migrations/20260812145720_planejamento_planilha_rls.sql:26-29`) só verificam a cadeia até
`dim_planejamento` — nenhum predicado de `id_usuario_responsavel`. Ou seja: ao abrir a tela, um
Assessor vê a carteira inteira do contrato (todas as Metas, de todos os responsáveis) até marcar
manualmente a caixa "Só as minhas metas" no toolbar — o oposto do que o Edge Case pede como estado
inicial.

**Severidade**: Major (dado exposto por padrão que o spec pede oculto por padrão — mitigado por não
ser uma falha de segurança real, já que RLS de escrita continua correta e o próprio spec já concede
que a leitura é da carteira do contrato; mas o requisito literal do Edge Case não é atendido sem ação
manual do usuário).

---

## Discrimination Sensor

Todas as mutações aplicadas em arquivos limpos (`git status` vazio antes de cada uma), revertidas com
`git checkout --` imediatamente após avaliar, confirmado `git status` limpo ao final.

| # | File:line | Mutação | Killed? |
| - | --- | --- | --- |
| 1 | `src/frontend/components/planejamento/permissoes.ts:59` | `assessor.veColunaResponsavel: false` → `true` | ✅ Killed — 3 testes falharam em `permissoes.test.ts` (`toEqual(ESPERADO[papel])`, teste de capacidade individual, teste "assessor: só Monitorar...") |
| 2 | `src/frontend/lib/planejamento-formato.ts:12` | `valor > 100` → `valor >= 100` | ✅ Killed — 1 teste falhou em `planejamento-formato.test.ts` ("aceita valores inteiros simples": `normalizaEntradaPct("100")` esperado `100`, recebido `null`) |
| 3 | `src/frontend/components/planejamento/planejamento-grade.tsx:128` | Remove `tabIndex={-1}` de `CelulaCalculada` | ⚠️ Avaliado por inspeção (sem harness de componente, débito L-006/L-007) — **achado relevante**: o elemento é um `<span>`, que não é nativamente focável nem entra na ordem de tabulação sem `tabIndex` explícito ≥0. Remover `tabIndex={-1}` não muda o comportamento real de navegação por Tab (o `<span>` já não seria alcançado de qualquer forma) — a mutação é "inerte" para o requisito comportamental central de PLR-10 (Tab nunca para na célula). O atributo é, na prática, defensivo/documental, não o mecanismo que de fato impede o foco; a letra do requisito ("`tabIndex={-1}` real, não só estilo") continua satisfeita no código-fonte tal como está, mas o teste comportamental (Tab) não teria como diferenciar as duas versões num navegador real. Não é um gap desta feature — é uma observação de precisão sobre o mecanismo, registrada para transparência. |

**Sensor depth**: lightweight (padrão para feature não-P0)
**Result**: 2/2 mutações com automação real → Killed; 1/1 mutação sem harness → avaliada por inspeção,
comportamento funcional não muda (elemento já era inerentemente não-focável) — nenhuma ação necessária.

---

## Code Quality

| Principle | Status |
| --- | --- |
| No features beyond what was asked | ✅ |
| No abstractions for single-use code | ✅ |
| No unnecessary "flexibility" added | ✅ |
| Only touched files required for task | ✅ — diff restrito a `components/planejamento/**`, `app/.../planejamento/**`, `queries/planejamento.ts`, `lib/planejamento-formato.ts` |
| Didn't "improve" unrelated code | ✅ |
| Matches existing patterns/style | ✅ — segue o padrão de `queries/etapa-contrato.ts`/`kanban.ts` (view-model camelCase), Radix `Dialog` já usado em `usuarios/page.tsx` |
| Would senior engineer approve? | ⚠️ — aprovaria com ressalva: PLR-19 nunca foi decomposto em task (buraco silencioso no planejamento, não só na execução), e a Success Criteria "limpar célula = NULL" foi portada com o mesmo defeito do código anterior sem nota alguma |
| Tests map to acceptance criteria and are non-shallow | ✅ — `permissoes.test.ts` cobre a matriz inteira; `planejamento-formato.test.ts` cobre todos os casos do Test Coverage Matrix (vírgula/ponto/%/fora-de-faixa/vazio/não-numérico); `queries/planejamento.test.ts` cobre `buscarHistoricoAuditoria` (shape+vazio+resolução de nome) e D-C |
| Spec-anchored outcome check | ⚠️ — ver PLR-19 e os 2 gaps de Success Criteria/Edge Case acima |
| Per-layer Coverage Expectation met | ✅ — domínio (`permissoes.ts`, `planejamento-formato.ts`, queries) com testes 1:1; componentes sem harness é débito conhecido do projeto (L-006/L-007), não desta feature |
| Every test maps to a spec requirement | ✅ — nenhum teste "solto" sem AC associado |
| Documented guidelines followed | `Test Coverage Matrix` de `tasks.md` — seguida à risca para as camadas testáveis |

**Nota adicional, baixa confiança (não incluída como gap ranqueado)**: `CelulaPct`
(`planejamento-grade.tsx:163-170`) usa `<input defaultValue={linha.pctAtingimento ?? ""}>`
(não-controlado). O mesmo padrão já existia em `planejamento-arvore.tsx`/`grade-sucessos-mensais.tsx`
(PLM, já `✅ Verified`) para edição de célula única e colagem de faixa. PLR-17 (aplicar em massa) e
PLR-18 (undo) reusam esse mesmo padrão para escrever em células que o usuário **não** está digitando
diretamente — pela semântica padrão do React, um `<input>` não-controlado só lê `defaultValue` na
montagem; como as chaves de linha/célula (`row.id`/`cell.id`, derivadas do índice posicional do
TanStack Table) não mudam entre re-renders de uma mesma atualização de valor, é esperado que o valor
exibido nessas células **não** se atualize visualmente após "Aplicar em massa" ou `Ctrl+Z`, mesmo que a
escrita no banco tenha sido bem-sucedida — só um remount (trocar de modo, filtrar, navegar e voltar)
mostraria o valor correto. Não pude confirmar isto em runtime (sem harness de componente no projeto),
por isso não entra como gap ranqueado — fica registrado para quem for investigar em UAT manual.

---

## Edge Cases

- [x] Soma de peso ≠ 100 → alerta na linha da Meta, nunca bloqueio (`planejamento-grade.tsx:706-712`, `idsMetaComPesoDivergente`)
- [x] Ctrl+Z sem histórico → não faz nada, sem erro (`use-undo-planejamento.ts:38-41`, `pop()` de array vazio retorna `undefined` → early return)
- [x] Tab nunca para em célula calculada (`tabIndex={-1}`, ver PLR-10)
- [ ] Assessor abre a tela → filtrado por padrão às próprias Metas — **NÃO satisfeito** (Gap B acima)
- [x] Papel sem `veAuditoria` não vê o botão de histórico (`planejamento-grade.tsx:744`, `permissoes.veAuditoria &&`)

---

## Gate Check

- **Gate command**: `npm run test:unit && npm run build && npm run lint:frontend` (rodados
  separadamente, nesta ordem, por causa do aviso de disco cheio no handoff)
- **Result**:
  - `npm run test:unit` → **404/404 passed**, 36 arquivos de teste, 0 falhas
  - `npm run build` → sucesso, Next.js 16.2.12/Turbopack, 16 rotas geradas, TypeScript limpo (`.next` limpo logo em seguida por causa do disco)
  - `npm run lint:frontend` → 30 problemas (15 erros, 15 avisos) — **confirmado por `grep -i planejamento`: 0 ocorrências** nos arquivos desta feature; todos os 30 são em `coalizoes/*`, `contratos/*`, `mandatos/*`, `usuarios/page.tsx`, `fundacao/*`, `incidencia/*` (features paralelas, fora de escopo)
- **Test count antes desta feature** (arquivos próprios): `permissoes.test.ts` não existia (0); `planejamento-formato.test.ts` não existia (0); `queries/planejamento.test.ts` tinha 10 casos (`git show f7b2df1^:.../planejamento.test.ts`)
- **Test count depois**: `permissoes.test.ts` = 44; `planejamento-formato.test.ts` = 11;
  `queries/planejamento.test.ts` = 14
- **Delta**: +44, +11, +4 = **+59 testes novos** atribuíveis a esta feature (dos 404 totais do
  repositório — o resto vem de features paralelas no mesmo branch)
- **Skipped tests**: nenhum
- **Failures**: nenhuma

Disco livre em C: no início ~30MB (crítico, herdado de outras sessões), ~23.5GB ao final (liberado por
sessões paralelas durante a verificação, não por ação desta). `.next` limpo manualmente após o build,
como instruído.

---

## Fix Plans

### Fix 1: PLR-19 nunca implementado (indicador de "salvando" + reversão em erro por célula, estendido a massa/undo)

- **Root cause**: PLR-19 nunca foi atribuído a nenhuma task em `tasks.md` — só aparece como parte de um
  intervalo citado no título de uma seção do `design.md` ("PLR-15 a PLR-19"), sem detalhamento próprio
  no corpo do documento nem em nenhum "Done when".
- **Fix task**: Adicionar um indicador visual por célula (`CelulaPct`) enquanto `onCommit`/
  `onColarFaixa`/`aplicarEmMassa`/`desfazer` estão em voo (ex.: opacidade reduzida + spinner, ou
  `aria-busy`), e reverter o valor exibido para o anterior quando a Promise rejeitar (hoje só
  `toast.error`, sem reversão visual). Estender ao caminho de massa/undo.
- **Priority**: Major

### Fix 2: "Limpar célula grava NULL" nunca implementado (Success Criteria, spec.md:124)

- **Root cause**: `normalizaEntradaPct("")` retorna `null`, e `handleCommitCelula`/
  `onEdicaoCelula`/`onColarFaixa` tratam qualquer `null` como erro de validação — não existe
  distinção entre "vazio intencional" e "inválido", nem um tipo que aceite `pctAtingimento: number |
  null` na escrita.
- **Fix task**: Distinguir "campo vazio" de "campo inválido" em `handleCommitCelula` (ex.: checar
  `valorTexto.trim() === ""` antes de chamar `normalizaEntradaPct`, e chamar
  `onEdicaoCelula(idSucesso, null)` nesse caso); mudar a assinatura de `onEdicaoCelula`/
  `handleEdicaoCelula` (`page.tsx`) para aceitar `pctAtingimento: number | null` e fazer
  `.update({ pct_atingimento: null })` quando for o caso.
- **Priority**: Major

### Fix 3: Assessor não vê "só minhas metas" ligado por padrão ao abrir a tela (Edge Case, spec.md:97-99)

- **Root cause**: `page.tsx:83` inicializa `soMinhasMetas` com `useState(false)` sem considerar `papel`.
- **Fix task**: Inicializar `soMinhasMetas` com `papel === "assessor"` (ou incluir `mentor`, se Pedro
  confirmar que o Edge Case deveria valer para os dois — o texto do spec só cita Assessor
  explicitamente).
- **Priority**: Major

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| PLR-01 a PLR-18 | Implementing | ✅ Verified |
| PLR-19 | Implementing | ❌ Needs Fix |

---

## Summary

**Overall**: ❌ Not Ready

**Spec-anchored check**: 18/19 requisitos PLR-NN batem com o outcome do spec; PLR-19 sem nenhuma
evidência (gap real, não spec-precision gap — o outcome pedido é preciso e simplesmente não existe no
código). Adicionalmente, 2 achados fora da tabela PLR-NN mas dentro do próprio `spec.md` (Success
Criteria "limpar célula = NULL" e Edge Case "Assessor filtrado por padrão") também não se sustentam
por leitura de código.

**Sensor**: 2/2 mutações com automação real mortas pelos testes existentes; 1/1 mutação sem harness
avaliada por inspeção, sem regressão funcional encontrada (span já não era focável de qualquer forma).

**Gate**: 3/3 comandos rodados, todos verdes (404/404 testes, build limpo, lint sem problemas novos).

**What works**: PERMISSOES único e testado exaustivamente; árvore-grade unificada com 3 modos e matriz
de colunas correta; célula calculada genuinamente não-editável; modais com Radix (Esc/foco/aria de
graça, nunca empilhados); teclado completo (Tab/Enter/setas/Esc/Home/End); colar de faixa com
vírgula/ponto/%; edição em massa e undo escrevendo corretamente no banco pelo mesmo caminho validado;
faixa de recálculo explícita substituindo o recálculo silencioso; todas as 4 SPEC_DEVIATIONs já
documentadas em `tasks.md` (colunas extra do Construir são leitura; "Ler" não pivota por mês; undo não
restaura NULL; RLS de `log_auditoria` bloqueia Gestora) confirmadas reais por leitura de schema/código
e continuam corretamente documentadas — nenhuma nova invenção de deviation de minha parte além das 3
listadas acima.

**Issues found**:
1. PLR-19 (indicador de salvando + reversão em erro) — nunca implementado, nunca decomposto em task — Fix 1
2. Success Criteria "limpar célula grava NULL" — bloqueado por erro de validação incorreto — Fix 2
3. Edge Case "Assessor filtrado por padrão" — filtro nasce desligado independente do papel — Fix 3

**Next steps**: 3 fix tasks acima, ciclo fix→re-verify (máx. 3 iterações antes de escalar a Pedro,
por `validate.md`).
