-- =============================================================================
-- T1: app.custom_access_token_hook -- injeta a claim `role` a partir de
-- dim_usuario.papel_global, para o Supabase Auth emitir um JWT cujo `role`
-- top-level (lido por PostgREST via `jwt-role-claim-key`, default ".role")
-- resolve para um dos 5 ROLEs do Postgres criados em T3
-- (legisla_admin/legisla_gestora/legisla_mentor/legisla_assessor/legisla_app).
--
-- Numeração renumerada: tasks.md nomeia este arquivo "0001_...", mas o
-- pré-requisito de dim_usuario (SPEC_DEVIATION documentada em
-- 0001_plataforma_dim_usuario_prereq.sql) já ocupa 0001 -- deslocado para
-- 0002 para preservar a ordem de dependência real das migrações.
-- =============================================================================

CREATE OR REPLACE FUNCTION app.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_email  TEXT;
  v_papel  TEXT;
  v_role   TEXT;
  v_claims jsonb;
BEGIN
  v_email := lower(btrim(event -> 'claims' ->> 'email'));

  SELECT papel_global INTO v_papel
    FROM dim_usuario
   WHERE email = v_email
     AND ativo = true;

  v_role := CASE WHEN v_papel IS NULL THEN 'legisla_app' ELSE 'legisla_' || v_papel END;

  v_claims := event -> 'claims';
  v_claims := jsonb_set(v_claims, '{role}', to_jsonb(v_role));
  event := jsonb_set(event, '{claims}', v_claims);

  RETURN event;
END;
$$;

COMMENT ON FUNCTION app.custom_access_token_hook(jsonb) IS
'Auth Hook (Custom Access Token). Registrado em supabase/config.toml e via
`supabase config push`/Dashboard (T4). Chamado por supabase_auth_admin -- nunca
por anon/authenticated (ver REVOKE abaixo).';

-- Padrão documentado pelo Supabase para Auth Hooks: só supabase_auth_admin
-- (o papel interno do GoTrue) pode executar a função ou ler as tabelas que
-- ela consulta -- nunca anon/authenticated/PUBLIC.
REVOKE EXECUTE ON FUNCTION app.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.custom_access_token_hook(jsonb) TO supabase_auth_admin;
GRANT USAGE ON SCHEMA app TO supabase_auth_admin;
GRANT SELECT ON dim_usuario TO supabase_auth_admin;
