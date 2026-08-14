import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/visao-gerencial-g3-g6/spec.md GER-08 +
// tasks.md T6 Done-when -- migração:
// 20260814212443_visao_gerencial_vw_resposta_formulario_mensal.sql.

let idContratante: number;
let idContrato: number;
let idFormulario: number;
let mesAlvo: string;
let baselineAberturas: number;
let baselineRespondidas: number;
let baselineAberturasMesAnterior: number;

beforeAll(async () => {
  const [ctx] = await runSql<{ mes_alvo: string; id_produto: number; id_formulario: number }>(`
    WITH p AS (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia')
    SELECT (date_trunc('month', CURRENT_DATE) - INTERVAL '2 months')::date AS mes_alvo,
           p.id_produto,
           (SELECT f.id_formulario FROM ref_formulario f JOIN ref_etapa e ON e.id_etapa = f.id_etapa
             WHERE e.id_produto = p.id_produto AND f.ativo LIMIT 1) AS id_formulario
    FROM p;
  `);
  mesAlvo = ctx.mes_alvo;
  idFormulario = ctx.id_formulario;

  const [baseline] = await runSql<{ qtd_aberturas: number; qtd_respondidas: number }>(`
    SELECT qtd_aberturas, qtd_respondidas FROM vw_resposta_formulario_mensal WHERE mes_referencia = '${mesAlvo}'::date;
  `);
  baselineAberturas = Number(baseline?.qtd_aberturas ?? 0);
  baselineRespondidas = Number(baseline?.qtd_respondidas ?? 0);

  const [baselineAnterior] = await runSql<{ qtd_aberturas: number }>(`
    SELECT qtd_aberturas FROM vw_resposta_formulario_mensal WHERE mes_referencia = ('${mesAlvo}'::date - INTERVAL '1 month')::date;
  `);
  baselineAberturasMesAnterior = Number(baselineAnterior?.qtd_aberturas ?? 0);

  const [entidades] = await runSql<{ id_contratante: number; id_contrato: number }>(`
    WITH ct AS (
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'GG3 T6 Contratante Fixture')
      RETURNING id_contratante
    ), c AS (
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      SELECT id_contratante, ${ctx.id_produto}, '${mesAlvo}'::date, 'ativo' FROM ct
      RETURNING id_contrato
    )
    SELECT ct.id_contratante, c.id_contrato FROM ct, c;
  `);
  idContratante = entidades.id_contratante;
  idContrato = entidades.id_contrato;

  // Abertura no início de mesAlvo (dentro do mês); submissão registrada no
  // meio de mesAlvo -- respondida ANTES do fim do mês, deve contar.
  await runSql(`
    UPDATE rel_formulario_contrato SET estado = 'aberto', dt_abertura = '${mesAlvo}'::date
     WHERE id_contrato = ${idContrato} AND id_formulario = ${idFormulario};
    INSERT INTO fat_submissao (id_contrato, id_formulario, versao_formulario, respostas, momento, enviada_em)
    VALUES (${idContrato}, ${idFormulario}, 1, '{}'::jsonb, 'inicio', '${mesAlvo}'::date + INTERVAL '10 days');
  `);
}, 60000);

afterAll(async () => {
  await runSql(`
    DELETE FROM fat_submissao WHERE id_contrato = ${idContrato};
    DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};
    DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};
    DELETE FROM dim_planejamento WHERE id_contrato = ${idContrato};
    DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};
    DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};
  `);
}, 60000);

describe("visao-gerencial-g3-g6 T6 -- vw_resposta_formulario_mensal (GER-08)", () => {
  it("qtd_aberturas sobe em 1, qtd_respondidas sobe em 1 (submissão dentro do mês da abertura)", async () => {
    const rows = await runSql<{ qtd_aberturas: number; qtd_respondidas: number; taxa_media: string }>(`
      SELECT qtd_aberturas, qtd_respondidas, taxa_media FROM vw_resposta_formulario_mensal
       WHERE mes_referencia = '${mesAlvo}'::date;
    `);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].qtd_aberturas) - baselineAberturas).toBe(1);
    expect(Number(rows[0].qtd_respondidas) - baselineRespondidas).toBe(1);
  });

  it("mês anterior à abertura não muda (delta 0) -- dt_abertura = mesAlvo nunca é <= fim_do_mes anterior", async () => {
    const rows = await runSql<{ qtd_aberturas: number }>(`
      SELECT qtd_aberturas FROM vw_resposta_formulario_mensal
       WHERE mes_referencia = ('${mesAlvo}'::date - INTERVAL '1 month')::date;
    `);
    expect(rows).toHaveLength(1); // mês existe na série (nunca omitido, AD-005/T5)
    expect(Number(rows[0].qtd_aberturas) - baselineAberturasMesAnterior).toBe(0);
  });
});
