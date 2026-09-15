-- =============================================================================
-- kpi-status-mandatos-ativos: a quebra por status passa a PARTICIONAR os
-- mandatos ativos (AD-050) e a classificar o contrato sem transição pela
-- etapa de ordem 1 (AD-051).
--
-- POR QUE ESTA MIGRATION EXISTE. A migration 20260914161230 expôs a quebra
-- por status e documentou, como decisão deliberada, que ela NÃO somava
-- mandatos_em_atraso -- bases diferentes por construção. Na tela isso virou um
-- card que se contradiz: número grande 7 ao lado de "6 atrasados / 0 atenção /
-- 20 normal" (banco de dev, 15/09). Pedro reprovou ao vivo. A decisão de
-- produto (AD-050) foi remover o card "Mandatos em atraso" e pendurar a quebra
-- no card "Mandatos ativos", onde o número grande é o UNIVERSO e as 3 linhas o
-- detalham -- o que só fecha se toda linha da view satisfizer
--   mandatos_atraso_atrasados + _atencao + _normal = mandatos_ativos.
-- Esta migration é o que torna essa igualdade verdadeira.
--
-- O QUE MUDA: apenas o bloco de classificação. `etapa_classificacao` deixa de
-- exigir `id_etapa_atual IS NOT NULL` e passa a ler de `etapa_referencia`, CTE
-- nova que resolve, para cada contrato ativo, a etapa contra a qual o prazo é
-- medido e a data-âncora da contagem. As 6 colunas originais, contrato_escopo,
-- etapa_atrasada e nps_escopo são VERBATIM de 20260914161230.
--
-- CREATE OR REPLACE, não DROP + CREATE: preserva a ACL de vw_estrategia_kpi
-- (mesmo raciocínio das duas migrations anteriores da view). É também a razão
-- de `mandatos_em_atraso` CONTINUAR na view: REPLACE não remove coluna, e
-- derrubar a view para remover uma coluna órfã custaria a ACL. Ela permanece
-- sem nenhum consumidor -- ver COMMENT no fim.
--
-- AD-051 -- ETAPA DE REFERÊNCIA (a reversão deliberada do "NÃO CLASSIFICÁVEL")
-- A migration anterior descartava o contrato com `id_etapa_atual IS NULL`,
-- argumentando (AD-005) que classificá-lo seria medir sobre dado inexistente.
-- O contra-argumento aceito por Pedro: `fat_contrato.dt_inicio` EXISTE e é
-- fato datado -- medir a partir dele não inventa nada. O que se assume é
-- apenas que o mandato deveria estar na primeira etapa, que é exatamente a
-- suposição que o Kanban já faz para desenhar o card
-- (queries/kanban.ts:172-178, `id_etapa_atual ?? idEtapaOrdem1` e
-- `dt_inicio da etapa ?? dt_inicio do contrato`). Esta CTE é a réplica em SQL
-- daquelas duas linhas -- o KPI e o board passam a contar a mesma coisa, que é
-- o que permite conferir um contra o outro na tela (KSM-09).
--
-- CONTINUA FORA DE TODA CONTAGEM (e portanto é o único vazamento possível do
-- fechamento): contrato cuja etapa de referência não tem
-- `duracao_prevista_dias` (nula ou <= 0). Sem duração não há percentual a
-- calcular, e forçá-lo em "normal" seria inventar o dado que AD-005 proíbe --
-- diferente do caso acima, onde a âncora real existe. `ref_etapa.
-- duracao_prevista_dias` é nullable (ck_etapa_duracao), mas nenhuma etapa dos
-- catálogos reais está sem duração hoje; o teste de integração guarda a
-- igualdade e denuncia se isso mudar.
--
-- LIMIAR INATIVO -> COLUNA NULL, NÃO 0: mantido de 20260914161230 (AD-005,
-- mesmo espírito de ref_limiar_pendencia.ativo em vw_pendencias). O
-- fechamento sobrevive porque o CASE também deixa de produzir aquele estado --
-- os contratos que cairiam nele descem para atencao/normal, e as colunas COM
-- valor continuam somando mandatos_ativos. É a mesma semântica de
-- classificarLimiar (src/frontend/lib/limiar.ts, AD-045) quando recebe um dos
-- dois parâmetros nulo.
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
-- AD-051. Uma linha por contrato ATIVO, com a etapa contra a qual o prazo é
-- medido e a data a partir da qual os dias correm. Réplica em SQL de
-- queries/kanban.ts:172-178.
etapa_referencia AS (
  SELECT
    c.id_contrato,
    COALESCE(e_atual.duracao_prevista_dias, e_ordem1.duracao_prevista_dias) AS duracao_ref,
    COALESCE(fec.dt_inicio, c.dt_inicio)                                    AS dt_ancora
  FROM fat_contrato c
  LEFT JOIN ref_etapa e_atual
         ON e_atual.id_etapa = c.id_etapa_atual
  -- Só materializa a etapa de ordem 1 quando NÃO há etapa atual: com a
  -- condição falsa, o LEFT JOIN LATERAL devolve NULL sem executar a
  -- subconsulta. `ORDER BY ordem LIMIT 1` e não `ordem = 1` porque a UNIQUE
  -- é (id_produto, ordem) e nada garante que a numeração comece em 1 -- a
  -- primeira etapa é a de menor ordem, que é também a coluna onde o Kanban
  -- desenha o card.
  LEFT JOIN LATERAL (
    SELECT e.duracao_prevista_dias
      FROM ref_etapa e
     WHERE e.id_produto = c.id_produto
     ORDER BY e.ordem
     LIMIT 1
  ) e_ordem1 ON c.id_etapa_atual IS NULL
  -- Não casa quando id_etapa_atual é NULL (NULL = NULL é desconhecido, não
  -- verdadeiro), e é exatamente por isso que dt_ancora cai em c.dt_inicio
  -- nesse caso -- sem precisar de um CASE explícito.
  LEFT JOIN fat_etapa_contrato fec
         ON fec.id_contrato = c.id_contrato
        AND fec.id_etapa    = c.id_etapa_atual
  WHERE c.status = 'ativo'
),
-- Réplica de classificarLimiar (src/frontend/lib/limiar.ts, T14/AD-045) em
-- SQL: mesma ordem de prioridade (atrasado testado antes de atencao), mesmo
-- `>=` (não `>`), mesma fonte dos dois percentuais. O CASE é TOTAL -- todo
-- contrato que chega aqui sai com exatamente um dos três estados --, e é
-- disso que vem o fechamento exigido por AD-050.
etapa_classificacao AS (
  SELECT
    er.id_contrato,
    CASE
      WHEN le.atrasado_pct_ativo IS NOT NULL
           AND ((CURRENT_DATE - er.dt_ancora)::numeric / er.duracao_ref * 100) >= le.atrasado_pct_ativo
        THEN 'atrasado'
      WHEN le.atencao_pct_ativo IS NOT NULL
           AND ((CURRENT_DATE - er.dt_ancora)::numeric / er.duracao_ref * 100) >= le.atencao_pct_ativo
        THEN 'atencao'
      ELSE 'normal'
    END AS estado
  FROM etapa_referencia er
  CROSS JOIN limiar_etapa le
  WHERE er.duracao_ref IS NOT NULL
    AND er.duracao_ref > 0
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
  -- Quebra por status do card "Mandatos ativos" (kpi-row.tsx,
  -- KpiMandatosAtivos). Mutuamente exclusivas por construção e, desde
  -- AD-050/AD-051, uma PARTIÇÃO de mandatos_ativos: as três somam o número
  -- grande em toda linha da view. Coluna inteira NULL quando o limiar
  -- correspondente está desligado -- MAX(le.*) é constante no grupo (mesmo
  -- padrão de MAX(nps.nps_medio) acima), e precisa ficar fora do FILTER
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
'EST-08 + AD-050/AD-051. Os KPIs do topo do Dashboard do produto, agregados na camada Saída (AD-003): mandatos_ativos, iip_medio, nps_medio, pct_atingimento_medio, nr_fatos_geradores, mais a quebra por status do card "Mandatos ativos" (mandatos_atraso_atrasados, mandatos_atraso_atencao, mandatos_atraso_normal). As 3 colunas de quebra PARTICIONAM mandatos_ativos: somam exatamente o total em toda linha, e essa igualdade é o contrato desta view com a tela (AD-050) -- a única exceção é o contrato cuja etapa de referência não tem duracao_prevista_dias, que fica fora das 3 e nunca é forçado em "normal" (AD-005). Classificação = réplica em SQL de classificarLimiar (src/frontend/lib/limiar.ts, AD-045) sobre a ETAPA DE REFERÊNCIA: a etapa atual do contrato, ou a etapa de menor ordem do produto quando não há transição registrada, ancorada em fat_etapa_contrato.dt_inicio ou, na falta dela, em fat_contrato.dt_inicio -- mesma regra que queries/kanban.ts usa para posicionar o card e contar dias (AD-051), de modo que KPI e Kanban contem a mesma coisa. ATENÇÃO: mandatos_em_atraso está ÓRFÃ -- nenhuma tela a consome desde AD-050, que removeu o card "Mandatos em atraso". Ela mede outra coisa (existe alguma etapa, inclusive nunca iniciada, cujo prazo PLANEJADO ORIGINAL já venceu) e foi justamente a convivência das duas definições na mesma faixa que produziu o card contraditório corrigido aqui. Permanece na view só porque CREATE OR REPLACE não remove coluna e DROP derrubaria a ACL; não a reintroduza numa tela. Uma linha por (produto × escopo de projeto × escopo de gestora); escopo_projeto/escopo_gestora dizem se a linha é recorte ou total, e o consumidor lê UMA linha em vez de somar várias. Só lê e agrega: IIP vem pronto de mv_iip_contrato e NPS de mv_avaliacao_nps (AD-014). Médias devolvem NULL sem amostra (AD-005, renderizado "—"); contagens devolvem 0, que ali é fato e não sentinela -- exceto as colunas de quebra, que devolvem NULL quando o limiar de ref_limiar_pendencia correspondente está inativo. nps_medio é NULL em toda linha de escopo_gestora: mv_avaliacao_nps não carrega id_contrato, logo NPS não é recortável por gestora.';
