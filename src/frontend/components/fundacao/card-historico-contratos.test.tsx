import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

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

    expect(screen.getAllByRole("row")).toHaveLength(2); // cabeçalho + 1 linha
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
