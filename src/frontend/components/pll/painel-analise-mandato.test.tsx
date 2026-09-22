import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { AnaliseMandatoPll } from "@backend/queries/pll-dashboard";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
  (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver ?? ResizeObserverStub;

import { PainelAnaliseMandato } from "./painel-analise-mandato";

// Spec anchor: pll-dashboard-agenda T18 Done-when (tasks.md) -- PLL-DB-16,
// PLL-DB-18, PLL-DB-19. AD-046: caminho feliz de cada AC.

afterEach(cleanup);

const ANALISE: AnaliseMandatoPll = {
  corRacaParlamentar: {
    n: 7,
    semResposta: 1,
    categorias: [
      { categoria: "Parda", quantidade: 4, percentual: 57.1 },
      { categoria: "Branca", quantidade: 3, percentual: 42.9 },
    ],
  },
  partidoPolitico: {
    n: 9,
    semResposta: 0,
    categorias: [
      { categoria: "PA", quantidade: 5, percentual: 55.6 },
      { categoria: "Outros", quantidade: 4, percentual: 44.4 },
    ],
  },
  // n < 5, sem categoria (D-13 revogada 22/09) -- continua renderizando normalmente.
  estadoEleicao: { n: 3, semResposta: 0, categorias: [] },
  cargosAnteriores: {
    n: 6,
    categorias: [{ categoria: "Vereador", quantidade: 6, percentual: 100 }],
  },
  mandatosAnteriores: { n: 2, categorias: [] },
};

describe("PainelAnaliseMandato (PLL-DB-16)", () => {
  it("exibe as 5 roscas com o rótulo canônico 'Cor/raça do parlamentar' (D-5)", () => {
    render(<PainelAnaliseMandato analise={ANALISE} />);

    expect(screen.getByText("Análise do mandato")).toBeInTheDocument();
    expect(screen.getByText("Cor/raça do parlamentar")).toBeInTheDocument();
    expect(screen.getByText("Partido político")).toBeInTheDocument();
    expect(screen.getByText("Estado de eleição")).toBeInTheDocument();
    expect(screen.getByText("Cargos anteriores")).toBeInTheDocument();
    expect(screen.getByText("Mandatos anteriores")).toBeInTheDocument();
  });

  it("D-5(f): partido além dos 8 maiores já chega agrupado em 'Outros'", () => {
    render(<PainelAnaliseMandato analise={ANALISE} />);
    expect(screen.getByText("Outros")).toBeInTheDocument();
    expect(screen.getByText("44.4%")).toBeInTheDocument();
  });

  // D-13 revogada em sessão ao vivo com Pedro (22/09): "Dados insuficientes"
  // nunca mais aparece, mesmo com n pequeno (estado de eleição e mandatos
  // anteriores, n=3 e n=2 respectivamente).
  it("PLL-DB-18/D-13 (revogada): painel com n < 5 renderiza normalmente, sem suprimir", () => {
    render(<PainelAnaliseMandato analise={ANALISE} />);
    expect(screen.queryByText(/Dados insuficientes/)).not.toBeInTheDocument();
  });
});
