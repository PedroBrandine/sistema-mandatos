import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarProspeccoesAbertas } from "./prospeccao";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/tasks.md, T8
// "Done when" (EST-04 / AD-040) --
//  - Retorna só status='aberta' do produto pedido
//  - Produto sem prospecção retorna [], nunca lança (padrão de buscarBoardKanban)
//  - Erro do PostgREST propaga como throw (padrão do projeto)
//
// Mock roteado por nome de tabela, mesmo padrão de queries/kanban.test.ts.

type Chamada = { tabela: string; metodo: string; args: unknown[] };
type RespostaTabela = { data: unknown; error: { message: string } | null };

function criarClienteMock(respostasPorTabela: Record<string, RespostaTabela>) {
  const chamadas: Chamada[] = [];

  function criarBuilder(tabela: string) {
    const resposta = respostasPorTabela[tabela] ?? { data: null, error: null };
    const builder: Record<string, unknown> = {
      select: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "select", args });
        return builder;
      },
      eq: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "eq", args });
        return builder;
      },
      in: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "in", args });
        return builder;
      },
      order: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "order", args });
        return builder;
      },
      then: (resolve: (valor: RespostaTabela) => void, reject: (erro: unknown) => void) =>
        Promise.resolve(resposta).then(resolve, reject),
    };
    return builder;
  }

  const client = {
    from: (tabela: string) => {
      chamadas.push({ tabela, metodo: "from", args: [tabela] });
      return criarBuilder(tabela);
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

const PROSPECCAO_A = { id_prospeccao: 1, id_contratante: 10, dt_abertura: "2026-08-01" };
const PROSPECCAO_B = { id_prospeccao: 2, id_contratante: 11, dt_abertura: "2026-09-01" };

describe("buscarProspeccoesAbertas", () => {
  // Done-when: "Retorna só status='aberta' do produto pedido"
  it("filtra por id_produto e por status='aberta'", async () => {
    const { client, chamadas } = criarClienteMock({
      fat_prospeccao: { data: [PROSPECCAO_A], error: null },
      dim_contratante: { data: [{ id_contratante: 10, nome: "Mandato Alfa" }], error: null },
    });

    await buscarProspeccoesAbertas(client, 7);

    const filtros = chamadas.filter((c) => c.tabela === "fat_prospeccao" && c.metodo === "eq").map((c) => c.args);
    expect(filtros).toEqual([
      ["id_produto", 7],
      ["status", "aberta"],
    ]);
  });

  // Done-when: "Retorna só status='aberta' do produto pedido" -- forma do retorno
  it("devolve id, contratante e data de abertura, com o nome do contratante resolvido", async () => {
    const { client } = criarClienteMock({
      fat_prospeccao: { data: [PROSPECCAO_A, PROSPECCAO_B], error: null },
      dim_contratante: {
        data: [
          { id_contratante: 10, nome: "Mandato Alfa" },
          { id_contratante: 11, nome: "Mandato Beta" },
        ],
        error: null,
      },
    });

    const resultado = await buscarProspeccoesAbertas(client, 7);

    expect(resultado).toEqual([
      { idProspeccao: 1, idContratante: 10, nomeContratante: "Mandato Alfa", dtAbertura: "2026-08-01" },
      { idProspeccao: 2, idContratante: 11, nomeContratante: "Mandato Beta", dtAbertura: "2026-09-01" },
    ]);
  });

  // Done-when: "Retorna só status='aberta' do produto pedido" -- ordenação da raia
  it("pede as prospecções ordenadas por dt_abertura ascendente", async () => {
    const { client, chamadas } = criarClienteMock({
      fat_prospeccao: { data: [PROSPECCAO_A], error: null },
      dim_contratante: { data: [{ id_contratante: 10, nome: "Mandato Alfa" }], error: null },
    });

    await buscarProspeccoesAbertas(client, 7);

    const chamadaOrder = chamadas.find((c) => c.tabela === "fat_prospeccao" && c.metodo === "order");
    expect(chamadaOrder?.args).toEqual(["dt_abertura", { ascending: true }]);
  });

  // Done-when: "Produto sem prospecção retorna [], nunca lança"
  it("produto sem prospecção aberta retorna [] e não consulta dim_contratante", async () => {
    const { client, chamadas } = criarClienteMock({
      fat_prospeccao: { data: [], error: null },
    });

    const resultado = await buscarProspeccoesAbertas(client, 7);

    expect(resultado).toEqual([]);
    expect(chamadas.some((c) => c.tabela === "dim_contratante")).toBe(false);
  });

  // Done-when: "Produto sem prospecção retorna [], nunca lança" -- data null
  it("data null (sem linhas) retorna [] em vez de lançar", async () => {
    const { client } = criarClienteMock({
      fat_prospeccao: { data: null, error: null },
    });

    await expect(buscarProspeccoesAbertas(client, 7)).resolves.toEqual([]);
  });

  // Done-when: "Erro do PostgREST propaga como throw"
  it("erro ao ler fat_prospeccao propaga como throw", async () => {
    const erro = { message: "permission denied for table fat_prospeccao" };
    const { client } = criarClienteMock({
      fat_prospeccao: { data: null, error: erro },
    });

    await expect(buscarProspeccoesAbertas(client, 7)).rejects.toEqual(erro);
  });

  // Done-when: "Erro do PostgREST propaga como throw" -- segunda consulta
  it("erro ao ler dim_contratante propaga como throw", async () => {
    const erro = { message: "connection reset" };
    const { client } = criarClienteMock({
      fat_prospeccao: { data: [PROSPECCAO_A], error: null },
      dim_contratante: { data: null, error: erro },
    });

    await expect(buscarProspeccoesAbertas(client, 7)).rejects.toEqual(erro);
  });

  // Done-when: "Retorna só status='aberta' do produto pedido" -- contratante
  // que a RLS de dim_contratante nao devolveu nao derruba a raia.
  it("contratante ausente na segunda consulta vira nome vazio, sem lançar", async () => {
    const { client } = criarClienteMock({
      fat_prospeccao: { data: [PROSPECCAO_A], error: null },
      dim_contratante: { data: [], error: null },
    });

    const resultado = await buscarProspeccoesAbertas(client, 7);

    expect(resultado).toEqual([
      { idProspeccao: 1, idContratante: 10, nomeContratante: "", dtAbertura: "2026-08-01" },
    ]);
  });
});
