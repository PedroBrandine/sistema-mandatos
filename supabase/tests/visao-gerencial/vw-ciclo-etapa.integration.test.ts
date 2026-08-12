import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/visao-gerencial-g1-g2/spec.md, P1 "G2 -- tempo
// de ciclo" AC1 + tasks.md T6 Done-when (GG-03) -- migração:
// 20260812180419_visao_gerencial_vw_ciclo_etapa.sql.
//
//  - View criada, security_invoker = true
//  - WHERE vec.status = 'concluida'
//  - dias_ciclo calculado corretamente (dt_conclusao - dt_inicio)
//  - fixture com 2 contratos concluindo a mesma etapa em datas diferentes
//    confirma os 2 dias_ciclo esperados
//  - fixture com etapa nao_iniciada/em_andamento confirma que NÃO aparece
//
// Produto usado: Estratégia, etapa "pontape" (ordem 1) -- mesmo produto de
// operacao-regua-instanciacao.integration.test.ts/kanban. A instanciação
// automática (trigger AFTER INSERT em fat_contrato) já cria 1 linha
// nao_iniciada em fat_etapa_contrato por ref_etapa do produto; os testes
// aqui só fazem UPDATE direto pra simular estados de conclusão, sem passar
// pelo RPC do Kanban (fora de escopo desta view).

let idUsuario: number;
let idContratante: number;
let idEtapaPontape: number;
const idsContrato: Record<string, number> = {};

beforeAll(async () => {
  const [{ id_usuario, id_contratante }] = await runSql<{ id_usuario: number; id_contratante: number }>(`
    WITH u AS (
      INSERT INTO dim_usuario (email, nome, papel_global, ativo)
      VALUES ('gg-t6-vw-ciclo-etapa@legislabrasil.test', 'GG T6 Gestora Fixture', 'gestora', true)
      ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome
      RETURNING id_usuario
    ), ct AS (
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'GG T6 Contratante Fixture')
      RETURNING id_contratante
    )
    SELECT u.id_usuario, ct.id_contratante FROM u, ct;
  `);
  idUsuario = id_usuario;
  idContratante = id_contratante;

  idEtapaPontape = (
    await runSql<{ id_etapa: number }>(`
    SELECT id_etapa FROM ref_etapa
     WHERE id_produto = (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia') AND codigo = 'pontape';
  `)
  )[0].id_etapa;

  // localizador_legado carrega o rótulo da fixture pra mapear id_contrato de
  // volta sem depender de ordem de scan (mesmo padrão de T5).
  const contratos = await runSql<{ id_contrato: number; localizador_legado: string }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status, localizador_legado)
    SELECT ${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo', v.label
      FROM (VALUES ('curto'), ('longo'), ('nao_iniciada'), ('em_andamento')) AS v(label)
    RETURNING id_contrato, localizador_legado;
  `);
  for (const row of contratos) {
    idsContrato[row.localizador_legado] = row.id_contrato;
  }

  await runSql(`
    INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
    SELECT id_contrato, ${idUsuario}, 'gestora' FROM unnest(ARRAY[${Object.values(idsContrato).join(",")}]) AS id_contrato;

    -- "curto": pontape concluída em 7 dias (2026-01-01 -> 2026-01-08).
    UPDATE fat_etapa_contrato SET status = 'concluida', dt_inicio = '2026-01-01', dt_conclusao = '2026-01-08'
     WHERE id_contrato = ${idsContrato.curto} AND id_etapa = ${idEtapaPontape};

    -- "longo": pontape concluída em 14 dias (2026-01-01 -> 2026-01-15).
    UPDATE fat_etapa_contrato SET status = 'concluida', dt_inicio = '2026-01-01', dt_conclusao = '2026-01-15'
     WHERE id_contrato = ${idsContrato.longo} AND id_etapa = ${idEtapaPontape};

    -- "nao_iniciada": fica no estado default do trigger (nao_iniciada), sem tocar.

    -- "em_andamento": iniciada mas não concluída.
    UPDATE fat_etapa_contrato SET status = 'em_andamento', dt_inicio = '2026-01-01'
     WHERE id_contrato = ${idsContrato.em_andamento} AND id_etapa = ${idEtapaPontape};
  `);
}, 120000);

afterAll(async () => {
  const todosContratos = Object.values(idsContrato).join(",");
  await runSql(`DELETE FROM rel_usuario_contrato WHERE id_contrato = ANY(ARRAY[${todosContratos}]);`);
  await runSql(`
    DELETE FROM fat_etapa_contrato WHERE id_contrato = ANY(ARRAY[${todosContratos}]);
    DELETE FROM rel_formulario_contrato WHERE id_contrato = ANY(ARRAY[${todosContratos}]);
    DELETE FROM dim_planejamento WHERE id_contrato = ANY(ARRAY[${todosContratos}]);
  `);
  await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ANY(ARRAY[${todosContratos}]);`);
  await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
  await runSql(`DELETE FROM dim_usuario WHERE id_usuario = ${idUsuario};`);
}, 120000);

describe("visao-gerencial-g1-g2 T6 -- vw_ciclo_etapa (GG-03)", () => {
  it("security_invoker = true", async () => {
    const rows = await runSql<{ reloptions: string[] }>(`
      SELECT reloptions FROM pg_class WHERE relname = 'vw_ciclo_etapa';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].reloptions).toContain("security_invoker=true");
  });

  it("dias_ciclo = dt_conclusao - dt_inicio, correto por linha para 2 contratos concluindo a mesma etapa em datas diferentes", async () => {
    const rows = await runSql<{ id_contrato: number; dias_ciclo: number }>(`
      SELECT id_contrato, dias_ciclo FROM vw_ciclo_etapa
       WHERE id_contrato IN (${idsContrato.curto}, ${idsContrato.longo}) AND id_etapa = ${idEtapaPontape};
    `);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id_contrato === idsContrato.curto)?.dias_ciclo).toBe(7);
    expect(rows.find((r) => r.id_contrato === idsContrato.longo)?.dias_ciclo).toBe(14);
  });

  it("WHERE status = 'concluida': etapa nao_iniciada NÃO aparece na view", async () => {
    const rows = await runSql<{ id_contrato: number }>(`
      SELECT id_contrato FROM vw_ciclo_etapa WHERE id_contrato = ${idsContrato.nao_iniciada} AND id_etapa = ${idEtapaPontape};
    `);
    expect(rows).toHaveLength(0);
  });

  it("WHERE status = 'concluida': etapa em_andamento NÃO aparece na view", async () => {
    const rows = await runSql<{ id_contrato: number }>(`
      SELECT id_contrato FROM vw_ciclo_etapa WHERE id_contrato = ${idsContrato.em_andamento} AND id_etapa = ${idEtapaPontape};
    `);
    expect(rows).toHaveLength(0);
  });
});
