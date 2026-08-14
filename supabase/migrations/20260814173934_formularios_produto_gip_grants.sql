-- =============================================================================
-- formularios-produto: T7 -- Grants de fat_gip + fat_gip_dimensao (T5).
--
-- Re-GRANT explícito (AD-025, provisionamento incremental): "ALL TABLES IN
-- SCHEMA public" só cobre as tabelas que já existiam no momento do GRANT
-- anterior -- mesmo padrão de toda migration que já criou tabela nova em
-- public (régua-instanciação, convite-contrato, catalogos-referencia).
--
-- legisla_app/admin/gestora: full (única via que efetivamente escreve --
-- GIP é respondente='gestora' no catálogo, sem caso previsto de Mentor/
-- Assessor aplicando). NENHUM grant a legisla_mentor/legisla_assessor: a
-- derivação (T8) escreve via trigger SECURITY DEFINER, que não depende de
-- GRANT do papel que disparou o INSERT em fat_submissao.
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON fat_gip, fat_gip_dimensao
  TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
