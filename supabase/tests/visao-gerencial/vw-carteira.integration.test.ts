import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/visao-gerencial-g1-g2/spec.md, P1 "vw_carteira
// reduzida (AD-032)" AC1/AC2 + tasks.md T4 Done-when -- migração:
// 20260812175507_visao_gerencial_vw_carteira.sql.
//
//  - View criada com as colunas do design.md (sem iip_provisorio/nr_fatos/
//    dt_ultimo_registro)
//  - CREATE VIEW roda sem erro (sem depender de mv_iip_contrato/fat_registro)
//    -- já demonstrado pelo `supabase db push` desta migração; aqui a
//    existência da view + shape de colunas prova o mesmo indiretamente
//  - Fixture real (1 vínculo + 1 contrato ativo) retorna a linha esperada

const COLUNAS_ESPERADAS = [
  "atingimento_desatualizado",
  "etapa_atual",
  "id_contrato",
  "id_usuario",
  "nome_contratante",
  "nome_produto",
  "nome_projeto",
  "papel_no_contrato",
  "pct_atingimento",
  "status",
].sort();

const COLUNAS_OMITIDAS = ["iip_provisorio", "nr_fatos", "dt_ultimo_registro"];

describe("visao-gerencial-g1-g2 T4 -- vw_carteira reduzida (GG-01, AD-032)", () => {
  it("expõe exatamente as colunas esperadas -- iip_provisorio/nr_fatos/dt_ultimo_registro NÃO existem", async () => {
    const rows = await runSql<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'vw_carteira';
    `);
    const colunas = rows.map((r) => r.column_name).sort();
    expect(colunas).toEqual(COLUNAS_ESPERADAS);
    for (const omitida of COLUNAS_OMITIDAS) {
      expect(colunas).not.toContain(omitida);
    }
  });

  describe("fixture: 1 vínculo (gestora) + 1 contrato ativo", () => {
    let idContratante: number;
    let idContrato: number;
    let idUsuario: number;

    beforeAll(async () => {
      const [{ id_usuario }] = await runSql<{ id_usuario: number }>(`
        INSERT INTO dim_usuario (email, nome, papel_global, ativo)
        VALUES ('gg-t4-vw-carteira@legislabrasil.test', 'GG T4 Gestora Fixture', 'gestora', true)
        ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome
        RETURNING id_usuario;
      `);
      idUsuario = id_usuario;

      const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
        INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'GG T4 Contratante Fixture')
        RETURNING id_contratante;
      `);
      idContratante = id_contratante;

      const [{ id_contrato }] = await runSql<{ id_contrato: number }>(`
        INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
        VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
        RETURNING id_contrato;
      `);
      idContrato = id_contrato;

      await runSql(`
        INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
        VALUES (${idContrato}, ${idUsuario}, 'gestora');
      `);
    }, 60000);

    afterAll(async () => {
      await runSql(`DELETE FROM rel_usuario_contrato WHERE id_contrato = ${idContrato};`);
      await runSql(`
        DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};
        DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};
        DELETE FROM dim_planejamento WHERE id_contrato = ${idContrato};
      `);
      await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};`);
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
      await runSql(`DELETE FROM dim_usuario WHERE id_usuario = ${idUsuario};`);
    }, 60000);

    it("retorna a linha esperada para o vínculo ativo do contrato ativo", async () => {
      const rows = await runSql<{
        id_usuario: number;
        papel_no_contrato: string;
        id_contrato: number;
        nome_contratante: string;
        nome_produto: string;
        status: string;
        etapa_atual: string | null;
        pct_atingimento: number | null;
      }>(`
        SELECT id_usuario, papel_no_contrato, id_contrato, nome_contratante, nome_produto, status, etapa_atual, pct_atingimento
          FROM vw_carteira WHERE id_contrato = ${idContrato};
      `);
      expect(rows).toHaveLength(1);
      expect(rows[0].id_usuario).toBe(idUsuario);
      expect(rows[0].papel_no_contrato).toBe("gestora");
      expect(rows[0].nome_contratante).toBe("GG T4 Contratante Fixture");
      expect(rows[0].nome_produto).toBe("Estratégia");
      expect(rows[0].status).toBe("ativo");
      expect(rows[0].etapa_atual).toBeNull(); // id_etapa_atual ainda NULL, sem transição de Kanban
      expect(rows[0].pct_atingimento).toBeNull(); // dim_planejamento nasce com pct_atingimento NULL (RGI-03)
    });
  });
});
