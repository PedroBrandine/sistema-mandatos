import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PermissaoNegadaError } from "@backend/rpc/errors";

// Exclusão definitiva de um item da Incidência (pedido de Pedro, 2026-09-21):
// só admin/gestora veem o botão, o efeito colateral aparece ANTES de apagar, e
// nada é apagado sem a confirmação.

const mocks = vi.hoisted(() => ({
  resumoExclusaoIncidencia: vi.fn(),
  excluirIncidencia: vi.fn(),
  toastSuccess: vi.fn(),
  papel: "gestora" as string | null,
}));

vi.mock("@backend/rpc/exclusao", () => ({
  resumoExclusaoIncidencia: mocks.resumoExclusaoIncidencia,
  excluirIncidencia: mocks.excluirIncidencia,
}));
vi.mock("@backend/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/hooks/use-papel-global", () => ({
  usePapelGlobal: () => ({ papel: mocks.papel, idUsuario: 1, carregando: false }),
}));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess } }));

import { ExcluirIncidencia } from "./excluir-incidencia";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.papel = "gestora";
  mocks.resumoExclusaoIncidencia.mockResolvedValue({
    tipo: "insight",
    id: 7,
    situacao: null,
    contagens: { fatos_origem_desfeita: 2 },
  });
  mocks.excluirIncidencia.mockResolvedValue({});
});
afterEach(cleanup);

describe("ExcluirIncidencia", () => {
  it.each(["admin", "gestora"])("%s vê o botão Excluir", (papel) => {
    mocks.papel = papel;
    render(<ExcluirIncidencia tipo="insight" id={7} onExcluido={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Excluir insight" })).toBeInTheDocument();
  });

  it.each(["mentor", "assessor", null])("%s não vê o botão (o banco também recusaria)", (papel) => {
    mocks.papel = papel;
    render(<ExcluirIncidencia tipo="insight" id={7} onExcluido={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /Excluir/ })).not.toBeInTheDocument();
  });

  it("o rótulo acompanha o tipo do item", () => {
    render(<ExcluirIncidencia tipo="fato_gerador" id={1} onExcluido={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Excluir fato gerador" })).toBeInTheDocument();
  });

  it("clicar mostra o efeito colateral (fatos NÃO apagados) e ainda não apaga nada", async () => {
    render(<ExcluirIncidencia tipo="insight" id={7} onExcluido={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Excluir insight" }));

    expect(await screen.findByText("2 fatos geradores perdem a origem (eles não são apagados)")).toBeInTheDocument();
    expect(mocks.resumoExclusaoIncidencia).toHaveBeenCalledWith({}, "insight", 7);
    expect(mocks.excluirIncidencia).not.toHaveBeenCalled();
  });

  it("Cancelar volta ao botão sem apagar", async () => {
    render(<ExcluirIncidencia tipo="insight" id={7} onExcluido={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Excluir insight" }));
    await screen.findByText(/perdem a origem/);

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByRole("button", { name: "Excluir insight" })).toBeInTheDocument();
    expect(mocks.excluirIncidencia).not.toHaveBeenCalled();
  });

  it("confirmar apaga, mostra o toast e avisa quem chamou", async () => {
    const onExcluido = vi.fn();
    render(<ExcluirIncidencia tipo="insight" id={7} onExcluido={onExcluido} />);
    fireEvent.click(screen.getByRole("button", { name: "Excluir insight" }));
    await screen.findByText(/perdem a origem/);

    fireEvent.click(screen.getByRole("button", { name: /Excluir definitivamente/ }));

    await waitFor(() => expect(mocks.excluirIncidencia).toHaveBeenCalledWith({}, "insight", 7));
    await waitFor(() => expect(onExcluido).toHaveBeenCalledTimes(1));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Insight excluído.");
  });

  it("falha do banco fica na tela e não avisa quem chamou", async () => {
    mocks.excluirIncidencia.mockRejectedValue(new PermissaoNegadaError());
    const onExcluido = vi.fn();
    render(<ExcluirIncidencia tipo="insight" id={7} onExcluido={onExcluido} />);
    fireEvent.click(screen.getByRole("button", { name: "Excluir insight" }));
    await screen.findByText(/perdem a origem/);

    fireEvent.click(screen.getByRole("button", { name: /Excluir definitivamente/ }));

    expect(await screen.findByText("Você não tem permissão para realizar esta operação.")).toBeInTheDocument();
    expect(onExcluido).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });
});
