import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
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

const CONTRATO_MANDATO_PLL = {
  idContrato: 3,
  idProduto: 11,
  nomeProduto: "PLL",
  idContratante: 102,
  nomeContratante: "Mentorado Fulano",
  tipoContratante: "mandato",
  idMandato: 201,
  cargoAtual: "Deputado Estadual",
  partidoAtual: "PT",
  sgUf: "RJ",
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

    // Escopado ao <nav> da RouteTabs (PF-11/T12 acrescentou 2 links no
    // cabeçalho, fora do <nav> -- "Voltar ao dashboard" e "Fatos Geradores e
    // Registros", este com o MESMO texto de uma aba já existente).
    const nav = screen.getByRole("navigation");
    const links = within(nav).getAllByRole("link").map((el) => el.textContent);
    expect(links).toEqual(OITO_ABAS_MANDATO);
  });

  it("coalizão renderiza as 7 abas, sem 'Informações Gerais' (AC3)", async () => {
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_COALIZAO);

    render(<FichaContratoChrome idContrato={2}>{null}</FichaContratoChrome>);

    await screen.findByRole("link", { name: "Agenda" });

    const nav = screen.getByRole("navigation");
    expect(within(nav).queryByRole("link", { name: "Informações Gerais" })).not.toBeInTheDocument();
    const links = within(nav).getAllByRole("link").map((el) => el.textContent);
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

    await screen.findByRole("link", { name: "Informações Gerais" });
    const nav = screen.getByRole("navigation");
    await within(nav).findByRole("link", { name: "Fatos Geradores e Registros" });
  });

  it("não oferece mais 'Registrar Insight'/'Registrar Fato Gerador' (AD-057, T26) -- a escrita migrou para a aba", async () => {
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_MANDATO);

    render(<FichaContratoChrome idContrato={1}>{null}</FichaContratoChrome>);
    await screen.findByRole("link", { name: "Informações Gerais" });

    expect(screen.queryByRole("button", { name: "Registrar Insight" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar Fato Gerador" })).not.toBeInTheDocument();
  });

  it("contrato do PLL não mostra GIP/Formulários/Gestão da equipe (Pedro, 23/09)", async () => {
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_MANDATO_PLL);

    render(<FichaContratoChrome idContrato={3}>{null}</FichaContratoChrome>);

    await screen.findByRole("link", { name: "Informações Gerais" });
    const nav = screen.getByRole("navigation");
    const links = within(nav).getAllByRole("link").map((el) => el.textContent);
    expect(links).toEqual([
      "Informações Gerais",
      "Agenda",
      "Diagnóstico",
      "Planejamento Estratégico",
      "Fatos Geradores e Registros",
    ]);
  });

  it("lado oposto: contrato de Estratégia continua mostrando GIP/Formulários/Gestão da equipe", async () => {
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_MANDATO);

    render(<FichaContratoChrome idContrato={1}>{null}</FichaContratoChrome>);

    const nav = await screen.findByRole("navigation");
    expect(within(nav).getByRole("link", { name: "GIP" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Formulários" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Gestão da equipe" })).toBeInTheDocument();
  });

  it("enquanto o contrato carrega, não renderiza a barra de abas (estado de carregamento)", () => {
    buscarContratoParaFichaMock.mockReturnValue(new Promise(() => {}));

    render(<FichaContratoChrome idContrato={1}>{null}</FichaContratoChrome>);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

// PF-11 (.specs/features/pente-fino-2026-09/spec.md, "P3: Remover IIP
// provisório e padronizar botões de ação", T12 de tasks.md): o card IIP
// provisório sai da Ficha, substituído por um link pra aba de Incidência +
// botão voltar pro dashboard do produto.
describe("FichaContratoChrome — remoção do IIP provisório (PF-11)", () => {
  it("não renderiza mais o card IIP (AC1)", async () => {
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_MANDATO);

    render(<FichaContratoChrome idContrato={1}>{null}</FichaContratoChrome>);

    await screen.findByRole("link", { name: "Informações Gerais" });
    expect(screen.queryByText(/IIP \(provisório\)/)).not.toBeInTheDocument();
  });

  it("mostra um link pra aba 'Fatos Geradores e Registros' fora do <nav> (AC2)", async () => {
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_MANDATO);

    render(<FichaContratoChrome idContrato={1}>{null}</FichaContratoChrome>);

    await screen.findByRole("link", { name: "Informações Gerais" });
    const links = screen.getAllByRole("link", { name: "Fatos Geradores e Registros" });
    // 2 links com o mesmo nome: a aba (dentro do <nav>) e o botão-atalho do
    // cabeçalho (fora dele) -- exatamente o que a AC2 pede, não duplicação
    // acidental.
    expect(links).toHaveLength(2);
    expect(links.every((l) => l.getAttribute("href") === "/contratos/1/fatos-registros")).toBe(true);
  });

  it("mostra um botão de voltar pro dashboard do produto (AC3)", async () => {
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_MANDATO);

    render(<FichaContratoChrome idContrato={1}>{null}</FichaContratoChrome>);

    const voltar = await screen.findByRole("link", { name: /Voltar ao dashboard/ });
    expect(voltar).toHaveAttribute("href", "/produtos/estrategia/dashboard");
  });
});

// PF2-07 (.specs/features/pente-fino-2026-09-23/spec.md): Encontros passa a
// ser alcançável também como sub-aba de Agenda, sem deixar de ser rota
// própria (links existentes de encontro-popover.tsx/gargalos-tabela.tsx).
describe("FichaContratoChrome — sub-abas Agenda/Encontros (PF2-07)", () => {
  it("na rota /agenda, mostra as sub-abas Agenda/Encontros com Agenda selecionada (AC1)", async () => {
    pathnameAtual = "/contratos/1/agenda";
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_MANDATO);

    render(<FichaContratoChrome idContrato={1}>{null}</FichaContratoChrome>);
    await screen.findByRole("link", { name: "Informações Gerais" });

    expect(screen.getByRole("tab", { name: "Agenda" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Encontros" })).toHaveAttribute("aria-selected", "false");
  });

  it("acessar /encontros direto (link existente) mostra a sub-aba Encontros selecionada, com a aba-pai Agenda destacada (AC2)", async () => {
    pathnameAtual = "/contratos/1/encontros";
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_MANDATO);

    render(<FichaContratoChrome idContrato={1}>{null}</FichaContratoChrome>);
    await screen.findByRole("link", { name: "Informações Gerais" });

    expect(screen.getByRole("tab", { name: "Encontros" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Agenda" })).toHaveAttribute("aria-selected", "false");
    // A aba-pai "Agenda" (dentro do <nav>) continua destacada -- mesma classe
    // que RouteTabs usa pra marcar aba ativa (ver route-tabs.tsx).
    const nav = screen.getByRole("navigation");
    expect(within(nav).getByRole("link", { name: "Agenda" })).toHaveClass("text-secondary");
  });

  it("lado oposto: fora de Agenda/Encontros, não mostra a barra de sub-abas", async () => {
    pathnameAtual = "/contratos/1/informacoes";
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_MANDATO);

    render(<FichaContratoChrome idContrato={1}>{null}</FichaContratoChrome>);
    await screen.findByRole("link", { name: "Informações Gerais" });

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});
