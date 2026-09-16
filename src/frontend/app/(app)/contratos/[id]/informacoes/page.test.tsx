import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P1: Informações
// Gerais do mandato" (FMC-05..FMC-13) + Edge Cases ("contrato de coalizão
// abre a aba Informações Gerais por URL direta -> notFound()"). Test
// Coverage Matrix (tasks.md, T29): página monta os 4 cards de T25-T28 + a
// seção TSE -- os cards já têm cobertura própria (card-*.test.tsx), então
// este teste cobre só a MONTAGEM: carregando, erro, notFound, e que cada
// card recebe os dados certos (Check C -- não repete os testes internos de
// cada card).
//
// notFoundMock lança por padrão (guarda contra chamada inesperada, mesmo
// padrão de ficha-contrato-chrome.test.tsx) -- só o teste do edge case de
// coalizão desarma o throw com mockImplementationOnce, porque no real Next.js
// notFound() interrompe o render via um digest especial que a árvore de
// componentes deste teste (sem o error boundary de verdade) não reproduz.
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("notFound() chamado inesperadamente no teste");
  })
);

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({}),
}));

const buscarContratoParaFichaMock = vi.fn();
const buscarInformacoesGeraisMandatoMock = vi.fn();

vi.mock("@backend/queries/contrato", () => ({
  buscarContratoParaFicha: (...args: unknown[]) => buscarContratoParaFichaMock(...args),
}));

vi.mock("@backend/queries/ficha-mandato", () => ({
  buscarInformacoesGeraisMandato: (...args: unknown[]) => buscarInformacoesGeraisMandatoMock(...args),
}));

vi.mock("@/components/fundacao/card-sobre-mandato", () => ({
  CardSobreMandato: ({ minibiografia }: { minibiografia: string | null }) => (
    <div data-testid="card-sobre-mandato">{minibiografia ?? "sem-bio"}</div>
  ),
}));
vi.mock("@/components/fundacao/card-ponto-focal", () => ({
  CardPontoFocal: ({ pontoFocal }: { pontoFocal: { nome: string } | null }) => (
    <div data-testid="card-ponto-focal">{pontoFocal?.nome ?? "sem-ponto-focal"}</div>
  ),
}));
vi.mock("@/components/fundacao/card-historico-contratos", () => ({
  CardHistoricoContratos: ({ contratos }: { contratos: unknown[] }) => (
    <div data-testid="card-historico-contratos">{contratos.length}</div>
  ),
}));
vi.mock("@/components/fundacao/card-projetos-coalizoes", () => ({
  CardProjetosCoalizoes: ({ projeto }: { projeto: { nome: string } | null }) => (
    <div data-testid="card-projetos-coalizoes">{projeto?.nome ?? "sem-projeto"}</div>
  ),
}));
vi.mock("@/components/fundacao/informacoes-tse-mandato", () => ({
  InformacoesTseMandato: ({ idMandato }: { idMandato: number }) => (
    <div data-testid="informacoes-tse-mandato">{idMandato}</div>
  ),
}));

import InformacoesContratoPage from "./page";

const CONTRATO_MANDATO = {
  idContrato: 1,
  idProduto: 10,
  nomeProduto: "Estratégia",
  idContratante: 100,
  nomeContratante: "Mandato Fulano",
  tipoContratante: "mandato",
  idMandato: 200,
};

const CONTRATO_COALIZAO = {
  idContrato: 2,
  idProduto: 10,
  nomeProduto: "Estratégia",
  idContratante: 101,
  nomeContratante: "Coalizão Fulano",
  tipoContratante: "coalizao",
};

const DADOS_BASE = {
  idMandato: 200,
  minibiografia: "Bio do mandato",
  principaisPautas: ["Educação"],
  areasTematicas: [],
  contatoParlamentar: null,
  contatoChefeGabinete: null,
  pontoFocal: { idUsuario: 1, nome: "Ana Legisla" },
  gestoras: [],
  historicoContratos: [{ idContrato: 1, status: "ativo", dtInicio: "2026-01-01", dtFim: null }],
  projeto: { idProjeto: 5, nome: "Projeto Alfa" },
  coalizoes: [],
};

function paramsProntos(id: string): Promise<{ id: string }> {
  const valor = { id };
  return Object.assign(Promise.resolve(valor), { status: "fulfilled" as const, value: valor });
}

beforeEach(() => {
  buscarContratoParaFichaMock.mockReset();
  buscarInformacoesGeraisMandatoMock.mockReset();
  notFoundMock.mockClear();
});

afterEach(cleanup);

describe("Página Informações Gerais — carregando e erro", () => {
  it("enquanto carrega, renderiza <CarregandoSkeleton>", () => {
    buscarContratoParaFichaMock.mockReturnValue(new Promise(() => {}));
    buscarInformacoesGeraisMandatoMock.mockReturnValue(new Promise(() => {}));

    render(<InformacoesContratoPage params={paramsProntos("1")} />);

    expect(screen.getByRole("status", { name: "Carregando" })).toBeInTheDocument();
  });

  it("falha em buscarInformacoesGeraisMandato renderiza <ErroInline>", async () => {
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_MANDATO);
    buscarInformacoesGeraisMandatoMock.mockRejectedValue(new Error("RLS negou a leitura"));

    render(<InformacoesContratoPage params={paramsProntos("1")} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("RLS negou a leitura");
  });
});

describe("Página Informações Gerais — coalizão responde notFound() (edge case da spec)", () => {
  it("contrato de coalizão acessando a rota chama notFound()", async () => {
    notFoundMock.mockImplementationOnce(() => {});
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_COALIZAO);
    buscarInformacoesGeraisMandatoMock.mockResolvedValue(null);

    render(<InformacoesContratoPage params={paramsProntos("2")} />);

    // notFound() só dispara depois que `contrato` resolve e o efeito marca
    // tipoContratante !== "mandato" como ausente (null) -- é a mesma
    // resolução assíncrona do chrome (ficha-contrato-chrome.tsx).
    await waitFor(() => expect(notFoundMock).toHaveBeenCalled());
  });
});

describe("Página Informações Gerais — montagem dos 4 cards + TSE (FMC-05..FMC-13)", () => {
  it("passa os dados de cada bloco para o card correspondente e monta o TSE abaixo", async () => {
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_MANDATO);
    buscarInformacoesGeraisMandatoMock.mockResolvedValue(DADOS_BASE);

    render(<InformacoesContratoPage params={paramsProntos("1")} />);

    expect(await screen.findByTestId("card-sobre-mandato")).toHaveTextContent("Bio do mandato");
    expect(screen.getByTestId("card-ponto-focal")).toHaveTextContent("Ana Legisla");
    expect(screen.getByTestId("card-historico-contratos")).toHaveTextContent("1");
    expect(screen.getByTestId("card-projetos-coalizoes")).toHaveTextContent("Projeto Alfa");
    expect(screen.getByTestId("informacoes-tse-mandato")).toHaveTextContent("200");
  });

  it("layout de duas colunas: Sobre o Mandato/Ponto Focal e Histórico/Projetos ficam em colunas separadas", async () => {
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_MANDATO);
    buscarInformacoesGeraisMandatoMock.mockResolvedValue(DADOS_BASE);

    render(<InformacoesContratoPage params={paramsProntos("1")} />);

    const colunaEsquerda = await screen.findByTestId("card-sobre-mandato");
    const colunaDireita = screen.getByTestId("card-historico-contratos");

    expect(colunaEsquerda.parentElement).not.toBe(colunaDireita.parentElement);
    expect(colunaEsquerda.parentElement?.contains(screen.getByTestId("card-ponto-focal"))).toBe(true);
    expect(colunaDireita.parentElement?.contains(screen.getByTestId("card-projetos-coalizoes"))).toBe(true);
  });

  it("contrato sem dim_mandato associado (edge, não deveria ocorrer aqui) renderiza <ErroInline>, não tela quebrada", async () => {
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_MANDATO);
    buscarInformacoesGeraisMandatoMock.mockResolvedValue(null);

    render(<InformacoesContratoPage params={paramsProntos("1")} />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
