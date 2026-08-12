-- =============================================================================
-- visao-gerencial-g1-g2: T7 -- grants das 3 views novas (vw_carteira,
-- vw_carteira_ponderada, vw_ciclo_etapa -- T4/T5/T6).
--
-- Re-GRANT obrigatório (AD-025, provisionamento incremental): "ALL TABLES IN
-- SCHEMA public" só cobre as relations que já existiam no momento do GRANT
-- anterior -- as 3 views novas precisam entrar aqui para app/admin/gestora
-- terem SELECT (mesmo padrão de 20260812001310_regua_instanciacao_grants.sql,
-- que fez o mesmo pra vw_etapa_contrato).
--
-- Mentor/assessor: SELECT explícito nas 3 views, mesma leitura de
-- rel_usuario_contrato/fat_contrato/dim_planejamento que já alimentam essas
-- views (RLS de p_por_carteira/p_por_contrato já resolve quem vê o quê --
-- design.md, Integration Points). Sem GRANT a `authenticated`/`anon`: estas
-- views derivam de dado transacional de carteira, não são catálogo de
-- referência (diferente de ref_peso_etapa/T2) -- mesmo padrão de
-- regua_instanciacao_grants.sql, que também não deu SELECT a `authenticated`
-- em fat_etapa_contrato/dim_planejamento/vw_etapa_contrato.
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;

GRANT SELECT ON vw_carteira, vw_carteira_ponderada, vw_ciclo_etapa
  TO legisla_mentor, legisla_assessor;
