-- =============================================================================
-- pll-cadastro-participantes: T2 -- GRANTs de fat_cadastro_participante.
--
-- Re-GRANT em bloco (AD-025): "ALL TABLES/SEQUENCES IN SCHEMA public" só
-- cobre o que já existia no momento do GRANT anterior -- mesmo padrão de toda
-- migration que já criou tabela nova em public (ex.:
-- 20260813192816_incidencia_encontros_grants.sql).
--
-- Só os 3 papéis previstos no design (Gestora/Admin CRUD completo; Mentor
-- SELECT/UPDATE da própria carteira, decidido pela RLS): Assessor fica de
-- fora por completo (Out of Scope da spec) -- sem GRANT nenhum, nem SELECT.
-- Mentor recebe INSERT também: a spec não distingue "quem cria" de "quem
-- edita" para Mentor (PLL-CP-20…22, Desafios/Destaques/Ambição são editados
-- por Mentor ou Gestora) -- a RLS (id_contrato na própria carteira) já
-- restringe quais linhas.
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;

GRANT SELECT, INSERT, UPDATE ON fat_cadastro_participante TO legisla_mentor;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO legisla_mentor;
