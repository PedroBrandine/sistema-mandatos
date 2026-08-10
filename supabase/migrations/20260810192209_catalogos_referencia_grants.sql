-- =============================================================================
-- Trilha C (.specs/features/catalogos-referencia/): RLS-disable + GRANT por
-- papel nas 12 tabelas ref_* criadas em 20260810191659_catalogos_referencia_estrutura.sql.
--
-- Exceção documentada (AD-030, .specs/STATE.md): catálogo somente-leitura sem
-- id_contrato/carteira pra filtrar por linha -- controle é só por GRANT, não
-- por policy de RLS. Mesmo padrão de 0024_ref_tables_rls_fix.sql, com escopo
-- de papel ampliado (context.md desta feature):
--
--   Leitura : authenticated + as 5 roles legisla_* (app/admin/gestora/mentor/assessor)
--   Escrita : legisla_app/legisla_admin/legisla_gestora (via re-GRANT em bloco, AD-025)
--   anon    : EXCLUÍDO -- AD-002 é regra inegociável sem exceção para catálogo
--             (diferente do precedente de 0024, que incluía anon e foi
--             corrigido depois em 20260810183759_revoke_anon_grant_ref_tables.sql).
--
-- ALTER TABLE ... DISABLE ROW LEVEL SECURITY é redundante para tabela nova
-- (RLS já nasce desligada por padrão), mas fica explícito de propósito -- é a
-- documentação em SQL da exceção AD-030, no mesmo lugar que 0024 documentou
-- para os 4 catálogos antigos.
-- =============================================================================

ALTER TABLE public.ref_preditor           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_agenda_tematica    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_perfil_atuacao     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_pilar_insight      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_indicador          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_nivel_iip          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_dimensao_gip       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_tipologia          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_etapa              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_tipo_registro      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_formulario         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_metrica_formulario DISABLE ROW LEVEL SECURITY;

-- Re-GRANT obrigatório (AD-025, provisionamento incremental): "ALL TABLES IN
-- SCHEMA public" só cobre as tabelas que já existiam no momento do GRANT
-- anterior (0004/0007/.../0028) -- as 12 tabelas novas precisam entrar aqui
-- para app/admin/gestora terem leitura+escrita, mesmo padrão de 0007.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;

-- Leitura ampla: authenticated + mentor + assessor (mentor/assessor não são
-- cobertos pelo GRANT em bloco acima, que é só para app/admin/gestora).
GRANT SELECT ON
  public.ref_preditor, public.ref_agenda_tematica, public.ref_perfil_atuacao,
  public.ref_pilar_insight, public.ref_indicador, public.ref_nivel_iip,
  public.ref_dimensao_gip, public.ref_tipologia, public.ref_etapa,
  public.ref_tipo_registro, public.ref_formulario, public.ref_metrica_formulario
  TO authenticated, legisla_mentor, legisla_assessor;
