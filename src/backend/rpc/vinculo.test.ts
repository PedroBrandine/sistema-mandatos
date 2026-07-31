import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { PermissaoNegadaError, ViolacaoConstraintError, ViolacaoUnicaError } from "./errors";
import { substituirVinculo } from "./vinculo";

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

describe("substituirVinculo", () => {
  it("sucesso: retorna o id_vinculo da linha nova", async () => {
    const { client, chamadas } = criarClienteMock({ data: 77, error: null });

    const resultado = await substituirVinculo(client, { idVinculoAntigo: 1, idUsuarioNovo: 2 });

    expect(resultado).toBe(77);
    expect(chamadas[0]).toEqual({
      fn: "substituir_vinculo",
      params: {
        p_id_vinculo_antigo: 1,
        p_id_usuario_novo: 2,
        p_cargo: undefined,
        p_grau_responsabilidade: undefined,
        p_areas: undefined,
      },
    });
  });

  it("23514: lança ViolacaoConstraintError com a mensagem de ck_vinculo_cargo", async () => {
    const { client } = criarClienteMock({
      data: null,
      error: { code: "23514", message: 'new row violates check constraint "ck_vinculo_cargo"' },
    });

    await expect(
      substituirVinculo(client, { idVinculoAntigo: 1, idUsuarioNovo: 2, cargo: "assessor" })
    ).rejects.toThrow(ViolacaoConstraintError);
  });

  it("23505: lança ViolacaoUnicaError com a mensagem de uq_vinculo", async () => {
    const { client } = criarClienteMock({
      data: null,
      error: { code: "23505", message: 'duplicate key value violates unique constraint "uq_vinculo"' },
    });

    await expect(substituirVinculo(client, { idVinculoAntigo: 1, idUsuarioNovo: 2 })).rejects.toThrow(
      ViolacaoUnicaError
    );
  });

  it("42501: lança PermissaoNegadaError com mensagem genérica", async () => {
    const { client } = criarClienteMock({ data: null, error: { code: "42501", message: "permission denied" } });

    await expect(substituirVinculo(client, { idVinculoAntigo: 1, idUsuarioNovo: 2 })).rejects.toThrow(
      PermissaoNegadaError
    );
  });

  // T23: "vínculo já encerrado" usa SQLSTATE padrão P0001 (sem ERRCODE
  // customizado) -- não é um dos 4 códigos mapeados; deve passar sem alteração.
  it("código não mapeado (ex.: P0001, vínculo já encerrado) é relançado sem alteração", async () => {
    const erroOriginal = { code: "P0001", message: "vínculo já encerrado" };
    const { client } = criarClienteMock({ data: null, error: erroOriginal });

    await expect(substituirVinculo(client, { idVinculoAntigo: 1, idUsuarioNovo: 2 })).rejects.toEqual(erroOriginal);
  });
});
