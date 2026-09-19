import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Pente-fino 2026-09: mv_avaliacao_nps só refletia dado novo depois de clique
// manual em "Atualizar" -- achado de UAT (não um AC formal de spec.md desta
// feature, é correção do padrão já usado por IipCard/NumerosImpactoPage).
// FRM-21 AC2 exige a ação de atualizar existir (continua existindo, ver
// segundo teste); não proíbe também refrescar ao montar.

const buscarAvaliacaoNpsMock = vi.fn();
vi.mock("@backend/queries/formulario", () => ({
  buscarAvaliacaoNps: (...args: unknown[]) => buscarAvaliacaoNpsMock(...args),
}));

const atualizarAvaliacaoNpsMock = vi.fn();
vi.mock("@backend/rpc/formulario", () => ({
  atualizarAvaliacaoNps: (...args: unknown[]) => atualizarAvaliacaoNpsMock(...args),
}));

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({}),
}));

vi.mock("@/hooks/use-papel-global", () => ({
  usePapelGlobal: () => ({ papel: "gestora", carregando: false }),
}));

import { NpsAvaliacoesCard } from "./nps-avaliacoes-card";

function renderizarCard(idProduto = 7) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NpsAvaliacoesCard idProduto={idProduto} />
    </QueryClientProvider>
  );
}

describe("NpsAvaliacoesCard", () => {
  beforeEach(() => {
    buscarAvaliacaoNpsMock.mockResolvedValue([]);
    atualizarAvaliacaoNpsMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("atualiza a mv_avaliacao_nps automaticamente ao montar, sem clique manual", async () => {
    renderizarCard();

    await waitFor(() => expect(atualizarAvaliacaoNpsMock).toHaveBeenCalledTimes(1));
  });

  it("não dispara um segundo refresh automático numa nova renderização (só uma vez por montagem)", async () => {
    const { rerender } = renderizarCard();
    await waitFor(() => expect(atualizarAvaliacaoNpsMock).toHaveBeenCalledTimes(1));

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    rerender(
      <QueryClientProvider client={queryClient}>
        <NpsAvaliacoesCard idProduto={7} />
      </QueryClientProvider>
    );

    await waitFor(() => expect(buscarAvaliacaoNpsMock).toHaveBeenCalled());
    expect(atualizarAvaliacaoNpsMock).toHaveBeenCalledTimes(1);
  });
});
