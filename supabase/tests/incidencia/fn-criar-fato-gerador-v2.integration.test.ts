import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: fatos-geradores-ciclo-vida T6 Done-when
// (.specs/features/fatos-geradores-ciclo-vida/tasks.md), migration
// 20260916164709_incidencia_v2_fn_criar_fato_gerador.sql --
//  - função aceita os 5 parâmetros novos e grava titulo/situacao/dt_prevista
//  - validação de mesmo-contrato para p_id_pre_insight_origem e
//    p_id_registro_origem (mesma forma de RAISE EXCEPTION das duas já
//    existentes)
//  - rel_fato_origem grava as 4 colunas quando qualquer origem vier
//    preenchida
//  - criar fato projetado com p_id_registro_origem de outro contrato ->
//    exceção; com o mesmo contrato -> sucesso e linha em rel_fato_origem
//    com id_registro preenchido
//
// spec.md P2 "Registro e Pré-Insight como origem" AC1-AC4; P1 "Fato
// projetado e sua realização" AC1.

async function expectSqlError(sql: string, matchers: string[]): Promise<void> {
  try {
    await runSql(sql);
    throw new Error(`expected query to fail matching ${matchers.join(", ")} but it succeeded`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    for (const matcher of matchers) {
      expect(message).toContain(matcher);
    }
  }
}

interface Fixture {
  idContratante: number;
  idContrato: number;
}

async function makeFixture(label: string): Promise<Fixture> {
  const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'FGC T6 ${label}')
    RETURNING id_contratante;
  `);
  const [{ id_contrato: idContrato }] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
    VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
    RETURNING id_contrato;
  `);
  return { idContratante, idContrato };
}

let a: Fixture; // contrato do registro/fato
let b: Fixture; // contrato de fora, usado no teste negativo
let idTipologia: number;
let idUsuario: number;
let idTipoRegistro: number;
let idRegistroDeA: number;
let idRegistroDeB: number;
const idsFatoCriados: number[] = [];
const idsRegistroCriados: number[] = [];

describe("fatos-geradores-ciclo-vida T6 -- app.criar_fato_gerador com titulo/situacao/dt_prevista/pre_insight/registro", () => {
  beforeAll(async () => {
    a = await makeFixture("A");
    b = await makeFixture("B");
    idTipologia = (
      await runSql<{ id_tipologia: number }>(`SELECT id_tipologia FROM ref_tipologia ORDER BY id_tipologia LIMIT 1;`)
    )[0].id_tipologia;
    idUsuario = (await runSql<{ id_usuario: number }>(`SELECT id_usuario FROM dim_usuario ORDER BY id_usuario LIMIT 1;`))[0]
      .id_usuario;
    idTipoRegistro = (
      await runSql<{ id_tipo_registro: number }>(`SELECT id_tipo_registro FROM ref_tipo_registro ORDER BY id_tipo_registro LIMIT 1;`)
    )[0].id_tipo_registro;

    idRegistroDeA = (
      await runSql<{ id_registro: number }>(`
        INSERT INTO fat_registro (id_contrato, id_tipo_registro, ocorrido_em, resumo, id_usuario_autor)
        VALUES (${a.idContrato}, ${idTipoRegistro}, now(), 'FGC T6 registro de A', ${idUsuario})
        RETURNING id_registro;
      `)
    )[0].id_registro;
    idRegistroDeB = (
      await runSql<{ id_registro: number }>(`
        INSERT INTO fat_registro (id_contrato, id_tipo_registro, ocorrido_em, resumo, id_usuario_autor)
        VALUES (${b.idContrato}, ${idTipoRegistro}, now(), 'FGC T6 registro de B', ${idUsuario})
        RETURNING id_registro;
      `)
    )[0].id_registro;
    idsRegistroCriados.push(idRegistroDeA, idRegistroDeB);
  }, 60000);

  afterAll(async () => {
    if (idsFatoCriados.length > 0) {
      await runSql(`DELETE FROM fat_fato_gerador WHERE id_fato_gerador IN (${idsFatoCriados.join(",")});`);
    }
    if (idsRegistroCriados.length > 0) {
      await runSql(`DELETE FROM fat_registro WHERE id_registro IN (${idsRegistroCriados.join(",")});`);
    }
    for (const f of [a, b]) {
      await runSql(`
        DELETE FROM fat_etapa_contrato WHERE id_contrato = ${f.idContrato};
        DELETE FROM rel_formulario_contrato WHERE id_contrato = ${f.idContrato};
        DELETE FROM dim_planejamento WHERE id_contrato = ${f.idContrato};
      `);
      await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${f.idContrato};`);
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${f.idContratante};`);
    }
  }, 60000);

  it("cria fato realizado com titulo, grava a coluna titulo corretamente", async () => {
    const [{ criar_fato_gerador: id }] = await runSql<{ criar_fato_gerador: number }>(`
      SELECT app.criar_fato_gerador(
        p_id_contrato := ${a.idContrato}, p_id_tipologia := ${idTipologia}, p_nivel_d1 := 'baixo',
        p_dt_ocorrencia := '2026-09-10', p_titulo := 'FGC T6 fato com titulo'
      ) AS criar_fato_gerador;
    `);
    idsFatoCriados.push(id);

    const [row] = await runSql<{ titulo: string; situacao: string }>(`
      SELECT titulo, situacao FROM fat_fato_gerador WHERE id_fato_gerador = ${id};
    `);
    expect(row.titulo).toBe("FGC T6 fato com titulo");
    expect(row.situacao).toBe("realizado");
  });

  it("cria fato projetado com p_id_registro_origem do MESMO contrato: sucesso, grava situacao/dt_prevista e rel_fato_origem.id_registro", async () => {
    const [{ criar_fato_gerador: id }] = await runSql<{ criar_fato_gerador: number }>(`
      SELECT app.criar_fato_gerador(
        p_id_contrato := ${a.idContrato}, p_id_tipologia := ${idTipologia}, p_nivel_d1 := 'baixo',
        p_situacao := 'projetado', p_dt_prevista := '2026-12-01', p_titulo := 'FGC T6 fato projetado',
        p_id_registro_origem := ${idRegistroDeA}
      ) AS criar_fato_gerador;
    `);
    idsFatoCriados.push(id);

    const [fato] = await runSql<{ situacao: string; dt_prevista: string; dt_ocorrencia: string | null }>(`
      SELECT situacao, dt_prevista, dt_ocorrencia FROM fat_fato_gerador WHERE id_fato_gerador = ${id};
    `);
    expect(fato.situacao).toBe("projetado");
    expect(fato.dt_ocorrencia).toBeNull();

    const [vinculo] = await runSql<{ id_registro: number; id_meta: number | null; id_insight: number | null; id_pre_insight: number | null }>(`
      SELECT id_registro, id_meta, id_insight, id_pre_insight FROM rel_fato_origem WHERE id_fato_gerador = ${id};
    `);
    expect(vinculo.id_registro).toBe(idRegistroDeA);
    expect(vinculo.id_meta).toBeNull();
    expect(vinculo.id_insight).toBeNull();
    expect(vinculo.id_pre_insight).toBeNull();
  });

  it("cria fato com p_id_registro_origem de OUTRO contrato: RAISE EXCEPTION, nenhuma linha gravada", async () => {
    const [{ count: antesCount }] = await runSql<{ count: number }>(
      `SELECT count(*)::int AS count FROM fat_fato_gerador WHERE id_contrato = ${a.idContrato};`
    );

    await expectSqlError(
      `SELECT app.criar_fato_gerador(
        p_id_contrato := ${a.idContrato}, p_id_tipologia := ${idTipologia}, p_nivel_d1 := 'baixo',
        p_dt_ocorrencia := '2026-09-12', p_id_registro_origem := ${idRegistroDeB}
      );`,
      [`Registro ${idRegistroDeB} não pertence ao contrato ${a.idContrato}`]
    );

    const [{ count: depoisCount }] = await runSql<{ count: number }>(
      `SELECT count(*)::int AS count FROM fat_fato_gerador WHERE id_contrato = ${a.idContrato};`
    );
    expect(depoisCount).toBe(antesCount);
  });
});
