import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarOpcoesEdicaoPll, buscarOpcoesMentoradoPll } from "./pll-agenda";

// Spec anchor: pll-dashboard-agenda T14 Done-when (tasks.md) -- PLL-AG-08.
// buscarOpcoesMentorPll é reexportado de pll-dashboard.ts (já coberto em
// pll-dashboard.test.ts, T12) -- não reteste aqui.
//
// Mesmo mock roteado por tabela de pll-dashboard.test.ts.

type RespostaTabela = { data: unknown; error: { message: string } | null };

function criarClienteMock(respostasPorTabela: Record<string, RespostaTabela | RespostaTabela[]>) {
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
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      is: () => builder,
      order: () => builder,
      not: () => builder,
      then: (resolve: (valor: RespostaTabela) => void, reject: (erro: unknown) => void) =>
        Promise.resolve(resposta).then(resolve, reject),
    };
    return builder;
  }

  const client = { from: (tabela: string) => criarBuilder(tabela) };
  return client as unknown as SupabaseClient<Database>;
}

const OK = { error: null };

describe("buscarOpcoesMentoradoPll (T14, PLL-AG-08)", () => {
  it("caminho feliz: devolve os mentorados (assessor ativo) dos contratos do produto", async () => {
    const client = criarClienteMock({
      fat_contrato: { data: [{ id_contrato: 1 }], ...OK },
      rel_usuario_contrato: { data: [{ id_usuario: 300 }], ...OK },
      dim_usuario: { data: [{ id_usuario: 300, nome: "Ana Souza" }], ...OK },
    });

    const resultado = await buscarOpcoesMentoradoPll(client, 9);

    expect(resultado).toEqual([{ id: 300, nome: "Ana Souza" }]);
  });

  it("recorte sem nenhum contrato devolve [], nunca lança", async () => {
    const client = criarClienteMock({ fat_contrato: { data: [], ...OK } });

    expect(await buscarOpcoesMentoradoPll(client, 9)).toEqual([]);
  });

  it("erro do banco propaga", async () => {
    const client = criarClienteMock({
      fat_contrato: { data: null, error: { message: "permission denied for table fat_contrato" } },
    });

    await expect(buscarOpcoesMentoradoPll(client, 9)).rejects.toMatchObject({
      message: "permission denied for table fat_contrato",
    });
  });
});

describe("buscarOpcoesEdicaoPll (T14, PLL-AG-08)", () => {
  it("caminho feliz: devolve as edições (ref_projeto) dos contratos do produto", async () => {
    const client = criarClienteMock({
      fat_contrato: { data: [{ id_projeto: 10 }], ...OK },
      ref_projeto: { data: [{ id_projeto: 10, nome: "2026.1" }], ...OK },
    });

    const resultado = await buscarOpcoesEdicaoPll(client, 9);

    expect(resultado).toEqual([{ id: 10, nome: "2026.1" }]);
  });

  it("recorte sem projeto associado devolve []", async () => {
    const client = criarClienteMock({ fat_contrato: { data: [], ...OK } });

    expect(await buscarOpcoesEdicaoPll(client, 9)).toEqual([]);
  });
});
