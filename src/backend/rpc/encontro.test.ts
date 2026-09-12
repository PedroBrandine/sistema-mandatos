import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { marcarPresenca } from "./encontro";
import { ErroBancoNaoMapeadoError, PermissaoNegadaError } from "./errors";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/tasks.md, T29
// "Done when" (EST-13 AC4, AC5) --
//  - Wrapper assere cada parâmetro repassado (lição L-004)
//  - 42501 -> PermissaoNegadaError (reuso, sem linha nova em MENSAGENS_*)
//  - Código não mapeado chega como ErroBancoNaoMapeadoError
//
// Mesmo padrão de rpc/kanban.test.ts.

type Chamada = { schema: string; fn: string; params: unknown };

function criarClienteMock(resultado: { data: unknown; error: Partial<PostgrestError> | null }) {
  const chamadas: Chamada[] = [];
  const client = {
    schema: (nome: string) => ({
      rpc: (fn: string, params: unknown) => {
        chamadas.push({ schema: nome, fn, params });
        return Promise.resolve(resultado);
      },
    }),
  };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

describe("marcarPresenca (EST-13 AC4)", () => {
  it("sucesso: chama app.marcar_presenca com p_id_encontro repassado verbatim (L-004)", async () => {
    const { client, chamadas } = criarClienteMock({ data: null, error: null });

    await marcarPresenca(client, { idEncontro: 501 });

    expect(chamadas[0]).toEqual({
      schema: "app",
      fn: "marcar_presenca",
      params: { p_id_encontro: 501 },
    });
  });

  it("não inventa parâmetro nenhum além de p_id_encontro", async () => {
    const { client, chamadas } = criarClienteMock({ data: null, error: null });

    await marcarPresenca(client, { idEncontro: 501 });

    expect(Object.keys(chamadas[0].params as object)).toEqual(["p_id_encontro"]);
  });

  it("sucesso não lança — AC5 trata o encontro já realizado como idempotente, não como erro", async () => {
    const { client } = criarClienteMock({ data: null, error: null });

    await expect(marcarPresenca(client, { idEncontro: 501 })).resolves.toBeUndefined();
  });

  it("42501: lança PermissaoNegadaError", async () => {
    const { client } = criarClienteMock({
      data: null,
      error: { code: "42501", message: "Encontro não encontrado ou sem permissão." },
    });

    await expect(marcarPresenca(client, { idEncontro: 501 })).rejects.toBeInstanceOf(
      PermissaoNegadaError
    );
  });

  it("código não mapeado vira ErroBancoNaoMapeadoError, preservando código e mensagem", async () => {
    const { client } = criarClienteMock({
      data: null,
      error: { code: "XX999", message: "falha interna" },
    });

    await expect(marcarPresenca(client, { idEncontro: 501 })).rejects.toBeInstanceOf(
      ErroBancoNaoMapeadoError
    );
  });
});
