import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { atualizarStatusContrato } from "./contrato";
import { PermissaoNegadaError } from "./errors";

// Spec anchor: .specs/features/pente-fino-2026-09/tasks.md T3 (PF-04) Done-when --
//  - Update rejeita status = 'nao_concluido' sem motivo_encerramento (espelha
//    ck_contrato_motivo, src/backend/schemas/contrato.ts)
//  - chamada correta com os params certos (update + eq id_contrato)
//  - erro do banco mapeado por mapeiaErroRpc

type Chamada = { tabela: string; metodo: string; args: unknown[] };

function criarClienteMock(resultado: { error: Partial<PostgrestError> | null }) {
  const chamadas: Chamada[] = [];
  const client = {
    from: (tabela: string) => {
      const builder: Record<string, unknown> = {
        update: (...args: unknown[]) => {
          chamadas.push({ tabela, metodo: "update", args });
          return builder;
        },
        eq: (...args: unknown[]) => {
          chamadas.push({ tabela, metodo: "eq", args });
          return Promise.resolve(resultado);
        },
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

describe("atualizarStatusContrato", () => {
  it("sucesso: status='ativo' sem motivo faz UPDATE com motivo_encerramento null", async () => {
    const { client, chamadas } = criarClienteMock({ error: null });

    await atualizarStatusContrato(client, 7, "ativo");

    const update = chamadas.find((c) => c.metodo === "update");
    expect(update?.args[0]).toEqual({ status: "ativo", motivo_encerramento: null });
    const eq = chamadas.find((c) => c.metodo === "eq");
    expect(eq?.args).toEqual(["id_contrato", 7]);
  });

  it("sucesso: status='concluido' sem motivo também é aceito (motivo opcional fora de nao_concluido)", async () => {
    const { client, chamadas } = criarClienteMock({ error: null });

    await atualizarStatusContrato(client, 7, "concluido");

    expect(chamadas.find((c) => c.metodo === "update")?.args[0]).toEqual({
      status: "concluido",
      motivo_encerramento: null,
    });
  });

  it("rejeita status='nao_concluido' sem motivo_encerramento, sem chamar o banco", async () => {
    const { client, chamadas } = criarClienteMock({ error: null });

    await expect(atualizarStatusContrato(client, 7, "nao_concluido")).rejects.toThrow(
      "motivo_encerramento é obrigatório quando status='nao_concluido'"
    );
    expect(chamadas.some((c) => c.metodo === "update")).toBe(false);
  });

  it("aceita status='nao_concluido' quando motivo_encerramento é informado", async () => {
    const { client, chamadas } = criarClienteMock({ error: null });

    await atualizarStatusContrato(client, 7, "nao_concluido", "Mandato encerrado antecipadamente");

    expect(chamadas.find((c) => c.metodo === "update")?.args[0]).toEqual({
      status: "nao_concluido",
      motivo_encerramento: "Mandato encerrado antecipadamente",
    });
  });

  it("42501: erro do banco chega mapeado por mapeiaErroRpc (PermissaoNegadaError)", async () => {
    const { client } = criarClienteMock({ error: { code: "42501", message: "permission denied" } });

    await expect(atualizarStatusContrato(client, 7, "ativo")).rejects.toThrow(PermissaoNegadaError);
  });
});
