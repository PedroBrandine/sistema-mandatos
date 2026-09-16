import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: fatos-geradores-ciclo-vida T4 Done-when
// (.specs/features/fatos-geradores-ciclo-vida/tasks.md), migration
// 20260916163414_incidencia_v2_iip_so_realizados.sql --
//  - mv_iip_contrato filtra por situacao='realizado'
//  - refresh incluído na própria migration
//  - criar fato projetado + atualizaIipContrato() -> IIP/nr_fatos não mudam;
//    realizar o fato -> mudam
//
// spec.md P1 "Fato projetado e sua realização" AC3, Independent Test.

interface Fixture {
  idContratante: number;
  idContrato: number;
}

async function makeFixture(label: string): Promise<Fixture> {
  const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'FGC T4 ${label}')
    RETURNING id_contratante;
  `);
  const [{ id_contrato: idContrato }] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
    VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
    RETURNING id_contrato;
  `);
  return { idContratante, idContrato };
}

async function atualizaIipContrato(): Promise<void> {
  await runSql(`SELECT app.atualiza_iip_contrato();`);
}

async function lerIip(idContrato: number): Promise<{ nr_fatos: number | null; iip_provisorio: number | null }> {
  const [row] = await runSql<{ nr_fatos: number | null; iip_provisorio: number | null }>(`
    SELECT nr_fatos, iip_provisorio FROM vw_iip_contrato WHERE id_contrato = ${idContrato};
  `);
  return row;
}

// dt_ultimo_fato = MAX(dt_ocorrencia) só entre os fatos realizado -- não
// exposto por vw_iip_contrato, lido direto da MV. Discrimina o WHERE novo
// sem depender de ref_indicador.peso_iip estar semeado (iip_provisorio fica
// NULL em todo o ambiente de dev hoje -- nenhuma tipologia tem peso_iip
// preenchido, achado confirmado por consulta direta antes de escrever este
// teste; não é regressão desta migration, é lacuna de seed pré-existente).
async function lerUltimoFato(idContrato: number): Promise<string | null> {
  const [row] = await runSql<{ dt_ultimo_fato: string | null }>(`
    SELECT dt_ultimo_fato FROM mv_iip_contrato WHERE id_contrato = ${idContrato};
  `);
  return row?.dt_ultimo_fato ?? null;
}

let fixture: Fixture;
let idTipologia: number;
let idFatoProjetado: number;
const idsFatoCriados: number[] = [];

describe("fatos-geradores-ciclo-vida T4 -- mv_iip_contrato considera só realizados", () => {
  beforeAll(async () => {
    fixture = await makeFixture("A");
    idTipologia = (
      await runSql<{ id_tipologia: number }>(`SELECT id_tipologia FROM ref_tipologia ORDER BY id_tipologia LIMIT 1;`)
    )[0].id_tipologia;
    await atualizaIipContrato();
  }, 60000);

  afterAll(async () => {
    if (idsFatoCriados.length > 0) {
      await runSql(`DELETE FROM fat_fato_gerador WHERE id_fato_gerador IN (${idsFatoCriados.join(",")});`);
    }
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato = ${fixture.idContrato};
      DELETE FROM rel_formulario_contrato WHERE id_contrato = ${fixture.idContrato};
      DELETE FROM dim_planejamento WHERE id_contrato = ${fixture.idContrato};
    `);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${fixture.idContrato};`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${fixture.idContratante};`);
    await atualizaIipContrato();
  }, 60000);

  it("mv_iip_contrato/vw_iip_contrato não contam um fato projetado", async () => {
    const antes = await lerIip(fixture.idContrato);
    expect(antes.nr_fatos ?? 0).toBe(0);

    const [{ id_fato_gerador: id }] = await runSql<{ id_fato_gerador: number }>(`
      INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, nivel_d1, situacao, dt_prevista)
      VALUES (${fixture.idContrato}, ${idTipologia}, 'alto', 'projetado', '2026-11-01')
      RETURNING id_fato_gerador;
    `);
    idFatoProjetado = id;
    idsFatoCriados.push(id);

    await atualizaIipContrato();
    const depois = await lerIip(fixture.idContrato);
    expect(depois.nr_fatos ?? 0).toBe(0);
    expect(await lerUltimoFato(fixture.idContrato)).toBeNull();
  });

  it("realizar o fato projetado passa a contar no IIP após o refresh", async () => {
    await runSql(`
      UPDATE fat_fato_gerador SET situacao = 'realizado', dt_ocorrencia = '2026-09-16'
       WHERE id_fato_gerador = ${idFatoProjetado};
    `);

    await atualizaIipContrato();
    const depois = await lerIip(fixture.idContrato);
    expect(depois.nr_fatos).toBe(1);
    expect(await lerUltimoFato(fixture.idContrato)).toContain("2026-09-16");
  });
});
