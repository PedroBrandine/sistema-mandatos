import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { PermissaoNegadaError, TransicaoInvalidaError } from "./errors";
import { moverEtapaKanban } from "./kanban";
import { ErroBancoNaoMapeadoError } from "./errors";

// Spec anchor: kanban-etapas T5 Done-when (.specs/features/kanban-etapas/tasks.md) --
//  - Sucesso: chama rpc("mover_etapa_kanban", { p_id_contrato, p_id_etapa_destino }) com os params corretos
//  - KAN01 -> lança TransicaoInvalidaError
//  - 42501 -> lança PermissaoNegadaError (reuso, sem linha nova em MENSAGENS_*)
//  - Código não mapeado chega como Error, com código e mensagem preservados
//
// spec.md KAN-04, KAN-07, KAN-09.

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

describe("moverEtapaKanban", () => {
  it("sucesso: chama mover_etapa_kanban com os params corretos", async () => {
    const { client, chamadas } = criarClienteMock({ data: null, error: null });

    await moverEtapaKanban(client, { idContrato: 100, idEtapaDestino: 11 });

    expect(chamadas[0]).toEqual({
      fn: "mover_etapa_kanban",
      params: { p_id_contrato: 100, p_id_etapa_destino: 11 },
    });
  });

  it("KAN01: lança TransicaoInvalidaError", async () => {
    const { client } = criarClienteMock({
      data: null,
      error: { code: "KAN01", message: "Não é possível pular etapas — mova o card para a coluna adjacente." },
    });

    await expect(moverEtapaKanban(client, { idContrato: 100, idEtapaDestino: 12 })).rejects.toThrow(
      TransicaoInvalidaError
    );
  });

  it("42501: lança PermissaoNegadaError com mensagem genérica", async () => {
    const { client } = criarClienteMock({ data: null, error: { code: "42501", message: "permission denied" } });

    await expect(moverEtapaKanban(client, { idContrato: 100, idEtapaDestino: 11 })).rejects.toThrow(
      PermissaoNegadaError
    );
  });

  it("código não mapeado chega como Error, com código e mensagem preservados", async () => {
    const erroOriginal = { code: "P0001", message: "erro inesperado" };
    const { client } = criarClienteMock({ data: null, error: erroOriginal });

    const capturado = await (moverEtapaKanban(client, { idContrato: 100, idEtapaDestino: 11 })).catch((e: unknown) => e);

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
