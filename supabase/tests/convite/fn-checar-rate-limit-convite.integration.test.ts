import { describe, it, expect, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: tasks.md T4 Done-when --
//  - 20 chamadas com o mesmo IP dentro da janela devolvem true
//  - A 21ª chamada dentro da mesma janela devolve false
//  - IP diferente não é afetado pelo limite do primeiro
//  - Linhas mais antigas que janela+1h são removidas na chamada seguinte
//  - Gate check passa: npm run test:unit && npm run test:integration
//
// spec.md CVT-10.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

const admin: SupabaseClient = createClient(URL, SERVICE_ROLE_KEY);

// IPs de teste dedicados (RFC 5737 TEST-NET-1/2/3), pra não colidir com nada real.
const IP_A = "192.0.2.10";
const IP_B = "192.0.2.20";
const IP_ANTIGO = "192.0.2.30";

describe("T4 -- app.checar_rate_limit_convite", () => {
  afterAll(async () => {
    await runSql(`DELETE FROM convite_tentativa WHERE ip IN ('${IP_A}', '${IP_B}', '${IP_ANTIGO}');`);
  });

  it("EXECUTE é negado a anon/authenticated (só service_role pode chamar)", async () => {
    const anonClient = createClient(URL, ANON_KEY);
    const { data, error } = await anonClient.schema("app").rpc("checar_rate_limit_convite", { p_ip: IP_A });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("20 chamadas com o mesmo IP dentro da janela devolvem true; a 21ª devolve false", async () => {
    for (let i = 0; i < 20; i++) {
      const { data, error } = await admin.schema("app").rpc("checar_rate_limit_convite", { p_ip: IP_A });
      expect(error).toBeNull();
      expect(data).toBe(true);
    }

    const { data: vigesimaPrimeira, error } = await admin
      .schema("app")
      .rpc("checar_rate_limit_convite", { p_ip: IP_A });
    expect(error).toBeNull();
    expect(vigesimaPrimeira).toBe(false);

    const rows = await runSql<{ count: string }>(
      `SELECT count(*)::int AS count FROM convite_tentativa WHERE ip = '${IP_A}';`
    );
    expect(Number(rows[0].count)).toBe(21);
  });

  it("IP diferente não é afetado pelo limite já atingido pelo primeiro", async () => {
    const { data, error } = await admin.schema("app").rpc("checar_rate_limit_convite", { p_ip: IP_B });
    expect(error).toBeNull();
    expect(data).toBe(true);

    const rows = await runSql<{ count: string }>(
      `SELECT count(*)::int AS count FROM convite_tentativa WHERE ip = '${IP_B}';`
    );
    expect(Number(rows[0].count)).toBe(1);
  });

  it("linhas mais antigas que janela+1h são removidas na chamada seguinte", async () => {
    await runSql(`
      INSERT INTO convite_tentativa (ip, ocorrido_em)
      VALUES ('${IP_ANTIGO}', now() - interval '2 hours');
    `);

    await admin.schema("app").rpc("checar_rate_limit_convite", { p_ip: IP_B });

    const rows = await runSql<{ count: string }>(
      `SELECT count(*)::int AS count FROM convite_tentativa WHERE ip = '${IP_ANTIGO}';`
    );
    expect(Number(rows[0].count)).toBe(0);
  });
});
