import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: ficha-mandato-contrato T9 Done-when
// (.specs/features/ficha-mandato-contrato/tasks.md), migration
// 20260916151727_ficha_auditoria.sql -- design.md Tech Decisions/AD-006
// ("toda escrita guarda autor e timestamp"), spec.md FMC-36:
//  - trg_audit_fat_artefato, trg_audit_rel_registro_participante,
//    trg_audit_rel_mandato_agenda_tematica ligados com a PK correta por
//    tabela (rel_mandato_agenda_tematica usa id_mandato -- primeira coluna
//    da PK composta, mesmo precedente de rel_planejamento_preditor em
//    20260812150038_planejamento_planilha_auditoria.sql).
//  - INSERT/UPDATE/DELETE nas 3 tabelas gera linha em log_auditoria (lição
//    L-013: reusar mecanismo já provado noutra tabela não é evidência de que
//    foi ligado NESTA tabela -- a asserção é sobre a linha resultante, não
//    sobre a existência do trigger genérico).

let idContratante: number;
let idContrato: number;
let idMandato: number;
let idTipoRegistro: number;
let idUsuario: number;

beforeAll(async () => {
  const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'FMC T9')
    RETURNING id_contratante;
  `);
  idContratante = id_contratante;

  const [{ id_contrato }] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
    VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
    RETURNING id_contrato;
  `);
  idContrato = id_contrato;

  const [{ id_mandato }] = await runSql<{ id_mandato: number }>(`
    INSERT INTO dim_mandato (id_contratante) VALUES (${idContratante}) RETURNING id_mandato;
  `);
  idMandato = id_mandato;

  idTipoRegistro = (
    await runSql<{ id_tipo_registro: number }>(`
    SELECT tr.id_tipo_registro FROM ref_tipo_registro tr
      JOIN ref_etapa e ON e.id_etapa = tr.id_etapa
      JOIN ref_produto p ON p.id_produto = e.id_produto
     WHERE p.nome = 'Estratégia' AND tr.codigo = 'monitoramento';
  `)
  )[0].id_tipo_registro;

  const usuarios = await runSql<{ id_usuario: number }>(`
    INSERT INTO dim_usuario (email, nome, papel_global, ativo)
    VALUES ('fmc-t9-u1@legislabrasil.test', 'FMC T9 Usuario', 'assessor', true)
    ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome
    RETURNING id_usuario;
  `);
  idUsuario = usuarios[0].id_usuario;
}, 60000);

afterAll(async () => {
  await runSql(`DELETE FROM rel_mandato_agenda_tematica WHERE id_mandato = ${idMandato};`);
  await runSql(`DELETE FROM ref_agenda_tematica WHERE nome = 'FMC T9 Tema';`);
  await runSql(`DELETE FROM fat_artefato WHERE id_contrato = ${idContrato};`);
  await runSql(`DELETE FROM rel_registro_participante WHERE id_registro IN (SELECT id_registro FROM fat_registro WHERE id_contrato = ${idContrato});`);
  await runSql(`DELETE FROM fat_registro WHERE id_contrato = ${idContrato};`);
  await runSql(`
    DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};
    DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};
    DELETE FROM dim_planejamento WHERE id_contrato = ${idContrato};
  `);
  await runSql(`
    DELETE FROM log_auditoria WHERE tabela IN ('fat_artefato','rel_registro_participante','rel_mandato_agenda_tematica')
      AND id_registro_alvo IN (${idContrato}, ${idMandato});
  `);
  await runSql(`DELETE FROM dim_mandato WHERE id_mandato = ${idMandato};`);
  await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};`);
  await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
  await runSql(`DELETE FROM log_auditoria WHERE id_usuario = ${idUsuario};`);
  await runSql(`DELETE FROM dim_usuario WHERE id_usuario = ${idUsuario};`);
}, 60000);

describe("ficha-mandato-contrato T9 -- auditoria (AD-006) em fat_artefato/rel_registro_participante/rel_mandato_agenda_tematica", () => {
  it("trg_audit_* ligados nas 3 tabelas, com a PK correta por tabela", async () => {
    const rows = await runSql<{ tgname: string; tgargs: string }>(`
      SELECT t.tgname, pg_get_triggerdef(t.oid) AS tgargs
        FROM pg_trigger t
       WHERE t.tgname IN ('trg_audit_fat_artefato','trg_audit_rel_registro_participante','trg_audit_rel_mandato_agenda_tematica');
    `);
    expect(rows).toHaveLength(3);
    const byName = Object.fromEntries(rows.map((r) => [r.tgname, r]));
    expect(byName["trg_audit_fat_artefato"].tgargs).toContain("'id_artefato'");
    expect(byName["trg_audit_rel_registro_participante"].tgargs).toContain("'id_participacao'");
    expect(byName["trg_audit_rel_mandato_agenda_tematica"].tgargs).toContain("'id_mandato'");
  });

  it("audita INSERT/UPDATE/DELETE em fat_artefato em log_auditoria", async () => {
    const [{ id_artefato }] = await runSql<{ id_artefato: number }>(`
      INSERT INTO fat_artefato (id_contrato, escopo, tipo, url)
      VALUES (${idContrato}, 'contrato', 'pasta_drive', 'https://drive.google.com/fmc-t9')
      RETURNING id_artefato;
    `);
    await runSql(`UPDATE fat_artefato SET descricao = 'FMC T9 editado' WHERE id_artefato = ${id_artefato};`);
    await runSql(`DELETE FROM fat_artefato WHERE id_artefato = ${id_artefato};`);

    const rows = await runSql<{ acao: string }>(`
      SELECT acao FROM log_auditoria WHERE tabela = 'fat_artefato' AND id_registro_alvo = ${id_artefato} ORDER BY ocorrido_em;
    `);
    expect(rows.map((r) => r.acao)).toEqual(["insert", "update", "delete"]);
  });

  it("audita INSERT/UPDATE/DELETE em rel_registro_participante em log_auditoria", async () => {
    const [{ id_registro }] = await runSql<{ id_registro: number }>(`
      INSERT INTO fat_registro (id_contrato, id_tipo_registro, ocorrido_em, id_usuario_autor)
      VALUES (${idContrato}, ${idTipoRegistro}, now(), ${idUsuario})
      RETURNING id_registro;
    `);

    const [{ id_participacao }] = await runSql<{ id_participacao: number }>(`
      INSERT INTO rel_registro_participante (id_registro, nome_livre, origem)
      VALUES (${id_registro}, 'FMC T9 Participante', 'externo')
      RETURNING id_participacao;
    `);
    await runSql(`UPDATE rel_registro_participante SET nome_livre = 'FMC T9 Participante Editado' WHERE id_participacao = ${id_participacao};`);
    await runSql(`DELETE FROM rel_registro_participante WHERE id_participacao = ${id_participacao};`);

    const rows = await runSql<{ acao: string }>(`
      SELECT acao FROM log_auditoria WHERE tabela = 'rel_registro_participante' AND id_registro_alvo = ${id_participacao} ORDER BY ocorrido_em;
    `);
    expect(rows.map((r) => r.acao)).toEqual(["insert", "update", "delete"]);
  });

  it("audita INSERT/DELETE em rel_mandato_agenda_tematica em log_auditoria (id_registro_alvo = id_mandato, primeira coluna da PK composta)", async () => {
    const [{ id_agenda }] = await runSql<{ id_agenda: number }>(`
      INSERT INTO ref_agenda_tematica (nome, ordem) VALUES ('FMC T9 Tema', 9201)
      RETURNING id_agenda;
    `);

    await runSql(`
      INSERT INTO rel_mandato_agenda_tematica (id_mandato, id_agenda) VALUES (${idMandato}, ${id_agenda});
    `);
    // rel_mandato_agenda_tematica só tem as duas colunas da PK composta --
    // não há UPDATE possível sem trocar a própria chave. O ciclo auditável
    // real desta tabela é insert + delete.
    await runSql(`DELETE FROM rel_mandato_agenda_tematica WHERE id_mandato = ${idMandato} AND id_agenda = ${id_agenda};`);

    const rows = await runSql<{ acao: string }>(`
      SELECT acao FROM log_auditoria WHERE tabela = 'rel_mandato_agenda_tematica' AND id_registro_alvo = ${idMandato} ORDER BY ocorrido_em;
    `);
    expect(rows.map((r) => r.acao)).toEqual(["insert", "delete"]);
  });
});
