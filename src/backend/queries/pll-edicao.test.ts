import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarEdicoesPll, buscarMentoresDisponiveis, buscarProjetosAtivos, criarEdicaoPll } from "./pll-edicao";

// Sessão 22/09: entidade fat_edicao nova. Mesmo racional de teste de
// pll-cadastro.test.ts -- mock roteado por tabela/rpc, sem bater no banco real.

type Resposta = { data: unknown; error: { message: string; code?: string } | null };

function criarClienteMockSelect(resposta: Resposta) {
  const chamadas: { metodo: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {
    select: (...args: unknown[]) => {
      chamadas.push({ metodo: "select", args });
      return builder;
    },
    eq: (...args: unknown[]) => {
      chamadas.push({ metodo: "eq", args });
      return builder;
    },
    order: (...args: unknown[]) => {
      chamadas.push({ metodo: "order", args });
      return Promise.resolve(resposta);
    },
  };
  const client = { from: () => builder };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

describe("buscarEdicoesPll", () => {
  it("mapeia id_edicao/nome/dt_inicio/id_projeto/nomeProjeto (via ref_projeto aninhado)", async () => {
    const { client } = criarClienteMockSelect({
      data: [
        { id_edicao: 1, nome: "PLL 2026.1", dt_inicio: "2026-02-01", id_projeto: 25, ref_projeto: { nome: "Bancada do Clima" } },
      ],
      error: null,
    });

    const resultado = await buscarEdicoesPll(client, 2);

    expect(resultado).toEqual([
      { idEdicao: 1, nome: "PLL 2026.1", dtInicio: "2026-02-01", idProjeto: 25, nomeProjeto: "Bancada do Clima" },
    ]);
  });

  // AD-005: projeto ausente (join falhou/nulo) nunca vira string vazia.
  it("ref_projeto ausente vira nomeProjeto: '—' (AD-005), não string vazia", async () => {
    const { client } = criarClienteMockSelect({
      data: [{ id_edicao: 1, nome: "PLL 2026.1", dt_inicio: "2026-02-01", id_projeto: 25, ref_projeto: null }],
      error: null,
    });

    const resultado = await buscarEdicoesPll(client, 2);
    expect(resultado[0].nomeProjeto).toBe("—");
  });

  it("erro do PostgREST propaga como throw", async () => {
    const { client } = criarClienteMockSelect({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    await expect(buscarEdicoesPll(client, 2)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("buscarProjetosAtivos / buscarMentoresDisponiveis", () => {
  it("buscarProjetosAtivos mapeia id_projeto/nome para {id,nome} (opcoesDeIdNome)", async () => {
    const { client } = criarClienteMockSelect({ data: [{ id_projeto: 25, nome: "Bancada do Clima" }], error: null });
    const resultado = await buscarProjetosAtivos(client);
    expect(resultado).toEqual([{ id: 25, nome: "Bancada do Clima" }]);
  });

  it("buscarMentoresDisponiveis mapeia id_usuario/nome para {id,nome}", async () => {
    const { client } = criarClienteMockSelect({ data: [{ id_usuario: 7, nome: "Carla Mentora" }], error: null });
    const resultado = await buscarMentoresDisponiveis(client);
    expect(resultado).toEqual([{ id: 7, nome: "Carla Mentora" }]);
  });
});

describe("criarEdicaoPll", () => {
  function criarClienteMockRpc(resposta: Resposta) {
    const chamadas: { rpc: string; args: unknown[] }[] = [];
    const client = {
      schema: () => ({
        rpc: (rpc: string, args: unknown) => {
          chamadas.push({ rpc, args: [args] });
          return Promise.resolve(resposta);
        },
      }),
    };
    return { client: client as unknown as SupabaseClient<Database>, chamadas };
  }

  it("chama app.criar_edicao_pll com p_mentores preenchido quando há mentores", async () => {
    const { client, chamadas } = criarClienteMockRpc({ data: { id_edicao: 9 }, error: null });

    const resultado = await criarEdicaoPll(client, {
      idProduto: 2,
      idProjeto: 25,
      nome: "PLL 2026.1",
      dtInicio: "2026-02-01",
      idsMentores: [55, 56],
    });

    expect(resultado).toEqual({ idEdicao: 9 });
    expect(chamadas[0]).toMatchObject({
      rpc: "criar_edicao_pll",
      args: [
        {
          p_id_produto: 2,
          p_id_projeto: 25,
          p_nome: "PLL 2026.1",
          p_dt_inicio: "2026-02-01",
          p_mentores: [55, 56],
        },
      ],
    });
  });

  // Lado oposto: pool vazio (edição sem mentor padrão ainda) -- p_mentores
  // vai undefined, nunca [] nem null (RPC trata undefined/ausente como "sem pool").
  it("idsMentores vazio: p_mentores vai undefined, não [] nem null", async () => {
    const { client, chamadas } = criarClienteMockRpc({ data: { id_edicao: 9 }, error: null });

    await criarEdicaoPll(client, {
      idProduto: 2,
      idProjeto: 25,
      nome: "PLL 2026.1",
      dtInicio: "2026-02-01",
      idsMentores: [],
    });

    expect((chamadas[0].args[0] as { p_mentores?: number[] }).p_mentores).toBeUndefined();
  });

  it("erro do PostgREST/RPC propaga mapeado (mapeiaErroRpc)", async () => {
    const { client } = criarClienteMockRpc({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });

    await expect(
      criarEdicaoPll(client, { idProduto: 2, idProjeto: 25, nome: "X", dtInicio: "2026-02-01", idsMentores: [] })
    ).rejects.toMatchObject({ name: "PermissaoNegadaError" });
  });
});
