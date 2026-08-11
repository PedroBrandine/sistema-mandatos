import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

// Mapeamento slug (URL) -> ref_produto.nome, fixo (não lookup dinâmico contra
// operado_pelo_sistema -- ref_produto é catálogo estável, GRANT-only, ver
// design.md Tech Decisions). Valores de `nome` confirmados no seed de
// supabase/migrations/0007_catalogos_fundacao.sql:67-68.
export const PRODUTO_SLUGS = {
  estrategia: { nome: "Estratégia", label: "Estratégia" },
  pll: { nome: "PLL", label: "PLL" },
  coalizao: { nome: "Coalizão", label: "Coalizão" },
} as const;

export type ProdutoSlug = keyof typeof PRODUTO_SLUGS;

export function isProdutoSlug(v: string): v is ProdutoSlug {
  return Object.prototype.hasOwnProperty.call(PRODUTO_SLUGS, v);
}

// Resolve o id_produto a partir do nome (ref_produto.nome é único). Retorna
// null quando não há linha correspondente, nunca lança nesse caso -- mesmo
// espírito de "ausência de match: nunca erro" de queries/tse.ts.
export async function buscarIdProdutoPorNome(
  client: SupabaseClient<Database>,
  nome: string
): Promise<number | null> {
  const { data, error } = await client.from("ref_produto").select("id_produto").eq("nome", nome);
  if (error) throw error;
  return data?.[0]?.id_produto ?? null;
}
