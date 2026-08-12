import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: T14 Done-when --
//  - As 5 tabelas (dim_contratante, dim_mandato, dim_coalizao, fat_contrato,
//    rel_coalizao_membro) existem com todos os CHECKs/UNIQUEs do schema
//    aprovado (ck_contratante_tipo, ck_mandato_titulo, ck_contrato_status,
//    ck_contrato_motivo, ck_membro_papel, ck_membro_grupo, etc.)
//  - ix_contratante_nome_norm existe (suporte à checagem de duplicata)
//
// This test file did not exist when T14's migration (0009_fundacao_tabelas.sql)
// was first written in the rushed batch -- written from scratch in this
// review session, not adapted from any prior draft.

async function expectSqlError(sql: string, errcode: string): Promise<void> {
  try {
    await runSql(sql);
    throw new Error("expected query to fail but it succeeded");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain(errcode);
  }
}

describe("T14 -- Fundação e âncora (dim_contratante/dim_mandato/dim_coalizao/fat_contrato/rel_coalizao_membro)", () => {
  it("creates ix_contratante_nome_norm on dim_contratante(nome_normalizado)", async () => {
    const rows = await runSql<{ indexname: string }>(`
      SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'dim_contratante' AND indexname = 'ix_contratante_nome_norm';
    `);
    expect(rows).toHaveLength(1);
  });

  describe("dim_contratante CHECKs", () => {
    it("ck_contratante_tipo rejects a tipo_contratante outside the enum", async () => {
      await expectSqlError(
        `INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('imperio', 'T14 Contratante Invalido');`,
        "23514"
      );
    });

    it("ck_contratante_uf rejects a sg_uf outside the 2-uppercase-letter format", async () => {
      await expectSqlError(
        `INSERT INTO dim_contratante (tipo_contratante, nome, sg_uf) VALUES ('mandato', 'T14 Contratante UF Invalida', 'sp');`,
        "23514"
      );
    });
  });

  describe("dim_mandato CHECKs (failing inserts, shared contratante -- no row ever persists)", () => {
    let idContratante: number;

    beforeAll(async () => {
      const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
        INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'T14 Mandato CHECKs fixture')
        RETURNING id_contratante;
      `);
      idContratante = id_contratante;
    });

    afterAll(async () => {
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
    });

    it("ck_mandato_titulo rejects a nr_titulo_eleitoral that is not 12 digits", async () => {
      await expectSqlError(
        `INSERT INTO dim_mandato (id_contratante, nr_titulo_eleitoral) VALUES (${idContratante}, '123');`,
        "23514"
      );
    });

    it("ck_mandato_raca rejects a ds_raca outside the enum", async () => {
      await expectSqlError(
        `INSERT INTO dim_mandato (id_contratante, ds_raca) VALUES (${idContratante}, 'Azul');`,
        "23514"
      );
    });

    it("ck_mandato_origem rejects an origem_partido_cargo outside the enum", async () => {
      await expectSqlError(
        `INSERT INTO dim_mandato (id_contratante, origem_partido_cargo) VALUES (${idContratante}, 'chute');`,
        "23514"
      );
    });
  });

  describe("dim_mandato UNIQUE(id_contratante)", () => {
    let idContratante: number;
    let idMandato: number;

    beforeAll(async () => {
      const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
        INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'T14 Mandato UNIQUE fixture')
        RETURNING id_contratante;
      `);
      idContratante = id_contratante;
      const [{ id_mandato }] = await runSql<{ id_mandato: number }>(`
        INSERT INTO dim_mandato (id_contratante) VALUES (${idContratante}) RETURNING id_mandato;
      `);
      idMandato = id_mandato;
    });

    afterAll(async () => {
      await runSql(`DELETE FROM dim_mandato WHERE id_mandato = ${idMandato};`);
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
    });

    it("rejects a second dim_mandato row for the same id_contratante", async () => {
      await expectSqlError(`INSERT INTO dim_mandato (id_contratante) VALUES (${idContratante});`, "23505");
    });
  });

  describe("dim_mandato UNIQUE(nr_titulo_eleitoral)", () => {
    let idContratanteA: number;
    let idContratanteB: number;
    let idMandatoA: number;
    const titulo = "123456789012";

    beforeAll(async () => {
      const [{ id_contratante: a }] = await runSql<{ id_contratante: number }>(`
        INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'T14 Titulo Unico A')
        RETURNING id_contratante;
      `);
      idContratanteA = a;
      const [{ id_contratante: b }] = await runSql<{ id_contratante: number }>(`
        INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'T14 Titulo Unico B')
        RETURNING id_contratante;
      `);
      idContratanteB = b;
      const [{ id_mandato }] = await runSql<{ id_mandato: number }>(`
        INSERT INTO dim_mandato (id_contratante, nr_titulo_eleitoral) VALUES (${idContratanteA}, '${titulo}') RETURNING id_mandato;
      `);
      idMandatoA = id_mandato;
    });

    afterAll(async () => {
      await runSql(`DELETE FROM dim_mandato WHERE id_mandato = ${idMandatoA};`);
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante IN (${idContratanteA}, ${idContratanteB});`);
    });

    it("rejects a second dim_mandato row (different contratante) with the same nr_titulo_eleitoral", async () => {
      await expectSqlError(
        `INSERT INTO dim_mandato (id_contratante, nr_titulo_eleitoral) VALUES (${idContratanteB}, '${titulo}');`,
        "23505"
      );
    });
  });

  describe("dim_coalizao UNIQUE(id_contratante)", () => {
    let idContratante: number;
    let idCoalizao: number;

    beforeAll(async () => {
      const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
        INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('coalizao', 'T14 Coalizao UNIQUE fixture')
        RETURNING id_contratante;
      `);
      idContratante = id_contratante;
      const [{ id_coalizao }] = await runSql<{ id_coalizao: number }>(`
        INSERT INTO dim_coalizao (id_contratante) VALUES (${idContratante}) RETURNING id_coalizao;
      `);
      idCoalizao = id_coalizao;
    });

    afterAll(async () => {
      await runSql(`DELETE FROM dim_coalizao WHERE id_coalizao = ${idCoalizao};`);
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
    });

    it("rejects a second dim_coalizao row for the same id_contratante", async () => {
      await expectSqlError(`INSERT INTO dim_coalizao (id_contratante) VALUES (${idContratante});`, "23505");
    });
  });

  describe("fat_contrato CHECKs (failing inserts, shared contratante -- no row ever persists)", () => {
    let idContratante: number;
    let idProduto: number;

    beforeAll(async () => {
      const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
        INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'T14 Contrato CHECKs fixture')
        RETURNING id_contratante;
      `);
      idContratante = id_contratante;
      const [{ id_produto }] = await runSql<{ id_produto: number }>(
        `SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia';`
      );
      idProduto = id_produto;
    });

    afterAll(async () => {
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
    });

    it("ck_contrato_status rejects a status outside the enum", async () => {
      await expectSqlError(
        `INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
         VALUES (${idContratante}, ${idProduto}, CURRENT_DATE, 'prospeccao');`,
        "23514"
      );
    });

    it("ck_contrato_profundidade rejects a profundidade_impacto outside the enum", async () => {
      await expectSqlError(
        `INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status, profundidade_impacto)
         VALUES (${idContratante}, ${idProduto}, CURRENT_DATE, 'ativo', 'total');`,
        "23514"
      );
    });

    it("ck_contrato_periodo rejects dt_fim before dt_inicio", async () => {
      await expectSqlError(
        `INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, dt_fim, status)
         VALUES (${idContratante}, ${idProduto}, '2026-06-01', '2026-01-01', 'concluido');`,
        "23514"
      );
    });

    it("ck_contrato_motivo rejects status='nao_concluido' without motivo_encerramento", async () => {
      await expectSqlError(
        `INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
         VALUES (${idContratante}, ${idProduto}, CURRENT_DATE, 'nao_concluido');`,
        "23514"
      );
    });
  });

  describe("fat_contrato ck_contrato_nao_e_proprio_anterior", () => {
    let idContratante: number;
    let idContrato: number;

    beforeAll(async () => {
      const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
        INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'T14 Contrato Proprio Anterior fixture')
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
      // operacao-regua-instanciacao: trigger AFTER INSERT em fat_contrato
      // agora popula fat_etapa_contrato/rel_formulario_contrato/dim_planejamento
      // (ON DELETE RESTRICT) -- precisam sair antes de fat_contrato.
      await runSql(`DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};`);
      await runSql(`DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};`);
      await runSql(`DELETE FROM dim_planejamento WHERE id_contrato = ${idContrato};`);
      await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};`);
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
    });

    it("rejects a contrato set as its own id_contrato_anterior", async () => {
      await expectSqlError(
        `UPDATE fat_contrato SET id_contrato_anterior = ${idContrato} WHERE id_contrato = ${idContrato};`,
        "23514"
      );
    });
  });

  describe("rel_coalizao_membro CHECKs and UNIQUE", () => {
    let idContratanteCol: number;
    let idCoalizao: number;
    let idContratanteMandato: number;
    let idContrato: number;
    let idMembro: number;

    beforeAll(async () => {
      const [{ id_contratante: colContratante }] = await runSql<{ id_contratante: number }>(`
        INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('coalizao', 'T14 Membro Coalizao fixture')
        RETURNING id_contratante;
      `);
      idContratanteCol = colContratante;
      const [{ id_coalizao }] = await runSql<{ id_coalizao: number }>(`
        INSERT INTO dim_coalizao (id_contratante) VALUES (${idContratanteCol}) RETURNING id_coalizao;
      `);
      idCoalizao = id_coalizao;
      const [{ id_contratante: mandatoContratante }] = await runSql<{ id_contratante: number }>(`
        INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'T14 Membro Mandato fixture')
        RETURNING id_contratante;
      `);
      idContratanteMandato = mandatoContratante;
      const [{ id_contrato }] = await runSql<{ id_contrato: number }>(`
        INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
        VALUES (${idContratanteMandato}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
        RETURNING id_contrato;
      `);
      idContrato = id_contrato;
      const [{ id_membro }] = await runSql<{ id_membro: number }>(`
        INSERT INTO rel_coalizao_membro (id_coalizao, id_contrato, papel) VALUES (${idCoalizao}, ${idContrato}, 'membro')
        RETURNING id_membro;
      `);
      idMembro = id_membro;
    });

    afterAll(async () => {
      await runSql(`DELETE FROM rel_coalizao_membro WHERE id_membro = ${idMembro};`);
      // operacao-regua-instanciacao: mesma correção do bloco anterior (ON DELETE RESTRICT novo).
      await runSql(`DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};`);
      await runSql(`DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};`);
      await runSql(`DELETE FROM dim_planejamento WHERE id_contrato = ${idContrato};`);
      await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};`);
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratanteMandato};`);
      await runSql(`DELETE FROM dim_coalizao WHERE id_coalizao = ${idCoalizao};`);
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratanteCol};`);
    });

    it("ck_membro_papel rejects a papel outside the enum", async () => {
      await expectSqlError(
        `INSERT INTO rel_coalizao_membro (id_coalizao, id_contrato, papel) VALUES (${idCoalizao}, ${idContrato}, 'presidente');`,
        "23514"
      );
    });

    it("ck_membro_grupo rejects papel='grupo_trabalho' without nome_grupo", async () => {
      await expectSqlError(
        `INSERT INTO rel_coalizao_membro (id_coalizao, id_contrato, papel) VALUES (${idCoalizao}, ${idContrato}, 'grupo_trabalho');`,
        "23514"
      );
    });

    it("ck_membro_periodo rejects dt_saida before dt_entrada", async () => {
      await expectSqlError(
        `INSERT INTO rel_coalizao_membro (id_coalizao, id_contrato, papel, dt_entrada, dt_saida)
         VALUES (${idCoalizao}, ${idContrato}, 'secretaria_executiva', '2026-06-01', '2026-01-01');`,
        "23514"
      );
    });

    it("uq_coalizao_membro rejects a duplicate (id_coalizao, id_contrato, papel)", async () => {
      await expectSqlError(
        `INSERT INTO rel_coalizao_membro (id_coalizao, id_contrato, papel) VALUES (${idCoalizao}, ${idContrato}, 'membro');`,
        "23505"
      );
    });
  });
});
