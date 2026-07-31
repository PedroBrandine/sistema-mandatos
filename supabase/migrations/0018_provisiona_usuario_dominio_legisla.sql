-- =============================================================================
-- Provisionamento automático de dim_usuario para e-mails @legislabrasil.org.
--
-- Decisão temporária de sessão (fora do escopo original de tasks.md T1-T37):
-- pedido do usuário para destravar teste em equipe do deploy de Preview na
-- Vercel -- todo e-mail @legislabrasil.org que fizer o primeiro login (magic
-- link, signInWithOtp com shouldCreateUser=true restrito a esse domínio no
-- login-form.tsx) ganha automaticamente dim_usuario com papel_global='gestora'.
--
-- Isto é uma conveniência de teste, não uma política permanente: contradiz a
-- suposição de spec.md ("Quem cadastra dim_usuario: Gestora e Admin") e o
-- espírito de FND-USR-02 (só Admin cria Gestora) -- registrado aqui e deve
-- ser revisitado/removido antes de qualquer uso real além de teste interno.
--
-- Padrão idêntico ao já usado em app.custom_access_token_hook (T1):
-- SECURITY DEFINER SET search_path = public, pg_temp, mesmo motivo (a
-- função roda no contexto interno do Supabase Auth ao criar o usuário em
-- auth.users, não numa sessão de PostgREST -- não há papel/GRANT de
-- chamador para herdar).
-- =============================================================================

CREATE OR REPLACE FUNCTION app.provisiona_usuario_dominio_legisla()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_email TEXT := lower(btrim(NEW.email));
BEGIN
  IF v_email LIKE '%@legislabrasil.org' THEN
    INSERT INTO dim_usuario (email, nome, papel_global, ativo)
    VALUES (v_email, split_part(v_email, '@', 1), 'gestora', true)
    ON CONFLICT (email) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION app.provisiona_usuario_dominio_legisla() IS
'TEMPORÁRIO (decisão de sessão, fora de tasks.md): auto-provisiona dim_usuario
papel_global=gestora para qualquer @legislabrasil.org no primeiro login --
conveniência de teste em equipe, revisar/remover antes de uso real.';

DROP TRIGGER IF EXISTS trg_provisiona_usuario_dominio_legisla ON auth.users;
CREATE TRIGGER trg_provisiona_usuario_dominio_legisla
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION app.provisiona_usuario_dominio_legisla();
