import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// diagnostico-participante-pll (Informações Gerais PLL, Figma 449:4). Mesmos
// stubs de jsdom que informacoes/page.test.tsx já usa pro <Select> real do
// Radix (ResizeObserver/scrollIntoView/hasPointerCapture não existem em jsdom).
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

const mocks = vi.hoisted(() => ({ atualizarStatusContrato: vi.fn() }));

vi.mock("@backend/rpc/contrato", () => ({
  atualizarStatusContrato: mocks.atualizarStatusContrato,
}));

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({}),
}));

import type { ContratoParaFicha } from "@backend/queries/contrato";
import type { InformacoesGeraisPll } from "@backend/queries/pll-informacoes";
import { InformacoesGeraisPllPainel } from "./informacoes-gerais-pll";

const CONTRATO: ContratoParaFicha = {
  idContrato: 43,
  idProduto: 2,
  nomeProduto: "PLL",
  idContratante: 8,
  nomeContratante: "Mentorado Fulano",
  tipoContratante: "mandato",
  status: "ativo",
  idEtapaAtual: null,
  cargoAtual: "Deputado Estadual",
  partidoAtual: "PT",
  sgUf: "RJ",
};

const INFO: InformacoesGeraisPll = {
  idCadastroParticipante: 1,
  identidadeGenero: "Feminino",
  orientacaoSexual: "Heterossexual",
  corRaca: "Parda",
  tempoNaPolitica: "6-10 anos",
  idade: 42,
  escolaridade: "Pós-Graduação",
  mandatosAnteriores: "2 mandatos",
  cargosAnteriores: "Vereadora, Prefeita",
  nomeMentor: "Carlos Mendes",
  origemCadastro: { dataImportacao: "2026-08-01T00:00:00Z", nomeUsuario: "Gestora Fulana" },
  edicaoAtual: { nomeEdicao: "PLL 2026.1", dtInicio: "2026-01-01", dtFim: null, statusContrato: null },
  historico: [{ nomeEdicao: "PLL 2026.1", dtInicio: "2026-01-01", dtFim: null, statusContrato: "ativo" }],
};

beforeEach(() => {
  mocks.atualizarStatusContrato.mockReset().mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("InformacoesGeraisPllPainel", () => {
  it("mostra os Dados Pessoais e Dados do Mandato reais (Cargo/Partido/Estado vêm do contrato, não inventados)", () => {
    render(<InformacoesGeraisPllPainel idContrato={43} contrato={CONTRATO} info={INFO} onAtualizado={() => {}} />);

    expect(screen.getByText("Feminino")).toBeInTheDocument();
    expect(screen.getByText("42 anos")).toBeInTheDocument();
    expect(screen.getByText("Pós-Graduação")).toBeInTheDocument();
    expect(screen.getByText("PT")).toBeInTheDocument();
    expect(screen.getByText("RJ")).toBeInTheDocument();
    expect(screen.getByText("Deputado Estadual")).toBeInTheDocument();
  });

  it("sem mentor pareado, mostra o texto explicativo do Figma", () => {
    render(
      <InformacoesGeraisPllPainel
        idContrato={43}
        contrato={CONTRATO}
        info={{ ...INFO, nomeMentor: null }}
        onAtualizado={() => {}}
      />
    );

    expect(screen.getByText("Nenhum mentor pareado ainda")).toBeInTheDocument();
  });

  it("mostra o Histórico de Participação com Edição/Período/Status", () => {
    render(<InformacoesGeraisPllPainel idContrato={43} contrato={CONTRATO} info={INFO} onAtualizado={() => {}} />);

    expect(screen.getByRole("columnheader", { name: "Edição" })).toBeInTheDocument();
    expect(screen.getAllByText("PLL 2026.1").length).toBeGreaterThan(0);
  });

  it("trocar o status para Desistente exige motivo antes de habilitar 'Salvar status'", async () => {
    render(<InformacoesGeraisPllPainel idContrato={43} contrato={CONTRATO} info={INFO} onAtualizado={() => {}} />);

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: "Desistente" }));

    const botaoSalvar = await screen.findByRole("button", { name: "Salvar status" });
    expect(botaoSalvar).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Motivo"), { target: { value: "Mudou de partido" } });
    expect(botaoSalvar).toBeEnabled();
  });

  it("salvar chama atualizarStatusContrato com status/motivo certos e avisa onAtualizado", async () => {
    const onAtualizado = vi.fn();
    render(<InformacoesGeraisPllPainel idContrato={43} contrato={CONTRATO} info={INFO} onAtualizado={onAtualizado} />);

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: "Desligado" }));
    fireEvent.change(screen.getByPlaceholderText("Motivo"), { target: { value: "Não correspondeu ao esperado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar status" }));

    await waitFor(() =>
      expect(mocks.atualizarStatusContrato).toHaveBeenCalledWith(
        expect.anything(),
        43,
        "desligado",
        "Não correspondeu ao esperado"
      )
    );
    await waitFor(() => expect(onAtualizado).toHaveBeenCalled());
  });

  it("trocar pra Concluído não exige motivo -- 'Salvar status' já vem habilitado", async () => {
    render(<InformacoesGeraisPllPainel idContrato={43} contrato={CONTRATO} info={INFO} onAtualizado={() => {}} />);

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: "Concluído" }));

    expect(screen.queryByPlaceholderText("Motivo")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Salvar status" })).toBeEnabled();
  });
});
