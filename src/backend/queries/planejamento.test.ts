import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarGradeSucessosMensais, buscarPlanejamentoCompleto } from "./planejamento";

// Spec anchor: PLM-01 (.specs/features/planejamento-planilha-monitoramento/spec.md) --
//  - buscarPlanejamentoCompleto retorna a árvore Objetivo->Meta de um contrato,
//    mapeamento snake_case->camelCase completo, contrato sem planejamento retorna null
//  - buscarGradeSucessosMensais retorna os Sucessos Mensais das Metas informadas
//    num mês, dias_atraso/esta_atrasado derivados nunca recalculados no client
//  - Lista vazia (sem objetivos, sem idsMeta) nunca lança

// Mesmo padrão de kanban.test.ts: mock roteado por nome de tabela, fila de
// respostas quando a mesma tabela é consultada mais de uma vez.
type Chamada = { tabela: string; metodo: string; args: unknown[] };
type RespostaTabela = { data: unknown; error: { message: string } | null };

function criarClienteMock(respostasPorTabela: Record<string, RespostaTabela | RespostaTabela[]>) {
  const chamadas: Chamada[] = [];
  const filas = new Map<string, RespostaTabela[]>(
    Object.entries(respostasPorTabela).map(([tabela, resp]) => [tabela, Array.isArray(resp) ? [...resp] : [resp]])
  );

  function proximaResposta(tabela: string): RespostaTabela {
    const fila = filas.get(tabela);
    if (!fila || fila.length === 0) return { data: null, error: null };
    return fila.length > 1 ? fila.shift()! : fila[0];
  }

  function criarBuilder(tabela: string) {
    const resposta = proximaResposta(tabela);
    const builder: Record<string, unknown> = {
      select: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "select", args });
        return builder;
      },
      eq: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "eq", args });
        return builder;
      },
      in: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "in", args });
        return builder;
      },
      order: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "order", args });
        return builder;
      },
      maybeSingle: () => {
        chamadas.push({ tabela, metodo: "maybeSingle", args: [] });
        return Promise.resolve(resposta);
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

describe("buscarPlanejamentoCompleto", () => {
  it("retorna null quando o contrato não tem dim_planejamento", async () => {
    const { client } = criarClienteMock({ dim_planejamento: { data: null, error: null } });
    const resultado = await buscarPlanejamentoCompleto(client, 999);
    expect(resultado).toBeNull();
  });

  it("retorna a árvore Objetivo->Meta completa, mapeada para camelCase", async () => {
    const { client } = criarClienteMock({
      dim_planejamento: {
        data: {
          id_planejamento: 1,
          id_contrato: 10,
          objetivo_ano: "Consolidar mandato",
          legado: null,
          analise_conjuntura: null,
          pct_atingimento: 42.5,
          atingimento_desatualizado: false,
        },
        error: null,
      },
      fat_objetivo_especifico: {
        data: [
          {
            id_objetivo: 100,
            id_planejamento: 1,
            descricao: "Aprovar projeto X",
            id_preditor_primario: 5,
            id_preditor_secundario: null,
            pct_atingimento: 50,
          },
        ],
        error: null,
      },
      fat_meta: {
        data: [
          {
            id_meta: 200,
            id_objetivo: 100,
            descricao: "Realizar 3 audiências",
            classe: "programatica",
            status: "ativa",
            pct_atingimento: 60,
            id_preditor_primario: 5,
            id_preditor_secundario: null,
          },
        ],
        error: null,
      },
    });

    const resultado = await buscarPlanejamentoCompleto(client, 10);

    expect(resultado).not.toBeNull();
    expect(resultado?.idPlanejamento).toBe(1);
    expect(resultado?.pctAtingimento).toBe(42.5);
    expect(resultado?.objetivos).toHaveLength(1);
    expect(resultado?.objetivos[0]).toEqual({
      idObjetivo: 100,
      idPlanejamento: 1,
      descricao: "Aprovar projeto X",
      idPreditorPrimario: 5,
      idPreditorSecundario: null,
      pctAtingimento: 50,
      metas: [
        {
          idMeta: 200,
          idObjetivo: 100,
          descricao: "Realizar 3 audiências",
          classe: "programatica",
          status: "ativa",
          pctAtingimento: 60,
          idPreditorPrimario: 5,
          idPreditorSecundario: null,
        },
      ],
    });
  });

  it("retorna objetivos: [] sem consultar fat_meta quando não há objetivo nenhum", async () => {
    const { client, chamadas } = criarClienteMock({
      dim_planejamento: {
        data: {
          id_planejamento: 1,
          id_contrato: 10,
          objetivo_ano: null,
          legado: null,
          analise_conjuntura: null,
          pct_atingimento: null,
          atingimento_desatualizado: false,
        },
        error: null,
      },
      fat_objetivo_especifico: { data: [], error: null },
    });

    const resultado = await buscarPlanejamentoCompleto(client, 10);

    expect(resultado?.objetivos).toEqual([]);
    expect(chamadas.some((c) => c.tabela === "fat_meta")).toBe(false);
  });
});

describe("buscarGradeSucessosMensais", () => {
  it("retorna [] sem consultar o banco quando idsMeta está vazio", async () => {
    const { client, chamadas } = criarClienteMock({});
    const resultado = await buscarGradeSucessosMensais(client, [], "2026-08-01");
    expect(resultado).toEqual([]);
    expect(chamadas).toEqual([]);
  });

  it("mapeia os Sucessos Mensais para camelCase, com dias_atraso/esta_atrasado vindos da view", async () => {
    const { client, chamadas } = criarClienteMock({
      vw_sucesso_mensal: {
        data: [
          {
            id_sucesso: 300,
            id_meta: 200,
            descricao: "Publicar post sobre o tema",
            mes_referencia: "2026-08-01",
            dt_limite: "2026-08-15",
            peso: 100,
            pct_atingimento: 80,
            status: "realizado",
            dias_atraso: 0,
            esta_atrasado: false,
          },
        ],
        error: null,
      },
    });

    const resultado = await buscarGradeSucessosMensais(client, [200], "2026-08-01");

    expect(resultado).toEqual([
      {
        idSucesso: 300,
        idMeta: 200,
        descricao: "Publicar post sobre o tema",
        mesReferencia: "2026-08-01",
        dtLimite: "2026-08-15",
        peso: 100,
        pctAtingimento: 80,
        status: "realizado",
        diasAtraso: 0,
        estaAtrasado: false,
      },
    ]);

    const chamadaIn = chamadas.find((c) => c.tabela === "vw_sucesso_mensal" && c.metodo === "in");
    expect(chamadaIn?.args).toEqual(["id_meta", [200]]);
    const chamadaEq = chamadas.find((c) => c.tabela === "vw_sucesso_mensal" && c.metodo === "eq");
    expect(chamadaEq?.args).toEqual(["mes_referencia", "2026-08-01"]);
  });

  it("nunca lança quando a view não retorna linha nenhuma", async () => {
    const { client } = criarClienteMock({ vw_sucesso_mensal: { data: [], error: null } });
    const resultado = await buscarGradeSucessosMensais(client, [200], "2026-08-01");
    expect(resultado).toEqual([]);
  });
});
