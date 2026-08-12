import { describe, it, expect } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/visao-gerencial-g1-g2/tasks.md T3 Done-when
// (GG-02) -- migração: 20260812175226_visao_gerencial_peso_etapa_seed.sql.
//
//  - Toda linha de ref_etapa hoje existente tem uma linha correspondente em
//    ref_peso_etapa com peso = 1
//  - Reexecutar a migration não duplica nem falha (idempotência)

describe("visao-gerencial-g1-g2 T3 -- seed peso=1 em ref_peso_etapa (GG-02)", () => {
  it("COUNT(ref_peso_etapa) = COUNT(ref_etapa) -- toda etapa tem peso seedado", async () => {
    const [{ qtd_etapa, qtd_peso }] = await runSql<{ qtd_etapa: string; qtd_peso: string }>(`
      SELECT (SELECT count(*)::text FROM ref_etapa) AS qtd_etapa,
             (SELECT count(*)::text FROM ref_peso_etapa) AS qtd_peso;
    `);
    expect(Number(qtd_peso)).toBe(Number(qtd_etapa));
  });

  it("todo peso seedado é 1", async () => {
    const rows = await runSql<{ peso: string }>(`SELECT DISTINCT peso FROM ref_peso_etapa;`);
    expect(rows).toHaveLength(1);
    expect(rows[0].peso).toBe("1.00");
  });

  it("reexecutar o seed (mesmo INSERT ... ON CONFLICT DO NOTHING da migration) não duplica nem falha", async () => {
    const before = await runSql<{ n: string }>(`SELECT count(*)::text AS n FROM ref_peso_etapa;`);

    await runSql(`
      INSERT INTO ref_peso_etapa (id_etapa, peso)
      SELECT id_etapa, 1 FROM ref_etapa
      ON CONFLICT (id_etapa) DO NOTHING;
    `);

    const after = await runSql<{ n: string }>(`SELECT count(*)::text AS n FROM ref_peso_etapa;`);
    expect(Number(after[0].n)).toBe(Number(before[0].n));
  });
});
