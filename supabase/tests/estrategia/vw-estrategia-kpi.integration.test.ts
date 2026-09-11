import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/spec.md, EST-08
// ("P3: KPIs do Dashboard", AC1-AC4) + tasks.md T31.
// Migração: 20260911210203_estrategia_vw_kpi.sql.
//
// O "Independent Test" que o spec define para EST-08 é literalmente "conferir
// cada KPI contra a query equivalente rodada à mão" -- é o que o último teste
// deste arquivo faz, sobre o banco INTEIRO e não só sobre a fixture: cada um
// dos 6 números da linha total de cada produto é reconstruído por uma consulta
// independente, escrita a partir do spec e não a partir do corpo da view, e
// confrontado com o que a view devolve. Uma view que devolvesse constante,
// que somasse a coluna errada ou que contasse linhas em vez de contratos
// falharia ali.
//
// A fixture existe para o que a comparação global não consegue provar: o
// comportamento de AD-005 num recorte CONTROLADO (contratos novos, sem IIP,
// sem NPS e sem atingimento) e o isolamento dos recortes de projeto e de
// gestora. Ela vive num ref_projeto próprio, criado por este arquivo, para
// que as asserções de recorte sejam determinísticas e não dependam de quantos
// contratos os outros testes deixaram no produto Estratégia.
//
// NUMERIC chega como string por este helper (ver OIDS_NUMERICOS em
// supabase/helpers/sql.ts: 1700 foi deliberadamente deixado de fora), tanto
// via --linked quanto via --local. Por isso iip_medio/pct_atingimento_medio/
// nps_medio e nr_fatos_geradores (SUM de bigint devolve NUMERIC em Postgres)
// são comparados como string ou via Number(), nunca como number cru.

// Os 6 KPIs de EST-08 AC1, na ordem em que o spec os enumera, e as 5 colunas
// de recorte que sustentam AC3. Lista literal de propósito: se alguém
// renomear uma coluna da view, este teste quebra antes da tela.
const COLUNAS_KPI = [
  "iip_medio",
  "mandatos_ativos",
  "mandatos_em_atraso",
  "nps_medio",
  "nr_fatos_geradores",
  "pct_atingimento_medio",
];
const COLUNAS_RECORTE = [
  "escopo_gestora",
  "escopo_projeto",
  "id_produto",
  "id_projeto",
  "id_usuario_gestora",
];

interface LinhaKpi {
  id_produto: number;
  escopo_projeto: boolean;
  escopo_gestora: boolean;
  id_projeto: number | null;
  id_usuario_gestora: number | null;
  mandatos_ativos: number;
  iip_medio: string | null;
  mandatos_em_atraso: number;
  nps_medio: string | null;
  pct_atingimento_medio: string | null;
  nr_fatos_geradores: string;
}

let idProduto: number;
let idProjeto: number;
let idUsuario: number;
let idContratante: number;
let idContratoAtivo: number;
let idContratoConcluido: number;

beforeAll(async () => {
  const [catalogo] = await runSql<{ id_produto: number }>(`
    SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia';
  `);
  idProduto = catalogo.id_produto;

  const [entidades] = await runSql<{
    id_usuario: number;
    id_contratante: number;
    id_projeto: number;
  }>(`
    WITH u AS (
      INSERT INTO dim_usuario (email, nome, papel_global, ativo)
      VALUES ('t31-kpi-gestora@legislabrasil.test', 'T31 KPI Gestora Fixture', 'gestora', true)
      ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome
      RETURNING id_usuario
    ), pj AS (
      INSERT INTO ref_projeto (nome, ativo)
      VALUES ('T31 KPI Projeto Fixture', true)
      ON CONFLICT (nome) DO UPDATE SET ativo = EXCLUDED.ativo
      RETURNING id_projeto
    ), ct AS (
      INSERT INTO dim_contratante (tipo_contratante, nome)
      VALUES ('mandato', 'T31 KPI Contratante Fixture')
      RETURNING id_contratante
    ), m AS (
      INSERT INTO dim_mandato (id_contratante) SELECT id_contratante FROM ct RETURNING id_contratante
    )
    SELECT u.id_usuario, ct.id_contratante, pj.id_projeto FROM u, ct, pj;
  `);
  idUsuario = entidades.id_usuario;
  idContratante = entidades.id_contratante;
  idProjeto = entidades.id_projeto;

  // Dois contratos no MESMO projeto: um ativo e um concluído. O concluído é
  // o que prova que mandatos_ativos filtra por status em vez de contar tudo.
  const contratos = await runSql<{ id_contrato: number; status: string }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, id_projeto, dt_inicio, status, localizador_legado)
    VALUES
      (${idContratante}, ${idProduto}, ${idProjeto}, CURRENT_DATE - 30, 'ativo', 't31-kpi-ativo'),
      (${idContratante}, ${idProduto}, ${idProjeto}, CURRENT_DATE - 90, 'concluido', 't31-kpi-concluido')
    RETURNING id_contrato, status;
  `);
  idContratoAtivo = contratos.find((c) => c.status === "ativo")!.id_contrato;
  idContratoConcluido = contratos.find((c) => c.status === "concluido")!.id_contrato;

  await runSql(`
    INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
    VALUES (${idContratoAtivo}, ${idUsuario}, 'gestora');
  `);
}, 150000);

afterAll(async () => {
  // Mesma ordem de dependência do afterAll de vw-pendencias-limiar: filhos da
  // régua instanciada por trigger (fat_etapa_contrato, rel_formulario_contrato,
  // dim_planejamento) antes do contrato, e ref_projeto por último porque
  // fat_contrato.id_projeto o referencia.
  await runSql(`
    DELETE FROM rel_usuario_contrato WHERE id_contrato IN (${idContratoAtivo}, ${idContratoConcluido});
    DELETE FROM fat_etapa_contrato WHERE id_contrato IN (${idContratoAtivo}, ${idContratoConcluido});
    DELETE FROM rel_formulario_contrato WHERE id_contrato IN (${idContratoAtivo}, ${idContratoConcluido});
    DELETE FROM dim_planejamento WHERE id_contrato IN (${idContratoAtivo}, ${idContratoConcluido});
    DELETE FROM fat_contrato WHERE id_contrato IN (${idContratoAtivo}, ${idContratoConcluido});
    DELETE FROM dim_mandato WHERE id_contratante = ${idContratante};
    DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};
    DELETE FROM ref_projeto WHERE id_projeto = ${idProjeto};
    DELETE FROM dim_usuario WHERE id_usuario = ${idUsuario};
  `);
}, 150000);

describe("vw_estrategia_kpi -- KPIs do Dashboard na camada Saída (EST-08, AD-003)", () => {
  it("EST-08 AC1: a view expõe os 6 KPIs e as 5 colunas de recorte", async () => {
    const rows = await runSql<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'vw_estrategia_kpi'
       ORDER BY column_name;
    `);
    const colunas = rows.map((r) => r.column_name);
    expect(colunas).toEqual([...COLUNAS_KPI, ...COLUNAS_RECORTE].sort());
  });

  it("AD-003: a view lê a camada Saída -- inclusive os fatos geradores, que NÃO saem da tabela transacional", async () => {
    const dependencias = await runSql<{ tabela: string }>(`
      SELECT DISTINCT cl.relname AS tabela
        FROM pg_depend d
        JOIN pg_rewrite rw ON rw.oid = d.objid
        JOIN pg_class cl   ON cl.oid = d.refobjid
       WHERE rw.ev_class = 'vw_estrategia_kpi'::regclass
         AND cl.relname <> 'vw_estrategia_kpi'
       ORDER BY cl.relname;
    `);
    const tabelas = dependencias.map((d) => d.tabela);
    expect(tabelas).toContain("mv_iip_contrato");
    expect(tabelas).toContain("mv_avaliacao_nps");
    expect(tabelas).toContain("vw_pendencias");
    expect(tabelas).toContain("dim_planejamento");
    // nr_fatos_geradores vem de mv_iip_contrato.nr_fatos. Ler
    // fat_fato_gerador direto seria número de gestão saindo de tabela
    // transacional -- exatamente o que AD-003 proíbe.
    expect(tabelas).not.toContain("fat_fato_gerador");
  });

  it("AD-014: a view não recalcula o IIP nem a fórmula do NPS -- lê os dois prontos", async () => {
    const [row] = await runSql<{ definicao: string }>(`
      SELECT pg_get_viewdef('vw_estrategia_kpi'::regclass, true) AS definicao;
    `);
    // Os ingredientes do cálculo do IIP (mv_iip_contrato) e do NPS
    // (mv_avaliacao_nps): se qualquer um aparecer aqui, a métrica foi
    // reimplementada numa segunda casa.
    expect(row.definicao).not.toMatch(/peso_iip/i);
    expect(row.definicao).not.toMatch(/nivel_d[123]/i);
    expect(row.definicao).not.toMatch(/promotores|detratores/i);
    // E os números prontos que ela de fato consome:
    expect(row.definicao).toMatch(/iip_provisorio/);
    expect(row.definicao).toMatch(/nr_fatos/);
  });

  it("AD-011/AD-015: security_invoker = true", async () => {
    const rows = await runSql<{ reloptions: string[] }>(`
      SELECT reloptions FROM pg_class WHERE relname = 'vw_estrategia_kpi';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].reloptions).toContain("security_invoker=true");
  });

  it("grants coerentes com vw_pendencias: app/admin/gestora leem; mentor, assessor e anon não", async () => {
    const [row] = await runSql<{ acl: string }>(`
      SELECT array_to_string(relacl, ' | ') AS acl
        FROM pg_class WHERE relname = 'vw_estrategia_kpi';
    `);
    // `r` é SELECT na notação de ACL do Postgres.
    expect(row.acl).toMatch(/legisla_app=r/);
    expect(row.acl).toMatch(/legisla_admin=r/);
    expect(row.acl).toMatch(/legisla_gestora=r/);
    // Os dois papéis que já não enxergam vw_pendencias nem mv_avaliacao_nps
    // continuam de fora -- conceder a view sem as fontes só trocaria "não
    // aparece" por erro 42501 no meio da agregação.
    expect(row.acl).not.toMatch(/legisla_mentor/);
    expect(row.acl).not.toMatch(/legisla_assessor/);
    // Sessão não autenticada não lê KPI de carteira (gap do ALTER DEFAULT
    // PRIVILEGES do baseline, fechado por esta migration).
    expect(row.acl).not.toMatch(/\banon=/);
    // authenticated mantém SELECT (é a role da usuária logada no PostgREST) e
    // perde as escritas -- view agregada não é destino de escrita.
    expect(row.acl).toMatch(/authenticated=r[^w]*\//);
  });

  it("EST-08 AC2 / AD-005: sem dado suficiente o KPI é NULL, e a contagem real na MESMA linha continua sendo número", async () => {
    const [linha] = await runSql<LinhaKpi>(`
      SELECT * FROM vw_estrategia_kpi
       WHERE id_produto = ${idProduto} AND escopo_projeto = true AND id_projeto = ${idProjeto}
         AND escopo_gestora = false;
    `);
    // Os contratos da fixture não têm fato gerador (logo nenhuma linha em
    // mv_iip_contrato), não têm resposta de formulário e não têm
    // pct_atingimento preenchido. As três MÉDIAS são indefinidas:
    expect(linha.iip_medio).toBeNull();
    expect(linha.nps_medio).toBeNull();
    expect(linha.pct_atingimento_medio).toBeNull();
    // ...e, na mesma linha, as CONTAGENS são fato conhecido, não ausência:
    // existem 2 contratos, 1 deles ativo, e zero fatos geradores. Devolver
    // NULL aqui esconderia informação real; devolver 0 nas médias acima é que
    // seria o zero inventado que AD-005 proíbe.
    expect(linha.mandatos_ativos).toBe(1);
    expect(Number(linha.nr_fatos_geradores)).toBe(0);
  });

  it("EST-08 AC1: mandatos_ativos conta só status 'ativo' -- o contrato concluído da fixture não entra", async () => {
    const [contagem] = await runSql<{ total: number }>(`
      SELECT count(*)::int AS total FROM fat_contrato WHERE id_projeto = ${idProjeto};
    `);
    expect(contagem.total).toBe(2);

    const [linha] = await runSql<LinhaKpi>(`
      SELECT * FROM vw_estrategia_kpi
       WHERE id_produto = ${idProduto} AND escopo_projeto = true AND id_projeto = ${idProjeto}
         AND escopo_gestora = false;
    `);
    expect(linha.mandatos_ativos).toBe(1);
  });

  it("EST-08 AC1: pct_atingimento_medio reflete o valor lançado em dim_planejamento", async () => {
    try {
      await runSql(`
        UPDATE dim_planejamento SET pct_atingimento = 40 WHERE id_contrato = ${idContratoAtivo};
      `);
      const [comValor] = await runSql<LinhaKpi>(`
        SELECT * FROM vw_estrategia_kpi
         WHERE id_produto = ${idProduto} AND escopo_projeto = true AND id_projeto = ${idProjeto}
           AND escopo_gestora = false;
      `);
      // Só um dos dois contratos tem atingimento lançado; a média ignora o
      // NULL do outro em vez de tratá-lo como zero (que daria 20.00).
      expect(comValor.pct_atingimento_medio).toBe("40.00");
    } finally {
      await runSql(`
        UPDATE dim_planejamento SET pct_atingimento = NULL WHERE id_contrato = ${idContratoAtivo};
      `);
    }

    const [semValor] = await runSql<LinhaKpi>(`
      SELECT * FROM vw_estrategia_kpi
       WHERE id_produto = ${idProduto} AND escopo_projeto = true AND id_projeto = ${idProjeto}
         AND escopo_gestora = false;
    `);
    expect(semValor.pct_atingimento_medio).toBeNull();
  });

  it("EST-08 AC3: o recorte por projeto isola o projeto -- e o total do produto é maior que ele", async () => {
    const [recorte] = await runSql<LinhaKpi>(`
      SELECT * FROM vw_estrategia_kpi
       WHERE id_produto = ${idProduto} AND escopo_projeto = true AND id_projeto = ${idProjeto}
         AND escopo_gestora = false;
    `);
    const [total] = await runSql<LinhaKpi>(`
      SELECT * FROM vw_estrategia_kpi
       WHERE id_produto = ${idProduto} AND escopo_projeto = false AND escopo_gestora = false;
    `);
    expect(recorte.mandatos_ativos).toBe(1);
    // O produto Estratégia tem outros contratos fora deste projeto: o recorte
    // é um subconjunto estrito, não uma cópia do total.
    expect(total.mandatos_ativos).toBeGreaterThan(recorte.mandatos_ativos);
  });

  it("EST-08 AC3: o recorte por gestora isola os contratos daquela gestora", async () => {
    const [recorte] = await runSql<LinhaKpi>(`
      SELECT * FROM vw_estrategia_kpi
       WHERE id_produto = ${idProduto} AND escopo_gestora = true
         AND id_usuario_gestora = ${idUsuario} AND escopo_projeto = false;
    `);
    // A gestora da fixture é gestora de exatamente 1 contrato, o ativo.
    expect(recorte.mandatos_ativos).toBe(1);
    // Limitação estrutural documentada na migration: mv_avaliacao_nps não
    // carrega id_contrato, então NPS não é recortável por gestora. A view
    // devolve ausência explícita em vez de repetir o número do produto
    // inteiro como se fosse o dela (AD-005).
    expect(recorte.nps_medio).toBeNull();
  });

  it("Independent Test do spec: os 6 KPIs de cada produto batem com a query equivalente rodada à mão, no banco inteiro", async () => {
    // Consulta escrita a partir do enunciado de EST-08 AC1 -- mandatos
    // ativos, IIP, mandatos em atraso, NPS, atingimento e fatos geradores --
    // sem reaproveitar nada do corpo da view. Só a linha de total
    // (escopo_projeto = false, escopo_gestora = false) é confrontada, porque
    // é a que corresponde a "o produto inteiro".
    const divergencias = await runSql<{
      id_produto: number;
      kpi: string;
      da_view: string | null;
      da_conferencia: string | null;
    }>(`
      WITH esperado AS (
        SELECT
          c.id_produto,
          count(*) FILTER (WHERE c.status = 'ativo')                    AS mandatos_ativos,
          round(avg(i.iip_provisorio), 2)                               AS iip_medio,
          count(*) FILTER (WHERE a.id_contrato IS NOT NULL)             AS mandatos_em_atraso,
          round(avg(pl.pct_atingimento), 2)                             AS pct_atingimento_medio,
          coalesce(sum(i.nr_fatos), 0)                                  AS nr_fatos_geradores
        FROM fat_contrato c
        LEFT JOIN mv_iip_contrato i  ON i.id_contrato = c.id_contrato
        LEFT JOIN dim_planejamento pl ON pl.id_contrato = c.id_contrato
        LEFT JOIN (SELECT DISTINCT id_contrato FROM vw_pendencias WHERE categoria = 'etapa_atrasada') a
               ON a.id_contrato = c.id_contrato
        GROUP BY c.id_produto
      ),
      nps_esperado AS (
        SELECT e.id_produto, round(avg(n.nps), 2) AS nps_medio
          FROM mv_avaliacao_nps n
          JOIN ref_formulario f ON f.id_formulario = n.id_formulario
          JOIN ref_etapa e      ON e.id_etapa = f.id_etapa
         WHERE n.eh_nps AND n.nps IS NOT NULL
         GROUP BY e.id_produto
      ),
      confronto AS (
        SELECT v.id_produto, x.kpi, x.da_view, x.da_conferencia
          FROM vw_estrategia_kpi v
          JOIN esperado e ON e.id_produto = v.id_produto
          LEFT JOIN nps_esperado ne ON ne.id_produto = v.id_produto
          CROSS JOIN LATERAL (VALUES
            ('mandatos_ativos',       v.mandatos_ativos::text,       e.mandatos_ativos::text),
            ('iip_medio',             v.iip_medio::text,             e.iip_medio::text),
            ('mandatos_em_atraso',    v.mandatos_em_atraso::text,    e.mandatos_em_atraso::text),
            ('nps_medio',             v.nps_medio::text,             ne.nps_medio::text),
            ('pct_atingimento_medio', v.pct_atingimento_medio::text, e.pct_atingimento_medio::text),
            ('nr_fatos_geradores',    v.nr_fatos_geradores::text,    e.nr_fatos_geradores::text)
          ) AS x(kpi, da_view, da_conferencia)
         WHERE v.escopo_projeto = false AND v.escopo_gestora = false
      )
      SELECT * FROM confronto
       WHERE da_view IS DISTINCT FROM da_conferencia
       ORDER BY id_produto, kpi;
    `);
    expect(divergencias).toEqual([]);

    // Garante que a comparação acima não foi vazia por acidente (nenhum
    // produto, nenhuma linha): o banco de dev tem contratos em mais de um
    // produto e a view emite uma linha de total para cada um.
    const [cobertura] = await runSql<{ produtos: number; ativos: number }>(`
      SELECT count(*)::int AS produtos, coalesce(sum(mandatos_ativos), 0)::int AS ativos
        FROM vw_estrategia_kpi WHERE escopo_projeto = false AND escopo_gestora = false;
    `);
    expect(cobertura.produtos).toBeGreaterThan(1);
    expect(cobertura.ativos).toBeGreaterThan(0);
  });
});
