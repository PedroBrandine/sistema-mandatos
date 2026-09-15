# KPI de situação dos mandatos ativos — Specification

## Problem Statement

O card "Mandatos em atraso" do Dashboard de Estratégia exibe um número grande
e três linhas de status (atrasado/atenção/normal) que **medem coisas
diferentes** e por isso nunca fecham: o número grande conta mandatos cujo
prazo **planejado original** venceu, e as três linhas contam a situação da
**etapa atual pelo tempo real decorrido** (migration `20260914161230`, que
documentou a divergência como deliberada). Em dev isso produz "12" ao lado de
"2 atrasados / 1 atenção / N normal" — um card que se contradiz sozinho.
Ao aplicar o filtro de gestora ou projeto, a quebra reage de forma incoerente
com o número grande e com o Quadro de Acompanhamento logo abaixo, na mesma
tela e sob o mesmo filtro.

A migration de 14/09 passou por gate completo (unit 25/25, integration 19/19,
lint, build) e mesmo assim entregou uma tela errada: **o gate testou a view em
isolamento, não o número que a operação lê**. Pedro validou no deploy de
`develop` (Vercel, contra o Supabase de dev) e reprovou.

Na mesma tela, os cards do Quadro de Acompanhamento **não abrem nada ao serem
clicados** (relatado por Pedro em 2026-09-15). O `KanbanCard` original é um
`<Link>` para `/contratos/[id]` — correção de UAT registrada no próprio
arquivo, que só funciona porque o `PointerSensor` usa
`activationConstraint: { distance: 8 }`. Quando `QuadroAcompanhamento`
substituiu o board no Dashboard (T18b), ele copiou o esqueleto de
drag-and-drop daquele componente e **não** copiou o link: o card virou uma
`div` arrastável sem destino. A regressão passou despercebida porque o
projeto não tem harness de teste de componente (o próprio fix de UAT já
registrava esse débito).

## Goals

- [ ] A faixa de KPIs deixa de ter duas definições concorrentes de atraso: uma
      só, medida pela etapa atual e pelo tempo real decorrido.
- [ ] O card de situação **fecha aritmeticamente**: as linhas de status somam
      exatamente o número grande, sob qualquer filtro.
- [ ] O KPI concorda com o Quadro de Acompanhamento da mesma tela sob o mesmo
      filtro — mesma classificação, mesmos mandatos.
- [ ] O critério de pronto passa a incluir conferência na tela renderizada,
      não apenas o gate sobre a view.
- [ ] O card do Quadro volta a abrir o mandato ao ser clicado, sem perder o
      arraste.

## Out of Scope

| Item | Razão |
| --- | --- |
| Segmentação do NPS (promotor/neutro/detrator, nº de avaliações) | Gap conhecido da mesma faixa (gaps 6/7 de `redesenho-estrategia-tela-first`), mas independente deste card. `mv_avaliacao_nps` tem 0 linhas em dev — não é exercitável agora. |
| Remover a coluna `mandatos_em_atraso` do banco | `CREATE OR REPLACE VIEW` não remove coluna; `DROP + CREATE` derrubaria a ACL de `vw_estrategia_kpi`. A coluna fica órfã no banco e sai só do TS e da tela. |
| Reancorar `dt_prevista_conclusao` quando o contrato muda de etapa | Causa raiz real de parte da divergência (`app.mover_etapa_kanban` nunca recalcula a data-alvo), mas mexe no writer do Kanban e afeta outras telas. Fica registrado como achado. |
| Mudar os percentuais de `ref_limiar_pendencia` | AD-004: limiar é dado, não código. Calibrar valor é operação, não esta feature. |
| Redesenho visual da faixa no Figma | O node `86:44` já define o layout "número grande + linhas de status"; esta feature move esse layout de card, não redesenha. |

---

## Assumptions & Open Questions

| Assumption / decisão | Escolha | Racional | Confirmado? |
| --- | --- | --- | --- |
| Card "Mandatos em atraso" sai da faixa | Removido; a quebra por status passa para o card "Mandatos ativos" | Decisão do Pedro (14/09). Resolve a contradição na origem: o número grande vira o universo (mandatos ativos) e as linhas o detalham. Reaproxima a tela do Figma `44:227`, que desenha 5 KPIs e nunca teve "Mandatos em atraso" | **y** |
| As linhas de status somam o número grande | Sim, sempre | Decisão do Pedro. É o que torna o card verificável a olho — a ausência desse fechamento é o defeito que originou esta spec | **y** |
| Mandato sem transição registrada (`id_etapa_atual` nulo) | Medido pela etapa de **ordem 1**, contando desde `fat_contrato.dt_inicio` | Decisão do Pedro. Alinha o KPI ao fallback que `buscarBoardKanban` já usa para posicionar o card, e faz um mandato parado na largada aparecer como atrasado — que é o fato real. **Reverte** a decisão "NÃO CLASSIFICÁVEL" da migration `20260914161230` | **y** |
| Base de dev recomposta | Sim, pré-requisito desta feature | Decisão do Pedro. Os dados atuais de dev são de teste e acumularam estados incoerentes (10 de 12 contratos nunca movidos), o que impede distinguir "KPI errado" de "dado sujo" na validação ao vivo | **y** |
| Etapa de referência sem `duracao_prevista_dias` | O mandato fica **fora** das linhas de status e o fechamento não vale para ele; um teste de guarda detecta a ocorrência | `ref_etapa.duracao_prevista_dias` é nullable (`ck_etapa_duracao`), mas **nenhuma** das etapas dos catálogos reais (Estratégia, PLL, Coalizão) está sem duração. Classificar sem duração seria inventar percentual sobre dado ausente (AD-005). Caso teórico hoje, mas a spec não pode fingir que é impossível | n — default adotado |
| `mandatos_em_atraso` no tipo `EstrategiaKpi` | Removido do tipo, do `select` e da UI; coluna permanece no banco | Sem nenhum consumidor fora da faixa de KPIs (verificado por varredura). Manter no TS um campo que nada lê é convidar a reintroduzir a segunda definição de atraso | n — default adotado |
| Rótulos das linhas | "atrasados", "atenção", "normal" — como hoje | Mesmo vocabulário e mesmas cores de estado já em tela no Quadro de Acompanhamento (`quadro-acompanhamento.tsx`). **Nota**: o glossário de `figma-dominio-legisla` não cobre esses três termos; vale acrescentá-los lá | n — default adotado |
| Rótulo do card | "Mandatos ativos", inalterado | Já é o rótulo do card que recebe a quebra e descreve corretamente o número grande | n — default adotado |
| "Tela Kanban" do relato = Quadro de Acompanhamento | O conserto do clique é feito no `QuadroAcompanhamento` (Dashboard) | `KanbanBoard` não é importado por nenhuma rota — varredura de `src/frontend/app` não achou nenhum consumidor. A única superfície de kanban viva é o Quadro | **y** — verificado no código |
| Destino do clique | `/contratos/[idContrato]` | Mesmo destino do `KanbanCard` original, rota existente, e `idContrato` já está no card do Quadro — nenhum identificador novo precisa ser carregado pela query (evita a substituição silenciosa de destino da lição L-031) | n — default adotado |
| `KanbanBoard`/`KanbanColuna`/`KanbanCard` órfãos | Ficam como estão | Remover código morto é limpeza de valor real, mas independente: misturá-la aqui aumenta o diff de uma correção que Pedro vai validar na tela. Registrado como achado | n — default adotado |

**Open questions:** nenhuma — tudo acima está resolvido com o Pedro ou
registrado como default adotado.

---

## User Stories

### P1: Card único de situação dos mandatos ⭐ MVP

**User Story**: Como gestora de carteira, quero um único card que mostre
quantos mandatos estão ativos e em que situação de prazo eles estão, para
saber onde agir sem ter que conciliar dois números que não batem.

**Why P1**: É a correção em si. Enquanto existirem duas definições de atraso
na mesma faixa, qualquer número exibido é indefensável diante da operação.

**Acceptance Criteria**:

1. WHEN o Dashboard de Estratégia é renderizado THEN a faixa de KPIs SHALL
   exibir 5 cards e SHALL NOT conter nenhum card rotulado "Mandatos em
   atraso".
2. WHEN o card "Mandatos ativos" é renderizado com dado disponível THEN ele
   SHALL exibir o total de mandatos ativos como número grande e três linhas
   de status — atrasados, atenção, normal — cada uma com sua contagem.
3. WHEN os três valores de status e o total estão todos disponíveis THEN a
   soma das três contagens SHALL ser exatamente igual ao número grande.
4. WHEN um mandato ativo não tem transição de etapa registrada
   (`id_etapa_atual` nulo) THEN ele SHALL ser classificado pela etapa de
   ordem 1 do seu produto, medindo os dias decorridos desde
   `fat_contrato.dt_inicio` contra a `duracao_prevista_dias` dessa etapa.
5. WHEN o limiar `etapa_atrasado` ou `etapa_atencao` está inativo em
   `ref_limiar_pendencia` THEN a linha correspondente SHALL exibir "—", e os
   mandatos que ela conteria SHALL cair em "normal", de modo que as linhas
   com valor continuem somando o número grande.
6. WHEN o recorte selecionado não produz nenhuma linha na view THEN todas as
   contagens SHALL exibir "—" e nenhuma SHALL exibir 0 (AD-005).

**Independent Test**: abrir o Dashboard sem filtro e conferir que
`atrasados + atenção + normal` é igual ao número grande de "Mandatos ativos",
e que nenhum card "Mandatos em atraso" existe na faixa.

---

### P1-B: Card do Quadro abre o mandato ⭐ MVP

**User Story**: Como gestora, quero clicar num card do Quadro e cair na ficha
daquele mandato, para ir do panorama ao caso sem procurar o nome numa lista.

**Why P1**: é uma regressão, não funcionalidade nova — o comportamento
existia no `KanbanCard` e se perdeu na substituição pelo Quadro. Sem ele, o
Quadro é um painel de leitura do qual não se sai.

**Acceptance Criteria**:

1. WHEN o usuário clica num card do Quadro de Acompanhamento THEN o sistema
   SHALL navegar para `/contratos/[idContrato]` daquele card.
2. WHEN o usuário arrasta um card por mais de 8px e solta THEN o sistema
   SHALL executar a transição de etapa e SHALL NOT navegar.
3. WHEN o usuário navega por teclado THEN cada card SHALL ser alcançável por
   `Tab` e ativável por `Enter`, com indicador de foco visível.
4. WHEN o card é de um contrato não ativo THEN ele SHALL continuar clicável —
   nenhum estado de contrato remove o destino.

**Independent Test**: clicar num card do Quadro e chegar na ficha do mandato;
arrastar o mesmo card para outra coluna e confirmar que a etapa muda sem
navegar.

---

### P2: Recorte por gestora e projeto coerente

**User Story**: Como gestora, quero filtrar o Dashboard pela minha carteira e
ver a situação **da minha carteira**, para confiar no número antes de levá-lo
para uma reunião.

**Why P2**: O card pode fechar sem filtro e mentir sob recorte — foi
exatamente o segundo sintoma relatado. Separado do P1 porque só é testável
com o P1 pronto.

**Acceptance Criteria**:

1. WHEN um filtro de gestora e/ou projeto é aplicado THEN as três contagens
   de status e o número grande SHALL refletir apenas os mandatos daquele
   recorte, e a soma SHALL continuar igual ao número grande.
2. WHEN um filtro é aplicado THEN nenhum valor do card SHALL ser maior que o
   valor correspondente sem filtro.
3. WHEN o mesmo filtro está aplicado THEN a contagem de cada status no card
   SHALL ser igual ao número de cards do Quadro de Acompanhamento marcados
   com aquele mesmo estado, incluindo os mandatos posicionados na coluna de
   ordem 1 por fallback.
4. WHEN o filtro é alterado THEN os valores exibidos SHALL corresponder ao
   novo recorte sem exigir recarga da página.

**Independent Test**: aplicar um filtro de gestora com carteira conhecida,
conferir que a soma fecha, que cada contagem bate com os chips de estado do
Quadro logo abaixo, e que nenhum valor cresceu em relação à visão sem filtro.

---

### P3: Base de dev recomposta (pré-requisito)

**User Story**: Como quem valida a tela, quero dados de teste coerentes em
dev, para conseguir distinguir um KPI errado de um dado sujo.

**Why P3 e mesmo assim pré-requisito**: não entrega valor à operação, mas
nenhuma validação ao vivo é conclusiva sem ele — com 10 de 12 contratos em
estados que não representam a operação, qualquer número é defensável e
nenhum é verificável. Executa **antes** do P1 na ordem de tasks.

**Acceptance Criteria**:

1. WHEN os dados de teste de dev são recompostos THEN o conjunto resultante
   SHALL conter pelo menos um mandato ativo em cada um dos três estados
   (atrasado, atenção, normal), pelo menos um sem transição registrada e pelo
   menos um contrato não ativo.
2. WHEN a recomposição é executada THEN ela SHALL ocorrer exclusivamente
   contra o projeto Supabase de **dev**, com o `project-ref` conferido antes
   (`cat supabase/.temp/project-ref`, `docs/ambientes.md`).
3. WHEN a recomposição é executada THEN ela SHALL nascer de arquivo
   versionado (`supabase/seed_test.sql` ou seed dedicado), nunca de SQL
   rodado à mão no SQL Editor.

**Independent Test**: após o reset, consultar a view e confirmar que os três
estados, o caso "sem transição" e o contrato não ativo estão representados.

---

### P4: O pronto passa pela tela

**User Story**: Como Pedro, quero que "pronto" signifique conferido na tela
renderizada, para não descobrir na demo o que o gate não viu.

**Why P4**: é a causa raiz do retrabalho de 14/09 — gate verde, tela errada.
Barato de incluir, e sem isso a mesma falha se repete.

**Acceptance Criteria**:

1. WHEN a última task de implementação é concluída THEN a validação SHALL
   incluir a conferência dos números no Dashboard renderizado, sem filtro e
   com pelo menos um filtro de gestora e um de projeto, registrada em
   `validation.md` com os valores observados.
2. WHEN os valores da tela divergem dos valores lidos direto da view para o
   mesmo recorte THEN a feature SHALL ser reprovada, independentemente do
   resultado do gate automatizado.

**Independent Test**: `validation.md` contém os números observados na tela
por recorte, não apenas resultados de suíte.

---

## Edge Cases

- WHEN a etapa de referência de um mandato não tem `duracao_prevista_dias`
  THEN o mandato SHALL ficar fora das três linhas e um teste SHALL detectar a
  ocorrência — nunca classificado como "normal" (AD-005).
- WHEN o produto do contrato não tem nenhuma etapa cadastrada THEN não há
  etapa de ordem 1 para o fallback e o mandato SHALL ficar fora das linhas
  de status.
- WHEN um contrato está com `status` diferente de `ativo` THEN ele SHALL NOT
  entrar nem no número grande nem em nenhuma linha de status.
- WHEN um mandato tem mais de uma gestora ativa vinculada THEN ele SHALL ser
  contado uma única vez em cada recorte aplicável, sem multiplicação por
  vínculo.
- WHEN os dois limiares estão inativos THEN "atrasados" e "atenção" SHALL
  exibir "—" e "normal" SHALL igualar o número grande.
- WHEN a leitura da view falha THEN a faixa SHALL exibir o `ErroInline` com
  retry, sem derrubar o Quadro (comportamento atual, preservado).

---

## Requirement Traceability

| Requirement ID | Story | Fase | Status |
| --- | --- | --- | --- |
| KSM-01 | P1: remoção do card "Mandatos em atraso" | Design | Pending |
| KSM-02 | P1: número grande + 3 linhas de status | Design | Pending |
| KSM-03 | P1: fechamento aritmético da quebra | Design | Pending |
| KSM-04 | P1: fallback pela etapa de ordem 1 | Design | Pending |
| KSM-05 | P1: limiar inativo vira "—" sem quebrar o fechamento | Design | Pending |
| KSM-06 | P1: recorte sem linha vira "—", nunca 0 | Design | Pending |
| KSM-16 | P1-B: clique no card navega para a ficha do mandato | Design | Pending |
| KSM-17 | P1-B: arraste move a etapa e não navega | Design | Pending |
| KSM-18 | P1-B: card alcançável e ativável por teclado | Design | Pending |
| KSM-19 | P1-B: contrato não ativo continua clicável | Design | Pending |
| KSM-07 | P2: recorte por gestora/projeto reflete a carteira | Design | Pending |
| KSM-08 | P2: nenhum valor filtrado excede o valor sem filtro | Design | Pending |
| KSM-09 | P2: concordância com o Quadro de Acompanhamento | Design | Pending |
| KSM-10 | P2: troca de filtro atualiza sem recarga | Design | Pending |
| KSM-11 | P3: dados de dev cobrem os casos de classificação | - | Pending |
| KSM-12 | P3: recomposição só em dev, com ref conferido | - | Pending |
| KSM-13 | P3: recomposição a partir de arquivo versionado | - | Pending |
| KSM-14 | P4: validação registra números observados na tela | - | Pending |
| KSM-15 | P4: divergência tela × view reprova a feature | - | Pending |

**Cobertura:** 19 requisitos, 0 mapeados para tasks (Tasks ainda não rodou).

---

## Decisões de arquitetura propostas (a registrar em STATE.md após aceite)

- **AD-050** — A faixa de KPIs do Dashboard de Estratégia não tem card
  "Mandatos em atraso". A situação de prazo é quebra por status do card
  "Mandatos ativos", cujas linhas somam o número grande. Supersede o conjunto
  de 6 KPIs de EST-08 AC1 (`redesenho-estrategia-tela-first`), que nomeava
  "mandatos em atraso" como card próprio.
- **AD-051** — A classificação de prazo de um mandato sem transição de etapa
  registrada usa a etapa de ordem 1 como referência, medindo desde
  `fat_contrato.dt_inicio`. Alinha KPI e Kanban sob a mesma regra e reverte a
  decisão "NÃO CLASSIFICÁVEL" da migration `20260914161230`.

---

## Achados registrados (não resolvidos por esta feature)

- `app.mover_etapa_kanban` grava apenas `dt_inicio`/`dt_conclusao` reais e
  nunca reancora `dt_prevista_conclusao`. Um contrato que entra atrasado numa
  etapa carrega uma data-alvo que já não corresponde ao cronograma — origem
  de parte da divergência entre os dois métodos de atraso. Mexer nisso afeta
  o writer do Kanban e outras telas.
- A coluna `mandatos_em_atraso` fica órfã em `vw_estrategia_kpi` após esta
  feature: sem consumidor, mas impossível de remover sem `DROP VIEW`.
- `KanbanBoard`, `KanbanColuna` e `KanbanCard` (`components/kanban/`) são
  **código morto**: nenhuma rota os importa desde que o Quadro os substituiu
  no Dashboard (T18b). Continuam passando no lint e no build, e foi neles que
  a regressão do clique ficou escondida — o comportamento correto está vivo
  no arquivo que ninguém renderiza. Remover é trabalho à parte.
- Não há harness de teste de componente no projeto (lição L-006/L-007): a
  regressão do clique não tinha como ser pega pelo gate. Enquanto isso não
  mudar, todo AC de render/interação depende de conferência na tela (P4).
- O Quadro arrasta cards dentro de colunas com `h-[520px] overflow-y-auto` e
  container `overflow-x-auto`, sem `DragOverlay`. Não foi o que Pedro
  relatou, e o arraste funciona — mas é a configuração que costuma clipar o
  card arrastado no dnd-kit. Vale conferir junto na validação da P4.

---

## Success Criteria

- [ ] Pedro abre o Dashboard no deploy de `develop` e a soma das três linhas
      bate com o número grande, com e sem filtro.
- [ ] Cada contagem de status bate com os chips do Quadro de Acompanhamento
      sob o mesmo filtro.
- [ ] Nenhum card da faixa apresenta dois números que se contradizem.
- [ ] `validation.md` registra os números observados na tela, não só o
      resultado da suíte.
- [ ] Clicar num card do Quadro abre a ficha do mandato; arrastar continua
      movendo a etapa.
