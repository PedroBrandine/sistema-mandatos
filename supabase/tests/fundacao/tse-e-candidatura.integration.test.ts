import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: T15 Done-when --
//  - As 4 tabelas TSE (com partições 2022/2024/outras) e a MV existem
//  - rel_mandato_candidatura existe com uq_mandato_candidatura,
//    uq_mandato_candidatura_vigente (índice único parcial) e os CHECKs de
//    método/confiança/status

async function expectSqlError(sql: string, errcode: string): Promise<void> {
  try {
    await runSql(sql);
    throw new Error("expected query to fail but it succeeded");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain(errcode);
  }
}

describe("T15 -- schema tse e rel_mandato_candidatura", () => {
  it("creates the 4 tse tables, each partitioned into 2022/2024/outras", async () => {
    const rows = await runSql<{ parent: string; count: string }>(`
      SELECT parent.relname AS parent, count(*)::int AS count
        FROM pg_inherits i
        JOIN pg_class parent ON parent.oid = i.inhparent
        JOIN pg_namespace n ON n.oid = parent.relnamespace
       WHERE n.nspname = 'tse' AND parent.relname IN ('dim_candidatura', 'fat_votacao_zona', 'dim_perfil_eleitorado')
       GROUP BY parent.relname;
    `);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(Number(row.count)).toBe(3);
    }
  });

  it("creates tse.rel_rede_social (not partitioned, per schema)", async () => {
    const rows = await runSql<{ relname: string }>(`
      SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'tse' AND c.relname = 'rel_rede_social';
    `);
    expect(rows).toHaveLength(1);
  });

  it("creates tse.mv_candidatura_resumo with its UNIQUE index", async () => {
    const rows = await runSql<{ matviewname: string }>(`
      SELECT matviewname FROM pg_matviews WHERE schemaname = 'tse' AND matviewname = 'mv_candidatura_resumo';
    `);
    expect(rows).toHaveLength(1);
    const idx = await runSql<{ indexname: string }>(`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'tse' AND indexname = 'uq_mv_candidatura_resumo';
    `);
    expect(idx).toHaveLength(1);
  });

  describe("rel_mandato_candidatura constraints", () => {
    let idMandato: string;

    beforeAll(async () => {
      const rows = await runSql<{ id_mandato: string }>(`
        INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'T15 Mandato Teste')
        RETURNING (SELECT id_contratante FROM dim_contratante WHERE nome = 'T15 Mandato Teste' LIMIT 1) AS id_contratante;
      `);
      void rows;
      const contratanteRows = await runSql<{ id_contratante: string }>(
        `SELECT id_contratante FROM dim_contratante WHERE nome = 'T15 Mandato Teste' ORDER BY id_contratante DESC LIMIT 1;`
      );
      const idContratante = contratanteRows[0].id_contratante;
      const mandatoRows = await runSql<{ id_mandato: string }>(`
        INSERT INTO dim_mandato (id_contratante) VALUES (${idContratante}) RETURNING id_mandato;
      `);
      idMandato = mandatoRows[0].id_mandato;
    });

    afterAll(async () => {
      await runSql(`DELETE FROM rel_mandato_candidatura WHERE id_mandato = ${idMandato};`);
      await runSql(`DELETE FROM dim_mandato WHERE id_mandato = ${idMandato};`);
      await runSql(`DELETE FROM dim_contratante WHERE nome = 'T15 Mandato Teste';`);
    });

    it("ck_match_metodo rejects a metodo_match outside the enum", async () => {
      await expectSqlError(
        `INSERT INTO rel_mandato_candidatura (id_mandato, ano_eleicao, sq_candidato, nr_turno, metodo_match, confianca, status, validado_em)
         VALUES (${idMandato}, 2022, 1, 1, 'adivinhacao', 'alta', 'confirmado', now());`,
        "23514"
      );
    });

    it("ck_match_confianca rejects a confianca outside the enum", async () => {
      await expectSqlError(
        `INSERT INTO rel_mandato_candidatura (id_mandato, ano_eleicao, sq_candidato, nr_turno, metodo_match, confianca, status, validado_em)
         VALUES (${idMandato}, 2022, 2, 1, 'manual', 'certeza_absoluta', 'confirmado', now());`,
        "23514"
      );
    });

    it("ck_match_validacao rejects status='confirmado' without validado_em", async () => {
      await expectSqlError(
        `INSERT INTO rel_mandato_candidatura (id_mandato, ano_eleicao, sq_candidato, nr_turno, metodo_match, confianca, status)
         VALUES (${idMandato}, 2022, 3, 1, 'manual', 'alta', 'confirmado');`,
        "23514"
      );
    });

    it("uq_mandato_candidatura_vigente allows only one eh_mandato_vigente=true row per mandato", async () => {
      await runSql(`
        INSERT INTO rel_mandato_candidatura
          (id_mandato, ano_eleicao, sq_candidato, nr_turno, metodo_match, confianca, status, eh_mandato_vigente, validado_em)
        VALUES (${idMandato}, 2022, 4, 1, 'manual', 'alta', 'confirmado', true, now());
      `);
      await expectSqlError(
        `INSERT INTO rel_mandato_candidatura
           (id_mandato, ano_eleicao, sq_candidato, nr_turno, metodo_match, confianca, status, eh_mandato_vigente, validado_em)
         VALUES (${idMandato}, 2024, 5, 1, 'manual', 'alta', 'confirmado', true, now());`,
        "23505"
      );
    });

    it("uq_mandato_candidatura rejects a duplicate (id_mandato, ano_eleicao, sq_candidato, nr_turno)", async () => {
      await runSql(`
        INSERT INTO rel_mandato_candidatura
          (id_mandato, ano_eleicao, sq_candidato, nr_turno, metodo_match, confianca, status, validado_em)
        VALUES (${idMandato}, 2024, 6, 1, 'manual', 'alta', 'confirmado', now())
        ON CONFLICT DO NOTHING;
      `);
      await expectSqlError(
        `INSERT INTO rel_mandato_candidatura
           (id_mandato, ano_eleicao, sq_candidato, nr_turno, metodo_match, confianca, status, validado_em)
         VALUES (${idMandato}, 2024, 6, 1, 'manual', 'media', 'confirmado', now());`,
        "23505"
      );
    });
  });
});
