import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { PermissaoNegadaError, ProspeccaoEncerradaError } from "./errors";
import { converterProspeccao } from "./prospeccao";
import { ErroBancoNaoMapeadoError } from "./errors";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/tasks.md, T9
// "Done when" (EST-04 AC3/AC4) --
//  - Cada parâmetro é repassado verbatim à RPC e asserido individualmente (L-004)
//  - Cada erro tipado da T7 mapeia para mensagem própria, uma asserção por
//    erro (L-003): PRO01 e 42501
//
// Padrão de mock de src/backend/rpc/kanban.test.ts.

type Chamada = { schema: string; fn: string; params: Record<string, unknown> };

function criarClienteMock(resultado: { data: unknown; error: Partial<PostgrestError> | null }) {
  const chamadas: Chamada[] = [];
  const client = {
    schema: (nome: string) => ({
      rpc: (fn: string, params: Record<string, unknown>) => {
        chamadas.push({ schema: nome, fn, params });
        return Promise.resolve(resultado);
      },
    }),
  };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

describe("converterProspeccao", () => {
  // Done-when: "Cada parâmetro é repassado verbatim à RPC e asserido individualmente" (L-004)
  it("chama app.converter_prospeccao repassando cada parâmetro verbatim", async () => {
    const { client, chamadas } = criarClienteMock({ data: 4321, error: null });

    await converterProspeccao(client, { idProspeccao: 77, dtInicio: "2026-03-15" });

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].schema).toBe("app");
    expect(chamadas[0].fn).toBe("converter_prospeccao");
    expect(chamadas[0].params.p_id_prospeccao).toBe(77);
    expect(chamadas[0].params.p_dt_inicio).toBe("2026-03-15");
    expect(Object.keys(chamadas[0].params).sort()).toEqual(["p_dt_inicio", "p_id_prospeccao"]);
  });

  // Done-when: EST-04 AC3 -- a conversão devolve o contrato gerado
  it("devolve o id do contrato criado pela RPC", async () => {
    const { client } = criarClienteMock({ data: 4321, error: null });

    const idContrato = await converterProspeccao(client, { idProspeccao: 77, dtInicio: "2026-03-15" });

    expect(idContrato).toBe(4321);
  });

  // Done-when: "Cada erro tipado da T7 mapeia para mensagem própria" (L-003) -- PRO01
  it("PRO01: lança ProspeccaoEncerradaError com a mensagem de prospecção já encerrada", async () => {
    const { client } = criarClienteMock({
      data: null,
      error: { code: "PRO01", message: "Esta prospecção já foi encerrada e não pode ser convertida de novo." },
    });

    await expect(converterProspeccao(client, { idProspeccao: 77, dtInicio: "2026-03-15" })).rejects.toThrow(
      ProspeccaoEncerradaError
    );
    await expect(converterProspeccao(client, { idProspeccao: 77, dtInicio: "2026-03-15" })).rejects.toThrow(
      "Esta prospecção já foi encerrada e não pode ser convertida de novo."
    );
  });

  // Done-when: "Cada erro tipado da T7 mapeia para mensagem própria" (L-003) -- 42501
  it("42501: lança PermissaoNegadaError com a mensagem genérica, sem revelar a linha negada", async () => {
    const { client } = criarClienteMock({
      data: null,
      error: { code: "42501", message: "Prospecção não encontrada ou sem permissão." },
    });

    await expect(converterProspeccao(client, { idProspeccao: 77, dtInicio: "2026-03-15" })).rejects.toThrow(
      PermissaoNegadaError
    );
    await expect(converterProspeccao(client, { idProspeccao: 77, dtInicio: "2026-03-15" })).rejects.toThrow(
      "Você não tem permissão para realizar esta operação."
    );
  });

  it("código não mapeado chega como Error, com código e mensagem preservados", async () => {
    const erroOriginal = { code: "P0001", message: "erro inesperado" };
    const { client } = criarClienteMock({ data: null, error: erroOriginal });

    const capturado = await (converterProspeccao(client, { idProspeccao: 77, dtInicio: "2026-03-15" })).catch((e: unknown) => e);

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
