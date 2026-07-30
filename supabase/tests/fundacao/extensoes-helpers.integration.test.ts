import { describe, it, expect } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: T11 Done-when --
//  - Extensões (unaccent, btree_gin, pg_trgm) instaladas
//  - app.f_unaccent, app.normaliza_nome e domínio texto_limpo existem e
//    rejeitam os sentinelas listados no schema
// Also spec.md Edge Cases: "um campo de atributo... recebe string vazia ou um
// sentinela conhecido... o sistema SHALL rejeitar a gravação -- o domínio
// texto_limpo já impõe isso no schema (AD-005)."

const SENTINELS = [
  "",
  "   ",
  "Pendente de Atualização",
  "Não Coletado",
  "Não Informado",
  "Não se aplica",
  "N/A",
  "NA",
  "ND",
  "-",
  "--",
  "null",
  "undefined",
  "Sem Nome",
];

async function castToTextoLimpo(value: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await runSql(`SELECT '${value.replace(/'/g, "''")}'::texto_limpo;`);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

describe("T11 -- extensões e helpers imutáveis", () => {
  it("installs unaccent, btree_gin and pg_trgm extensions", async () => {
    const rows = await runSql<{ extname: string }>(`
      SELECT extname FROM pg_extension WHERE extname IN ('unaccent', 'btree_gin', 'pg_trgm');
    `);
    expect(rows.map((r) => r.extname).sort()).toEqual(["btree_gin", "pg_trgm", "unaccent"]);
  });

  it("creates the app, tse and stg schemas", async () => {
    const rows = await runSql<{ nspname: string }>(`
      SELECT nspname FROM pg_namespace WHERE nspname IN ('app', 'tse', 'stg') ORDER BY nspname;
    `);
    expect(rows.map((r) => r.nspname)).toEqual(["app", "stg", "tse"]);
  });

  it("app.f_unaccent strips accents (IMMUTABLE wrapper over unaccent)", async () => {
    const rows = await runSql<{ f: string }>(`SELECT app.f_unaccent('São Paulo') AS f;`);
    expect(rows[0].f).toBe("Sao Paulo");
  });

  it("app.normaliza_nome lowercases, trims and collapses whitespace after unaccenting", async () => {
    const rows = await runSql<{ n: string }>(`SELECT app.normaliza_nome('  João   D''Ávila  ') AS n;`);
    expect(rows[0].n).toBe("joao d'avila");
  });

  it.each(SENTINELS)("texto_limpo rejects the sentinel/empty value %j with ERRCODE 23514", async (value) => {
    const result = await castToTextoLimpo(value);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("23514");
      expect(result.message).toContain("texto_limpo");
    }
  });

  it("texto_limpo accepts a normal, non-sentinel value", async () => {
    const result = await castToTextoLimpo("Assessoria Parlamentar");
    expect(result.ok).toBe(true);
  });

  it("texto_limpo accepts NULL (absence is NULL, per AD-005)", async () => {
    const rows = await runSql<{ v: string | null }>(`SELECT NULL::texto_limpo AS v;`);
    expect(rows[0].v).toBeNull();
  });
});
