import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { PermissaoNegadaError, ViolacaoConstraintError } from "./errors";
import { criarFatoGerador } from "./fato-gerador";

// Spec anchor: incidencia-encontros T23 Done-when (.specs/features/incidencia-encontros/tasks.md) --
//  - Payload correto: chama rpc("criar_fato_gerador", { p_id_contrato, p_id_tipologia, ... }) com os
//    params corretos, camelCase -> p_snake_case (mesmo padrão de rpc/kanban.ts)
//  - Campos opcionais ausentes viram `undefined` no payload (omitidos), não `null` -- DEFAULT do
//    banco assume (mesmo padrão de emitirConvite/substituirVinculo)
//  - ck_fato_niveis (23514) -> ViolacaoConstraintError com a mensagem certa
//  - 42501 -> PermissaoNegadaError
//  - Código não mapeado é relançado sem alteração
//
// spec.md INC-01, INC-02.

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

describe("criarFatoGerador", () => {
  it("sucesso: chama criar_fato_gerador com o payload completo e retorna idFatoGerador", async () => {
    const { client, chamadas } = criarClienteMock({ data: 42, error: null });

    const resultado = await criarFatoGerador(client, {
      idContrato: 1,
      idTipologia: 2,
      nivelD1: "alto",
      nivelD2: "medio",
      nivelD3: null,
      idPreditor1: 3,
      idPreditor2: 4,
      contribuicaoLegisla: 5,
      descricaoEvidencia: "evidência",
      dtOcorrencia: "2026-08-13",
      idMetaOrigem: 10,
      idInsightOrigem: null,
    });

    expect(chamadas[0]).toEqual({
      fn: "criar_fato_gerador",
      params: {
        p_id_contrato: 1,
        p_id_tipologia: 2,
        p_nivel_d1: "alto",
        p_nivel_d2: "medio",
        p_nivel_d3: undefined,
        p_id_preditor_1: 3,
        p_id_preditor_2: 4,
        p_contribuicao_legisla: 5,
        p_descricao_evidencia: "evidência",
        p_dt_ocorrencia: "2026-08-13",
        p_id_meta_origem: 10,
        p_id_insight_origem: undefined,
      },
    });
    expect(resultado).toEqual({ idFatoGerador: 42 });
  });

  it("sucesso: payload mínimo omite os campos opcionais ausentes (undefined, não null)", async () => {
    const { client, chamadas } = criarClienteMock({ data: 7, error: null });

    const resultado = await criarFatoGerador(client, { idContrato: 1, idTipologia: 2, nivelD1: "baixo" });

    expect(chamadas[0]).toEqual({
      fn: "criar_fato_gerador",
      params: {
        p_id_contrato: 1,
        p_id_tipologia: 2,
        p_nivel_d1: "baixo",
        p_nivel_d2: undefined,
        p_nivel_d3: undefined,
        p_id_preditor_1: undefined,
        p_id_preditor_2: undefined,
        p_contribuicao_legisla: undefined,
        p_descricao_evidencia: undefined,
        p_dt_ocorrencia: undefined,
        p_id_meta_origem: undefined,
        p_id_insight_origem: undefined,
      },
    });
    expect(resultado).toEqual({ idFatoGerador: 7 });
  });

  it("ck_fato_niveis (23514): lança ViolacaoConstraintError com a mensagem de campo", async () => {
    const { client } = criarClienteMock({
      data: null,
      error: {
        code: "23514",
        message: 'new row for relation "fat_fato_gerador" violates check constraint "ck_fato_niveis"',
      },
    });

    await expect(
      criarFatoGerador(client, { idContrato: 1, idTipologia: 2 })
    ).rejects.toThrow(ViolacaoConstraintError);
    try {
      await criarFatoGerador(client, { idContrato: 1, idTipologia: 2 });
    } catch (erro) {
      expect((erro as ViolacaoConstraintError).message).toBe("Preencha ao menos um nível (D1, D2 ou D3).");
    }
  });

  it("42501: lança PermissaoNegadaError com mensagem genérica", async () => {
    const { client } = criarClienteMock({ data: null, error: { code: "42501", message: "permission denied" } });

    await expect(
      criarFatoGerador(client, { idContrato: 1, idTipologia: 2, nivelD1: "alto" })
    ).rejects.toThrow(PermissaoNegadaError);
  });

  it("código não mapeado é relançado sem alteração", async () => {
    const erroOriginal = { code: "P0001", message: "Meta 5 não pertence ao contrato 1" };
    const { client } = criarClienteMock({ data: null, error: erroOriginal });

    await expect(
      criarFatoGerador(client, { idContrato: 1, idTipologia: 2, nivelD1: "alto", idMetaOrigem: 5 })
    ).rejects.toEqual(erroOriginal);
  });
});
