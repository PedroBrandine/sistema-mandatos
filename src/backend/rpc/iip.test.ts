import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { atualizaIipContrato } from "./iip";
import { PermissaoNegadaError } from "./errors";

// Spec anchor: incidencia-encontros T25 Done-when (.specs/features/incidencia-encontros/tasks.md) --
//  - Chamada sem parâmetro: rpc("atualiza_iip_contrato") -- app.atualiza_iip_contrato() não
//    recebe nenhum argumento do chamador (design.md, "src/backend/rpc/iip.ts")
//  - 42501 -> PermissaoNegadaError (reuso, sem linha nova em MENSAGENS_*)
//  - Código não mapeado é relançado sem alteração
//
// spec.md INC-04.

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

describe("atualizaIipContrato", () => {
  it("sucesso: chama atualiza_iip_contrato sem nenhum parâmetro", async () => {
    const { client, chamadas } = criarClienteMock({ data: null, error: null });

    await atualizaIipContrato(client);

    expect(chamadas[0]).toEqual({ fn: "atualiza_iip_contrato", params: undefined });
  });

  it("42501: lança PermissaoNegadaError com mensagem genérica", async () => {
    const { client } = criarClienteMock({ data: null, error: { code: "42501", message: "permission denied" } });

    await expect(atualizaIipContrato(client)).rejects.toThrow(PermissaoNegadaError);
  });

  it("código não mapeado é relançado sem alteração", async () => {
    const erroOriginal = { code: "P0001", message: "erro inesperado" };
    const { client } = criarClienteMock({ data: null, error: erroOriginal });

    await expect(atualizaIipContrato(client)).rejects.toEqual(erroOriginal);
  });
});
