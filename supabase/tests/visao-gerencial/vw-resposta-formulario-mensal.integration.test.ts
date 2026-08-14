import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/visao-gerencial-g3-g6/spec.md GER-08 +
// tasks.md T6 Done-when -- migração:
// 20260814213130_visao_gerencial_fix_grao_fino_evolucao_mensal.sql
// (substitui a definição original de 20260814212443 -- mesmo achado de T5:
// grão fino por abertura, não pré-agregado por mês).

let idContratante: number;
let idContrato: number;
let idFormulario: number;
let mesAlvo: string;

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

  // Abertura no início de mesAlvo (dentro do mês); submissão registrada 10
  // dias depois -- respondida ANTES do fim do mês, deve contar.
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

describe("visao-gerencial-g3-g6 T6 -- vw_resposta_formulario_mensal (GER-08, grão fino)", () => {
  it("abertura respondida dentro do mês -> tem_resposta = true", async () => {
    const rows = await runSql<{ tem_resposta: boolean; id_produto: number }>(`
      SELECT tem_resposta, id_produto FROM vw_resposta_formulario_mensal
       WHERE mes_referencia = '${mesAlvo}'::date AND id_contrato = ${idContrato} AND id_formulario = ${idFormulario};
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].tem_resposta).toBe(true);
    expect(rows[0].id_produto).not.toBeNull();
  });

  it("mês anterior à abertura não tem essa linha (dt_abertura = mesAlvo nunca é <= fim_do_mes anterior)", async () => {
    const rows = await runSql<{ id_contrato: number }>(`
      SELECT id_contrato FROM vw_resposta_formulario_mensal
       WHERE mes_referencia = ('${mesAlvo}'::date - INTERVAL '1 month')::date
         AND id_contrato = ${idContrato} AND id_formulario = ${idFormulario};
    `);
    expect(rows).toHaveLength(0);
  });

  it("sem submissão até o fim do mês -> tem_resposta = false", async () => {
    await runSql(`DELETE FROM fat_submissao WHERE id_contrato = ${idContrato};`);
    try {
      const rows = await runSql<{ tem_resposta: boolean }>(`
        SELECT tem_resposta FROM vw_resposta_formulario_mensal
         WHERE mes_referencia = '${mesAlvo}'::date AND id_contrato = ${idContrato} AND id_formulario = ${idFormulario};
      `);
      expect(rows).toHaveLength(1);
      expect(rows[0].tem_resposta).toBe(false);
    } finally {
      await runSql(`
        INSERT INTO fat_submissao (id_contrato, id_formulario, versao_formulario, respostas, momento, enviada_em)
        VALUES (${idContrato}, ${idFormulario}, 1, '{}'::jsonb, 'inicio', '${mesAlvo}'::date + INTERVAL '10 days');
      `);
    }
  });
});
