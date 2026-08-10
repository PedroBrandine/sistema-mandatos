import { describe, it, expect } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/catalogos-referencia/spec.md, CAT-15/CAT-17 +
// Success Criteria (contagem exata de linha por tabela). Seed verbatim de
// docs/schema_sistema.sql:2178-2316 (9 tabelas) + :2254-2259 (clonagem
// Coalizão, D9). Migrações: 20260810193327_catalogos_referencia_seed.sql
// (T3) e a próxima de T4 (seed_coalizao).

describe("Catálogos de Referência -- seed do conteúdo aprovado (CAT-15)", () => {
  it("CAT-15 AC1: ref_nivel_iip tem baixo/medio/alto com valor 1/2/3 e ordem 1/2/3", async () => {
    // valor é NUMERIC(5,2) -- via `supabase db query --linked` (Management
    // API) volta como string formatada com 2 casas ("1.00"), diferente do
    // path local (runSqlLocal normaliza por OID, ver helpers/sql.ts). O
    // schema aprovado declara NUMERIC, não INTEGER -- "1.00" é a
    // representação correta do tipo, não um workaround.
    const rows = await runSql<{ codigo: string; rotulo: string; valor: string; ordem: number }>(`
      SELECT codigo, rotulo, valor, ordem FROM ref_nivel_iip ORDER BY ordem;
    `);
    expect(rows).toHaveLength(3);
    expect(rows).toEqual([
      { codigo: "baixo", rotulo: "Baixo", valor: "1.00", ordem: 1 },
      { codigo: "medio", rotulo: "Médio", valor: "2.00", ordem: 2 },
      { codigo: "alto", rotulo: "Alto", valor: "3.00", ordem: 3 },
    ]);
  });

  it("CAT-15 AC2: ref_preditor tem os 5 preditores do GIP na ordem aprovada", async () => {
    const rows = await runSql<{ nome: string; ordem: number }>(`
      SELECT nome, ordem FROM ref_preditor
       WHERE nome IN (
         'Priorizam sua Agenda', 'Pautam os Debates',
         'Ocupam lugar nos espaços de decisão', 'Constroem Partido',
         'Articulam e mobilizam para a entrega de resultados'
       )
       ORDER BY ordem;
    `);
    expect(rows.map((r) => r.nome)).toEqual([
      "Priorizam sua Agenda",
      "Pautam os Debates",
      "Ocupam lugar nos espaços de decisão",
      "Constroem Partido",
      "Articulam e mobilizam para a entrega de resultados",
    ]);
    expect(rows.map((r) => r.ordem)).toEqual([1, 2, 3, 4, 5]);
  });

  it("CAT-15 AC3: ref_perfil_atuacao tem Fiscalizadora/Legisladora/Articuladora-Mobilizadora", async () => {
    const rows = await runSql<{ nome: string }>(`SELECT nome FROM ref_perfil_atuacao ORDER BY ordem;`);
    expect(rows.map((r) => r.nome)).toEqual(["Fiscalizadora", "Legisladora", "Articuladora/Mobilizadora"]);
  });

  it("CAT-15 AC4: ref_pilar_insight tem os 4 pilares confirmados pela decisão D5", async () => {
    const rows = await runSql<{ codigo: string }>(`SELECT codigo FROM ref_pilar_insight ORDER BY ordem;`);
    expect(rows.map((r) => r.codigo)).toEqual([
      "contexto_sociopolitico",
      "incidencia_politica",
      "desafio_problema",
      "conquistas_praticas",
    ]);
  });

  it("CAT-15 AC5: ref_dimensao_gip tem as 4 dimensões, faixa 1-4", async () => {
    const rows = await runSql<{ codigo: string; valor_min: number; valor_max: number }>(`
      SELECT codigo, valor_min, valor_max FROM ref_dimensao_gip ORDER BY ordem;
    `);
    expect(rows.map((r) => r.codigo)).toEqual([
      "qualidade_planejamento",
      "atingimento_planejamento",
      "capacidade_gestao",
      "autonomia_metodologia",
    ]);
    for (const row of rows) {
      expect(row.valor_min).toBe(1);
      expect(row.valor_max).toBe(4);
    }
  });

  it("CAT-15 AC6: ref_etapa tem exatamente 7 etapas de Estratégia e 5 de PLL (12, sem Coalizão ainda)", async () => {
    const rows = await runSql<{ nome_produto: string; qtd: number }>(`
      SELECT p.nome AS nome_produto, count(*)::int AS qtd
        FROM ref_etapa e JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE p.nome IN ('Estratégia', 'PLL')
       GROUP BY p.nome ORDER BY p.nome;
    `);
    expect(rows).toEqual([
      { nome_produto: "Estratégia", qtd: 7 },
      { nome_produto: "PLL", qtd: 5 },
    ]);
  });

  it("CAT-15 AC7: ref_tipo_registro tem os 11 tipos derivados, todos vinculados a uma etapa semeada", async () => {
    const [{ qtd }] = await runSql<{ qtd: number }>(`
      SELECT count(*)::int AS qtd FROM ref_tipo_registro tr
       WHERE tr.codigo IN (
         'pontape','comite_politico','escuta_diagnostica','imersao','sprint',
         'diagnostico_organograma','organograma','monitoramento','replicacao',
         'legisla_aliada','mentoria'
       );
    `);
    expect(qtd).toBe(11);
  });

  it("CAT-15 AC8: ref_formulario tem os 16 formulários, cada um vinculado à sua etapa", async () => {
    const rows = await runSql<{ qtd: number; sem_etapa: number }>(`
      SELECT count(*)::int AS qtd,
             count(*) FILTER (WHERE id_etapa IS NULL)::int AS sem_etapa
        FROM ref_formulario;
    `);
    expect(rows[0].qtd).toBe(16);
    expect(rows[0].sem_etapa).toBe(0);
  });

  it("CAT-15 AC9: ref_metrica_formulario tem 1 métrica NPS por formulário 'avaliacao%'", async () => {
    const rows = await runSql<{ total_avaliacao: number; total_nps: number }>(`
      SELECT
        (SELECT count(*)::int FROM ref_formulario WHERE codigo LIKE 'avaliacao%') AS total_avaliacao,
        (SELECT count(*)::int FROM ref_metrica_formulario WHERE eh_nps) AS total_nps;
    `);
    expect(rows[0].total_nps).toBe(rows[0].total_avaliacao);
    expect(rows[0].total_avaliacao).toBeGreaterThan(0);
  });

  it("CAT-15 AC10: reaplicar o INSERT de ref_nivel_iip não duplica (ON CONFLICT DO NOTHING)", async () => {
    await runSql(`
      INSERT INTO ref_nivel_iip (codigo, rotulo, valor, ordem) VALUES
        ('baixo', 'Baixo', 1, 1), ('medio', 'Médio', 2, 2), ('alto', 'Alto', 3, 3)
      ON CONFLICT (codigo) DO NOTHING;
    `);
    const [{ qtd }] = await runSql<{ qtd: number }>(`SELECT count(*)::int AS qtd FROM ref_nivel_iip;`);
    expect(qtd).toBe(3);
  });
});

describe("Catálogos de Referência -- régua da Coalizão clonada da Estratégia (D9, CAT-17)", () => {
  it("CAT-17 AC1/Independent Test: Coalizão tem as mesmas 7 etapas da Estratégia, nomes e ordem idênticos", async () => {
    const rows = await runSql<{ produto: string; codigo: string; nome: string; ordem: number }>(`
      SELECT p.nome AS produto, e.codigo, e.nome, e.ordem
        FROM ref_etapa e JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE p.nome IN ('Estratégia', 'Coalizão')
       ORDER BY p.nome, e.ordem;
    `);
    const estrategia = rows.filter((r) => r.produto === "Estratégia");
    const coalizao = rows.filter((r) => r.produto === "Coalizão");
    expect(estrategia).toHaveLength(7);
    expect(coalizao).toHaveLength(7);
    expect(coalizao.map(({ produto, ...resto }) => resto)).toEqual(
      estrategia.map(({ produto, ...resto }) => resto)
    );
  });

  it("CAT-17 AC2: reaplicar o INSERT de clonagem não duplica (ON CONFLICT DO NOTHING)", async () => {
    await runSql(`
      INSERT INTO ref_etapa (id_produto, codigo, nome, ordem, duracao_prevista_dias, gera_registro)
      SELECT (SELECT id_produto FROM ref_produto WHERE nome = 'Coalizão'),
             e.codigo, e.nome, e.ordem, e.duracao_prevista_dias, e.gera_registro
        FROM ref_etapa e JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE p.nome = 'Estratégia'
      ON CONFLICT (id_produto, codigo) DO NOTHING;
    `);
    const [{ qtd }] = await runSql<{ qtd: number }>(`
      SELECT count(*)::int AS qtd FROM ref_etapa e
        JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE p.nome = 'Coalizão';
    `);
    expect(qtd).toBe(7);
  });

  it("CAT-17 AC3: Estratégia e PLL continuam com suas 7/5 linhas, sem regressão", async () => {
    const rows = await runSql<{ produto: string; qtd: number }>(`
      SELECT p.nome AS produto, count(*)::int AS qtd
        FROM ref_etapa e JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE p.nome IN ('Estratégia', 'PLL')
       GROUP BY p.nome ORDER BY p.nome;
    `);
    expect(rows).toEqual([
      { produto: "Estratégia", qtd: 7 },
      { produto: "PLL", qtd: 5 },
    ]);
  });
});
