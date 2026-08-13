import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: incidencia-encontros T11 Done-when
// (.specs/features/incidencia-encontros/tasks.md), migrations
// 20260813191715_incidencia_encontros_estrutura.sql /
// 20260813192032_incidencia_encontros_triggers.sql --
//  - 1 caso positivo + 1 negativo por constraint/trigger (9 no total):
//    trg_valida_registro_produto, trg_valida_insight_contrato, ck_fato_niveis,
//    ck_encontro_planejado, ck_encontro_realizado, ck_participante_identificacao,
//    uq_registro_sequencia, uq_encontro_sequencia, uq_encontro_participante_usuario.
//  - Asserção por código de erro real (23514/23505/P0001+mensagem do trigger).
//
// spec.md P1 "Registro por etapa" AC2/AC3, P2 "Insight" AC1/AC2, P1 "Fato
// Gerador" AC2, P2 "Encontros" AC1/AC2/AC3/AC4.

async function expectSqlError(sql: string, errcode: string): Promise<void> {
  try {
    await runSql(sql);
    throw new Error(`expected query to fail with ${errcode} but it succeeded`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain(errcode);
  }
}

interface Fixture {
  idContratante: number;
  idContrato: number;
}

async function makeFixture(label: string): Promise<Fixture> {
  const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'INC T11 ${label}')
    RETURNING id_contratante;
  `);
  const [{ id_contrato: idContrato }] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
    VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
    RETURNING id_contrato;
  `);
  return { idContratante, idContrato };
}

let a: Fixture;
let b: Fixture;
let idTipoRegistroEstrategia: number;
let idTipoRegistroPll: number;
let idTipologia: number;
let idUsuario1: number;
let idUsuario2: number;

describe("incidencia-encontros T11 -- triggers verbatim + CHECK/UNIQUE novos", () => {
  beforeAll(async () => {
    a = await makeFixture("A");
    b = await makeFixture("B");

    idTipoRegistroEstrategia = (
      await runSql<{ id_tipo_registro: number }>(`
      SELECT tr.id_tipo_registro FROM ref_tipo_registro tr
        JOIN ref_etapa e ON e.id_etapa = tr.id_etapa
        JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE p.nome = 'Estratégia' AND tr.codigo = 'monitoramento';
    `)
    )[0].id_tipo_registro;

    idTipoRegistroPll = (
      await runSql<{ id_tipo_registro: number }>(`
      SELECT tr.id_tipo_registro FROM ref_tipo_registro tr
        JOIN ref_etapa e ON e.id_etapa = tr.id_etapa
        JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE p.nome = 'PLL' AND tr.codigo = 'mentoria';
    `)
    )[0].id_tipo_registro;

    idTipologia = (await runSql<{ id_tipologia: number }>(`SELECT id_tipologia FROM ref_tipologia ORDER BY id_tipologia LIMIT 1;`))[0]
      .id_tipologia;

    const usuarios = await runSql<{ id_usuario: number }>(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo) VALUES
        ('inc-t11-u1@legislabrasil.test', 'INC T11 Usuario 1', 'assessor', true),
        ('inc-t11-u2@legislabrasil.test', 'INC T11 Usuario 2', 'assessor', true)
      ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome
      RETURNING id_usuario;
    `);
    idUsuario1 = usuarios[0].id_usuario;
    idUsuario2 = usuarios[1].id_usuario;
  }, 60000);

  afterAll(async () => {
    for (const f of [a, b]) {
      await runSql(`
        DELETE FROM fat_registro WHERE id_contrato = ${f.idContrato};
        DELETE FROM fat_insight WHERE id_contrato = ${f.idContrato};
        DELETE FROM fat_fato_gerador WHERE id_contrato = ${f.idContrato};
        DELETE FROM fat_encontro WHERE id_contrato = ${f.idContrato};
      `);
    }
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});
      DELETE FROM rel_formulario_contrato WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});
      DELETE FROM dim_planejamento WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});
    `);
    for (const f of [a, b]) {
      await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${f.idContrato};`);
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${f.idContratante};`);
    }
    await runSql(`DELETE FROM log_auditoria WHERE id_usuario IN (${idUsuario1}, ${idUsuario2});`);
    await runSql(`DELETE FROM dim_usuario WHERE id_usuario IN (${idUsuario1}, ${idUsuario2});`);
  }, 60000);

  it("trg_valida_registro_produto: aceita tipo de registro da régua do produto do contrato; rejeita (P0001) tipo de outro produto", async () => {
    const [{ id_registro }] = await runSql<{ id_registro: number }>(`
      INSERT INTO fat_registro (id_contrato, id_tipo_registro, ocorrido_em, id_usuario_autor)
      VALUES (${a.idContrato}, ${idTipoRegistroEstrategia}, now(), ${idUsuario1})
      RETURNING id_registro;
    `);
    expect(id_registro).toBeGreaterThan(0);

    await expectSqlError(
      `INSERT INTO fat_registro (id_contrato, id_tipo_registro, ocorrido_em, id_usuario_autor)
       VALUES (${a.idContrato}, ${idTipoRegistroPll}, now(), ${idUsuario1});`,
      "não pertence à régua do produto"
    );
  });

  it("trg_valida_insight_contrato: aceita id_registro do mesmo contrato; rejeita (P0001) id_registro de outro contrato", async () => {
    const [{ id_registro: idRegistroA }] = await runSql<{ id_registro: number }>(`
      INSERT INTO fat_registro (id_contrato, id_tipo_registro, ocorrido_em, id_usuario_autor)
      VALUES (${a.idContrato}, ${idTipoRegistroEstrategia}, now(), ${idUsuario1})
      RETURNING id_registro;
    `);

    const [{ id_insight }] = await runSql<{ id_insight: number }>(`
      INSERT INTO fat_insight (id_contrato, id_registro, conteudo)
      VALUES (${a.idContrato}, ${idRegistroA}, 'INC T11 insight origem A')
      RETURNING id_insight;
    `);
    expect(id_insight).toBeGreaterThan(0);

    await expectSqlError(
      `INSERT INTO fat_insight (id_contrato, id_registro, conteudo)
       VALUES (${b.idContrato}, ${idRegistroA}, 'INC T11 insight cross-contrato');`,
      "aponta para registro do contrato"
    );
  });

  it("ck_fato_niveis: aceita ao menos 1 nível preenchido; rejeita (23514) D1/D2/D3 todos NULL", async () => {
    const [{ id_fato_gerador }] = await runSql<{ id_fato_gerador: number }>(`
      INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, nivel_d1, dt_ocorrencia)
      VALUES (${a.idContrato}, ${idTipologia}, 'baixo', CURRENT_DATE)
      RETURNING id_fato_gerador;
    `);
    expect(id_fato_gerador).toBeGreaterThan(0);

    await expectSqlError(
      `INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, dt_ocorrencia)
       VALUES (${a.idContrato}, ${idTipologia}, CURRENT_DATE);`,
      "23514"
    );
  });

  it("ck_encontro_planejado: aceita status='planejado' com dt_prevista_inicio; rejeita (23514) sem ela", async () => {
    const [{ id_encontro }] = await runSql<{ id_encontro: number }>(`
      INSERT INTO fat_encontro (id_contrato, titulo, status, dt_prevista_inicio)
      VALUES (${a.idContrato}, 'INC T11 encontro planejado', 'planejado', now())
      RETURNING id_encontro;
    `);
    expect(id_encontro).toBeGreaterThan(0);

    await expectSqlError(
      `INSERT INTO fat_encontro (id_contrato, titulo, status)
       VALUES (${a.idContrato}, 'INC T11 encontro planejado sem data', 'planejado');`,
      "23514"
    );
  });

  it("ck_encontro_realizado: aceita status='realizado' com dt_realizada; rejeita (23514) sem ela", async () => {
    const [{ id_encontro }] = await runSql<{ id_encontro: number }>(`
      INSERT INTO fat_encontro (id_contrato, titulo, status, dt_realizada)
      VALUES (${a.idContrato}, 'INC T11 encontro realizado', 'realizado', now())
      RETURNING id_encontro;
    `);
    expect(id_encontro).toBeGreaterThan(0);

    await expectSqlError(
      `INSERT INTO fat_encontro (id_contrato, titulo, status)
       VALUES (${a.idContrato}, 'INC T11 encontro realizado sem data', 'realizado');`,
      "23514"
    );
  });

  it("ck_participante_identificacao: aceita XOR (só id_usuario OU só nome_livre); rejeita (23514) os dois juntos", async () => {
    const [{ id_encontro }] = await runSql<{ id_encontro: number }>(`
      INSERT INTO fat_encontro (id_contrato, titulo, status, dt_prevista_inicio)
      VALUES (${a.idContrato}, 'INC T11 encontro participantes', 'planejado', now())
      RETURNING id_encontro;
    `);

    const [{ id_participacao: idPorUsuario }] = await runSql<{ id_participacao: number }>(`
      INSERT INTO rel_encontro_participante (id_encontro, id_usuario, origem)
      VALUES (${id_encontro}, ${idUsuario1}, 'legisla')
      RETURNING id_participacao;
    `);
    expect(idPorUsuario).toBeGreaterThan(0);

    const [{ id_participacao: idPorNome }] = await runSql<{ id_participacao: number }>(`
      INSERT INTO rel_encontro_participante (id_encontro, nome_livre, origem)
      VALUES (${id_encontro}, 'INC T11 Participante Externo', 'externo')
      RETURNING id_participacao;
    `);
    expect(idPorNome).toBeGreaterThan(0);

    await expectSqlError(
      `INSERT INTO rel_encontro_participante (id_encontro, id_usuario, nome_livre, origem)
       VALUES (${id_encontro}, ${idUsuario2}, 'INC T11 Ambos Preenchidos', 'externo');`,
      "23514"
    );
  });

  it("uq_registro_sequencia: aceita nr_sequencia distinto no mesmo (contrato, tipo); rejeita (23505) repetido", async () => {
    const [{ id_registro }] = await runSql<{ id_registro: number }>(`
      INSERT INTO fat_registro (id_contrato, id_tipo_registro, nr_sequencia, ocorrido_em, id_usuario_autor)
      VALUES (${a.idContrato}, ${idTipoRegistroEstrategia}, 1, now(), ${idUsuario1})
      RETURNING id_registro;
    `);
    expect(id_registro).toBeGreaterThan(0);

    const [{ id_registro: idOutraSequencia }] = await runSql<{ id_registro: number }>(`
      INSERT INTO fat_registro (id_contrato, id_tipo_registro, nr_sequencia, ocorrido_em, id_usuario_autor)
      VALUES (${a.idContrato}, ${idTipoRegistroEstrategia}, 2, now(), ${idUsuario1})
      RETURNING id_registro;
    `);
    expect(idOutraSequencia).toBeGreaterThan(0);

    await expectSqlError(
      `INSERT INTO fat_registro (id_contrato, id_tipo_registro, nr_sequencia, ocorrido_em, id_usuario_autor)
       VALUES (${a.idContrato}, ${idTipoRegistroEstrategia}, 1, now(), ${idUsuario1});`,
      "23505"
    );
  });

  it("uq_encontro_sequencia: aceita nr_sequencia distinto vivo no mesmo (contrato, tipo); rejeita (23505) repetido enquanto ambos vivos", async () => {
    const [{ id_encontro }] = await runSql<{ id_encontro: number }>(`
      INSERT INTO fat_encontro (id_contrato, id_tipo_registro, nr_sequencia, titulo, status, dt_prevista_inicio)
      VALUES (${a.idContrato}, ${idTipoRegistroEstrategia}, 1, 'INC T11 encontro seq 1', 'planejado', now())
      RETURNING id_encontro;
    `);
    expect(id_encontro).toBeGreaterThan(0);

    const [{ id_encontro: idOutraSequencia }] = await runSql<{ id_encontro: number }>(`
      INSERT INTO fat_encontro (id_contrato, id_tipo_registro, nr_sequencia, titulo, status, dt_prevista_inicio)
      VALUES (${a.idContrato}, ${idTipoRegistroEstrategia}, 2, 'INC T11 encontro seq 2', 'planejado', now())
      RETURNING id_encontro;
    `);
    expect(idOutraSequencia).toBeGreaterThan(0);

    await expectSqlError(
      `INSERT INTO fat_encontro (id_contrato, id_tipo_registro, nr_sequencia, titulo, status, dt_prevista_inicio)
       VALUES (${a.idContrato}, ${idTipoRegistroEstrategia}, 1, 'INC T11 encontro seq 1 duplicado', 'planejado', now());`,
      "23505"
    );
  });

  it("uq_encontro_participante_usuario: aceita 2 usuários distintos no mesmo encontro; rejeita (23505) o mesmo usuário 2x", async () => {
    const [{ id_encontro }] = await runSql<{ id_encontro: number }>(`
      INSERT INTO fat_encontro (id_contrato, titulo, status, dt_prevista_inicio)
      VALUES (${a.idContrato}, 'INC T11 encontro uq participante', 'planejado', now())
      RETURNING id_encontro;
    `);

    const [{ id_participacao: idP1 }] = await runSql<{ id_participacao: number }>(`
      INSERT INTO rel_encontro_participante (id_encontro, id_usuario, origem)
      VALUES (${id_encontro}, ${idUsuario1}, 'legisla')
      RETURNING id_participacao;
    `);
    const [{ id_participacao: idP2 }] = await runSql<{ id_participacao: number }>(`
      INSERT INTO rel_encontro_participante (id_encontro, id_usuario, origem)
      VALUES (${id_encontro}, ${idUsuario2}, 'legisla')
      RETURNING id_participacao;
    `);
    expect(idP1).toBeGreaterThan(0);
    expect(idP2).toBeGreaterThan(0);

    await expectSqlError(
      `INSERT INTO rel_encontro_participante (id_encontro, id_usuario, origem)
       VALUES (${id_encontro}, ${idUsuario1}, 'legisla');`,
      "23505"
    );
  });
});
