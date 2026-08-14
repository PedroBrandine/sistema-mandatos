-- =============================================================================
-- visao-gerencial-g3-g6 (.specs/features/visao-gerencial-g3-g6/): T4 --
-- vw_carteira_ponderada_mensal (G1 evolução, GER-12). design.md, "Novos
-- objetos de banco" -- reconstrução histórica via generate_series: G1 é
-- indicador DERIVADO (Constituição §2.6, seção 3 do pedido original) --
-- deriva das transições de fat_etapa_contrato, sem depender de snapshot.
--
-- Pra cada um dos últimos 12 meses (mes_referencia = 1º dia do mês, mesmo
-- padrão de fat_sucesso_mensal.mes_referencia), reconstrói "como estava no
-- fim daquele mês": qual etapa cada contrato estava (fat_etapa_contrato.
-- dt_inicio <= fim_do_mes AND (dt_conclusao IS NULL OR dt_conclusao >
-- fim_do_mes)) e qual Gestora tinha vínculo ativo naquele fim de mês
-- (rel_usuario_contrato.dt_inicio <= fim_do_mes AND (dt_fim IS NULL OR
-- dt_fim > fim_do_mes)) -- mesma regra de "vínculo ativo" já usada em
-- vw_carteira_ponderada/vw_ciclo_etapa, só que avaliada num ponto do
-- passado, não em CURRENT_DATE.
--
-- Deliberadamente NÃO filtra fat_contrato.status = 'ativo': um contrato já
-- encerrado hoje ainda contava pra carteira da Gestora no mês em que estava
-- em andamento -- é exatamente o que a evolução histórica precisa mostrar.
--
-- ROW_NUMBER() garante 1 linha por (mes_referencia, id_contrato) mesmo se
-- mais de uma etapa "parecesse" aberta simultaneamente (não deveria
-- acontecer pela regra de negócio, defensivo mesmo assim -- pega a de
-- dt_inicio mais recente, a etapa "atual" daquele momento).
--
-- Nenhum backbone de dim_usuario aqui (diferente de buscarCarteiraPonderada
-- em TS) -- a view só devolve linha bruta por mês×Gestora×contrato; o
-- zero-fill de Gestora sem carteira naquele mês é responsabilidade da camada
-- de query (buscarCarteiraPonderadaMensal, T12), mesmo padrão já usado por
-- vw_carteira_ponderada hoje.
-- =============================================================================

CREATE VIEW vw_carteira_ponderada_mensal WITH (security_invoker = true) AS
WITH meses AS (
  SELECT generate_series(
    date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
    date_trunc('month', CURRENT_DATE),
    INTERVAL '1 month'
  )::date AS mes_referencia
), fim_mes AS (
  SELECT mes_referencia, (mes_referencia + INTERVAL '1 month' - INTERVAL '1 day')::date AS fim_do_mes
  FROM meses
), etapa_no_mes AS (
  SELECT fm.mes_referencia, fm.fim_do_mes, ec.id_contrato, ec.id_etapa,
         ROW_NUMBER() OVER (PARTITION BY fm.mes_referencia, ec.id_contrato ORDER BY ec.dt_inicio DESC) AS rn
  FROM fim_mes fm
  JOIN fat_etapa_contrato ec
    ON ec.dt_inicio <= fm.fim_do_mes
   AND (ec.dt_conclusao IS NULL OR ec.dt_conclusao > fm.fim_do_mes)
)
SELECT en.mes_referencia,
       ruc.id_usuario AS id_usuario_gestora,
       u.nome AS nome_gestora,
       c.id_produto,
       en.id_contrato,
       pe.peso
FROM etapa_no_mes en
JOIN fat_contrato c ON c.id_contrato = en.id_contrato
JOIN rel_usuario_contrato ruc
  ON ruc.id_contrato = en.id_contrato AND ruc.papel_no_contrato = 'gestora'
 AND ruc.dt_inicio <= en.fim_do_mes AND (ruc.dt_fim IS NULL OR ruc.dt_fim > en.fim_do_mes)
JOIN dim_usuario u ON u.id_usuario = ruc.id_usuario
LEFT JOIN ref_peso_etapa pe ON pe.id_etapa = en.id_etapa
WHERE en.rn = 1;

COMMENT ON VIEW vw_carteira_ponderada_mensal IS
'Evolução mensal de G1 (visao-gerencial-g3-g6, T4). 1 linha por (mês, Gestora, contrato) nos últimos 12 meses, reconstruída via generate_series sobre fat_etapa_contrato/rel_usuario_contrato -- nenhum snapshot, G1 é indicador derivado. peso NULL quando falta seed em ref_peso_etapa (LEFT JOIN, mesmo padrão de vw_carteira_ponderada) -- nunca assumir peso 1.';

-- Re-GRANT obrigatório (AD-025) -- mesmo padrão de T1/T2.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
