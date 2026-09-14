import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ContratoCard } from "@backend/queries/mandatos-lista";
import { ListaMandatos } from "./lista-mandatos";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/tasks.md, T20
// "Done when" (EST-09 AC1, AC5, AC6, AD-046 -- tela de leitura, caminho
// feliz de cada AC).

afterEach(cleanup);

const MANDATO_BASE: ContratoCard = {
  idContrato: 42,
  nomeContratante: "Dep. Ana Ribeiro",
  dtInicio: "2026-01-10",
  dtFim: "2026-08-01",
  status: "ativo",
  nomeGestora: "Gestora Um",
  nomeProjeto: "Projeto Alfa",
  nomeEtapaAtual: "Diagnóstico",
  nomeResponsavel: "Mentor Um",
  atualizadoEm: "2026-09-12T10:00:00Z",
};

describe("ListaMandatos (EST-09)", () => {
  it("card exibe contratante (prefixado com 'Contrato'), vigência, status, gestora, projeto, etapa e responsável (AC1)", () => {
    render(<ListaMandatos mandatos={[MANDATO_BASE]} />);

    expect(screen.getByText("Contrato Dep. Ana Ribeiro")).toBeInTheDocument();
    expect(screen.getByText("10/01/2026")).toBeInTheDocument();
    expect(screen.getByText("01/08/2026")).toBeInTheDocument();
    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.getByText("Gestora Um")).toBeInTheDocument();
    expect(screen.getByText("Projeto Alfa")).toBeInTheDocument();
    expect(screen.getByText("Diagnóstico")).toBeInTheDocument();
    expect(screen.getByText("Mentor Um")).toBeInTheDocument();
  });

  it("rodapé traz 'Ver contrato' como link explícito para o contrato (Figma 202:554)", () => {
    render(<ListaMandatos mandatos={[MANDATO_BASE]} />);

    const link = screen.getByRole("link", { name: "Ver contrato →" });
    expect(link).toHaveAttribute("href", "/contratos/42");
  });

  it("status ativo mostra havidade da última atualização (atualizado_em real, não inventado)", () => {
    const agora = new Date();
    const tresDiasAtras = new Date(agora.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    render(<ListaMandatos mandatos={[{ ...MANDATO_BASE, status: "ativo", atualizadoEm: tresDiasAtras }]} />);

    expect(screen.getByText("Atualizado há 3 dias")).toBeInTheDocument();
  });

  it("status concluido mostra a data de encerramento (dt_fim), não a atualização", () => {
    render(<ListaMandatos mandatos={[{ ...MANDATO_BASE, status: "concluido", dtFim: "2026-05-31" }]} />);

    expect(screen.getByText("Encerrado em 31/05")).toBeInTheDocument();
  });

  it("status nao_concluido mostra a data de desligamento (dt_fim)", () => {
    render(<ListaMandatos mandatos={[{ ...MANDATO_BASE, status: "nao_concluido", dtFim: "2026-07-18" }]} />);

    expect(screen.getByText("Desligado em 18/07")).toBeInTheDocument();
  });

  it("dt_fim nula renderiza -- , nunca uma data inventada (AC5/AD-005)", () => {
    render(<ListaMandatos mandatos={[{ ...MANDATO_BASE, dtFim: null }]} />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it.each([
    ["ativo", "Ativo"],
    ["concluido", "Finalizado"],
    ["nao_concluido", "Desligado"],
  ] as const)("status %s traduz para '%s'", (status, rotulo) => {
    render(<ListaMandatos mandatos={[{ ...MANDATO_BASE, status }]} />);

    expect(screen.getByText(rotulo)).toBeInTheDocument();
  });

  it("lista vazia renderiza estado vazio explicativo, não uma grade em branco (AC6)", () => {
    render(<ListaMandatos mandatos={[]} />);

    expect(screen.getByText("Nenhum mandato encontrado")).toBeInTheDocument();
  });
});
