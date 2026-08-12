import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: T17 Done-when --
//  - trg_audit_dim_contratante, trg_audit_dim_coalizao, trg_audit_rel_coalizao_membro
//    criados com a mesma assinatura do padrão existente (PK correta por tabela)
//  - INSERT/UPDATE/DELETE nas 3 tabelas gera linha em log_auditoria
// Plus scope found during this session's review (see 0012_fundacao_auditoria_gap.sql
// SPEC_DEVIATION and tasks.md T17 "Scope adicional"): the same approved trigger
// loop (docs/schema_sistema.sql:1712-1732) also covers fat_contrato, dim_mandato,
// rel_usuario_contrato and rel_mandato_candidatura -- in-scope Fundação tables
// with no task applying their trg_audit_* until now -- AD-006 requires it.

const cleanupContratantes: number[] = [];

afterAll(async () => {
  for (const id of cleanupContratantes) {
    await runSql(`DELETE FROM log_auditoria WHERE tabela = 'dim_contratante' AND id_registro_alvo = ${id};`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${id};`);
  }
});

describe("T17 -- trg_audit_* estendido a dim_contratante/dim_coalizao/rel_coalizao_membro", () => {
  it("creates the 3 triggers with the correct pk argument", async () => {
    const rows = await runSql<{ tgname: string; tabela: string; pk: string }>(`
      SELECT t.tgname,
             c.relname AS tabela,
             pg_get_triggerdef(t.oid) AS pk
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
       WHERE t.tgname IN ('trg_audit_dim_contratante', 'trg_audit_dim_coalizao', 'trg_audit_rel_coalizao_membro');
    `);
    expect(rows).toHaveLength(3);
    const byName = Object.fromEntries(rows.map((r) => [r.tgname, r]));
    expect(byName["trg_audit_dim_contratante"].pk).toContain("'id_contratante'");
    expect(byName["trg_audit_dim_coalizao"].pk).toContain("'id_coalizao'");
    expect(byName["trg_audit_rel_coalizao_membro"].pk).toContain("'id_membro'");
  });

  it("audits INSERT/UPDATE/DELETE on dim_contratante into log_auditoria", async () => {
    const [{ id_contratante: id }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'T17 Audit Contratante')
      RETURNING id_contratante;
    `);
    await runSql(`UPDATE dim_contratante SET nome = 'T17 Audit Contratante Editado' WHERE id_contratante = ${id};`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${id};`);

    const rows = await runSql<{ acao: string }>(`
      SELECT acao FROM log_auditoria WHERE tabela = 'dim_contratante' AND id_registro_alvo = ${id} ORDER BY ocorrido_em;
    `);
    expect(rows.map((r) => r.acao)).toEqual(["insert", "update", "delete"]);
  });

  it("audits INSERT/UPDATE/DELETE on dim_coalizao into log_auditoria", async () => {
    const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('coalizao', 'T17 Audit Coalizao Contratante')
      RETURNING id_contratante;
    `);
    cleanupContratantes.push(idContratante);

    const [{ id_coalizao: id }] = await runSql<{ id_coalizao: number }>(`
      INSERT INTO dim_coalizao (id_contratante, possui_planejamento_proprio) VALUES (${idContratante}, false)
      RETURNING id_coalizao;
    `);
    await runSql(`UPDATE dim_coalizao SET possui_planejamento_proprio = true WHERE id_coalizao = ${id};`);
    await runSql(`DELETE FROM dim_coalizao WHERE id_coalizao = ${id};`);

    const rows = await runSql<{ acao: string }>(`
      SELECT acao FROM log_auditoria WHERE tabela = 'dim_coalizao' AND id_registro_alvo = ${id} ORDER BY ocorrido_em;
    `);
    expect(rows.map((r) => r.acao)).toEqual(["insert", "update", "delete"]);
  });

  describe("rel_coalizao_membro fixture", () => {
    // SPEC_DEVIATION (test fix, this session): originally all 11 runSql round
    // trips (3 fixture inserts + insert/update/delete under test + select +
    // 4-row cleanup) lived inline in a single it(), sharing the 30s
    // testTimeout -- the same failure mode found and fixed in T13's
    // uq_vinculo test. Moved fixture setup/teardown into beforeAll/afterAll
    // (own 30s hookTimeout) so only the 4 calls under test share the it()'s
    // budget.
    let idContratanteCol: number;
    let idCoalizao: number;
    let idContratanteMandato: number;
    let idContrato: number;

    beforeAll(async () => {
      const [{ id_contratante: colContratante }] = await runSql<{ id_contratante: number }>(`
        INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('coalizao', 'T17 Audit Membro Coalizao')
        RETURNING id_contratante;
      `);
      idContratanteCol = colContratante;
      const [{ id_coalizao }] = await runSql<{ id_coalizao: number }>(`
        INSERT INTO dim_coalizao (id_contratante) VALUES (${idContratanteCol}) RETURNING id_coalizao;
      `);
      idCoalizao = id_coalizao;
      const [{ id_contratante: mandatoContratante }] = await runSql<{ id_contratante: number }>(`
        INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'T17 Audit Membro Mandato')
        RETURNING id_contratante;
      `);
      idContratanteMandato = mandatoContratante;
      const [{ id_contrato }] = await runSql<{ id_contrato: number }>(`
        INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
        VALUES (${idContratanteMandato}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
        RETURNING id_contrato;
      `);
      idContrato = id_contrato;
    });

    afterAll(async () => {
      // operacao-regua-instanciacao: trigger AFTER INSERT em fat_contrato
      // agora popula fat_etapa_contrato/rel_formulario_contrato/dim_planejamento
      // (ON DELETE RESTRICT) -- precisam sair antes de fat_contrato.
      await runSql(`DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};`);
      await runSql(`DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};`);
      await runSql(`DELETE FROM dim_planejamento WHERE id_contrato = ${idContrato};`);
      await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};`);
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratanteMandato};`);
      await runSql(`DELETE FROM dim_coalizao WHERE id_coalizao = ${idCoalizao};`);
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratanteCol};`);
    });

    it("audits INSERT/UPDATE/DELETE on rel_coalizao_membro into log_auditoria", async () => {
      const [{ id_membro: id }] = await runSql<{ id_membro: number }>(`
        INSERT INTO rel_coalizao_membro (id_coalizao, id_contrato, papel) VALUES (${idCoalizao}, ${idContrato}, 'membro')
        RETURNING id_membro;
      `);
      await runSql(`UPDATE rel_coalizao_membro SET papel = 'secretaria_executiva' WHERE id_membro = ${id};`);
      await runSql(`DELETE FROM rel_coalizao_membro WHERE id_membro = ${id};`);

      const rows = await runSql<{ acao: string }>(`
        SELECT acao FROM log_auditoria WHERE tabela = 'rel_coalizao_membro' AND id_registro_alvo = ${id} ORDER BY ocorrido_em;
      `);
      expect(rows.map((r) => r.acao)).toEqual(["insert", "update", "delete"]);
    });
  });
});

describe("T17 (gap adicional) -- trg_audit_* em fat_contrato/dim_mandato/rel_usuario_contrato/rel_mandato_candidatura", () => {
  it("creates the 4 additional triggers with the correct pk argument", async () => {
    const rows = await runSql<{ tgname: string; pk: string }>(`
      SELECT t.tgname, pg_get_triggerdef(t.oid) AS pk
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
       WHERE t.tgname IN (
         'trg_audit_fat_contrato', 'trg_audit_dim_mandato',
         'trg_audit_rel_usuario_contrato', 'trg_audit_rel_mandato_candidatura'
       );
    `);
    expect(rows).toHaveLength(4);
    const byName = Object.fromEntries(rows.map((r) => [r.tgname, r]));
    expect(byName["trg_audit_fat_contrato"].pk).toContain("'id_contrato'");
    expect(byName["trg_audit_dim_mandato"].pk).toContain("'id_mandato'");
    expect(byName["trg_audit_rel_usuario_contrato"].pk).toContain("'id_vinculo'");
    expect(byName["trg_audit_rel_mandato_candidatura"].pk).toContain("'id_vinculo_tse'");
  });

  describe("fat_contrato fixture", () => {
    let idContratante: number;

    beforeAll(async () => {
      const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
        INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'T17 Gap Audit fat_contrato')
        RETURNING id_contratante;
      `);
      idContratante = id_contratante;
    });

    afterAll(async () => {
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
    });

    it("audits INSERT/UPDATE/DELETE on fat_contrato into log_auditoria", async () => {
      const [{ id_contrato: id }] = await runSql<{ id_contrato: number }>(`
        INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
        VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
        RETURNING id_contrato;
      `);
      await runSql(`UPDATE fat_contrato SET dt_fim_prevista = CURRENT_DATE + 30 WHERE id_contrato = ${id};`);
      // operacao-regua-instanciacao: o INSERT acima disparou o trigger que
      // popula fat_etapa_contrato/rel_formulario_contrato/dim_planejamento
      // (ON DELETE RESTRICT) -- precisam sair antes do DELETE de fat_contrato.
      await runSql(`DELETE FROM fat_etapa_contrato WHERE id_contrato = ${id};`);
      await runSql(`DELETE FROM rel_formulario_contrato WHERE id_contrato = ${id};`);
      await runSql(`DELETE FROM dim_planejamento WHERE id_contrato = ${id};`);
      await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${id};`);

      const rows = await runSql<{ acao: string }>(`
        SELECT acao FROM log_auditoria WHERE tabela = 'fat_contrato' AND id_registro_alvo = ${id} ORDER BY ocorrido_em;
      `);
      expect(rows.map((r) => r.acao)).toEqual(["insert", "update", "delete"]);
    });
  });

  describe("dim_mandato fixture", () => {
    let idContratante: number;

    beforeAll(async () => {
      const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
        INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'T17 Gap Audit dim_mandato')
        RETURNING id_contratante;
      `);
      idContratante = id_contratante;
    });

    afterAll(async () => {
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
    });

    it("audits INSERT/UPDATE/DELETE on dim_mandato into log_auditoria", async () => {
      const [{ id_mandato: id }] = await runSql<{ id_mandato: number }>(`
        INSERT INTO dim_mandato (id_contratante) VALUES (${idContratante}) RETURNING id_mandato;
      `);
      await runSql(`UPDATE dim_mandato SET nm_civil = 'T17 Gap Civil Editado' WHERE id_mandato = ${id};`);
      await runSql(`DELETE FROM dim_mandato WHERE id_mandato = ${id};`);

      const rows = await runSql<{ acao: string }>(`
        SELECT acao FROM log_auditoria WHERE tabela = 'dim_mandato' AND id_registro_alvo = ${id} ORDER BY ocorrido_em;
      `);
      expect(rows.map((r) => r.acao)).toEqual(["insert", "update", "delete"]);
    });
  });

  describe("rel_usuario_contrato fixture", () => {
    let idContratante: number;
    let idContrato: number;
    let idUsuario: string;

    beforeAll(async () => {
      const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
        INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'T17 Gap Audit rel_usuario_contrato')
        RETURNING id_contratante;
      `);
      idContratante = id_contratante;
      const [{ id_contrato }] = await runSql<{ id_contrato: number }>(`
        INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
        VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
        RETURNING id_contrato;
      `);
      idContrato = id_contrato;
      const usuarios = await runSql<{ id_usuario: string }>(`SELECT id_usuario FROM dim_usuario LIMIT 1;`);
      idUsuario = usuarios[0].id_usuario;
    });

    afterAll(async () => {
      // operacao-regua-instanciacao: mesma correção dos blocos anteriores (ON DELETE RESTRICT novo).
      await runSql(`DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};`);
      await runSql(`DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};`);
      await runSql(`DELETE FROM dim_planejamento WHERE id_contrato = ${idContrato};`);
      await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};`);
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
    });

    it("audits INSERT/UPDATE/DELETE on rel_usuario_contrato into log_auditoria", async () => {
      const [{ id_vinculo: id }] = await runSql<{ id_vinculo: number }>(`
        INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
        VALUES (${idContrato}, ${idUsuario}, 'assessor')
        RETURNING id_vinculo;
      `);
      await runSql(`UPDATE rel_usuario_contrato SET cargo = 'chefe_gabinete' WHERE id_vinculo = ${id};`);
      await runSql(`DELETE FROM rel_usuario_contrato WHERE id_vinculo = ${id};`);

      const rows = await runSql<{ acao: string }>(`
        SELECT acao FROM log_auditoria WHERE tabela = 'rel_usuario_contrato' AND id_registro_alvo = ${id} ORDER BY ocorrido_em;
      `);
      expect(rows.map((r) => r.acao)).toEqual(["insert", "update", "delete"]);
    });
  });

  describe("rel_mandato_candidatura fixture", () => {
    let idContratante: number;
    let idMandato: number;

    beforeAll(async () => {
      const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
        INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'T17 Gap Audit rel_mandato_candidatura')
        RETURNING id_contratante;
      `);
      idContratante = id_contratante;
      const [{ id_mandato }] = await runSql<{ id_mandato: number }>(`
        INSERT INTO dim_mandato (id_contratante) VALUES (${idContratante}) RETURNING id_mandato;
      `);
      idMandato = id_mandato;
    });

    afterAll(async () => {
      await runSql(`DELETE FROM dim_mandato WHERE id_mandato = ${idMandato};`);
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
    });

    it("audits INSERT/UPDATE/DELETE on rel_mandato_candidatura into log_auditoria", async () => {
      const [{ id_vinculo_tse: id }] = await runSql<{ id_vinculo_tse: number }>(`
        INSERT INTO rel_mandato_candidatura (id_mandato, ano_eleicao, sq_candidato, nr_turno, metodo_match, confianca, status)
        VALUES (${idMandato}, 2022, 999901, 1, 'manual', 'baixa', 'sugerido')
        RETURNING id_vinculo_tse;
      `);
      await runSql(`UPDATE rel_mandato_candidatura SET confianca = 'media' WHERE id_vinculo_tse = ${id};`);
      await runSql(`DELETE FROM rel_mandato_candidatura WHERE id_vinculo_tse = ${id};`);

      const rows = await runSql<{ acao: string }>(`
        SELECT acao FROM log_auditoria WHERE tabela = 'rel_mandato_candidatura' AND id_registro_alvo = ${id} ORDER BY ocorrido_em;
      `);
      expect(rows.map((r) => r.acao)).toEqual(["insert", "update", "delete"]);
    });
  });
});
