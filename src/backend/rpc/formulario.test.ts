import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { atualizarAvaliacaoNps } from "./formulario";
import { PermissaoNegadaError } from "./errors";

// Spec anchor: formularios-produto T13 Done-when (.specs/features/formularios-produto/tasks.md) --
//  - Função chama client.schema("app").rpc("atualiza_avaliacao_nps"), sem nenhum parâmetro
//  - 42501 -> PermissaoNegadaError (reuso, mesmo padrão de rpc/iip.ts)
//  - Código não mapeado é relançado sem alteração
//
// spec.md FRM-21.

type Chamada = { fn: string; params: unknown };

function criarClienteMock(resultado: { data: unknown; error: Partial<PostgrestError> | null }) {
  const chamadas: Chamada[] = [];
  const client = {
    schema: (_nome: string) => ({
      rpc: (fn: string, params?: unknown) => {
        chamadas.push({ fn, params });
        return Promise.resolve(resultado);
      },
    }),
  };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

describe("atualizarAvaliacaoNps", () => {
  it("sucesso: chama atualiza_avaliacao_nps sem nenhum parâmetro", async () => {
    const { client, chamadas } = criarClienteMock({ data: null, error: null });

    await atualizarAvaliacaoNps(client);

    expect(chamadas[0]).toEqual({ fn: "atualiza_avaliacao_nps", params: undefined });
  });

  it("42501: lança PermissaoNegadaError com mensagem genérica", async () => {
    const { client } = criarClienteMock({ data: null, error: { code: "42501", message: "permission denied" } });

    await expect(atualizarAvaliacaoNps(client)).rejects.toThrow(PermissaoNegadaError);
  });

  it("código não mapeado é relançado sem alteração", async () => {
    const erroOriginal = { code: "P0001", message: "erro inesperado" };
    const { client } = criarClienteMock({ data: null, error: erroOriginal });

    await expect(atualizarAvaliacaoNps(client)).rejects.toEqual(erroOriginal);
  });
});
