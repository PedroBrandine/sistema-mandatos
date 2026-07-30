import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: T1 Done-when --
//  - Retorna legisla_<papel_global> quando encontra dim_usuario ativo pelo e-mail
//  - Retorna legisla_app quando não encontra dim_usuario ATIVO pelo e-mail
//    (inclui: nenhuma linha, e linha existente porém inativa)

const EMAIL_ATIVO = "t1-hook-gestora@legislabrasil.test";
const EMAIL_INATIVO = "t1-hook-inativo@legislabrasil.test";
const EMAIL_INEXISTENTE = "t1-hook-inexistente@legislabrasil.test";

async function callHook(email: string): Promise<string> {
  const rows = await runSql<{ role: string }>(`
    SELECT app.custom_access_token_hook(
      jsonb_build_object(
        'user_id', gen_random_uuid(),
        'claims', jsonb_build_object('email', '${email}')
      )
    ) -> 'claims' ->> 'role' AS role;
  `);
  return rows[0].role;
}

describe("app.custom_access_token_hook", () => {
  beforeAll(async () => {
    await runSql(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo)
      VALUES
        ('${EMAIL_ATIVO}', 'Teste Gestora Hook', 'gestora', true),
        ('${EMAIL_INATIVO}', 'Teste Assessor Inativo Hook', 'assessor', false)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = EXCLUDED.ativo;
    `);
  });

  afterAll(async () => {
    await runSql(
      `DELETE FROM dim_usuario WHERE email IN ('${EMAIL_ATIVO}', '${EMAIL_INATIVO}', '${EMAIL_INEXISTENTE}');`
    );
  });

  it("returns legisla_<papel_global> when dim_usuario has an active match", async () => {
    expect(await callHook(EMAIL_ATIVO)).toBe("legisla_gestora");
  });

  it("returns legisla_app when no dim_usuario row matches the email", async () => {
    expect(await callHook(EMAIL_INEXISTENTE)).toBe("legisla_app");
  });

  it("returns legisla_app when the matching dim_usuario row is inactive", async () => {
    expect(await callHook(EMAIL_INATIVO)).toBe("legisla_app");
  });

  it("is defined as SECURITY DEFINER with search_path = public, pg_temp", async () => {
    const rows = await runSql<{ prosecdef: boolean; proconfig: string[] | null }>(`
      SELECT prosecdef, proconfig
        FROM pg_proc
       WHERE proname = 'custom_access_token_hook'
         AND pronamespace = 'app'::regnamespace;
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].prosecdef).toBe(true);
    expect(rows[0].proconfig).toContain("search_path=public, pg_temp");
  });
});
