import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: ficha-mandato-contrato T4 Done-when
// (.specs/features/ficha-mandato-contrato/tasks.md), migration
// 20260916115851_ficha_mandato_agenda_tematica.sql -- design.md "Data Models"
// > rel_mandato_agenda_tematica:
//  - vinculo aceito.
//  - segundo vinculo do mesmo par (id_mandato, id_agenda) rejeitado pelo
//    banco (23505), nao pelo cliente (FMC-07 AC5).
//  - cascade ao apagar o mandato.
//
// spec.md P1 "Informações Gerais do mandato" AC3/AC5 (FMC-07).

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
let idAgenda1: number;
let idAgenda2: number;

describe("ficha-mandato-contrato T4 -- rel_mandato_agenda_tematica", () => {
  beforeAll(async () => {
    const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'FMC T4')
      RETURNING id_contratante;
    `);
    idContratante = id_contratante;

    const [{ id_mandato }] = await runSql<{ id_mandato: number }>(`
      INSERT INTO dim_mandato (id_contratante) VALUES (${idContratante}) RETURNING id_mandato;
    `);
    idMandato = id_mandato;

    const agendas = await runSql<{ id_agenda: number }>(`
      SELECT id_agenda FROM ref_agenda_tematica ORDER BY id_agenda LIMIT 2;
    `);
    if (agendas.length < 2) {
      const criadas = await runSql<{ id_agenda: number }>(`
        INSERT INTO ref_agenda_tematica (nome, ordem) VALUES
          ('FMC T4 Tema 1', 9001), ('FMC T4 Tema 2', 9002)
        RETURNING id_agenda;
      `);
      idAgenda1 = criadas[0].id_agenda;
      idAgenda2 = criadas[1].id_agenda;
    } else {
      idAgenda1 = agendas[0].id_agenda;
      idAgenda2 = agendas[1].id_agenda;
    }
  }, 60000);

  afterAll(async () => {
    await runSql(`DELETE FROM rel_mandato_agenda_tematica WHERE id_mandato = ${idMandato};`);
    await runSql(`DELETE FROM ref_agenda_tematica WHERE nome IN ('FMC T4 Tema 1', 'FMC T4 Tema 2');`);
    await runSql(`DELETE FROM dim_mandato WHERE id_mandato = ${idMandato};`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
  }, 60000);

  it("aceita vinculo mandato-agenda tematica", async () => {
    const [linha] = await runSql<{ id_mandato: number; id_agenda: number }>(`
      INSERT INTO rel_mandato_agenda_tematica (id_mandato, id_agenda)
      VALUES (${idMandato}, ${idAgenda1})
      RETURNING id_mandato, id_agenda;
    `);
    expect(linha).toEqual({ id_mandato: idMandato, id_agenda: idAgenda1 });
  });

  it("pk_mandato_agenda: rejeita (23505) o mesmo par (mandato, agenda) vinculado duas vezes", async () => {
    await expectSqlError(
      `INSERT INTO rel_mandato_agenda_tematica (id_mandato, id_agenda)
       VALUES (${idMandato}, ${idAgenda1});`,
      "23505"
    );
  });

  it("ON DELETE CASCADE: apagar o mandato apaga os vinculos de agenda tematica", async () => {
    const [{ id_contratante: idContratanteDescartavel }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'FMC T4 Cascade')
      RETURNING id_contratante;
    `);
    const [{ id_mandato: idMandatoDescartavel }] = await runSql<{ id_mandato: number }>(`
      INSERT INTO dim_mandato (id_contratante) VALUES (${idContratanteDescartavel}) RETURNING id_mandato;
    `);
    await runSql(`
      INSERT INTO rel_mandato_agenda_tematica (id_mandato, id_agenda)
      VALUES (${idMandatoDescartavel}, ${idAgenda2});
    `);

    await runSql(`DELETE FROM dim_mandato WHERE id_mandato = ${idMandatoDescartavel};`);

    const restantes = await runSql<{ id_mandato: number }>(`
      SELECT id_mandato FROM rel_mandato_agenda_tematica WHERE id_mandato = ${idMandatoDescartavel};
    `);
    expect(restantes).toHaveLength(0);

    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratanteDescartavel};`);
  });
});
