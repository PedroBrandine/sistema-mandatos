# G1 + G2 — Primeira Fatia de Visão Gerencial Specification

## Problem Statement

Hoje nenhuma Gestora tem como ver, numa tela só, se sua carteira está desbalanceada ou onde o
processo trava — essas duas perguntas (Constituição §2.6) são G1 (carteira ponderada) e G2 (tempo
de ciclo). As duas dependem de etapa ser **fato datado**, não campo de status sobrescrito — só
passa a existir depois de `operacao-regua-instanciacao` + `kanban-etapas` gravarem transições
reais. Esta feature é a primeira tela onde uma Gestora **gerencia** a operação, não só cadastra
contrato.

## Goals

- [ ] G2 (tempo de ciclo): mediana do tempo gasto em cada etapa, cortável por etapa/mandato/
      Gestora/produto, calculada sobre `vw_etapa_contrato`.
- [ ] G1 (carteira ponderada): nº de contratos ativos por Gestora, ponderado pelo peso da etapa
      atual de cada um, mais o atingimento médio da carteira como indicador acessório.
- [ ] Tela mínima de visão gerencial: os dois indicadores + link pro Kanban — não a "visão
      gerencial" completa da Constituição (§2.6), que só fecha com G3-G6 depois de Incidência/
      Planejamento/Formulários (roadmap §6).
- [ ] `vw_carteira` provisionada na versão **reduzida**, sem IIP, conforme AD-032.

## Out of Scope

| Item | Reason |
| --- | --- |
| G3, G4, G5, G6 | Dependem de Incidência, Formulários e Planejamento completo (roadmap §6) — nenhuma tabela provisionada ainda. |
| IIP em `vw_carteira` | Bloqueado por `mv_iip_contrato` (Incidência, §6.2) — resolvido pela AD-032: view reduzida agora, substituída depois. |
| Evolução mês a mês de G1/G2 (série histórica) | A Constituição classifica G1/G2 como "Derivada" (reconstruível das datas de transição, sem snapshot) — mas a reconstrução temporal ("qual era a carteira ponderada em maio") é trabalho de agregação não-trivial, adiado desta fatia inicial. Entrega aqui é o **estado atual** dos dois indicadores. |
| Calendário (visão operacional citada na mesma seção da Constituição) | Depende de `fat_encontro` (Incidência/OPR-03), não provisionado. |
| Tela de edição do peso por etapa (`/admin/...`) | Mesma lógica da Trilha C (AD-004): a tabela editável existe, a UI de administração é conveniência e entra quando houver mais catálogo pra administrar. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| **Achado novo: G1 exige "peso por etapa configurável em tabela de referência" (Constituição §2.6) — essa tabela não existe em nenhum dos 16 catálogos já provisionados** | Criar `ref_peso_etapa` (`id_produto`, `id_etapa`, `peso`) nesta feature, seguindo o mesmo padrão GRANT-only da AD-030 (é catálogo, não tabela transacional) | Verificado: `ref_etapa` (`docs/schema_sistema.sql:170-181`) não tem coluna `peso`; nenhum dos outros 15 catálogos cobre isso. Diferente do bloqueio da AD-032 (que é uma dependência estrutural real — `CREATE VIEW` falha sem `mv_iip_contrato`), aqui não há nenhum impedimento técnico pra criar a tabela agora — é só um catálogo que faltou nascer na Trilha C | y |
| Valor inicial do peso, sem levantamento humano ainda feito | Todas as etapas nascem com peso = 1 (equivalente a contagem simples) até o Monitoramento decidir os pesos reais | Mesmo padrão já usado em `ref_agenda_tematica`/`ref_indicador`/`ref_tipologia` (CAT-16, "nascem vazias de propósito, levantamento humano sem data") — não inventar peso sem a área de conhecimento definir | y |
| Onde a agregação de G1 roda (view nova vs. query na camada de backend) | View nova (`vw_g1_carteira_ponderada` ou nome equivalente), somando `ref_peso_etapa.peso` por Gestora sobre `vw_carteira` filtrada a `status = 'ativo'` | Consistente com a regra da camada de Saída (§2.6): "nenhum indicador é consultado direto em tabela transacional — sempre via view" | y |
| Cálculo exato de G2 | `mediana(dt_conclusao - dt_inicio)` por etapa concluída, agrupável por etapa/produto/Gestora — equivalente a "entrada na etapa seguinte − entrada na etapa anterior" porque o Kanban (`kanban-etapas`) grava as duas datas no mesmo instante numa transição de avanço | Leitura literal da definição da Constituição (§2.6, G2) aplicada ao comportamento real do Kanban desta mesma onda | y |
| Contratos sem nenhuma etapa concluída ainda | Excluídos do cálculo de mediana daquela etapa (não contam como zero, não distorcem) | AD-005 — ausência de dado não é zero | y |
| "Atingimento médio da carteira" (acessório de G1) | `AVG(dim_planejamento.pct_atingimento)` por Gestora, ignorando `NULL` | Já é coluna existente em `vw_carteira`; cálculo direto, sem ambiguidade | y |
| Cortes de G1/G2 | Por Gestora e por Mentor (mesma leitura, papel diferente), por produto; G2 adicionalmente por etapa e por mandato | Literal da Constituição §2.6 | y |

**Open questions:** nenhuma. Todas as assumptions confirmadas por Pedro em 2026-08-12, incluindo a
criação de `ref_peso_etapa` (a mais importante — muda o escopo de migration desta feature além do
que o roadmap já previa) e o tratamento de `id_etapa_atual IS NULL`/lacuna de seed já escritos nas
Acceptance Criteria e Edge Cases abaixo.

---

## User Stories

### P1: G2 — tempo de ciclo por etapa ⭐ MVP

**User Story**: Como Gestora, quero ver a mediana de dias que os contratos passam em cada etapa,
cortada por produto e por Gestora, pra identificar onde o processo trava sistematicamente.

**Why P1**: É o indicador sem bloqueio estrutural — só depende do Kanban já estar gravando
transições, sem tabela nova.

**Acceptance Criteria**:

1. WHEN a tela de G2 carrega THEN o sistema SHALL mostrar a mediana de `dt_conclusao - dt_inicio`
   de `vw_etapa_contrato`, por etapa, considerando só linhas com `status = 'concluida'`.
2. WHEN o usuário filtra por produto ou por Gestora THEN o sistema SHALL recalcular a mediana
   restrita ao filtro, sem incluir etapas de outro produto/Gestora na mesma mediana.
3. WHEN uma etapa não tem nenhuma ocorrência `concluida` ainda THEN o sistema SHALL mostrar "sem
   dado suficiente" para aquela etapa — nunca zero nem uma mediana calculada sobre amostra vazia.

**Independent Test**: Com ao menos 2 contratos de teste tendo concluído a mesma etapa em datas
diferentes, confirmar que a mediana mostrada bate com o cálculo manual sobre `fat_etapa_contrato`.

---

### P1: G1 — carteira ponderada por Gestora ⭐ MVP

**User Story**: Como Gestora, quero ver quantos contratos ativos tenho, ponderados pelo peso da
etapa em que cada um está, pra identificar se minha carga está desbalanceada frente a outra
Gestora.

**Why P1**: É o indicador citado explicitamente pelo Pedro ao pedir esta fatia; exige a nova tabela
de peso (achado desta spec) antes de poder ser calculado de verdade.

**Acceptance Criteria**:

1. WHEN a tela de G1 carrega THEN o sistema SHALL mostrar, por Gestora, a soma de
   `ref_peso_etapa.peso` de todos os contratos `status = 'ativo'` cuja `id_etapa_atual` (via
   `fat_contrato`) corresponda àquele peso.
2. WHEN a mesma tela é vista com o corte "por Mentor" THEN o sistema SHALL mostrar a mesma soma
   ponderada, agrupada por Mentor em vez de Gestora.
3. WHEN a tela mostra a carteira de uma Gestora THEN o sistema SHALL mostrar também o atingimento
   médio da carteira (`AVG(pct_atingimento)`) como indicador acessório, separado da soma ponderada.
4. WHEN um contrato tem `id_etapa_atual IS NULL` (nenhuma transição de Kanban ainda) THEN o sistema
   SHALL contá-lo com o peso da 1ª etapa do produto (`ordem = 1`) — é onde ele está, mesmo sem
   transição registrada (mesma leitura de `kanban-etapas`, US "Board Kanban").

**Independent Test**: Com 2 Gestoras de teste tendo carteiras de tamanho igual mas etapas
diferentes (uma com contratos em etapa de peso alto, outra em etapa de peso baixo), confirmar que a
soma ponderada reflete a diferença mesmo com a mesma contagem simples de contratos.

---

### P1: `vw_carteira` reduzida (AD-032) ⭐ MVP

**User Story**: Como time técnico, precisamos que `vw_carteira` exista sem depender de
`mv_iip_contrato` (que só existirá na Incidência), pra não atrasar G1/G2 por uma coluna que ficaria
vazia de qualquer forma.

**Why P1**: É a decisão já registrada em AD-032 — pré-requisito técnico das outras duas stories.

**Acceptance Criteria**:

1. WHEN a migration desta feature cria `vw_carteira` THEN o sistema SHALL usar a definição de
   `docs/schema_sistema.sql:1327-1349` **sem** as colunas `iip_provisorio`/`nr_fatos` e sem o
   `LEFT JOIN mv_iip_contrato`.
2. WHEN a Incidência (feature futura, §6.2) criar `mv_iip_contrato` THEN a tarefa de substituição
   SHALL trocar esta view pela versão completa aprovada — não adicionar as colunas por cima
   (registrado como débito explícito, mesmo texto da AD-032).

**Independent Test**: `CREATE VIEW vw_carteira` roda sem erro numa base que não tem
`mv_iip_contrato`; consulta simples confirma as colunas esperadas (sem IIP).

---

### P2: Página mínima de Visão Gerencial

**User Story**: Como Gestora, quero uma única tela onde vejo G1, G2 e um link direto pro Kanban,
em vez de navegar por 3 lugares separados.

**Why P2**: É a montagem final — as duas stories anteriores já são demonstráveis isoladamente
(cada indicador testável por si).

**Acceptance Criteria**:

1. WHEN o usuário acessa a Visão Gerencial THEN o sistema SHALL mostrar G1 e G2 na mesma tela, cada
   um com seus próprios filtros.
2. WHEN o usuário clica no link pro Kanban a partir desta tela THEN o sistema SHALL navegar pro
   board do produto correspondente.
3. WHEN a tela carrega THEN o sistema SHALL indicar visualmente que G3-G6 "estão em desenvolvimento"
   — mesmo padrão de placeholder já usado na Trilha F, para não sugerir que a visão gerencial está
   completa.

**Independent Test**: Abrir a tela, ver os dois indicadores com dado real de teste, clicar no link
do Kanban e confirmar a navegação.

---

## Edge Cases

- WHEN uma Gestora não tem nenhum contrato ativo THEN G1 SHALL mostrar 0 (zero é uma contagem
  real, não ausência de dado — diferente do caso de mediana vazia em G2).
- WHEN dois contratos do mesmo Gestora estão na mesma etapa THEN o peso daquela etapa SHALL ser
  somado uma vez por contrato (não deduplicado) — carga é por contrato, não por etapa distinta.
- WHEN `ref_peso_etapa` não tem linha para uma combinação produto/etapa existente (lacuna de seed)
  THEN o sistema SHALL tratar como peso `NULL` e excluir aquele contrato da soma ponderada, nunca
  assumir peso 1 silenciosamente (isso escondera a lacuna de seed) — deve aparecer como alerta de
  dado incompleto, não como número errado sem explicação.
- WHEN o corte por produto e o corte por Gestora são aplicados juntos THEN o sistema SHALL
  restringir aos dois simultaneamente (AND).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| GG-01 | P1: `vw_carteira` reduzida (AD-032) | Design | Designed |
| GG-02 | P1: `ref_peso_etapa` — nova tabela de catálogo | Design | Designed |
| GG-03 | P1: G2 — mediana por etapa | Design | Designed |
| GG-04 | P1: G2 — cortes por produto/Gestora | Design | Designed |
| GG-05 | P1: G1 — soma ponderada por Gestora/Mentor | Design | Designed |
| GG-06 | P1: G1 — atingimento médio acessório | Design | Designed |
| GG-07 | P2: Página mínima — G1+G2+link Kanban | Design | Designed |

**ID format:** `GG-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 7 total, 0 mapped to tasks, 7 designed em `design.md` — próxima fase é Tasks.

---

## Success Criteria

- [ ] G1 e G2 mostram número real (não mockado) calculado sobre dado de teste gerado pelas duas
      features anteriores (régua + Kanban).
- [ ] `ref_peso_etapa` existe, seedada com peso 1 em todas as linhas, documentada como pendência de
      levantamento humano (mesmo padrão de CAT-16).
- [ ] `vw_carteira` reduzida existe e não referencia `mv_iip_contrato`.
- [ ] Nenhum dos dois indicadores é consultado direto em tabela transacional pelo frontend — sempre
      via view (regra da camada de Saída).
