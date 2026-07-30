import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: T2 Done-when --
//  - Sem e-mail no JWT ou sem dim_usuario correspondente: não grava nada
//    (não derruba a requisição)
//  - Com match: current_setting('app.id_usuario', true) retorna o id_usuario
//    correto na mesma transação

const EMAIL_ATIVO = "t2-pre-request-mentor@legislabrasil.test";
const EMAIL_INATIVO = "t2-pre-request-inativo@legislabrasil.test";
const EMAIL_INEXISTENTE = "t2-pre-request-inexistente@legislabrasil.test";

/**
 * Runs pre_request() with `request.jwt.claims` set to the given claims (or
 * omitted entirely, to simulate no JWT), then reads back app.id_usuario --
 * all inside the SAME implicit transaction (multi-statement query batch),
 * matching how PostgREST evaluates the hook once per request/transaction.
 */
async function runPreRequest(claims: Record<string, unknown> | null): Promise<string | null> {
  const setClaims =
    claims === null ? "" : `SET LOCAL request.jwt.claims = '${JSON.stringify(claims)}';`;
  const rows = await runSql<{ id_usuario: string | null }>(`
    ${setClaims}
    SELECT app.pre_request();
    SELECT NULLIF(current_setting('app.id_usuario', true), '') AS id_usuario;
  `);
  return rows[0].id_usuario;
}

describe("app.pre_request", () => {
  let idUsuarioAtivo: string;

  beforeAll(async () => {
    await runSql(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo)
      VALUES
        ('${EMAIL_ATIVO}', 'Teste Mentor Pre Request', 'mentor', true),
        ('${EMAIL_INATIVO}', 'Teste Assessor Inativo Pre Request', 'assessor', false)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = EXCLUDED.ativo;
    `);
    const rows = await runSql<{ id_usuario: string }>(
      `SELECT id_usuario FROM dim_usuario WHERE email = '${EMAIL_ATIVO}';`
    );
    idUsuarioAtivo = String(rows[0].id_usuario);
  });

  afterAll(async () => {
    await runSql(
      `DELETE FROM dim_usuario WHERE email IN ('${EMAIL_ATIVO}', '${EMAIL_INATIVO}', '${EMAIL_INEXISTENTE}');`
    );
  });

  it("sets app.id_usuario to the matching active dim_usuario.id_usuario", async () => {
    const result = await runPreRequest({ email: EMAIL_ATIVO });
    expect(result).toBe(idUsuarioAtivo);
  });

  it("does not set app.id_usuario when there is no JWT (no request.jwt.claims)", async () => {
    const result = await runPreRequest(null);
    expect(result).toBeNull();
  });

  it("does not set app.id_usuario when the JWT has no email claim", async () => {
    const result = await runPreRequest({ sub: "00000000-0000-0000-0000-000000000000" });
    expect(result).toBeNull();
  });

  it("does not set app.id_usuario when no dim_usuario matches the email", async () => {
    const result = await runPreRequest({ email: EMAIL_INEXISTENTE });
    expect(result).toBeNull();
  });

  it("does not set app.id_usuario when the matching dim_usuario row is inactive", async () => {
    const result = await runPreRequest({ email: EMAIL_INATIVO });
    expect(result).toBeNull();
  });

  it("is defined as SECURITY DEFINER with search_path = public, pg_temp", async () => {
    const rows = await runSql<{ prosecdef: boolean; proconfig: string[] | null }>(`
      SELECT prosecdef, proconfig
        FROM pg_proc
       WHERE proname = 'pre_request'
         AND pronamespace = 'app'::regnamespace;
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].prosecdef).toBe(true);
    expect(rows[0].proconfig).toContain("search_path=public, pg_temp");
  });
});
