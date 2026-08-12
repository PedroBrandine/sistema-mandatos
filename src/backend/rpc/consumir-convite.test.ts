import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../supabase/database.types";
import { consumirConvite, type ConsumirConviteDeps } from "./consumir-convite";

interface MockConfig {
  email?: string | null;
  usuarioExistente?: { id_usuario: number } | null;
  createUserError?: { message: string; code?: string } | null;
  rpcData?: { id_usuario: number; conta_nova: boolean } | null;
  rpcError?: { message: string; code?: string } | null;
  signInError?: { message: string } | null;
}

function criarDeps(config: MockConfig): { deps: ConsumirConviteDeps; spies: Record<string, ReturnType<typeof vi.fn>> } {
  const email = config.email === undefined ? "convidado@exemplo.com" : config.email;

  const createUser = vi.fn().mockResolvedValue({
    data: config.createUserError ? null : { user: { id: "auth-uuid" } },
    error: config.createUserError ?? null,
  });
  const rpc = vi.fn().mockResolvedValue({
    data: config.rpcError ? null : config.rpcData ?? { id_usuario: 1, conta_nova: true },
    error: config.rpcError ?? null,
  });
  const signInWithPassword = vi.fn().mockResolvedValue({ data: {}, error: config.signInError ?? null });

  function builderPara(tabela: string) {
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: () => {
            if (tabela === "convite_contrato") {
              return Promise.resolve({ data: email === null ? null : { email }, error: null });
            }
            if (tabela === "dim_usuario") {
              return Promise.resolve({ data: config.usuarioExistente ?? null, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          },
        }),
      }),
    };
  }

  const admin = {
    from: (tabela: string) => builderPara(tabela),
    auth: { admin: { createUser } },
    schema: (_nome: string) => ({ rpc }),
  };
  const server = { auth: { signInWithPassword } };

  return {
    deps: { admin: admin as unknown as SupabaseClient<Database>, server: server as unknown as SupabaseClient<Database> },
    spies: { createUser, rpc, signInWithPassword },
  };
}

describe("consumirConvite", () => {
  it("dim_usuario não existe: cria conta (createUser com a senha submetida) e tenta signInWithPassword -- sucesso_logado", async () => {
    const { deps, spies } = criarDeps({ usuarioExistente: null, rpcData: { id_usuario: 5, conta_nova: true } });

    const resultado = await consumirConvite(deps, { tokenHash: "hash1", nome: "Novo", senha: "senha123" });

    expect(resultado).toEqual({ tipo: "sucesso_logado" });
    expect(spies.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "convidado@exemplo.com", password: "senha123", email_confirm: true })
    );
    expect(spies.signInWithPassword).toHaveBeenCalledWith({
      email: "convidado@exemplo.com",
      password: "senha123",
    });
  });

  it("createUser devolve 'already registered' (retry de falha parcial): erro ignorado, segue pro RPC e tenta login com a senha atual", async () => {
    const { deps, spies } = criarDeps({
      usuarioExistente: null,
      createUserError: { message: "User already registered", code: "email_exists" },
      rpcData: { id_usuario: 5, conta_nova: true },
    });

    const resultado = await consumirConvite(deps, { tokenHash: "hash1", nome: "Novo", senha: "senha123" });

    expect(resultado).toEqual({ tipo: "sucesso_logado" });
    expect(spies.rpc).toHaveBeenCalledWith("consumir_convite", { p_token_hash: "hash1", p_nome: "Novo" });
  });

  it("dim_usuario já existe (conta pré-estabelecida): nunca chama createUser nem signInWithPassword -- sucesso_sem_login", async () => {
    const { deps, spies } = criarDeps({
      usuarioExistente: { id_usuario: 9 },
      rpcData: { id_usuario: 9, conta_nova: false },
    });

    const resultado = await consumirConvite(deps, { tokenHash: "hash1", nome: "Ignorado", senha: "qualquer" });

    expect(resultado).toEqual({ tipo: "sucesso_sem_login" });
    expect(spies.createUser).not.toHaveBeenCalled();
    expect(spies.signInWithPassword).not.toHaveBeenCalled();
  });

  it("RPC recusa por token inválido/expirado/usado: erro com a mensagem correspondente, sem nenhuma chamada Admin API", async () => {
    const { deps, spies } = criarDeps({
      usuarioExistente: null,
      rpcError: { message: "Convite já utilizado", code: "CNV02" },
    });

    const resultado = await consumirConvite(deps, { tokenHash: "hash1", nome: "X", senha: "senha123" });

    expect(resultado).toEqual({ tipo: "erro", mensagem: "Convite já utilizado." });
    // createUser é chamado (dim_usuario não existe) -- mas nenhuma tentativa
    // de login acontece depois de um erro do RPC.
    expect(spies.signInWithPassword).not.toHaveBeenCalled();
  });

  it("token não corresponde a nenhum convite: erro 'Convite inválido', sem tocar dim_usuario nem Admin API", async () => {
    const { deps, spies } = criarDeps({ email: null });

    const resultado = await consumirConvite(deps, { tokenHash: "hash-inexistente", nome: "X", senha: "senha123" });

    expect(resultado).toEqual({ tipo: "erro", mensagem: "Convite inválido." });
    expect(spies.createUser).not.toHaveBeenCalled();
    expect(spies.rpc).not.toHaveBeenCalled();
  });

  it("signInWithPassword falha depois de conta_nova=true: ainda devolve sucesso_sem_login (vínculo já foi criado)", async () => {
    const { deps } = criarDeps({
      usuarioExistente: null,
      rpcData: { id_usuario: 5, conta_nova: true },
      signInError: { message: "descompasso raro" },
    });

    const resultado = await consumirConvite(deps, { tokenHash: "hash1", nome: "Novo", senha: "senha123" });

    expect(resultado).toEqual({ tipo: "sucesso_sem_login" });
  });
});
