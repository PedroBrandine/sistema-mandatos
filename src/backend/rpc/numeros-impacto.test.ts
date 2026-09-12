import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { atualizaNumerosImpacto } from "./numeros-impacto";
import { PermissaoNegadaError } from "./errors";
import { ErroBancoNaoMapeadoError } from "./errors";

// Spec anchor: saida-numeros-impacto T6 Done-when (.specs/features/saida-numeros-impacto/tasks.md) --
//  - Chamada sem parâmetro: rpc("atualiza_numeros_impacto") -- app.atualiza_numeros_impacto()
//    não recebe nenhum argumento do chamador (design.md, "src/backend/rpc/numeros-impacto.ts")
//  - 42501 -> PermissaoNegadaError (reuso, sem linha nova em MENSAGENS_*)
//  - Código não mapeado chega como Error, com código e mensagem preservados
//
// spec.md SAI-02. Mesmo molde de rpc/iip.test.ts (atualizaIipContrato).

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

describe("atualizaNumerosImpacto", () => {
  it("sucesso: chama atualiza_numeros_impacto sem nenhum parâmetro", async () => {
    const { client, chamadas } = criarClienteMock({ data: null, error: null });

    await atualizaNumerosImpacto(client);

    expect(chamadas[0]).toEqual({ fn: "atualiza_numeros_impacto", params: undefined });
  });

  it("42501: lança PermissaoNegadaError com mensagem genérica", async () => {
    const { client } = criarClienteMock({ data: null, error: { code: "42501", message: "permission denied" } });

    await expect(atualizaNumerosImpacto(client)).rejects.toThrow(PermissaoNegadaError);
  });

  it("código não mapeado chega como Error, com código e mensagem preservados", async () => {
    const erroOriginal = { code: "P0001", message: "erro inesperado" };
    const { client } = criarClienteMock({ data: null, error: erroOriginal });

    const capturado = await (atualizaNumerosImpacto(client)).catch((e: unknown) => e);

    // T24 (redesenho-estrategia-tela-first): esta asserção era
    // `toEqual(erroOriginal)` e passava porque `mapeiaErroRpc` devolvia o
    // objeto cru do PostgREST. Só que esse objeto NAO e um Error em runtime,
    // e todo `catch (e)` da UI na forma
    // `e instanceof Error ? e.message : "<generico>"` descartava a mensagem
    // do banco. O contrato agora e mais forte: chega como Error de verdade,
    // com codigo e mensagem preservados.
    expect(capturado).toBeInstanceOf(ErroBancoNaoMapeadoError);
    expect((capturado as ErroBancoNaoMapeadoError).codigo).toBe(erroOriginal.code);
    expect((capturado as Error).message).toContain(erroOriginal.code);
    expect((capturado as Error).message).toContain(erroOriginal.message);
  });
});
