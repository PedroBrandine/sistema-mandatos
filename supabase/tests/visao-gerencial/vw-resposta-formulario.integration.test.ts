import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/visao-gerencial-g3-g6/spec.md GER-08 +
// tasks.md T2 Done-when -- migração: 20260814210823_visao_gerencial_vw_resposta_formulario.sql.
// Lição de T1 (mesma sessão): reduzir chamadas runSql ao mínimo -- cada uma
// é um spawn de processo + round trip real à Management API.

let idContrato: number;
let idFormulario: number;
let idContratante: number;

beforeAll(async () => {
  const [ctx] = await runSql<{
    id_produto: number;
    id_formulario: number;
  }>(`
    WITH p AS (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia')
    SELECT p.id_produto,
           (SELECT f.id_formulario FROM ref_formulario f JOIN ref_etapa e ON e.id_etapa = f.id_etapa
             WHERE e.id_produto = p.id_produto AND f.ativo LIMIT 1) AS id_formulario
    FROM p;
  `);
  idFormulario = ctx.id_formulario;

  const [entidades] = await runSql<{ id_contratante: number; id_contrato: number }>(`
    WITH ct AS (
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'GG4 T2 Contratante Fixture')
      RETURNING id_contratante
    ), c AS (
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      SELECT id_contratante, ${ctx.id_produto}, CURRENT_DATE - 10, 'ativo' FROM ct
      RETURNING id_contrato
    )
    SELECT ct.id_contratante, c.id_contrato FROM ct, c;
  `);
  idContratante = entidades.id_contratante;
  idContrato = entidades.id_contrato;

  // Formulário nasce 'fechado' pelo trigger de instanciação -- abrimos e
  // registramos uma submissão FINALIZADA (enviada_em preenchido).
  await runSql(`
    UPDATE rel_formulario_contrato SET estado = 'aberto', dt_abertura = now() - INTERVAL '35 days'
     WHERE id_contrato = ${idContrato} AND id_formulario = ${idFormulario};
    INSERT INTO fat_submissao (id_contrato, id_formulario, versao_formulario, respostas, momento, enviada_em)
    VALUES (${idContrato}, ${idFormulario}, 1, '{}'::jsonb, 'inicio', now() - INTERVAL '20 days');
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

describe("visao-gerencial-g3-g6 T2 -- vw_resposta_formulario (GER-08)", () => {
  it("security_invoker = true", async () => {
    const rows = await runSql<{ reloptions: string[] }>(`
      SELECT reloptions FROM pg_class WHERE relname = 'vw_resposta_formulario';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].reloptions).toContain("security_invoker=true");
  });

  it("formulário aberto com submissão enviada após a abertura -> respondido = true", async () => {
    const rows = await runSql<{ respondido: boolean; nome_formulario: string; estado: string }>(`
      SELECT respondido, nome_formulario, estado FROM vw_resposta_formulario
       WHERE id_contrato = ${idContrato} AND id_formulario = ${idFormulario};
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].respondido).toBe(true);
    expect(rows[0].estado).toBe("aberto");
    expect(rows[0].nome_formulario).not.toBeNull();
  });

  it("formulário sem nenhuma submissão -> respondido = false", async () => {
    await runSql(`DELETE FROM fat_submissao WHERE id_contrato = ${idContrato};`);
    try {
      const rows = await runSql<{ respondido: boolean }>(`
        SELECT respondido FROM vw_resposta_formulario
         WHERE id_contrato = ${idContrato} AND id_formulario = ${idFormulario};
      `);
      expect(rows).toHaveLength(1);
      expect(rows[0].respondido).toBe(false);
    } finally {
      await runSql(`
        INSERT INTO fat_submissao (id_contrato, id_formulario, versao_formulario, respostas, momento, enviada_em)
        VALUES (${idContrato}, ${idFormulario}, 1, '{}'::jsonb, 'inicio', now() - INTERVAL '20 days');
      `);
    }
  });
});
