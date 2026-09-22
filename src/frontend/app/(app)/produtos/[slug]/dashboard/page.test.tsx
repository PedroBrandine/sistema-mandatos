import "@testing-library/jest-dom/vitest";

import { Suspense } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: pll-dashboard-agenda T3 Done-when
// (.specs/features/pll-dashboard-agenda/tasks.md) -- PLL-SH-03/PLL-SH-04.
// Este arquivo cobre só o ROTEAMENTO por slug que T3 introduz: slug="pll"
// renderiza um placeholder próprio (populado em T8-T12); Estratégia/Coalizão
// continuam pelo componente existente, sem alteração de comportamento
// (regressão). Não retesta o Quadro/Pendências/KPIs em si -- já cobertos
// noutro lugar da suíte (kpi-row.test.tsx, quadro-acompanhamento.test.tsx
// etc.); aqui o que importa é: a página escolhe o componente certo, e o
// caminho do PLL não dispara nenhuma query da Estratégia.

const mocks = vi.hoisted(() => ({
  buscarEstrategiaKpi: vi.fn(),
  buscarProjetosDoProduto: vi.fn(),
  buscarLimiares: vi.fn(),
  buscarQuadro: vi.fn(),
  buscarPendenciasDashboard: vi.fn(),
  moverEtapaKanban: vi.fn(),
}));

vi.mock("@backend/queries/estrategia-kpi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@backend/queries/estrategia-kpi")>()),
  buscarEstrategiaKpi: mocks.buscarEstrategiaKpi,
}));

vi.mock("@backend/queries/kanban", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@backend/queries/kanban")>()),
  buscarProjetosDoProduto: mocks.buscarProjetosDoProduto,
}));

vi.mock("@backend/queries/limiar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@backend/queries/limiar")>()),
  buscarLimiares: mocks.buscarLimiares,
}));

vi.mock("@backend/queries/quadro", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@backend/queries/quadro")>()),
  buscarQuadro: mocks.buscarQuadro,
}));

vi.mock("@backend/queries/pendencias", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@backend/queries/pendencias")>()),
  buscarPendenciasDashboard: mocks.buscarPendenciasDashboard,
}));

vi.mock("@backend/rpc/kanban", () => ({
  moverEtapaKanban: mocks.moverEtapaKanban,
}));

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/hooks/use-produto-atual", () => ({
  useProdutoAtual: () => ({ data: { idProduto: 1, nome: "Estratégia" }, isLoading: false }),
}));

import ProdutoDashboardPage from "./page";

// Mesmo protocolo de thenable já resolvido usado em agenda/page.test.tsx
// (comentário lá explica o porquê: `use(params)` não pode suspender no
// harness de teste).
function paramsProntos(slug: string): Promise<{ slug: string }> {
  const valor = { slug };
  return Object.assign(Promise.resolve(valor), { status: "fulfilled", value: valor });
}

function renderizarComSlug(slug: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>carregando</p>}>
        <ProdutoDashboardPage params={paramsProntos(slug)} />
      </Suspense>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mocks.buscarEstrategiaKpi.mockReset().mockResolvedValue(null);
  mocks.buscarProjetosDoProduto.mockReset().mockResolvedValue([]);
  mocks.buscarLimiares.mockReset().mockResolvedValue([]);
  mocks.buscarQuadro.mockReset().mockResolvedValue([]);
  mocks.buscarPendenciasDashboard.mockReset().mockResolvedValue([]);
  mocks.moverEtapaKanban.mockReset().mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("Dashboard — roteamento por slug (pll-dashboard-agenda T3, PLL-SH-03/PLL-SH-04)", () => {
  it("slug='pll' renderiza o placeholder do PLL, sem disparar nenhuma query da Estratégia", () => {
    renderizarComSlug("pll");

    expect(screen.getByText("Dashboard do PLL em construção")).toBeInTheDocument();
    expect(mocks.buscarQuadro).not.toHaveBeenCalled();
    expect(mocks.buscarEstrategiaKpi).not.toHaveBeenCalled();
    expect(mocks.buscarPendenciasDashboard).not.toHaveBeenCalled();
  });

  it("slug='estrategia' continua pelo componente existente (Quadro de acompanhamento renderiza)", async () => {
    renderizarComSlug("estrategia");

    expect(await screen.findByText("Quadro de acompanhamento")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard do PLL em construção")).not.toBeInTheDocument();
  });

  it("slug='coalizao' continua pelo componente existente (regressão)", async () => {
    renderizarComSlug("coalizao");

    expect(await screen.findByText("Quadro de acompanhamento")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard do PLL em construção")).not.toBeInTheDocument();
  });
});
