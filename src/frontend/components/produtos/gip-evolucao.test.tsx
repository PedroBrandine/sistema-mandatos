import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: .specs/features/ficha-mandato-contrato/tasks.md, T35 Done-when
// (FMC-28 AC8-AC11) --
//  - Por dimensão: nível de Início, de Fim e a variação
//  - Só um momento preenchido renderiza estado explicativo, sem variação
//    sobre NULL -- os dois lados
//  - Resumo soma exatamente as dimensões com os dois momentos
//
// AD-003/AD-014: gap nunca recalculado no cliente -- vem pronto de
// buscarEvolucaoGip (T33), que já lê vw_gip_evolucao.gap.

const buscarEvolucaoGipMock = vi.fn();
vi.mock("@backend/queries/gip", () => ({
  buscarEvolucaoGip: (...args: unknown[]) => buscarEvolucaoGipMock(...args),
}));

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({}),
}));

import { GipEvolucao } from "./gip-evolucao";

beforeEach(() => {
  buscarEvolucaoGipMock.mockReset();
});

afterEach(cleanup);

describe("GipEvolucao — por dimensão (FMC-28 AC8)", () => {
  it("exibe nível de Início, nível de Fim e a variação (rótulo derivado do gap)", async () => {
    buscarEvolucaoGipMock.mockResolvedValue([
      { codigoDimensao: "performance_objetivos", nomeDimensao: "Performance dos objetivos específicos", ordem: 1, nivelInicio: 1, nivelFim: 3, gap: 2 },
    ]);

    render(<GipEvolucao idContrato={7} />);

    expect(await screen.findByText("Performance dos objetivos específicos")).toBeInTheDocument();
    expect(screen.getByText("Início: 1")).toBeInTheDocument();
    expect(screen.getByText("Fim: 3")).toBeInTheDocument();
    expect(screen.getByText("Subiu 2 níveis")).toBeInTheDocument();
  });

  it("gap negativo rotula Regrediu N nível(is)", async () => {
    buscarEvolucaoGipMock.mockResolvedValue([
      { codigoDimensao: "capacidade_gestao", nomeDimensao: "Capacidade de gestão", ordem: 3, nivelInicio: 2, nivelFim: 1, gap: -1 },
    ]);

    render(<GipEvolucao idContrato={7} />);

    expect(await screen.findByText("Regrediu 1 nível")).toBeInTheDocument();
  });

  it("gap zero rotula Manteve", async () => {
    buscarEvolucaoGipMock.mockResolvedValue([
      { codigoDimensao: "capacidade_gestao", nomeDimensao: "Capacidade de gestão", ordem: 3, nivelInicio: 1, nivelFim: 1, gap: 0 },
    ]);

    render(<GipEvolucao idContrato={7} />);

    expect(await screen.findByText("Manteve")).toBeInTheDocument();
  });
});

describe("GipEvolucao — só um momento preenchido (FMC-28 AC10) — os dois lados", () => {
  it("só Início preenchido: exibe 'Aguardando o outro momento', nunca variação sobre NULL", async () => {
    buscarEvolucaoGipMock.mockResolvedValue([
      { codigoDimensao: "capacidade_gestao", nomeDimensao: "Capacidade de gestão", ordem: 3, nivelInicio: 2, nivelFim: null, gap: null },
    ]);

    render(<GipEvolucao idContrato={7} />);

    expect(await screen.findByText("Aguardando o outro momento")).toBeInTheDocument();
    expect(screen.getByText("Início: 2")).toBeInTheDocument();
    expect(screen.getByText("Fim: —")).toBeInTheDocument();
  });

  it("os dois momentos preenchidos NÃO exibem o estado explicativo -- lado oposto", async () => {
    buscarEvolucaoGipMock.mockResolvedValue([
      { codigoDimensao: "capacidade_gestao", nomeDimensao: "Capacidade de gestão", ordem: 3, nivelInicio: 1, nivelFim: 2, gap: 1 },
    ]);

    render(<GipEvolucao idContrato={7} />);

    await screen.findByText("Capacidade de gestão");
    expect(screen.queryByText("Aguardando o outro momento")).not.toBeInTheDocument();
  });
});

describe("GipEvolucao — Resumo da Evolução (FMC-28 AC11)", () => {
  it("soma exatamente as dimensões com os dois momentos, ignorando a que só tem um", async () => {
    buscarEvolucaoGipMock.mockResolvedValue([
      { codigoDimensao: "d1", nomeDimensao: "D1", ordem: 1, nivelInicio: 1, nivelFim: 3, gap: 2 }, // evoluiu
      { codigoDimensao: "d2", nomeDimensao: "D2", ordem: 2, nivelInicio: 2, nivelFim: 2, gap: 0 }, // manteve
      { codigoDimensao: "d3", nomeDimensao: "D3", ordem: 3, nivelInicio: 1, nivelFim: null, gap: null }, // fora da conta
      { codigoDimensao: "d4", nomeDimensao: "D4", ordem: 4, nivelInicio: 2, nivelFim: 1, gap: -1 }, // regrediu
    ]);

    render(<GipEvolucao idContrato={7} />);

    await screen.findByText("D1");
    expect(screen.getByText("Evoluíram").previousElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Mantiveram").previousElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Regrediram").previousElementSibling).toHaveTextContent("1");
  });
});

describe("GipEvolucao — erro (design.md Error Handling Strategy)", () => {
  it("falha ao carregar exibe <ErroInline>", async () => {
    buscarEvolucaoGipMock.mockRejectedValue(new Error("RLS negou a leitura."));

    render(<GipEvolucao idContrato={7} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("RLS negou a leitura.");
  });

  it("sem erro, nenhum alerta aparece -- lado oposto", async () => {
    buscarEvolucaoGipMock.mockResolvedValue([]);

    render(<GipEvolucao idContrato={7} />);

    await screen.findByText("Evoluíram");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
