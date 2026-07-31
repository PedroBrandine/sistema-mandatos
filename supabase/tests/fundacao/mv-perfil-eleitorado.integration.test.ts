import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: T7 Done-when (tasks.md) / CAD-11 (spec.md P1 "perfil TSE") --
//  - tse.mv_perfil_eleitorado_candidatura existe em pg_matviews, com índice
//  - GRANT SELECT explícito pra legisla_app/legisla_admin/legisla_gestora
//  - Agregação correta com dado seedado: candidatura com votos em 2
//    municípios escolhe o de mais votos como principal, e a soma de
//    qt_eleitores por dimensão (genero/faixa_etaria/grau_escolaridade) bate.

// Chave de teste isolada de dado real: ano_eleicao=2026 não existe em
// nenhuma safra carregada (2022/2024), então cai na partição DEFAULT
// ("outras") de fat_votacao_zona e dim_perfil_eleitorado sem colidir com
// nenhum município/candidatura real.
const ANO_TESTE = 2026;
const SQ_CANDIDATO_TESTE = -900001;
const NR_TURNO_TESTE = 1;
const CD_ELEICAO_TESTE = 1;
const MUNICIPIO_PRINCIPAL = 2; // mais votos (300) -- deve ser o escolhido
const MUNICIPIO_SECUNDARIO = 1; // menos votos (100) -- deve ser ignorado

describe("T7 -- tse.mv_perfil_eleitorado_candidatura", () => {
  it("creates the materialized view with its UNIQUE index", async () => {
    const rows = await runSql<{ matviewname: string }>(`
      SELECT matviewname FROM pg_matviews
       WHERE schemaname = 'tse' AND matviewname = 'mv_perfil_eleitorado_candidatura';
    `);
    expect(rows).toHaveLength(1);

    const idx = await runSql<{ indexname: string }>(`
      SELECT indexname FROM pg_indexes
       WHERE schemaname = 'tse' AND indexname = 'uq_mv_perfil_eleitorado_candidatura';
    `);
    expect(idx).toHaveLength(1);
  });

  it("grants SELECT to legisla_app, legisla_admin, legisla_gestora specifically on this view", async () => {
    const rows = await runSql<{ role: string; pode_selecionar: boolean }>(`
      SELECT role, has_table_privilege(role, 'tse.mv_perfil_eleitorado_candidatura', 'SELECT') AS pode_selecionar
      FROM unnest(ARRAY['legisla_app', 'legisla_admin', 'legisla_gestora']) AS role;
    `);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.pode_selecionar).toBe(true);
    }
  });

  describe("agregação com dado seedado", () => {
    beforeAll(async () => {
      // Votação: candidatura de teste recebe mais votos no município 2 do
      // que no município 1 -- município 2 deve ser escolhido como principal.
      await runSql(`
        INSERT INTO tse.fat_votacao_zona
          (ano_eleicao, cd_eleicao, nr_turno, sq_candidato, cd_municipio, nm_municipio, nr_zona, qt_votos_nominais_validos)
        VALUES
          (${ANO_TESTE}, ${CD_ELEICAO_TESTE}, ${NR_TURNO_TESTE}, ${SQ_CANDIDATO_TESTE}, ${MUNICIPIO_SECUNDARIO}, 'Municipio Teste 1', 1, 100),
          (${ANO_TESTE}, ${CD_ELEICAO_TESTE}, ${NR_TURNO_TESTE}, ${SQ_CANDIDATO_TESTE}, ${MUNICIPIO_PRINCIPAL}, 'Municipio Teste 2', 1, 300);
      `);

      // Perfil do eleitorado: 3 linhas no município principal (soma por
      // dimensão precisa somar 2 delas quando a categoria repete) + 1 linha
      // "isca" no município secundário com um valor bem maior (9999), que a
      // view NÃO pode incluir se a escolha do município principal estiver certa.
      await runSql(`
        INSERT INTO tse.dim_perfil_eleitorado
          (ano_eleicao, cd_municipio, ds_genero, ds_faixa_etaria, ds_grau_escolaridade, qt_eleitores)
        VALUES
          (${ANO_TESTE}, ${MUNICIPIO_PRINCIPAL}, 'FEMININO', '25 a 34 anos', 'ENSINO MEDIO COMPLETO', 50),
          (${ANO_TESTE}, ${MUNICIPIO_PRINCIPAL}, 'FEMININO', '35 a 44 anos', 'ENSINO FUNDAMENTAL COMPLETO', 20),
          (${ANO_TESTE}, ${MUNICIPIO_PRINCIPAL}, 'MASCULINO', '25 a 34 anos', 'ENSINO MEDIO COMPLETO', 30),
          (${ANO_TESTE}, ${MUNICIPIO_SECUNDARIO}, 'FEMININO', '25 a 34 anos', 'ENSINO MEDIO COMPLETO', 9999);
      `);

      // WITH NO DATA na criação -- precisa de um REFRESH pra existir dado
      // consultável (mesmo comportamento de tse.mv_candidatura_resumo).
      await runSql(`REFRESH MATERIALIZED VIEW tse.mv_perfil_eleitorado_candidatura;`);
    });

    afterAll(async () => {
      await runSql(`DELETE FROM tse.fat_votacao_zona WHERE ano_eleicao = ${ANO_TESTE} AND sq_candidato = ${SQ_CANDIDATO_TESTE};`);
      await runSql(`DELETE FROM tse.dim_perfil_eleitorado WHERE ano_eleicao = ${ANO_TESTE} AND cd_municipio IN (${MUNICIPIO_PRINCIPAL}, ${MUNICIPIO_SECUNDARIO});`);
      await runSql(`REFRESH MATERIALIZED VIEW tse.mv_perfil_eleitorado_candidatura;`);
    });

    it("picks the municipality with more votes (município 2, 300 > 100) as the principal", async () => {
      const rows = await runSql<{ categoria: string; qt_eleitores: number }>(`
        SELECT categoria, qt_eleitores FROM tse.mv_perfil_eleitorado_candidatura
         WHERE ano_eleicao = ${ANO_TESTE} AND sq_candidato = ${SQ_CANDIDATO_TESTE}
           AND nr_turno = ${NR_TURNO_TESTE} AND dimensao = 'genero'
         ORDER BY categoria;
      `);
      // O valor "isca" (9999) do município secundário nunca pode aparecer --
      // prova de que o município escolhido foi o principal (mais votos).
      for (const row of rows) {
        expect(Number(row.qt_eleitores)).not.toBe(9999);
      }
    });

    it("sums qt_eleitores correctly per category within the 'genero' dimension", async () => {
      const rows = await runSql<{ categoria: string; qt_eleitores: number }>(`
        SELECT categoria, qt_eleitores FROM tse.mv_perfil_eleitorado_candidatura
         WHERE ano_eleicao = ${ANO_TESTE} AND sq_candidato = ${SQ_CANDIDATO_TESTE}
           AND nr_turno = ${NR_TURNO_TESTE} AND dimensao = 'genero'
         ORDER BY categoria;
      `);
      expect(rows).toEqual([
        { categoria: "FEMININO", qt_eleitores: 70 },
        { categoria: "MASCULINO", qt_eleitores: 30 },
      ]);
    });

    it("sums qt_eleitores correctly per category within the 'faixa_etaria' dimension", async () => {
      const rows = await runSql<{ categoria: string; qt_eleitores: number }>(`
        SELECT categoria, qt_eleitores FROM tse.mv_perfil_eleitorado_candidatura
         WHERE ano_eleicao = ${ANO_TESTE} AND sq_candidato = ${SQ_CANDIDATO_TESTE}
           AND nr_turno = ${NR_TURNO_TESTE} AND dimensao = 'faixa_etaria'
         ORDER BY categoria;
      `);
      expect(rows).toEqual([
        { categoria: "25 a 34 anos", qt_eleitores: 80 },
        { categoria: "35 a 44 anos", qt_eleitores: 20 },
      ]);
    });

    it("sums qt_eleitores correctly per category within the 'grau_escolaridade' dimension", async () => {
      const rows = await runSql<{ categoria: string; qt_eleitores: number }>(`
        SELECT categoria, qt_eleitores FROM tse.mv_perfil_eleitorado_candidatura
         WHERE ano_eleicao = ${ANO_TESTE} AND sq_candidato = ${SQ_CANDIDATO_TESTE}
           AND nr_turno = ${NR_TURNO_TESTE} AND dimensao = 'grau_escolaridade'
         ORDER BY categoria;
      `);
      expect(rows).toEqual([
        { categoria: "ENSINO FUNDAMENTAL COMPLETO", qt_eleitores: 20 },
        { categoria: "ENSINO MEDIO COMPLETO", qt_eleitores: 80 },
      ]);
    });
  });
});
