-- =============================================================================
-- saida-numeros-impacto: T1 -- mv_numeros_impacto (verbatim
-- docs/schema_sistema.sql:1205-1245, AD-008) + índice único + comentário +
-- refresh inicial não-concorrente (a MV nasce WITH NO DATA -- REFRESH
-- CONCURRENTLY exige que ela já tenha sido populada ao menos 1x sem
-- CONCURRENTLY antes, design.md "Risks & Concerns").
--
-- Sem GRANT/RPC de refresh ainda -- T2 adiciona app.atualiza_numeros_impacto()
-- (SECURITY DEFINER, AD-035) e o GRANT SELECT a legisla_gestora/legisla_admin
-- (AD-036). Até lá, a MV existe mas nenhuma role legisla_* consegue lê-la via
-- PostgREST (relação nova, AD-025) -- esperado nesta task, corrigido em T2.
-- =============================================================================

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
       m.fl_pcd,
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
WITH NO DATA;

CREATE UNIQUE INDEX uq_mv_numeros_impacto ON mv_numeros_impacto (id_contrato);

COMMENT ON MATERIALIZED VIEW mv_numeros_impacto IS
'Única porta de saída dos números de impacto — ninguém consulta fat_contrato cru. Sem filtro de status desde D4: todo contrato é contrato assinado. Refresh diário CONCURRENTLY. Não respeita RLS: acesso por GRANT a papéis Legisla.';

-- Primeira carga (WITH NO DATA na criação) -- pré-requisito pra REFRESH
-- CONCURRENTLY funcionar em T2 (app.atualiza_numeros_impacto).
REFRESH MATERIALIZED VIEW mv_numeros_impacto;
