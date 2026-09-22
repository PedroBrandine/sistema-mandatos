import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarEstrategiaKpi } from "./estrategia-kpi";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/tasks.md, T32
// "Done when" (EST-08 AC2, AC3) --
//  - Filtros recalculam o recorte (AC3)
//  - NULL do banco chega como ausência, não como 0 (AC2 / AD-005)
//
// Mock do RPC: guarda o nome e os argumentos da chamada e devolve a resposta
// pronta. fn_estrategia_kpi é a fonte desde a migration 20260921230408 (filtro
// de seleção múltipla); a equivalência com vw_estrategia_kpi é provada no teste
// de integração (supabase/tests/estrategia/fn-estrategia-kpi.integration.test.ts),
// não aqui.

type Chamada = { funcao: string; args: Record<string, unknown> };
type Resposta = { data: unknown; error: { message: string } | null };

function criarClienteMock(resposta: Resposta) {
  const chamadas: Chamada[] = [];
  const client = {
    rpc: (funcao: string, args: Record<string, unknown>) => {
      chamadas.push({ funcao, args });
      return Promise.resolve(resposta);
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

// Linha completa da função, com os 5 KPIs + a quebra por status preenchidos.
// A quebra particiona mandatos_ativos (AD-050): 4 + 3 + 18 = 25.
const LINHA_COMPLETA = {
  mandatos_ativos: 25,
  iip_medio: 3.75,
  nps_medio: 62.5,
  pct_atingimento_medio: 55.21,
  nr_fatos_geradores: 8,
  mandatos_atraso_atrasados: 4,
  mandatos_atraso_atencao: 3,
  mandatos_atraso_normal: 18,
  componente_d1_medio: 1.4,
  componente_d2_medio: 1.2,
  componente_d3_medio: 1.15,
};

describe("buscarEstrategiaKpi (EST-08)", () => {
  it("mapeia os 5 KPIs + a quebra por status da linha devolvida para o view-model", async () => {
    const { client } = criarClienteMock({ data: [LINHA_COMPLETA], error: null });

    const resultado = await buscarEstrategiaKpi(client, { idProduto: 7 });

    expect(resultado).toEqual({
      mandatosAtivos: 25,
      iipMedio: 3.75,
      npsMedio: 62.5,
      pctAtingimentoMedio: 55.21,
      nrFatosGeradores: 8,
      mandatosAtrasoAtrasados: 4,
      mandatosAtrasoAtencao: 3,
      mandatosAtrasoNormal: 18,
      componenteD1Medio: 1.4,
      componenteD2Medio: 1.2,
      componenteD3Medio: 1.15,
    });
  });

  it("EST-08 AC2 / AD-005: NULL do banco chega como null, e o 0 do banco continua 0", async () => {
    const { client } = criarClienteMock({
      data: [
        {
          // Contagens reais: o produto tem 3 mandatos, nenhum atrasado e
          // nenhum fato gerador. Zero aqui é medição, não ausência.
          mandatos_ativos: 3,
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
          // Mesma condição de iip_medio null: sem contrato com Fato Gerador
          // realizado no recorte, os 3 componentes também ficam null.
          componente_d1_medio: null,
          componente_d2_medio: null,
          componente_d3_medio: null,
        },
      ],
      error: null,
    });

    const resultado = await buscarEstrategiaKpi(client, { idProduto: 7 });

    // Os NULL sobrevivem como null -- nenhum vira 0 no caminho.
    expect(resultado.iipMedio).toBeNull();
    expect(resultado.npsMedio).toBeNull();
    expect(resultado.pctAtingimentoMedio).toBeNull();
    expect(resultado.mandatosAtrasoAtrasados).toBeNull();
    expect(resultado.componenteD1Medio).toBeNull();
    expect(resultado.componenteD2Medio).toBeNull();
    expect(resultado.componenteD3Medio).toBeNull();
    // E os zeros/contagens reais não viram null: a distinção entre "medimos e
    // deu zero" (ou N) e "não há dado" precisa chegar intacta à tela.
    expect(resultado.nrFatosGeradores).toBe(0);
    expect(resultado.mandatosAtivos).toBe(3);
    expect(resultado.mandatosAtrasoAtencao).toBe(1);
    expect(resultado.mandatosAtrasoNormal).toBe(2);
  });

  it("EST-08 AC2 / AD-005: recorte sem nenhuma linha devolve os 11 KPIs como null, nunca zeros", async () => {
    const { client } = criarClienteMock({ data: [], error: null });

    const resultado = await buscarEstrategiaKpi(client, { idProduto: 7 });

    expect(resultado).toEqual({
      mandatosAtivos: null,
      iipMedio: null,
      npsMedio: null,
      pctAtingimentoMedio: null,
      nrFatosGeradores: null,
      mandatosAtrasoAtrasados: null,
      mandatosAtrasoAtencao: null,
      mandatosAtrasoNormal: null,
      componenteD1Medio: null,
      componenteD2Medio: null,
      componenteD3Medio: null,
    });
  });

  it("EST-08 AC3: chama fn_estrategia_kpi uma única vez e sem filtros passa só o produto", async () => {
    const { client, chamadas } = criarClienteMock({ data: [LINHA_COMPLETA], error: null });

    await buscarEstrategiaKpi(client, { idProduto: 7 });

    expect(chamadas).toEqual([
      {
        funcao: "fn_estrategia_kpi",
        args: {
          p_id_produto: 7,
          p_ids_projeto: undefined,
          p_ids_gestora: undefined,
          p_ids_contrato: undefined,
        },
      },
    ]);
  });

  it("EST-08 AC3: filtro de projeto vai como lista de ids", async () => {
    const { client, chamadas } = criarClienteMock({ data: [LINHA_COMPLETA], error: null });

    await buscarEstrategiaKpi(client, { idProduto: 7, idsProjeto: [3] });

    expect(chamadas[0].args).toMatchObject({ p_id_produto: 7, p_ids_projeto: [3] });
  });

  it("seleção múltipla: vários projetos e várias gestoras vão numa ÚNICA chamada (recorte por conjunto, nada somado no cliente)", async () => {
    const { client, chamadas } = criarClienteMock({ data: [LINHA_COMPLETA], error: null });

    await buscarEstrategiaKpi(client, { idProduto: 7, idsProjeto: [3, 4], idsGestora: [42, 43] });

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].args).toMatchObject({
      p_id_produto: 7,
      p_ids_projeto: [3, 4],
      p_ids_gestora: [42, 43],
    });
  });

  it("filtro de contrato (aba Fatos Geradores) vai como lista de ids", async () => {
    const { client, chamadas } = criarClienteMock({ data: [LINHA_COMPLETA], error: null });

    await buscarEstrategiaKpi(client, { idProduto: 7, idsContrato: [10, 11] });

    expect(chamadas[0].args).toMatchObject({ p_ids_contrato: [10, 11] });
  });

  it("erro do banco propaga em vez de virar faixa de zeros", async () => {
    const { client } = criarClienteMock({
      data: null,
      error: { message: "permission denied for function fn_estrategia_kpi" },
    });

    await expect(buscarEstrategiaKpi(client, { idProduto: 7 })).rejects.toMatchObject({
      message: "permission denied for function fn_estrategia_kpi",
    });
  });
});
