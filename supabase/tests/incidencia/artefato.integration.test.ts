import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: ficha-mandato-contrato T2 Done-when
// (.specs/features/ficha-mandato-contrato/tasks.md), migration
// 20260916115418_ficha_artefato_estrutura.sql -- design.md "Data Models" >
// fat_artefato (verbatim docs/schema_sistema.sql:931-948, AD-008):
//  - URL valida aceita.
//  - ck_artefato_url: URL sem http(s):// rejeitada (23514).
//  - ck_artefato_referencia: escopo='contrato' com id_referencia preenchido
//    rejeitado (23514).
//  - app.trg_valida_artefato_referencia(): referencia cruzada de contrato
//    (escopo='registro' apontando para registro de outro contrato)
//    rejeitada (P0001).
//
// spec.md P1 "Registro de encontro com camada dinâmica" AC6/AC7 (FMC-17).

async function expectSqlError(sql: string, marker: string): Promise<void> {
  try {
    await runSql(sql);
    throw new Error(`expected query to fail with ${marker} but it succeeded`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain(marker);
  }
}

interface Fixture {
  idContratante: number;
  idContrato: number;
}

async function makeFixture(label: string): Promise<Fixture> {
  const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'FMC T2 ${label}')
    RETURNING id_contratante;
  `);
  const [{ id_contrato: idContrato }] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
    VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
    RETURNING id_contrato;
  `);
  return { idContratante, idContrato };
}

let a: Fixture;
let b: Fixture;
let idTipoRegistro: number;
let idUsuario: number;
let idRegistroA: number;

describe("ficha-mandato-contrato T2 -- fat_artefato", () => {
  beforeAll(async () => {
    a = await makeFixture("A");
    b = await makeFixture("B");

    idTipoRegistro = (
      await runSql<{ id_tipo_registro: number }>(`
      SELECT tr.id_tipo_registro FROM ref_tipo_registro tr
        JOIN ref_etapa e ON e.id_etapa = tr.id_etapa
        JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE p.nome = 'Estratégia' AND tr.codigo = 'monitoramento';
    `)
    )[0].id_tipo_registro;

    const usuarios = await runSql<{ id_usuario: number }>(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo)
      VALUES ('fmc-t2-u1@legislabrasil.test', 'FMC T2 Usuario', 'assessor', true)
      ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome
      RETURNING id_usuario;
    `);
    idUsuario = usuarios[0].id_usuario;

    const [{ id_registro }] = await runSql<{ id_registro: number }>(`
      INSERT INTO fat_registro (id_contrato, id_tipo_registro, ocorrido_em, id_usuario_autor)
      VALUES (${a.idContrato}, ${idTipoRegistro}, now(), ${idUsuario})
      RETURNING id_registro;
    `);
    idRegistroA = id_registro;
  }, 60000);

  afterAll(async () => {
    await runSql(`DELETE FROM fat_artefato WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});`);
    await runSql(`DELETE FROM fat_registro WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});`);
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});
      DELETE FROM rel_formulario_contrato WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});
      DELETE FROM dim_planejamento WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});
    `);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante IN (${a.idContratante}, ${b.idContratante});`);
    await runSql(`DELETE FROM log_auditoria WHERE id_usuario = ${idUsuario};`);
    await runSql(`DELETE FROM dim_usuario WHERE id_usuario = ${idUsuario};`);
  }, 60000);

  it("aceita URL valida com escopo='contrato' e id_referencia NULL", async () => {
    const [{ id_artefato }] = await runSql<{ id_artefato: number }>(`
      INSERT INTO fat_artefato (id_contrato, escopo, tipo, url)
      VALUES (${a.idContrato}, 'contrato', 'pasta_drive', 'https://drive.google.com/fmc-t2')
      RETURNING id_artefato;
    `);
    expect(id_artefato).toBeGreaterThan(0);
  });

  it("ck_artefato_url: rejeita (23514) URL sem http:// nem https://", async () => {
    await expectSqlError(
      `INSERT INTO fat_artefato (id_contrato, escopo, tipo, url)
       VALUES (${a.idContrato}, 'contrato', 'pasta_drive', 'ftp://exemplo.com/fmc-t2');`,
      "23514"
    );
  });

  it("ck_artefato_referencia: rejeita (23514) escopo='contrato' com id_referencia preenchido", async () => {
    await expectSqlError(
      `INSERT INTO fat_artefato (id_contrato, escopo, id_referencia, tipo, url)
       VALUES (${a.idContrato}, 'contrato', ${idRegistroA}, 'pasta_drive', 'https://drive.google.com/fmc-t2-invalido');`,
      "23514"
    );
  });

  it("trg_valida_artefato_referencia: aceita escopo='registro' apontando para registro do MESMO contrato; rejeita (P0001) registro de outro contrato", async () => {
    const [{ id_artefato }] = await runSql<{ id_artefato: number }>(`
      INSERT INTO fat_artefato (id_contrato, escopo, id_referencia, tipo, url)
      VALUES (${a.idContrato}, 'registro', ${idRegistroA}, 'cronograma', 'https://drive.google.com/fmc-t2-cronograma')
      RETURNING id_artefato;
    `);
    expect(id_artefato).toBeGreaterThan(0);

    await expectSqlError(
      `INSERT INTO fat_artefato (id_contrato, escopo, id_referencia, tipo, url)
       VALUES (${b.idContrato}, 'registro', ${idRegistroA}, 'cronograma', 'https://drive.google.com/fmc-t2-cross');`,
      "aponta para registro do contrato"
    );
  });
});
