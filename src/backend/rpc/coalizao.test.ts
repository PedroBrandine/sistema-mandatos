import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { adicionarMembroCoalizao, criarCoalizao, removerMembroCoalizao } from "./coalizao";
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

// PF2-08 (T8): escrita single-table sobre rel_coalizao_membro -- mock
// separado de criarClienteMock acima porque essas duas funções usam
// client.from(...) direto (sem RPC de banco), não client.schema(...).rpc(...).
type ChamadaTabela = { tabela: string; metodo: string; args: unknown[] };

function criarClienteMockTabela(resultado: { error: Partial<PostgrestError> | null }) {
  const chamadas: ChamadaTabela[] = [];
  // Builder chainable + thenable (mesmo padrão de queries/ficha-mandato.test.ts
  // e card-ponto-focal.test.tsx: cada método de cadeia devolve o próprio
  // builder, e `.then()` resolve o resultado no fim, sem importar em qual
  // método da cadeia o `await` acontece.
  function criarBuilder(tabela: string) {
    const builder: Record<string, unknown> = {
      insert: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "insert", args });
        return builder;
      },
      update: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "update", args });
        return builder;
      },
      eq: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "eq", args });
        return builder;
      },
      then: (resolve: (v: typeof resultado) => void, reject: (e: unknown) => void) =>
        Promise.resolve(resultado).then(resolve, reject),
    };
    return builder;
  }
  const client = { from: (tabela: string) => criarBuilder(tabela) };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

describe("adicionarMembroCoalizao", () => {
  it("insere em rel_coalizao_membro com papel padrão 'membro'", async () => {
    const { client, chamadas } = criarClienteMockTabela({ error: null });

    await adicionarMembroCoalizao(client, 6, 7);

    const insert = chamadas.find((c) => c.tabela === "rel_coalizao_membro" && c.metodo === "insert");
    expect(insert?.args[0]).toEqual({ id_coalizao: 6, id_contrato: 7, papel: "membro" });
  });

  it("42501: erro do banco chega mapeado por mapeiaErroRpc (PermissaoNegadaError)", async () => {
    const { client } = criarClienteMockTabela({ error: { code: "42501", message: "permission denied" } });

    await expect(adicionarMembroCoalizao(client, 6, 7)).rejects.toThrow(PermissaoNegadaError);
  });
});

describe("removerMembroCoalizao", () => {
  it("faz soft-exit: UPDATE dt_saida (hoje), nunca DELETE", async () => {
    const { client, chamadas } = criarClienteMockTabela({ error: null });
    const hoje = new Date().toISOString().slice(0, 10);

    await removerMembroCoalizao(client, 6, 7);

    const update = chamadas.find((c) => c.tabela === "rel_coalizao_membro" && c.metodo === "update");
    expect(update?.args[0]).toEqual({ dt_saida: hoje });
    expect(chamadas.some((c) => c.metodo === "delete")).toBe(false);
    const eqs = chamadas.filter((c) => c.tabela === "rel_coalizao_membro" && c.metodo === "eq");
    expect(eqs.map((c) => c.args)).toEqual([
      ["id_coalizao", 6],
      ["id_contrato", 7],
      ["papel", "membro"],
    ]);
  });

  it("42501: erro do banco chega mapeado por mapeiaErroRpc (PermissaoNegadaError)", async () => {
    const { client } = criarClienteMockTabela({ error: { code: "42501", message: "permission denied" } });

    await expect(removerMembroCoalizao(client, 6, 7)).rejects.toThrow(PermissaoNegadaError);
  });
});
