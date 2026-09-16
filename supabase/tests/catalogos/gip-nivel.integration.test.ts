import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: ficha-mandato-contrato T5 Done-when
// (.specs/features/ficha-mandato-contrato/tasks.md), migration
// 20260916115951_ficha_gip_nivel_estrutura.sql -- design.md "Data Models" >
// ref_nivel_dimensao_gip (A-11):
//  - insercao aceita.
//  - par (id_dimensao, valor) duplicado rejeitado (23505).
//  - descricao NULL rejeitada (23502).
//
// spec.md P1 "GIP conforme a metodologia vigente" AC2 (FMC-24).

async function expectSqlError(sql: string, marker: string): Promise<void> {
  try {
    await runSql(sql);
    throw new Error(`expected query to fail with ${marker} but it succeeded`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain(marker);
  }
}

let idDimensao: number;

describe("ficha-mandato-contrato T5 -- ref_nivel_dimensao_gip", () => {
  beforeAll(async () => {
    idDimensao = (
      await runSql<{ id_dimensao: number }>(`SELECT id_dimensao FROM ref_dimensao_gip ORDER BY id_dimensao LIMIT 1;`)
    )[0].id_dimensao;
  }, 60000);

  afterAll(async () => {
    await runSql(`DELETE FROM ref_nivel_dimensao_gip WHERE id_dimensao = ${idDimensao} AND valor IN (101, 102);`);
  }, 60000);

  it("aceita insercao de descritor de nivel", async () => {
    const [linha] = await runSql<{ id_dimensao: number; valor: number }>(`
      INSERT INTO ref_nivel_dimensao_gip (id_dimensao, valor, descricao)
      VALUES (${idDimensao}, 101, 'FMC T5 descritor de teste')
      RETURNING id_dimensao, valor;
    `);
    expect(linha).toEqual({ id_dimensao: idDimensao, valor: 101 });
  });

  it("pk_nivel_dimensao_gip: rejeita (23505) o mesmo par (dimensao, valor) duas vezes", async () => {
    await expectSqlError(
      `INSERT INTO ref_nivel_dimensao_gip (id_dimensao, valor, descricao)
       VALUES (${idDimensao}, 101, 'FMC T5 descritor duplicado');`,
      "23505"
    );
  });

  it("descricao NOT NULL: rejeita (23502) descricao nula", async () => {
    await expectSqlError(
      `INSERT INTO ref_nivel_dimensao_gip (id_dimensao, valor, descricao)
       VALUES (${idDimensao}, 102, NULL);`,
      "23502"
    );
  });
});

// Spec anchor: ficha-mandato-contrato T12 Done-when
// (.specs/features/ficha-mandato-contrato/tasks.md), migration
// 20260916153018_ficha_seed_gip_niveis.sql -- spec.md Anexo A e AC2 de "P1
// GIP conforme a metodologia vigente" (FMC-24): 14 linhas (4+4+3+3), uma por
// par (dimensão, valor) dentro da faixa da dimensão, descritor verbatim.
describe("ficha-mandato-contrato T12 -- seed dos 14 descritores de nível do GIP", () => {
  it("14 linhas no total, distribuídas 4+4+3+3 pelas 4 dimensões", async () => {
    const rows = await runSql<{ codigo: string; total: number }>(`
      SELECT d.codigo, count(*)::int AS total
        FROM ref_nivel_dimensao_gip n
        JOIN ref_dimensao_gip d ON d.id_dimensao = n.id_dimensao
       WHERE n.valor <= 3
       GROUP BY d.codigo;
    `);
    const porCodigo = Object.fromEntries(rows.map((r) => [r.codigo, r.total]));
    expect(porCodigo["qualidade_planejamento"]).toBe(4);
    expect(porCodigo["atingimento_planejamento"]).toBe(4);
    expect(porCodigo["capacidade_gestao"]).toBe(3);
    expect(porCodigo["autonomia_metodologia"]).toBe(3);

    const [{ total }] = await runSql<{ total: number }>(`SELECT count(*)::int AS total FROM ref_nivel_dimensao_gip WHERE valor <= 3;`);
    expect(total).toBe(14);
  });

  it("descritores verbatim do Anexo A -- um nível por dimensão, texto exato", async () => {
    const rows = await runSql<{ codigo: string; valor: number; descricao: string }>(`
      SELECT d.codigo, n.valor, n.descricao
        FROM ref_nivel_dimensao_gip n
        JOIN ref_dimensao_gip d ON d.id_dimensao = n.id_dimensao
       WHERE (d.codigo, n.valor) IN
             (('qualidade_planejamento', 0), ('atingimento_planejamento', 3),
              ('capacidade_gestao', 2), ('autonomia_metodologia', 1));
    `);
    const porChave = Object.fromEntries(rows.map((r) => [`${r.codigo}:${r.valor}`, r.descricao]));
    expect(porChave["qualidade_planejamento:0"]).toBe("Não apresenta padrões de atuação de mandatos de sucesso");
    expect(porChave["atingimento_planejamento:3"]).toBe("Monitora e cumpre mais de 65% do quadro de metas");
    expect(porChave["capacidade_gestao:2"]).toBe(
      "Implementa estratégia de gestão de pessoas (revisão de organograma, definição de escopos de trabalho e realização de devolutivas sobre o desempenho da assessoria)"
    );
    expect(porChave["autonomia_metodologia:1"]).toBe("Implementa apenas uma sugestão de incidência política");
  });

  it("ON CONFLICT (id_dimensao, valor) DO NOTHING: reaplicar o seed não duplica nem altera a contagem", async () => {
    await runSql(`
      INSERT INTO ref_nivel_dimensao_gip (id_dimensao, valor, descricao)
      SELECT id_dimensao, 0, 'reaplicação não deveria sobrescrever'
        FROM ref_dimensao_gip WHERE codigo = 'qualidade_planejamento'
      ON CONFLICT (id_dimensao, valor) DO NOTHING;
    `);
    const [{ total }] = await runSql<{ total: number }>(`SELECT count(*)::int AS total FROM ref_nivel_dimensao_gip WHERE valor <= 3;`);
    expect(total).toBe(14);
  });
});
