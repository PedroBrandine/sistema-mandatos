import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/visao-gerencial-g3-g6/spec.md GER-13 +
// tasks.md T3 Done-when -- migração:
// 20260814211239_visao_gerencial_vw_ciclo_etapa_dt_conclusao.sql.
// Arquivo separado de vw-ciclo-etapa.integration.test.ts (T3 Done-when:
// "suíte existente continua verde sem alteração") -- só cobre a coluna nova.

let idContratante: number;
let idContrato: number;

beforeAll(async () => {
  const [entidades] = await runSql<{ id_contratante: number; id_contrato: number }>(`
    WITH ct AS (
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'GG3 T3 Contratante Fixture')
      RETURNING id_contratante
    ), c AS (
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      SELECT id_contratante, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE - 10, 'ativo'
      FROM ct
      RETURNING id_contrato
    )
    SELECT ct.id_contratante, c.id_contrato FROM ct, c;
  `);
  idContratante = entidades.id_contratante;
  idContrato = entidades.id_contrato;

  const idEtapaPontape = (
    await runSql<{ id_etapa: number }>(`
      SELECT id_etapa FROM ref_etapa
       WHERE id_produto = (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia') AND codigo = 'pontape';
    `)
  )[0].id_etapa;

  await runSql(`
    UPDATE fat_etapa_contrato SET status = 'concluida', dt_inicio = CURRENT_DATE - 10, dt_conclusao = CURRENT_DATE - 3
     WHERE id_contrato = ${idContrato} AND id_etapa = ${idEtapaPontape};
  `);
}, 60000);

afterAll(async () => {
  await runSql(`
    DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};
    DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};
    DELETE FROM dim_planejamento WHERE id_contrato = ${idContrato};
    DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};
    DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};
  `);
}, 60000);

describe("visao-gerencial-g3-g6 T3 -- vw_ciclo_etapa.dt_conclusao (GER-13)", () => {
  it("dt_conclusao reflete a mesma data gravada em fat_etapa_contrato pra etapa concluída", async () => {
    // Comparação via SQL (CURRENT_DATE - 3 no próprio Postgres), não via
    // `new Date()` do lado do cliente -- evita deslocamento de fuso horário
    // ao converter uma coluna DATE pra Date do JS (achado real desta task).
    const rows = await runSql<{ dt_conclusao_bate: boolean; dias_ciclo: number }>(`
      SELECT (v.dt_conclusao = CURRENT_DATE - 3) AS dt_conclusao_bate, v.dias_ciclo
        FROM vw_ciclo_etapa v WHERE v.id_contrato = ${idContrato};
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].dias_ciclo).toBe(7);
    expect(rows[0].dt_conclusao_bate).toBe(true);
  });
});
