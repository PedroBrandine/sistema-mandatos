-- =============================================================================
-- numeros-impacto-dashboard: adiciona gestora (rel_usuario_contrato,
-- papel_no_contrato='gestora') e ds_orientacao_sexual a mv_numeros_impacto,
-- pra alimentar filtro de gestora e gráfico de % orientação sexual na tela
-- "Números de Impacto" (dashboard pedido pelo Pedro pra apresentação de
-- 2026-09-22).
--
-- ds_raca/ds_genero/fl_pcd já existiam na MV desde a T1 original
-- (20260831021516) -- só nunca tinham entrado em COLUNAS_NUMEROS_IMPACTO no
-- frontend. Este migration não mexe neles.
--
-- Gestora entra por LATERAL (não LEFT JOIN direto): rel_usuario_contrato não
-- garante 1 gestora ativa por contrato no schema (uq_vinculo é por
-- contrato+usuário+papel, não por contrato+papel) -- um LEFT JOIN direto
-- poderia duplicar id_contrato e quebrar uq_mv_numeros_impacto. O LATERAL
-- pega no máximo 1 (a mais recente por dt_inicio), mesma garantia de
-- cardinalidade que a MV já tinha.
--
-- MV precisa ser recriada por inteiro (ALTER não adiciona coluna a
-- MATERIALIZED VIEW) -- índice único, comentário e GRANT são recriados no
-- mesmo arquivo. REFRESH CONCURRENTLY exige população não-concorrente antes
-- (mesma ressalva da T1); como CREATE MATERIALIZED VIEW ... AS já popula com
-- dados (sem WITH NO DATA), esse pré-requisito fica satisfeito aqui mesmo.
-- =============================================================================

DROP MATERIALIZED VIEW mv_numeros_impacto;

CREATE MATERIALIZED VIEW mv_numeros_impacto AS
SELECT c.id_contrato,
       c.id_contratante,
       ct.nome                AS nome_contratante,
       ct.tipo_contratante,
       ct.sg_uf,
       ct.nm_municipio,
       c.id_produto,
       p.nome                 AS nome_produto,
       c.id_projeto,
       pj.nome                AS nome_projeto,
       pj.tematica,
       c.dt_inicio,
       c.dt_fim,
       EXTRACT(YEAR FROM c.dt_inicio)::INT AS ano_inicio,
       c.status,
       c.profundidade_impacto,
       cg.nome                AS cargo_no_contrato,
       cg.nivel_federativo,
       pt.sigla               AS partido_no_contrato,
       m.ds_raca,
       m.ds_genero,
       m.ds_orientacao_sexual,
       m.fl_pcd,
       gu.id_usuario           AS id_gestora,
       gu.nome                 AS nome_gestora,
       -- Agregações que substituem "Nº de produtos" (divergia em 46 contratantes)
       -- e "Ano da 1ª vez" (divergia em 41).
       COUNT(*)      OVER (PARTITION BY c.id_contratante) AS nr_contratos_contratante,
       MIN(c.dt_inicio) OVER (PARTITION BY c.id_contratante) AS dt_primeira_contratacao,
       ROW_NUMBER()  OVER (PARTITION BY c.id_contratante ORDER BY c.dt_inicio) AS ordem_contrato
FROM fat_contrato c
JOIN dim_contratante ct  ON ct.id_contratante = c.id_contratante
JOIN ref_produto p       ON p.id_produto = c.id_produto
LEFT JOIN ref_projeto pj ON pj.id_projeto = c.id_projeto
LEFT JOIN ref_cargo cg   ON cg.id_cargo = c.id_cargo_no_contrato
LEFT JOIN ref_partido pt ON pt.id_partido = c.id_partido_no_contrato
LEFT JOIN dim_mandato m  ON m.id_contratante = c.id_contratante
LEFT JOIN LATERAL (
  SELECT rv.id_usuario, u.nome
  FROM rel_usuario_contrato rv
  JOIN dim_usuario u ON u.id_usuario = rv.id_usuario
  WHERE rv.id_contrato = c.id_contrato
    AND rv.papel_no_contrato = 'gestora'
    AND rv.dt_fim IS NULL
  ORDER BY rv.dt_inicio DESC
  LIMIT 1
) gu ON true;

CREATE UNIQUE INDEX uq_mv_numeros_impacto ON mv_numeros_impacto (id_contrato);

COMMENT ON MATERIALIZED VIEW mv_numeros_impacto IS
'Única porta de saída dos números de impacto — ninguém consulta fat_contrato cru. Sem filtro de status desde D4: todo contrato é contrato assinado. Refresh diário CONCURRENTLY. Não respeita RLS: acesso por GRANT a papéis Legisla.';

GRANT SELECT ON mv_numeros_impacto TO legisla_gestora, legisla_admin;
