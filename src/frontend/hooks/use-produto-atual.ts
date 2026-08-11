"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { createClient } from "@backend/supabase/client";
import { PRODUTO_SLUGS, buscarIdProdutoPorNome, type ProdutoSlug } from "@backend/queries/produto";

export interface ProdutoAtual {
  idProduto: number;
  nome: string;
}

// Resolve {idProduto, nome} a partir do slug da URL, com cache por queryKey
// (["produto", slug]) -- evita fetches idênticos quando o usuário navega
// entre as abas do mesmo produto (ProdutoShell + páginas-filhas). Primeiro
// consumidor real do QueryClientProvider (AD-029). Ver design.md, Components
// -> useProdutoAtual.
export function useProdutoAtual(slug: ProdutoSlug): UseQueryResult<ProdutoAtual> {
  return useQuery({
    queryKey: ["produto", slug],
    queryFn: async (): Promise<ProdutoAtual> => {
      const { nome } = PRODUTO_SLUGS[slug];
      const idProduto = await buscarIdProdutoPorNome(createClient(), nome);
      if (idProduto === null) {
        throw new Error(`Produto "${nome}" não encontrado em ref_produto`);
      }
      return { idProduto, nome };
    },
  });
}
