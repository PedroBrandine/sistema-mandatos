import { describe, it, expect, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: kanban-etapas T2 Done-when (.specs/features/kanban-etapas/tasks.md) --
//  - trg_audit_fat_etapa_contrato existe em pg_trigger com o argumento
//    'id_etapa_contrato' correto (pg_get_triggerdef)
//  - INSERT/UPDATE/DELETE em fat_etapa_contrato gera exatamente as 3 linhas
//    esperadas em log_auditoria (acao = insert/update/delete), mesmo padrão
//    de auditoria-gap.integration.test.ts
//
// spec.md KAN-06 (P1 AC3).

let idContratante: number;
let idContrato: number;

describe("kanban-etapas T2 -- liga trg_audit_fat_etapa_contrato (KAN-06)", () => {
  afterAll(async () => {
    // log_auditoria.id_registro_alvo é polimórfico (sem FK de volta pra
    // fat_etapa_contrato) -- nenhuma linha de auditoria bloqueia este
    // cleanup. As escritas desta suíte rodam via runSql (superuser, sem
    // app.id_usuario setado), então o trigger atribui id_usuario ao usuário
    // "sistema" permanente (nunca apagado) -- sem risco de FK como em
    // fn-substituir-vinculo.integration.test.ts, que loga sessões de usuário
    // de fixture reais.
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};
      DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};
      DELETE FROM dim_planejamento WHERE id_contrato = ${idContrato};
    `);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
  }, 60000);

  it("creates trg_audit_fat_etapa_contrato with the correct pk argument", async () => {
    const rows = await runSql<{ tgname: string; pk: string }>(`
      SELECT t.tgname, pg_get_triggerdef(t.oid) AS pk
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
       WHERE t.tgname = 'trg_audit_fat_etapa_contrato';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].pk).toContain("'id_etapa_contrato'");
  });

  it("audits INSERT/UPDATE/DELETE on fat_etapa_contrato into log_auditoria", async () => {
    const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'KAN T2 Audit fat_etapa_contrato')
      RETURNING id_contratante;
    `);
    idContratante = id_contratante;

    // O INSERT em fat_contrato já dispara trg_fat_contrato_instancia
    // (operacao-regua-instanciacao), que cria 1 linha em fat_etapa_contrato
    // por ref_etapa do produto -- essa própria criação já é o INSERT sob
    // teste; a linha da 1ª etapa (ordem 1) recebe o UPDATE e o DELETE
    // seguintes.
    const [{ id_contrato }] = await runSql<{ id_contrato: number }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
      RETURNING id_contrato;
    `);
    idContrato = id_contrato;

    const [{ id_etapa_contrato: id }] = await runSql<{ id_etapa_contrato: number }>(`
      SELECT ec.id_etapa_contrato FROM fat_etapa_contrato ec
        JOIN ref_etapa e ON e.id_etapa = ec.id_etapa
       WHERE ec.id_contrato = ${idContrato} AND e.ordem = 1;
    `);

    await runSql(`UPDATE fat_etapa_contrato SET status = 'em_andamento', dt_inicio = CURRENT_DATE WHERE id_etapa_contrato = ${id};`);
    await runSql(`DELETE FROM fat_etapa_contrato WHERE id_etapa_contrato = ${id};`);

    const rows = await runSql<{ acao: string }>(`
      SELECT acao FROM log_auditoria WHERE tabela = 'fat_etapa_contrato' AND id_registro_alvo = ${id} ORDER BY ocorrido_em;
    `);
    expect(rows.map((r) => r.acao)).toEqual(["insert", "update", "delete"]);
  }, 60000);
});
