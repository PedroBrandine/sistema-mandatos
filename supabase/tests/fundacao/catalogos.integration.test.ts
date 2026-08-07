import { describe, it, expect } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: T12 Done-when --
//  - As 4 tabelas existem com os CHECKs/UNIQUEs do schema aprovado
//  - Seeds aplicados (produto, ao menos Estratégia/PLL/Coalizão; cargos com nivel_federativo)

async function expectSqlError(sql: string, errcode: string): Promise<void> {
  try {
    await runSql(sql);
    throw new Error("expected query to fail but it succeeded");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain(errcode);
  }
}

describe("T12 -- catálogos dependentes de Fundação", () => {
  it("seeds ref_produto with Estratégia, PLL and Coalizão", async () => {
    const rows = await runSql<{ nome: string }>(`
      SELECT nome FROM ref_produto WHERE nome IN ('Estratégia', 'PLL', 'Coalizão') ORDER BY nome;
    `);
    expect(rows.map((r) => r.nome)).toEqual(["Coalizão", "Estratégia", "PLL"]);
  });

  it("seeds ref_cargo with nivel_federativo populated for every seeded row", async () => {
    const rows = await runSql<{ nome: string; nivel_federativo: string }>(`
      SELECT nome, nivel_federativo FROM ref_cargo WHERE cd_cargo_tse IS NOT NULL OR nome = 'Não se aplica';
    `);
    // 6, não 9: Prefeito(a)/Vice-Prefeito(a)/Governador(a) foram removidos do
    // catálogo por não serem usados -- ver migration 0026.
    expect(rows.length).toBeGreaterThanOrEqual(6);
    for (const row of rows) {
      expect(row.nivel_federativo).toMatch(/^(federal|estadual|municipal|nao_se_aplica)$/);
    }
  });

  it("ck_cargo_nivel rejects an invalid nivel_federativo", async () => {
    await expectSqlError(
      `INSERT INTO ref_cargo (nome, nivel_federativo) VALUES ('Cargo Teste T12 Invalido', 'planetario');`,
      "23514"
    );
  });

  it("ck_projeto_periodo rejects dt_fim before dt_inicio", async () => {
    await expectSqlError(
      `INSERT INTO ref_projeto (nome, dt_inicio, dt_fim) VALUES ('Projeto Teste T12', '2026-06-01', '2026-01-01');`,
      "23514"
    );
  });

  it("uq_partido_sigla_vigencia rejects a duplicate (sigla, dt_inicio_sigla)", async () => {
    await runSql(`
      INSERT INTO ref_partido (sigla, dt_inicio_sigla) VALUES ('T12X', '2020-01-01')
      ON CONFLICT (sigla, dt_inicio_sigla) DO NOTHING;
    `);
    await expectSqlError(
      `INSERT INTO ref_partido (sigla, dt_inicio_sigla) VALUES ('T12X', '2020-01-01');`,
      "23505"
    );
    await runSql(`DELETE FROM ref_partido WHERE sigla = 'T12X';`);
  });

  it("ref_produto.nome is UNIQUE", async () => {
    await expectSqlError(`INSERT INTO ref_produto (nome) VALUES ('Estratégia');`, "23505");
  });
});
