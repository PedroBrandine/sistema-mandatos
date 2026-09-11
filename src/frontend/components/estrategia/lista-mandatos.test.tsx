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
};

describe("ListaMandatos (EST-09)", () => {
  it("card exibe contratante, vigência, status, gestora, projeto, etapa e responsável (AC1)", () => {
    render(<ListaMandatos mandatos={[MANDATO_BASE]} />);

    expect(screen.getByText("Dep. Ana Ribeiro")).toBeInTheDocument();
    expect(screen.getByText("10/01/2026")).toBeInTheDocument();
    expect(screen.getByText("01/08/2026")).toBeInTheDocument();
    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.getByText("Gestora Um")).toBeInTheDocument();
    expect(screen.getByText("Projeto Alfa")).toBeInTheDocument();
    expect(screen.getByText("Diagnóstico")).toBeInTheDocument();
    expect(screen.getByText("Mentor Um")).toBeInTheDocument();
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
