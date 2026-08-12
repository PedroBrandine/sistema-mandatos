import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { PermissaoNegadaError, ViolacaoConstraintError } from "./errors";
import { atualizarSucessosEmLote, recalcularAtingimento, substituirPreditoresPlanejamento } from "./planejamento";

// Spec anchor: PLM-02, PLM-03, PLM-07, PLM-16 (.specs/features/planejamento-planilha-monitoramento/spec.md) --
//  - recalcularAtingimento chama rpc("recalcula_atingimento", { p_id_planejamento })
//  - atualizarSucessosEmLote chama rpc("atualiza_sucessos_mensais_lote", { p_valores }) serializado em snake_case
//  - substituirPreditoresPlanejamento chama rpc("substitui_preditores_planejamento", { p_id_planejamento, p_preditores }) serializado em snake_case
//  - 42501 -> PermissaoNegadaError; 23514 em ck_sucesso_pct -> ViolacaoConstraintError com a mensagem certa
//  - código não mapeado é relançado sem alteração

type Chamada = { fn: string; params: unknown };

function criarClienteMock(resultado: { data: unknown; error: Partial<PostgrestError> | null }) {
  const chamadas: Chamada[] = [];
  const client = {
    schema: (_nome: string) => ({
      rpc: (fn: string, params: unknown) => {
        chamadas.push({ fn, params });
        return Promise.resolve(resultado);
      },
    }),
  };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

describe("recalcularAtingimento", () => {
  it("sucesso: chama recalcula_atingimento com o id do planejamento", async () => {
    const { client, chamadas } = criarClienteMock({ data: null, error: null });

    await recalcularAtingimento(client, 42);

    expect(chamadas[0]).toEqual({ fn: "recalcula_atingimento", params: { p_id_planejamento: 42 } });
  });

  it("42501: lança PermissaoNegadaError", async () => {
    const { client } = criarClienteMock({ data: null, error: { code: "42501", message: "permission denied" } });

    await expect(recalcularAtingimento(client, 42)).rejects.toThrow(PermissaoNegadaError);
  });
});

describe("atualizarSucessosEmLote", () => {
  it("sucesso: chama atualiza_sucessos_mensais_lote com o array serializado em snake_case", async () => {
    const { client, chamadas } = criarClienteMock({ data: null, error: null });

    await atualizarSucessosEmLote(client, [
      { idSucesso: 1, pctAtingimento: 80 },
      { idSucesso: 2, pctAtingimento: 100 },
    ]);

    expect(chamadas[0]).toEqual({
      fn: "atualiza_sucessos_mensais_lote",
      params: {
        p_valores: [
          { id_sucesso: 1, pct_atingimento: 80 },
          { id_sucesso: 2, pct_atingimento: 100 },
        ],
      },
    });
  });

  // ck_sucesso_pct (0 <= pct_atingimento <= 100) -- valor fora de faixa no meio
  // da faixa colada reverte o UPDATE inteiro (T6); o erro chega como 23514.
  it("23514 em ck_sucesso_pct: lança ViolacaoConstraintError com a mensagem de faixa", async () => {
    const { client } = criarClienteMock({
      data: null,
      error: { code: "23514", message: 'new row for relation "fat_sucesso_mensal" violates check constraint "ck_sucesso_pct"' },
    });

    await expect(atualizarSucessosEmLote(client, [{ idSucesso: 1, pctAtingimento: 150 }])).rejects.toThrow(
      ViolacaoConstraintError
    );
    try {
      await atualizarSucessosEmLote(client, [{ idSucesso: 1, pctAtingimento: 150 }]);
    } catch (erro) {
      expect((erro as ViolacaoConstraintError).message).toBe("Valor deve estar entre 0 e 100.");
    }
  });

  it("código não mapeado é relançado sem alteração", async () => {
    const erroOriginal = { code: "P0001", message: "erro inesperado" };
    const { client } = criarClienteMock({ data: null, error: erroOriginal });

    await expect(atualizarSucessosEmLote(client, [{ idSucesso: 1, pctAtingimento: 50 }])).rejects.toEqual(
      erroOriginal
    );
  });
});

describe("substituirPreditoresPlanejamento", () => {
  it("sucesso: chama substitui_preditores_planejamento com o array serializado em snake_case", async () => {
    const { client, chamadas } = criarClienteMock({ data: null, error: null });

    await substituirPreditoresPlanejamento(client, 7, [
      { idPreditor: 10, ordem: 1 },
      { idPreditor: 20, ordem: 2 },
    ]);

    expect(chamadas[0]).toEqual({
      fn: "substitui_preditores_planejamento",
      params: {
        p_id_planejamento: 7,
        p_preditores: [
          { id_preditor: 10, ordem: 1 },
          { id_preditor: 20, ordem: 2 },
        ],
      },
    });
  });

  it("42501: lança PermissaoNegadaError (Mentor/Assessor sem GRANT em rel_planejamento_preditor)", async () => {
    const { client } = criarClienteMock({ data: null, error: { code: "42501", message: "permission denied" } });

    await expect(substituirPreditoresPlanejamento(client, 7, [{ idPreditor: 10, ordem: 1 }])).rejects.toThrow(
      PermissaoNegadaError
    );
  });

  it("array vazio: chama a RPC com p_preditores: [] (limpa os preditores prioritários)", async () => {
    const { client, chamadas } = criarClienteMock({ data: null, error: null });

    await substituirPreditoresPlanejamento(client, 7, []);

    expect(chamadas[0]).toEqual({
      fn: "substitui_preditores_planejamento",
      params: { p_id_planejamento: 7, p_preditores: [] },
    });
  });
});
