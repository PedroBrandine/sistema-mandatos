-- =============================================================================
-- pll-cadastro-participantes: T2 (correção forward-only) -- REVOKE de
-- anon/authenticated em fat_cadastro_participante.
--
-- Achado real (T2 integration test, mesma classe já documentada em
-- 20260812001921_convite_contrato_estrutura.sql e
-- 20260911023609_estrategia_fat_prospeccao_estrutura.sql, "ALTER DEFAULT
-- PRIVILEGES do baseline do Supabase concede CRUD completo a anon/
-- authenticated em toda tabela nova de public"): a migration de estrutura
-- (20260922072328) não revogou isso, e o teste de integração pegou anon com
-- SELECT/INSERT/UPDATE/DELETE reais na tabela nova -- violação de AD-002
-- ("nenhum acesso é anônimo"). Correção forward-only: a migration de
-- estrutura já foi aplicada no dev compartilhado, não é editada
-- retroativamente (CLAUDE.md, "migrations forward-only").
-- =============================================================================

REVOKE ALL ON public.fat_cadastro_participante FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.fat_cadastro_participante_id_cadastro_participante_seq FROM anon, authenticated;
