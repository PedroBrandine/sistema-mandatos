import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: PLV-03 AC1 (.specs/features/planejamento-estrategico-v2/spec.md)
//   "WHEN a migration é aplicada THEN fat_sucesso_mensal SHALL ter
//    id_usuario_responsavel referenciando dim_usuario, sem substituir
//    atualizado_por (auditoria, AD-006)."
//
// Responsável e atualizado_por são coisas diferentes -- de quem é a tarefa vs.
// quem mexeu por último (context.md D-2). O teste grava os dois com valores
// DIFERENTES na mesma linha para provar que coexistem, e não que um ficou no
// lugar do outro.
//
// T3 também exige, explicitamente, que NENHUMA coluna `ordem` seja criada: a
// tarefa T24 (reordenar arrastando, PLV-10) saiu do escopo em 2026-09-16 e
// migration é forward-only -- coluna sem consumidor só sairia com outro arquivo.

const EMAIL_RESPONSAVEL = "plv-t3-responsavel@legislabrasil.test";
const EMAIL_EDITOR = "plv-t3-editor@legislabrasil.test";

interface Fixture {
  idContratante: number;
  idContrato: number;
  idPlanejamento: number;
  idMeta: number;
  idUsuarioResponsavel: number;
  idUsuarioEditor: number;
}

let f: Fixture;

describe("planejamento-estrategico-v2 -- responsável no Sucesso Mensal (PLV-03 AC1)", () => {
  beforeAll(async () => {
    const usuarios = await runSql<{ id_usuario: number; email: string }>(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo)
      VALUES ('${EMAIL_RESPONSAVEL}', 'PLV T3 Responsável', 'assessor', true),
             ('${EMAIL_EDITOR}', 'PLV T3 Editor', 'assessor', true)
      ON CONFLICT (email) DO UPDATE SET ativo = EXCLUDED.ativo
      RETURNING id_usuario, email;
    `);
    const idUsuarioResponsavel = usuarios.find((u) => u.email === EMAIL_RESPONSAVEL)!.id_usuario;
    const idUsuarioEditor = usuarios.find((u) => u.email === EMAIL_EDITOR)!.id_usuario;

    const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'PLV Sucesso Responsável')
      RETURNING id_contratante;
    `);
    const [{ id_contrato: idContrato }] = await runSql<{ id_contrato: number }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
      RETURNING id_contrato;
    `);
    const [{ id_planejamento: idPlanejamento }] = await runSql<{ id_planejamento: number }>(`
      SELECT id_planejamento FROM dim_planejamento WHERE id_contrato = ${idContrato};
    `);
    const [{ id_meta: idMeta }] = await runSql<{ id_meta: number }>(`
      WITH o AS (
        INSERT INTO fat_objetivo_especifico (id_planejamento, descricao)
        VALUES (${idPlanejamento}, 'Objetivo T3') RETURNING id_objetivo
      )
      INSERT INTO fat_meta (id_objetivo, descricao, status)
      SELECT id_objetivo, 'Meta T3', 'ativa' FROM o
      RETURNING id_meta;
    `);

    f = {
      idContratante,
      idContrato,
      idPlanejamento,
      idMeta,
      idUsuarioResponsavel,
      idUsuarioEditor,
    };
  }, 180000);

  afterAll(async () => {
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato = ${f.idContrato};
      DELETE FROM rel_formulario_contrato WHERE id_contrato = ${f.idContrato};
      DELETE FROM dim_planejamento WHERE id_contrato = ${f.idContrato};
    `);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${f.idContrato};`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${f.idContratante};`);
    await runSql(`DELETE FROM dim_usuario WHERE email IN ('${EMAIL_RESPONSAVEL}', '${EMAIL_EDITOR}');`);
  }, 180000);

  it(
    "AC1: a coluna é anulável -- Sucesso Mensal criado sem responsável fica NULL, não 0 nem sentinela (AD-005)",
    async () => {
      const [linha] = await runSql<{ id_usuario_responsavel: number | null }>(`
        INSERT INTO fat_sucesso_mensal (id_meta, descricao, mes_referencia, peso)
        VALUES (${f.idMeta}, 'SM sem responsável', '2026-08-01', 10)
        RETURNING id_usuario_responsavel;
      `);
      expect(linha.id_usuario_responsavel).toBeNull();
    },
    60000
  );

  it(
    "AC1: coexiste com atualizado_por -- os dois guardam usuários diferentes na mesma linha (AD-006)",
    async () => {
      const [linha] = await runSql<{
        id_usuario_responsavel: number;
        atualizado_por: number;
      }>(`
        INSERT INTO fat_sucesso_mensal (id_meta, descricao, mes_referencia, peso, id_usuario_responsavel, atualizado_por)
        VALUES (${f.idMeta}, 'SM com responsável', '2026-08-01', 10, ${f.idUsuarioResponsavel}, ${f.idUsuarioEditor})
        RETURNING id_usuario_responsavel, atualizado_por;
      `);
      expect(linha.id_usuario_responsavel).toBe(f.idUsuarioResponsavel);
      expect(linha.atualizado_por).toBe(f.idUsuarioEditor);
    },
    60000
  );

  it(
    "AC1: a FK para dim_usuario recusa usuário inexistente (23503)",
    async () => {
      const [{ inexistente }] = await runSql<{ inexistente: number }>(
        `SELECT COALESCE(MAX(id_usuario), 0) + 1000000 AS inexistente FROM dim_usuario;`
      );
      await expect(
        runSql(`
          INSERT INTO fat_sucesso_mensal (id_meta, descricao, mes_referencia, peso, id_usuario_responsavel)
          VALUES (${f.idMeta}, 'SM com responsável inexistente', '2026-08-01', 10, ${inexistente});
        `)
      ).rejects.toThrow(/23503/);
    },
    60000
  );

  it(
    "T3: nenhuma coluna `ordem` foi criada em fat_sucesso_mensal (PLV-10 fora de escopo)",
    async () => {
      const linhas = await runSql<{ column_name: string }>(`
        SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'fat_sucesso_mensal' AND column_name = 'ordem';
      `);
      expect(linhas).toHaveLength(0);
    },
    60000
  );
});
