import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ColunaEtapaQuadro, ColunaProspeccaoQuadro, ColunaQuadro } from "@backend/queries/quadro";
import { QuadroAcompanhamento } from "./quadro-acompanhamento";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/tasks.md, T16
// "Done when" (EST-07 AC2, AC3, AD-040, AD-046 -- tela de leitura, caminho
// feliz de cada AC; a exceção explícita da própria task é "um caso de teste
// por estado" do badge de limiar, que os 3 testes de estado cobrem).
afterEach(cleanup);

const COLUNA_ETAPA_BASE: ColunaEtapaQuadro = {
  idEtapa: 1,
  codigo: "diagnostico",
  nome: "Diagnóstico",
  ordem: 1,
  tipo: "etapa",
  duracaoPrevistaDias: 100,
  cards: [
    {
      idContrato: 10,
      nomeContratante: "Dep. Ana Ribeiro",
      statusContrato: "ativo",
      diasNaEtapaAtual: 5,
      cargoAtual: "Deputada Federal",
      partidoAtual: "PSD",
    },
  ],
};

const COLUNA_PROSPECCAO_BASE: ColunaProspeccaoQuadro = {
  idEtapa: null,
  codigo: "prospeccao",
  nome: "Prospecção",
  ordem: 0,
  tipo: "prospeccao",
  cards: [{ idProspeccao: 1, nomeContratante: "Ver. Marcos Duarte", diasEmAberto: 6 }],
};

function colunas(...itens: ColunaQuadro[]): ColunaQuadro[] {
  return itens;
}

describe("QuadroAcompanhamento (EST-07)", () => {
  it("card de etapa exibe contratante, cargo/partido e dias na etapa (AC2)", () => {
    render(<QuadroAcompanhamento colunas={colunas(COLUNA_ETAPA_BASE)} />);

    expect(screen.getByText("Dep. Ana Ribeiro")).toBeInTheDocument();
    expect(screen.getByText("Deputada Federal · PSD")).toBeInTheDocument();
    expect(screen.getByText("5 dias na etapa")).toBeInTheDocument();
  });

  it("badge reflete estado normal quando os dias na etapa estão abaixo do limiar de atenção (AC3)", () => {
    const coluna: ColunaEtapaQuadro = {
      ...COLUNA_ETAPA_BASE,
      cards: [{ ...COLUNA_ETAPA_BASE.cards[0], diasNaEtapaAtual: 10 }],
    };

    render(<QuadroAcompanhamento colunas={colunas(coluna)} limiares={{ atencaoPct: 70, atrasadoPct: 100 }} />);

    expect(screen.getByText("Normal")).toBeInTheDocument();
  });

  it("badge reflete estado atencao quando os dias na etapa cruzam o limiar de atenção (AC3)", () => {
    const coluna: ColunaEtapaQuadro = {
      ...COLUNA_ETAPA_BASE,
      cards: [{ ...COLUNA_ETAPA_BASE.cards[0], diasNaEtapaAtual: 80 }],
    };

    render(<QuadroAcompanhamento colunas={colunas(coluna)} limiares={{ atencaoPct: 70, atrasadoPct: 100 }} />);

    expect(screen.getByText("Atenção")).toBeInTheDocument();
  });

  it("badge reflete estado atrasado quando os dias na etapa cruzam o limiar de atraso (AC3)", () => {
    const coluna: ColunaEtapaQuadro = {
      ...COLUNA_ETAPA_BASE,
      cards: [{ ...COLUNA_ETAPA_BASE.cards[0], diasNaEtapaAtual: 120 }],
    };

    render(<QuadroAcompanhamento colunas={colunas(coluna)} limiares={{ atencaoPct: 70, atrasadoPct: 100 }} />);

    expect(screen.getByText("Atrasado")).toBeInTheDocument();
  });

  it("card da raia de Prospecção não é arrastável, ao contrário do card de etapa (AD-040)", () => {
    render(<QuadroAcompanhamento colunas={colunas(COLUNA_PROSPECCAO_BASE, COLUNA_ETAPA_BASE)} />);

    const cardEtapa = screen.getByText("Dep. Ana Ribeiro").closest('[class*="cursor-grab"]');
    const cardProspeccao = screen.getByText("Ver. Marcos Duarte").closest('[class*="cursor-grab"]');

    expect(cardEtapa).not.toBeNull();
    expect(cardProspeccao).toBeNull();
  });

  it("coluna de etapa vazia renderiza estado vazio, não some (edge case)", () => {
    const colunaVazia: ColunaEtapaQuadro = { ...COLUNA_ETAPA_BASE, cards: [] };

    render(<QuadroAcompanhamento colunas={colunas(colunaVazia)} />);

    expect(screen.getByText("Diagnóstico")).toBeInTheDocument();
    expect(screen.getByText("Nenhum mandato nesta etapa.")).toBeInTheDocument();
  });

  it("raia de Prospecção vazia renderiza estado vazio, não some (edge case)", () => {
    const raiaVazia: ColunaProspeccaoQuadro = { ...COLUNA_PROSPECCAO_BASE, cards: [] };

    render(<QuadroAcompanhamento colunas={colunas(raiaVazia)} />);

    expect(screen.getByText("Prospecção")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma prospecção aberta.")).toBeInTheDocument();
  });
});
