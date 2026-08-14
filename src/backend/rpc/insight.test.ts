import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { PermissaoNegadaError } from "./errors";
import { criarInsight } from "./insight";

// Spec anchor: incidencia-encontros T24 Done-when (.specs/features/incidencia-encontros/tasks.md) --
//  - Payload correto: chama rpc("criar_insight", { p_id_contrato, p_conteudo, ... }) com os params
//    corretos, camelCase -> p_snake_case (mesma forma de T23/fato-gerador.ts)
//  - Campos opcionais ausentes viram `undefined` no payload (omitidos), não `null`
//  - 42501 -> PermissaoNegadaError
//  - Erro de validação cross-contrato (RAISE EXCEPTION sem ERRCODE, P0001 -- design.md Error
//    Handling Strategy: "Meta X não pertence ao contrato Y") é relançado sem alteração
//
// spec.md INC-12, INC-13, INC-14.

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

describe("criarInsight", () => {
  it("sucesso: chama criar_insight com o payload completo e retorna idInsight", async () => {
    const { client, chamadas } = criarClienteMock({ data: 15, error: null });

    const resultado = await criarInsight(client, {
      idContrato: 1,
      conteudo: "Observação qualitativa",
      desdobramentos: "Desdobramento X",
      comprovacaoDados: "Print do Slack",
      ocorridoEm: "2026-08-13",
      idPilar: 2,
      idRegistro: 3,
      idMetaOrigem: 4,
      idSucessoOrigem: 5,
    });

    expect(chamadas[0]).toEqual({
      fn: "criar_insight",
      params: {
        p_id_contrato: 1,
        p_conteudo: "Observação qualitativa",
        p_desdobramentos: "Desdobramento X",
        p_comprovacao_dados: "Print do Slack",
        p_ocorrido_em: "2026-08-13",
        p_id_pilar: 2,
        p_id_registro: 3,
        p_id_meta_origem: 4,
        p_id_sucesso_origem: 5,
      },
    });
    expect(resultado).toEqual({ idInsight: 15 });
  });

  it("sucesso: payload mínimo (sem origem) omite os campos opcionais ausentes (undefined, não null)", async () => {
    const { client, chamadas } = criarClienteMock({ data: 9, error: null });

    const resultado = await criarInsight(client, { idContrato: 1, conteudo: "Só o conteúdo" });

    expect(chamadas[0]).toEqual({
      fn: "criar_insight",
      params: {
        p_id_contrato: 1,
        p_conteudo: "Só o conteúdo",
        p_desdobramentos: undefined,
        p_comprovacao_dados: undefined,
        p_ocorrido_em: undefined,
        p_id_pilar: undefined,
        p_id_registro: undefined,
        p_id_meta_origem: undefined,
        p_id_sucesso_origem: undefined,
      },
    });
    expect(resultado).toEqual({ idInsight: 9 });
  });

  it("42501: lança PermissaoNegadaError com mensagem genérica", async () => {
    const { client } = criarClienteMock({ data: null, error: { code: "42501", message: "permission denied" } });

    await expect(criarInsight(client, { idContrato: 1, conteudo: "x" })).rejects.toThrow(PermissaoNegadaError);
  });

  it("Meta/Sucesso/Registro de outro contrato (RAISE EXCEPTION sem ERRCODE): relançado sem alteração", async () => {
    const erroOriginal = { code: "P0001", message: "Meta 4 não pertence ao contrato 1" };
    const { client } = criarClienteMock({ data: null, error: erroOriginal });

    await expect(
      criarInsight(client, { idContrato: 1, conteudo: "x", idMetaOrigem: 4 })
    ).rejects.toEqual(erroOriginal);
  });
});
