-- =============================================================================
-- planejamento-planilha-monitoramento: T3 -- Grants das 4 tabelas + view
-- criadas em planejamento_planilha_estrutura.sql.
--
-- Re-GRANT obrigatório (AD-025, provisionamento incremental): "ALL TABLES IN
-- SCHEMA public" só cobre as tabelas que já existiam no momento do GRANT
-- anterior -- mesmo padrão de todas as migrations que já criaram tabela nova
-- em public.
--
-- Mentor/assessor: fatia do GRANT aprovado (docs/schema_sistema.sql:2080-2098)
-- que agora tem tabela real pra apontar --
--   mentor:    SELECT+INSERT+UPDATE em fat_sucesso_mensal (linha 2080-2082);
--              SELECT em fat_objetivo_especifico/fat_meta/vw_sucesso_mensal
--              (linha 2084-2088; dim_planejamento já concedida pela régua)
--   assessor:  SELECT+UPDATE (tabela inteira, não lista de colunas -- ver
--              design.md "Achado de Design") em fat_sucesso_mensal
--              (linha 2093); SELECT em fat_objetivo_especifico/fat_meta/
--              vw_sucesso_mensal (linha 2095-2098; dim_planejamento já
--              concedida pela régua)
-- rel_planejamento_preditor: NENHUM grant a mentor/assessor -- não está em
-- nenhuma das duas listas do aprovado (leitura literal, não lacuna a corrigir).
--
-- Achado novo (design.md): sequence de fat_sucesso_mensal precisa de GRANT
-- explícito pro Mentor -- é a primeira feature desde o bootstrap (0004) a dar
-- ao Mentor um INSERT de verdade; sem isso, o primeiro INSERT do Mentor falha
-- em nextval() com 42501.
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;

GRANT SELECT, INSERT, UPDATE ON fat_sucesso_mensal TO legisla_mentor;
GRANT SELECT ON fat_objetivo_especifico, fat_meta, vw_sucesso_mensal TO legisla_mentor;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO legisla_mentor;

GRANT SELECT, UPDATE ON fat_sucesso_mensal TO legisla_assessor;
GRANT SELECT ON fat_objetivo_especifico, fat_meta, vw_sucesso_mensal TO legisla_assessor;
