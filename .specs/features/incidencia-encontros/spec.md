# Incidência & Encontros Specification

## Problem Statement

Hoje o mandato/PLL não tem onde registrar o que de fato acontece entre uma etapa e outra: reunião
realizada, observação qualitativa (insight) e ação política observada (fato gerador) não têm
tabela nenhuma — os botões "Registrar Insight"/"Registrar Fato Gerador" já existem na ficha do
contrato (`ficha-contrato-chrome.tsx`) mas só mostram um toast "Em desenvolvimento". Sem essa
camada, o IIP (§2.4 da Constituição) — a métrica de incidência política do sistema — não tem
nenhum dado de onde ser calculado, e G3-G6 da Visão Gerencial (roadmap §7) não têm o que exibir.
Esta feature provisiona a camada de Incidência (Registro, Insight, Fato Gerador, IIP) + Encontros
(OPR-03, que alimenta Registro/Insight diretamente) inteira, do schema já aprovado.

## Goals

- [ ] Assessor/Mentor/Gestora conseguem lançar um Registro (reunião realizada) vinculado à etapa
      certa do produto do contrato — histórico real substitui os `/registro - <etapa>` do Slack.
- [ ] Assessor/Mentor/Gestora conseguem registrar um Insight (observação qualitativa), opcionalmente
      vinculado ao Registro que o originou e/ou a uma Meta/Sucesso Mensal do planejamento.
- [ ] Assessor/Mentor/Gestora conseguem registrar um Fato Gerador validado por Tipologia,
      vinculável a uma Meta ou sem origem nenhuma.
- [ ] O IIP de cada contrato passa a ser calculado uma única vez, na Incidência (AD-014), a partir
      dos Fatos Geradores — nunca recalculado por nenhuma tela de Saída.
- [ ] `vw_carteira` deixa de ser a versão reduzida (AD-032) e passa a ser a versão completa
      aprovada, com `iip_provisorio`/`nr_fatos`/`dt_ultimo_registro` — AD-032 é marcada como
      resolvida.
- [ ] Gestora/Assessor conseguem planejar e marcar como realizado um Encontro, com lista de
      participantes — substitui a coluna "Presentes" em texto livre das planilhas.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| --- | --- |
| Levantamento humano do conteúdo de `ref_tipologia`/`ref_indicador`/`ref_agenda_tematica` (CAT-16) | Trabalho de negócio com o time de Monitoramento, sem data — não é código, não é desta feature (mesma exceção já registrada na Trilha C) |
| Fechar D2 — aritmética final da fórmula do IIP | Decisão da área de conhecimento (Monitoramento), fora do que um agente decide. A fórmula em uso é a provisória, já verbatim em `docs/schema_sistema.sql:1247-1269` |
| `/admin/catalogos` (CRUD administrado de `ref_tipologia`/`ref_indicador`) | Mesma decisão já tomada na Trilha C — tela de administração entra quando o Admin tiver mais o que administrar |
| Visão Gerencial G3-G6 completa (painel gerencial dedicado ao IIP/GIP, séries históricas) | Feature futura, roadmap §7 (Saída). Esta feature entrega o dado (`mv_iip_contrato`/`vw_carteira` completa) e uma exposição mínima em nível de contrato — não o painel gerencial inteiro |
| Tela de Agenda cross-produto (`/produtos/[slug]/agenda`) consumindo Encontros de verdade | Placeholder (`<EmDesenvolvimento>`) permanece nesta fatia; layout de agenda/calendário cross-contrato é decisão de feature própria, não pedida aqui |
| `pg_cron` de fato (job assíncrono de banco) | Não provisionado no projeto (mesmo estado de `app.recalcula_pendentes`, `planejamento-planilha-monitoramento`). Refresh de `mv_iip_contrato` é síncrono nesta fatia — ver Assumptions #3 |
| Formulários dos Produtos (OPR-02) | Camada irmã do roadmap §6.3, feature própria, possivelmente em paralelo — zero dependência mútua com esta feature |
| `fat_snapshot_mensal` / job de fechamento mensal (AD-015) | Camada Saída, fora desta feature |
| Mapa Político / Diagnóstico de Organograma anexados a um Fato Gerador ou Insight | AD-017 — deferidos, sem schema de campos ainda; fora de escopo independente de camada |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here — nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| **#1 — `ref_tipologia` estava vazia (0 linhas) — Fato Gerador não podia ser criado.** Resolvido: Pedro anexou `docs/DB_Fatos_Geradores - Ref_Tipologias.csv`, conteúdo real e aprovado das 51 tipologias (`grupo`/`tipologia`/`estado`/`preditor_1`/`preditor_2`/`nivel_d1_padrao`/`nivel_d2_padrao`/`nivel_d3_padrao`/`observacao`). Seed verbatim do CSV, mesmo tratamento de "dado de negócio aprovado" que os outros catálogos da Trilha C. | Seed de `ref_tipologia` com as 51 linhas do CSV, numa migration nova (mesmo padrão de `catalogos_referencia_seed.sql`) | Decisão de Pedro em 2026-08-13, com o CSV como fonte | **y — confirmado, CSV em mãos** |
| **#1a — `ref_nivel_iip` só tinha 3 níveis (baixo/médio/alto); o CSV usa um 4º nível, "Máximo", em ~9 das 51 tipologias.** Sem essa linha o `INSERT` de `ref_tipologia` falha por FK em `nivel_d1_padrao`/`nivel_d2_padrao`/`nivel_d3_padrao`. | Adicionar 1 linha a `ref_nivel_iip`: `codigo='maximo'`, `rotulo='Máximo'`, `valor=4`, `ordem=4` — continua a sequência 1/2/3 já seedada pela Trilha C | Decisão de Pedro em 2026-08-13 | **y — confirmado, valor=4/ordem=4** |
| **#1b — O CSV não traz peso/indicador (`ref_indicador`/`id_indicador`).** Toda `ref_tipologia` nasce com `id_indicador = NULL`; em `mv_iip_contrato`, isso zera todo componente por `LEFT JOIN ref_indicador` ausente — `nr_fatos` conta certo, `iip_provisorio` fica `NULL` pra **todo** contrato até `ref_indicador` ganhar conteúdo real (CAT-16, sem data). | IIP "sem dado" — nenhum `ref_indicador` provisório seedado; UI mostra "sem dado suficiente" (mesmo padrão AD-005 já usado pela mediana de `vw_ciclo_etapa` em `visao-gerencial-g1-g2`) até o levantamento real chegar | Decisão de Pedro em 2026-08-13 — opção recomendada, consistente com CAT-16 (não inventar peso de negócio) | **y — confirmado, IIP fica NULL/"sem dado" nesta feature** |
| **#2 — Onde o IIP "provisório" aparece na UI nesta fatia** | Card na ficha do contrato (`ficha-contrato-chrome.tsx`), perto dos botões "Registrar Insight"/"Registrar Fato Gerador" — "IIP (provisório): X · Y fatos geradores" | Decisão de Pedro em 2026-08-13 | **y — confirmado** |
| **#3 — Refresh de `mv_iip_contrato` síncrono ao abrir a tela que o exibe** (mesmo padrão de `app.recalcula_pendentes`) em vez de `pg_cron` (não provisionado) | Confirmado — síncrono ao abrir o card de IIP na ficha do contrato | Decisão de Pedro em 2026-08-13 | **y — confirmado** |
| **#4 — Tarefa obrigatória: substituir `vw_carteira` reduzida (AD-032) pela versão completa** assim que `mv_iip_contrato`/`fat_registro` existirem, e marcar AD-032 como resolvida em `STATE.md` | Não é opcional — já decidido pelo usuário, registrado aqui só para rastreabilidade | Pedido explícito do usuário nesta sessão | **y — decisão já dada, não é gray area** |
| Coalizão não tem nenhuma linha em `ref_tipo_registro` (só `ref_etapa` foi clonada, D9/CAT-17) — Registro não pode ser criado hoje para contrato de Coalizão | Aceitar como lacuna de dado conhecida, fora do código desta feature (mesma categoria de CAT-16); Insight e Fato Gerador não dependem de `ref_tipo_registro` e continuam funcionando pra Coalizão | Achado de leitura de `20260810193825_catalogos_referencia_seed_coalizao.sql` — clona só `ref_etapa`, nunca `ref_tipo_registro` | y — assumption registrada, não bloqueia P1 (Estratégia/PLL já têm régua+tipos seedados) |
| `fat_registro.id_encontro`/`fat_insight.id_registro` não têm trava de banco impedindo apontar pra objeto de **outro** contrato (schema aprovado não tem esse `CHECK`, só `fat_insight` tem trigger — `fat_registro` não tem nenhuma pro `id_encontro`) | Enforçar o corte "mesmo contrato" na camada de aplicação (query/formulário só lista opções do próprio contrato) — mesmo padrão já documentado no comentário de `fat_insight.id_registro` ("regra aplicada na feature, não no schema") | AD-008 (extrair verbatim, não redesenhar o schema) — não é permitido inventar `CHECK`/trigger novo que o schema aprovado não tem | y — decisão técnica de baixo risco, não needs live confirmation |
| Onde vivem as novas ações de UI (criar Registro, criar Encontro, formulário de Insight/Fato Gerador que hoje só mostra toast) | Dialog nos 2 botões já existentes no chrome (deixam de ser `toast`) + botão "Registrar" novo na aba de etapa (Registro) + aba própria "Encontros" no chrome com lista + Dialog — mesmo padrão de Dialog+RHF de `objetivo-form.tsx` (`planejamento-planilha-monitoramento`) | Decisão de Pedro em 2026-08-13 | **y — confirmado** |

**Open questions:** nenhuma — todas as 4 pendências (+ 2 achados novos surgidos ao receber o CSV,
#1a e #1b) foram confirmadas ao vivo com Pedro em 2026-08-13. Ver `context.md` para o detalhe da
conversa.

---

## User Stories

### P1: Fato Gerador validado por Tipologia + cálculo do IIP ⭐ MVP

**User Story**: Como Assessor/Mentor/Gestora com vínculo ativo no contrato, quero registrar um
Fato Gerador (ação política observada) validado por Tipologia, vinculável a uma Meta do
planejamento ou sem origem nenhuma, para que o IIP do meu contrato passe a existir a partir de
dado real em vez de não existir.

**Why P1**: É a única métrica calculada desta camada (AD-014) e a peça que a Saída está esperando
(G3-G6, roadmap §7). Sem Fato Gerador não há IIP; sem IIP não há o que a próxima onda de Visão
Gerencial consome.

**Acceptance Criteria**:

1. WHEN um usuário com vínculo ativo no contrato preenche Tipologia + ao menos um nível (D1 e/ou
   D2 e/ou D3, `ref_nivel_iip`) + data de ocorrência THEN o sistema SHALL gravar um
   `fat_fato_gerador` com `id_usuario_autor` + `criado_em` (AD-006).
2. WHEN nenhum nível (D1/D2/D3) é preenchido THEN o sistema SHALL rejeitar a gravação
   (`ck_fato_niveis`, verbatim).
3. WHEN o Fato Gerador é vinculado a uma Meta do planejamento do mesmo contrato THEN o sistema
   SHALL gravar o vínculo em `rel_fato_origem`; WHEN nenhuma Meta é selecionada THEN o Fato
   Gerador SHALL existir sem nenhuma linha em `rel_fato_origem` ("fato sem origem", válido por
   schema — `ck_fato_origem` só exige Meta OU Insight quando a linha de vínculo existe).
4. WHEN um Fato Gerador é vinculado a um Insight como origem (em vez de/além de Meta) THEN o
   sistema SHALL aceitar em `rel_fato_origem` (Meta e Insight não são mutuamente exclusivos).
5. WHEN pelo menos 1 Fato Gerador existe para um contrato e `mv_iip_contrato` é atualizada
   THEN a materialized view SHALL expor `nr_fatos` e `iip_provisorio` para esse `id_contrato`,
   pela fórmula verbatim de `docs/schema_sistema.sql:1247-1269` (D2 em aberto — fórmula
   provisória, não desta feature fechar).
6. WHEN a tela da ficha do contrato (card de IIP) é aberta THEN o sistema SHALL disparar
   `REFRESH MATERIALIZED VIEW mv_iip_contrato` de forma síncrona antes de ler, mesmo padrão de
   `app.recalcula_pendentes` (Assumption #3).
7. WHEN o IIP de um contrato é exibido no card da ficha do contrato THEN a UI SHALL rotulá-lo
   explicitamente como "provisório" (D2 em aberto — Assumption #2).
8. WHEN `mv_iip_contrato` e `fat_registro` existem no banco (esta feature os cria) THEN `vw_carteira`
   SHALL ser substituída, via `CREATE OR REPLACE VIEW`, pela versão completa aprovada
   (`docs/schema_sistema.sql:1327-1352`) — incluindo `iip_provisorio`, `nr_fatos` e
   `dt_ultimo_registro` — e a entrada AD-032 em `.specs/STATE.md` SHALL deixar de estar `active`.
9. WHEN um contrato não tem nenhum Fato Gerador THEN `vw_carteira.iip_provisorio`/`nr_fatos`
   SHALL ser `NULL` (nunca `0` — AD-005; `mv_iip_contrato` não gera linha por `GROUP BY` vazio) e a
   UI SHALL mostrar explicitamente "sem fato gerador ainda", nunca um número.
10. WHEN toda `ref_tipologia` (as 51 linhas seedadas do CSV) tem `id_indicador = NULL` (nenhum
    peso real ainda cadastrado — CAT-16 sem data) THEN `mv_iip_contrato.iip_provisorio` SHALL ser
    `NULL` para todo contrato, mesmo com Fatos Geradores reais lançados, e a UI SHALL mostrar
    "sem dado suficiente" em vez de um número (Assumption #1b — decisão confirmada, não peso=1
    provisório).

**Independent Test**: Cria um Fato Gerador para um contrato de teste com Tipologia+nível
preenchidos, roda o refresh de `mv_iip_contrato`, confirma que `vw_carteira` (versão completa)
retorna `nr_fatos = 1` e `iip_provisorio` não nulo para aquele contrato — sem tocar Registro,
Insight ou Encontro.

---

### P1: Registro por etapa

**User Story**: Como Assessor com vínculo ativo, quero lançar um Registro (reunião/entrega
realizada) vinculado ao Tipo de Registro certo da etapa do produto do meu contrato, para que a
régua tenha histórico real do que de fato aconteceu, substituindo os `/registro - <etapa>` do
Slack.

**Why P1**: É o insumo de onde Insight nasce (Assumption/schema: "insight sempre nasce de
registro" na Estratégia) e o que a coluna `dt_ultimo_registro` de `vw_carteira` completa (AC8 da
história acima) precisa para existir.

**Acceptance Criteria**:

1. WHEN um usuário com vínculo ativo no contrato escolhe um Tipo de Registro que pertence à régua
   do produto do contrato THEN o sistema SHALL gravar `fat_registro` com `id_usuario_autor` +
   `criado_em` (AD-006).
2. WHEN o Tipo de Registro escolhido **não** pertence à régua do produto do contrato THEN o
   sistema SHALL rejeitar a gravação (`app.trg_valida_registro_produto`, verbatim,
   `docs/schema_sistema.sql:1908-1928`).
3. WHEN o Tipo de Registro tem `permite_multiplos = true` e o formulário informa `nr_sequencia`
   THEN o sistema SHALL impedir duas linhas com o mesmo (`id_contrato`, `id_tipo_registro`,
   `nr_sequencia`) — `uq_registro_sequencia`, verbatim.
4. WHEN um Registro é criado com `id_encontro` apontando para um Encontro do **mesmo** contrato
   THEN o sistema SHALL aceitar; WHEN o formulário tenta apontar para um Encontro de **outro**
   contrato THEN o sistema SHALL impedir na camada de aplicação (o formulário só lista Encontros
   do próprio contrato — o schema aprovado não tem `CHECK`/trigger para este caso, ver
   Assumptions).
5. WHEN um Registro é criado THEN `conteudo` (JSONB) SHALL aceitar `{}` como valor mínimo válido
   (`ck_registro_conteudo`, verbatim) — o formulário desta fatia não precisa preencher nenhum
   campo dentro do JSONB (schema por tipo de registro é P2/P3, fora desta fatia — ver Out of
   Scope de Formulários OPR-02, feature irmã).

**Independent Test**: Abre a aba de uma etapa que tem Tipo de Registro seedado (ex.: "Monitoramento
mensal" da Estratégia), lança um Registro, confirma que aparece na listagem da etapa e que
`fat_registro.id_usuario_autor` está preenchido.

---

### P2: Insight vinculado ao Registro/Meta/Sucesso Mensal

**User Story**: Como Assessor/Mentor, quero registrar um Insight (observação qualitativa),
opcionalmente vinculado ao Registro que o originou e/ou a uma Meta/Sucesso Mensal do planejamento,
para não perder observações que hoje ficam em texto livre disperso por 8 abas diferentes.

**Why P2**: Depende de Registro (P1) existir para o caso comum de origem, mas o próprio schema
aprovado permite Insight sem Registro de origem (25% da base histórica do PLL) — não é bloqueante
do P1, mas é o próximo elo da cadeia Registro → Insight → (Fato Gerador).

**Acceptance Criteria**:

1. WHEN um Insight é criado com `id_registro` apontando para um Registro do **mesmo** contrato
   THEN o sistema SHALL aceitar (`app.trg_valida_insight_contrato`, verbatim,
   `docs/schema_sistema.sql:1931-1945`).
2. WHEN `id_registro` aponta para um Registro de **outro** contrato THEN o sistema SHALL rejeitar
   a gravação (mesmo trigger, verbatim).
3. WHEN um Insight é criado sem nenhum Registro de origem THEN o sistema SHALL aceitar mesmo assim
   (`id_registro` nullable por schema, AD-005 — "insight sempre nasce de registro" é regra de UI
   pra Estratégia, não trava de banco).
4. WHEN um Insight é vinculado a uma Meta e/ou a um Sucesso Mensal do mesmo contrato THEN o
   sistema SHALL gravar em `rel_insight_origem` (0, 1 ou 2 vínculos simultâneos — Meta e Sucesso
   não são mutuamente exclusivos no schema aprovado, `ck_insight_origem` só exige "pelo menos um"
   quando a linha existe).
5. WHEN o formulário de Insight é aberto THEN a UI SHALL oferecer os 4 Pilares já seedados
   (`ref_pilar_insight`) como campo opcional (`id_pilar` nullable).

**Independent Test**: A partir de um Registro já criado (P1), abre "Registrar Insight" (hoje
placeholder no chrome), cria um Insight vinculado a esse Registro, confirma que aparece listado
"originado por" aquele Registro.

---

### P2: Encontros — planejar e marcar realizado + participantes

**User Story**: Como Gestora/Assessor, quero registrar um Encontro (previsto ou realizado) de um
contrato e marcar quem participou (pessoa do sistema ou externa), para substituir a coluna
"Presentes" em texto livre e medir engajamento do gabinete e de Legislers por encontro.

**Why P2**: Alimenta `fat_registro.id_encontro` (P1) e é o que a Constituição chama de OPR-03 —
mas é uma vertical separável (fluxo de agenda, não de incidência em si) e demonstrável sem
depender de Registro/Insight/Fato Gerador existirem primeiro.

**Acceptance Criteria**:

1. WHEN um Encontro é criado com `status = 'planejado'` THEN `dt_prevista_inicio` SHALL ser
   obrigatória; WHEN ausente THEN o sistema SHALL rejeitar (`ck_encontro_planejado`, verbatim).
2. WHEN um Encontro é marcado como `status = 'realizado'` THEN `dt_realizada` SHALL ser
   obrigatória; WHEN ausente THEN o sistema SHALL rejeitar (`ck_encontro_realizado`, verbatim).
3. WHEN um participante é adicionado com `id_usuario` (pessoa com conta no sistema) THEN o sistema
   SHALL impedir duplicar o mesmo usuário no mesmo Encontro (`uq_encontro_participante_usuario`,
   verbatim); WHEN o participante é uma pessoa externa (sem conta) THEN o formulário SHALL aceitar
   `nome_livre` em vez de `id_usuario` (`ck_participante_identificacao`, XOR verbatim).
4. WHEN dois Encontros do mesmo (`id_contrato`, `id_tipo_registro`, `nr_sequencia`) estão ambos com
   `status IN ('planejado','realizado')` THEN o sistema SHALL rejeitar o segundo
   (`uq_encontro_sequencia`, verbatim — "não existem dois Monitoramento 2 vivos").
5. WHEN um Encontro `realizado` é a origem de um Registro (P1, `fat_registro.id_encontro`) THEN o
   formulário de Registro SHALL oferecer esse Encontro como opção de vínculo.

**Independent Test**: Cria um Encontro `planejado` com data futura, depois marca como `realizado`
com data real e adiciona 2 participantes (1 do sistema, 1 externo por nome), confirma que ambos
aparecem na lista de presença do Encontro.

---

## Edge Cases

- WHEN `ref_tipologia` (51 linhas do CSV, Assumption #1) inclui uma linha com nível "Máximo" em
  D1/D2/D3 THEN o `INSERT` SHALL resolver contra `ref_nivel_iip.codigo = 'maximo'` (linha nova,
  Assumption #1a — sem ela o seed falha por FK).
- WHEN a Tipologia de um Fato Gerador não tem `id_indicador` (peso do IIP — hoje: todas as 51,
  Assumption #1b) THEN `mv_iip_contrato.iip_provisorio` SHALL ser `NULL` para o contrato inteiro,
  e a UI SHALL mostrar "sem dado suficiente" — nunca um número parcial silenciosamente incompleto.
- WHEN um contrato de Coalizão tenta lançar um Registro (sem `ref_tipo_registro` seedado para
  Coalizão) THEN o formulário SHALL mostrar "nenhum tipo de registro cadastrado para este
  produto" — mesma leitura já usada pro caso "nenhuma etapa cadastrada" (`contratos/[id]/page.tsx`)
  — em vez de formulário vazio ou erro de banco. Fato Gerador e Insight continuam funcionando
  normalmente para Coalizão (não dependem de `ref_tipo_registro`).
- WHEN um contrato não tem nenhum Fato Gerador THEN `iip_provisorio`/`nr_fatos` SHALL ser `NULL`,
  nunca `0` (AD-005) — mesmo padrão já usado pela mediana de `vw_ciclo_etapa` em
  `visao-gerencial-g1-g2`.
- WHEN um Fato Gerador tem só `nivel_d1` preenchido (D2 e D3 nulos) THEN `mv_iip_contrato` SHALL
  somar apenas o componente D1 daquele fato (`COALESCE(n1.valor, 0)`/`COALESCE(n2.valor, 0)`/
  `COALESCE(n3.valor, 0)` no `SUM`, verbatim — níveis ausentes contam como 0, não como ausência do
  fato inteiro).
- WHEN o mesmo contrato tem 2 vínculos ativos como "gestora" simultaneamente (schema permite, sem
  `CHECK` que impeça) THEN o comportamento de qualquer view desta feature que faça `JOIN` com
  `rel_usuario_contrato` SHALL seguir o mesmo padrão não-deduplicado já aceito em
  `vw_carteira`/`vw_carteira_ponderada` (risco conhecido, não introduzido nem corrigido por esta
  feature).
- WHEN um Insight/Fato Gerador é criado sem nenhum vínculo de origem (nem Registro, nem Meta, nem
  Sucesso Mensal) THEN o sistema SHALL aceitar — "fato/insight sem origem" é estado válido por
  schema (`rel_fato_origem`/`rel_insight_origem` simplesmente não ganham nenhuma linha).

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| INC-01 | P1: Fato Gerador + IIP — gravação básica + validação de nível | Design | Pending |
| INC-02 | P1: Fato Gerador + IIP — vínculo a Meta/Insight (`rel_fato_origem`) | Design | Pending |
| INC-03 | P1: Fato Gerador + IIP — `mv_iip_contrato` calcula `nr_fatos`/`iip_provisorio` | Design | Pending |
| INC-04 | P1: Fato Gerador + IIP — refresh síncrono ao abrir a tela (Assumption #3) | Design | Pending |
| INC-05 | P1: Fato Gerador + IIP — rótulo "provisório" na UI (Assumption #2) | Design | Pending |
| INC-06 | P1: Fato Gerador + IIP — substituição de `vw_carteira` (AD-032) + resolução da entrada em STATE.md | Design | Pending |
| INC-07 | P1: Fato Gerador + IIP — Edge Case: contrato sem fato gerador → `NULL`, nunca `0` | Design | Pending |
| INC-08 | P1: Fato Gerador + IIP — `iip_provisorio` fica `NULL`/"sem dado" enquanto `ref_indicador` não tem peso real (Assumption #1b) | Design | Pending |
| INC-19 | P1: Seed de `ref_tipologia` (51 linhas, CSV `docs/DB_Fatos_Geradores - Ref_Tipologias.csv`, Assumption #1) | Design | Pending |
| INC-20 | P1: Seed de `ref_nivel_iip.codigo='maximo'` (valor=4, ordem=4, Assumption #1a) | Design | Pending |
| INC-09 | P1: Registro por etapa — gravação + validação de produto (`trg_valida_registro_produto`) | Design | Pending |
| INC-10 | P1: Registro por etapa — `nr_sequencia` único por (contrato, tipo) | Design | Pending |
| INC-11 | P1: Registro por etapa — vínculo opcional a Encontro do mesmo contrato | Design | Pending |
| INC-12 | P2: Insight — vínculo opcional a Registro (`trg_valida_insight_contrato`) | Design | Pending |
| INC-13 | P2: Insight — vínculo opcional a Meta/Sucesso Mensal (`rel_insight_origem`) | Design | Pending |
| INC-14 | P2: Insight — Pilar opcional (`ref_pilar_insight`) | Design | Pending |
| INC-15 | P2: Encontros — `planejado`/`realizado` com datas obrigatórias por status | Design | Pending |
| INC-16 | P2: Encontros — participantes (usuário do sistema ou externo por nome) | Design | Pending |
| INC-17 | P2: Encontros — unicidade de sequência viva por (contrato, tipo, nº) | Design | Pending |
| INC-18 | UI: onde vivem as novas ações (Registro/Encontro/Insight/Fato Gerador) — gray area de layout | Design | Pending |

**ID format:** `INC-NN` (feature única cobre INC-01..INC-03/OPR-03 do roadmap §6.2).

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 20 total, 0 mapped to tasks yet, 20 unmapped ⚠️ (Tasks phase ainda não rodou)

---

## Success Criteria

How we know the feature is successful:

- [ ] Um Fato Gerador criado por teste automatizado aparece em `mv_iip_contrato`/`vw_carteira`
      (versão completa) sem intervenção manual, com o IIP rotulado "provisório" onde exibido.
- [ ] Um Registro criado para um Tipo de Registro fora da régua do produto do contrato é
      **rejeitado** pelo banco (não só pela UI) — prova de que o trigger verbatim está ativo.
- [ ] AD-032 deixa de estar `active` em `.specs/STATE.md` ao final da feature.
- [ ] Zero regressão nas 12 features anteriores já validadas (gate `npm run build && npm run
      lint:all && npm run test:unit && npm run test:integration` verde, mesma baseline de lint
      pré-existente).
