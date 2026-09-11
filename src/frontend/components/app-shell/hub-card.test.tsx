import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { CardHub } from "@backend/queries/hub";
import { HubCard } from "./hub-card";

// Spec anchor: redesenho-estrategia-tela-first / EST-02 (T12, AD-046 -- tela
// de leitura). Done-when: "Card exibe badge de contador quando presente e o
// omite quando ausente -- caso de teste dos dois lados" é a própria task
// pedindo os dois lados; os demais critérios seguem caminho feliz único.
afterEach(cleanup);

const CARD_BASE: CardHub = {
  destino: "/produtos/estrategia",
  tipo: "produto",
  titulo: "Estratégia",
  descricao: "Mandatos, contratos e operação da consultoria estratégica",
  icone: "estrategia",
};

describe("HubCard (EST-02)", () => {
  it("renderiza titulo e descricao do card (AC1)", () => {
    render(<HubCard card={CARD_BASE} />);

    expect(screen.getByText("Estratégia")).toBeInTheDocument();
    expect(
      screen.getByText("Mandatos, contratos e operação da consultoria estratégica")
    ).toBeInTheDocument();
  });

  it("navega para o destino do card ao ser clicado (AC5)", () => {
    render(<HubCard card={CARD_BASE} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/produtos/estrategia");
  });

  it("exibe o badge de contador quando presente (AC3/AC4)", () => {
    render(<HubCard card={{ ...CARD_BASE, badge: "4" }} />);

    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("omite o badge quando ausente (AC3/AC4 -- outro lado)", () => {
    render(<HubCard card={CARD_BASE} />);

    expect(screen.queryByText("4")).not.toBeInTheDocument();
  });
});
