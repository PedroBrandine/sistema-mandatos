import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: .specs/features/fatos-geradores-ciclo-vida/spec.md, "P1:
// Registrar Fato Gerador pelo wizard" AC1 (natureza + origem no passo 1) e
// Edge Case "voltar do passo 2 ao 1 preserva o preenchido". AD-042 integral.
//
// SeletorOrigem e FatoGeradorForm são mockados como componentes opacos
// (mesmo padrão de mandato-wizard.test.tsx mockando TseMatchSearch): o que
// está sob teste aqui é a orquestração de passo do wizard, não o conteúdo
// interno de cada filho -- cada um já tem (ou terá, T15/T17) seu próprio
// teste.
const origemSemOrigem = { tipo: "sem_origem" as const };

vi.mock("./seletor-origem", () => ({
  SeletorOrigem: ({
    valor,
    onSelecionar,
  }: {
    valor: unknown;
    onSelecionar: (o: typeof origemSemOrigem) => void;
  }) => (
    <div>
      <p>mock: origem atual = {valor ? JSON.stringify(valor) : "nenhuma"}</p>
      <button type="button" onClick={() => onSelecionar(origemSemOrigem)}>
        mock: selecionar sem origem
      </button>
    </div>
  ),
}));

vi.mock("./fato-gerador-form", () => ({
  FatoGeradorForm: (props: {
    situacaoInicial: string;
    origemInicial: { tipo: string };
    onCancelar: () => void;
    onConcluido: (criado?: { idFatoGerador: number }) => void;
  }) => (
    <div>
      <p>Passo 2 -- situacao: {props.situacaoInicial}</p>
      <p>Passo 2 -- origem: {props.origemInicial.tipo}</p>
      <button type="button" onClick={props.onCancelar}>
        mock: cancelar form
      </button>
      <button type="button" onClick={() => props.onConcluido({ idFatoGerador: 42 })}>
        mock: concluir form
      </button>
    </div>
  ),
}));

import { FatoGeradorWizard } from "./fato-gerador-wizard";

const onConcluido = vi.fn();
const onCancelar = vi.fn();

beforeEach(() => {
  onConcluido.mockReset();
  onCancelar.mockReset();
});

afterEach(cleanup);

function renderizar() {
  return render(<FatoGeradorWizard idContrato={7} onConcluido={onConcluido} onCancelar={onCancelar} />);
}

describe("FatoGeradorWizard — passo 1 (AC1)", () => {
  it("pergunta natureza e origem, sem mostrar o passo 2 ainda", () => {
    renderizar();

    expect(screen.getByRole("button", { name: "Já aconteceu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ainda vai acontecer" })).toBeInTheDocument();
    expect(screen.getByText(/mock: origem atual/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "← Voltar" })).not.toBeInTheDocument();
  });

  it("Avançar fica desabilitado até natureza E origem estarem escolhidas", () => {
    renderizar();

    expect(screen.getByRole("button", { name: "Avançar" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Já aconteceu" }));
    expect(screen.getByRole("button", { name: "Avançar" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "mock: selecionar sem origem" }));
    expect(screen.getByRole("button", { name: "Avançar" })).toBeEnabled();
  });

  it("só a natureza escolhida (sem origem) mantém Avançar desabilitado -- lado oposto", () => {
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "mock: selecionar sem origem" }));

    expect(screen.getByRole("button", { name: "Avançar" })).toBeDisabled();
  });

  it("Cancelar no passo 1 aciona onCancelar do wizard", () => {
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancelar).toHaveBeenCalledTimes(1);
  });
});

describe("FatoGeradorWizard — avanço para o passo 2 (AC1/AC2)", () => {
  it("Avançar leva ao passo 2 recebendo situacao e origem do passo 1 como props", () => {
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "Ainda vai acontecer" }));
    fireEvent.click(screen.getByRole("button", { name: "mock: selecionar sem origem" }));
    fireEvent.click(screen.getByRole("button", { name: "Avançar" }));

    expect(screen.getByText("Passo 2 -- situacao: projetado")).toBeInTheDocument();
    expect(screen.getByText("Passo 2 -- origem: sem_origem")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Já aconteceu" })).not.toBeInTheDocument();
  });

  it("concluir o formulário do passo 2 propaga onConcluido do wizard", () => {
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "Já aconteceu" }));
    fireEvent.click(screen.getByRole("button", { name: "mock: selecionar sem origem" }));
    fireEvent.click(screen.getByRole("button", { name: "Avançar" }));

    fireEvent.click(screen.getByRole("button", { name: "mock: concluir form" }));

    expect(onConcluido).toHaveBeenCalledWith({ idFatoGerador: 42 });
  });

  it("cancelar o formulário do passo 2 aciona onCancelar do wizard inteiro (não volta ao passo 1)", () => {
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "Já aconteceu" }));
    fireEvent.click(screen.getByRole("button", { name: "mock: selecionar sem origem" }));
    fireEvent.click(screen.getByRole("button", { name: "Avançar" }));

    fireEvent.click(screen.getByRole("button", { name: "mock: cancelar form" }));

    // O wizard não decide sozinho se esconde a si mesmo (isso é do
    // Dialog que o hospeda, fora deste componente) -- só repassa o
    // onCancelar do chamador, sem voltar ao passo 1.
    expect(onCancelar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Já aconteceu" })).not.toBeInTheDocument();
  });
});

describe("FatoGeradorWizard — Voltar preserva o preenchido (Edge Case da spec)", () => {
  it("voltar do passo 2 ao passo 1 mantém natureza e origem já escolhidas", () => {
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "Já aconteceu" }));
    fireEvent.click(screen.getByRole("button", { name: "mock: selecionar sem origem" }));
    fireEvent.click(screen.getByRole("button", { name: "Avançar" }));

    fireEvent.click(screen.getByRole("button", { name: "← Voltar" }));

    // De volta ao passo 1: "Já aconteceu" continua com a variante ativa
    // (dado preservado, não resetado) e Avançar continua habilitado.
    expect(screen.getByRole("button", { name: "Já aconteceu" })).toHaveAttribute("data-variant", "default");
    expect(screen.getByRole("button", { name: "Ainda vai acontecer" })).toHaveAttribute("data-variant", "outline");
    expect(screen.getByRole("button", { name: "Avançar" })).toBeEnabled();

    // E avançar de novo leva ao MESMO passo 2 (situacao ainda "realizado").
    fireEvent.click(screen.getByRole("button", { name: "Avançar" }));
    expect(screen.getByText("Passo 2 -- situacao: realizado")).toBeInTheDocument();
  });
});
