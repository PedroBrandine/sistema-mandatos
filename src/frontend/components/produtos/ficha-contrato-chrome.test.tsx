import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P1: Barra de
// abas funcional da ficha" (AC1-AC4). Test Coverage Matrix (tasks.md, T22):
// AD-042 integral -- os dois lados de mandato x coalizão são testados, não
// só o caminho feliz.
//
// buscarEtapasDoProduto não é mais chamada (Done-when explícito): a barra
// deixou de depender de ref_etapa, então este teste não precisa mocká-la.
let pathnameAtual = "/contratos/1/informacoes";

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameAtual,
  notFound: () => {
    throw new Error("notFound() chamado inesperadamente no teste");
  },
}));

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({}),
}));

const buscarContratoParaFichaMock = vi.fn();

vi.mock("@backend/queries/contrato", () => ({
  buscarContratoParaFicha: (...args: unknown[]) => buscarContratoParaFichaMock(...args),
}));

import { FichaContratoChrome } from "./ficha-contrato-chrome";

const CONTRATO_MANDATO = {
  idContrato: 1,
  idProduto: 10,
  nomeProduto: "Estratégia",
  idContratante: 100,
  nomeContratante: "Mandato Fulano",
  tipoContratante: "mandato",
  idMandato: 200,
  cargoAtual: "Deputado Federal",
  partidoAtual: "PC do B",
  sgUf: "SP",
};

const CONTRATO_COALIZAO = {
  idContrato: 2,
  idProduto: 10,
  nomeProduto: "Estratégia",
  idContratante: 101,
  nomeContratante: "Coalizão Fulano",
  tipoContratante: "coalizao",
  nomeProjetoOrigem: "Projeto X",
};

const OITO_ABAS_MANDATO = [
  "Informações Gerais",
  "Agenda",
  "Diagnóstico",
  "Planejamento Estratégico",
  "GIP",
  "Formulários",
  "Gestão da equipe",
  "Fatos Geradores e Registros",
];

beforeEach(() => {
  pathnameAtual = "/contratos/1/informacoes";
  buscarContratoParaFichaMock.mockReset();
});

afterEach(cleanup);

describe("FichaContratoChrome (FMC-01..04)", () => {
  it("mandato renderiza exatamente as 8 abas, nesta ordem (AC1)", async () => {
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_MANDATO);

    render(<FichaContratoChrome idContrato={1}>{null}</FichaContratoChrome>);

    await screen.findByRole("link", { name: "Informações Gerais" });

    const links = screen.getAllByRole("link").map((el) => el.textContent);
    expect(links).toEqual(OITO_ABAS_MANDATO);
  });

  it("coalizão renderiza as 7 abas, sem 'Informações Gerais' (AC3)", async () => {
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_COALIZAO);

    render(<FichaContratoChrome idContrato={2}>{null}</FichaContratoChrome>);

    await screen.findByRole("link", { name: "Agenda" });

    expect(screen.queryByRole("link", { name: "Informações Gerais" })).not.toBeInTheDocument();
    const links = screen.getAllByRole("link").map((el) => el.textContent);
    expect(links).toEqual(OITO_ABAS_MANDATO.filter((label) => label !== "Informações Gerais"));
    expect(links).toHaveLength(7);
  });

  it("nenhuma aba é derivada de ref_etapa -- rótulo de etapa não aparece na navegação (AC2)", async () => {
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_MANDATO);

    render(<FichaContratoChrome idContrato={1}>{null}</FichaContratoChrome>);

    await screen.findByRole("link", { name: "Informações Gerais" });

    expect(screen.queryByRole("link", { name: /etapa/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Nenhuma etapa cadastrada" })).not.toBeInTheDocument();
  });

  it("rótulo 'Gestão da equipe' está presente e 'Assessores' não aparece na navegação (AC4)", async () => {
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_MANDATO);

    render(<FichaContratoChrome idContrato={1}>{null}</FichaContratoChrome>);

    const abaGestao = await screen.findByRole("link", { name: "Gestão da equipe" });
    expect(abaGestao).toHaveAttribute("href", "/contratos/1/vinculos");
    expect(screen.queryByRole("link", { name: "Assessores" })).not.toBeInTheDocument();
  });

  it("a aba 'Fatos Geradores e Registros' está presente, com o rótulo exato da spec (AC7)", async () => {
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_MANDATO);

    render(<FichaContratoChrome idContrato={1}>{null}</FichaContratoChrome>);

    await screen.findByRole("link", { name: "Fatos Geradores e Registros" });
  });

  it("não oferece mais 'Registrar Insight'/'Registrar Fato Gerador' (AD-057, T26) -- a escrita migrou para a aba", async () => {
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_MANDATO);

    render(<FichaContratoChrome idContrato={1}>{null}</FichaContratoChrome>);
    await screen.findByRole("link", { name: "Informações Gerais" });

    expect(screen.queryByRole("button", { name: "Registrar Insight" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar Fato Gerador" })).not.toBeInTheDocument();
  });

  it("enquanto o contrato carrega, não renderiza a barra de abas (estado de carregamento)", () => {
    buscarContratoParaFichaMock.mockReturnValue(new Promise(() => {}));

    render(<FichaContratoChrome idContrato={1}>{null}</FichaContratoChrome>);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
