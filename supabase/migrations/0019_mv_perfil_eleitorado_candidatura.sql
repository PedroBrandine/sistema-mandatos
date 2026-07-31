-- =============================================================================
-- T7: tse.mv_perfil_eleitorado_candidatura -- perfil demográfico do
-- eleitorado (gênero, faixa etária, grau de escolaridade) do município
-- principal de cada candidatura, formato longo (CAD-11, design.md).
--
-- Município principal: mesma lógica de desempate de tse.mv_candidatura_resumo
-- (mais votos, NULLS LAST -- docs/schema_sistema.sql:625-664) -- mas
-- preservando cd_municipio (código), não nm_municipio (nome), porque
-- tse.dim_perfil_eleitorado é chaveada por código de município, e nome não
-- é uma chave de join segura (design.md, "Por que não dá pra reusar
-- mv_candidatura_resumo direto").
--
-- Nunca lê tse.fat_votacao_zona fora desta definição de view (Risk & Concern
-- de design.md) -- toda agregação acontece uma vez aqui, refresh raro
-- (mesmo padrão de tse.mv_candidatura_resumo, T15/0010).
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'tse' AND matviewname = 'mv_perfil_eleitorado_candidatura') THEN
    EXECUTE $sql$
      CREATE MATERIALIZED VIEW tse.mv_perfil_eleitorado_candidatura AS
      WITH por_municipio AS (
        SELECT ano_eleicao, sq_candidato, nr_turno, cd_municipio,
               SUM(qt_votos_nominais_validos) AS votos_municipio
        FROM tse.fat_votacao_zona
        GROUP BY ano_eleicao, sq_candidato, nr_turno, cd_municipio
      ),
      municipio_principal AS (
        SELECT DISTINCT ON (ano_eleicao, sq_candidato, nr_turno)
               ano_eleicao, sq_candidato, nr_turno, cd_municipio
        FROM por_municipio
        ORDER BY ano_eleicao, sq_candidato, nr_turno, votos_municipio DESC NULLS LAST
      ),
      perfil AS (
        SELECT ano_eleicao, cd_municipio, 'genero'::TEXT AS dimensao, ds_genero AS categoria,
               SUM(qt_eleitores) AS qt_eleitores
        FROM tse.dim_perfil_eleitorado
        GROUP BY ano_eleicao, cd_municipio, ds_genero
        UNION ALL
        SELECT ano_eleicao, cd_municipio, 'faixa_etaria'::TEXT AS dimensao, ds_faixa_etaria AS categoria,
               SUM(qt_eleitores) AS qt_eleitores
        FROM tse.dim_perfil_eleitorado
        GROUP BY ano_eleicao, cd_municipio, ds_faixa_etaria
        UNION ALL
        SELECT ano_eleicao, cd_municipio, 'grau_escolaridade'::TEXT AS dimensao, ds_grau_escolaridade AS categoria,
               SUM(qt_eleitores) AS qt_eleitores
        FROM tse.dim_perfil_eleitorado
        GROUP BY ano_eleicao, cd_municipio, ds_grau_escolaridade
      )
      SELECT m.ano_eleicao,
             m.sq_candidato,
             m.nr_turno,
             p.dimensao,
             p.categoria,
             p.qt_eleitores
      FROM municipio_principal m
      JOIN perfil p
        ON p.ano_eleicao = m.ano_eleicao AND p.cd_municipio = m.cd_municipio
      WITH NO DATA
    $sql$;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_perfil_eleitorado_candidatura
  ON tse.mv_perfil_eleitorado_candidatura (ano_eleicao, sq_candidato, nr_turno, dimensao, categoria);

COMMENT ON MATERIALIZED VIEW tse.mv_perfil_eleitorado_candidatura IS
'Perfil demográfico do eleitorado (gênero, faixa etária, grau de escolaridade) do município principal de cada candidatura, formato longo (dimensao/categoria/qt_eleitores). Índice UNIQUE obrigatório para REFRESH MATERIALIZED VIEW CONCURRENTLY. Refresh apenas após carga de safra (evento raro), mesmo padrão de tse.mv_candidatura_resumo.';

-- Re-GRANT necessário (mesmo motivo do re-GRANT de rel_mandato_candidatura
-- em 0010): view nova em tse, GRANT SELECT ON ALL TABLES IN SCHEMA tse não é
-- retroativo pra objetos criados depois.
GRANT SELECT ON tse.mv_perfil_eleitorado_candidatura TO legisla_app, legisla_admin, legisla_gestora;
