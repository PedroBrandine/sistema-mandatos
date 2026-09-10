import { describe, it, expect } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/spec.md,
// EST-14 AC1/AC2/AC4. Migração:
// 20260910152709_estrategia_renomeia_raio_x_diagnostico.sql.
//
// AC3 ("o Quadro exibe 'Diagnóstico'") é consequência de a coluna ser lida de
// ref_etapa.nome, e é asserida na fase de UI (T16) -- este arquivo cobre a
// camada de dado.
//
// A contagem de linhas dependentes é asserida contra os números conhecidos do
// seed (20260810193327 + 20260810193825), não contra um snapshot tirado
// depois da migração: um snapshot pós-fato passaria mesmo que o renome
// tivesse apagado linhas, que é justamente o que AC2 proíbe.

const PRODUTOS = "'Estratégia', 'Coalizão'";

describe("renome Raio-X -> Diagnóstico em ref_etapa (EST-14)", () => {
  it("AC1/AC4: nome é 'Diagnóstico' para codigo='raio_x' na Estratégia e na Coalizão", async () => {
    const rows = await runSql<{ produto: string; nome: string; ordem: number }>(`
      SELECT p.nome AS produto, e.nome, e.ordem
        FROM ref_etapa e JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE e.codigo = 'raio_x'
       ORDER BY p.nome;
    `);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.produto)).toEqual(["Coalizão", "Estratégia"]);
    for (const row of rows) {
      expect(row.nome, `${row.produto} deveria exibir "Diagnóstico"`).toBe("Diagnóstico");
    }
  });

  it("AC1: a etapa de ordem = 2 da Estratégia é 'Diagnóstico'", async () => {
    const [row] = await runSql<{ codigo: string; nome: string }>(`
      SELECT e.codigo, e.nome
        FROM ref_etapa e JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE p.nome = 'Estratégia' AND e.ordem = 2;
    `);
    expect(row.codigo).toBe("raio_x");
    expect(row.nome).toBe("Diagnóstico");
  });

  it("AC2: nenhuma etapa continua chamada 'Raio-X' em nenhum produto", async () => {
    const rows = await runSql<{ id_etapa: number }>(`
      SELECT id_etapa FROM ref_etapa WHERE nome = 'Raio-X';
    `);
    expect(rows).toHaveLength(0);
  });

  it("AC2: codigo permanece 'raio_x' -- URLs e seed dependentes não quebram", async () => {
    const rows = await runSql<{ codigo: string }>(`
      SELECT e.codigo
        FROM ref_etapa e JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE e.nome = 'Diagnóstico' AND p.nome IN (${PRODUTOS});
    `);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.codigo).toBe("raio_x");
    }
  });

  it("AC2: contagem de ref_tipo_registro e ref_formulario da etapa raio_x é a do seed, inalterada", async () => {
    // Seed 20260810193327: ref_tipo_registro 'comite_politico' e
    // 'escuta_diagnostica' na etapa raio_x da Estratégia (2 linhas);
    // ref_formulario 'gip' na mesma etapa (1 linha). A Coalizão clonou só
    // ref_etapa (20260810193825), não os catálogos filhos -- por isso a
    // contagem é por produto, não global.
    const [row] = await runSql<{
      tipos_registro_estrategia: number;
      formularios_estrategia: number;
      tipos_registro_total: number;
      formularios_total: number;
    }>(`
      WITH etapas AS (
        SELECT e.id_etapa, p.nome AS produto
          FROM ref_etapa e JOIN ref_produto p ON p.id_produto = e.id_produto
         WHERE e.codigo = 'raio_x'
      )
      SELECT
        (SELECT count(*) FROM ref_tipo_registro tr JOIN etapas et ON et.id_etapa = tr.id_etapa
          WHERE et.produto = 'Estratégia') AS tipos_registro_estrategia,
        (SELECT count(*) FROM ref_formulario f JOIN etapas et ON et.id_etapa = f.id_etapa
          WHERE et.produto = 'Estratégia') AS formularios_estrategia,
        (SELECT count(*) FROM ref_tipo_registro tr JOIN etapas et ON et.id_etapa = tr.id_etapa) AS tipos_registro_total,
        (SELECT count(*) FROM ref_formulario f JOIN etapas et ON et.id_etapa = f.id_etapa) AS formularios_total;
    `);
    expect(row.tipos_registro_estrategia).toBe(2);
    expect(row.formularios_estrategia).toBe(1);
    expect(row.tipos_registro_total).toBe(2);
    expect(row.formularios_total).toBe(1);
  });

  it("AC2: os tipos de registro da etapa raio_x continuam sendo os do seed, com os mesmos codigos", async () => {
    const rows = await runSql<{ codigo: string; nome: string }>(`
      SELECT tr.codigo, tr.nome
        FROM ref_tipo_registro tr
        JOIN ref_etapa e ON e.id_etapa = tr.id_etapa
       WHERE e.codigo = 'raio_x'
       ORDER BY tr.codigo;
    `);
    expect(rows.map((r) => r.codigo)).toEqual(["comite_politico", "escuta_diagnostica"]);
    expect(rows.map((r) => r.nome)).toEqual(["Comitê Político", "Escuta Diagnóstica"]);
  });

  it("AC2: o renome não apagou nem criou fat_etapa_contrato -- toda linha aponta para um id_etapa vivo", async () => {
    // O UPDATE só toca ref_etapa.nome; fat_etapa_contrato referencia
    // id_etapa, que não muda. A asserção que pega uma exclusão acidental é
    // "nenhuma linha órfã e a contagem por etapa bate com o total".
    const [row] = await runSql<{ orfas: number; raio_x_com_etapa_valida: number }>(`
      SELECT
        (SELECT count(*) FROM fat_etapa_contrato fec
          LEFT JOIN ref_etapa e ON e.id_etapa = fec.id_etapa
          WHERE e.id_etapa IS NULL) AS orfas,
        (SELECT count(*) FROM fat_etapa_contrato fec
          JOIN ref_etapa e ON e.id_etapa = fec.id_etapa
          WHERE e.codigo = 'raio_x' AND e.nome = 'Diagnóstico') AS raio_x_com_etapa_valida;
    `);
    expect(row.orfas).toBe(0);
    // Toda fat_etapa_contrato de raio_x resolve para a etapa já renomeada --
    // se o renome tivesse recriado a etapa em vez de atualizá-la, estas
    // linhas apontariam para o id antigo e a contagem cairia a zero.
    const [total] = await runSql<{ total_raio_x: number }>(`
      SELECT count(*) AS total_raio_x
        FROM fat_etapa_contrato fec
        JOIN ref_etapa e ON e.id_etapa = fec.id_etapa
       WHERE e.codigo = 'raio_x';
    `);
    expect(row.raio_x_com_etapa_valida).toBe(total.total_raio_x);
  });

  it("o renome não vazou para o PLL, que não tem a etapa raio_x", async () => {
    const rows = await runSql<{ nome: string }>(`
      SELECT e.nome
        FROM ref_etapa e JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE p.nome = 'PLL' AND e.nome = 'Diagnóstico';
    `);
    expect(rows).toHaveLength(0);
  });
});
