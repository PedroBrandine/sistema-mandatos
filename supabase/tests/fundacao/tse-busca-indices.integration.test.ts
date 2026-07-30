import { describe, it, expect } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: T18 Done-when --
//  - Índice GIN trigram criado e usado pelo planner numa busca ILIKE/similarity() de teste
//  - Índice B-tree (sg_uf, cd_cargo) criado

describe("T18 -- índice de busca TSE por nome (fuzzy)", () => {
  it("creates ix_tse_candidatura_nome_trgm as a GIN index using gin_trgm_ops on app.normaliza_nome(nm_urna)", async () => {
    const rows = await runSql<{ indexdef: string }>(`
      SELECT indexdef FROM pg_indexes WHERE schemaname = 'tse' AND indexname = 'ix_tse_candidatura_nome_trgm';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toContain("USING gin");
    expect(rows[0].indexdef).toContain("gin_trgm_ops");
    expect(rows[0].indexdef).toContain("normaliza_nome");
  });

  it("creates ix_tse_candidatura_uf_cargo as a B-tree index on (sg_uf, cd_cargo)", async () => {
    const rows = await runSql<{ indexdef: string }>(`
      SELECT indexdef FROM pg_indexes WHERE schemaname = 'tse' AND indexname = 'ix_tse_candidatura_uf_cargo';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toContain("btree");
    expect(rows[0].indexdef).toContain("(sg_uf, cd_cargo)");
  });

  it("the planner can use the trigram index for a similarity search (forced off seqscan/bitmap alternatives)", async () => {
    // SPEC_DEVIATION (test fix, this session): the original version wrapped
    // EXPLAIN inside `FROM ( EXPLAIN SELECT ... ) AS t(line)` -- EXPLAIN is a
    // utility statement, not a SELECT expression, and Postgres cannot use it
    // as a subquery source (confirmed: 42601 syntax error). Fixed by running
    // EXPLAIN as its own top-level statement in the same file/call as `SET
    // LOCAL`, so the setting still applies (multi-statement files run in the
    // same implicit transaction) -- and reading its plan rows directly.
    const rows = await runSql<{ "QUERY PLAN": string }>(`
      SET LOCAL enable_seqscan = off;
      EXPLAIN SELECT * FROM tse.mv_candidatura_resumo
       WHERE app.normaliza_nome(nm_urna) % 'joao silva';
    `);
    const plan = rows.map((r) => r["QUERY PLAN"]).join("\n");
    expect(plan).toContain("ix_tse_candidatura_nome_trgm");
  });
});
