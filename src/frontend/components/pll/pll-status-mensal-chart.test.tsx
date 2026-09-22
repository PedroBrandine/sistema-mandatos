import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { SerieMensalStatus } from "@backend/queries/pll-dashboard";

// Recharts precisa de ResizeObserver em jsdom (mesmo stub de
// evolucao-mensal.test.tsx).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
  (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver ?? ResizeObserverStub;

import { PllStatusMensalChart } from "./pll-status-mensal-chart";

// Spec anchor: pll-dashboard-agenda T9 Done-when (tasks.md) -- PLL-DB-05.
// AD-046: caminho feliz.

afterEach(cleanup);

const SERIE: SerieMensalStatus[] = [
  { mes: "2026-04", planejado: 0, realizado: 0, remarcado: 0, cancelado: 0 },
  { mes: "2026-05", planejado: 2, realizado: 3, remarcado: 1, cancelado: 0 },
  { mes: "2026-06", planejado: 1, realizado: 4, remarcado: 0, cancelado: 1 },
  { mes: "2026-07", planejado: 3, realizado: 2, remarcado: 0, cancelado: 0 },
  { mes: "2026-08", planejado: 0, realizado: 5, remarcado: 1, cancelado: 0 },
  { mes: "2026-09", planejado: 4, realizado: 1, remarcado: 0, cancelado: 0 },
];

describe("PllStatusMensalChart (PLL-DB-05)", () => {
  it("renderiza o gráfico com título e a legenda das 4 séries", () => {
    render(<PllStatusMensalChart serie={SERIE} />);

    expect(screen.getByText("Status da mentoria por mês")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Status da mentoria por mês" })).toBeInTheDocument();
    expect(screen.getByText("Planejado")).toBeInTheDocument();
    expect(screen.getByText("Realizado")).toBeInTheDocument();
    expect(screen.getByText("Remarcado")).toBeInTheDocument();
    expect(screen.getByText("Cancelado")).toBeInTheDocument();
  });

  it("mês sem Encontro (todas as contagens 0) continua na série sem quebrar o gráfico", () => {
    render(<PllStatusMensalChart serie={SERIE} />);
    // A série inteira, incluindo o mês zerado, chega ao gráfico -- não é
    // filtrada aqui (a decisão de incluir mês vazio é da query, T5).
    expect(screen.getByRole("img", { name: "Status da mentoria por mês" })).toBeInTheDocument();
  });
});
