import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// PF-04 (T4): CardStatusEtapa usa o <Select> real (Radix) -- mesmos stubs de
// jsdom que mandato-wizard.test.tsx já usa pra interagir com um Select real
// (ResizeObserver/scrollIntoView/hasPointerCapture não existem em jsdom).
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
const buscarEtapasDoProdutoMock = vi.fn();
const atualizarStatusContratoMock = vi.fn();
const moverEtapaKanbanMock = vi.fn();

vi.mock("@backend/queries/contrato", () => ({
  buscarContratoParaFicha: (...args: unknown[]) => buscarContratoParaFichaMock(...args),
  buscarEtapasDoProduto: (...args: unknown[]) => buscarEtapasDoProdutoMock(...args),
}));

vi.mock("@backend/queries/ficha-mandato", () => ({
  buscarInformacoesGeraisMandato: (...args: unknown[]) => buscarInformacoesGeraisMandatoMock(...args),
}));

vi.mock("@backend/rpc/contrato", () => ({
  atualizarStatusContrato: (...args: unknown[]) => atualizarStatusContratoMock(...args),
}));

vi.mock("@backend/rpc/kanban", () => ({
  moverEtapaKanban: (...args: unknown[]) => moverEtapaKanbanMock(...args),
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

import InformacoesContratoPage from "./page";

const CONTRATO_MANDATO = {
  idContrato: 1,
  idProduto: 10,
  nomeProduto: "Estratégia",
  idContratante: 100,
  nomeContratante: "Mandato Fulano",
  tipoContratante: "mandato",
  idMandato: 200,
  status: "ativo" as const,
  idEtapaAtual: 11,
};

const CONTRATO_COALIZAO = {
  idContrato: 2,
  idProduto: 10,
  nomeProduto: "Estratégia",
  idContratante: 101,
  nomeContratante: "Coalizão Fulano",
  tipoContratante: "coalizao",
  status: "ativo" as const,
  idEtapaAtual: null,
};

const ETAPAS = [
  { idEtapa: 11, codigo: "diagnostico", nome: "Diagnóstico", ordem: 1 },
  { idEtapa: 12, codigo: "planejamento", nome: "Planejamento", ordem: 2 },
];

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
  buscarEtapasDoProdutoMock.mockReset();
  atualizarStatusContratoMock.mockReset();
  moverEtapaKanbanMock.mockReset();
  notFoundMock.mockClear();
  buscarEtapasDoProdutoMock.mockResolvedValue(ETAPAS);
  atualizarStatusContratoMock.mockResolvedValue(undefined);
  moverEtapaKanbanMock.mockResolvedValue(undefined);
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

describe("Página Informações Gerais — montagem dos 4 cards (FMC-05..FMC-13)", () => {
  it("passa os dados de cada bloco para o card correspondente", async () => {
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_MANDATO);
    buscarInformacoesGeraisMandatoMock.mockResolvedValue(DADOS_BASE);

    render(<InformacoesContratoPage params={paramsProntos("1")} />);

    expect(await screen.findByTestId("card-sobre-mandato")).toHaveTextContent("Bio do mandato");
    expect(screen.getByTestId("card-ponto-focal")).toHaveTextContent("Ana Legisla");
    expect(screen.getByTestId("card-historico-contratos")).toHaveTextContent("1");
    expect(screen.getByTestId("card-projetos-coalizoes")).toHaveTextContent("Projeto Alfa");
  });

  // DIAG-02 (.specs/features/diagnostico-mandato-estrategia/spec.md): o
  // bloco de Candidaturas no TSE saiu desta aba e não deve mais aparecer
  // aqui, mesmo que o mandato tenha candidaturas.
  it("não renderiza mais o bloco de Candidaturas no TSE (DIAG-02)", async () => {
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_MANDATO);
    buscarInformacoesGeraisMandatoMock.mockResolvedValue(DADOS_BASE);

    render(<InformacoesContratoPage params={paramsProntos("1")} />);

    await screen.findByTestId("card-sobre-mandato");
    expect(screen.queryByTestId("informacoes-tse-mandato")).not.toBeInTheDocument();
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

// PF-04 (T4). Test Coverage Matrix: 1:1 com as ACs da story "Editar Status e
// Etapa do mandato na Ficha" (spec.md) -- AC1 (campos visíveis), AC2 (Etapa
// grava pela mesma RPC do Kanban) e AC3 (transição inválida recusada com a
// mesma regra do Kanban).
describe("Página Informações Gerais — Status e Etapa do contrato (PF-04)", () => {
  async function abrirSelect(rotulo: string) {
    const secao = screen.getByText(rotulo).closest("div") as HTMLElement;
    const gatilho = within(secao).getByRole("combobox");
    fireEvent.click(gatilho);
    return secao;
  }

  it("exibe os campos de edição de Status e Etapa (AC1)", async () => {
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_MANDATO);
    buscarInformacoesGeraisMandatoMock.mockResolvedValue(DADOS_BASE);

    render(<InformacoesContratoPage params={paramsProntos("1")} />);

    expect(await screen.findByText("Status do contrato")).toBeInTheDocument();
    expect(screen.getByText("Etapa do produto")).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
  });

  it("alterar a Etapa chama moverEtapaKanban com o mesmo contrato/etapa (AC2)", async () => {
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_MANDATO);
    buscarInformacoesGeraisMandatoMock.mockResolvedValue(DADOS_BASE);

    render(<InformacoesContratoPage params={paramsProntos("1")} />);
    await screen.findByText("Etapa do produto");

    await abrirSelect("Etapa do produto");
    fireEvent.click(await screen.findByRole("option", { name: "Planejamento" }));

    fireEvent.click(screen.getByRole("button", { name: "Salvar etapa" }));

    await waitFor(() => expect(moverEtapaKanbanMock).toHaveBeenCalledWith(expect.anything(), {
      idContrato: 1,
      idEtapaDestino: 12,
    }));
    // AC2: mesma fonte de dados do Kanban -- a página refaz a leitura de
    // buscarContratoParaFicha (não um estado local paralelo) depois de salvar.
    await waitFor(() => expect(buscarContratoParaFichaMock).toHaveBeenCalledTimes(2));
  });

  it("transição de etapa inválida é recusada com a mesma regra do Kanban (AC3)", async () => {
    buscarContratoParaFichaMock.mockResolvedValue(CONTRATO_MANDATO);
    buscarInformacoesGeraisMandatoMock.mockResolvedValue(DADOS_BASE);
    moverEtapaKanbanMock.mockRejectedValue(
      new Error("Não é possível pular etapas — mova o card para a coluna adjacente.")
    );

    render(<InformacoesContratoPage params={paramsProntos("1")} />);
    await screen.findByText("Etapa do produto");

    await abrirSelect("Etapa do produto");
    fireEvent.click(await screen.findByRole("option", { name: "Planejamento" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar etapa" }));

    expect(
      await screen.findByText("Não é possível pular etapas — mova o card para a coluna adjacente.")
    ).toBeInTheDocument();
  });
});
