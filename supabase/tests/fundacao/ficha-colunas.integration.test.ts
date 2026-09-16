import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: ficha-mandato-contrato T6 Done-when
// (.specs/features/ficha-mandato-contrato/tasks.md), migration
// 20260916120031_ficha_colunas_mandato_contrato.sql -- design.md "Data
// Models" > "Colunas novas":
//  - dim_mandato.minibiografia: gravacao e releitura.
//  - dim_mandato.principais_pautas: gravacao e releitura.
//  - fat_contrato.id_usuario_ponto_focal: gravacao e releitura; FK invalida
//    rejeitada (23503).
//
// spec.md P1 "Informações Gerais do mandato" AC1, AC7, AC10 (FMC-05, FMC-06,
// FMC-11).

async function expectSqlError(sql: string, marker: string): Promise<void> {
  try {
    await runSql(sql);
    throw new Error(`expected query to fail with ${marker} but it succeeded`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain(marker);
  }
}

let idContratante: number;
let idMandato: number;
let idContrato: number;
let idUsuario: number;

describe("ficha-mandato-contrato T6 -- colunas novas em dim_mandato e fat_contrato", () => {
  beforeAll(async () => {
    const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'FMC T6')
      RETURNING id_contratante;
    `);
    idContratante = id_contratante;

    const [{ id_mandato }] = await runSql<{ id_mandato: number }>(`
      INSERT INTO dim_mandato (id_contratante) VALUES (${idContratante}) RETURNING id_mandato;
    `);
    idMandato = id_mandato;

    const [{ id_contrato }] = await runSql<{ id_contrato: number }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
      RETURNING id_contrato;
    `);
    idContrato = id_contrato;

    const [{ id_usuario }] = await runSql<{ id_usuario: number }>(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo)
      VALUES ('fmc-t6-u1@legislabrasil.test', 'FMC T6 Usuario', 'assessor', true)
      ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome
      RETURNING id_usuario;
    `);
    idUsuario = id_usuario;
  }, 60000);

  afterAll(async () => {
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};
      DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};
      DELETE FROM dim_planejamento WHERE id_contrato = ${idContrato};
    `);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};`);
    await runSql(`DELETE FROM dim_mandato WHERE id_mandato = ${idMandato};`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
    await runSql(`DELETE FROM log_auditoria WHERE id_usuario = ${idUsuario};`);
    await runSql(`DELETE FROM dim_usuario WHERE id_usuario = ${idUsuario};`);
  }, 60000);

  it("dim_mandato.minibiografia: grava e relê o texto", async () => {
    await runSql(`UPDATE dim_mandato SET minibiografia = 'FMC T6 biografia de teste' WHERE id_mandato = ${idMandato};`);
    const [{ minibiografia }] = await runSql<{ minibiografia: string }>(`
      SELECT minibiografia FROM dim_mandato WHERE id_mandato = ${idMandato};
    `);
    expect(minibiografia).toBe("FMC T6 biografia de teste");
  });

  it("dim_mandato.principais_pautas: grava e relê o array na ordem gravada", async () => {
    await runSql(`
      UPDATE dim_mandato SET principais_pautas = ARRAY['Pauta A', 'Pauta B']
      WHERE id_mandato = ${idMandato};
    `);
    const [{ principais_pautas: pautas }] = await runSql<{ principais_pautas: string[] }>(`
      SELECT principais_pautas FROM dim_mandato WHERE id_mandato = ${idMandato};
    `);
    expect(pautas).toEqual(["Pauta A", "Pauta B"]);
  });

  it("fat_contrato.id_usuario_ponto_focal: grava e relê a referencia", async () => {
    await runSql(`UPDATE fat_contrato SET id_usuario_ponto_focal = ${idUsuario} WHERE id_contrato = ${idContrato};`);
    const [{ id_usuario_ponto_focal: idPontoFocal }] = await runSql<{ id_usuario_ponto_focal: number }>(`
      SELECT id_usuario_ponto_focal FROM fat_contrato WHERE id_contrato = ${idContrato};
    `);
    expect(idPontoFocal).toBe(idUsuario);
  });

  it("fat_contrato.id_usuario_ponto_focal: rejeita (23503) referencia a usuario inexistente", async () => {
    await expectSqlError(
      `UPDATE fat_contrato SET id_usuario_ponto_focal = 999999999 WHERE id_contrato = ${idContrato};`,
      "23503"
    );
  });
});
