-- =============================================================================
-- formularios-produto: T3 -- grants de fat_submissao/fat_resposta_metrica.
--
-- Re-GRANT em bloco (AD-025): "ALL TABLES/SEQUENCES IN SCHEMA public" só cobre
-- o que já existia no momento do GRANT anterior -- as 2 tabelas desta feature
-- são novas.
--
-- legisla_mentor/legisla_assessor: SELECT, INSERT, UPDATE só em
-- fat_submissao, verbatim docs/schema_sistema.sql:2082/2094 (subconjunto do
-- GRANT aprovado). Nenhum grant em fat_resposta_metrica -- escrita só pelo
-- trigger SECURITY DEFINER (T4), leitura só pelas roles Legisla (mesmo
-- padrão de risco já corrigido em planejamento-planilha-monitoramento,
-- AD-035).
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON fat_submissao, fat_resposta_metrica
  TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;

GRANT SELECT, INSERT, UPDATE ON fat_submissao TO legisla_mentor;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO legisla_mentor;

GRANT SELECT, INSERT, UPDATE ON fat_submissao TO legisla_assessor;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO legisla_assessor;
