import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { emitirConvite } from "./convite";
import { PermissaoNegadaError, ViolacaoConstraintError } from "./errors";

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

describe("emitirConvite", () => {
  it("sucesso: chama app.emitir_convite com o hash do token (nunca o token em claro) e devolve o caminho", async () => {
    const { client, chamadas } = criarClienteMock({ data: 42, error: null });

    const resultado = await emitirConvite(client, {
      idContrato: 10,
      email: "Assessor@Exemplo.com ",
      papelNoContrato: "assessor",
      cargo: "assessor",
      grauResponsabilidade: "titular",
      areas: ["saude"],
    });

    expect(resultado.caminho).toMatch(/^\/convite\/[0-9a-f]{64}$/);
    const token = resultado.caminho.replace("/convite/", "");

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].fn).toBe("emitir_convite");
    const params = chamadas[0].params as Record<string, unknown>;
    expect(params.p_id_contrato).toBe(10);
    // e-mail normalizado (trim + lowercase) antes de chegar no RPC
    expect(params.p_email).toBe("assessor@exemplo.com");
    expect(params.p_papel).toBe("assessor");
    expect(params.p_cargo).toBe("assessor");
    expect(params.p_grau_responsabilidade).toBe("titular");
    expect(params.p_areas).toEqual(["saude"]);
    // token_hash é o SHA-256 do token devolvido -- nunca o token em claro
    expect(params.p_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(params.p_token_hash).not.toBe(token);
  });

  it("dois convites emitidos em sequência geram tokens diferentes (nunca reusa)", async () => {
    const { client } = criarClienteMock({ data: 1, error: null });

    const primeiro = await emitirConvite(client, { idContrato: 1, email: "x@y.com", papelNoContrato: "mentor" });
    const segundo = await emitirConvite(client, { idContrato: 1, email: "x@y.com", papelNoContrato: "mentor" });

    expect(primeiro.caminho).not.toBe(segundo.caminho);
  });

  it("23514: lança ViolacaoConstraintError com a mensagem de ck_convite_papel", async () => {
    const { client } = criarClienteMock({
      data: null,
      error: { code: "23514", message: 'new row violates check constraint "ck_convite_papel"' },
    });

    await expect(
      emitirConvite(client, { idContrato: 1, email: "x@y.com", papelNoContrato: "mentor" })
    ).rejects.toThrow(ViolacaoConstraintError);
  });

  it("42501: lança PermissaoNegadaError com mensagem genérica", async () => {
    const { client } = criarClienteMock({ data: null, error: { code: "42501", message: "permission denied" } });

    await expect(
      emitirConvite(client, { idContrato: 1, email: "x@y.com", papelNoContrato: "assessor" })
    ).rejects.toThrow(PermissaoNegadaError);
  });
});
