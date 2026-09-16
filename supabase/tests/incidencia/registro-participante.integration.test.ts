import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: ficha-mandato-contrato T3 Done-when
// (.specs/features/ficha-mandato-contrato/tasks.md), migration
// 20260916115758_ficha_registro_participante.sql -- design.md "Data Models" >
// rel_registro_participante (B-01, fecha TIP-07):
//  - inserção aceita com id_usuario; com nome_livre.
//  - ck_reg_part_identificacao: rejeita com os dois preenchidos; rejeita com
//    nenhum preenchido (23514).
//  - ck_reg_part_origem: rejeita origem fora de legisla|mandato|externo (23514).
//  - uq_reg_part_usuario: rejeita o mesmo usuário duas vezes no mesmo
//    registro (23505).
//  - ON DELETE CASCADE a partir de fat_registro.
//
// spec.md P1 "Registro de encontro com camada dinâmica" AC9/AC10 (FMC-18,
// FMC-37).

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
let idContrato: number;
let idTipoRegistro: number;
let idUsuario1: number;
let idUsuario2: number;
let idRegistro: number;

describe("ficha-mandato-contrato T3 -- rel_registro_participante", () => {
  beforeAll(async () => {
    const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'FMC T3')
      RETURNING id_contratante;
    `);
    idContratante = id_contratante;

    const [{ id_contrato }] = await runSql<{ id_contrato: number }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
      RETURNING id_contrato;
    `);
    idContrato = id_contrato;

    idTipoRegistro = (
      await runSql<{ id_tipo_registro: number }>(`
      SELECT tr.id_tipo_registro FROM ref_tipo_registro tr
        JOIN ref_etapa e ON e.id_etapa = tr.id_etapa
        JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE p.nome = 'Estratégia' AND tr.codigo = 'monitoramento';
    `)
    )[0].id_tipo_registro;

    const usuarios = await runSql<{ id_usuario: number }>(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo) VALUES
        ('fmc-t3-u1@legislabrasil.test', 'FMC T3 Usuario 1', 'assessor', true),
        ('fmc-t3-u2@legislabrasil.test', 'FMC T3 Usuario 2', 'assessor', true)
      ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome
      RETURNING id_usuario;
    `);
    idUsuario1 = usuarios[0].id_usuario;
    idUsuario2 = usuarios[1].id_usuario;

    const [{ id_registro }] = await runSql<{ id_registro: number }>(`
      INSERT INTO fat_registro (id_contrato, id_tipo_registro, ocorrido_em, id_usuario_autor)
      VALUES (${idContrato}, ${idTipoRegistro}, now(), ${idUsuario1})
      RETURNING id_registro;
    `);
    idRegistro = id_registro;
  }, 60000);

  afterAll(async () => {
    await runSql(`DELETE FROM rel_registro_participante WHERE id_registro = ${idRegistro};`);
    await runSql(`DELETE FROM fat_registro WHERE id_contrato = ${idContrato};`);
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};
      DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};
      DELETE FROM dim_planejamento WHERE id_contrato = ${idContrato};
    `);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
    await runSql(`DELETE FROM log_auditoria WHERE id_usuario IN (${idUsuario1}, ${idUsuario2});`);
    await runSql(`DELETE FROM dim_usuario WHERE id_usuario IN (${idUsuario1}, ${idUsuario2});`);
  }, 60000);

  it("aceita insercao identificada por id_usuario", async () => {
    const [{ id_participacao }] = await runSql<{ id_participacao: number }>(`
      INSERT INTO rel_registro_participante (id_registro, id_usuario, origem)
      VALUES (${idRegistro}, ${idUsuario1}, 'legisla')
      RETURNING id_participacao;
    `);
    expect(id_participacao).toBeGreaterThan(0);
  });

  it("aceita insercao identificada por nome_livre", async () => {
    const [{ id_participacao }] = await runSql<{ id_participacao: number }>(`
      INSERT INTO rel_registro_participante (id_registro, nome_livre, origem)
      VALUES (${idRegistro}, 'FMC T3 Participante Externo', 'externo')
      RETURNING id_participacao;
    `);
    expect(id_participacao).toBeGreaterThan(0);
  });

  it("ck_reg_part_identificacao: rejeita (23514) id_usuario e nome_livre preenchidos juntos", async () => {
    await expectSqlError(
      `INSERT INTO rel_registro_participante (id_registro, id_usuario, nome_livre, origem)
       VALUES (${idRegistro}, ${idUsuario2}, 'FMC T3 Ambos Preenchidos', 'externo');`,
      "23514"
    );
  });

  it("ck_reg_part_identificacao: rejeita (23514) nem id_usuario nem nome_livre preenchidos", async () => {
    await expectSqlError(
      `INSERT INTO rel_registro_participante (id_registro, origem)
       VALUES (${idRegistro}, 'externo');`,
      "23514"
    );
  });

  it("ck_reg_part_origem: rejeita (23514) origem fora de legisla|mandato|externo", async () => {
    await expectSqlError(
      `INSERT INTO rel_registro_participante (id_registro, nome_livre, origem)
       VALUES (${idRegistro}, 'FMC T3 Origem Invalida', 'convidado');`,
      "23514"
    );
  });

  it("uq_reg_part_usuario: rejeita (23505) o mesmo usuario duas vezes no mesmo registro", async () => {
    await expectSqlError(
      `INSERT INTO rel_registro_participante (id_registro, id_usuario, origem)
       VALUES (${idRegistro}, ${idUsuario1}, 'legisla');`,
      "23505"
    );
  });

  it("ON DELETE CASCADE: apagar o fat_registro apaga as linhas de rel_registro_participante", async () => {
    const [{ id_registro: idRegistroDescartavel }] = await runSql<{ id_registro: number }>(`
      INSERT INTO fat_registro (id_contrato, id_tipo_registro, ocorrido_em, id_usuario_autor)
      VALUES (${idContrato}, ${idTipoRegistro}, now(), ${idUsuario1})
      RETURNING id_registro;
    `);
    await runSql(`
      INSERT INTO rel_registro_participante (id_registro, id_usuario, origem)
      VALUES (${idRegistroDescartavel}, ${idUsuario2}, 'legisla');
    `);

    await runSql(`DELETE FROM fat_registro WHERE id_registro = ${idRegistroDescartavel};`);

    const restantes = await runSql<{ id_participacao: number }>(`
      SELECT id_participacao FROM rel_registro_participante WHERE id_registro = ${idRegistroDescartavel};
    `);
    expect(restantes).toHaveLength(0);
  });
});
