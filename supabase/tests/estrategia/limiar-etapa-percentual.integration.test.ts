import { describe, it, expect } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/spec.md,
// EST-06/EST-07 + AD-045 (.specs/STATE.md): o limiar de atraso de etapa é
// percentual da duração prevista da própria etapa -- Atenção a 70%, Atrasado
// a 100%. Migração: 20260910201447_estrategia_limiar_etapa_percentual.sql.
//
// A não-regressão de vw_pendencias (os dois limiares em dias continuam
// intactos) é asserida em vw-pendencias-limiar.integration.test.ts e em
// visao-gerencial/vw-pendencias.integration.test.ts, que rodam inalterados --
// este arquivo cobre o que é novo: as duas bases de limiar e a derivação em
// dias a partir de ref_etapa.duracao_prevista_dias.

const TABELA = "ref_limiar_pendencia";

async function expectSqlError(sql: string, errcode: string): Promise<void> {
  try {
    await runSql(sql);
    throw new Error("expected query to fail but it succeeded");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain(errcode);
  }
}

describe("limiar de etapa como percentual da duração prevista (AD-045)", () => {
  it("AD-045: etapa_atencao = 70% e etapa_atrasado = 100%, expressos em pct_duracao_etapa e não em dias", async () => {
    const rows = await runSql<{
      codigo: string;
      dias: number | null;
      pct_duracao_etapa: number;
    }>(`
      SELECT codigo, dias, pct_duracao_etapa FROM ${TABELA}
       WHERE codigo IN ('etapa_atencao', 'etapa_atrasado')
       ORDER BY codigo;
    `);
    expect(rows).toEqual([
      { codigo: "etapa_atencao", dias: null, pct_duracao_etapa: 70 },
      { codigo: "etapa_atrasado", dias: null, pct_duracao_etapa: 100 },
    ]);
  });

  it("os limiares sem etapa de referência seguem em dias absolutos, com pct nulo", async () => {
    const rows = await runSql<{
      codigo: string;
      dias: number;
      pct_duracao_etapa: number | null;
    }>(`
      SELECT codigo, dias, pct_duracao_etapa FROM ${TABELA}
       WHERE codigo IN ('formulario_aberto', 'sem_registro_recente')
       ORDER BY codigo;
    `);
    expect(rows).toEqual([
      { codigo: "formulario_aberto", dias: 30, pct_duracao_etapa: null },
      { codigo: "sem_registro_recente", dias: 45, pct_duracao_etapa: null },
    ]);
  });

  it("ck_limiar_base: uma linha com as DUAS bases preenchidas é recusada (23514) -- nenhum número ambíguo", async () => {
    await expectSqlError(
      `INSERT INTO ${TABELA} (codigo, nome, dias, pct_duracao_etapa)
       VALUES ('ck_base_ambas_teste', 'dias e pct juntos', 10, 50);`,
      "23514",
    );
  });

  it("ck_limiar_base: uma linha com NENHUMA das bases preenchidas é recusada (23514) -- unidade nunca fica implícita", async () => {
    await expectSqlError(
      `INSERT INTO ${TABELA} (codigo, nome) VALUES ('ck_base_nenhuma_teste', 'sem base');`,
      "23514",
    );
  });

  it("ck_limiar_base aceita cada base sozinha", async () => {
    try {
      const linhas = await runSql<{ codigo: string }>(`
        INSERT INTO ${TABELA} (codigo, nome, dias, pct_duracao_etapa) VALUES
          ('ck_base_so_dias_teste', 'só dias', 7, NULL),
          ('ck_base_so_pct_teste',  'só pct',  NULL, 50)
        RETURNING codigo;
      `);
      expect(linhas.map((l) => l.codigo).sort()).toEqual([
        "ck_base_so_dias_teste",
        "ck_base_so_pct_teste",
      ]);
    } finally {
      await runSql(
        `DELETE FROM ${TABELA} WHERE codigo IN ('ck_base_so_dias_teste', 'ck_base_so_pct_teste');`,
      );
    }
  });

  it("ck_limiar_pct recusa percentual zero e negativo (23514)", async () => {
    await expectSqlError(
      `INSERT INTO ${TABELA} (codigo, nome, pct_duracao_etapa) VALUES ('ck_pct_zero_teste', 'pct = 0', 0);`,
      "23514",
    );
    await expectSqlError(
      `INSERT INTO ${TABELA} (codigo, nome, pct_duracao_etapa) VALUES ('ck_pct_neg_teste', 'pct < 0', -1);`,
      "23514",
    );
  });

  it("AD-045: o limiar em dias de cada etapa é derivável da tabela, sem número em código -- Atrasado bate com a duração prevista e Atenção fica abaixo dela", async () => {
    // Nenhum percentual nem duração aparece nesta query: os dois lados vêm
    // de ref_limiar_pendencia e ref_etapa (AD-004).
    const rows = await runSql<{
      codigo_etapa: string;
      duracao: number;
      dias_atencao: string;
      dias_atrasado: string;
    }>(`
      SELECT e.codigo AS codigo_etapa,
             e.duracao_prevista_dias AS duracao,
             (e.duracao_prevista_dias * (SELECT pct_duracao_etapa FROM ${TABELA} WHERE codigo = 'etapa_atencao') / 100.0) AS dias_atencao,
             (e.duracao_prevista_dias * (SELECT pct_duracao_etapa FROM ${TABELA} WHERE codigo = 'etapa_atrasado') / 100.0) AS dias_atrasado
        FROM ref_etapa e
        JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE p.nome = 'Estratégia' AND e.duracao_prevista_dias IS NOT NULL
       ORDER BY e.ordem;
    `);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      // 100% da duração = a própria duração prevista.
      expect(Number(row.dias_atrasado), `etapa ${row.codigo_etapa}`).toBe(row.duracao);
      // Atenção dispara antes de Atrasado, e nunca em zero ou antes do início.
      expect(Number(row.dias_atencao), `etapa ${row.codigo_etapa}`).toBeGreaterThan(0);
      expect(Number(row.dias_atencao), `etapa ${row.codigo_etapa}`).toBeLessThan(
        Number(row.dias_atrasado),
      );
    }
  });

  it("AD-045: o mesmo percentual produz limiares diferentes por etapa -- é isso que o absoluto não fazia", async () => {
    // Monitoramento (duração longa) e Pontapé (curta) não podem cair no mesmo
    // corte em dias: é a razão de existir da decisão.
    const rows = await runSql<{ codigo_etapa: string; dias_atrasado: number }>(`
      SELECT e.codigo AS codigo_etapa,
             (e.duracao_prevista_dias * (SELECT pct_duracao_etapa FROM ${TABELA} WHERE codigo = 'etapa_atrasado') / 100)::int AS dias_atrasado
        FROM ref_etapa e
        JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE p.nome = 'Estratégia' AND e.codigo IN ('pontape', 'monitoramento')
       ORDER BY e.codigo;
    `);
    expect(rows).toHaveLength(2);
    const porEtapa = Object.fromEntries(rows.map((r) => [r.codigo_etapa, r.dias_atrasado]));
    expect(porEtapa.monitoramento).toBeGreaterThan(porEtapa.pontape);
  });

  it("etapa sem duracao_prevista_dias não produz limiar -- não é classificável (AD-045/AD-005)", async () => {
    const [row] = await runSql<{ derivado: string | null }>(`
      SELECT (NULL::smallint * (SELECT pct_duracao_etapa FROM ${TABELA} WHERE codigo = 'etapa_atrasado') / 100.0) AS derivado;
    `);
    expect(row.derivado).toBeNull();
  });

  it("editar o percentual muda o limiar derivado sem deploy (AD-004)", async () => {
    try {
      const [antes] = await runSql<{ dias_atencao: string }>(`
        SELECT (e.duracao_prevista_dias * (SELECT pct_duracao_etapa FROM ${TABELA} WHERE codigo = 'etapa_atencao') / 100.0) AS dias_atencao
          FROM ref_etapa e JOIN ref_produto p ON p.id_produto = e.id_produto
         WHERE p.nome = 'Estratégia' AND e.codigo = 'monitoramento';
      `);

      await runSql(
        `UPDATE ${TABELA} SET pct_duracao_etapa = 50 WHERE codigo = 'etapa_atencao';`,
      );

      const [depois] = await runSql<{ dias_atencao: string }>(`
        SELECT (e.duracao_prevista_dias * (SELECT pct_duracao_etapa FROM ${TABELA} WHERE codigo = 'etapa_atencao') / 100.0) AS dias_atencao
          FROM ref_etapa e JOIN ref_produto p ON p.id_produto = e.id_produto
         WHERE p.nome = 'Estratégia' AND e.codigo = 'monitoramento';
      `);
      expect(Number(depois.dias_atencao)).toBeLessThan(Number(antes.dias_atencao));
    } finally {
      await runSql(
        `UPDATE ${TABELA} SET pct_duracao_etapa = 70 WHERE codigo = 'etapa_atencao';`,
      );
    }

    const [restaurado] = await runSql<{ pct: number }>(
      `SELECT pct_duracao_etapa AS pct FROM ${TABELA} WHERE codigo = 'etapa_atencao';`,
    );
    expect(restaurado.pct).toBe(70);
  });

  it("vw_pendencias sobreviveu à mudança de forma: continua lendo a tabela e sem literal de intervalo", async () => {
    const [row] = await runSql<{ definicao: string }>(`
      SELECT pg_get_viewdef('vw_pendencias'::regclass, true) AS definicao;
    `);
    expect(row.definicao).toContain("ref_limiar_pendencia");
    expect(row.definicao).not.toMatch(/interval\s+'[^']*\bday/i);
  });
});
