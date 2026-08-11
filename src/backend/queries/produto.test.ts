import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { PRODUTO_SLUGS, buscarIdProdutoPorNome, isProdutoSlug } from "./produto";

type Chamada = { metodo: string; args: unknown[] };
type LinhaRefProduto = Pick<Database["public"]["Tables"]["ref_produto"]["Row"], "id_produto">;

function criarClienteMock(resultado: { data: LinhaRefProduto[] | null; error: { message: string } | null }) {
  const chamadas: Chamada[] = [];
  const builder: Record<string, unknown> = {
    select: (...args: unknown[]) => {
      chamadas.push({ metodo: "select", args });
      return builder;
    },
    eq: (...args: unknown[]) => {
      chamadas.push({ metodo: "eq", args });
      return builder;
    },
    then: (resolve: (value: typeof resultado) => void, reject: (erro: unknown) => void) =>
      Promise.resolve(resultado).then(resolve, reject),
  };
  const client = {
    from: (tabela: string) => {
      chamadas.push({ metodo: "from", args: [tabela] });
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

describe("PRODUTO_SLUGS", () => {
  // Done-when: "PRODUTO_SLUGS mapeia exatamente estrategia→'Estratégia',
  // pll→'PLL', coalizao→'Coalizão' (valores confirmados em
  // supabase/migrations/0007_catalogos_fundacao.sql:67)"
  it("mapeia estrategia/pll/coalizao para os nomes exatos de ref_produto", () => {
    expect(PRODUTO_SLUGS.estrategia.nome).toBe("Estratégia");
    expect(PRODUTO_SLUGS.pll.nome).toBe("PLL");
    expect(PRODUTO_SLUGS.coalizao.nome).toBe("Coalizão");
  });
});

describe("isProdutoSlug", () => {
  it("aceita os 3 slugs válidos", () => {
    expect(isProdutoSlug("estrategia")).toBe(true);
    expect(isProdutoSlug("pll")).toBe(true);
    expect(isProdutoSlug("coalizao")).toBe(true);
  });

  // Done-when: "isProdutoSlug rejeita string arbitrária"
  it("rejeita uma string arbitrária", () => {
    expect(isProdutoSlug("xis")).toBe(false);
  });
});

describe("buscarIdProdutoPorNome", () => {
  it("retorna o id_produto quando a query encontra a linha", async () => {
    const { client, chamadas } = criarClienteMock({ data: [{ id_produto: 7 }], error: null });
    const resultado = await buscarIdProdutoPorNome(client, "Estratégia");

    expect(resultado).toBe(7);
    expect(chamadas.find((c) => c.metodo === "eq")?.args).toEqual(["nome", "Estratégia"]);
  });

  // Done-when: "buscarIdProdutoPorNome retorna null quando a query não
  // encontra linha (não lança)"
  it("retorna null quando a query não encontra nenhuma linha", async () => {
    const { client } = criarClienteMock({ data: [], error: null });
    const resultado = await buscarIdProdutoPorNome(client, "Inexistente");
    expect(resultado).toBeNull();
  });

  // Done-when: "buscarIdProdutoPorNome propaga erro do Supabase em vez de
  // engolir (mesmo padrão de buscarCandidaturas)"
  it("lança o erro do Supabase em vez de engolir a falha", async () => {
    const { client } = criarClienteMock({ data: null, error: { message: "boom" } });
    await expect(buscarIdProdutoPorNome(client, "Estratégia")).rejects.toEqual({ message: "boom" });
  });
});
