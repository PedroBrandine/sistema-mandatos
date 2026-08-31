import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: saida-numeros-impacto T1 Done-when (.specs/features/saida-numeros-impacto/tasks.md),
// migration 20260831021516_saida_numeros_impacto_estrutura.sql --
//  - SELECT * FROM mv_numeros_impacto retorna dado real com
//    nr_contratos_contratante/dt_primeira_contratacao/ordem_contrato corretos
//  - Contratante com 1 contrato: nr_contratos_contratante = 1, ordem_contrato = 1
//  - Contratante com 2+ contratos: agregações corretas, ordem por dt_inicio
//  - Sem filtro de status (D4, verbatim) -- contrato 'encerrado' aparece igual
//
// spec.md P1 AC1/AC3, Edge Cases ("contratante com exatamente 1 contrato",
// "contratante sem filtro de status").
//
// Consulta direta via runSql (não PostgREST): nesta task ainda não existe
// nenhum GRANT SELECT na MV para papel legisla_* nenhum (T2 adiciona,
// AD-036) -- runSql roda via `supabase db query --linked`, fora do caminho
// PostgREST/RLS, mesmo padrão de iip.integration.test.ts pra mv_iip_contrato.

let idContratanteUmContrato: number;
let idContratanteDoisContratos: number;
let idContratoUnico: number;
let idContratoAntigo: number;
let idContratoRecente: number;

describe("saida-numeros-impacto T1 -- mv_numeros_impacto DDL + agregações", () => {
  beforeAll(async () => {
    const [{ id_contratante: idA }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'SAI T1 Contratante Um Contrato')
      RETURNING id_contratante;
    `);
    idContratanteUmContrato = idA;

    const [{ id_contratante: idB }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'SAI T1 Contratante Dois Contratos')
      RETURNING id_contratante;
    `);
    idContratanteDoisContratos = idB;

    const [{ id_contrato: idUnico }] = await runSql<{ id_contrato: number }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      VALUES (${idContratanteUmContrato}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), '2025-01-10', 'ativo')
      RETURNING id_contrato;
    `);
    idContratoUnico = idUnico;

    // Contrato mais antigo (dt_inicio anterior) -- deve virar ordem_contrato = 1.
    const [{ id_contrato: idAntigo }] = await runSql<{ id_contrato: number }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      VALUES (${idContratanteDoisContratos}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), '2023-03-01', 'concluido')
      RETURNING id_contrato;
    `);
    idContratoAntigo = idAntigo;

    // Contrato mais recente (dt_inicio posterior) -- ordem_contrato = 2. Status
    // 'ativo' de propósito, diferente do contrato antigo -- confirma que a MV
    // não filtra por status (D4) em nenhum dos dois.
    const [{ id_contrato: idRecente }] = await runSql<{ id_contrato: number }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      VALUES (${idContratanteDoisContratos}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), '2025-06-15', 'ativo')
      RETURNING id_contrato;
    `);
    idContratoRecente = idRecente;

    // Refresh não-concorrente direto -- app.atualiza_numeros_impacto()
    // (CONCURRENTLY) só existe a partir de T2.
    await runSql(`REFRESH MATERIALIZED VIEW mv_numeros_impacto;`);
  }, 120000);

  afterAll(async () => {
    const idsContrato = `${idContratoUnico}, ${idContratoAntigo}, ${idContratoRecente}`;
    // trg_fat_contrato_instancia (operacao-regua-instanciacao, achado em
    // .specs/STATE.md) cria fat_etapa_contrato/rel_formulario_contrato/
    // dim_planejamento automaticamente a cada INSERT em fat_contrato --
    // precisa ser limpo antes do DELETE em fat_contrato, mesmo padrão já
    // usado em formularios-gip.integration.test.ts/iip.integration.test.ts.
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato IN (${idsContrato});
      DELETE FROM rel_formulario_contrato WHERE id_contrato IN (${idsContrato});
      DELETE FROM dim_planejamento WHERE id_contrato IN (${idsContrato});
    `);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato IN (${idsContrato});`);
    await runSql(`
      DELETE FROM dim_contratante WHERE id_contratante IN (${idContratanteUmContrato}, ${idContratanteDoisContratos});
    `);
    await runSql(`REFRESH MATERIALIZED VIEW mv_numeros_impacto;`);
  }, 120000);

  it("Edge Case: contratante com exatamente 1 contrato -> nr_contratos_contratante = 1, ordem_contrato = 1", async () => {
    const [row] = await runSql<{
      nr_contratos_contratante: number;
      ordem_contrato: number;
      dt_primeira_contratacao: string;
    }>(`
      SELECT nr_contratos_contratante, ordem_contrato, dt_primeira_contratacao
        FROM mv_numeros_impacto WHERE id_contrato = ${idContratoUnico};
    `);
    expect(row).toBeDefined();
    expect(row.nr_contratos_contratante).toBe(1);
    expect(row.ordem_contrato).toBe(1);
    expect(row.dt_primeira_contratacao).toBe("2025-01-10");
  });

  it("contratante com 2 contratos: nr_contratos_contratante = 2 nas duas linhas, dt_primeira_contratacao = MIN(dt_inicio) nas duas", async () => {
    const rows = await runSql<{ id_contrato: number; nr_contratos_contratante: number; dt_primeira_contratacao: string }>(`
      SELECT id_contrato, nr_contratos_contratante, dt_primeira_contratacao
        FROM mv_numeros_impacto WHERE id_contratante = ${idContratanteDoisContratos}
       ORDER BY id_contrato;
    `);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.nr_contratos_contratante).toBe(2);
      expect(row.dt_primeira_contratacao).toBe("2023-03-01");
    }
  });

  it("ordem_contrato numera por dt_inicio ascendente (1 = mais antigo, 2 = mais recente)", async () => {
    const [rowAntigo] = await runSql<{ ordem_contrato: number }>(
      `SELECT ordem_contrato FROM mv_numeros_impacto WHERE id_contrato = ${idContratoAntigo};`
    );
    const [rowRecente] = await runSql<{ ordem_contrato: number }>(
      `SELECT ordem_contrato FROM mv_numeros_impacto WHERE id_contrato = ${idContratoRecente};`
    );
    expect(rowAntigo.ordem_contrato).toBe(1);
    expect(rowRecente.ordem_contrato).toBe(2);
  });

  it("sem filtro de status (D4): contrato 'concluido' aparece na MV igual a um 'ativo'", async () => {
    const [row] = await runSql<{ status: string }>(
      `SELECT status FROM mv_numeros_impacto WHERE id_contrato = ${idContratoAntigo};`
    );
    expect(row).toBeDefined();
    expect(row.status).toBe("concluido");
  });
});
