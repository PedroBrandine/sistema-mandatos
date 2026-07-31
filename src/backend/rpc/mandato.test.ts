import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { DuplicataDetectadaError, PermissaoNegadaError, ViolacaoConstraintError, ViolacaoUnicaError } from "./errors";
import { criarMandato, marcarCandidaturaVigente } from "./mandato";

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

const CONTRATANTE = { nome: "Fulano" };
const MANDATO = { nr_titulo_eleitoral: "123456789012" };

describe("criarMandato", () => {
  it("sucesso: mapeia o retorno da RPC para MandatoCriado", async () => {
    const { client, chamadas } = criarClienteMock({
      data: { id_contratante: 1, id_mandato: 2, id_vinculo_tse: 3 },
      error: null,
    });

    const resultado = await criarMandato(client, { contratante: CONTRATANTE, mandato: MANDATO });

    expect(resultado).toEqual({ idContratante: 1, idMandato: 2, idVinculoTse: 3 });
    expect(chamadas[0].fn).toBe("criar_mandato");
    expect(chamadas[0].params).toMatchObject({
      p_contratante: CONTRATANTE,
      p_mandato: MANDATO,
      p_candidatura: null,
      p_ignorar_duplicata: false,
    });
  });

  // Done-when: "Cada wrapper mapeia MDU01 → erro DuplicataDetectada com a lista de similares"
  it("MDU01: lança DuplicataDetectadaError com a lista de similares", async () => {
    const similares = [{ idContratante: 9, nome: "Fulano", sgUf: "SP", nmMunicipio: "São Paulo" }];
    const { client } = criarClienteMock({
      data: null,
      error: { code: "MDU01", message: "duplicata", details: JSON.stringify(similares) },
    });

    await expect(criarMandato(client, { contratante: CONTRATANTE, mandato: MANDATO })).rejects.toThrow(
      DuplicataDetectadaError
    );
    try {
      await criarMandato(client, { contratante: CONTRATANTE, mandato: MANDATO });
    } catch (erro) {
      expect((erro as DuplicataDetectadaError).similares).toEqual(similares);
    }
  });

  // Done-when: "Cada wrapper mapeia 23514/23505/42501 conforme a tabela de Error Handling do design"
  it("23514: lança ViolacaoConstraintError com a mensagem de ck_mandato_titulo", async () => {
    const { client } = criarClienteMock({
      data: null,
      error: { code: "23514", message: 'new row violates check constraint "ck_mandato_titulo"' },
    });

    await expect(criarMandato(client, { contratante: CONTRATANTE, mandato: MANDATO })).rejects.toThrow(
      ViolacaoConstraintError
    );
    try {
      await criarMandato(client, { contratante: CONTRATANTE, mandato: MANDATO });
    } catch (erro) {
      expect((erro as ViolacaoConstraintError).message).toBe("Título eleitoral deve ter exatamente 12 dígitos.");
    }
  });

  it("23505: lança ViolacaoUnicaError com a mensagem de uq_mandato_candidatura", async () => {
    const { client } = criarClienteMock({
      data: null,
      error: { code: "23505", message: 'duplicate key value violates unique constraint "uq_mandato_candidatura"' },
    });

    await expect(criarMandato(client, { contratante: CONTRATANTE, mandato: MANDATO })).rejects.toThrow(
      ViolacaoUnicaError
    );
  });

  it("42501: lança PermissaoNegadaError com mensagem genérica", async () => {
    const { client } = criarClienteMock({ data: null, error: { code: "42501", message: "permission denied" } });

    await expect(criarMandato(client, { contratante: CONTRATANTE, mandato: MANDATO })).rejects.toThrow(
      PermissaoNegadaError
    );
  });
});

describe("marcarCandidaturaVigente", () => {
  it("sucesso: chama a RPC com p_id_vinculo_tse e resolve sem valor", async () => {
    const { client, chamadas } = criarClienteMock({ data: null, error: null });

    await expect(marcarCandidaturaVigente(client, 42)).resolves.toBeUndefined();
    expect(chamadas[0]).toEqual({ fn: "marcar_candidatura_vigente", params: { p_id_vinculo_tse: 42 } });
  });

  it("23505: lança ViolacaoUnicaError com a mensagem de uq_mandato_candidatura_vigente", async () => {
    const { client } = criarClienteMock({
      data: null,
      error: { code: "23505", message: 'duplicate key value violates unique constraint "uq_mandato_candidatura_vigente"' },
    });

    await expect(marcarCandidaturaVigente(client, 42)).rejects.toThrow(ViolacaoUnicaError);
  });

  it("42501: lança PermissaoNegadaError", async () => {
    const { client } = criarClienteMock({ data: null, error: { code: "42501", message: "permission denied" } });

    await expect(marcarCandidaturaVigente(client, 42)).rejects.toThrow(PermissaoNegadaError);
  });

  it("código não mapeado (ex.: P0001) é relançado sem alteração, nunca engolido em silêncio", async () => {
    const erroOriginal = { code: "P0001", message: "vínculo tse não encontrado" };
    const { client } = criarClienteMock({ data: null, error: erroOriginal });

    await expect(marcarCandidaturaVigente(client, 42)).rejects.toEqual(erroOriginal);
  });
});
