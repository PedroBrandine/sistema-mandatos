import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LinhaEvolucaoMensal, PessoaVinculada } from "@backend/queries/planejamento";

// Recharts precisa de ResizeObserver em jsdom (mesmo stub de
// mandato-wizard.test.tsx/tse-match-search.test.tsx). Radix <Select> precisa
// dos outros 2 (mesmo padrão de objetivo-form.test.tsx).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
  (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver ?? ResizeObserverStub;

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoViewStub() {};
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = function hasPointerCaptureStub() {
    return false;
  };
}

import { EvolucaoMensal } from "./evolucao-mensal";

// Spec anchor: PLV-13 (.specs/features/planejamento-estrategico-v2/spec.md,
// "P1: Evolução mensal" AC1-AC8, T25 de tasks.md). AD-042: série normal,
// série vazia, filtro aplicado, avanço correto.

const PESSOAS: PessoaVinculada[] = [
  { idUsuario: 1, nome: "Joana Martins", papelNoContrato: "assessor" },
  { idUsuario: 2, nome: "Marcos Silva", papelNoContrato: "mentor" },
];

// Verbatim do Independent Test da spec.md:310 -- 2 SMs de peso 50 (ago/set),
// ago a 100%, set a 0%: Esperado(ago)=50, Atingido(ago)=50, Esperado(set)=100,
// Atingido(set)=50, Avanço(set)=0.
const SERIE: LinhaEvolucaoMensal[] = [
  { mes: "2026-08-01", pctEsperado: 50, pctAtingido: 50 },
  { mes: "2026-09-01", pctEsperado: 100, pctAtingido: 50 },
];

const onFiltrar = vi.fn();

beforeEach(() => {
  onFiltrar.mockReset();
});

afterEach(cleanup);

describe("EvolucaoMensal — série normal (AC1)", () => {
  it("renderiza o gráfico e o seletor de mês inspecionado", () => {
    render(<EvolucaoMensal serie={SERIE} pessoasVinculadas={PESSOAS} idResponsavel={null} onFiltrar={onFiltrar} />);
    expect(screen.getByRole("combobox", { name: "Inspecionar mês" })).toBeInTheDocument();
    expect(screen.getByText("Evolução mensal")).toBeInTheDocument();
  });

  it("abre já inspecionando o mês corrente — o último com Atingido (AC8)", () => {
    render(<EvolucaoMensal serie={SERIE} pessoasVinculadas={PESSOAS} idResponsavel={null} onFiltrar={onFiltrar} />);
    // set/26 é o último com Atingido não nulo nesta série -- é o mês corrente.
    expect(screen.getByRole("combobox", { name: "Inspecionar mês" })).toHaveTextContent("set/26");
  });
});

describe("EvolucaoMensal — avanço correto (AC3, Independent Test)", () => {
  it("mostra Esperado/Atingido/Avanço do mês corrente (set: Avanço = 0, não —)", () => {
    render(<EvolucaoMensal serie={SERIE} pessoasVinculadas={PESSOAS} idResponsavel={null} onFiltrar={onFiltrar} />);
    expect(screen.getByText("100%")).toBeInTheDocument(); // Esperado(set)
    expect(screen.getAllByText("50%")).toHaveLength(1); // Atingido(set) -- só aparece 1x na leitura ativa
    expect(screen.getByText("0pp")).toBeInTheDocument(); // Avanço(set) = 0, é medição, não ausência
  });

  it("trocar o mês inspecionado pra agosto mostra o avanço de agosto (= o próprio acumulado)", async () => {
    render(<EvolucaoMensal serie={SERIE} pessoasVinculadas={PESSOAS} idResponsavel={null} onFiltrar={onFiltrar} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Inspecionar mês" }));
    fireEvent.click(await screen.findByRole("option", { name: "ago/26" }));
    expect(screen.getByText("+50pp")).toBeInTheDocument();
  });
});

describe("EvolucaoMensal — série vazia (AC7, P=0)", () => {
  it("mostra estado vazio, nunca uma curva em 0%", () => {
    render(<EvolucaoMensal serie={[]} pessoasVinculadas={PESSOAS} idResponsavel={null} onFiltrar={onFiltrar} />);
    expect(screen.getByText("Sem Sucessos Mensais para calcular a evolução")).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Inspecionar mês" })).not.toBeInTheDocument();
  });

  it("o filtro de responsável continua disponível mesmo com a série vazia", () => {
    render(<EvolucaoMensal serie={[]} pessoasVinculadas={PESSOAS} idResponsavel={null} onFiltrar={onFiltrar} />);
    expect(screen.getByRole("combobox", { name: "Filtrar por responsável" })).toBeInTheDocument();
  });
});

describe("EvolucaoMensal — filtro de responsável (AC5)", () => {
  it("escolher uma pessoa chama onFiltrar com o id dela", async () => {
    render(<EvolucaoMensal serie={SERIE} pessoasVinculadas={PESSOAS} idResponsavel={null} onFiltrar={onFiltrar} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Filtrar por responsável" }));
    fireEvent.click(await screen.findByRole("option", { name: "Joana Martins" }));
    expect(onFiltrar).toHaveBeenCalledWith(1);
  });

  it("escolher 'Todos' depois de um filtro aplicado chama onFiltrar com null", async () => {
    render(<EvolucaoMensal serie={SERIE} pessoasVinculadas={PESSOAS} idResponsavel={1} onFiltrar={onFiltrar} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Filtrar por responsável" }));
    fireEvent.click(await screen.findByRole("option", { name: "Todos" }));
    expect(onFiltrar).toHaveBeenCalledWith(null);
  });

  it("o componente não refaz a consulta sozinho -- só emite a escolha", async () => {
    render(<EvolucaoMensal serie={SERIE} pessoasVinculadas={PESSOAS} idResponsavel={null} onFiltrar={onFiltrar} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Filtrar por responsável" }));
    fireEvent.click(await screen.findByRole("option", { name: "Marcos Silva" }));
    expect(onFiltrar).toHaveBeenCalledTimes(1);
    expect(onFiltrar).toHaveBeenCalledWith(2);
  });
});

describe("EvolucaoMensal — mês futuro sem Atingido (AC8)", () => {
  it("mês sem Atingido mostra — em Atingido e em Avanço, nunca 0%", async () => {
    const serieComFuturo: LinhaEvolucaoMensal[] = [...SERIE, { mes: "2026-10-01", pctEsperado: 100, pctAtingido: null }];
    render(<EvolucaoMensal serie={serieComFuturo} pessoasVinculadas={PESSOAS} idResponsavel={null} onFiltrar={onFiltrar} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Inspecionar mês" }));
    fireEvent.click(await screen.findByRole("option", { name: "out/26" }));
    const secaoAtingido = screen.getByText("Atingido").closest("div")!;
    expect(secaoAtingido).toHaveTextContent("—");
    const secaoAvanco = screen.getByText("Avanço do mês").closest("div")!;
    expect(secaoAvanco).toHaveTextContent("—");
  });
});
