import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: fatos-geradores-ciclo-vida T3 Done-when
// (.specs/features/fatos-geradores-ciclo-vida/tasks.md), migration
// 20260916163109_incidencia_v2_origem_quatro.sql --
//  - 2 colunas novas (id_pre_insight, id_registro) + ck_fato_origem
//    reescrita (4 colunas, "ao menos uma") aplicados
//  - linha com só id_registro preenchido é aceita
//  - linha com as 4 NULL é rejeitada
//  - linha inexistente (fato sem vínculo) continua válido
//
// spec.md P2 "Registro e Pré-Insight como origem" AC1/AC2/AC3.

async function expectSqlError(sql: string, errcode: string): Promise<void> {
  try {
    await runSql(sql);
    throw new Error(`expected query to fail with ${errcode} but it succeeded`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain(errcode);
  }
}

interface Fixture {
  idContratante: number;
  idContrato: number;
}

async function makeFixture(label: string): Promise<Fixture> {
  const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'FGC T3 ${label}')
    RETURNING id_contratante;
  `);
  const [{ id_contrato: idContrato }] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
    VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
    RETURNING id_contrato;
  `);
  return { idContratante, idContrato };
}

let fixture: Fixture;
let idTipologia: number;
let idFatoA: number; // vai ganhar vínculo via id_registro
let idFatoB: number; // fica sem nenhuma linha em rel_fato_origem
let idRegistro: number;
const idsVinculoCriados: number[] = [];

describe("fatos-geradores-ciclo-vida T3 -- rel_fato_origem com 4 origens", () => {
  beforeAll(async () => {
    fixture = await makeFixture("A");
    idTipologia = (
      await runSql<{ id_tipologia: number }>(`SELECT id_tipologia FROM ref_tipologia ORDER BY id_tipologia LIMIT 1;`)
    )[0].id_tipologia;
    const idTipoRegistro = (
      await runSql<{ id_tipo_registro: number }>(`SELECT id_tipo_registro FROM ref_tipo_registro ORDER BY id_tipo_registro LIMIT 1;`)
    )[0].id_tipo_registro;

    idRegistro = (
      await runSql<{ id_registro: number }>(`
        INSERT INTO fat_registro (id_contrato, id_tipo_registro, ocorrido_em, resumo, id_usuario_autor)
        VALUES (${fixture.idContrato}, ${idTipoRegistro}, now(),
                'FGC T3 registro origem', (SELECT id_usuario FROM dim_usuario ORDER BY id_usuario LIMIT 1))
        RETURNING id_registro;
      `)
    )[0].id_registro;

    idFatoA = (
      await runSql<{ id_fato_gerador: number }>(`
        INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, nivel_d1, dt_ocorrencia)
        VALUES (${fixture.idContrato}, ${idTipologia}, 'baixo', '2026-09-10')
        RETURNING id_fato_gerador;
      `)
    )[0].id_fato_gerador;

    idFatoB = (
      await runSql<{ id_fato_gerador: number }>(`
        INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, nivel_d1, dt_ocorrencia)
        VALUES (${fixture.idContrato}, ${idTipologia}, 'baixo', '2026-09-11')
        RETURNING id_fato_gerador;
      `)
    )[0].id_fato_gerador;
  }, 60000);

  afterAll(async () => {
    if (idsVinculoCriados.length > 0) {
      await runSql(`DELETE FROM rel_fato_origem WHERE id_vinculo IN (${idsVinculoCriados.join(",")});`);
    }
    await runSql(`DELETE FROM fat_fato_gerador WHERE id_contrato = ${fixture.idContrato};`);
    await runSql(`DELETE FROM fat_registro WHERE id_contrato = ${fixture.idContrato};`);
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato = ${fixture.idContrato};
      DELETE FROM rel_formulario_contrato WHERE id_contrato = ${fixture.idContrato};
      DELETE FROM dim_planejamento WHERE id_contrato = ${fixture.idContrato};
    `);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${fixture.idContrato};`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${fixture.idContratante};`);
  }, 60000);

  it("2 colunas novas existem, nullable", async () => {
    const rows = await runSql<{ column_name: string; is_nullable: string }>(`
      SELECT column_name, is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'rel_fato_origem'
         AND column_name IN ('id_pre_insight', 'id_registro');
    `);
    const porColuna = new Map(rows.map((r) => [r.column_name, r]));
    expect(porColuna.get("id_pre_insight")?.is_nullable).toBe("YES");
    expect(porColuna.get("id_registro")?.is_nullable).toBe("YES");
  });

  it("positivo: linha com só id_registro preenchido é aceita", async () => {
    const [{ id_vinculo: id }] = await runSql<{ id_vinculo: number }>(`
      INSERT INTO rel_fato_origem (id_fato_gerador, id_registro)
      VALUES (${idFatoA}, ${idRegistro})
      RETURNING id_vinculo;
    `);
    idsVinculoCriados.push(id);

    const [row] = await runSql<{ id_registro: number; id_meta: number | null; id_insight: number | null; id_pre_insight: number | null }>(`
      SELECT id_registro, id_meta, id_insight, id_pre_insight FROM rel_fato_origem WHERE id_vinculo = ${id};
    `);
    expect(row.id_registro).toBe(idRegistro);
    expect(row.id_meta).toBeNull();
    expect(row.id_insight).toBeNull();
    expect(row.id_pre_insight).toBeNull();
  });

  it("negativo (23514): linha com as 4 origens NULL é rejeitada por ck_fato_origem", async () => {
    await expectSqlError(
      `INSERT INTO rel_fato_origem (id_fato_gerador) VALUES (${idFatoA});`,
      "23514"
    );
  });

  it("fato sem nenhuma linha em rel_fato_origem (fato sem vínculo) continua válido e selecionável", async () => {
    const rows = await runSql<{ id_fato_gerador: number }>(`
      SELECT f.id_fato_gerador FROM fat_fato_gerador f
       WHERE f.id_fato_gerador = ${idFatoB}
         AND NOT EXISTS (SELECT 1 FROM rel_fato_origem r WHERE r.id_fato_gerador = f.id_fato_gerador);
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].id_fato_gerador).toBe(idFatoB);
  });
});
