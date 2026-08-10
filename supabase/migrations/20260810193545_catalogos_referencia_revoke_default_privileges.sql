-- =============================================================================
-- Achado ao verificar T2 (.specs/features/catalogos-referencia/): a query de
-- ACL (pg_class.relacl) nas 12 tabelas novas mostrou
--   anon=arwdDxtm, authenticated=arwdDxtm
-- em TODAS -- SELECT, INSERT, UPDATE e DELETE completos para anon, concedidos
-- não por nenhum GRANT explícito desta feature, mas pelo ALTER DEFAULT
-- PRIVILEGES de baseline do próprio projeto Supabase, aplicado a toda tabela
-- NOVA criada em `public` (docs/ambientes.md já documenta esse baseline como
-- "ruído" filtrado no drift-check -- mas ruído de diff não é o mesmo que
-- acesso correto: é exatamente o mesmo mecanismo que a migração
-- 20260810183759_revoke_anon_grant_ref_tables.sql teve que revogar para os 4
-- catálogos antigos, e mesmo aquela correção só cobriu SELECT, deixando
-- INSERT/UPDATE/DELETE de anon intocados ali -- gap real, mas fora do escopo
-- desta feature corrigir os 4 catálogos antigos (não são destas 12 tabelas).
--
-- AD-002 é regra inegociável sem exceção documentada para catálogo: "nenhum
-- acesso é anônimo -- nem leitura, nem escrita". REVOKE ALL (não só SELECT)
-- fecha a lacuna por completo nestas 12 tabelas, indo além do precedente de
-- 0024/20260810183759 (que só revogou SELECT).
--
-- `authenticated` também tinha INSERT/UPDATE/DELETE por default -- fora do
-- desenho documentado em context.md/design.md ("escrita só para
-- app/admin/gestora"). Na prática nenhuma requisição roda como o papel
-- Postgres literal `authenticated`: o hook em 0002_plataforma_auth_hook.sql
-- reescreve a claim `role` do JWT para um dos 5 legisla_* em TODO login,
-- então PostgREST nunca faz SET ROLE para `authenticated` para um usuário
-- autenticado real. Revogado mesmo assim por defesa em profundidade -- é uma
-- concessão real e viva no banco, e nada nesta feature documenta que ela
-- deveria existir. SELECT continua concedido a `authenticated` (mesma leitura
-- ampla dada às 5 roles legisla_*, decisão de context.md).
--
-- `service_role` mantém acesso pleno -- é o papel de servidor confiável
-- (AD-009/AD-010), nunca chega ao cliente, e toda tabela do schema já conta
-- com esse acesso por design; não há RLS nem policy que o filtre em lugar
-- nenhum do sistema.
-- =============================================================================

REVOKE ALL ON
  public.ref_preditor, public.ref_agenda_tematica, public.ref_perfil_atuacao,
  public.ref_pilar_insight, public.ref_indicador, public.ref_nivel_iip,
  public.ref_dimensao_gip, public.ref_tipologia, public.ref_etapa,
  public.ref_tipo_registro, public.ref_formulario, public.ref_metrica_formulario
  FROM anon;

REVOKE INSERT, UPDATE, DELETE ON
  public.ref_preditor, public.ref_agenda_tematica, public.ref_perfil_atuacao,
  public.ref_pilar_insight, public.ref_indicador, public.ref_nivel_iip,
  public.ref_dimensao_gip, public.ref_tipologia, public.ref_etapa,
  public.ref_tipo_registro, public.ref_formulario, public.ref_metrica_formulario
  FROM authenticated;
