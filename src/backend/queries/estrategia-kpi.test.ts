import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarEstrategiaKpi } from "./estrategia-kpi";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/tasks.md, T32
// "Done when" (EST-08 AC2, AC3) --
//  - Filtros recalculam o recorte (AC3)
//  - NULL do banco chega como ausência, não como 0 (AC2 / AD-005)
//
// Mock roteado por nome de tabela, mesmo padrão de queries/pendencias.test.ts
// e queries/kanban.test.ts.

type Chamada = { tabela: string; metodo: string; args: unknown[] };
type RespostaTabela = { data: unknown; error: { message: string } | null };

function criarClienteMock(respostasPorTabela: Record<string, RespostaTabela>) {
  const chamadas: Chamada[] = [];

  function criarBuilder(tabela: string) {
    const resposta = respostasPorTabela[tabela] ?? { data: null, error: null };
    const builder: Record<string, unknown> = {
      select: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "select", args });
        return builder;
      },
      eq: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "eq", args });
        return builder;
      },
      then: (resolve: (valor: RespostaTabela) => void, reject: (erro: unknown) => void) =>
        Promise.resolve(resposta).then(resolve, reject),
    };
    return builder;
  }

  const client = {
    from: (tabela: string) => {
      chamadas.push({ tabela, metodo: "from", args: [tabela] });
      return criarBuilder(tabela);
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

// Linha completa da view, com os 6 KPIs + a quebra por status preenchidos.
const LINHA_COMPLETA = {
  mandatos_ativos: 25,
  iip_medio: 3.75,
  mandatos_em_atraso: 11,
  nps_medio: 62.5,
  pct_atingimento_medio: 55.21,
  nr_fatos_geradores: 8,
  mandatos_atraso_atrasados: 4,
  mandatos_atraso_atencao: 3,
  mandatos_atraso_normal: 18,
};

function filtrosEq(chamadas: Chamada[]) {
  return chamadas.filter((c) => c.tabela === "vw_estrategia_kpi" && c.metodo === "eq").map((c) => c.args);
}

describe("buscarEstrategiaKpi (EST-08)", () => {
  it("mapeia os 6 KPIs + a quebra por status da linha da view para o view-model", async () => {
    const { client } = criarClienteMock({
      vw_estrategia_kpi: { data: [LINHA_COMPLETA], error: null },
    });

    const resultado = await buscarEstrategiaKpi(client, { idProduto: 7 });

    expect(resultado).toEqual({
      mandatosAtivos: 25,
      iipMedio: 3.75,
      mandatosEmAtraso: 11,
      npsMedio: 62.5,
      pctAtingimentoMedio: 55.21,
      nrFatosGeradores: 8,
      mandatosAtrasoAtrasados: 4,
      mandatosAtrasoAtencao: 3,
      mandatosAtrasoNormal: 18,
    });
  });

  it("EST-08 AC2 / AD-005: NULL do banco chega como null, e o 0 do banco continua 0", async () => {
    const { client } = criarClienteMock({
      vw_estrategia_kpi: {
        data: [
          {
            // Contagens reais: o produto tem 3 mandatos, nenhum atrasado e
            // nenhum fato gerador. Zero aqui é medição, não ausência.
            mandatos_ativos: 3,
            mandatos_em_atraso: 0,
            nr_fatos_geradores: 0,
            // Médias sem amostra: indefinidas.
            iip_medio: null,
            nps_medio: null,
            pct_atingimento_medio: null,
            // Limiar de 'atrasado' desligado (coluna inteira ausente); os
            // outros dois estados continuam classificáveis.
            mandatos_atraso_atrasados: null,
            mandatos_atraso_atencao: 1,
            mandatos_atraso_normal: 2,
          },
        ],
        error: null,
      },
    });

    const resultado = await buscarEstrategiaKpi(client, { idProduto: 7 });

    // Os NULL sobrevivem como null -- nenhum vira 0 no caminho.
    expect(resultado.iipMedio).toBeNull();
    expect(resultado.npsMedio).toBeNull();
    expect(resultado.pctAtingimentoMedio).toBeNull();
    expect(resultado.mandatosAtrasoAtrasados).toBeNull();
    // E os zeros/contagens reais não viram null: a distinção entre "medimos e
    // deu zero" (ou N) e "não há dado" precisa chegar intacta à tela.
    expect(resultado.mandatosEmAtraso).toBe(0);
    expect(resultado.nrFatosGeradores).toBe(0);
    expect(resultado.mandatosAtivos).toBe(3);
    expect(resultado.mandatosAtrasoAtencao).toBe(1);
    expect(resultado.mandatosAtrasoNormal).toBe(2);
  });

  it("EST-08 AC2 / AD-005: recorte sem nenhuma linha devolve os 9 KPIs como null, nunca zeros", async () => {
    const { client } = criarClienteMock({
      vw_estrategia_kpi: { data: [], error: null },
    });

    const resultado = await buscarEstrategiaKpi(client, { idProduto: 7 });

    expect(resultado).toEqual({
      mandatosAtivos: null,
      iipMedio: null,
      mandatosEmAtraso: null,
      npsMedio: null,
      pctAtingimentoMedio: null,
      nrFatosGeradores: null,
      mandatosAtrasoAtrasados: null,
      mandatosAtrasoAtencao: null,
      mandatosAtrasoNormal: null,
    });
  });

  it("EST-08 AC3: sem filtros lê a linha de total do produto (os dois escopos false)", async () => {
    const { client, chamadas } = criarClienteMock({
      vw_estrategia_kpi: { data: [LINHA_COMPLETA], error: null },
    });

    await buscarEstrategiaKpi(client, { idProduto: 7 });

    expect(filtrosEq(chamadas)).toEqual([
      ["id_produto", 7],
      ["escopo_projeto", false],
      ["escopo_gestora", false],
    ]);
  });

  it("EST-08 AC3: filtro de projeto muda o recorte -- liga escopo_projeto e fixa o id", async () => {
    const { client, chamadas } = criarClienteMock({
      vw_estrategia_kpi: { data: [LINHA_COMPLETA], error: null },
    });

    await buscarEstrategiaKpi(client, { idProduto: 7, idProjeto: 3 });

    expect(filtrosEq(chamadas)).toEqual([
      ["id_produto", 7],
      ["escopo_projeto", true],
      ["escopo_gestora", false],
      ["id_projeto", 3],
    ]);
  });

  it("EST-08 AC3: filtro de gestora muda o recorte -- liga escopo_gestora e fixa o id", async () => {
    const { client, chamadas } = criarClienteMock({
      vw_estrategia_kpi: { data: [LINHA_COMPLETA], error: null },
    });

    await buscarEstrategiaKpi(client, { idProduto: 7, idGestora: 42 });

    expect(filtrosEq(chamadas)).toEqual([
      ["id_produto", 7],
      ["escopo_projeto", false],
      ["escopo_gestora", true],
      ["id_usuario_gestora", 42],
    ]);
  });

  it("EST-08 AC3: gestora e projeto juntos lêem a linha da interseção, não duas linhas", async () => {
    const { client, chamadas } = criarClienteMock({
      vw_estrategia_kpi: { data: [LINHA_COMPLETA], error: null },
    });

    await buscarEstrategiaKpi(client, { idProduto: 7, idProjeto: 3, idGestora: 42 });

    // Os dois escopos ligados na MESMA consulta: a view já emite a linha do
    // cruzamento, então o recorte é AND por construção -- nunca duas leituras
    // combinadas depois.
    expect(filtrosEq(chamadas)).toEqual([
      ["id_produto", 7],
      ["escopo_projeto", true],
      ["escopo_gestora", true],
      ["id_projeto", 3],
      ["id_usuario_gestora", 42],
    ]);
    expect(chamadas.filter((c) => c.metodo === "from")).toHaveLength(1);
  });

  it("erro do banco propaga em vez de virar faixa de zeros", async () => {
    const { client } = criarClienteMock({
      vw_estrategia_kpi: { data: null, error: { message: "permission denied for view vw_estrategia_kpi" } },
    });

    await expect(buscarEstrategiaKpi(client, { idProduto: 7 })).rejects.toMatchObject({
      message: "permission denied for view vw_estrategia_kpi",
    });
  });
});
