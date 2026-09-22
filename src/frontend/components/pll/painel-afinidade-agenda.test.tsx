import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { AfinidadeAgendaPll } from "@backend/queries/pll-dashboard";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
  (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver ?? ResizeObserverStub;

import { PainelAfinidadeAgenda } from "./painel-afinidade-agenda";

// Spec anchor: pll-dashboard-agenda T18 Done-when (tasks.md) -- PLL-DB-17,
// PLL-DB-18. AD-046: caminho feliz de cada AC.

afterEach(cleanup);

const AFINIDADE: AfinidadeAgendaPll = {
  pautas: [
    {
      pauta: "Educação",
      n: 8,
      suprimido: false,
      distribuicaoNotas: [
        { nota: 5, quantidade: 3, percentual: 37.5 },
        { nota: 4, quantidade: 2, percentual: 25 },
        { nota: 3, quantidade: 2, percentual: 25 },
        { nota: 2, quantidade: 1, percentual: 12.5 },
        { nota: 1, quantidade: 0, percentual: 0 },
      ],
    },
    {
      pauta: "Segurança Pública",
      n: 3,
      suprimido: true,
      distribuicaoNotas: [
        { nota: 5, quantidade: 0, percentual: 0 },
        { nota: 4, quantidade: 0, percentual: 0 },
        { nota: 3, quantidade: 0, percentual: 0 },
        { nota: 2, quantidade: 0, percentual: 0 },
        { nota: 1, quantidade: 0, percentual: 0 },
      ],
    },
    {
      pauta: "Modernização do Estado",
      n: 8,
      suprimido: false,
      distribuicaoNotas: [
        { nota: 5, quantidade: 8, percentual: 100 },
        { nota: 4, quantidade: 0, percentual: 0 },
        { nota: 3, quantidade: 0, percentual: 0 },
        { nota: 2, quantidade: 0, percentual: 0 },
        { nota: 1, quantidade: 0, percentual: 0 },
      ],
    },
    {
      pauta: "Clima",
      n: 8,
      suprimido: false,
      distribuicaoNotas: [
        { nota: 5, quantidade: 8, percentual: 100 },
        { nota: 4, quantidade: 0, percentual: 0 },
        { nota: 3, quantidade: 0, percentual: 0 },
        { nota: 2, quantidade: 0, percentual: 0 },
        { nota: 1, quantidade: 0, percentual: 0 },
      ],
    },
  ],
  outrasPautas: {
    n: 5,
    suprimido: false,
    itens: [
      { pauta: "Saúde", quantidade: 3, percentual: 60 },
      { pauta: "Infraestrutura", quantidade: 2, percentual: 40 },
    ],
  },
};

describe("PainelAfinidadeAgenda (PLL-DB-17)", () => {
  it("exibe as 4 pautas fixas do Anexo A (D-3), não ref_agenda_tematica", () => {
    render(<PainelAfinidadeAgenda afinidade={AFINIDADE} />);

    expect(screen.getByText("Afinidade de agenda temática")).toBeInTheDocument();
    expect(screen.getByText("Educação")).toBeInTheDocument();
    expect(screen.getByText("Segurança Pública")).toBeInTheDocument();
    expect(screen.getByText("Modernização do Estado")).toBeInTheDocument();
    expect(screen.getByText("Clima")).toBeInTheDocument();
  });

  it("exibe o painel 'Outras pautas prioritárias' com os itens da múltipla escolha", () => {
    render(<PainelAfinidadeAgenda afinidade={AFINIDADE} />);

    expect(screen.getByText("Outras pautas prioritárias")).toBeInTheDocument();
    expect(screen.getByText("Saúde")).toBeInTheDocument();
    expect(screen.getByText("Infraestrutura")).toBeInTheDocument();
  });

  it("PLL-DB-18/D-13: pauta com n < 5 mostra 'Dados insuficientes'", () => {
    render(<PainelAfinidadeAgenda afinidade={AFINIDADE} />);
    expect(screen.getByText("Dados insuficientes (n < 5)")).toBeInTheDocument();
  });
});
