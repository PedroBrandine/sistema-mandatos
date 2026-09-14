-- =============================================================================
-- redesenho-estrategia-tela-first: quebra por status (atrasado/atenção/normal)
-- do KPI "Mandatos em atraso" no Dashboard (gap 1 do "Ajuste de fidelidade
-- visual" registrado em tasks.md 2026-09-14; kpi-row.tsx renderiza "—" fixo
-- nas 3 linhas de status hoje porque a view não expunha essa quebra).
--
-- CREATE OR REPLACE, não DROP + CREATE: preserva a ACL de vw_estrategia_kpi
-- (mesmo raciocínio de 20260910152107_estrategia_vw_pendencias_limiar.sql) --
-- esta migration não altera GRANT/REVOKE nenhum.
--
-- O QUE MUDA: 3 colunas novas, na MESMA granularidade das já existentes (uma
-- por produto × escopo_projeto × escopo_gestora): mandatos_atraso_atrasados,
-- mandatos_atraso_atencao, mandatos_atraso_normal. Todo o resto do corpo da
-- view (contrato_escopo, etapa_atrasada, nps_escopo, as outras 6 colunas) é
-- VERBATIM de 20260911210203_estrategia_vw_kpi.sql.
--
-- REPLICANDO classificarLimiar (src/frontend/lib/limiar.ts, T14/AD-045) EM
-- SQL, NÃO uma aproximação:
--   pct_decorrido = dias_na_etapa / ref_etapa.duracao_prevista_dias * 100
--   dias_na_etapa = CURRENT_DATE - COALESCE(fat_etapa_contrato.dt_inicio da
--                   etapa ATUAL, fat_contrato.dt_inicio) -- mesma âncora que
--                   buscarBoardKanban usa para diasNaEtapaAtual
--                   (src/backend/queries/kanban.ts:174-178), replicada aqui
--                   porque a "etapa atual" é lida direto de
--                   fat_contrato.id_etapa_atual, não da coluna id_etapa_atual
--                   ?? etapa_ordem_1 que o Kanban usa pra POSICIONAR o card
--                   (ver "NÃO CLASSIFICÁVEL" abaixo -- é aqui que este KPI
--                   diverge deliberadamente do fallback do Kanban).
--   estado = atrasado  se atrasado_pct ativo E pct_decorrido >= atrasado_pct
--            atencao   senão se atencao_pct  ativo E pct_decorrido >= atencao_pct
--            normal    caso contrário
-- Mesma ordem de prioridade de classificarLimiar (atrasado testado antes de
-- atencao), mesmo `>=` (não `>`), mesma fonte dos dois percentuais
-- (ref_limiar_pendencia.pct_duracao_etapa, AD-004/AD-045).
--
-- NÃO CLASSIFICÁVEL (não entra em NENHUMA das 3 contagens, nunca em
-- "normal" -- AD-005, "ausência não é sentinela"): contrato com
-- id_etapa_atual IS NULL, ou cuja etapa atual não tem duracao_prevista_dias
-- (nula ou <= 0), ou que não está com fat_contrato.status = 'ativo'. Esta é
-- uma decisão EXPLÍCITA e DIFERENTE do fallback visual do Kanban -- lá,
-- id_etapa_atual NULL cai na coluna/duração de ordem=1 só para o card ter
-- ONDE renderizar (buscarBoardKanban:172, "idEtapaColuna = ... ?? idEtapaOrdem1").
-- Aqui, onde a pergunta é "quantos mandatos estão em qual estado" e não "em
-- que coluna desenhar o card", inventar uma etapa para um contrato que nunca
-- teve nenhuma transição registrada seria classificar sobre um dado que não
-- existe -- exatamente o que AD-005 proíbe. classificarLimiar também nunca
-- devolve "normal" para "sem duração": só devolve "normal" quando HÁ duração
-- e o percentual decorrido é baixo -- é diferente de "não dá para calcular
-- percentual nenhum".
--
-- LIMIAR INATIVO -> COLUNA NULL, NÃO 0 (AD-005, mesmo espírito do
-- ref_limiar_pendencia.ativo em vw_pendencias, que DESLIGA a categoria em vez
-- de usar um fallback): mandatos_atraso_atrasados é NULL inteiro quando
-- etapa_atrasado.ativo = false, e mandatos_atraso_atencao é NULL inteiro
-- quando etapa_atencao.ativo = false -- independente de quantos contratos
-- existiriam na contagem se o limiar estivesse ligado. mandatos_atraso_normal
-- NÃO tem essa trava: é o resíduo "não bateu no que está ativo", o mesmo
-- comportamento de classificarLimiar quando um dos dois parâmetros vem null
-- (a condição correspondente simplesmente nunca dispara, e o card cai em
-- "normal" por eliminação) -- não existe um "ref_limiar_pendencia de normal"
-- para desligar.
--
-- VERIFICAÇÃO CRUZADA COM mandatos_em_atraso (pedida explicitamente antes de
-- commitar) -- RESULTADO: NÃO BATEM, e a divergência foi investigada e tem
-- causa raiz identificada, não é bug. Contra o banco de dev (14/09/2026):
-- mandatos_em_atraso (soma da linha de total de todos os produtos) = 12
-- contratos; mandatos_atraso_atrasados (mesmo corte) = 2 contratos.
-- Decompondo os 11 que só aparecem no método antigo:
--   * 10 têm id_etapa_atual IS NULL -- nunca foram movidos no Kanban desde a
--     instanciação. mandatos_em_atraso conta porque a LINHA de
--     fat_etapa_contrato da etapa 1 (status ainda 'nao_iniciada') já passou
--     do dt_prevista_conclusao FIXO calculado na instanciação
--     (app.instancia_contrato, dt_inicio do contrato + duração acumulada).
--     mandatos_atraso_atrasados não conta -- por decisão explícita desta
--     migration (acima, "NÃO CLASSIFICÁVEL") -- porque não há nenhuma
--     transição real registrada de onde derivar "dias na etapa atual".
--   * 1 (id_contrato 199) está com status = 'concluido'. mandatos_em_atraso
--     não filtra por fat_contrato.status (só pelo status da linha de etapa,
--     'concluida'/'dispensada'); mandatos_atraso_atrasados filtra
--     explicitamente por status = 'ativo', por instrução desta task ("para
--     cada contrato ATIVO").
-- E 1 contrato (id_contrato 192) aparece SÓ no método novo: id_etapa_atual
-- real, duracao_prevista_dias = 21, dt_inicio REAL da etapa = 2026-08-13 (32
-- dias atrás, 152% da duração) -- mas dt_prevista_conclusao FIXO daquela
-- etapa é 2026-10-07 (ainda no futuro), porque esse contrato entrou na etapa
-- atrasado em relação ao cronograma original e dt_prevista_conclusao nunca é
-- reancorada pelo Kanban (app.mover_etapa_kanban só grava dt_inicio/
-- dt_conclusao reais, nunca recalcula dt_prevista_*). O método antigo não vê
-- esse atraso porque compara contra uma data-alvo fixa que ainda não chegou;
-- o método novo vê porque mede tempo REAL decorrido na etapa em que o
-- contrato está agora.
-- CONCLUSÃO: as duas métricas medem coisas DIFERENTES por construção --
-- mandatos_em_atraso é "existe alguma etapa (concluída ou não, inclusive
-- nunca iniciada) cujo prazo PLANEJADO ORIGINAL já venceu"; as 3 colunas
-- novas são "a etapa ATUAL, medida pelo tempo REAL decorrido desde que o
-- contrato entrou nela, já passou de X% da duração prevista". Documentado
-- aqui e no fechamento de tasks.md em vez de forçar as duas a baterem --
-- forçar bateria significaria descartar uma das duas definições, e nenhuma
-- delas está errada.
-- =============================================================================

CREATE OR REPLACE VIEW vw_estrategia_kpi WITH (security_invoker = true) AS
WITH contrato_escopo AS (
  SELECT
    c.id_contrato,
    c.id_produto,
    c.status,
    prj.escopo_projeto,
    prj.id_projeto,
    gst.escopo_gestora,
    gst.id_usuario_gestora
  FROM fat_contrato c
  -- Linha "todos os projetos" sempre; a linha de recorte só existe quando o
  -- contrato tem projeto -- contrato sem projeto não inventa um grupo.
  CROSS JOIN LATERAL (
    SELECT false AS escopo_projeto, NULL::bigint AS id_projeto
    UNION ALL
    SELECT true, c.id_projeto WHERE c.id_projeto IS NOT NULL
  ) prj
  -- Mesma convenção de "vínculo ativo" de vw_pendencias e vw_carteira
  -- (dt_fim aberta ou futura), para que o recorte por gestora do Dashboard
  -- concorde com a coluna de gestora das Pendências na mesma tela.
  CROSS JOIN LATERAL (
    SELECT false AS escopo_gestora, NULL::bigint AS id_usuario_gestora
    UNION ALL
    SELECT true, v.id_usuario
      FROM rel_usuario_contrato v
     WHERE v.id_contrato = c.id_contrato
       AND v.papel_no_contrato = 'gestora'
       AND (v.dt_fim IS NULL OR v.dt_fim >= CURRENT_DATE)
  ) gst
),
-- Reuso de vw_pendencias (T3/AD-041) em vez de reproduzir a regra de etapa
-- atrasada: o limiar mora em ref_limiar_pendencia e mudá-lo tem de mudar
-- este KPI junto, sem deploy (AD-004). DISTINCT porque um contrato pode ter
-- mais de uma etapa vencida e o KPI conta MANDATOS, não etapas.
etapa_atrasada AS (
  SELECT DISTINCT p.id_contrato
    FROM vw_pendencias p
   WHERE p.categoria = 'etapa_atrasada'
),
-- NPS chega ao produto pelo único caminho disponível a partir da MV:
-- formulário -> etapa -> produto. id_projeto_grupo é COALESCE(id_projeto, 0)
-- na origem, então 0 significa "contrato sem projeto" e nunca vira recorte.
nps_escopo AS (
  SELECT
    re.id_produto,
    prj.escopo_projeto,
    prj.id_projeto,
    ROUND(AVG(a.nps), 2) AS nps_medio
  FROM mv_avaliacao_nps a
  JOIN ref_formulario rf ON rf.id_formulario = a.id_formulario
  JOIN ref_etapa re      ON re.id_etapa = rf.id_etapa
  CROSS JOIN LATERAL (
    SELECT false AS escopo_projeto, NULL::bigint AS id_projeto
    UNION ALL
    SELECT true, a.id_projeto_grupo WHERE a.id_projeto_grupo <> 0
  ) prj
  WHERE a.eh_nps AND a.nps IS NOT NULL
  GROUP BY re.id_produto, prj.escopo_projeto, prj.id_projeto
),
-- Os dois percentuais ativos de uma vez só (AD-004/AD-045): NULL quando o
-- limiar correspondente está desligado (ref_limiar_pendencia.ativo = false)
-- ou simplesmente não existe -- é o sinal que vira coluna NULL lá embaixo,
-- em vez de 0.
limiar_etapa AS (
  SELECT
    (SELECT pct_duracao_etapa FROM ref_limiar_pendencia WHERE codigo = 'etapa_atrasado' AND ativo) AS atrasado_pct_ativo,
    (SELECT pct_duracao_etapa FROM ref_limiar_pendencia WHERE codigo = 'etapa_atencao'  AND ativo) AS atencao_pct_ativo
),
-- Uma linha por contrato CLASSIFICÁVEL -- réplica de classificarLimiar em
-- SQL (ver cabeçalho da migration). id_etapa (PK de ref_etapa) e
-- (id_contrato, id_etapa) (PK/UNIQUE de fat_etapa_contrato) garantem no
-- máximo 1 linha por contrato, sem risco de multiplicação.
etapa_classificacao AS (
  SELECT
    c.id_contrato,
    CASE
      WHEN le.atrasado_pct_ativo IS NOT NULL
           AND ((CURRENT_DATE - COALESCE(fec.dt_inicio, c.dt_inicio))::numeric / e.duracao_prevista_dias * 100) >= le.atrasado_pct_ativo
        THEN 'atrasado'
      WHEN le.atencao_pct_ativo IS NOT NULL
           AND ((CURRENT_DATE - COALESCE(fec.dt_inicio, c.dt_inicio))::numeric / e.duracao_prevista_dias * 100) >= le.atencao_pct_ativo
        THEN 'atencao'
      ELSE 'normal'
    END AS estado
  FROM fat_contrato c
  JOIN ref_etapa e ON e.id_etapa = c.id_etapa_atual
  LEFT JOIN fat_etapa_contrato fec ON fec.id_contrato = c.id_contrato AND fec.id_etapa = c.id_etapa_atual
  CROSS JOIN limiar_etapa le
  WHERE c.status = 'ativo'
    AND c.id_etapa_atual IS NOT NULL
    AND e.duracao_prevista_dias IS NOT NULL
    AND e.duracao_prevista_dias > 0
)
SELECT
  ce.id_produto,
  ce.escopo_projeto,
  ce.id_projeto,
  ce.escopo_gestora,
  ce.id_usuario_gestora,
  COUNT(DISTINCT ce.id_contrato) FILTER (WHERE ce.status = 'ativo')         AS mandatos_ativos,
  ROUND(AVG(iip.iip_provisorio), 2)                                         AS iip_medio,
  COUNT(DISTINCT ce.id_contrato) FILTER (WHERE ea.id_contrato IS NOT NULL)  AS mandatos_em_atraso,
  CASE WHEN ce.escopo_gestora THEN NULL ELSE MAX(nps.nps_medio) END         AS nps_medio,
  ROUND(AVG(pl.pct_atingimento), 2)                                         AS pct_atingimento_medio,
  COALESCE(SUM(iip.nr_fatos), 0)                                            AS nr_fatos_geradores,
  -- Quebra por status do KPI "Mandatos em atraso" (kpi-row.tsx,
  -- KpiMandatosAtraso) -- mutuamente exclusivas por construção (CASE de
  -- etapa_classificacao produz exatamente um `estado` por contrato) e NÃO
  -- somam mandatos_em_atraso (ver cabeçalho: bases diferentes, divergência
  -- investigada e documentada). Coluna inteira NULL quando o limiar
  -- correspondente está desligado; não somam com o zero de "nenhum contrato
  -- bateu" porque MAX(le.*) é constante no grupo inteiro (mesmo padrão de
  -- MAX(nps.nps_medio) acima) -- CASE WHEN precisa dele fora de FILTER
  -- porque a decisão é "a coluna toda existe ou não", não "quantas linhas
  -- passam".
  CASE WHEN MAX(le.atrasado_pct_ativo) IS NULL THEN NULL
       ELSE COUNT(DISTINCT ce.id_contrato) FILTER (WHERE ecl.estado = 'atrasado') END AS mandatos_atraso_atrasados,
  CASE WHEN MAX(le.atencao_pct_ativo) IS NULL THEN NULL
       ELSE COUNT(DISTINCT ce.id_contrato) FILTER (WHERE ecl.estado = 'atencao') END  AS mandatos_atraso_atencao,
  COUNT(DISTINCT ce.id_contrato) FILTER (WHERE ecl.estado = 'normal')                 AS mandatos_atraso_normal
FROM contrato_escopo ce
LEFT JOIN mv_iip_contrato iip ON iip.id_contrato = ce.id_contrato
LEFT JOIN etapa_atrasada ea   ON ea.id_contrato = ce.id_contrato
LEFT JOIN dim_planejamento pl ON pl.id_contrato = ce.id_contrato
-- nps_escopo é 1 linha por (produto, escopo de projeto), constante dentro de
-- cada grupo do GROUP BY -- MAX() é só a forma de carregá-la através da
-- agregação, não uma escolha entre valores. IS NOT DISTINCT FROM porque o
-- lado "todos os projetos" casa NULL com NULL.
LEFT JOIN nps_escopo nps ON nps.id_produto      = ce.id_produto
                        AND nps.escopo_projeto  = ce.escopo_projeto
                        AND nps.id_projeto IS NOT DISTINCT FROM ce.id_projeto
LEFT JOIN etapa_classificacao ecl ON ecl.id_contrato = ce.id_contrato
CROSS JOIN limiar_etapa le
GROUP BY ce.id_produto, ce.escopo_projeto, ce.id_projeto, ce.escopo_gestora, ce.id_usuario_gestora;

COMMENT ON VIEW vw_estrategia_kpi IS
'EST-08. Os 6 KPIs do topo do Dashboard do produto, agregados na camada Saída (AD-003): mandatos_ativos, iip_medio, mandatos_em_atraso, nps_medio, pct_atingimento_medio, nr_fatos_geradores -- mais a quebra por status (mandatos_atraso_atrasados, mandatos_atraso_atencao, mandatos_atraso_normal) do KPI de atraso, réplica em SQL de classificarLimiar (src/frontend/lib/limiar.ts, AD-045), medida sobre a etapa ATUAL do contrato (fat_contrato.id_etapa_atual) e o tempo REAL decorrido desde a transição pra ela -- NÃO soma mandatos_em_atraso, que mede algo diferente por construção (qualquer etapa, concluída ou não, cujo prazo PLANEJADO original já venceu; ver migration 20260914161230 para a divergência investigada). Uma linha por (produto × escopo de projeto × escopo de gestora); escopo_projeto/escopo_gestora dizem se a linha é recorte ou total, e o consumidor lê UMA linha em vez de somar várias. Só lê e agrega: IIP vem pronto de mv_iip_contrato e NPS de mv_avaliacao_nps, nenhuma métrica é recalculada (AD-014). Médias devolvem NULL sem amostra (AD-005, renderizado "—"); contagens devolvem 0, que ali é fato e não sentinela -- exceto as 3 colunas de quebra por status, que devolvem NULL (não 0) quando o limiar de ref_limiar_pendencia correspondente está inativo, e contrato sem etapa atual classificável (id_etapa_atual nulo, ou etapa sem duracao_prevista_dias, ou contrato não ativo) não entra em nenhuma das 3, nunca é forçado em "normal". nps_medio é NULL em toda linha de escopo_gestora: mv_avaliacao_nps não carrega id_contrato, logo NPS não é recortável por gestora -- ausência explícita em vez de repetir o número do produto como se fosse o dela.';
