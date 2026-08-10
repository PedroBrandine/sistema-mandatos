import { QueryClient, isServer } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Evita refetch imediato ao montar um componente que já tem dado
        // recente em cache -- padrão conservador, sem consumidor real ainda.
        staleTime: 60 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Factory SSR-safe do QueryClient: no servidor, sempre cria uma instância
 * nova (evita cache de um request aparecer para outro); no navegador,
 * reaproveita uma única instância por aba.
 */
export function getQueryClient() {
  if (isServer) {
    return makeQueryClient();
  }

  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
