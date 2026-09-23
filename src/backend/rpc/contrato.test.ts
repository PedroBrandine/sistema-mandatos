import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { atualizarProjetoContrato, atualizarStatusContrato } from "./contrato";
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

  // AD-066 (diagnostico-participante-pll): 'desistente'/'desligado' exigem
  // motivo_encerramento igual a 'nao_concluido' -- mesma regra, valores novos.
  it("rejeita status='desistente' sem motivo_encerramento", async () => {
    const { client, chamadas } = criarClienteMock({ error: null });

    await expect(atualizarStatusContrato(client, 7, "desistente")).rejects.toThrow(
      "motivo_encerramento é obrigatório"
    );
    expect(chamadas.some((c) => c.metodo === "update")).toBe(false);
  });

  it("aceita status='desligado' quando motivo_encerramento é informado", async () => {
    const { client, chamadas } = criarClienteMock({ error: null });

    await atualizarStatusContrato(client, 7, "desligado", "Não correspondeu ao esperado");

    expect(chamadas.find((c) => c.metodo === "update")?.args[0]).toEqual({
      status: "desligado",
      motivo_encerramento: "Não correspondeu ao esperado",
    });
  });
});

// PF2-08 (T8), Done-when: "atualizarProjetoContrato faz o UPDATE correto e
// mapeia erro com mapeiaErroRpc" -- mesmo racional de teste de
// atualizarStatusContrato acima (chamada + args certos, erro mapeado).
describe("atualizarProjetoContrato", () => {
  it("grava fat_contrato.id_projeto com o id informado", async () => {
    const { client, chamadas } = criarClienteMock({ error: null });

    await atualizarProjetoContrato(client, 7, 5);

    const update = chamadas.find((c) => c.metodo === "update");
    expect(update?.args[0]).toEqual({ id_projeto: 5 });
    const eq = chamadas.find((c) => c.metodo === "eq");
    expect(eq?.args).toEqual(["id_contrato", 7]);
  });

  it("idProjeto null desvincula o projeto de origem (troca por 'Nenhum')", async () => {
    const { client, chamadas } = criarClienteMock({ error: null });

    await atualizarProjetoContrato(client, 7, null);

    expect(chamadas.find((c) => c.metodo === "update")?.args[0]).toEqual({ id_projeto: null });
  });

  it("42501: erro do banco chega mapeado por mapeiaErroRpc (PermissaoNegadaError)", async () => {
    const { client } = criarClienteMock({ error: { code: "42501", message: "permission denied" } });

    await expect(atualizarProjetoContrato(client, 7, 5)).rejects.toThrow(PermissaoNegadaError);
  });
});
