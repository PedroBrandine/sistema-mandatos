-- =============================================================================
-- visao-gerencial-g1-g2: T2 -- GRANT-only + RLS-disable de ref_peso_etapa
-- (T1). Mesma exceção AD-030 já aplicada às 12 tabelas ref_* da Trilha C:
-- catálogo somente-leitura sem id_contrato/carteira pra filtrar por linha --
-- controle é só por GRANT, não por policy de RLS.
--
--   Leitura : authenticated + as 5 roles legisla_* (app/admin/gestora/mentor/assessor)
--   Escrita : legisla_app/legisla_admin/legisla_gestora (via re-GRANT em bloco, AD-025)
--   anon    : EXCLUÍDO -- AD-002 é regra inegociável sem exceção para catálogo
--
-- Combinado num só arquivo o padrão que na Trilha C ficou em 2 migrations
-- (20260810192209_catalogos_referencia_grants.sql +
-- 20260810193545_catalogos_referencia_revoke_default_privileges.sql): o
-- achado que motivou o 2º arquivo lá (ALTER DEFAULT PRIVILEGES do baseline do
-- projeto concede CRUD completo a anon/authenticated em toda tabela nova de
-- public) já é conhecido aqui, então o REVOKE explícito entra desde já, sem
-- precisar de uma migração de correção separada depois.
--
-- ALTER TABLE ... DISABLE ROW LEVEL SECURITY é redundante para tabela nova
-- (RLS já nasce desligada por padrão), mas fica explícito de propósito -- é a
-- documentação em SQL da exceção AD-030.
-- =============================================================================

ALTER TABLE public.ref_peso_etapa DISABLE ROW LEVEL SECURITY;

-- Re-GRANT obrigatório (AD-025, provisionamento incremental): "ALL TABLES IN
-- SCHEMA public" só cobre as tabelas que já existiam no momento do GRANT
-- anterior -- ref_peso_etapa (T1) precisa entrar aqui para app/admin/gestora
-- terem leitura+escrita.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;

-- Leitura ampla: authenticated + mentor + assessor (não cobertos pelo GRANT
-- em bloco acima, que é só para app/admin/gestora).
GRANT SELECT ON public.ref_peso_etapa TO authenticated, legisla_mentor, legisla_assessor;

-- Defesa em profundidade: fecha o CRUD completo que o ALTER DEFAULT
-- PRIVILEGES de baseline do projeto concede por padrão a anon/authenticated
-- em toda tabela nova de public (mesmo achado de
-- 20260810193545_catalogos_referencia_revoke_default_privileges.sql). anon
-- nunca tem nenhum acesso (AD-002); authenticated mantém SELECT (concedido
-- acima de propósito), mas não escrita.
REVOKE ALL ON public.ref_peso_etapa FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.ref_peso_etapa FROM authenticated;
