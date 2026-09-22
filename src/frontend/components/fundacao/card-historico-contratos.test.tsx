import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import type { HistoricoContratoLinha } from "@backend/queries/ficha-mandato";

import { CardHistoricoContratos } from "./card-historico-contratos";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P1: Informações
// Gerais do mandato" AC8 (FMC-12). Um caso de teste por valor do enum
// (lição L-003/L-010, citada no Done-when da T27) -- nunca um caso
// representativo só.

function linha(overrides: Partial<HistoricoContratoLinha> = {}): HistoricoContratoLinha {
  return {
    idContrato: 1,
    status: "ativo",
    dtInicio: "2026-01-15",
    dtFim: null,
    ...overrides,
  };
}

afterEach(cleanup);

describe("CardHistoricoContratos — rótulo de status (FMC-12 AC8)", () => {
  it("status 'ativo' rotula 'Ativo'", () => {
    render(<CardHistoricoContratos contratos={[linha({ status: "ativo" })]} />);
    expect(screen.getByText("Ativo")).toBeInTheDocument();
  });

  it("status 'concluido' rotula 'Concluído'", () => {
    render(<CardHistoricoContratos contratos={[linha({ status: "concluido" })]} />);
    expect(screen.getByText("Concluído")).toBeInTheDocument();
  });

  it("status 'nao_concluido' rotula 'Não concluído'", () => {
    render(<CardHistoricoContratos contratos={[linha({ status: "nao_concluido" })]} />);
    expect(screen.getByText("Não concluído")).toBeInTheDocument();
  });

  it("nunca rotula 'Em andamento' nem nome de etapa, para nenhum dos três status", () => {
    render(
      <CardHistoricoContratos
        contratos={[
          linha({ idContrato: 1, status: "ativo" }),
          linha({ idContrato: 2, status: "concluido" }),
          linha({ idContrato: 3, status: "nao_concluido" }),
        ]}
      />
    );

    expect(screen.queryByText("Em andamento")).not.toBeInTheDocument();
    expect(screen.queryByText(/Diagnóstico|Planejamento|Execução/)).not.toBeInTheDocument();
  });
});

describe("CardHistoricoContratos — leitura, sem controle de edição (Out of Scope da spec)", () => {
  it("não renderiza nenhum controle de edição (input, select ou botão) na tabela", () => {
    render(<CardHistoricoContratos contratos={[linha()]} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("mandato sem nenhum outro contrato mostra a linha do próprio contrato (edge case da spec)", () => {
    render(<CardHistoricoContratos contratos={[linha({ idContrato: 42 })]} />);

    // Linha do corpo tem role="link" (linha inteira clicável), não "row" --
    // só o cabeçalho mantém role="row".
    expect(screen.getAllByRole("row")).toHaveLength(1); // cabeçalho
    expect(screen.getAllByRole("link")).toHaveLength(1); // 1 linha de contrato
  });

  it("contrato sem dt_fim (em vigência) mostra '—' na coluna Fim (AD-005)", () => {
    render(<CardHistoricoContratos contratos={[linha({ idContrato: 1, dtInicio: "2026-01-15", dtFim: null })]} />);

    expect(screen.getByText("15/01/2026")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("contrato com dt_fim mostra a data formatada -- lado oposto", () => {
    render(
      <CardHistoricoContratos
        contratos={[linha({ idContrato: 1, dtInicio: "2024-03-10", dtFim: "2025-12-31" })]}
      />
    );

    expect(screen.getByText("10/03/2024")).toBeInTheDocument();
    expect(screen.getByText("31/12/2025")).toBeInTheDocument();
  });
});

// Clique na linha navega pro contrato correspondente -- mesmo padrão de
// "linha inteira clicável" de visao-gerencial/gargalos-tabela.tsx (T29):
// TableRow é um <tr> puro, então onClick/onKeyDown no <tr> em vez de <Link>.
describe("CardHistoricoContratos — linha clicável", () => {
  afterEach(() => push.mockClear());

  it("clique na linha navega para o contrato daquela linha", () => {
    render(
      <CardHistoricoContratos
        contratos={[linha({ idContrato: 1 }), linha({ idContrato: 42, status: "concluido" })]}
      />
    );

    screen.getAllByRole("link")[1].click();

    expect(push).toHaveBeenCalledWith("/contratos/42");
  });

  it("Enter na linha focada também navega (acessível por teclado)", () => {
    render(<CardHistoricoContratos contratos={[linha({ idContrato: 7 })]} />);

    screen.getByRole("link").focus();
    fireEvent.keyDown(screen.getByRole("link"), { key: "Enter" });

    expect(push).toHaveBeenCalledWith("/contratos/7");
  });
});

// Pedido do Pedro (2026-09-22): destacar em qual contrato a Ficha está
// aberta, dentro da própria lista de histórico.
describe("CardHistoricoContratos — identificação do contrato atual (idContratoAtual)", () => {
  it("marca 'Você está aqui' só na linha do contrato atual", () => {
    render(
      <CardHistoricoContratos
        contratos={[linha({ idContrato: 1 }), linha({ idContrato: 42, status: "concluido" })]}
        idContratoAtual={42}
      />
    );

    expect(screen.getByText("Você está aqui")).toBeInTheDocument();
    expect(screen.getAllByText("Você está aqui")).toHaveLength(1);
  });

  it("sem idContratoAtual, nenhuma linha é marcada", () => {
    render(<CardHistoricoContratos contratos={[linha({ idContrato: 1 })]} />);

    expect(screen.queryByText("Você está aqui")).not.toBeInTheDocument();
  });

  it("a linha do contrato atual não navega ao clicar (já é a página aberta)", () => {
    render(
      <CardHistoricoContratos
        contratos={[linha({ idContrato: 1 }), linha({ idContrato: 42, status: "concluido" })]}
        idContratoAtual={42}
      />
    );

    // Só a linha 1 (não-atual) tem role="link" -- a linha atual perde o
    // role e o clique, ficando só o destaque visual.
    expect(screen.getAllByRole("link")).toHaveLength(1);

    fireEvent.click(screen.getByText("Você está aqui"));
    expect(push).not.toHaveBeenCalled();
  });
});
