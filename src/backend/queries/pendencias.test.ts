import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarPendenciasDashboard } from "./pendencias";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/tasks.md, T17
// "Done when" (EST-07 AC4, AC6) --
//  - Retorna as categorias de vw_pendencias com mandato, tipo, detalhe e
//    data de referência
//  - Sem pendências retorna []
//  - Filtros de gestora e projeto aplicam AND, não OR
//
// Mock roteado por nome de tabela, mesmo padrão de queries/kanban.test.ts e
// queries/quadro.test.ts.

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
      is: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "is", args });
        return builder;
      },
      order: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "order", args });
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

describe("buscarPendenciasDashboard (EST-07)", () => {
  it("mapeia mandato, tipo, detalhe e data de referência de cada linha (AC4)", async () => {
    const { client } = criarClienteMock({
      fat_contrato: { data: [{ id_contrato: 1 }, { id_contrato: 2 }], error: null },
      vw_pendencias: {
        data: [
          {
            id_contrato: 1,
            nome_contratante: "Dep. Ana Ribeiro",
            categoria: "cadastro",
            detalhe: "ds_genero",
            dt_referencia: "2026-08-01",
            dias_em_aberto: 10,
          },
          {
            id_contrato: 2,
            nome_contratante: "Ver. Marcos Duarte",
            categoria: "etapa_atrasada",
            detalhe: "diagnostico",
            dt_referencia: "2026-07-01",
            dias_em_aberto: 40,
          },
        ],
        error: null,
      },
    });

    const resultado = await buscarPendenciasDashboard(client, { idProduto: 7 });

    expect(resultado).toEqual([
      {
        idContrato: 1,
        nomeContratante: "Dep. Ana Ribeiro",
        categoria: "cadastro",
        detalhe: "ds_genero",
        dtReferencia: "2026-08-01",
        diasEmAberto: 10,
      },
      {
        idContrato: 2,
        nomeContratante: "Ver. Marcos Duarte",
        categoria: "etapa_atrasada",
        detalhe: "diagnostico",
        dtReferencia: "2026-07-01",
        diasEmAberto: 40,
      },
    ]);
  });

  it("sem contratos no recorte retorna [] sem consultar vw_pendencias (AC6)", async () => {
    const { client, chamadas } = criarClienteMock({
      fat_contrato: { data: [], error: null },
    });

    const resultado = await buscarPendenciasDashboard(client, { idProduto: 7 });

    expect(resultado).toEqual([]);
    expect(chamadas.some((c) => c.tabela === "vw_pendencias")).toBe(false);
  });

  it("vw_pendencias sem linhas retorna [] (AC6)", async () => {
    const { client } = criarClienteMock({
      fat_contrato: { data: [{ id_contrato: 1 }], error: null },
      vw_pendencias: { data: [], error: null },
    });

    const resultado = await buscarPendenciasDashboard(client, { idProduto: 7 });

    expect(resultado).toEqual([]);
  });

  it("filtro de projeto restringe isoladamente -- entra no select de fat_contrato", async () => {
    const { client, chamadas } = criarClienteMock({
      fat_contrato: { data: [{ id_contrato: 1 }], error: null },
      vw_pendencias: { data: [], error: null },
    });

    await buscarPendenciasDashboard(client, { idProduto: 7, idProjeto: 3 });

    const filtrosContrato = chamadas
      .filter((c) => c.tabela === "fat_contrato" && c.metodo === "eq")
      .map((c) => c.args);
    expect(filtrosContrato).toEqual([
      ["id_produto", 7],
      ["id_projeto", 3],
    ]);
  });

  it("filtro de gestora restringe isoladamente -- consulta rel_usuario_contrato por papel gestora", async () => {
    const { client, chamadas } = criarClienteMock({
      fat_contrato: { data: [{ id_contrato: 1 }, { id_contrato: 2 }], error: null },
      rel_usuario_contrato: { data: [{ id_contrato: 1 }], error: null },
      vw_pendencias: { data: [], error: null },
    });

    await buscarPendenciasDashboard(client, { idProduto: 7, idGestora: 42 });

    const chamadaVinculo = chamadas.find((c) => c.tabela === "rel_usuario_contrato" && c.metodo === "eq");
    expect(chamadaVinculo).toBeDefined();
    const idInVwPendencias = chamadas.find((c) => c.tabela === "vw_pendencias" && c.metodo === "in");
    expect(idInVwPendencias?.args).toEqual(["id_contrato", [1]]);
  });

  it("gestora e projeto juntos aplicam AND (interseção), não OR", async () => {
    const { client, chamadas } = criarClienteMock({
      // Recorte de produto+projeto devolve {1,2,3}
      fat_contrato: { data: [{ id_contrato: 1 }, { id_contrato: 2 }, { id_contrato: 3 }], error: null },
      // Gestora tem vínculo ativo com {2,3,4} -- 4 não está no recorte de projeto
      rel_usuario_contrato: { data: [{ id_contrato: 2 }, { id_contrato: 3 }, { id_contrato: 4 }], error: null },
      vw_pendencias: { data: [], error: null },
    });

    await buscarPendenciasDashboard(client, { idProduto: 7, idProjeto: 9, idGestora: 42 });

    const idInVwPendencias = chamadas.find((c) => c.tabela === "vw_pendencias" && c.metodo === "in");
    const idsFinal = (idInVwPendencias?.args[1] as number[]).slice().sort();
    // Interseção {1,2,3} ∩ {2,3,4} = {2,3} -- nunca a união {1,2,3,4}
    expect(idsFinal).toEqual([2, 3]);
  });
});
