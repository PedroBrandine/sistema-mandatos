import { describe, it, expect } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/catalogos-referencia/spec.md, CAT-15/CAT-17 +
// Success Criteria (contagem exata de linha por tabela). Seed verbatim de
// docs/schema_sistema.sql:2178-2316 (9 tabelas) + :2254-2259 (clonagem
// Coalizão, D9). Migrações: 20260810193327_catalogos_referencia_seed.sql
// (T3) e a próxima de T4 (seed_coalizao).
//
// Contagens de ref_etapa/ref_formulario corrigidas nesta sessão (achado de
// UAT em kanban-etapas, 2026-08-12): 'cadastro' (Estratégia/Coalizão) e
// 'recrutamento'/'selecao' (PLL) não são etapas reais da régua -- removidas
// por 20260812163617_kanban_etapas_correcao_ref_etapa.sql. Os 3 formulários
// de recrutamento/selecao foram reatribuídos pro Pontapé do PLL (não
// apagados), então a contagem de ref_formulario (16) não muda.
//
// ref_nivel_iip ganha um 4º código, 'maximo' (valor=4, ordem=4), por
// incidencia-encontros T1 (Assumption #1a, confirmado com Pedro em
// 2026-08-13): o CSV real de ref_tipologia usa esse nível e a Trilha C só
// tinha seedado baixo/medio/alto. Migration forward-only, nunca edita o
// seed original de CAT-15 -- as 2 asserções abaixo (nascidas antes da
// existência de 'maximo') são as únicas desta suíte atualizadas por essa
// mudança intencional.

describe("Catálogos de Referência -- seed do conteúdo aprovado (CAT-15)", () => {
  it("CAT-15 AC1: ref_nivel_iip tem baixo/medio/alto/maximo com valor 1/2/3/4 e ordem 1/2/3/4", async () => {
    // valor é NUMERIC(5,2) -- via `supabase db query --linked` (Management
    // API) volta como string formatada com 2 casas ("1.00"), diferente do
    // path local (runSqlLocal normaliza por OID, ver helpers/sql.ts). O
    // schema aprovado declara NUMERIC, não INTEGER -- "1.00" é a
    // representação correta do tipo, não um workaround.
    const rows = await runSql<{ codigo: string; rotulo: string; valor: string; ordem: number }>(`
      SELECT codigo, rotulo, valor, ordem FROM ref_nivel_iip ORDER BY ordem;
    `);
    expect(rows).toHaveLength(4);
    expect(rows).toEqual([
      { codigo: "baixo", rotulo: "Baixo", valor: "1.00", ordem: 1 },
      { codigo: "medio", rotulo: "Médio", valor: "2.00", ordem: 2 },
      { codigo: "alto", rotulo: "Alto", valor: "3.00", ordem: 3 },
      { codigo: "maximo", rotulo: "Máximo", valor: "4.00", ordem: 4 },
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

  it("CAT-15 AC6: ref_etapa tem exatamente 6 etapas de Estratégia e 3 de PLL (9, sem Coalizão ainda)", async () => {
    const rows = await runSql<{ nome_produto: string; qtd: number }>(`
      SELECT p.nome AS nome_produto, count(*)::int AS qtd
        FROM ref_etapa e JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE p.nome IN ('Estratégia', 'PLL')
       GROUP BY p.nome ORDER BY p.nome;
    `);
    expect(rows).toEqual([
      { nome_produto: "Estratégia", qtd: 6 },
      { nome_produto: "PLL", qtd: 3 },
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
        ('baixo', 'Baixo', 1, 1), ('medio', 'Médio', 2, 2), ('alto', 'Alto', 3, 3),
        ('maximo', 'Máximo', 4, 4)
      ON CONFLICT (codigo) DO NOTHING;
    `);
    const [{ qtd }] = await runSql<{ qtd: number }>(`SELECT count(*)::int AS qtd FROM ref_nivel_iip;`);
    expect(qtd).toBe(4);
  });

  it("CAT-15 AC10 (extensão, Fix 8 do Verifier): reaplicar os outros 8 INSERTs de seed não duplica em nenhuma tabela", async () => {
    // A AC10 original só reaplicava ref_nivel_iip -- este teste reaplica
    // verbatim os 8 INSERTs restantes de
    // 20260810193327_catalogos_referencia_seed.sql, na mesma ordem, num
    // único round-trip multi-statement, e confirma que nenhuma tabela
    // duplicou linha.
    await runSql(`
      INSERT INTO ref_preditor (nome, ordem) VALUES
        ('Priorizam sua Agenda', 1),
        ('Pautam os Debates', 2),
        ('Ocupam lugar nos espaços de decisão', 3),
        ('Constroem Partido', 4),
        ('Articulam e mobilizam para a entrega de resultados', 5)
      ON CONFLICT (nome) DO NOTHING;

      INSERT INTO ref_perfil_atuacao (nome, ordem) VALUES
        ('Fiscalizadora', 1), ('Legisladora', 2), ('Articuladora/Mobilizadora', 3)
      ON CONFLICT (nome) DO NOTHING;

      INSERT INTO ref_pilar_insight (codigo, nome, ordem) VALUES
        ('contexto_sociopolitico', 'Contexto sociopolítico do mandato', 1),
        ('incidencia_politica',    'Incidência política (sugestão, recomendação, direcionamento)', 2),
        ('desafio_problema',       'Desafio/problema do momento (técnico, político, relacional, interno)', 3),
        ('conquistas_praticas',    'Conquistas e boas práticas', 4)
      ON CONFLICT (codigo) DO NOTHING;

      INSERT INTO ref_dimensao_gip (codigo, nome, valor_min, valor_max, ordem) VALUES
        ('qualidade_planejamento',  'Qualidade do planejamento',       1, 4, 1),
        ('atingimento_planejamento','Atingimento do planejamento',     1, 4, 2),
        ('capacidade_gestao',       'Capacidade de gestão',            1, 4, 3),
        ('autonomia_metodologia',   'Autonomia sobre a metodologia',   1, 4, 4)
      ON CONFLICT (codigo) DO NOTHING;

      -- Correção 20260812163617 (UAT kanban-etapas): 'cadastro' removida (não é
      -- etapa real da régua) -- ordem renumerada a partir de Pontapé.
      INSERT INTO ref_etapa (id_produto, codigo, nome, ordem, duracao_prevista_dias, gera_registro)
      SELECT p.id_produto, v.codigo, v.nome, v.ordem, v.dias, v.gera
        FROM ref_produto p, (VALUES
          ('pontape',        'Pontapé',                    1::smallint,  14::smallint, true),
          ('raio_x',         'Raio-X',                     2,            21,           true),
          ('imersao',        'Imersão',                    3,            14,           true),
          ('governanca',     'Governança / Organograma',   4,            45,           true),
          ('monitoramento',  'Monitoramento',              5,           120,           true),
          ('replicacao',     'Replicação',                 6,            14,           true)
        ) AS v(codigo, nome, ordem, dias, gera)
       WHERE p.nome = 'Estratégia'
      ON CONFLICT (id_produto, codigo) DO NOTHING;

      -- Correção 20260812163617 (UAT kanban-etapas): 'recrutamento'/'selecao'
      -- removidas (processos externos ao sistema, não são etapas da régua) --
      -- ordem renumerada a partir de Pontapé.
      INSERT INTO ref_etapa (id_produto, codigo, nome, ordem, duracao_prevista_dias, gera_registro)
      SELECT p.id_produto, v.codigo, v.nome, v.ordem, v.dias, v.gera
        FROM ref_produto p, (VALUES
          ('pontape',      'Pontapé',                                 1::smallint,  14::smallint, false),
          ('imersao',      'Imersão e construção do planejamento',    2,             7,           true),
          ('mentorias',    'Mentorias e monitoramento',               3,           120,           true)
        ) AS v(codigo, nome, ordem, dias, gera)
       WHERE p.nome = 'PLL'
      ON CONFLICT (id_produto, codigo) DO NOTHING;

      INSERT INTO ref_tipo_registro (id_etapa, codigo, nome, permite_multiplos, qtd_prevista)
      SELECT e.id_etapa, v.codigo, v.nome, v.multiplos, v.qtd
        FROM ref_etapa e
        JOIN ref_produto p ON p.id_produto = e.id_produto
        JOIN (VALUES
          ('Estratégia','pontape',                 'pontape',                 'Pontapé',                        false, NULL::smallint),
          ('Estratégia','raio_x',                   'comite_politico',        'Comitê Político',                false, NULL),
          ('Estratégia','raio_x',                   'escuta_diagnostica',     'Escuta Diagnóstica',             false, NULL),
          ('Estratégia','imersao',                  'imersao',                'Imersão',                        false, NULL),
          ('Estratégia','governanca',               'sprint',                 'Sprint',                         true,  NULL),
          ('Estratégia','governanca',               'diagnostico_organograma','Diagnóstico de Organograma',     false, NULL),
          ('Estratégia','governanca',               'organograma',            'Proposta de Organograma',        false, NULL),
          ('Estratégia','monitoramento',            'monitoramento',          'Monitoramento mensal',           true,  4),
          ('Estratégia','replicacao',               'replicacao',             'Replicação',                     false, NULL),
          ('Estratégia','monitoramento',            'legisla_aliada',         'Legisla Aliada',                 true,  NULL),
          ('PLL',       'mentorias',                'mentoria',               'Mentoria',                       true,  5)
        ) AS v(produto, etapa, codigo, nome, multiplos, qtd)
          ON v.produto = p.nome AND v.etapa = e.codigo
      ON CONFLICT (id_etapa, codigo) DO NOTHING;

      INSERT INTO ref_formulario (id_etapa, codigo, nome, respondente, exige_anexo)
      SELECT e.id_etapa, v.codigo, v.nome, v.respondente, v.anexo
        FROM ref_etapa e
        JOIN ref_produto p ON p.id_produto = e.id_produto
        JOIN (VALUES
          ('Estratégia','pontape',      'termo_compromisso',              'Termo de Compromisso',                  'assessor',            true),
          ('Estratégia','pontape',      'codigo_conduta',                 'Código de Conduta',                     'assessor',            true),
          ('Estratégia','pontape',      'introdutorio_assessores',        'Introdutório — Assessores',             'assessor',            false),
          ('Estratégia','pontape',      'introdutorio_cg_parlamentar',    'Introdutório — CG e Parlamentar',       'cargo_cg_parlamentar',false),
          ('Estratégia','pontape',      'organograma',                    'Organograma',                           'assessor',            false),
          ('Estratégia','raio_x',       'gip',                            'GIP (Início/Meio/Fim)',                 'gestora',             false),
          ('Estratégia','imersao',      'avaliacao_imersao',              'Avaliação da Imersão',                  'assessor',            false),
          ('Estratégia','replicacao',   'avaliacao_fim_ciclo',            'Avaliação de Fim de Ciclo',             'mandato',             false),
          -- Correção 20260812163617: 'recrutamento'/'selecao' removidas -- os 3
          -- formulários abaixo foram reatribuídos pro Pontapé do PLL (etapa que
          -- existe de fato), não apagados.
          ('PLL',       'pontape',      'inscricao_mentorado',            'Inscrição de Mentorados',               'mentorado',           false),
          ('PLL',       'pontape',      'diagnostico_tematicas',          'Diagnóstico e Temáticas de Interesse',  'mentorado',           false),
          ('PLL',       'pontape',      'inscricao_mentor',               'Inscrição de Mentores',                 'mentor',              false),
          ('PLL',       'imersao',      'avaliacao_imersao_pll',          'Avaliação da Imersão (PLL)',            'mentorado',           false),
          ('PLL',       'mentorias',    'avaliacao_parcial_participante', 'Avaliação Parcial — Participantes',     'mentorado',           false),
          ('PLL',       'mentorias',    'avaliacao_parcial_mentor',       'Avaliação Parcial — Mentores',          'mentor',              false),
          ('PLL',       'mentorias',    'avaliacao_final_participante',   'Avaliação Final — Participantes',       'mentorado',           false),
          ('PLL',       'mentorias',    'avaliacao_final_mentor',         'Avaliação Final — Mentores',            'mentor',              false)
        ) AS v(produto, etapa, codigo, nome, respondente, anexo)
          ON v.produto = p.nome AND v.etapa = e.codigo
      ON CONFLICT (codigo) DO NOTHING;

      INSERT INTO ref_metrica_formulario (id_formulario, codigo_campo, rotulo, tipo, eh_nps, agrupador)
      SELECT f.id_formulario, 'nps_recomendacao', 'Recomendaria o programa (0-10)', 'escala_0_10', true, 'nps'
        FROM ref_formulario f
       WHERE f.codigo LIKE 'avaliacao%'
      ON CONFLICT (id_formulario, codigo_campo) DO NOTHING;
    `);

    const [contagens] = await runSql<{
      preditor: number;
      perfil: number;
      pilar: number;
      dimensao: number;
      etapa_estrategia: number;
      etapa_pll: number;
      tipo_registro: number;
      formulario: number;
    }>(`
      SELECT
        (SELECT count(*)::int FROM ref_preditor) AS preditor,
        (SELECT count(*)::int FROM ref_perfil_atuacao) AS perfil,
        (SELECT count(*)::int FROM ref_pilar_insight) AS pilar,
        (SELECT count(*)::int FROM ref_dimensao_gip) AS dimensao,
        (SELECT count(*)::int FROM ref_etapa e JOIN ref_produto p ON p.id_produto = e.id_produto WHERE p.nome = 'Estratégia') AS etapa_estrategia,
        (SELECT count(*)::int FROM ref_etapa e JOIN ref_produto p ON p.id_produto = e.id_produto WHERE p.nome = 'PLL') AS etapa_pll,
        (SELECT count(*)::int FROM ref_tipo_registro) AS tipo_registro,
        (SELECT count(*)::int FROM ref_formulario) AS formulario;
    `);
    expect(contagens).toEqual({
      preditor: 5,
      perfil: 3,
      pilar: 4,
      dimensao: 4,
      etapa_estrategia: 6,
      etapa_pll: 3,
      tipo_registro: 11,
      formulario: 16,
    });

    const [{ total_avaliacao, total_nps }] = await runSql<{ total_avaliacao: number; total_nps: number }>(`
      SELECT
        (SELECT count(*)::int FROM ref_formulario WHERE codigo LIKE 'avaliacao%') AS total_avaliacao,
        (SELECT count(*)::int FROM ref_metrica_formulario WHERE eh_nps) AS total_nps;
    `);
    expect(total_nps).toBe(total_avaliacao);
  });
});

describe("Catálogos de Referência -- régua da Coalizão clonada da Estratégia (D9, CAT-17)", () => {
  it("CAT-17 AC1/Independent Test: Coalizão tem as mesmas 6 etapas da Estratégia, nomes e ordem idênticos", async () => {
    const rows = await runSql<{ produto: string; codigo: string; nome: string; ordem: number }>(`
      SELECT p.nome AS produto, e.codigo, e.nome, e.ordem
        FROM ref_etapa e JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE p.nome IN ('Estratégia', 'Coalizão')
       ORDER BY p.nome, e.ordem;
    `);
    const estrategia = rows.filter((r) => r.produto === "Estratégia");
    const coalizao = rows.filter((r) => r.produto === "Coalizão");
    expect(estrategia).toHaveLength(6);
    expect(coalizao).toHaveLength(6);
    expect(coalizao.map(({ produto: _produto, ...resto }) => resto)).toEqual(
      estrategia.map(({ produto: _produto, ...resto }) => resto)
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
    expect(qtd).toBe(6);
  });

  it("CAT-17 AC3: Estratégia e PLL continuam com suas 6/3 linhas, sem regressão", async () => {
    const rows = await runSql<{ produto: string; qtd: number }>(`
      SELECT p.nome AS produto, count(*)::int AS qtd
        FROM ref_etapa e JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE p.nome IN ('Estratégia', 'PLL')
       GROUP BY p.nome ORDER BY p.nome;
    `);
    expect(rows).toEqual([
      { produto: "Estratégia", qtd: 6 },
      { produto: "PLL", qtd: 3 },
    ]);
  });
});
