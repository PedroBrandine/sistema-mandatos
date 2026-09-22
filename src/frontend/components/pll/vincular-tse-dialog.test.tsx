import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: tasks.md T11 "Done when" (PLL-CP-10, PLL-CP-13):
//  - Busca pré-preenchida com os campos autodeclarados
//  - Fechar sem escolher candidatura nem marcar "não encontrado" é bloqueado
//  - npm run test:unit verde (mesmo padrão de 3 blocos de tse-match-search.test.tsx)
//
// Mesmos stubs de jsdom que tse-match-search.test.tsx precisa pro cmdk
// (<Command>) montar -- ResizeObserver/scrollIntoView, mesmo raciocínio.
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
  (Element.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
}

const buscarCandidaturasMock = vi.fn();

vi.mock("@backend/queries/tse", () => ({
  buscarCandidaturas: (...args: unknown[]) => buscarCandidaturasMock(...args),
}));
vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({}),
}));

import { VincularTseDialog } from "./vincular-tse-dialog";

const CANDIDATURA = {
  anoEleicao: 2022,
  sqCandidato: 111,
  nrTurno: 1,
  nrTituloEleitoral: "123456789012",
  nmCandidato: "PEDRO ANTONIO BIGARDI",
  nmUrna: "PEDRO BIGARDI",
  sgUf: "SP",
  nmMunicipioPrincipal: "CAMPINAS",
  sgPartido: "PC do B",
  cdCargo: 7,
  dsGenero: "MASCULINO",
  qtVotosTotal: 1000,
  metodoMatch: "nome_uf_cargo" as const,
  confianca: "alta" as const,
};

const PARTICIPANTE = {
  nomeCompleto: "Fulana de Tal",
  nomeParlamentar: "Pedro Bigardi",
  siglaPartido: "PC do B",
  siglaUf: "SP",
};

beforeEach(() => {
  buscarCandidaturasMock.mockReset();
});

afterEach(cleanup);

describe("VincularTseDialog — pré-preenchimento (PLL-CP-10)", () => {
  it("busca inicial já parte do nome do parlamentar autodeclarado", () => {
    render(
      <VincularTseDialog
        open
        onOpenChange={vi.fn()}
        participante={PARTICIPANTE}
        onConfirmar={vi.fn()}
        onNaoEncontrado={vi.fn()}
      />
    );

    expect(screen.getByRole("combobox")).toHaveValue("Pedro Bigardi");
  });

  it("lado oposto: sem nome de parlamentar declarado, cai pro nome completo do participante", () => {
    render(
      <VincularTseDialog
        open
        onOpenChange={vi.fn()}
        participante={{ ...PARTICIPANTE, nomeParlamentar: null }}
        onConfirmar={vi.fn()}
        onNaoEncontrado={vi.fn()}
      />
    );

    expect(screen.getByRole("combobox")).toHaveValue("Fulana de Tal");
  });
});

describe("VincularTseDialog — confirmar candidatura", () => {
  it("selecionar um resultado chama onConfirmar com a candidatura e fecha o dialog", async () => {
    buscarCandidaturasMock.mockResolvedValue([CANDIDATURA]);
    const onConfirmar = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <VincularTseDialog
        open
        onOpenChange={onOpenChange}
        participante={PARTICIPANTE}
        onConfirmar={onConfirmar}
        onNaoEncontrado={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByText("PEDRO BIGARDI"));

    await waitFor(() => expect(onConfirmar).toHaveBeenCalledWith(CANDIDATURA));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // Lado oposto: sem resultado nenhum (modo manual), a lista mostra o estado
  // vazio e nenhuma decisão de confirmação é feita sem uma seleção real.
  it("sem resultados, o estado vazio aparece e onConfirmar não é chamado sozinho", async () => {
    buscarCandidaturasMock.mockResolvedValue([]);
    const onConfirmar = vi.fn();
    render(
      <VincularTseDialog
        open
        onOpenChange={vi.fn()}
        participante={PARTICIPANTE}
        onConfirmar={onConfirmar}
        onNaoEncontrado={vi.fn()}
      />
    );

    expect(await screen.findByText("Nenhuma candidatura encontrada.")).toBeInTheDocument();
    expect(onConfirmar).not.toHaveBeenCalled();
  });
});

describe("VincularTseDialog — 'Não encontrado'", () => {
  it("clicar em 'Não encontrado' chama onNaoEncontrado e fecha o dialog", async () => {
    buscarCandidaturasMock.mockResolvedValue([]);
    const onNaoEncontrado = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <VincularTseDialog
        open
        onOpenChange={onOpenChange}
        participante={PARTICIPANTE}
        onConfirmar={vi.fn()}
        onNaoEncontrado={onNaoEncontrado}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Não encontrado" }));

    await waitFor(() => expect(onNaoEncontrado).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("VincularTseDialog — PLL-CP-13 revisado (22/09): ESC/overlay bloqueados, X permitido", () => {
  it("tecla Escape não fecha o dialog nem chama onOpenChange(false)", async () => {
    buscarCandidaturasMock.mockResolvedValue([]);
    const onOpenChange = vi.fn();
    render(
      <VincularTseDialog
        open
        onOpenChange={onOpenChange}
        participante={PARTICIPANTE}
        onConfirmar={vi.fn()}
        onNaoEncontrado={vi.fn()}
      />
    );

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

    // O conteúdo continua montado -- nenhuma chamada com `false` chegou ao pai.
    expect(screen.getByText(/Vincular Fulana de Tal ao TSE/)).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("clique no overlay não fecha o dialog nem chama onOpenChange(false)", async () => {
    buscarCandidaturasMock.mockResolvedValue([]);
    const onOpenChange = vi.fn();
    const { container } = render(
      <VincularTseDialog
        open
        onOpenChange={onOpenChange}
        participante={PARTICIPANTE}
        onConfirmar={vi.fn()}
        onNaoEncontrado={vi.fn()}
      />
    );

    const overlay = container.ownerDocument.querySelector('[data-slot="dialog-overlay"]');
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay as Element);

    expect(screen.getByText(/Vincular Fulana de Tal ao TSE/)).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  // Sessão 22/09: X explícito é a válvula de escape deliberada -- diferente
  // de ESC/overlay (acidentais), clicar no X é uma ação consciente e agora
  // fecha o dialog normalmente, sem decidir vínculo nem "não encontrado".
  it("existe um X e clicar nele chama onOpenChange(false), sem confirmar nem marcar não encontrado", () => {
    const onOpenChange = vi.fn();
    const onConfirmar = vi.fn();
    const onNaoEncontrado = vi.fn();
    render(
      <VincularTseDialog
        open
        onOpenChange={onOpenChange}
        participante={PARTICIPANTE}
        onConfirmar={onConfirmar}
        onNaoEncontrado={onNaoEncontrado}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirmar).not.toHaveBeenCalled();
    expect(onNaoEncontrado).not.toHaveBeenCalled();
  });
});
