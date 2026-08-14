-- =============================================================================
-- visao-gerencial-g3-g6 (.specs/features/visao-gerencial-g3-g6/): T5 --
-- vw_cobertura_registro_mensal (G3 evolução, GER-07). Mesmo padrão de
-- reconstrução via generate_series de T4 -- "contrato ativo naquele mês" é
-- derivado de fat_contrato.dt_inicio/dt_fim (não do campo status, que é
-- estado atual, não histórico): dt_inicio <= fim_do_mes AND (dt_fim IS NULL
-- OR dt_fim > fim_do_mes). "Com registro" = existe fat_registro.ocorrido_em
-- nos 45 dias anteriores ao fim daquele mês -- mesma janela de 45 dias já
-- usada em vw_pendencias (categoria sem_registro_recente, T1), TODO(limiares)
-- também vale aqui (AD-004).
--
-- pct_cobertura é NULL quando não há nenhum contrato ativo naquele mês --
-- nunca 0 (AD-005). Achado real (não estava no design.md original): um
-- GROUP BY direto sobre a CTE de contratos ativos OMITE o mês inteiro quando
-- zero contratos estão ativos (GROUP BY não produz grupo pra ausência de
-- linha) -- contradiz a própria regra acima, que exige a linha existir com
-- qtd_ativos = 0, não desaparecer. Corrigido com LEFT JOIN de `fim_mes`
-- (sempre 12 linhas, os 12 meses) contra o agregado.
-- =============================================================================

CREATE VIEW vw_cobertura_registro_mensal WITH (security_invoker = true) AS
WITH meses AS (
  SELECT generate_series(
    date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
    date_trunc('month', CURRENT_DATE),
    INTERVAL '1 month'
  )::date AS mes_referencia
), fim_mes AS (
  SELECT mes_referencia, (mes_referencia + INTERVAL '1 month' - INTERVAL '1 day')::date AS fim_do_mes
  FROM meses
), contratos_ativos AS (
  SELECT fm.mes_referencia, fm.fim_do_mes, c.id_contrato
  FROM fim_mes fm
  JOIN fat_contrato c
    ON c.dt_inicio <= fm.fim_do_mes
   AND (c.dt_fim IS NULL OR c.dt_fim > fm.fim_do_mes)
), com_registro AS (
  SELECT ca.mes_referencia, ca.id_contrato,
         EXISTS (
           SELECT 1 FROM fat_registro r
            WHERE r.id_contrato = ca.id_contrato
              AND r.ocorrido_em BETWEEN (ca.fim_do_mes - INTERVAL '45 days') AND ca.fim_do_mes
         ) AS tem_registro
  FROM contratos_ativos ca
), agregado AS (
  SELECT mes_referencia,
         COUNT(*) AS qtd_ativos,
         COUNT(*) FILTER (WHERE tem_registro) AS qtd_com_registro
  FROM com_registro
  GROUP BY mes_referencia
)
SELECT fm.mes_referencia,
       COALESCE(ag.qtd_ativos, 0) AS qtd_ativos,
       COALESCE(ag.qtd_com_registro, 0) AS qtd_com_registro,
       CASE WHEN COALESCE(ag.qtd_ativos, 0) = 0 THEN NULL
            ELSE ROUND(100.0 * ag.qtd_com_registro / ag.qtd_ativos, 2)
       END AS pct_cobertura
FROM fim_mes fm
LEFT JOIN agregado ag ON ag.mes_referencia = fm.mes_referencia;

COMMENT ON VIEW vw_cobertura_registro_mensal IS
'Evolução mensal de G3 (visao-gerencial-g3-g6, T5). 1 linha por mês (últimos 12), % de contratos ativos naquele mês com registro nos 45 dias anteriores ao fim do mês. pct_cobertura NULL quando qtd_ativos = 0 (AD-005). TODO(limiares): janela de 45 dias hoje escrita na view, mover pra tabela de referência quando existir (AD-004).';

-- Re-GRANT obrigatório (AD-025) -- mesmo padrão de T1/T2/T4.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
