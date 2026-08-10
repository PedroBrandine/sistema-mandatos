import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/catalogos-referencia/spec.md, CAT-01..CAT-12 +
// Edge Cases -- estrutura das 12 tabelas ref_* novas (docs/schema_sistema.sql:170-301,
// verbatim). Migração: 20260810191659_catalogos_referencia_estrutura.sql.
//
// Este arquivo roda logo depois da migração de ESTRUTURA, antes do seed
// (T3/T4) -- ref_etapa/ref_formulario/ref_preditor/etc. ainda não têm linha
// nenhuma nesse ponto. Por isso os testes de FK/CHECK que dependem de uma
// linha "pai" existente criam sua própria fixture em beforeAll (prefixo
// fixture_t1_teste_estrutura), em vez de assumir `LIMIT 1` sobre uma tabela
// que pode estar vazia.

async function expectSqlError(sql: string, errcode: string): Promise<void> {
  try {
    await runSql(sql);
    throw new Error("expected query to fail but it succeeded");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain(errcode);
  }
}

const TABELAS_NOVAS = [
  "ref_etapa",
  "ref_tipo_registro",
  "ref_formulario",
  "ref_metrica_formulario",
  "ref_preditor",
  "ref_agenda_tematica",
  "ref_perfil_atuacao",
  "ref_pilar_insight",
  "ref_indicador",
  "ref_nivel_iip",
  "ref_tipologia",
  "ref_dimensao_gip",
];

let idEtapaFixture: number;
let idFormularioFixture: number;
let idPreditorFixture: number;

beforeAll(async () => {
  // Uma única query (3 writable CTEs) em vez de 3 round-trips sequenciais --
  // cada chamada via `supabase db query --linked` paga o custo de spawn de
  // processo + Management API (ver supabase/tests/helpers/sql.ts); 3 chamadas
  // encadeadas estouravam o hookTimeout de 30s do runner de integração.
  const [{ id_etapa, id_formulario, id_preditor }] = await runSql<{
    id_etapa: number;
    id_formulario: number;
    id_preditor: number;
  }>(`
    WITH e AS (
      INSERT INTO ref_etapa (id_produto, codigo, nome, ordem)
      SELECT id_produto, 'fixture_t1_teste_estrutura', 'Fixture T1 -- teste de estrutura', 32000
        FROM ref_produto ORDER BY id_produto LIMIT 1
      RETURNING id_etapa
    ), f AS (
      INSERT INTO ref_formulario (id_etapa, codigo, nome)
      SELECT id_etapa, 'fixture_t1_teste_estrutura_form', 'Fixture T1 -- formulário de teste' FROM e
      RETURNING id_formulario
    ), p AS (
      INSERT INTO ref_preditor (nome) VALUES ('Fixture T1 -- preditor de teste')
      RETURNING id_preditor
    )
    SELECT e.id_etapa, f.id_formulario, p.id_preditor FROM e, f, p;
  `);
  idEtapaFixture = id_etapa;
  idFormularioFixture = id_formulario;
  idPreditorFixture = id_preditor;
});

afterAll(async () => {
  // ref_metrica_formulario cascateia via ON DELETE CASCADE ao apagar o
  // formulário; ordem importa (formulário referencia etapa, sem cascade) --
  // um único round-trip com 3 statements em vez de 3 chamadas separadas.
  await runSql(`
    DELETE FROM ref_formulario WHERE id_formulario = ${idFormularioFixture};
    DELETE FROM ref_etapa WHERE id_etapa = ${idEtapaFixture};
    DELETE FROM ref_preditor WHERE id_preditor = ${idPreditorFixture};
  `);
});

describe("Catálogos de Referência -- estrutura das 12 tabelas novas (CAT-01..12)", () => {
  it("creates all 12 tables in schema public", async () => {
    const rows = await runSql<{ relname: string }>(`
      SELECT c.relname
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r'
         AND c.relname = ANY(ARRAY[${TABELAS_NOVAS.map((t) => `'${t}'`).join(",")}])
       ORDER BY c.relname;
    `);
    expect(rows.map((r) => r.relname)).toEqual([...TABELAS_NOVAS].sort());
  });

  it("does not alter the 4 pre-existing catálogos (ref_produto/ref_projeto/ref_cargo/ref_partido)", async () => {
    // Success Criteria do spec.md: nenhuma das 4 tabelas já existentes é
    // alterada por esta feature -- confirma que as colunas originais (0007)
    // ainda existem exatamente como antes.
    const rows = await runSql<{ tabela: string; coluna: string }>(`
      SELECT table_name AS tabela, column_name AS coluna
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name IN ('ref_produto','ref_projeto','ref_cargo','ref_partido')
         AND column_name IN ('id_produto','id_projeto','id_cargo','id_partido')
       ORDER BY table_name;
    `);
    expect(rows).toHaveLength(4);
  });

  // -- CAT-01: ref_etapa -----------------------------------------------------

  it("CAT-01: ck_etapa_duracao rejects duracao_prevista_dias <= 0", async () => {
    await expectSqlError(
      `INSERT INTO ref_etapa (id_produto, codigo, nome, ordem, duracao_prevista_dias)
       SELECT id_produto, 'teste_cat01', 'Teste CAT-01', 31999, 0 FROM ref_produto ORDER BY id_produto LIMIT 1;`,
      "23514"
    );
  });

  it("CAT-01: uq_etapa_produto_codigo rejects duplicate (id_produto, codigo)", async () => {
    await runSql(`
      INSERT INTO ref_etapa (id_produto, codigo, nome, ordem)
      SELECT id_produto, 'teste_cat01_dup', 'Teste CAT-01 dup', 31998 FROM ref_produto ORDER BY id_produto LIMIT 1
      ON CONFLICT (id_produto, codigo) DO NOTHING;
    `);
    await expectSqlError(
      `INSERT INTO ref_etapa (id_produto, codigo, nome, ordem)
       SELECT id_produto, 'teste_cat01_dup', 'Outro nome', 31997 FROM ref_produto ORDER BY id_produto LIMIT 1;`,
      "23505"
    );
    await runSql(`DELETE FROM ref_etapa WHERE codigo = 'teste_cat01_dup';`);
  });

  it("CAT-01: uq_etapa_produto_ordem rejects duplicate (id_produto, ordem)", async () => {
    await runSql(`
      INSERT INTO ref_etapa (id_produto, codigo, nome, ordem)
      SELECT id_produto, 'teste_cat01_ordem_a', 'Teste CAT-01 ordem A', 31996 FROM ref_produto ORDER BY id_produto LIMIT 1
      ON CONFLICT (id_produto, codigo) DO NOTHING;
    `);
    await expectSqlError(
      `INSERT INTO ref_etapa (id_produto, codigo, nome, ordem)
       SELECT id_produto, 'teste_cat01_ordem_b', 'Teste CAT-01 ordem B', 31996 FROM ref_produto ORDER BY id_produto LIMIT 1;`,
      "23505"
    );
    await runSql(`DELETE FROM ref_etapa WHERE codigo = 'teste_cat01_ordem_a';`);
  });

  it("CAT-01: ref_etapa.id_produto rejects a non-existent FK", async () => {
    await expectSqlError(
      `INSERT INTO ref_etapa (id_produto, codigo, nome, ordem) VALUES (999999999, 'x', 'x', 1);`,
      "23503"
    );
  });

  // -- CAT-02: ref_tipo_registro ----------------------------------------------

  it("CAT-02: ck_tipo_registro_qtd rejects qtd_prevista set without permite_multiplos", async () => {
    await expectSqlError(
      `INSERT INTO ref_tipo_registro (id_etapa, codigo, nome, permite_multiplos, qtd_prevista)
       VALUES (${idEtapaFixture}, 'teste_cat02', 'Teste CAT-02', false, 3);`,
      "23514"
    );
  });

  it("CAT-02: ref_tipo_registro.id_etapa rejects a non-existent FK", async () => {
    await expectSqlError(
      `INSERT INTO ref_tipo_registro (id_etapa, codigo, nome) VALUES (999999999, 'x', 'x');`,
      "23503"
    );
  });

  it("CAT-02: uq_tipo_registro_etapa_codigo rejects duplicate (id_etapa, codigo)", async () => {
    await runSql(`
      INSERT INTO ref_tipo_registro (id_etapa, codigo, nome)
      VALUES (${idEtapaFixture}, 'teste_cat02_dup', 'Teste CAT-02 dup')
      ON CONFLICT (id_etapa, codigo) DO NOTHING;
    `);
    await expectSqlError(
      `INSERT INTO ref_tipo_registro (id_etapa, codigo, nome)
       VALUES (${idEtapaFixture}, 'teste_cat02_dup', 'Outro nome');`,
      "23505"
    );
    await runSql(`DELETE FROM ref_tipo_registro WHERE id_etapa = ${idEtapaFixture} AND codigo = 'teste_cat02_dup';`);
  });

  // -- CAT-03: ref_formulario ---------------------------------------------

  it("CAT-03: ck_formulario_respondente rejects an invalid respondente value", async () => {
    await expectSqlError(
      `INSERT INTO ref_formulario (id_etapa, codigo, nome, respondente)
       VALUES (${idEtapaFixture}, 'teste_cat03', 'Teste CAT-03', 'papel_invalido');`,
      "23514"
    );
  });

  it("CAT-03: ref_formulario.codigo is UNIQUE", async () => {
    await expectSqlError(
      `INSERT INTO ref_formulario (id_etapa, codigo, nome)
       VALUES (${idEtapaFixture}, 'fixture_t1_teste_estrutura_form', 'Outro nome');`,
      "23505"
    );
  });

  it("CAT-03: ref_formulario.id_etapa rejects a non-existent FK", async () => {
    await expectSqlError(
      `INSERT INTO ref_formulario (id_etapa, codigo, nome) VALUES (999999999, 'teste_cat03_fk', 'x');`,
      "23503"
    );
  });

  // -- CAT-04: ref_metrica_formulario --------------------------------------

  it("CAT-04: ck_metrica_tipo rejects an invalid tipo value", async () => {
    await expectSqlError(
      `INSERT INTO ref_metrica_formulario (id_formulario, codigo_campo, rotulo, tipo)
       VALUES (${idFormularioFixture}, 'teste_cat04', 'Teste CAT-04', 'tipo_invalido');`,
      "23514"
    );
  });

  it("CAT-04: uq_metrica_nps_por_formulario rejects a second eh_nps=true row on the same formulário", async () => {
    await runSql(`
      INSERT INTO ref_metrica_formulario (id_formulario, codigo_campo, rotulo, tipo, eh_nps)
      VALUES (${idFormularioFixture}, 'teste_cat04_nps1', 'NPS 1', 'escala_0_10', true)
      ON CONFLICT (id_formulario, codigo_campo) DO NOTHING;
    `);
    await expectSqlError(
      `INSERT INTO ref_metrica_formulario (id_formulario, codigo_campo, rotulo, tipo, eh_nps)
       VALUES (${idFormularioFixture}, 'teste_cat04_nps2', 'NPS 2', 'escala_0_10', true);`,
      "23505"
    );
    await runSql(
      `DELETE FROM ref_metrica_formulario WHERE id_formulario = ${idFormularioFixture} AND codigo_campo = 'teste_cat04_nps1';`
    );
  });

  it("CAT-04: uq_metrica_form_campo rejects duplicate (id_formulario, codigo_campo) regardless of eh_nps", async () => {
    await runSql(`
      INSERT INTO ref_metrica_formulario (id_formulario, codigo_campo, rotulo, tipo)
      VALUES (${idFormularioFixture}, 'teste_cat04_campo_dup', 'Campo dup', 'numero')
      ON CONFLICT (id_formulario, codigo_campo) DO NOTHING;
    `);
    await expectSqlError(
      `INSERT INTO ref_metrica_formulario (id_formulario, codigo_campo, rotulo, tipo)
       VALUES (${idFormularioFixture}, 'teste_cat04_campo_dup', 'Outro rótulo', 'booleano');`,
      "23505"
    );
    await runSql(
      `DELETE FROM ref_metrica_formulario WHERE id_formulario = ${idFormularioFixture} AND codigo_campo = 'teste_cat04_campo_dup';`
    );
  });

  it("CAT-04: uq_metrica_nps_por_formulario is PARTIAL (WHERE eh_nps) -- a non-NPS row coexists with an NPS row on the same formulário", async () => {
    // Discrimination sensor do Verifier (validation.md, mutação 2): o teste
    // acima só prova que 2 linhas eh_nps=true colidem -- isso também seria
    // verdade sob um UNIQUE(id_formulario) pleno, sem WHERE. Este teste prova
    // especificamente a parcialidade: uma 2ª linha eh_nps=false no MESMO
    // formulário deve ter sucesso, o que só é possível porque o índice é
    // `WHERE eh_nps`, não um UNIQUE pleno.
    await runSql(`
      INSERT INTO ref_metrica_formulario (id_formulario, codigo_campo, rotulo, tipo, eh_nps)
      VALUES (${idFormularioFixture}, 'teste_cat04_parcial_nps', 'NPS', 'escala_0_10', true)
      ON CONFLICT (id_formulario, codigo_campo) DO NOTHING;
    `);
    const rows = await runSql<{ id_metrica: number }>(`
      INSERT INTO ref_metrica_formulario (id_formulario, codigo_campo, rotulo, tipo, eh_nps)
      VALUES (${idFormularioFixture}, 'teste_cat04_parcial_naonps', 'Não-NPS', 'numero', false)
      RETURNING id_metrica;
    `);
    expect(rows).toHaveLength(1);
    await runSql(`
      DELETE FROM ref_metrica_formulario
       WHERE id_formulario = ${idFormularioFixture}
         AND codigo_campo IN ('teste_cat04_parcial_nps', 'teste_cat04_parcial_naonps');
    `);
  });

  it("CAT-04: ref_metrica_formulario.id_formulario cascades on delete (ON DELETE CASCADE)", async () => {
    // Reusa a etapa fixture (beforeAll) -- só precisa de um formulário +
    // métrica novos aqui, criados numa única query (CTE dependente: m
    // referencia f, então f executa antes) para caber em 3 round-trips no
    // total (setup, delete, select), o mesmo orçamento dos demais testes de
    // duplicata desta suíte, que já passam confortavelmente dentro dos 30s.
    const [{ id_formulario }] = await runSql<{ id_formulario: number }>(`
      WITH f AS (
        INSERT INTO ref_formulario (id_etapa, codigo, nome)
        VALUES (${idEtapaFixture}, 'teste_cat04_cascade', 'Teste CAT-04 cascade')
        RETURNING id_formulario
      ), m AS (
        INSERT INTO ref_metrica_formulario (id_formulario, codigo_campo, rotulo, tipo)
        SELECT id_formulario, 'campo_x', 'Campo X', 'numero' FROM f
        RETURNING id_metrica
      )
      SELECT f.id_formulario FROM f;
    `);
    await runSql(`DELETE FROM ref_formulario WHERE id_formulario = ${id_formulario};`);
    const remaining = await runSql<{ id_metrica: number }>(
      `SELECT id_metrica FROM ref_metrica_formulario WHERE id_formulario = ${id_formulario};`
    );
    expect(remaining).toHaveLength(0);
  });

  // -- CAT-05/06/07/08: catálogos folha (nome/codigo UNIQUE) --

  it("CAT-05: ref_preditor.nome is UNIQUE", async () => {
    await expectSqlError(
      `INSERT INTO ref_preditor (nome) VALUES ('Preditor Duplicado CAT-05'), ('Preditor Duplicado CAT-05');`,
      "23505"
    );
  });

  it("CAT-06: ref_agenda_tematica.nome is UNIQUE", async () => {
    await expectSqlError(
      `INSERT INTO ref_agenda_tematica (nome) VALUES ('Agenda Duplicada CAT-06'), ('Agenda Duplicada CAT-06');`,
      "23505"
    );
  });

  it("CAT-07: ref_perfil_atuacao.nome is UNIQUE", async () => {
    await expectSqlError(
      `INSERT INTO ref_perfil_atuacao (nome) VALUES ('Perfil Duplicado CAT-07'), ('Perfil Duplicado CAT-07');`,
      "23505"
    );
  });

  it("CAT-08: ref_pilar_insight.codigo is UNIQUE", async () => {
    await expectSqlError(
      `INSERT INTO ref_pilar_insight (codigo, nome) VALUES ('dup_cat08', 'Pilar A CAT-08'), ('dup_cat08', 'Pilar B CAT-08');`,
      "23505"
    );
  });

  it("CAT-08: ref_pilar_insight.nome is UNIQUE (distinta da UNIQUE de codigo)", async () => {
    await expectSqlError(
      `INSERT INTO ref_pilar_insight (codigo, nome) VALUES ('cat08_codigo_a', 'Pilar Duplicado CAT-08'), ('cat08_codigo_b', 'Pilar Duplicado CAT-08');`,
      "23505"
    );
  });

  // -- CAT-09: ref_indicador -------------------------------------------------

  it("CAT-09: ck_indicador_peso rejects a negative peso_iip", async () => {
    await expectSqlError(
      `INSERT INTO ref_indicador (nome, peso_iip) VALUES ('Indicador Teste CAT-09', -1);`,
      "23514"
    );
  });

  it("CAT-09: ref_indicador.nome is UNIQUE", async () => {
    await expectSqlError(
      `INSERT INTO ref_indicador (nome, peso_iip) VALUES ('Indicador Dup CAT-09', 1), ('Indicador Dup CAT-09', 2);`,
      "23505"
    );
  });

  // -- CAT-10: ref_nivel_iip -------------------------------------------------

  it("CAT-10: ref_nivel_iip.codigo is a natural TEXT PRIMARY KEY (rejects duplicate)", async () => {
    await runSql(`
      INSERT INTO ref_nivel_iip (codigo, rotulo, valor, ordem) VALUES ('teste_cat10', 'Teste CAT-10', 9, 9)
      ON CONFLICT (codigo) DO NOTHING;
    `);
    await expectSqlError(
      `INSERT INTO ref_nivel_iip (codigo, rotulo, valor, ordem) VALUES ('teste_cat10', 'Outro rótulo', 8, 8);`,
      "23505"
    );
    await runSql(`DELETE FROM ref_nivel_iip WHERE codigo = 'teste_cat10';`);
  });

  it("CAT-10: ck_nivel_valor rejects a negative valor", async () => {
    await expectSqlError(
      `INSERT INTO ref_nivel_iip (codigo, rotulo, valor, ordem) VALUES ('teste_cat10_neg', 'Teste', -1, 1);`,
      "23514"
    );
  });

  // -- CAT-11: ref_tipologia -------------------------------------------------

  it("CAT-11: uq_tipologia_tripla rejects a duplicate (grupo, tipologia, estado)", async () => {
    await runSql(`
      INSERT INTO ref_tipologia (grupo, tipologia, estado) VALUES ('G-CAT11', 'T-CAT11', 'E-CAT11')
      ON CONFLICT (grupo, tipologia, estado) DO NOTHING;
    `);
    await expectSqlError(
      `INSERT INTO ref_tipologia (grupo, tipologia, estado) VALUES ('G-CAT11', 'T-CAT11', 'E-CAT11');`,
      "23505"
    );
    await runSql(`DELETE FROM ref_tipologia WHERE grupo = 'G-CAT11';`);
  });

  it("CAT-11: ck_tipologia_preditores rejects id_preditor_2 = id_preditor_1", async () => {
    await expectSqlError(
      `INSERT INTO ref_tipologia (grupo, tipologia, estado, id_preditor_1, id_preditor_2)
       VALUES ('G-CAT11b', 'T-CAT11b', 'E-CAT11b', ${idPreditorFixture}, ${idPreditorFixture});`,
      "23514"
    );
  });

  it("CAT-11: ref_tipologia.nivel_d1_padrao rejects a non-existent ref_nivel_iip.codigo", async () => {
    await expectSqlError(
      `INSERT INTO ref_tipologia (grupo, tipologia, estado, nivel_d1_padrao)
       VALUES ('G-CAT11c', 'T-CAT11c', 'E-CAT11c', 'codigo_inexistente');`,
      "23503"
    );
  });

  it("CAT-11: ref_tipologia.nivel_d2_padrao rejects a non-existent ref_nivel_iip.codigo", async () => {
    await expectSqlError(
      `INSERT INTO ref_tipologia (grupo, tipologia, estado, nivel_d2_padrao)
       VALUES ('G-CAT11d', 'T-CAT11d', 'E-CAT11d', 'codigo_inexistente');`,
      "23503"
    );
  });

  it("CAT-11: ref_tipologia.nivel_d3_padrao rejects a non-existent ref_nivel_iip.codigo", async () => {
    await expectSqlError(
      `INSERT INTO ref_tipologia (grupo, tipologia, estado, nivel_d3_padrao)
       VALUES ('G-CAT11e', 'T-CAT11e', 'E-CAT11e', 'codigo_inexistente');`,
      "23503"
    );
  });

  it("CAT-11: ref_tipologia.id_indicador rejects a non-existent FK", async () => {
    await expectSqlError(
      `INSERT INTO ref_tipologia (grupo, tipologia, estado, id_indicador)
       VALUES ('G-CAT11f', 'T-CAT11f', 'E-CAT11f', 999999999);`,
      "23503"
    );
  });

  it("CAT-11: ref_tipologia.id_preditor_1 rejects a non-existent FK", async () => {
    await expectSqlError(
      `INSERT INTO ref_tipologia (grupo, tipologia, estado, id_preditor_1)
       VALUES ('G-CAT11g', 'T-CAT11g', 'E-CAT11g', 999999999);`,
      "23503"
    );
  });

  // -- CAT-12: ref_dimensao_gip -----------------------------------------------

  it("CAT-12: ck_dimensao_faixa rejects valor_max <= valor_min", async () => {
    await expectSqlError(
      `INSERT INTO ref_dimensao_gip (codigo, nome, valor_min, valor_max, ordem)
       VALUES ('teste_cat12', 'Teste CAT-12', 4, 4, 99);`,
      "23514"
    );
  });

  it("CAT-12: ref_dimensao_gip.codigo is UNIQUE", async () => {
    await expectSqlError(
      `INSERT INTO ref_dimensao_gip (codigo, nome, ordem) VALUES ('dup_cat12', 'A', 1), ('dup_cat12', 'B', 2);`,
      "23505"
    );
  });

  // -- Idempotência (AC17): a migração de estrutura pode ser reaplicada -----

  it("AC17: all 12 tables still exist with relkind='r' (CREATE TABLE IF NOT EXISTS is a safe no-op)", async () => {
    // Uma única query em lote (em vez de 12 round-trips) -- evita o timeout
    // de 30s do runner de integração, que paga o custo de spawn de processo
    // por chamada (ver supabase/tests/helpers/sql.ts).
    const rows = await runSql<{ relname: string }>(`
      SELECT relname FROM pg_class
       WHERE relkind = 'r' AND relname = ANY(ARRAY[${TABELAS_NOVAS.map((t) => `'${t}'`).join(",")}]);
    `);
    expect(rows.map((r) => r.relname).sort()).toEqual([...TABELAS_NOVAS].sort());
  });
});
