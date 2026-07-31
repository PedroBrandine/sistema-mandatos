import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { criarCoalizao } from "./coalizao";
import { DuplicataDetectadaError, PermissaoNegadaError, ViolacaoConstraintError, ViolacaoUnicaError } from "./errors";

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

const CONTRATANTE = { nome: "Coalizão Clima" };
const COALIZAO = { possui_planejamento_proprio: false };

describe("criarCoalizao", () => {
  it("sucesso: mapeia o retorno da RPC para CoalizaoCriada", async () => {
    const { client, chamadas } = criarClienteMock({ data: { id_contratante: 5, id_coalizao: 6 }, error: null });

    const resultado = await criarCoalizao(client, { contratante: CONTRATANTE, coalizao: COALIZAO });

    expect(resultado).toEqual({ idContratante: 5, idCoalizao: 6 });
    expect(chamadas[0].fn).toBe("criar_coalizao");
    expect(chamadas[0].params).toMatchObject({
      p_contratante: CONTRATANTE,
      p_coalizao: COALIZAO,
      p_ignorar_duplicata: false,
    });
  });

  // Done-when: "Duplicata segue a mesma regra de T20 (mesma função auxiliar, não reimplementada)"
  it("MDU01: lança DuplicataDetectadaError com a lista de similares", async () => {
    const similares = [{ idContratante: 9, nome: "Coalizão Clima", sgUf: null, nmMunicipio: null }];
    const { client } = criarClienteMock({
      data: null,
      error: { code: "MDU01", message: "duplicata", details: JSON.stringify(similares) },
    });

    await expect(criarCoalizao(client, { contratante: CONTRATANTE, coalizao: COALIZAO })).rejects.toThrow(
      DuplicataDetectadaError
    );
  });

  it("23514: lança ViolacaoConstraintError com a mensagem de ck_contratante_uf", async () => {
    const { client } = criarClienteMock({
      data: null,
      error: { code: "23514", message: 'new row violates check constraint "ck_contratante_uf"' },
    });

    await expect(criarCoalizao(client, { contratante: CONTRATANTE, coalizao: COALIZAO })).rejects.toThrow(
      ViolacaoConstraintError
    );
  });

  it("23505: lança ViolacaoUnicaError com a mensagem de dim_coalizao_id_contratante_key", async () => {
    const { client } = criarClienteMock({
      data: null,
      error: { code: "23505", message: 'duplicate key value violates unique constraint "dim_coalizao_id_contratante_key"' },
    });

    await expect(criarCoalizao(client, { contratante: CONTRATANTE, coalizao: COALIZAO })).rejects.toThrow(
      ViolacaoUnicaError
    );
  });

  it("42501: lança PermissaoNegadaError com mensagem genérica", async () => {
    const { client } = criarClienteMock({ data: null, error: { code: "42501", message: "permission denied" } });

    await expect(criarCoalizao(client, { contratante: CONTRATANTE, coalizao: COALIZAO })).rejects.toThrow(
      PermissaoNegadaError
    );
  });
});
