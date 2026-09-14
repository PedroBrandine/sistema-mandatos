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
  "mandatos_atraso_atencao",
  "mandatos_atraso_atrasados",
  "mandatos_atraso_normal",
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
  mandatos_atraso_atrasados: number | null;
  mandatos_atraso_atencao: number | null;
  mandatos_atraso_normal: number | null;
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

// Migração: 20260914161230_estrategia_vw_kpi_quebra_atraso.sql. Réplica em
// SQL de classificarLimiar (src/frontend/lib/limiar.ts, AD-045), medida
// sobre fat_contrato.id_etapa_atual e o tempo REAL decorrido desde a
// transição pra ela -- NÃO é o mesmo cálculo de mandatos_em_atraso (que usa
// vw_pendencias/dt_prevista_conclusao, um prazo PLANEJADO fixo). A migration
// documenta a verificação cruzada feita manualmente contra o banco de dev
// inteiro (12 contratos por mandatos_em_atraso x 2 por
// mandatos_atraso_atrasados, divergência com causa raiz identificada); os
// dois testes finais deste bloco automatizam essa verificação: um confirma
// que as duas bases CONCORDAM quando ancoradas no mesmo contrato/mesma
// data, outro reclassifica o banco inteiro de forma independente e confere
// contra a view.
describe("vw_estrategia_kpi -- quebra por status do KPI 'Mandatos em atraso' (AD-045, migration 20260914161230)", () => {
  let idEtapaTeste: number;
  let duracaoTeste: number;
  let idEtapaSemDuracao: number;
  let fecOriginal: { dt_inicio: string | null; dt_prevista_conclusao: string; status: string };

  beforeAll(async () => {
    // Primeira etapa do produto Estratégia com duração cadastrada -- não é
    // fixture própria (é catálogo compartilhado), mas só o registro de
    // fat_etapa_contrato do NOSSO contrato fixture (idContratoAtivo) é
    // mutado abaixo, nunca a linha de ref_etapa em si.
    const [etapa] = await runSql<{ id_etapa: number; duracao_prevista_dias: number }>(`
      SELECT id_etapa, duracao_prevista_dias FROM ref_etapa
       WHERE id_produto = ${idProduto} AND duracao_prevista_dias IS NOT NULL
       ORDER BY ordem LIMIT 1;
    `);
    idEtapaTeste = etapa.id_etapa;
    duracaoTeste = etapa.duracao_prevista_dias;

    const [original] = await runSql<{ dt_inicio: string | null; dt_prevista_conclusao: string; status: string }>(`
      SELECT dt_inicio, dt_prevista_conclusao, status FROM fat_etapa_contrato
       WHERE id_contrato = ${idContratoAtivo} AND id_etapa = ${idEtapaTeste};
    `);
    fecOriginal = original;

    // Etapa isolada (codigo/ordem próprios deste arquivo) sem duracao_prevista_dias
    // -- prova o caso "etapa sem duração não é classificável" sem mutar
    // nenhuma etapa real do catálogo compartilhado.
    const [nova] = await runSql<{ id_etapa: number }>(`
      INSERT INTO ref_etapa (id_produto, codigo, nome, ordem, duracao_prevista_dias)
      SELECT ${idProduto}, 't35-sem-duracao-fixture', 'T35 Etapa Sem Duração Fixture',
             COALESCE(MAX(ordem), 0) + 500, NULL
        FROM ref_etapa WHERE id_produto = ${idProduto}
      RETURNING id_etapa;
    `);
    idEtapaSemDuracao = nova.id_etapa;
  }, 60000);

  afterAll(async () => {
    await runSql(`
      UPDATE fat_contrato SET id_etapa_atual = NULL WHERE id_contrato = ${idContratoAtivo};
      UPDATE fat_etapa_contrato
         SET dt_inicio = ${fecOriginal.dt_inicio ? `'${fecOriginal.dt_inicio}'` : "NULL"},
             dt_prevista_conclusao = '${fecOriginal.dt_prevista_conclusao}',
             status = '${fecOriginal.status}'
       WHERE id_contrato = ${idContratoAtivo} AND id_etapa = ${idEtapaTeste};
      DELETE FROM ref_etapa WHERE id_etapa = ${idEtapaSemDuracao};
    `);
  }, 60000);

  // Move idContratoAtivo pra idEtapa (ou tira do Kanban com null) e ancora o
  // início REAL da etapa em `diasNaEtapa` dias atrás -- mesma âncora que
  // buscarBoardKanban usa (kanban.ts:174-178). Devolve só as 3 colunas de
  // quebra, no recorte por projeto da fixture (isola de qualquer outro
  // contrato do produto Estratégia).
  async function classificar(
    idEtapa: number | null,
    diasNaEtapa: number | null
  ): Promise<Pick<LinhaKpi, "mandatos_atraso_atrasados" | "mandatos_atraso_atencao" | "mandatos_atraso_normal">> {
    await runSql(`UPDATE fat_contrato SET id_etapa_atual = ${idEtapa ?? "NULL"} WHERE id_contrato = ${idContratoAtivo};`);
    if (idEtapa !== null && diasNaEtapa !== null) {
      await runSql(`
        UPDATE fat_etapa_contrato SET dt_inicio = CURRENT_DATE - ${diasNaEtapa}
         WHERE id_contrato = ${idContratoAtivo} AND id_etapa = ${idEtapa};
      `);
    }
    const [linha] = await runSql<LinhaKpi>(`
      SELECT mandatos_atraso_atrasados, mandatos_atraso_atencao, mandatos_atraso_normal
        FROM vw_estrategia_kpi
       WHERE id_produto = ${idProduto} AND escopo_projeto = true AND id_projeto = ${idProjeto}
         AND escopo_gestora = false;
    `);
    return linha;
  }

  it("classifica 'atrasado' quando o tempo real na etapa atual passa de 100% da duração prevista (AD-045)", async () => {
    const linha = await classificar(idEtapaTeste, duracaoTeste + 5);
    expect(linha.mandatos_atraso_atrasados).toBe(1);
    expect(linha.mandatos_atraso_atencao).toBe(0);
    expect(linha.mandatos_atraso_normal).toBe(0);
  }, 60000);

  it("classifica 'atencao' entre 70% e 100% da duração prevista (AD-045)", async () => {
    const linha = await classificar(idEtapaTeste, Math.round(duracaoTeste * 0.8));
    expect(linha.mandatos_atraso_atencao).toBe(1);
    expect(linha.mandatos_atraso_atrasados).toBe(0);
    expect(linha.mandatos_atraso_normal).toBe(0);
  }, 60000);

  it("classifica 'normal' abaixo de 70% da duração prevista", async () => {
    const linha = await classificar(idEtapaTeste, Math.round(duracaoTeste * 0.3));
    expect(linha.mandatos_atraso_normal).toBe(1);
    expect(linha.mandatos_atraso_atrasados).toBe(0);
    expect(linha.mandatos_atraso_atencao).toBe(0);
  }, 60000);

  it("AD-005: contrato sem id_etapa_atual não entra em nenhuma das 3 contagens -- nunca forçado em 'normal'", async () => {
    const linha = await classificar(null, null);
    expect(linha.mandatos_atraso_atrasados).toBe(0);
    expect(linha.mandatos_atraso_atencao).toBe(0);
    expect(linha.mandatos_atraso_normal).toBe(0);
  }, 60000);

  it("AD-005: etapa atual sem duracao_prevista_dias não entra em nenhuma das 3 contagens", async () => {
    // classificar() tenta um UPDATE em fat_etapa_contrato para
    // (idContratoAtivo, idEtapaSemDuracao); não existe essa linha (a etapa
    // nasceu depois da instanciação do contrato), então o UPDATE afeta 0
    // linhas -- irrelevante aqui, porque duracao_prevista_dias nula já
    // exclui o contrato antes de qualquer cálculo de percentual.
    const linha = await classificar(idEtapaSemDuracao, 999);
    expect(linha.mandatos_atraso_atrasados).toBe(0);
    expect(linha.mandatos_atraso_atencao).toBe(0);
    expect(linha.mandatos_atraso_normal).toBe(0);
  }, 60000);

  it("limiar inativo devolve NULL na coluna correspondente, não 0 (AD-005)", async () => {
    await classificar(idEtapaTeste, duracaoTeste + 5); // garante 1 contrato 'atrasado' com o limiar ligado
    try {
      await runSql(`UPDATE ref_limiar_pendencia SET ativo = false WHERE codigo = 'etapa_atrasado';`);
      const [linha] = await runSql<LinhaKpi>(`
        SELECT mandatos_atraso_atrasados, mandatos_atraso_atencao, mandatos_atraso_normal
          FROM vw_estrategia_kpi
         WHERE id_produto = ${idProduto} AND escopo_projeto = true AND id_projeto = ${idProjeto}
           AND escopo_gestora = false;
      `);
      // Coluna inteira NULL -- não 0 -- porque não dá para saber quem está
      // atrasado sem o limiar ligado (AD-005: ausência de insumo não vira
      // sentinela).
      expect(linha.mandatos_atraso_atrasados).toBeNull();
      // 'atencao' continua ativo: o mesmo contrato (>=100% da duração, que
      // também é >=70%) cai em 'atencao' por eliminação, já que a condição
      // de 'atrasado' nunca dispara com o limiar desligado -- mesmo
      // comportamento de classificarLimiar quando atrasadoPct vem null.
      expect(linha.mandatos_atraso_atencao).toBe(1);
    } finally {
      await runSql(`UPDATE ref_limiar_pendencia SET ativo = true WHERE codigo = 'etapa_atrasado';`);
    }
  }, 60000);

  it("Verificação cruzada com mandatos_em_atraso: quando o prazo planejado e o tempo real decorrido concordam, os dois métodos apontam o MESMO contrato", async () => {
    // Pedido explícito da task: confirmar que mandatos_atraso_atrasados e
    // mandatos_em_atraso computam o mesmo conjunto "por construção" no caso
    // em que as duas bases (dt_prevista_conclusao planejado x tempo real
    // decorrido) concordam -- que é o caso comum quando o Kanban está em dia
    // com o cronograma. A migration documenta, com dados reais de dev, que
    // as duas DIVERGEM quando as bases discordam (contrato nunca movido no
    // Kanban, ou que entrou atrasado numa etapa cujo prazo planejado
    // original ainda não venceu) -- não é bug, é definição diferente; este
    // teste cobre o caso em que a definição coincide.
    try {
      await runSql(`
        UPDATE fat_etapa_contrato SET dt_prevista_conclusao = CURRENT_DATE - 1, status = 'em_andamento'
         WHERE id_contrato = ${idContratoAtivo} AND id_etapa = ${idEtapaTeste};
      `);
      const linha = await classificar(idEtapaTeste, duracaoTeste + 5);
      expect(linha.mandatos_atraso_atrasados).toBe(1);

      const [emAtraso] = await runSql<{ esta_em_atraso: boolean }>(`
        SELECT EXISTS (
          SELECT 1 FROM vw_pendencias WHERE categoria = 'etapa_atrasada' AND id_contrato = ${idContratoAtivo}
        ) AS esta_em_atraso;
      `);
      expect(emAtraso.esta_em_atraso).toBe(true);

      const [linhaTotal] = await runSql<LinhaKpi>(`
        SELECT mandatos_em_atraso FROM vw_estrategia_kpi
         WHERE id_produto = ${idProduto} AND escopo_projeto = true AND id_projeto = ${idProjeto}
           AND escopo_gestora = false;
      `);
      expect(linhaTotal.mandatos_em_atraso).toBeGreaterThanOrEqual(1);
    } finally {
      // afterAll desta suíte já restaura fecOriginal por completo -- nada a
      // desfazer aqui além de não deixar o teste seguinte encontrar estado
      // inesperado, o que os próprios testes acima já resolvem chamando
      // classificar() de novo antes de suas asserções.
    }
  }, 60000);

  it("Independent Test: reclassificação independente da etapa atual bate com a view, no banco inteiro", async () => {
    // Escrita a partir do enunciado da migration (dias_na_etapa /
    // duracao_prevista_dias * 100, comparado aos percentuais ativos de
    // ref_limiar_pendencia), sem reaproveitar nada do corpo da view --
    // mesmo espírito do "Independent Test do spec" acima, agora para as 3
    // colunas novas.
    const divergencias = await runSql<{ id_produto: number; kpi: string; da_view: string | null; da_conferencia: string | null }>(`
      WITH limiar AS (
        SELECT
          (SELECT pct_duracao_etapa FROM ref_limiar_pendencia WHERE codigo = 'etapa_atrasado' AND ativo) AS atrasado_pct,
          (SELECT pct_duracao_etapa FROM ref_limiar_pendencia WHERE codigo = 'etapa_atencao'  AND ativo) AS atencao_pct
      ),
      classificado AS (
        SELECT
          c.id_produto,
          CASE
            WHEN l.atrasado_pct IS NOT NULL
                 AND ((CURRENT_DATE - COALESCE(fec.dt_inicio, c.dt_inicio))::numeric / e.duracao_prevista_dias * 100) >= l.atrasado_pct
              THEN 'atrasado'
            WHEN l.atencao_pct IS NOT NULL
                 AND ((CURRENT_DATE - COALESCE(fec.dt_inicio, c.dt_inicio))::numeric / e.duracao_prevista_dias * 100) >= l.atencao_pct
              THEN 'atencao'
            ELSE 'normal'
          END AS estado
        FROM fat_contrato c
        JOIN ref_etapa e ON e.id_etapa = c.id_etapa_atual
        LEFT JOIN fat_etapa_contrato fec ON fec.id_contrato = c.id_contrato AND fec.id_etapa = c.id_etapa_atual
        CROSS JOIN limiar l
        WHERE c.status = 'ativo' AND c.id_etapa_atual IS NOT NULL
          AND e.duracao_prevista_dias IS NOT NULL AND e.duracao_prevista_dias > 0
      ),
      esperado AS (
        SELECT id_produto,
               count(*) FILTER (WHERE estado = 'atrasado') AS mandatos_atraso_atrasados,
               count(*) FILTER (WHERE estado = 'atencao')  AS mandatos_atraso_atencao,
               count(*) FILTER (WHERE estado = 'normal')   AS mandatos_atraso_normal
          FROM classificado
         GROUP BY id_produto
      ),
      confronto AS (
        SELECT v.id_produto, x.kpi, x.da_view, x.da_conferencia
          FROM vw_estrategia_kpi v
          JOIN esperado e ON e.id_produto = v.id_produto
          CROSS JOIN LATERAL (VALUES
            ('mandatos_atraso_atrasados', v.mandatos_atraso_atrasados::text, e.mandatos_atraso_atrasados::text),
            ('mandatos_atraso_atencao',   v.mandatos_atraso_atencao::text,   e.mandatos_atraso_atencao::text),
            ('mandatos_atraso_normal',    v.mandatos_atraso_normal::text,    e.mandatos_atraso_normal::text)
          ) AS x(kpi, da_view, da_conferencia)
         WHERE v.escopo_projeto = false AND v.escopo_gestora = false
      )
      SELECT * FROM confronto WHERE da_view IS DISTINCT FROM da_conferencia ORDER BY id_produto, kpi;
    `);
    expect(divergencias).toEqual([]);
  });
});
