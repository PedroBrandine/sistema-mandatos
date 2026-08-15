-- =============================================================================
-- formularios-produto: T10 -- mv_avaliacao_nps, verbatim
-- docs/schema_sistema.sql:1272-1297 (AD-008), WITH NO DATA + índice único +
-- grants. Confirmado por introspecção antes desta migration: a MV ainda não
-- existia no projeto de dev.
--
-- GRANT SELECT só para legisla_app/legisla_admin/legisla_gestora (FRM-23 --
-- nunca legisla_mentor/legisla_assessor; schema aprovado revoga
-- explicitamente `:2103-2104`). Re-GRANT explícito porque "ALL TABLES IN
-- SCHEMA public" já rodou antes desta MV existir (AD-025, mesmo padrão de T3/T7).
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'mv_avaliacao_nps') THEN
    EXECUTE $sql$
      -- Uma linha = formulário × projeto × métrica.
      CREATE MATERIALIZED VIEW mv_avaliacao_nps AS
      SELECT s.id_formulario,
             COALESCE(c.id_projeto, 0)                                AS id_projeto_grupo,
             rm.id_metrica,
             rm.rotulo,
             rm.agrupador,
             rm.eh_nps,
             COUNT(*)                                                 AS nr_respostas,
             ROUND(AVG(r.valor_num), 2)                               AS media,
             COUNT(*) FILTER (WHERE rm.eh_nps AND r.valor_num >= 9)   AS promotores,
             COUNT(*) FILTER (WHERE rm.eh_nps AND r.valor_num BETWEEN 7 AND 8) AS neutros,
             COUNT(*) FILTER (WHERE rm.eh_nps AND r.valor_num <= 6)   AS detratores,
             CASE WHEN rm.eh_nps AND COUNT(*) > 0 THEN ROUND(
                    (COUNT(*) FILTER (WHERE r.valor_num >= 9)
                   - COUNT(*) FILTER (WHERE r.valor_num <= 6)) * 100.0 / COUNT(*), 2)
             END                                                      AS nps
      FROM fat_resposta_metrica r
      JOIN ref_metrica_formulario rm ON rm.id_metrica = r.id_metrica
      JOIN fat_submissao s           ON s.id_submissao = r.id_submissao
      JOIN fat_contrato c            ON c.id_contrato = s.id_contrato
      WHERE r.valor_num IS NOT NULL
      GROUP BY s.id_formulario, COALESCE(c.id_projeto, 0), rm.id_metrica, rm.rotulo, rm.agrupador, rm.eh_nps
      WITH NO DATA
    $sql$;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_avaliacao_nps
  ON mv_avaliacao_nps (id_formulario, id_projeto_grupo, id_metrica);

COMMENT ON MATERIALIZED VIEW mv_avaliacao_nps IS
'Substitui a aba "Médias e NPS", que hoje é planilha calculada. Agregação sobre fat_resposta_metrica (~120 mil linhas em 5 anos) em vez de jsonb_path_query sobre o histórico de submissões.';

-- Achado real (mesmo bloqueio já documentado em
-- 20260813191715_incidencia_encontros_estrutura.sql para mv_iip_contrato):
-- REFRESH MATERIALIZED VIEW CONCURRENTLY (usado por
-- app.atualiza_avaliacao_nps(), T11) exige que a MV já tenha sido populada
-- ao menos 1x SEM CONCURRENTLY -- criar WITH NO DATA e ir direto pra
-- CONCURRENTLY falha com "materialized view has not been populated". Roda
-- sempre (fora do IF NOT EXISTS acima) -- idempotente: um REFRESH recalcula
-- a partir de fat_resposta_metrica, nunca destrói dado.
REFRESH MATERIALIZED VIEW mv_avaliacao_nps;

-- Re-GRANT explícito (AD-025) -- só os 3 papéis Legisla enxergam o NPS
-- agregado (FRM-23).
GRANT SELECT ON mv_avaliacao_nps TO legisla_app, legisla_admin, legisla_gestora;
