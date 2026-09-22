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
    categorias: [
      { categoria: "Mulher cis", quantidade: 5, percentual: 62.5 },
      { categoria: "Homem cis", quantidade: 3, percentual: 37.5 },
    ],
  },
  // n < 5 / n = 0 (D-13 revogada 22/09) -- continuam renderizando normalmente.
  orientacaoSexual: { n: 2, semResposta: 0, categorias: [] },
  corRaca: {
    n: 6,
    semResposta: 0,
    categorias: [{ categoria: "Parda", quantidade: 6, percentual: 100 }],
  },
  tempoNaPolitica: { n: 0, semResposta: 0, categorias: [] },
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

  // D-13 revogada em sessão ao vivo com Pedro (22/09): "Dados insuficientes"
  // nunca mais aparece, mesmo com n pequeno ou zerado (orientação n=2, tempo
  // na política n=0).
  it("PLL-DB-18/D-13 (revogada): n < 5 renderiza o gráfico normalmente, sem suprimir", () => {
    render(<PainelAnaliseParticipante analise={ANALISE} />);

    expect(screen.queryByText(/Dados insuficientes/)).not.toBeInTheDocument();
  });
});
