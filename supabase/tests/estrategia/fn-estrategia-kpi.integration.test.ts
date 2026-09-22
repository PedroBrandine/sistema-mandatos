import { describe, it, expect } from "vitest";
import { runSql } from "../helpers/sql";

// Migração: 20260921230408_estrategia_kpi_por_conjunto.sql (fn_estrategia_kpi).
//
// fn_estrategia_kpi é uma CÓPIA das fórmulas de vw_estrategia_kpi para um
// conjunto de projetos/gestoras/contratos (filtro de seleção múltipla). Copiar
// fórmula é a origem clássica de divergência silenciosa, então este arquivo
// existe para que ela não seja silenciosa: sobre o banco INTEIRO, para cada
// linha da view (total, cada projeto, cada gestora, cada projeto x gestora), a
// função com aquele mesmo recorte tem de devolver as mesmas 11 colunas.
// Somente leitura -- não cria nada no banco compartilhado de dev.

const COLUNAS = [
  "mandatos_ativos",
  "iip_medio",
  "nps_medio",
  "pct_atingimento_medio",
  "nr_fatos_geradores",
  "mandatos_atraso_atrasados",
  "mandatos_atraso_atencao",
  "mandatos_atraso_normal",
  "componente_d1_medio",
  "componente_d2_medio",
  "componente_d3_medio",
] as const;

const IGUAL = COLUNAS.map((c) => `v.${c} IS NOT DISTINCT FROM f.${c}`).join(" AND ");

// A função é aplicada com o recorte de cada linha da view: projeto/gestora só
// entram quando a linha é de escopo, e vêm como array de 1 elemento.
const FROM_COMPARADO = `
  FROM vw_estrategia_kpi v
  CROSS JOIN LATERAL fn_estrategia_kpi(
    v.id_produto,
    CASE WHEN v.escopo_projeto THEN ARRAY[v.id_projeto] END,
    CASE WHEN v.escopo_gestora THEN ARRAY[v.id_usuario_gestora] END
  ) f`;

describe("fn_estrategia_kpi (seleção múltipla)", () => {
  it("devolve, para 1 projeto e/ou 1 gestora, exatamente a linha da vw_estrategia_kpi", async () => {
    const [r] = await runSql<{ total: string; divergentes: string }>(`
      SELECT count(*) AS total,
             count(*) FILTER (WHERE NOT (${IGUAL})) AS divergentes
      ${FROM_COMPARADO}`);

    // Sem linhas a comparação seria vácua -- o banco de dev sempre tem ao
    // menos a linha total de cada produto.
    expect(Number(r.total)).toBeGreaterThan(0);
    expect(Number(r.divergentes)).toBe(0);
  });

  it("nenhuma linha da view fica sem correspondente na função (recorte com dado não some)", async () => {
    const [r] = await runSql<{ na_view: string; na_funcao: string }>(`
      SELECT (SELECT count(*) FROM vw_estrategia_kpi) AS na_view,
             (SELECT count(*) ${FROM_COMPARADO}) AS na_funcao`);

    expect(Number(r.na_funcao)).toBe(Number(r.na_view));
  });

  it("várias gestoras: união, contando cada contrato uma vez (contagem independente)", async () => {
    // A view não sabe somar gestoras (contrato com 2 gestoras entra em 2
    // linhas). A referência aqui é escrita direto sobre as tabelas, sem passar
    // por nenhuma das duas agregações.
    const [r] = await runSql<{ n_gestoras: string; conjunto: string; esperado: string }>(`
      WITH alvo AS (
        SELECT id_produto, array_agg(id_usuario_gestora) AS ids
          FROM vw_estrategia_kpi
         WHERE escopo_gestora AND NOT escopo_projeto
         GROUP BY id_produto
        HAVING count(*) >= 2
         ORDER BY count(*) DESC
         LIMIT 1
      )
      SELECT cardinality(a.ids) AS n_gestoras,
             (SELECT mandatos_ativos FROM fn_estrategia_kpi(a.id_produto, NULL, a.ids)) AS conjunto,
             (SELECT count(DISTINCT c.id_contrato)
                FROM fat_contrato c
                JOIN rel_usuario_contrato v ON v.id_contrato = c.id_contrato
               WHERE c.id_produto = a.id_produto
                 AND c.status = 'ativo'
                 AND v.papel_no_contrato = 'gestora'
                 AND (v.dt_fim IS NULL OR v.dt_fim >= CURRENT_DATE)
                 AND v.id_usuario = ANY (a.ids)) AS esperado
        FROM alvo a`);

    // Sem produto com 2+ gestoras no dev não há o que unir; falhar alto em vez
    // de passar vácuo.
    expect(r, "nenhum produto com 2+ gestoras no banco de dev").toBeDefined();
    expect(Number(r.conjunto)).toBe(Number(r.esperado));
  });

  it("conjunto com um projeto inexistente devolve o mesmo que o projeto sozinho (união)", async () => {
    const [r] = await runSql<{ divergentes: string; total: string }>(`
      SELECT count(*) AS total,
             count(*) FILTER (WHERE NOT (${IGUAL})) AS divergentes
        FROM vw_estrategia_kpi v
        CROSS JOIN LATERAL fn_estrategia_kpi(v.id_produto, ARRAY[v.id_projeto, -1]::bigint[]) f
       WHERE v.escopo_projeto AND NOT v.escopo_gestora`);

    expect(Number(r.total)).toBeGreaterThan(0);
    expect(Number(r.divergentes)).toBe(0);
  });

  it("recorte sem nenhum contrato devolve ZERO linhas (ausência de dado, não zeros)", async () => {
    const rows = await runSql(`
      SELECT * FROM fn_estrategia_kpi(
        (SELECT min(id_produto) FROM ref_produto),
        ARRAY[-1]::bigint[]
      )`);

    expect(rows).toHaveLength(0);
  });

  it("array vazio equivale a NULL: sem filtro (mesma linha da total da view)", async () => {
    const [r] = await runSql<{ divergentes: string }>(`
      SELECT count(*) FILTER (WHERE NOT (${IGUAL})) AS divergentes
        FROM vw_estrategia_kpi v
        CROSS JOIN LATERAL fn_estrategia_kpi(v.id_produto, ARRAY[]::bigint[], ARRAY[]::bigint[], ARRAY[]::bigint[]) f
       WHERE NOT v.escopo_projeto AND NOT v.escopo_gestora`);

    expect(Number(r.divergentes)).toBe(0);
  });

  it("filtro de contrato: nps_medio é NULL (NPS não é recortável por contrato)", async () => {
    const rows = await runSql<{ nps_medio: string | null; mandatos_ativos: string }>(`
      SELECT f.nps_medio, f.mandatos_ativos
        FROM (SELECT id_contrato, id_produto FROM fat_contrato ORDER BY id_contrato LIMIT 1) c
        CROSS JOIN LATERAL fn_estrategia_kpi(c.id_produto, NULL, NULL, ARRAY[c.id_contrato]) f`);

    expect(rows).toHaveLength(1);
    expect(rows[0].nps_medio).toBeNull();
  });
});
