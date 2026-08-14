-- =============================================================================
-- visao-gerencial-g3-g6 (.specs/features/visao-gerencial-g3-g6/): T6 --
-- vw_resposta_formulario_mensal (G4 evolução, GER-08). Mesmo padrão de T4/T5
-- -- 1 linha por mês (últimos 12), LEFT JOIN contra a série completa de
-- meses (achado de T5: GROUP BY direto omite mês sem nenhuma abertura, ao
-- invés de aparecer com taxa_media NULL -- corrigido aqui desde o início).
--
-- "Abertura no mês" = rel_formulario_contrato.dt_abertura <= fim_do_mes
-- (formulário já tinha sido aberto até aquele ponto, independente de já ter
-- fechado depois). "Respondida até o mês" = existe fat_submissao com
-- enviada_em <= fim_do_mes pra esse (contrato, formulário) -- mesma
-- definição de "respondido" de vw_resposta_formulario (T2), só que avaliada
-- num ponto do passado em vez de agora.
-- =============================================================================

CREATE VIEW vw_resposta_formulario_mensal WITH (security_invoker = true) AS
WITH meses AS (
  SELECT generate_series(
    date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
    date_trunc('month', CURRENT_DATE),
    INTERVAL '1 month'
  )::date AS mes_referencia
), fim_mes AS (
  SELECT mes_referencia, (mes_referencia + INTERVAL '1 month' - INTERVAL '1 day')::date AS fim_do_mes
  FROM meses
), aberturas_no_mes AS (
  SELECT fm.mes_referencia, fm.fim_do_mes, rfc.id_contrato, rfc.id_formulario
  FROM fim_mes fm
  JOIN rel_formulario_contrato rfc ON rfc.dt_abertura <= fm.fim_do_mes
), respondido_no_mes AS (
  SELECT am.mes_referencia, am.id_contrato, am.id_formulario,
         EXISTS (
           SELECT 1 FROM fat_submissao fs
            WHERE fs.id_contrato = am.id_contrato AND fs.id_formulario = am.id_formulario
              AND fs.enviada_em <= am.fim_do_mes
         ) AS tem_resposta
  FROM aberturas_no_mes am
), agregado AS (
  SELECT mes_referencia,
         COUNT(*) AS qtd_aberturas,
         COUNT(*) FILTER (WHERE tem_resposta) AS qtd_respondidas
  FROM respondido_no_mes
  GROUP BY mes_referencia
)
SELECT fm.mes_referencia,
       COALESCE(ag.qtd_aberturas, 0) AS qtd_aberturas,
       COALESCE(ag.qtd_respondidas, 0) AS qtd_respondidas,
       CASE WHEN COALESCE(ag.qtd_aberturas, 0) = 0 THEN NULL
            ELSE ROUND(100.0 * ag.qtd_respondidas / ag.qtd_aberturas, 2)
       END AS taxa_media
FROM fim_mes fm
LEFT JOIN agregado ag ON ag.mes_referencia = fm.mes_referencia;

COMMENT ON VIEW vw_resposta_formulario_mensal IS
'Evolução mensal de G4 (visao-gerencial-g3-g6, T6). 1 linha por mês (últimos 12), taxa média de resposta entre formulários já abertos até o fim daquele mês. taxa_media NULL quando qtd_aberturas = 0 (AD-005), nunca 0, e o mês nunca é omitido (mesmo achado de T5).';

-- Re-GRANT obrigatório (AD-025) -- mesmo padrão de T1/T2/T4/T5.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
