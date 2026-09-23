import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

// Recharts precisa de ResizeObserver em jsdom (mesmo stub de
// painel-analise-participante.test.tsx/pll-status-mensal-chart.test.tsx).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
  (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver ?? ResizeObserverStub;

import { ComposicaoPartidariaCasa } from "./composicao-partidaria-casa";

// PF3-02 (.specs/features/pente-fino-2026-09-23-lote2/spec.md AC1/AC2): a
// Composição Partidária da Casa era uma lista de texto crua ("gráfico
// feio", achado no screenshot do bug) -- vira gráfico donut (RoscaAnalise).

afterEach(cleanup);

describe("ComposicaoPartidariaCasa (PF3-02)", () => {
  it("com dados, renderiza o gráfico (role=img do RoscaAnalise) com o n total de respondentes", () => {
    render(
      <ComposicaoPartidariaCasa
        composicao={[
          { siglaPartido: "PT", quantidade: 12, percentual: 60 },
          { siglaPartido: "PL", quantidade: 8, percentual: 40 },
        ]}
      />
    );

    // RoscaAnalise: role="img" com aria-labelledby apontando pro título
    // (sr-only aqui -- o CardTitle já mostra o texto visível).
    expect(screen.getByRole("img", { name: "Composição Partidária da Casa" })).toBeInTheDocument();
    // n no centro da rosca (PLL-DB-19): soma das quantidades, não um valor inventado.
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("PT")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("o título da rosca (usado só pro aria-label do gráfico) fica sr-only -- não duplica visualmente o CardTitle", () => {
    render(<ComposicaoPartidariaCasa composicao={[{ siglaPartido: "PT", quantidade: 1, percentual: 100 }]} />);

    const ocorrencias = screen.getAllByText("Composição Partidária da Casa");
    expect(ocorrencias).toHaveLength(2);
    const visiveis = ocorrencias.filter((el) => !el.className.includes("sr-only"));
    expect(visiveis).toHaveLength(1);
  });

  it("lado oposto: sem dados, mostra EstadoVazio explicativo, nunca o gráfico vazio (PLL-CP-19)", () => {
    render(<ComposicaoPartidariaCasa composicao={[]} />);

    expect(screen.getByText("Dados indisponíveis para esta Casa/ano")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Composição Partidária da Casa" })).not.toBeInTheDocument();
  });
});
