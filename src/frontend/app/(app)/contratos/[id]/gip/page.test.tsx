import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: .specs/features/ficha-mandato-contrato/tasks.md, T36 Done-when
// (FMC-25..FMC-28) --
//  - Seletor oferece Início e Fim apenas, mais Evolução -- nenhum "Meio" (A-10)
//  - Título "Régua dos Sonhos (GIP)" conforme 57:508
//  - Carregando e erro cobertos
//
// Só o modo/seletor da página é testado aqui; o comportamento interno de
// GipRegua (T34) e GipEvolucao (T35) já tem cobertura própria -- por isso
// só a camada de dados (queries/gip, supabase/client, usePapelGlobal) é
// mockada, os componentes reais são montados, o que também prova
// "carregando e erro cobertos" sem duplicar os testes de T34/T35.

const buscarGipDoContratoMock = vi.fn();
const buscarEvolucaoGipMock = vi.fn();
vi.mock("@backend/queries/gip", () => ({
  buscarGipDoContrato: (...args: unknown[]) => buscarGipDoContratoMock(...args),
  buscarEvolucaoGip: (...args: unknown[]) => buscarEvolucaoGipMock(...args),
}));

vi.mock("@/hooks/use-papel-global", () => ({
  usePapelGlobal: () => ({ idUsuario: 42, papel: "gestora", carregando: false }),
}));

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
      insert: () => Promise.resolve({ error: null }),
    }),
  }),
}));

import ContratoGipPage from "./page";

const DIMENSAO = {
  idDimensao: 1,
  codigo: "d1",
  nome: "Dimensão 1",
  ordem: 1,
  valorMin: 0,
  valorMax: 2,
  niveis: [
    { valor: 0, descricao: "Não implementa" },
    { valor: 1, descricao: "Implementa" },
    { valor: 2, descricao: "Implementa estratégia" },
  ],
  valorAtual: null,
};

beforeEach(() => {
  buscarGipDoContratoMock.mockReset();
  buscarEvolucaoGipMock.mockReset();
  buscarGipDoContratoMock.mockResolvedValue({
    momento: "inicio",
    aplicado: false,
    aplicadoEm: null,
    dimensoes: [DIMENSAO],
  });
  buscarEvolucaoGipMock.mockResolvedValue([]);
});

afterEach(cleanup);

// Mesmo padrão de informacoes/page.test.tsx: o `use(params)` desta versão
// do Next exige a promise já resolvida com `status`/`value` anexados, senão
// suspende e a página nunca chega a renderizar em jsdom.
function paramsProntos(id: string): Promise<{ id: string }> {
  const valor = { id };
  return Object.assign(Promise.resolve(valor), { status: "fulfilled" as const, value: valor });
}

function renderizar(id = "7") {
  return render(<ContratoGipPage params={paramsProntos(id)} />);
}

describe("ContratoGipPage — título e seletor", () => {
  it("exibe o título 'Régua dos Sonhos (GIP)' (Figma 57:508)", () => {
    renderizar();
    expect(screen.getByText("Régua dos Sonhos (GIP)")).toBeInTheDocument();
  });

  it("o seletor oferece Início, Fim e Evolução -- nenhum 'Meio' (A-10)", () => {
    renderizar();

    expect(screen.getByRole("button", { name: "Início" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fim" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Evolução" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /meio/i })).not.toBeInTheDocument();
  });
});

describe("ContratoGipPage — monta os três modos", () => {
  it("modo inicial é Início: busca o GIP do contrato com momento='inicio'", async () => {
    renderizar();
    await waitFor(() => expect(buscarGipDoContratoMock).toHaveBeenCalledWith(expect.anything(), 7, "inicio"));
  });

  it("clicar em Fim troca o modo e busca momento='fim'", async () => {
    renderizar();
    await screen.findByText("Dimensão 1");

    fireEvent.click(screen.getByRole("button", { name: "Fim" }));

    await waitFor(() => expect(buscarGipDoContratoMock).toHaveBeenCalledWith(expect.anything(), 7, "fim"));
  });

  it("clicar em Evolução monta GipEvolucao (não GipRegua)", async () => {
    renderizar();
    await screen.findByText("Dimensão 1");

    fireEvent.click(screen.getByRole("button", { name: "Evolução" }));

    await waitFor(() => expect(buscarEvolucaoGipMock).toHaveBeenCalledWith(expect.anything(), 7));
    expect(screen.queryByText("Dimensão 1")).not.toBeInTheDocument();
    expect(screen.getByText("Evoluíram")).toBeInTheDocument();
  });
});

describe("ContratoGipPage — carregando e erro cobertos", () => {
  it("mostra o estado de carregamento antes da consulta resolver", () => {
    buscarGipDoContratoMock.mockReturnValue(new Promise(() => {})); // nunca resolve neste teste

    renderizar();

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("mostra <ErroInline> quando a consulta falha -- lado oposto do carregamento", async () => {
    buscarGipDoContratoMock.mockRejectedValue(new Error("RLS negou a leitura."));

    renderizar();

    expect(await screen.findByRole("alert")).toHaveTextContent("RLS negou a leitura.");
  });
});
