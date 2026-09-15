import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ColunaEtapaQuadro, ColunaProspeccaoQuadro, ColunaQuadro } from "@backend/queries/quadro";
import { ATIVACAO_ARRASTE_PX, QuadroAcompanhamento } from "./quadro-acompanhamento";

// KSM-17. O wiring do PointerSensor é o que permite clique e arraste no mesmo
// card, e nenhuma asserção sobre o DOM renderizado o enxerga: removê-lo deixa
// a suíte inteira verde enquanto quebra a navegação (achado do Verifier).
// Este spy delega ao dnd-kit real -- não substitui comportamento, só registra
// com que restrição cada sensor foi criado.
const espiaoSensores = vi.hoisted(() => ({ criados: [] as { nome: string; opcoes: unknown }[] }));

vi.mock("@dnd-kit/core", async () => {
  const real = await vi.importActual<typeof import("@dnd-kit/core")>("@dnd-kit/core");
  return {
    ...real,
    useSensor: (sensor: Parameters<typeof real.useSensor>[0], opcoes?: unknown) => {
      espiaoSensores.criados.push({ nome: (sensor as { name?: string }).name ?? "", opcoes });
      return real.useSensor(sensor, opcoes as never);
    },
  };
});

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

  // Spec anchor: .specs/features/kpi-status-mandatos-ativos/spec.md, P1-B
  // (KSM-16, KSM-18, KSM-19).
  it("KSM-16: card de etapa navega para a ficha do mandato daquele contrato", () => {
    render(<QuadroAcompanhamento colunas={colunas(COLUNA_ETAPA_BASE)} />);

    const link = screen.getByText("Dep. Ana Ribeiro").closest("a");
    expect(link).toHaveAttribute("href", "/contratos/10");
  });

  it("KSM-16: o destino acompanha o contrato do card, não uma rota fixa", () => {
    const outraColuna: ColunaEtapaQuadro = {
      ...COLUNA_ETAPA_BASE,
      cards: [{ ...COLUNA_ETAPA_BASE.cards[0], idContrato: 77, nomeContratante: "Sen. Beatriz Lima" }],
    };

    render(<QuadroAcompanhamento colunas={colunas(outraColuna)} />);

    expect(screen.getByText("Sen. Beatriz Lima").closest("a")).toHaveAttribute("href", "/contratos/77");
  });

  it("KSM-19: card de contrato não ativo continua clicável", () => {
    const colunaEncerrado: ColunaEtapaQuadro = {
      ...COLUNA_ETAPA_BASE,
      cards: [{ ...COLUNA_ETAPA_BASE.cards[0], statusContrato: "concluido" }],
    };

    render(<QuadroAcompanhamento colunas={colunas(colunaEncerrado)} />);

    expect(screen.getByText("Dep. Ana Ribeiro").closest("a")).toHaveAttribute("href", "/contratos/10");
  });

  it("KSM-18: o card é alcançável por teclado -- link de verdade, não div com onClick", () => {
    render(<QuadroAcompanhamento colunas={colunas(COLUNA_ETAPA_BASE)} />);

    // getByRole("link") só encontra <a> COM href: um <a> sem href não entra
    // na ordem de tabulação e não é ativável por Enter.
    expect(screen.getByRole("link", { name: /Dep\. Ana Ribeiro/ })).toHaveAttribute("href", "/contratos/10");
  });

  it("KSM-16: card da raia de Prospecção não vira link -- não há mandato para abrir", () => {
    render(<QuadroAcompanhamento colunas={colunas(COLUNA_PROSPECCAO_BASE)} />);

    expect(screen.getByText("Ver. Marcos Duarte").closest("a")).toBeNull();
  });

  // KSM-17. Sem distância de ativação, o dnd-kit consome o pointerdown e o
  // <Link> de KSM-16 nunca dispara -- o card volta a não abrir nada. A
  // asserção é sobre a criação do sensor porque é ali que a regressão mora:
  // nenhuma consulta ao DOM renderizado distingue um PointerSensor com
  // restrição de um sem.
  it("KSM-17: o PointerSensor é criado com distância de ativação, senão o clique nunca chega ao link", () => {
    espiaoSensores.criados.length = 0;

    render(<QuadroAcompanhamento colunas={colunas(COLUNA_ETAPA_BASE)} />);

    const ponteiro = espiaoSensores.criados.find((s) => s.nome === "PointerSensor");
    expect(ponteiro).toBeDefined();
    expect(ponteiro?.opcoes).toEqual({ activationConstraint: { distance: ATIVACAO_ARRASTE_PX } });
    expect(ATIVACAO_ARRASTE_PX).toBeGreaterThan(0);
  });
});
