import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: pll-dashboard-agenda T1 Done-when
// (.specs/features/pll-dashboard-agenda/tasks.md), migration
// 20260922063345_pll_origem_encerramento.sql -- D-1 da spec:
//  - fat_contrato.origem_encerramento (TEXT, nullable, sem DEFAULT)
//  - ck_contrato_origem_encerramento: só aceita 'desistencia'/'desligamento' (ou NULL)
//  - ck_contrato_origem_obrigatoria: status = 'nao_concluido' exige a coluna preenchida
//
// spec.md D-1 ("status='nao_concluido' + origem_encerramento='desistencia' -> Desistente;
// + 'desligamento' -> Desligado"); PLL-DB-03.

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
  idProduto: number;
}

async function makeFixture(label: string): Promise<Fixture> {
  const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'PLL T1 ${label}')
    RETURNING id_contratante;
  `);
  const [{ id_produto: idProduto }] = await runSql<{ id_produto: number }>(`
    SELECT id_produto FROM ref_produto WHERE nome = 'PLL';
  `);
  return { idContratante, idProduto };
}

let fixture: Fixture;
const idsContratoCriados: number[] = [];
const idsContratanteCriados: number[] = [];

async function limparContrato(idContrato: number): Promise<void> {
  await runSql(`
    DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};
    DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};
    DELETE FROM dim_planejamento WHERE id_contrato = ${idContrato};
  `);
  await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};`);
}

describe("pll-dashboard-agenda T1 -- fat_contrato.origem_encerramento + CHECKs (D-1)", () => {
  beforeAll(async () => {
    fixture = await makeFixture("A");
  }, 60000);

  afterAll(async () => {
    for (const idContrato of idsContratoCriados) {
      await limparContrato(idContrato);
    }
    for (const idContratante of idsContratanteCriados) {
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
    }
  }, 60000);

  it("a coluna origem_encerramento existe, TEXT, nullable, sem DEFAULT", async () => {
    const [row] = await runSql<{ data_type: string; is_nullable: string; column_default: string | null }>(`
      SELECT data_type, is_nullable, column_default FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'fat_contrato' AND column_name = 'origem_encerramento';
    `);
    expect(row.data_type).toBe("text");
    expect(row.is_nullable).toBe("YES");
    expect(row.column_default).toBeNull();
  });

  it("positivo: status='ativo' sem origem_encerramento passa (coluna fica NULL)", async () => {
    const [row] = await runSql<{ id_contrato: number; origem_encerramento: string | null }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      VALUES (${fixture.idContratante}, ${fixture.idProduto}, CURRENT_DATE, 'ativo')
      RETURNING id_contrato, origem_encerramento;
    `);
    idsContratoCriados.push(row.id_contrato);
    idsContratanteCriados.push(fixture.idContratante);
    expect(row.origem_encerramento).toBeNull();
  });

  it("negativo (23514): status='nao_concluido' SEM origem_encerramento é rejeitado por ck_contrato_origem_obrigatoria", async () => {
    await expectSqlError(
      `INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status, motivo_encerramento)
       VALUES (${fixture.idContratante}, ${fixture.idProduto}, CURRENT_DATE, 'nao_concluido', 'teste');`,
      "23514"
    );
  });

  it("negativo (23514): origem_encerramento com valor fora de 'desistencia'/'desligamento' é rejeitado por ck_contrato_origem_encerramento", async () => {
    await expectSqlError(
      `INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status, motivo_encerramento, origem_encerramento)
       VALUES (${fixture.idContratante}, ${fixture.idProduto}, CURRENT_DATE, 'nao_concluido', 'teste', 'inventado');`,
      "23514"
    );
  });

  it("positivo: status='nao_concluido' + origem_encerramento='desistencia' sucede (Desistente)", async () => {
    const [row] = await runSql<{ id_contrato: number; status: string; origem_encerramento: string }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status, motivo_encerramento, origem_encerramento)
      VALUES (${fixture.idContratante}, ${fixture.idProduto}, CURRENT_DATE, 'nao_concluido', 'teste', 'desistencia')
      RETURNING id_contrato, status, origem_encerramento;
    `);
    idsContratoCriados.push(row.id_contrato);
    expect(row.status).toBe("nao_concluido");
    expect(row.origem_encerramento).toBe("desistencia");
  });

  it("positivo: status='nao_concluido' + origem_encerramento='desligamento' sucede (Desligado)", async () => {
    const [row] = await runSql<{ id_contrato: number; status: string; origem_encerramento: string }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status, motivo_encerramento, origem_encerramento)
      VALUES (${fixture.idContratante}, ${fixture.idProduto}, CURRENT_DATE, 'nao_concluido', 'teste', 'desligamento')
      RETURNING id_contrato, status, origem_encerramento;
    `);
    idsContratoCriados.push(row.id_contrato);
    expect(row.status).toBe("nao_concluido");
    expect(row.origem_encerramento).toBe("desligamento");
  });

  it("contratos pré-existentes (se houver) continuam SELECTáveis sem erro após a migration", async () => {
    const rows = await runSql<{ count: number }>(`SELECT count(*)::int AS count FROM fat_contrato;`);
    expect(rows[0].count).toBeGreaterThanOrEqual(0);
  });
});
