import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FiltroObjetivos } from "./filtro-objetivos";

// Spec anchor: PLV-11 (.specs/features/planejamento-estrategico-v2/spec.md, "P2:
// KPIs e filtro por Objetivo" AC3). AD-042: selecionado vs. não, sem
// objetivos → estado vazio.

const OBJETIVOS = [
  {
    idObjetivo: 1,
    idPlanejamento: 1,
    descricao: "Consolidar liderança na pauta de educação básica",
    idPreditorPrimario: null,
    idPreditorSecundario: null,
    idAgenda: null,
    status: "ativo" as const,
    pctAtingimento: 70,
    metas: [],
  },
  {
    idObjetivo: 2,
    idPlanejamento: 1,
    descricao: "Ampliar articulação territorial no interior do estado",
    idPreditorPrimario: null,
    idPreditorSecundario: null,
    idAgenda: null,
    status: "ativo" as const,
    pctAtingimento: null,
    metas: [],
  },
];

const onSelecionar = vi.fn();

afterEach(cleanup);

describe("FiltroObjetivos — um cartão por Objetivo", () => {
  it("mostra um cartão por Objetivo, com descrição e %", () => {
    render(<FiltroObjetivos objetivos={OBJETIVOS} idSelecionado={null} onSelecionar={onSelecionar} />);
    expect(screen.getByText("Consolidar liderança na pauta de educação básica")).toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument();
  });

  it("Objetivo sem % mostra —, nunca 0%", () => {
    render(<FiltroObjetivos objetivos={OBJETIVOS} idSelecionado={null} onSelecionar={onSelecionar} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("FiltroObjetivos — selecionado vs. não (AC3)", () => {
  it("nenhum cartão marcado quando idSelecionado é null", () => {
    render(<FiltroObjetivos objetivos={OBJETIVOS} idSelecionado={null} onSelecionar={onSelecionar} />);
    for (const card of screen.getAllByRole("button")) {
      expect(card).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("o cartão do Objetivo selecionado fica marcado, os outros não", () => {
    render(<FiltroObjetivos objetivos={OBJETIVOS} idSelecionado={1} onSelecionar={onSelecionar} />);
    const cards = screen.getAllByRole("button");
    expect(cards[0]).toHaveAttribute("aria-pressed", "true");
    expect(cards[1]).toHaveAttribute("aria-pressed", "false");
  });

  it("clicar num cartão não selecionado chama onSelecionar com o id dele", () => {
    render(<FiltroObjetivos objetivos={OBJETIVOS} idSelecionado={null} onSelecionar={onSelecionar} />);
    fireEvent.click(screen.getByText("Consolidar liderança na pauta de educação básica"));
    expect(onSelecionar).toHaveBeenCalledWith(1);
  });

  it("clicar de novo no cartão já selecionado limpa o filtro (chama com null)", () => {
    render(<FiltroObjetivos objetivos={OBJETIVOS} idSelecionado={1} onSelecionar={onSelecionar} />);
    fireEvent.click(screen.getByText("Consolidar liderança na pauta de educação básica"));
    expect(onSelecionar).toHaveBeenCalledWith(null);
  });

  it("clicar num cartão diferente do selecionado troca o filtro, não limpa", () => {
    render(<FiltroObjetivos objetivos={OBJETIVOS} idSelecionado={1} onSelecionar={onSelecionar} />);
    fireEvent.click(screen.getByText("Ampliar articulação territorial no interior do estado"));
    expect(onSelecionar).toHaveBeenCalledWith(2);
  });
});

describe("FiltroObjetivos — sem objetivos (AD-042 lado oposto)", () => {
  it("mostra estado vazio, não uma lista em branco", () => {
    render(<FiltroObjetivos objetivos={[]} idSelecionado={null} onSelecionar={onSelecionar} />);
    expect(screen.getByText("Nenhum Objetivo Específico para filtrar")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
