import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runSql } from "../helpers/sql";

// Spec anchor: T19 Done-when --
//  - Seed aplicável via npm run test:integration (setup) sem violar nenhum CHECK/UNIQUE
//  - Gate check passa: npm run test:integration
//
// Unlike the other Fase 2 test files, this seed is intentionally NOT torn
// down in afterAll: its purpose (per the task) is to leave fixtures behind
// for the Fase 3-4 test suites (T20+) to reuse.

const SEED_PATH = resolve(process.cwd(), "supabase/seed_test.sql");

describe("T19 -- seed de teste para integração", () => {
  beforeAll(async () => {
    const sql = await readFile(SEED_PATH, "utf8");
    // Applying twice proves idempotency (Done-when: "sem violar nenhum CHECK/UNIQUE").
    await runSql(sql);
    await runSql(sql);
  });

  it("creates exactly one 'T19 Seed Mandato Exemplo' contratante+mandato+contrato", async () => {
    const rows = await runSql<{ tipo_contratante: string; status: string; count: string }>(`
      SELECT c.tipo_contratante, f.status, count(*)::int AS count
        FROM dim_contratante c
        JOIN dim_mandato m ON m.id_contratante = c.id_contratante
        JOIN fat_contrato f ON f.id_contratante = c.id_contratante
       WHERE c.nome = 'T19 Seed Mandato Exemplo'
       GROUP BY c.tipo_contratante, f.status;
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].tipo_contratante).toBe("mandato");
    expect(rows[0].status).toBe("ativo");
    expect(Number(rows[0].count)).toBe(1);
  });

  it("creates exactly one 'T19 Seed Coalizão Exemplo' contratante+coalizão", async () => {
    const rows = await runSql<{ tipo_contratante: string; possui_planejamento_proprio: boolean }>(`
      SELECT c.tipo_contratante, co.possui_planejamento_proprio
        FROM dim_contratante c
        JOIN dim_coalizao co ON co.id_contratante = c.id_contratante
       WHERE c.nome = 'T19 Seed Coalizão Exemplo';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].tipo_contratante).toBe("coalizao");
    expect(rows[0].possui_planejamento_proprio).toBe(false);
  });

  it("links the seed mentor and assessor to the example contract exactly once each", async () => {
    const rows = await runSql<{ email: string; papel_no_contrato: string; count: string }>(`
      SELECT u.email, v.papel_no_contrato, count(*)::int AS count
        FROM rel_usuario_contrato v
        JOIN dim_usuario u ON u.id_usuario = v.id_usuario
        JOIN fat_contrato f ON f.id_contrato = v.id_contrato
        JOIN dim_contratante c ON c.id_contratante = f.id_contratante
       WHERE c.nome = 'T19 Seed Mandato Exemplo'
         AND u.email IN ('t19-seed-mentor@legislabrasil.test', 't19-seed-assessor@legislabrasil.test')
       GROUP BY u.email, v.papel_no_contrato
       ORDER BY u.email;
    `);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ email: "t19-seed-assessor@legislabrasil.test", papel_no_contrato: "assessor", count: 1 });
    expect(rows[1]).toMatchObject({ email: "t19-seed-mentor@legislabrasil.test", papel_no_contrato: "mentor", count: 1 });
  });
});
