-- =============================================================================
-- saida-numeros-impacto: T4 -- GRANT SELECT em vw_gip_evolucao (achado real de
-- Design, ver design.md "Risks & Concerns"). A view já existe desde
-- formularios-produto (20260814174709_formularios_produto_gip_view.sql, T9)
-- mas NUNCA recebeu nenhum GRANT -- confirmado por grep exaustivo em
-- supabase/migrations/, zero ocorrência de GRANT citando esta view. Sem esta
-- migration, nenhuma role legisla_* (nem legisla_gestora) consegue ler
-- vw_gip_evolucao, mesmo já tendo GRANT nas tabelas de base (fat_gip/
-- fat_gip_dimensao/ref_dimensao_gip) -- security_invoker = true não herda
-- GRANT da view em si, só das tabelas de base (mesmo achado documentado em
-- vw_iip_contrato, 20260813194110_incidencia_encontros_iip.sql).
--
-- Escopo de papel idêntico ao de fat_gip/fat_gip_dimensao
-- (20260814173934_formularios_produto_gip_grants.sql, T7): só
-- legisla_app/admin/gestora -- nenhum caso previsto de Mentor/Assessor
-- respondendo ou lendo GIP.
-- =============================================================================

GRANT SELECT ON vw_gip_evolucao TO legisla_app, legisla_admin, legisla_gestora;
