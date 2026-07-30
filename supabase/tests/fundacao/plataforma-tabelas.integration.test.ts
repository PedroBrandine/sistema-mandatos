import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: T13 Done-when --
//  - As 3 tabelas existem com CHECKs (ck_usuario_papel, ck_vinculo_papel,
//    ck_vinculo_cargo, ck_vinculo_periodo) e uq_vinculo
//  - Partições de log_auditoria criadas para os próximos 18 meses
// Plus AD-001 compliance added in this same migration (RLS at DDL time):
// p_vinculo_proprio / p_log_admin policies exist.

async function expectSqlError(sql: string, errcode: string): Promise<void> {
  try {
    await runSql(sql);
    throw new Error("expected query to fail but it succeeded");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain(errcode);
  }
}

describe("T13 -- rel_usuario_contrato e log_auditoria", () => {
  it("ck_vinculo_papel rejects a papel_no_contrato outside the enum", async () => {
    await expectSqlError(
      `INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
       VALUES (999999, (SELECT id_usuario FROM dim_usuario LIMIT 1), 'presidente');`,
      "23514"
    );
  });

  it("ck_vinculo_cargo rejects a cargo outside the enum", async () => {
    await expectSqlError(
      `INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato, cargo)
       VALUES (999999, (SELECT id_usuario FROM dim_usuario LIMIT 1), 'assessor', 'imperador');`,
      "23514"
    );
  });

  it("ck_vinculo_periodo rejects dt_fim before dt_inicio", async () => {
    await expectSqlError(
      `INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato, dt_inicio, dt_fim)
       VALUES (999999, (SELECT id_usuario FROM dim_usuario LIMIT 1), 'assessor', '2026-06-01', '2026-01-01');`,
      "23514"
    );
  });

  describe("uq_vinculo", () => {
    // SPEC_DEVIATION (test fix, discovered in this session): the original
    // version of this test used a hardcoded, non-existent id_contrato
    // (888888). That worked in isolation, but fk_vinculo_contrato (added by
    // T14 against fat_contrato) now enforces referential integrity on this
    // column in the fully-migrated schema, so the very first INSERT failed
    // with 23503 (FK violation) before ever reaching the UNIQUE check this
    // test targets. Fixed by inserting a real fat_contrato row as fixture,
    // set up/torn down in beforeAll/afterAll (own 30s hookTimeout) instead of
    // inside the it() body, which shares the per-test 30s testTimeout and was
    // timing out once the extra fixture INSERTs were added inline.
    let idUsuario: string;
    let idContratante: number;
    let idContrato: number;

    beforeAll(async () => {
      const rows = await runSql<{ id_usuario: string }>(`SELECT id_usuario FROM dim_usuario LIMIT 1;`);
      idUsuario = rows[0].id_usuario;
      const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
        INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'T13 uq_vinculo fixture')
        RETURNING id_contratante;
      `);
      idContratante = id_contratante;
      const [{ id_contrato }] = await runSql<{ id_contrato: number }>(`
        INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
        VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
        RETURNING id_contrato;
      `);
      idContrato = id_contrato;
    });

    afterAll(async () => {
      await runSql(`DELETE FROM rel_usuario_contrato WHERE id_contrato = ${idContrato};`);
      await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};`);
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
    });

    it("rejects a duplicate open (id_contrato, id_usuario, papel_no_contrato)", async () => {
      await runSql(`
        INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
        VALUES (${idContrato}, ${idUsuario}, 'leitura')
        ON CONFLICT (id_contrato, id_usuario, papel_no_contrato) DO NOTHING;
      `);
      await expectSqlError(
        `INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato) VALUES (${idContrato}, ${idUsuario}, 'leitura');`,
        "23505"
      );
    });
  });

  it("ck_usuario_papel (dim_usuario) rejects a papel_global outside the enum", async () => {
    await expectSqlError(
      `INSERT INTO dim_usuario (email, nome, papel_global) VALUES ('t13-invalido@legislabrasil.test', 'Teste T13', 'rei');`,
      "23514"
    );
  });

  it("creates log_auditoria partitions covering the next 18 months", async () => {
    const rows = await runSql<{ count: string }>(`
      SELECT count(*)::int AS count FROM pg_inherits i
        JOIN pg_class parent ON parent.oid = i.inhparent
        JOIN pg_class child  ON child.oid  = i.inhrelid
       WHERE parent.relname = 'log_auditoria' AND child.relname LIKE 'log_auditoria_20%';
    `);
    expect(Number(rows[0].count)).toBeGreaterThanOrEqual(18);
  });

  it("enables RLS on rel_usuario_contrato with policy p_vinculo_proprio (AD-001)", async () => {
    const rows = await runSql<{ policyname: string }>(`
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rel_usuario_contrato';
    `);
    expect(rows.map((r) => r.policyname)).toContain("p_vinculo_proprio");
  });

  it("enables RLS on log_auditoria with policy p_log_admin (AD-001)", async () => {
    const rows = await runSql<{ policyname: string }>(`
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'log_auditoria';
    `);
    expect(rows.map((r) => r.policyname)).toContain("p_log_admin");
  });
});
