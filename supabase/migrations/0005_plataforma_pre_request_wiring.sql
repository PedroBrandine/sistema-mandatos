-- =============================================================================
-- T4 (part 2): wire app.pre_request() as PostgREST's db-pre-request hook.
--
-- SPEC_DEVIATION: T4's own "Where" field names only supabase/config.toml, but
-- PostgREST's pre-request hook has no config.toml key (verified against the
-- Supabase CLI config reference and the PostgREST configuration reference --
-- see the comment above [auth.hook.custom_access_token] in config.toml).
-- The only reproducible, git-tracked way to register it is this GUC, set on
-- the `authenticator` role that PostgREST connects as. `authenticator` is a
-- regular role in this project (T3 already grants role membership to it via
-- plain migration SQL), so ALTER ROLE on it works the same way here as it
-- would locally.
-- =============================================================================

ALTER ROLE authenticator SET pgrst.db_pre_request = 'app.pre_request';

-- Tells PostgREST to reload its config from the role/db-level GUCs without
-- a restart (Supabase's hosted PostgREST listens on this channel).
NOTIFY pgrst, 'reload config';
