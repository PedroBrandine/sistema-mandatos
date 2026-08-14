# Visão Gerencial G3-G6 (Tela Gerencial completa) Validation

**Date**: 2026-08-14
**Spec**: `.specs/features/visao-gerencial-g3-g6/spec.md`
**Diff range**: não aplicável como range único (múltiplas sessões paralelas no mesmo `develop`
— `incidencia-encontros`, `formularios-produto`, `planejamento-estrategico-redesenho` —
intercalaram commits, incluindo T1 desta feature dentro de `66cc2ab` e T4 dentro de `61ea838`).
Escopo real usado: os caminhos de arquivo listados no prompt do orquestrador, confirmados
1:1 contra `git log --oneline -- supabase/migrations/20260814*.sql` e os diretórios
`src/backend/queries/visao-gerencial*`, `src/frontend/components/visao-gerencial/*`,
`src/frontend/app/(app)/visao-gerencial/page.tsx`, `supabase/tests/visao-gerencial/*`.
**Verifier**: independente (author ≠ verifier), sessão fresca sem histórico de implementação.

---

## Task Completion

| Task | Status | Commit(s) | Notes |
| --- | --- | --- | --- |
| T1 | ✅ Done | dentro de `66cc2ab` | `vw_pendencias`, 6 categorias, verificado no arquivo + `vw-pendencias.integration.test.ts` (13 casos) |
| T2 | ✅ Done | `1a0624e` | `vw_resposta_formulario` |
| T3 | ✅ Done | `7e1a2c6` | `vw_ciclo_etapa` + `dt_conclusao` |
| T4 | ✅ Done | dentro de `61ea838` | `vw_carteira_ponderada_mensal`, EXPLAIN ANALYZE documentado no header do teste |
| T5 | ✅ Done | `00e3b39` + fix `3da9213` | `vw_cobertura_registro_mensal`, corrigida pra grão fino |
| T6 | ✅ Done | `44c76e9` + fix `3da9213` | `vw_resposta_formulario_mensal`, corrigida pra grão fino |
| T7 | ✅ Done | `a60c209` | `database.types.ts` contém as 6 views novas/alteradas (grep confirmado) |
| T8 | ✅ Done | `8ad099a` | `FiltroRecorte` + `buscarPapelGlobalAtual` (`usuario.ts`), 6 testes unitários |
| T9 | ✅ Done | `310e0bf` | `buscarSaudeCobertura` + `resolverIdsContratoDoRecorte` |
| T10 | ✅ Done | `ee4594d` | `buscarSaudeFormularios` |
| T11 | ✅ Done | `59112ba` | `buscarCarteiraPonderada`/`buscarCicloEtapa` usam `FiltroRecorte` |
| T12 | ✅ Done | `1fb08b5` | `buscarCarteiraPonderadaMensal`, cap 8+Outras testado |
| T13 | ✅ Done | `e55cef3` | `buscarDistribuicaoEtapas` |
| T14 | ✅ Done | `66b88b5` | `buscarAtingimentoPorRecorte` |
| T15 | ✅ Done | `25fe2e9` | `buscarCompletudeCadastro` |
| T16 | ✅ Done | `05f65f7` | `buscarIipConsolidado` |
| T17 | ✅ Done | `3b5658f` | `buscarPendencias` |
| T18 | ✅ Done | `7369312` | `NaoAutorizado` |
| T19 | ✅ Done | `9f2afdf` | `page.tsx` Server Component + gate |
| T20 | ✅ Done | `41dfc95` | `BarraRecorte` |
| T21 | ✅ Done | `d941284` | Recharts + `ChartLinhaEvolucao`/`ChartBarraHorizontal` + `components/ui/chart.tsx` |
| T22 | ✅ Done | `22b0cfd` | `SaudeOperacaoBloco` |
| T23 | ✅ Done | `d082bfe` + fix `3ffbd27` | G1/G2 refatorados, achado "função como prop" corrigido |
| Adendo | ✅ Done | `6ddac10` | `buscarCicloEtapaMensal` (G2 evolução, lacuna achada em T23) |
| T24 | ✅ Done | `0ba4e41` | `DistribuicaoEtapasBloco` + `distribuicao-etapas-interativo.tsx` + `EtapaContratosModal` |
| Adendo | ✅ Done | `0fe7cfa` | `buscarContratosPorEtapa` |
| T25 | ✅ Done | `876d7e3` | `g5-atingimento-card` |
| T26 | ✅ Done | `1afb50c` | `g6-completude-card` |
| T27 | ✅ Done | `535b020` | `iip-consolidado-card` |
| T28 | ✅ Done | `8349ad4` | `IndicadoresBloco` |
| T29 | ✅ Done | `cfbb916` | `GargalosBloco` + `GargalosTabela` |
| T30 | ✅ Done | `355cc3e` | wire final, `<EmDesenvolvimento>` removido, ordem visual confirmada em `page.tsx` |

**Todas as 30 tasks + 3 adendos existem no código com conteúdo real** (não só a mensagem de
commit — cada arquivo foi lido e o comportamento cruzado contra o "Done when" da task). Nenhuma
task bloqueada ou parcial.

---

## Spec-Anchored Acceptance Criteria

### P1: Barra de recorte + gate de papel + Bloco 0

| Criterion | Spec-defined outcome | `file:line` + evidência | Result |
| --- | --- | --- | --- |
| GER-01: mentor/assessor bloqueados, inclusive URL direta | 403 antes de qualquer bloco | `src/frontend/app/(app)/visao-gerencial/page.tsx:60-66` — `if (papel === "mentor" \|\| papel === "assessor") return <NaoAutorizado/>` antes do `parseFiltroRecorte`/qualquer bloco | ✅ PASS |
| GER-02: tela sem filtro → 5 filtros vazios, universo completo (RLS) | todos os `Select` vazios; queries sem `.eq`/`.in` extra | `barra-recorte.tsx:97-160` (5 `Select`); `visao-gerencial.ts:230-237` `resolverIdsContratoDoRecorte` retorna `undefined` quando os 4 filtros estão `undefined` (nenhum `.in()` aplicado) | ✅ PASS |
| GER-03: mudar filtro reflete na URL, blocos recarregam | `router.replace` com novo `searchParams`; blocos recebem `filtro` novo | `barra-recorte.tsx:68-77` `atualizarFiltro`; `page.tsx:52-68` re-parseia `searchParams` a cada render (Server Component) | ✅ PASS |
| GER-04: chip removível por filtro + "limpar tudo" | chip por filtro ativo, botão zera todos | `barra-recorte.tsx:163-182` | ✅ PASS |
| GER-05: Gestora+Mentor = E lógico, só vínculo ativo | interseção de `id_contrato`, `dt_fim IS NULL` | `visao-gerencial.ts:261-275` — **comportamento correto no código**, mas a única asserção de "E lógico" (`visao-gerencial.test.ts:330-351`) usa o **mesmo mock de dado pros dois lados** (Gestora e Mentor retornam os mesmos `[201,202]`) — interseção e união dão o mesmo resultado nesse teste. Confirmado empiricamente pelo sensor de discriminação (Mutação A, abaixo): flipar interseção→união **sobrevive** aos 50 testes unitários dos dois arquivos. | ⚠️ PASS (comportamento) / ❌ teste não discrimina |
| GER-06: Bloco 0 sempre acima de indicador de mandato | ordem visual fixa | `page.tsx:70-104` — `<BarraRecorte/>` → `SaudeOperacaoBloco` → `DistribuicaoEtapasBloco` → `IndicadoresBloco` → link Kanban → `GargalosBloco` | ✅ PASS |
| GER-07: G3 mostra (a) % herói (b) contagem absoluta (c) contagem etapas concluídas sem registro (d) linha mensal no range do Período | 4 elementos, (d) reagindo ao filtro Período | `saude-operacao-bloco.tsx:42-77` — (a)/(b)/(d) presentes; **(c)** só aparece quando `qtdEtapasSemRegistro > 0` (linha 56, `... ? \`· ${qtdEtapasSemRegistro} etapa(s)...\` : ""`) — spec diz "SHALL mostrar", não "mostrar quando >0"; **(d) nunca reage ao filtro Período** — ver GAP-1 abaixo | ⚠️ Spec-precision gap (c) / ❌ GAP (d) |
| GER-08: G4 mostra (a) barras por taxa (b) contagem >30d (c) linha mensal no range do Período | 3 elementos, (c) reagindo ao Período | `saude-operacao-bloco.tsx:98-133` — (a)/(b) OK; **(c) nunca reage ao filtro Período** — GAP-1 | ❌ GAP (c) |
| GER-09: G1/G2 consomem filtro global, sem seletor próprio contraditório | nenhum `Select` de produto/Gestora independente | `carteira-ponderada-card.tsx`/`ciclo-etapa-card.tsx` — grep confirma zero `Select` de produto/Gestora; `papel` (Gestora/Mentor) é modo de exibição, não recorte (documentado em `context.md`) | ✅ PASS |

### P2: Bloco 1 + Bloco 2 completo

| Criterion | Spec-defined outcome | `file:line` + evidência | Result |
| --- | --- | --- | --- |
| GER-10: barras por etapa, ordem `ref_etapa.ordem`, segmento de atrasados destacado/rotulado dentro da barra | ordenação fixa + segmento **dentro** da barra | `distribuicao-etapas-interativo.tsx:30-35` — ordenação confirmada (`ordenarPorValor={false}`); segmento **NÃO é uma barra empilhada** (`ChartBarraHorizontal` só aceita 1 valor/item) — a barra inteira muda de cor e o rótulo declara a contagem em texto. **SPEC_DEVIATION documentada no próprio código** (linhas 23-29) | ❌ GAP (documentado) |
| GER-11: modal com lista de contratos da etapa, cada um linkando pro Kanban do produto | link → `/produtos/{slug}/dashboard` | `etapa-contratos-modal.tsx:51-57` — link vai pra `/contratos/${idContrato}` (ficha do contrato), não o Kanban. **SPEC_DEVIATION documentada no código** (linhas 20-26) | ❌ GAP (documentado) |
| GER-12: G1 evolução mensal por Gestora, máx 8+Outras, de `fat_etapa_contrato`, no range do Período | linha com cap 8+Outras, reagindo ao Período | `visao-gerencial.ts:519-573` `buscarCarteiraPonderadaMensal` — cap 8+Outras confirmado (`visao-gerencial-g3-g6.test.ts:228-249`); **nunca reage ao filtro Período** — GAP-1 | ❌ GAP (Período) |
| GER-13: G2 evolução, small multiples de mediana mensal por etapa, no range do Período | 1 mini-gráfico por etapa, reagindo ao Período | `ciclo-etapa-card.tsx:69-89`; `buscarCicloEtapaMensal` testado (`visao-gerencial-g3-g6.test.ts:566-614`); **nunca reage ao filtro Período** — GAP-1 | ❌ GAP (Período) |
| GER-14: G5 % atingimento por produto/projeto + contagem SM não atualizados no mês | 2 agregações + contagem | `visao-gerencial.ts:687-750` `buscarAtingimentoPorRecorte`; testado (`visao-gerencial-g3-g6.test.ts:334-395`) | ✅ PASS |
| GER-15: evolução G5 = placeholder explícito "aguardando fechamento mensal (OUT-06)" | nunca gráfico vazio silencioso | `g5-atingimento-card.tsx:70-73` — `EstadoVazio titulo="Evolução mensal aguardando fechamento mensal (OUT-06)"` | ✅ PASS |
| GER-16: `atingimento_desatualizado` sinalizado à parte, agregado nunca "fresco" | contagem separada + aviso | `g5-atingimento-card.tsx:42-50` `Alert` condicional; `buscarAtingimentoPorRecorte` retorna `qtdDesatualizados` separado de `porProduto`/`porProjeto` | ✅ PASS |
| GER-17: G6 barras pelos 5 campos fixos, contagem sempre presente | 5 campos, mesmo com 0 | `visao-gerencial.ts:760-784` `CAMPOS_CADASTRO` fixo, `.map` garante os 5 sempre; testado (`visao-gerencial-g3-g6.test.ts:401-427`) | ✅ PASS |
| GER-18: IIP distribuição por nível + valor "provisório" (D2) + timestamp do último refresh | rótulo provisório + timestamp visível | `iip-consolidado-card.tsx:37-53` — rótulo presente; timestamp é **proxy** (`MAX(dt_ultimo_fato)`, não o `REFRESH` real) — documentado honestamente no comentário de `buscarIipConsolidado` (`visao-gerencial.ts:819-824`) | ⚠️ Spec-precision gap (documentado) |

### P3: Bloco 3 — Gargalos

| Criterion | Spec-defined outcome | `file:line` + evidência | Result |
| --- | --- | --- | --- |
| GER-19: tabela única, 6 categorias exatas, colunas mandato/categoria/detalhe/dt_referencia/dias_em_aberto/Gestora, ordenação padrão dias_em_aberto desc | 6 categorias fechadas, ordenação fixa | `gargalos-tabela.tsx:82-95` (colunas); `visao-gerencial.ts:922-928` `.order("dias_em_aberto", {ascending:false})`; migração `20260814162237_visao_gerencial_vw_pendencias.sql` (6 `UNION ALL`), 13 testes de integração cobrindo as 6 categorias positivo/negativo | ✅ PASS |
| GER-20: agrupar por categoria/Gestora → accordion colapsável, ordenação mantida dentro da seção | seções `<details>`, ordem preservada | `gargalos-tabela.tsx:139-182` — `reduce` preserva a ordem original (já `desc` vinda do backend) dentro de cada grupo | ✅ PASS |
| GER-21: clicar linha navega pra origem, nunca modal, nunca resolver/ignorar | navegação direta, sem CRUD | `gargalos-tabela.tsx:30-46,55-80` `destinoPendencia` + `router.push`; grep confirma zero termo "resolver"/"ignorar" no componente | ✅ PASS |
| GER-22: recorte sem pendência → estado vazio distinto de erro | `EstadoVazio` ≠ `ErroInline` | `gargalos-tabela.tsx:135-137` (`EstadoVazio` quando `linhas.length===0`) vs `gargalos-bloco.tsx:17-28` (`ErroInline` só no `catch`) — componentes distintos | ✅ PASS |

**Status**: ❌ Gaps presentes — 1 gap Blocker (Período não afeta nenhum gráfico de evolução,
GER-07/08/12/13 + Edge Case 5), 2 gaps Minor documentados como `SPEC_DEVIATION` no próprio
código (GER-10, GER-11), 2 spec-precision gaps Minor documentados (GER-07c, GER-18).

---

## Discrimination Sensor

Sensor rodado em cópia real do arquivo (`git checkout -- <file>` depois de cada mutação —
`git status` confirmado limpo antes/depois de cada uma; nunca `git worktree`/`stash` porque a
árvore de trabalho já estava limpa no início da sessão, tornando edit-then-checkout seguro e
mais rápido). Todas as 3 mutações foram descartadas ao final; `git status` final = limpo.

| # | File:line | Mutação | Teste rodado | Resultado |
| --- | --- | --- | --- | --- |
| A | `src/backend/queries/visao-gerencial.ts:249` (`resolverIdsContratoDoRecorte`) | `interseccionar`: interseção → **união** (`new Set([...ids, ...novos])` em vez de `.filter(id => novos.has(id))`) — ataca diretamente a regra GER-05 ("E lógico Gestora+Mentor") | `visao-gerencial.test.ts` + `visao-gerencial-g3-g6.test.ts` (50 testes) | ❌ **SOBREVIVEU** — 50/50 passaram mesmo com E lógico virando OU lógico. Causa raiz: o único teste de "E lógico" (`visao-gerencial.test.ts:330-351`) usa o **mesmo dataset mockado** pra Gestora e Mentor, então interseção e união produzem o mesmo `Set` — o teste nunca poderia detectar essa classe de bug |
| B | `src/backend/queries/visao-gerencial.ts:395` (`buscarSaudeCobertura`) | `pctCobertura`: `(qtdAtivos - qtdSemRegistro) / qtdAtivos` → `qtdAtivos / qtdAtivos` (sempre 100% quando há ativos, ignora `qtdSemRegistro`) — ataca o cálculo numérico de G3 | `visao-gerencial-g3-g6.test.ts` (31 testes) | ✅ **Morto** — `buscarSaudeCobertura > calcula pctCobertura...` falhou (`expected 100 to be 75`) |
| C | `src/backend/queries/visao-gerencial.ts:932` (`buscarPendencias`) | Off-by-one em `.range()`: `fim = inicio + tamanhoPagina - 1` → `inicio + tamanhoPagina` (busca 1 linha a mais por página, quebra a garantia de paginação de GER-19/T17 "nunca traz a tabela inteira") | `visao-gerencial-g3-g6.test.ts` (31 testes) | ❌ **SOBREVIVEU** — 31/31 passaram. Causa raiz: o mock de `criarClienteMock` (`visao-gerencial-g3-g6.test.ts:32-52`) tem `range: () => builder` — **os argumentos passados a `.range()` nunca são capturados nem asserted**, só a resposta mockada (fixa, independente do range) é checada. Nenhum teste hoje provaria uma regressão de paginação |

**Sensor depth**: lightweight (3 mutações direcionadas ao código novo de maior risco desta feature).
**Result**: 1/3 killed, **2/3 sobreviveram** — ❌ FAIL nesta dimensão. Ambos os sobreviventes
são gaps reais de teste (não bugs de comportamento — o código em produção está correto nos
dois casos, verificado por leitura), mas a suíte não protege contra regressão futura nesses
dois pontos de alto risco (E lógico de filtro + paginação "nunca a tabela inteira").

---

## Interactive UAT Results

Não realizado nesta sessão — feature ainda não testada manualmente no navegador pelo Verifier
(escopo desta validação foi checagem estática + gates automatizados + sensor). Recomendado como
próximo passo, dado que a própria feature já registrou 2 achados reais que só apareceram em UAT
manual (`tasks.md`, "Progresso -- Phase 4").

---

## Achados de runtime já tratados (confirmados nesta sessão, código atual)

Os dois achados de runtime críticos registrados em `tasks.md` (linhas 29-37, Phase 4) foram
reauditados com ceticismo (não assumidos do texto do `tasks.md`) e confirmados corretos no
código atual:

1. **Função como prop quebrando o boundary Server→Client**: `ChartLinhaEvolucao`/
   `ChartBarraHorizontal` (`chart-linha-evolucao.tsx:32-57`, `chart-barra-horizontal.tsx:22-34`)
   recebem `unidade?: "pct"|"dias"|"numero"` (discriminador serializável) em vez de uma função
   `formatarValor`, com comentário explícito no código citando o achado original. Confirmado: os
   dois componentes formatam o valor internamente a partir do discriminador, nenhum Server
   Component (`saude-operacao-bloco.tsx`, `g5-atingimento-card.tsx`, etc.) passa função como prop
   pra eles.
2. **`TableRow` sem suporte a `asChild`**: `gargalos-tabela.tsx:55-80` (`LinhaTabela`) usa
   `onClick`/`onKeyDown` (Enter/Espaço) + `tabIndex={0}` + `role="link"` no próprio `<tr>`, com
   comentário explícito no código (linhas 51-54) confirmando que `<Link>` como filho de `<tr>`
   seria HTML inválido. Confirmado: nenhum `<Link>` aninhado em `<TableRow>` em nenhum componente
   desta feature.

Ambos corretamente tratados — não geram lesson nova por si só (já documentados no código com
comentário explícito), mas o padrão geral ("prop serializável, não função, cruzando o boundary
Server→Client") é destilado como lição abaixo por não ter equivalente já confirmado no
`lessons.json`.

---

## Code Quality

| Principle | Status | Notas |
| --- | --- | --- |
| Minimum code | ✅ | Sem abstração órfã; `ChartLinhaEvolucao`/`ChartBarraHorizontal` reusados 7+ vezes, justifica a generalização |
| Surgical changes | ✅ | Nenhuma mudança em código não relacionado encontrada nos arquivos revisados |
| No scope creep | ✅ | `distribuicao-etapas-interativo.tsx` (não nomeado no `design.md`) é um split legítimo Client/Server do próprio T24 (função como prop não pode vir de Server pra Client — mesmo achado de T23), não escopo extra |
| Matches patterns | ✅ | Backbone pattern (`ref_etapa`/`dim_usuario`), agregação em TS (nunca SQL), `security_invoker=true`, re-GRANT `ALL TABLES` (AD-025) — todos consistentes com o resto do repo |
| Spec-anchored outcome check | ⚠️ | Ver tabela de ACs acima — 2 `SPEC_DEVIATION` documentadas (GER-10, GER-11), 1 gap não documentado nem coberto por task (Período, GER-07/08/12/13) |
| Per-layer Coverage Expectation | ✅ | Views: 1 teste de integração por comportamento essencial; queries: 1:1 com Done-when de cada task; frontend: build+lint (piso já aceito pelo projeto, `L-006`/`L-007`) |
| Every test maps to a spec requirement | ✅ | Nenhum teste "solto" encontrado — todos os arquivos novos citam `Spec anchor` no cabeçalho |
| Documented guidelines followed | ✅ | `CLAUDE.md` (migrations via `supabase migration new`, nunca SQL Editor), `docs/schema_sistema.sql` como fonte (AD-008), AD-004 (`TODO(limiares)`), AD-005 (NULL explícito) |

**Achado menor de qualidade (não bloqueante)**: `COMMENT ON VIEW vw_resposta_formulario`
(`supabase/migrations/20260814210823_visao_gerencial_vw_resposta_formulario.sql:41-42`) descreve
`respondido` como "existe `fat_submissao` finalizada (`enviada_em` preenchido) **posterior à
abertura**" — mas o `SELECT`/`EXISTS` real (linhas 32-36) não filtra por data nem por
`enviada_em IS NOT NULL` (o achado documentado no cabeçalho do arquivo, linhas 16-20, já
explica corretamente que `enviada_em` é sempre preenchido — o comentário do `COMMENT ON VIEW`
ficou desatualizado em relação ao cabeçalho do próprio arquivo). Não afeta comportamento; só a
documentação SQL introspectável (`\d+ vw_resposta_formulario` no psql) fica imprecisa.

---

## Edge Cases

- [x] 1. Indicador sem amostra → "—"/`null`, nunca `0` (AD-005) — confirmado em G2 (`mediana: null`), G3 (`pctCobertura: null`), G4 (`taxaResposta`/`taxaMedia: null`), IIP (`valorMedio: null`); testado em `visao-gerencial-g3-g6.test.ts`
- [x] 2. Contrato de Coalizão nunca gera linha `cadastro` — `vw-pendencias.integration.test.ts:200-205` (teste direto)
- [x] 3. >8 Gestoras → série "Outras", nunca 9+ cores — `visao-gerencial-g3-g6.test.ts:228-249` + `paleta-serie.ts` (8 slots fixos)
- [ ] 4. `mv_iip_contrato` desatualizada → timestamp de refresh visível — **parcial**: timestamp mostrado é um proxy (`MAX(dt_ultimo_fato)`), não o timestamp real do `REFRESH MATERIALIZED VIEW` (Postgres não expõe isso — limitação de plataforma, documentada honestamente no código, não uma omissão)
- [ ] 5. Filtro Período afeta só os gráficos de evolução — **NÃO implementado**: o filtro não afeta absolutamente nada, nem os gráficos de evolução (ver GAP-1)
- [x] 6. Bloco falha → outros 3 continuam — cada bloco/card tem seu próprio `try/catch` + `ErroInline` local (`saude-operacao-bloco.tsx`, `distribuicao-etapas-bloco.tsx`, `g5/g6/iip-*-card.tsx`, `gargalos-bloco.tsx`); G1/G2 usam `isError` do `useQuery` client-side, isolado por componente
- [x] 7. Gestora/Admin sem contrato no escopo RLS → cada bloco mostra estado vazio próprio, nunca omitido — confirmado em todos os 7 blocos/cards revisados (`EstadoVazio` ou renderização com zeros reais, nunca ausência de bloco)

**5 de 7 edge cases confirmados; 1 edge case (Período) genuinamente não implementado; 1 edge case (timestamp de refresh) parcialmente satisfeito por limitação documentada de plataforma.**

---

## Gate Check

- **Gate command**: `npm run test:unit` (raiz) + `npm run test:integration -- visao-gerencial` + `npm run build` + `npm run lint:all`
- **`npm run test:unit`**: ✅ 443 passed, 0 failed, 38 arquivos de teste (inclui os 2 desta feature: `visao-gerencial-g3-g6.test.ts` 31 testes, `usuario.test.ts` 6 testes, mais os 19 de `visao-gerencial.test.ts` já existentes/estendidos)
- **`npm run test:integration -- visao-gerencial`**: ✅ 57 passed, 0 failed, 13 arquivos (o filtro por substring pegou tanto os testes novos de `visao-gerencial-g3-g6` quanto os pré-existentes de `visao-gerencial-g1-g2`, ambos no mesmo diretório `supabase/tests/visao-gerencial/`) — duração real 716.72s (bate na banco de dev compartilhado, sem Docker local)
- **`npm run build`**: ✅ exit 0, Next.js 16.2.12/Turbopack, 17 rotas geradas incluindo `/visao-gerencial` (dinâmica)
- **`npm run lint:all`**: ❌ exit 1 no total, mas **30 problemas (15 erros + 15 warnings), todos em arquivos fora do escopo desta feature** (`app/(app)/contratos/page.tsx`, `mandatos/*`, `usuarios/page.tsx`, `components/fundacao/*`, `components/incidencia/*`) — confirmado via grep, zero ocorrência de qualquer arquivo `visao-gerencial`/`nao-autorizado`/`chart-*`/`usuario.ts` na saída do lint. Bate na baseline conhecida (~27-30) descrita no prompt do orquestrador — **arquivos desta feature estão limpos**
- **Test count before feature**: não medido diretamente nesta sessão (não há snapshot do estado antes da feature) — `tasks.md` registra 438/438 no fim da Fase 3 (backend completo); esta sessão mediu 443/443 no estado final (+5, plausivelmente frontend não adicionou teste novo no período entre Fase 3 e T30, unit test count não deveria ter mudado além de eventuais ajustes — não investigado a fundo, não bloqueante)
- **Test count after feature**: 443 unit + 57 integration (escopo do filtro) passaram
- **Skipped tests**: nenhum
- **Failures**: nenhuma nos 4 comandos de gate (lint tem problemas, mas nenhum atribuível a esta feature)

---

## Fix Plans

### Fix 1 (Blocker): Filtro "Período" não afeta nenhum gráfico de evolução

- **Root cause**: `FiltroRecorte.mesesEvolucao` é parseado da URL em `page.tsx:38` e existe no
  tipo compartilhado (`visao-gerencial.ts:17`), mas **nenhuma função de query nem componente de
  gráfico jamais lê esse campo** (`grep -rn "mesesEvolucao" src/frontend/components/visao-gerencial`
  = zero resultados). As 4 funções que retornam série mensal
  (`buscarSaudeCobertura`/`buscarSaudeFormularios`/`buscarCarteiraPonderadaMensal`/
  `buscarCicloEtapaMensal`) sempre devolvem os 12 meses fixos da view subjacente, e nenhum card
  (`saude-operacao-bloco.tsx`, `carteira-ponderada-card.tsx`, `ciclo-etapa-card.tsx`) faz
  `.slice()` do array de pontos antes de passar pro `ChartLinhaEvolucao`. O Select "Período
  (evolução)" da `BarraRecorte` (3/6/12 meses) escreve na URL normalmente, mas o valor nunca
  chega a nenhum gráfico — sem efeito visível nenhum, em nenhum dos 4 indicadores que a spec
  associa a ele (GER-07d, GER-08c, GER-12, GER-13) nem no Edge Case 5 (`spec.md` linha 202-203).
  `tasks.md` nunca decompôs esse comportamento em nenhuma task/Done-when — a lacuna nasceu no
  planejamento (Tasks), não foi introduzida por um bug de Execute.
- **Fix task**: nas 4 funções de query (ou nos 4 componentes consumidores), aplicar
  `pontos.slice(-filtro.mesesEvolucao ?? -12)` (ou equivalente) antes de montar a `series`/
  `evolucaoMensal` exibida — o filtro deve cortar os últimos N meses do array de 12 já
  retornado pela view (não reprocessar a view, conforme já decidido em `design.md`). Adicionar
  teste unitário cobrindo "com `mesesEvolucao: 3`, `evolucaoMensal` tem no máximo 3 pontos" em
  cada uma das 4 funções.
- **Priority**: Blocker — 4 ACs nomeados (GER-07, GER-08, GER-12, GER-13) e 1 Edge Case
  explícito do `spec.md` descrevem um comportamento que hoje não existe; o Select da barra
  também fica enganoso (oferece 3 opções que não fazem nada visível).

### Fix 2 (Minor, documentado): segmento de atraso não é um segmento real dentro da barra (GER-10)

- **Root cause**: `ChartBarraHorizontal` (T21) só aceita 1 valor por item — não suporta barra
  empilhada. `distribuicao-etapas-interativo.tsx:23-29` documenta a decisão de mitigar
  recolorindo a barra inteira + rótulo textual com a contagem, em vez do "segmento... dentro de
  cada barra" que a spec pede literalmente.
- **Fix task**: se o Pedro confirmar que o "segmento dentro da barra" é literal (não apenas a
  intenção de "atraso deve ser visualmente distinguível, nunca só cor"), estender
  `ChartBarraHorizontal` pra aceitar 2 séries empilhadas (Recharts `<Bar stackId>`), ou criar um
  wrapper novo só pra este caso.
- **Priority**: Minor — mitigação já documentada como `SPEC_DEVIATION` no código, a regra que a
  AC protege (atraso nunca comunicado só por cor) é respeitada.

### Fix 3 (Minor, documentado): modal do Bloco 1 linka pra ficha do contrato, não pro Kanban (GER-11)

- **Root cause**: `etapa-contratos-modal.tsx:20-26` documenta a troca deliberada — resolver o
  slug do produto exigiria uma tabela nova só pra esse mapeamento; o destino escolhido
  (`/contratos/[id]`) é mais preciso (o contrato específico clicado).
- **Fix task**: se o Pedro quiser o link literal pro Kanban (`/produtos/{slug}/dashboard`),
  adicionar `slug` ao retorno de `buscarContratosPorEtapa` (via `ref_produto`/`PRODUTO_SLUGS`) e
  trocar o `href`.
- **Priority**: Minor — documentado, e o destino atual é navegável e correto (não quebra nada).

### Fix 4 (Minor): 2 mutantes sobreviventes no sensor de discriminação

- **Root cause**: (a) o único teste de "E lógico Gestora+Mentor"
  (`visao-gerencial.test.ts:330-351`) usa o mesmo dataset mockado pros dois lados, não
  discriminando E de OU; (b) o mock de `visao-gerencial-g3-g6.test.ts` nunca captura os
  argumentos passados a `.range()`, não discriminando um off-by-one de paginação.
- **Fix task**: (a) adicionar um teste com datasets DIFERENTES pra Gestora e Mentor (ex.: Gestora
  → `{201,202,203}`, Mentor → `{202,203,204}`) e assertar que o `.in("id_contrato", ...)` final é
  exatamente a interseção `{202,203}`, não a união `{201,202,203,204}`; (b) estender o mock de
  `visao-gerencial-g3-g6.test.ts` pra capturar `chamadas` (mesmo padrão já usado em
  `visao-gerencial.test.ts`) e adicionar uma asserção explícita de `range(inicio, fim)` com os
  valores esperados por página.
- **Priority**: Minor — nenhum bug de comportamento em produção (confirmado por leitura de
  código), mas a suíde não protegeria contra uma regressão futura nesses 2 pontos.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| GER-01 | Implementing | ✅ Verified |
| GER-02 | Implementing | ✅ Verified |
| GER-03 | Implementing | ✅ Verified |
| GER-04 | Implementing | ✅ Verified |
| GER-05 | Implementing | ⚠️ Verified (comportamento correto, teste não discrimina — Fix 4) |
| GER-06 | Implementing | ✅ Verified |
| GER-07 | Implementing | ❌ Needs Fix (Período não afeta o gráfico — Fix 1; item (c) é spec-precision gap menor) |
| GER-08 | Implementing | ❌ Needs Fix (Período não afeta o gráfico — Fix 1) |
| GER-09 | Implementing | ✅ Verified |
| GER-10 | Implementing | ⚠️ Verified com SPEC_DEVIATION documentada (Fix 2) |
| GER-11 | Implementing | ⚠️ Verified com SPEC_DEVIATION documentada (Fix 3) |
| GER-12 | Implementing | ❌ Needs Fix (Período — Fix 1) |
| GER-13 | Implementing | ❌ Needs Fix (Período — Fix 1) |
| GER-14 | Implementing | ✅ Verified |
| GER-15 | Implementing | ✅ Verified |
| GER-16 | Implementing | ✅ Verified |
| GER-17 | Implementing | ✅ Verified |
| GER-18 | Implementing | ⚠️ Verified (timestamp é proxy documentado, não o refresh real) |
| GER-19 | Implementing | ✅ Verified |
| GER-20 | Implementing | ✅ Verified |
| GER-21 | Implementing | ✅ Verified |
| GER-22 | Implementing | ✅ Verified |

**16/22 Verified limpo, 4/22 Needs Fix (todos a mesma causa raiz, Fix 1), 2/22 Verified com
SPEC_DEVIATION documentada (não bloqueante).**

---

## Summary

**Overall**: ⚠️ Issues — não é um "Ready" limpo, mas também não é um retrabalho amplo: 1 causa
raiz (Fix 1) responde por 4 dos 6 GAPs de AC: o filtro "Período" da barra de recorte nunca foi
decomposto em task nenhuma durante a fase Tasks e por isso não existe em lugar nenhum do
código — nem nas 4 funções de query, nem nos gráficos que deveriam consumi-lo. Os outros 2 GAPs
de AC (GER-10, GER-11) são desvios documentados honestamente como `SPEC_DEVIATION` no próprio
código, com mitigação real da intenção da regra. O sensor de discriminação confirmou 2 pontos
de alto risco (E lógico de filtro, paginação) com comportamento correto em produção mas sem
teste que os protegeria de regressão futura.

**Spec-anchored check**: 16/22 ACs batem exatamente o outcome do spec; 4/22 têm gap real
(mesma causa raiz); 2/22 têm SPEC_DEVIATION documentada.
**Sensor**: 1/3 mutações mortas, 2/3 sobreviveram (gaps de teste, não de comportamento).
**Gate**: 3/4 comandos limpos (`test:unit`, `test:integration`, `build`); `lint:all` com 30
problemas pré-existentes, nenhum desta feature.

**What works**: gate de papel 403 real e server-side (primeiro do tipo no projeto); barra de
recorte completa com URL/chips/E lógico correto (ainda que sub-testado); Bloco 0 (G3+G4) sempre
acima de qualquer indicador; G1/G2 migrados pro filtro global com evolução mensal real; G5/G6/IIP
com placeholders explícitos e nunca silenciosos; Bloco 3 com as 6 categorias corretas, accordion,
navegação real, nunca CRUD de pendência; 6 views novas/alteradas todas `security_invoker=true`
com GRANT correto (mentor/assessor explicitamente sem acesso a `vw_pendencias`); 141+ testes
novos, zero regressão na suíte existente.

**Issues found**:
1. Filtro Período sem nenhum efeito — Fix 1 (Blocker).
2. Segmento de atraso não empilhado dentro da barra — Fix 2 (Minor, documentado).
3. Modal linka pra ficha do contrato, não pro Kanban — Fix 3 (Minor, documentado).
4. 2 mutantes sobreviventes (E lógico, paginação) — Fix 4 (Minor).
5. `COMMENT ON VIEW vw_resposta_formulario` desatualizado em relação ao código real — cosmético, corrigir na próxima migration que tocar essa view.

**Next steps**: implementar Fix 1 antes de considerar a feature "pronta" pro Pedro usar de
verdade (o Select "Período" hoje é enganoso). Fixes 2-4 podem esperar uma revisão/decisão do
Pedro sem bloquear uso da tela. Recomendado UAT manual real no navegador antes do merge pra
`master` (nenhuma verificação estática substitui isso, e esta feature já tem histórico de 2
achados reais que só apareceram testando ao vivo).
