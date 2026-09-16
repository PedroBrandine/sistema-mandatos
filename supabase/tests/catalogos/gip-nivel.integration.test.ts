import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: ficha-mandato-contrato T5 Done-when
// (.specs/features/ficha-mandato-contrato/tasks.md), migration
// 20260916115951_ficha_gip_nivel_estrutura.sql -- design.md "Data Models" >
// ref_nivel_dimensao_gip (A-11):
//  - insercao aceita.
//  - par (id_dimensao, valor) duplicado rejeitado (23505).
//  - descricao NULL rejeitada (23502).
//
// spec.md P1 "GIP conforme a metodologia vigente" AC2 (FMC-24).

async function expectSqlError(sql: string, marker: string): Promise<void> {
  try {
    await runSql(sql);
    throw new Error(`expected query to fail with ${marker} but it succeeded`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain(marker);
  }
}

let idDimensao: number;

describe("ficha-mandato-contrato T5 -- ref_nivel_dimensao_gip", () => {
  beforeAll(async () => {
    idDimensao = (
      await runSql<{ id_dimensao: number }>(`SELECT id_dimensao FROM ref_dimensao_gip ORDER BY id_dimensao LIMIT 1;`)
    )[0].id_dimensao;
  }, 60000);

  afterAll(async () => {
    await runSql(`DELETE FROM ref_nivel_dimensao_gip WHERE id_dimensao = ${idDimensao} AND valor IN (101, 102);`);
  }, 60000);

  it("aceita insercao de descritor de nivel", async () => {
    const [linha] = await runSql<{ id_dimensao: number; valor: number }>(`
      INSERT INTO ref_nivel_dimensao_gip (id_dimensao, valor, descricao)
      VALUES (${idDimensao}, 101, 'FMC T5 descritor de teste')
      RETURNING id_dimensao, valor;
    `);
    expect(linha).toEqual({ id_dimensao: idDimensao, valor: 101 });
  });

  it("pk_nivel_dimensao_gip: rejeita (23505) o mesmo par (dimensao, valor) duas vezes", async () => {
    await expectSqlError(
      `INSERT INTO ref_nivel_dimensao_gip (id_dimensao, valor, descricao)
       VALUES (${idDimensao}, 101, 'FMC T5 descritor duplicado');`,
      "23505"
    );
  });

  it("descricao NOT NULL: rejeita (23502) descricao nula", async () => {
    await expectSqlError(
      `INSERT INTO ref_nivel_dimensao_gip (id_dimensao, valor, descricao)
       VALUES (${idDimensao}, 102, NULL);`,
      "23502"
    );
  });
});
