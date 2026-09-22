import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { AnaliseParticipantePll } from "@backend/queries/pll-dashboard";

// Recharts precisa de ResizeObserver em jsdom (mesmo stub de
// pll-status-mensal-chart.test.tsx).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
  (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver ?? ResizeObserverStub;

import { PainelAnaliseParticipante } from "./painel-analise-participante";

// Spec anchor: pll-dashboard-agenda T18 Done-when (tasks.md) -- PLL-DB-15,
// PLL-DB-18, PLL-DB-19. AD-046: caminho feliz de cada AC.

afterEach(cleanup);

const ANALISE: AnaliseParticipantePll = {
  participantesAtivos: 12,
  identidadeGenero: {
    n: 8,
    semResposta: 1,
    suprimido: false,
    categorias: [
      { categoria: "Mulher cis", quantidade: 5, percentual: 62.5 },
      { categoria: "Homem cis", quantidade: 3, percentual: 37.5 },
    ],
  },
  orientacaoSexual: { n: 2, semResposta: 0, suprimido: true, categorias: [] },
  corRaca: {
    n: 6,
    semResposta: 0,
    suprimido: false,
    categorias: [{ categoria: "Parda", quantidade: 6, percentual: 100 }],
  },
  tempoNaPolitica: { n: 0, semResposta: 0, suprimido: true, categorias: [] },
};

describe("PainelAnaliseParticipante (PLL-DB-15)", () => {
  it("exibe o selo de participantes ativos e o título do painel", () => {
    render(<PainelAnaliseParticipante analise={ANALISE} />);

    expect(screen.getByText("Análise do participante")).toBeInTheDocument();
    expect(screen.getByText("12 Participantes Ativos")).toBeInTheDocument();
  });

  it("renderiza as 4 roscas com título e n de respondentes (PLL-DB-19)", () => {
    render(<PainelAnaliseParticipante analise={ANALISE} />);

    expect(screen.getByText("Identidade de gênero")).toBeInTheDocument();
    expect(screen.getByText("Orientação sexual")).toBeInTheDocument();
    expect(screen.getByText("Cor/raça")).toBeInTheDocument();
    expect(screen.getByText("Tempo na política")).toBeInTheDocument();
    expect(screen.getByText("Mulher cis")).toBeInTheDocument();
    expect(screen.getByText("62.5%")).toBeInTheDocument();
    expect(screen.getByText("1 sem resposta")).toBeInTheDocument();
  });

  it("PLL-DB-18/D-13: n < 5 mostra 'Dados insuficientes' em vez do gráfico", () => {
    render(<PainelAnaliseParticipante analise={ANALISE} />);

    expect(screen.getAllByText("Dados insuficientes (n < 5)")).toHaveLength(2); // orientação e tempo na política
  });
});
