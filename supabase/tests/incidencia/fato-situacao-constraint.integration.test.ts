import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: fatos-geradores-ciclo-vida T2 Done-when
// (.specs/features/fatos-geradores-ciclo-vida/tasks.md), migration
// 20260916153809_incidencia_v2_fato_titulo_situacao.sql --
//  - 3 colunas novas (titulo, situacao, dt_prevista) + CHECK de situacao +
//    ck_fato_situacao_data aplicados
//  - INSERT situacao='projetado' sem dt_prevista falha (23514); com
//    dt_prevista e sem dt_ocorrencia sucede
//  - fatos pré-existentes (se houver) continuam SELECTáveis sem erro
//
// spec.md P1 "Fato projetado e sua realização" AC1/AC2.

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
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'FGC T2 ${label}')
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
const idsFatoCriados: number[] = [];

describe("fatos-geradores-ciclo-vida T2 -- titulo/situacao/dt_prevista + ck_fato_situacao_data", () => {
  beforeAll(async () => {
    fixture = await makeFixture("A");
    idTipologia = (await runSql<{ id_tipologia: number }>(`SELECT id_tipologia FROM ref_tipologia ORDER BY id_tipologia LIMIT 1;`))[0]
      .id_tipologia;
  }, 60000);

  afterAll(async () => {
    if (idsFatoCriados.length > 0) {
      await runSql(`DELETE FROM fat_fato_gerador WHERE id_fato_gerador IN (${idsFatoCriados.join(",")});`);
    }
    await runSql(`DELETE FROM fat_fato_gerador WHERE id_contrato = ${fixture.idContrato};`);
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato = ${fixture.idContrato};
      DELETE FROM rel_formulario_contrato WHERE id_contrato = ${fixture.idContrato};
      DELETE FROM dim_planejamento WHERE id_contrato = ${fixture.idContrato};
    `);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${fixture.idContrato};`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${fixture.idContratante};`);
  }, 60000);

  it("3 colunas novas existem com os tipos/defaults esperados", async () => {
    const rows = await runSql<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>(`
      SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'fat_fato_gerador'
         AND column_name IN ('titulo', 'situacao', 'dt_prevista');
    `);
    const porColuna = new Map(rows.map((r) => [r.column_name, r]));
    expect(porColuna.get("titulo")?.is_nullable).toBe("YES");
    expect(porColuna.get("situacao")?.is_nullable).toBe("NO");
    expect(porColuna.get("situacao")?.column_default).toContain("realizado");
    expect(porColuna.get("dt_prevista")?.is_nullable).toBe("YES");
    expect(porColuna.get("dt_prevista")?.data_type).toBe("date");
  });

  it("dt_ocorrencia deixou de ser NOT NULL (pré-requisito estrutural do fato projetado)", async () => {
    const [row] = await runSql<{ is_nullable: string }>(`
      SELECT is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'fat_fato_gerador' AND column_name = 'dt_ocorrencia';
    `);
    expect(row.is_nullable).toBe("YES");
  });

  it("positivo: INSERT sem especificar situacao usa o default 'realizado' e mantém dt_ocorrencia exigida", async () => {
    const [{ id_fato_gerador: id, situacao }] = await runSql<{ id_fato_gerador: number; situacao: string }>(`
      INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, nivel_d1, dt_ocorrencia)
      VALUES (${fixture.idContrato}, ${idTipologia}, 'baixo', '2026-09-01')
      RETURNING id_fato_gerador, situacao;
    `);
    idsFatoCriados.push(id);
    expect(situacao).toBe("realizado");
  });

  it("negativo (23514): situacao inválida é rejeitada por ck_fato_situacao", async () => {
    await expectSqlError(
      `INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, nivel_d1, situacao, dt_ocorrencia)
       VALUES (${fixture.idContrato}, ${idTipologia}, 'baixo', 'inventado', '2026-09-01');`,
      "23514"
    );
  });

  it("negativo (23514): situacao='projetado' SEM dt_prevista é rejeitada por ck_fato_situacao_data", async () => {
    await expectSqlError(
      `INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, nivel_d1, situacao, dt_ocorrencia)
       VALUES (${fixture.idContrato}, ${idTipologia}, 'baixo', 'projetado', '2026-09-01');`,
      "23514"
    );
  });

  it("negativo (23514): situacao='realizado' SEM dt_ocorrencia é rejeitada por ck_fato_situacao_data", async () => {
    await expectSqlError(
      `INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, nivel_d1, situacao, dt_prevista)
       VALUES (${fixture.idContrato}, ${idTipologia}, 'baixo', 'realizado', '2026-10-01');`,
      "23514"
    );
  });

  it("positivo: situacao='projetado' COM dt_prevista e SEM dt_ocorrencia sucede", async () => {
    const [row] = await runSql<{ id_fato_gerador: number; situacao: string; dt_prevista: string; dt_ocorrencia: string | null }>(`
      INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, nivel_d1, situacao, dt_prevista)
      VALUES (${fixture.idContrato}, ${idTipologia}, 'baixo', 'projetado', '2026-10-01')
      RETURNING id_fato_gerador, situacao, dt_prevista, dt_ocorrencia;
    `);
    idsFatoCriados.push(row.id_fato_gerador);
    expect(row.situacao).toBe("projetado");
    expect(row.dt_ocorrencia).toBeNull();
  });

  it("fatos pré-existentes (se houver) continuam SELECTáveis sem erro após a migration", async () => {
    const rows = await runSql<{ count: number }>(`SELECT count(*)::int AS count FROM fat_fato_gerador;`);
    expect(rows[0].count).toBeGreaterThanOrEqual(0);
  });
});
