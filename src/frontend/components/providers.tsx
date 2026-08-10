"use client";

import { QueryClientProvider } from "@tanstack/react-query";

import { getQueryClient } from "@/lib/query-client";
import { Toaster } from "@/components/ui/sonner";

/**
 * Única fronteira "use client" no topo da árvore -- instancia o QueryClient
 * (via getQueryClient()) e monta o Toaster global, envolvendo {children}.
 * Cobre toda rota, autenticada ou não (AD-029): montado no layout raiz, não
 * em (app)/layout.tsx.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
