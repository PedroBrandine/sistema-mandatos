-- =============================================================================
-- T2: app.pre_request -- resolve dim_usuario.id_usuario pelo e-mail do JWT
-- (request.jwt.claims, GUC populada pelo PostgREST a cada requisição) e grava
-- em app.id_usuario via set_config(..., true) (transaction-local), para que
-- app.id_usuario()/app.papel_atual() (e a RLS que os usa) resolvam a sessão.
--
-- Renumerado: tasks.md nomeia este arquivo "0002_...", deslocado para 0003
-- pela mesma razão de 0002_plataforma_auth_hook.sql (ver SPEC_DEVIATION lá).
--
-- Registrar esta função como o hook `db-pre-request` do PostgREST é T4 (não
-- há chave de config.toml para isso -- ver SPEC_DEVIATION em T4).
-- =============================================================================

CREATE OR REPLACE FUNCTION app.pre_request()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_email TEXT;
  v_id    BIGINT;
BEGIN
  v_email := lower(btrim(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email'
  ));

  IF v_email IS NULL OR v_email = '' THEN
    RETURN;
  END IF;

  SELECT id_usuario INTO v_id
    FROM dim_usuario
   WHERE email = v_email
     AND ativo = true;

  IF v_id IS NOT NULL THEN
    PERFORM set_config('app.id_usuario', v_id::text, true);
  END IF;
END;
$$;

COMMENT ON FUNCTION app.pre_request() IS
'Hook db-pre-request do PostgREST (registrado em T4 via ALTER ROLE authenticator
SET pgrst.db_pre_request -- não há chave em config.toml para este hook).
Nunca derruba a requisição: sem e-mail no JWT ou sem dim_usuario ativo
correspondente, apenas não grava app.id_usuario.';
