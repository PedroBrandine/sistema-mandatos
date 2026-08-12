import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: RGI-01 a RGI-06 (.specs/features/operacao-regua-instanciacao/spec.md) --
//  - trigger AFTER INSERT ON fat_contrato dispara app.instancia_contrato(NEW.id_contrato)
//    sem chamada explícita do frontend (RGI-01);
//  - 1 linha em fat_etapa_contrato por ref_etapa do produto, nao_iniciada, com datas
//    previstas acumuladas em sequência a partir de fat_contrato.dt_inicio (RGI-02);
//  - exatamente 1 linha em dim_planejamento, demais colunas NULL (RGI-03);
//  - 1 linha em rel_formulario_contrato por ref_formulario ativo do produto (RGI-04);
//  - idempotência via ON CONFLICT DO NOTHING, tanto reinvocando a função direto (RGI-05)
//    quanto simulando o backfill de novo (RGI-06 AC2 -- o backfill É a mesma função em loop).
//
// Produto usado: Estratégia -- 7 etapas seedadas (20260810193327_catalogos_referencia_seed.sql):
// cadastro(7d) > pontape(14d) > raio_x(21d) > imersao(14d) > governanca(45d) > monitoramento(120d)
// > replicacao(14d), soma 235 dias; 8 ref_formulario ativos vinculados a essas etapas.

let idContratante: number;
let idContrato: number;

describe("operacao-regua-instanciacao -- trigger + backfill (RGI-01 a 06)", () => {
  beforeAll(async () => {
    const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'RGI Instanciacao Fixture')
      RETURNING id_contratante;
    `);
    idContratante = id_contratante;

    const [{ id_contrato }] = await runSql<{ id_contrato: number }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), '2026-01-01', 'ativo')
      RETURNING id_contrato;
    `);
    idContrato = id_contrato;
  }, 60000);

  afterAll(async () => {
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};
      DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};
      DELETE FROM dim_planejamento WHERE id_contrato = ${idContrato};
    `);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
  }, 60000);

  it("RGI-01: o INSERT em fat_contrato já dispara a instanciação, sem chamada manual", async () => {
    const rows = await runSql<{ n: string }>(`SELECT count(*)::text AS n FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};`);
    expect(Number(rows[0].n)).toBe(7);
  });

  it("RGI-02: 1 linha por ref_etapa, todas nao_iniciada, datas previstas acumuladas em sequência", async () => {
    const rows = await runSql<{
      codigo_etapa: string;
      ordem: number;
      status: string;
      dt_prevista_inicio: string;
      dt_prevista_conclusao: string;
    }>(`
      SELECT e.codigo AS codigo_etapa, e.ordem, ec.status, ec.dt_prevista_inicio, ec.dt_prevista_conclusao
        FROM fat_etapa_contrato ec JOIN ref_etapa e ON e.id_etapa = ec.id_etapa
       WHERE ec.id_contrato = ${idContrato}
       ORDER BY e.ordem;
    `);

    expect(rows).toHaveLength(7);
    expect(rows.every((r) => r.status === "nao_iniciada")).toBe(true);

    // 1ª etapa: dt_prevista_inicio = fat_contrato.dt_inicio, literal.
    expect(rows[0].codigo_etapa).toBe("cadastro");
    expect(rows[0].dt_prevista_inicio).toBe("2026-01-01");
    expect(rows[0].dt_prevista_conclusao).toBe("2026-01-08"); // +7 dias

    // Última etapa (replicacao): acumulado de 7+14+21+14+45+120 = 221 dias de início,
    // +14 de duração própria = 235 dias de conclusão prevista.
    const ultima = rows[rows.length - 1];
    expect(ultima.codigo_etapa).toBe("replicacao");
    expect(ultima.dt_prevista_inicio).toBe("2026-08-10"); // 2026-01-01 + 221 dias
    expect(ultima.dt_prevista_conclusao).toBe("2026-08-24"); // + 14 dias
  });

  it("RGI-03: exatamente 1 linha em dim_planejamento, demais colunas NULL", async () => {
    const rows = await runSql<{
      n: string;
      id_perfil_atuacao: number | null;
      objetivo_ano: string | null;
      pct_atingimento: number | null;
    }>(`
      SELECT count(*)::text AS n,
             (array_agg(id_perfil_atuacao))[1] AS id_perfil_atuacao,
             (array_agg(objetivo_ano))[1] AS objetivo_ano,
             (array_agg(pct_atingimento))[1] AS pct_atingimento
        FROM dim_planejamento WHERE id_contrato = ${idContrato};
    `);
    expect(Number(rows[0].n)).toBe(1);
    expect(rows[0].id_perfil_atuacao).toBeNull();
    expect(rows[0].objetivo_ano).toBeNull();
    expect(rows[0].pct_atingimento).toBeNull();
  });

  it("RGI-04: 1 linha em rel_formulario_contrato por ref_formulario ativo do produto, estado fechado", async () => {
    const rows = await runSql<{ n: string; distintos: string }>(`
      SELECT count(*)::text AS n, count(DISTINCT estado)::text AS distintos
        FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};
    `);
    expect(Number(rows[0].n)).toBe(8); // 8 ref_formulario de Estratégia, todos ativo=true no seed
    expect(Number(rows[0].distintos)).toBe(1); // só 'fechado'

    const estados = await runSql<{ estado: string }>(`
      SELECT DISTINCT estado FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};
    `);
    expect(estados[0].estado).toBe("fechado");
  });

  it("RGI-05: reinvocar app.instancia_contrato direto não duplica nenhuma linha", async () => {
    await runSql(`SELECT app.instancia_contrato(${idContrato});`);
    const rows = await runSql<{ etapas: string; planejamentos: string; formularios: string }>(`
      SELECT
        (SELECT count(*)::text FROM fat_etapa_contrato WHERE id_contrato = ${idContrato}) AS etapas,
        (SELECT count(*)::text FROM dim_planejamento WHERE id_contrato = ${idContrato}) AS planejamentos,
        (SELECT count(*)::text FROM rel_formulario_contrato WHERE id_contrato = ${idContrato}) AS formularios;
    `);
    expect(Number(rows[0].etapas)).toBe(7);
    expect(Number(rows[0].planejamentos)).toBe(1);
    expect(Number(rows[0].formularios)).toBe(8);
  });

  it("RGI-06 AC2: reexecutar o backfill (a mesma função, em loop, para todo fat_contrato) não duplica", async () => {
    // O backfill da migration é literalmente este loop -- reexecutá-lo aqui contra a
    // base real de dev (que inclui o contrato desta fixture) é a mesma operação.
    await runSql(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN SELECT id_contrato FROM fat_contrato LOOP
          PERFORM app.instancia_contrato(r.id_contrato);
        END LOOP;
      END $$;
    `);
    const rows = await runSql<{ etapas: string; planejamentos: string }>(`
      SELECT
        (SELECT count(*)::text FROM fat_etapa_contrato WHERE id_contrato = ${idContrato}) AS etapas,
        (SELECT count(*)::text FROM dim_planejamento WHERE id_contrato = ${idContrato}) AS planejamentos;
    `);
    expect(Number(rows[0].etapas)).toBe(7);
    expect(Number(rows[0].planejamentos)).toBe(1);
  });

  it("vw_etapa_contrato deriva dias_atraso/esta_atrasada sem coluna armazenada (C2)", async () => {
    const rows = await runSql<{ esta_atrasada: boolean; dias_atraso: number }>(`
      SELECT esta_atrasada, dias_atraso FROM vw_etapa_contrato
       WHERE id_contrato = ${idContrato} AND codigo_etapa = 'cadastro';
    `);
    // dt_prevista_conclusao = 2026-01-08, já passada frente a CURRENT_DATE real -> atrasada,
    // sem nenhuma etapa concluída ainda (todas nao_iniciada).
    expect(rows[0].esta_atrasada).toBe(true);
    expect(rows[0].dias_atraso).toBeGreaterThan(0);
  });
});
