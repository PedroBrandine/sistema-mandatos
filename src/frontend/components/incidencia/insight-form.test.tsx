import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: .specs/features/fatos-geradores-ciclo-vida/spec.md, "A aba
// como casa única da Incidência" AC2 (edição abre o formulário da própria
// entidade). AD-042 integral.

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoViewStub() {};
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = function hasPointerCaptureStub() {
    return false;
  };
}

const buscarPilaresInsightMock = vi.fn();
vi.mock("@backend/queries/incidencia", () => ({
  buscarPilaresInsight: (...args: unknown[]) => buscarPilaresInsightMock(...args),
}));

vi.mock("@backend/queries/planejamento", () => ({
  buscarPlanejamentoCompleto: vi.fn().mockResolvedValue(null),
  buscarGradeSucessosMensais: vi.fn().mockResolvedValue([]),
}));

const criarInsightMock = vi.fn();
vi.mock("@backend/rpc/insight", () => ({
  criarInsight: (...args: unknown[]) => criarInsightMock(...args),
}));

const updateMock = vi.fn();
const eqMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({
    from: (tabela: string) => fromMock(tabela),
  }),
}));

import { InsightForm } from "./insight-form";

const onConcluido = vi.fn();
const onCancelar = vi.fn();

beforeEach(() => {
  buscarPilaresInsightMock.mockReset();
  criarInsightMock.mockReset();
  updateMock.mockReset();
  eqMock.mockReset();
  fromMock.mockReset();
  onConcluido.mockReset();
  onCancelar.mockReset();

  buscarPilaresInsightMock.mockResolvedValue([]);
  criarInsightMock.mockResolvedValue({ idInsight: 5 });
  eqMock.mockResolvedValue({ error: null });
  updateMock.mockReturnValue({ eq: eqMock });
  // Registro de origem faz fetch inline via .from("fat_registro").select()...
  fromMock.mockImplementation((tabela: string) => {
    if (tabela === "fat_insight") return { update: updateMock };
    return {
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [] }),
        }),
      }),
    };
  });
});

afterEach(cleanup);

describe("InsightForm — criação (regressão)", () => {
  it("sem insightExistente, chama criarInsight (RPC) e mostra os Selects de Meta/Sucesso", async () => {
    render(<InsightForm idContrato={7} onConcluido={onConcluido} onCancelar={onCancelar} />);

    expect(screen.getByText("Meta de origem (opcional)")).toBeInTheDocument();
    expect(screen.getByText("Sucesso Mensal de origem (opcional)")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Conteúdo"), { target: { value: "Conteúdo novo" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Criar Insight" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Criar Insight" }));

    await waitFor(() => expect(criarInsightMock).toHaveBeenCalledTimes(1));
    expect(updateMock).not.toHaveBeenCalled();
    expect(onConcluido).toHaveBeenCalledWith({ idInsight: 5 });
  });
});

describe("InsightForm — edição (T24, lado oposto da criação)", () => {
  it("com insightExistente, popula os valores, oculta Meta/Sucesso e chama update pelo id", async () => {
    render(
      <InsightForm
        idContrato={7}
        insightExistente={{
          idInsight: 12,
          conteudo: "Conteúdo antigo",
          desdobramentos: null,
          comprovacaoDados: null,
          ocorridoEm: "2026-09-01",
          idPilar: null,
          idRegistro: null,
        }}
        onConcluido={onConcluido}
        onCancelar={onCancelar}
      />
    );

    expect(await screen.findByDisplayValue("Conteúdo antigo")).toBeInTheDocument();
    expect(screen.queryByText("Meta de origem (opcional)")).not.toBeInTheDocument();
    expect(screen.queryByText("Sucesso Mensal de origem (opcional)")).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(eqMock).toHaveBeenCalledWith("id_insight", 12);
    expect(criarInsightMock).not.toHaveBeenCalled();
    expect(onConcluido).toHaveBeenCalledWith();
  });

  it("falha do UPDATE mostra ErroInline e não conclui -- lado oposto", async () => {
    eqMock.mockResolvedValue({ error: { message: "RLS negou a escrita." } });

    render(
      <InsightForm
        idContrato={7}
        insightExistente={{
          idInsight: 12,
          conteudo: "Conteúdo antigo",
          desdobramentos: null,
          comprovacaoDados: null,
          ocorridoEm: null,
          idPilar: null,
          idRegistro: null,
        }}
        onConcluido={onConcluido}
        onCancelar={onCancelar}
      />
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("RLS negou a escrita.");
    expect(onConcluido).not.toHaveBeenCalled();
  });
});
