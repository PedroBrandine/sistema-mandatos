import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: ficha-mandato-contrato T11 Done-when
// (.specs/features/ficha-mandato-contrato/tasks.md), migration
// 20260916152603_ficha_gip_reseed_dimensoes.sql -- spec.md Anexo A e AC1 de
// "P1 GIP conforme a metodologia vigente":
//  - as 4 dimensões ativas, nesta ordem, com nome e faixa do Anexo A.
//  - `codigo` não muda (referenciado por app.trg_deriva_gip e testes
//    existentes).
//  - trg_gip_dimensao_faixa (já provisionado em
//    20260814210832_formularios_produto_gip_valida_dimensao.sql) segue
//    validando a faixa NOVA: valor 0 aceito, valor fora da faixa (3 numa
//    dimensão 0-2) rejeitado.
//
// A guarda de falha alta (RAISE EXCEPTION se fat_gip_dimensao tiver linha) é
// achado estrutural, não comportamental sob teste automatizado: exigiria
// gravar uma linha em fat_gip_dimensao e então tentar reaplicar a MESMA
// migration, o que a suíte de integração não faz (migrations não são
// reexecutáveis por teste, só por `db push`). A guarda foi verificada
// manualmente antes de escrever esta migration (consulta direta via
// `supabase db query --linked`, registrada no commit): fat_gip_dimensao
// tinha 0 linhas em dev.

async function expectSqlError(sql: string, marker: string): Promise<void> {
  try {
    await runSql(sql);
    throw new Error(`expected query to fail with ${marker} but it succeeded`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain(marker);
  }
}

let idContratante: number;
let idContrato: number;
let idGip: number;
let idDimensaoPerformance: number; // qualidade_planejamento, 0-3
let idDimensaoGestao: number; // capacidade_gestao, 0-2

beforeAll(async () => {
  const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'FMC T11')
    RETURNING id_contratante;
  `);
  idContratante = id_contratante;

  const [{ id_contrato }] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
    VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
    RETURNING id_contrato;
  `);
  idContrato = id_contrato;

  const [{ id_gip }] = await runSql<{ id_gip: number }>(`
    INSERT INTO fat_gip (id_contrato, momento, aplicado_em) VALUES (${idContrato}, 'inicio', CURRENT_DATE)
    RETURNING id_gip;
  `);
  idGip = id_gip;

  idDimensaoPerformance = (
    await runSql<{ id_dimensao: number }>(`SELECT id_dimensao FROM ref_dimensao_gip WHERE codigo = 'qualidade_planejamento';`)
  )[0].id_dimensao;
  idDimensaoGestao = (
    await runSql<{ id_dimensao: number }>(`SELECT id_dimensao FROM ref_dimensao_gip WHERE codigo = 'capacidade_gestao';`)
  )[0].id_dimensao;
}, 60000);

afterAll(async () => {
  await runSql(`DELETE FROM fat_gip_dimensao WHERE id_gip = ${idGip};`);
  await runSql(`DELETE FROM fat_gip WHERE id_gip = ${idGip};`);
  await runSql(`
    DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};
    DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};
    DELETE FROM dim_planejamento WHERE id_contrato = ${idContrato};
  `);
  await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};`);
  await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
}, 60000);

describe("ficha-mandato-contrato T11 -- re-seed de ref_dimensao_gip (faixa 0-3/0-2)", () => {
  it("as 4 dimensões têm nome, faixa e ordem do Anexo A; codigo permanece inalterado", async () => {
    const rows = await runSql<{ codigo: string; nome: string; valor_min: number; valor_max: number; ordem: number; ativo: boolean }>(`
      SELECT codigo, nome, valor_min, valor_max, ordem, ativo FROM ref_dimensao_gip ORDER BY ordem;
    `);
    expect(rows).toHaveLength(4);
    expect(rows).toEqual([
      {
        codigo: "qualidade_planejamento",
        nome: "Performance dos objetivos específicos atrelados aos preditores prioritários",
        valor_min: 0,
        valor_max: 3,
        ordem: 1,
        ativo: true,
      },
      {
        codigo: "atingimento_planejamento",
        nome: "Monitoramento e atingimento do planejamento",
        valor_min: 0,
        valor_max: 3,
        ordem: 2,
        ativo: true,
      },
      {
        codigo: "capacidade_gestao",
        nome: "Capacidade de gestão",
        valor_min: 0,
        valor_max: 2,
        ordem: 3,
        ativo: true,
      },
      {
        codigo: "autonomia_metodologia",
        nome: "Capacidade de absorção de incidência política",
        valor_min: 0,
        valor_max: 2,
        ordem: 4,
        ativo: true,
      },
    ]);
  });

  it("trg_gip_dimensao_faixa: aceita valor 0 na dimensão 1 (faixa 0-3)", async () => {
    const [{ valor }] = await runSql<{ valor: number }>(`
      INSERT INTO fat_gip_dimensao (id_gip, id_dimensao, eixo, valor)
      VALUES (${idGip}, ${idDimensaoPerformance}, 'regua_sonhos', 0)
      RETURNING valor;
    `);
    expect(valor).toBe(0);
  });

  it("trg_gip_dimensao_faixa: aceita valor 3 (topo da faixa) na dimensão 1 (faixa 0-3)", async () => {
    const [{ valor }] = await runSql<{ valor: number }>(`
      INSERT INTO fat_gip_dimensao (id_gip, id_dimensao, eixo, valor)
      VALUES (${idGip}, ${idDimensaoPerformance}, 'onde_chegamos', 3)
      RETURNING valor;
    `);
    expect(valor).toBe(3);
  });

  it("trg_gip_dimensao_faixa: rejeita valor 3 na dimensão 'Capacidade de gestão' (faixa 0-2)", async () => {
    await expectSqlError(
      `INSERT INTO fat_gip_dimensao (id_gip, id_dimensao, eixo, valor)
       VALUES (${idGip}, ${idDimensaoGestao}, 'regua_sonhos', 3);`,
      "fora da faixa"
    );
  });
});
