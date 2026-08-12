import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/visao-gerencial-g1-g2/tasks.md T1 Done-when --
//  - ref_peso_etapa criada com id_etapa BIGINT PRIMARY KEY REFERENCES
//    ref_etapa(id_etapa) e peso NUMERIC(5,2) NOT NULL DEFAULT 1
//  - CHECK (peso > 0) presente
// Migração: 20260812174131_visao_gerencial_peso_etapa_estrutura.sql.
//
// Fixture própria de ref_etapa (mesmo padrão de
// supabase/tests/catalogos/catalogos-referencia.integration.test.ts) --
// T3 (seed) ainda não rodou linha nenhuma em ref_peso_etapa neste ponto do
// batch, então os testes de FK/CHECK criam sua própria etapa "pai".

async function expectSqlError(sql: string, errcode: string): Promise<void> {
  try {
    await runSql(sql);
    throw new Error("expected query to fail but it succeeded");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain(errcode);
  }
}

let idEtapaFixture: number;

beforeAll(async () => {
  const [{ id_etapa }] = await runSql<{ id_etapa: number }>(`
    INSERT INTO ref_etapa (id_produto, codigo, nome, ordem)
    SELECT id_produto, 'fixture_gg_t1_peso_etapa', 'Fixture GG-T1 -- peso etapa', 32100
      FROM ref_produto WHERE nome = 'Estratégia'
    RETURNING id_etapa;
  `);
  idEtapaFixture = id_etapa;
});

afterAll(async () => {
  // fat_etapa_contrato pode ganhar uma linha apontando pra esta etapa fixture
  // se, na janela entre beforeAll e afterAll, outra sessão/teste instanciar um
  // contrato de "Estratégia" (o trigger de instanciação varre TODO ref_etapa
  // do produto, sem filtrar por faixa de ordem) -- limpar antes do DELETE em
  // ref_etapa evita a violação de FK (fat_etapa_contrato_id_etapa_fkey).
  await runSql(`
    DELETE FROM ref_peso_etapa WHERE id_etapa = ${idEtapaFixture};
    DELETE FROM fat_etapa_contrato WHERE id_etapa = ${idEtapaFixture};
    DELETE FROM ref_etapa WHERE id_etapa = ${idEtapaFixture};
  `);
});

describe("visao-gerencial-g1-g2 T1 -- estrutura de ref_peso_etapa (GG-02)", () => {
  it("cria id_etapa (bigint, not null) e peso (numeric(5,2), not null, default 1)", async () => {
    const rows = await runSql<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      numeric_precision: number | null;
      numeric_scale: number | null;
      column_default: string | null;
    }>(`
      SELECT column_name, data_type, is_nullable, numeric_precision, numeric_scale, column_default
        FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'ref_peso_etapa'
       ORDER BY column_name;
    `);
    expect(rows.map((r) => r.column_name)).toEqual(["id_etapa", "peso"]);

    const idEtapaCol = rows.find((r) => r.column_name === "id_etapa")!;
    expect(idEtapaCol.data_type).toBe("bigint");
    expect(idEtapaCol.is_nullable).toBe("NO");

    const pesoCol = rows.find((r) => r.column_name === "peso")!;
    expect(pesoCol.data_type).toBe("numeric");
    expect(pesoCol.numeric_precision).toBe(5);
    expect(pesoCol.numeric_scale).toBe(2);
    expect(pesoCol.is_nullable).toBe("NO");
    expect(pesoCol.column_default).toContain("1");
  });

  it("id_etapa é PRIMARY KEY", async () => {
    const rows = await runSql<{ contype: string }>(`
      SELECT contype FROM pg_constraint
       WHERE conrelid = 'public.ref_peso_etapa'::regclass AND contype = 'p';
    `);
    expect(rows).toHaveLength(1);
  });

  it("id_etapa REFERENCES ref_etapa(id_etapa) -- rejeita FK inexistente (23503)", async () => {
    await expectSqlError(`INSERT INTO ref_peso_etapa (id_etapa, peso) VALUES (999999999, 1);`, "23503");
  });

  it("peso adota o default 1 quando omitido no INSERT", async () => {
    const rows = await runSql<{ peso: string }>(`
      INSERT INTO ref_peso_etapa (id_etapa) VALUES (${idEtapaFixture}) RETURNING peso;
    `);
    expect(rows[0].peso).toBe("1.00");
    await runSql(`DELETE FROM ref_peso_etapa WHERE id_etapa = ${idEtapaFixture};`);
  });

  it("ck_peso_etapa_positivo rejeita peso negativo (23514)", async () => {
    await expectSqlError(`INSERT INTO ref_peso_etapa (id_etapa, peso) VALUES (${idEtapaFixture}, -1);`, "23514");
  });

  it("ck_peso_etapa_positivo rejeita peso = 0 (23514)", async () => {
    await expectSqlError(`INSERT INTO ref_peso_etapa (id_etapa, peso) VALUES (${idEtapaFixture}, 0);`, "23514");
  });
});
