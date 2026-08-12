-- =============================================================================
-- operacao-regua-instanciacao: T3 — Grants das 3 tabelas + view criadas em
-- regua_instanciacao_estrutura.sql.
--
-- Re-GRANT obrigatório (AD-025, provisionamento incremental): "ALL TABLES IN
-- SCHEMA public" só cobre as tabelas que já existiam no momento do GRANT
-- anterior (0004/.../catalogos_referencia_grants) -- mesmo padrão de todas
-- as migrations que já criaram tabela nova em public.
--
-- Mentor/assessor: linhas do GRANT aprovado (docs/schema_sistema.sql:
-- 2084-2098) que agora têm tabela real para apontar --
--   mentor:    fat_etapa_contrato, rel_formulario_contrato, dim_planejamento,
--              vw_etapa_contrato (linha 2086-2088)
--   assessor:  dim_planejamento, rel_formulario_contrato (linha 2096-2097;
--              fat_objetivo_especifico/fat_meta/ref_formulario/vw_sucesso_mensal
--              dessa mesma linha ainda não existem -- fora do escopo)
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;

GRANT SELECT ON
  fat_etapa_contrato, rel_formulario_contrato, dim_planejamento, vw_etapa_contrato
  TO legisla_mentor;

GRANT SELECT ON
  dim_planejamento, rel_formulario_contrato
  TO legisla_assessor;
