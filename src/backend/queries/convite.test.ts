import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { checarRateLimitConvite, validarConvite } from "./convite";

function criarClienteMockConvite(resposta: { data: unknown; error: { message: string } | null }) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve(resposta),
  };
  const client = { from: () => builder };
  return client as unknown as SupabaseClient<Database>;
}

function criarClienteMockRateLimit(resposta: { data: unknown; error: { message: string } | null }) {
  const client = {
    schema: (_nome: string) => ({
      rpc: (_fn: string, _params: unknown) => Promise.resolve(resposta),
    }),
  };
  return client as unknown as SupabaseClient<Database>;
}

describe("validarConvite", () => {
  it("token sem linha correspondente -- estado: invalido", async () => {
    const client = criarClienteMockConvite({ data: null, error: null });
    const resultado = await validarConvite(client, "hash-inexistente");
    expect(resultado).toEqual({ estado: "invalido" });
  });

  it("linha com dt_uso preenchido -- estado: usado", async () => {
    const client = criarClienteMockConvite({
      data: {
        id_contrato: 1,
        papel_no_contrato: "assessor",
        cargo: null,
        dt_expiracao: new Date(Date.now() + 86400000).toISOString(),
        dt_uso: new Date().toISOString(),
      },
      error: null,
    });
    const resultado = await validarConvite(client, "hash-usado");
    expect(resultado).toEqual({ estado: "usado" });
  });

  it("linha com dt_expiracao no passado -- estado: expirado", async () => {
    const client = criarClienteMockConvite({
      data: {
        id_contrato: 1,
        papel_no_contrato: "mentor",
        cargo: null,
        dt_expiracao: new Date(Date.now() - 86400000).toISOString(),
        dt_uso: null,
      },
      error: null,
    });
    const resultado = await validarConvite(client, "hash-expirado");
    expect(resultado).toEqual({ estado: "expirado" });
  });

  // Precedência intencional (comentário em convite.ts): "usado" antes de
  // "expirado" -- é o caso rotineiro (todo convite consumido expira 7 dias
  // depois), não a exceção. Mutante sobrevivente do Verifier independente:
  // trocar a ordem dos dois `if`s em validarConvite passava sem nenhum
  // teste falhar, porque nenhum fixture combinava as duas condições.
  it("linha com dt_uso preenchido E dt_expiracao no passado -- estado: usado (precedência sobre expirado)", async () => {
    const client = criarClienteMockConvite({
      data: {
        id_contrato: 1,
        papel_no_contrato: "assessor",
        cargo: null,
        dt_expiracao: new Date(Date.now() - 86400000).toISOString(),
        dt_uso: new Date(Date.now() - 3600000).toISOString(),
      },
      error: null,
    });
    const resultado = await validarConvite(client, "hash-usado-e-expirado");
    expect(resultado).toEqual({ estado: "usado" });
  });

  it("linha válida (não usada, não expirada) -- estado: valido com dados do convite", async () => {
    const client = criarClienteMockConvite({
      data: {
        id_contrato: 42,
        papel_no_contrato: "assessor",
        cargo: "secretaria_executiva",
        dt_expiracao: new Date(Date.now() + 86400000).toISOString(),
        dt_uso: null,
      },
      error: null,
    });
    const resultado = await validarConvite(client, "hash-valido");
    expect(resultado).toEqual({
      estado: "valido",
      idContrato: 42,
      papelNoContrato: "assessor",
      cargo: "secretaria_executiva",
    });
  });
});

describe("checarRateLimitConvite", () => {
  it("repassa true quando o RPC permite", async () => {
    const client = criarClienteMockRateLimit({ data: true, error: null });
    expect(await checarRateLimitConvite(client, "192.0.2.1")).toBe(true);
  });

  it("repassa false quando o RPC nega (limite excedido)", async () => {
    const client = criarClienteMockRateLimit({ data: false, error: null });
    expect(await checarRateLimitConvite(client, "192.0.2.1")).toBe(false);
  });
});
