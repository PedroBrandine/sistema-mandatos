import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mesmos stubs de jsdom que os demais diálogos com <Command>/<Popover> exigem
// (MultiSelectPesquisavel usa Command internamente) -- mesmo racional de
// vincular-tse-dialog.test.tsx.
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

import { CriarEdicaoDialog } from "./criar-edicao-dialog";

afterEach(() => cleanup());

const PROJETOS = [{ id: 25, nome: "Bancada do Clima" }];
const MENTORES = [{ id: 55, nome: "Carla Mentora" }];

describe("CriarEdicaoDialog", () => {
  it("submit fica desabilitado até nome + data + projeto estarem preenchidos", async () => {
    const onCriar = vi.fn().mockResolvedValue(undefined);
    render(<CriarEdicaoDialog projetos={PROJETOS} mentores={MENTORES} onCriar={onCriar} />);

    fireEvent.click(screen.getByRole("button", { name: "Criar edição" }));
    const botaoSubmit = await screen.findByRole("button", { name: "Criar edição" });
    expect(botaoSubmit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Nome da edição"), { target: { value: "PLL 2026.1" } });
    expect(botaoSubmit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Data de início"), { target: { value: "2026-02-01" } });
    // Ainda falta o projeto -- select custom (Radix), não muda via fireEvent.change.
    expect(botaoSubmit).toBeDisabled();
  });

  // Lado oposto: com os 3 obrigatórios preenchidos (mentores fica vazio, caso
  // válido), onCriar recebe o payload certo e o diálogo fecha.
  it("com nome/data/projeto preenchidos, onCriar recebe o payload e o diálogo fecha", async () => {
    const onCriar = vi.fn().mockResolvedValue(undefined);
    render(<CriarEdicaoDialog projetos={PROJETOS} mentores={MENTORES} onCriar={onCriar} />);

    fireEvent.click(screen.getByRole("button", { name: "Criar edição" }));
    fireEvent.change(await screen.findByLabelText("Nome da edição"), { target: { value: "PLL 2026.1" } });
    fireEvent.change(screen.getByLabelText("Data de início"), { target: { value: "2026-02-01" } });

    // Select nativo do Radix: abre o trigger e clica na opção.
    fireEvent.click(screen.getByLabelText("Projeto/temática"));
    fireEvent.click(await screen.findByText("Bancada do Clima"));

    const botaoSubmit = screen.getAllByRole("button", { name: "Criar edição" }).at(-1)!;
    await waitFor(() => expect(botaoSubmit).not.toBeDisabled());
    fireEvent.click(botaoSubmit);

    await waitFor(() =>
      expect(onCriar).toHaveBeenCalledWith({
        nome: "PLL 2026.1",
        dtInicio: "2026-02-01",
        idProjeto: 25,
        idsMentores: [],
      })
    );
    await waitFor(() => expect(screen.queryByLabelText("Nome da edição")).not.toBeInTheDocument());
  });

  // Erro na criação: diálogo permanece aberto e mostra a mensagem, nunca
  // engole a falha (mesmo racional de PLL-CP-13 nos outros diálogos do PLL).
  it("erro em onCriar mantém o diálogo aberto e mostra a mensagem", async () => {
    const onCriar = vi.fn().mockRejectedValue(new Error("Edição duplicada"));
    render(<CriarEdicaoDialog projetos={PROJETOS} mentores={MENTORES} onCriar={onCriar} />);

    fireEvent.click(screen.getByRole("button", { name: "Criar edição" }));
    fireEvent.change(await screen.findByLabelText("Nome da edição"), { target: { value: "PLL 2026.1" } });
    fireEvent.change(screen.getByLabelText("Data de início"), { target: { value: "2026-02-01" } });
    fireEvent.click(screen.getByLabelText("Projeto/temática"));
    fireEvent.click(await screen.findByText("Bancada do Clima"));

    const botaoSubmit = screen.getAllByRole("button", { name: "Criar edição" }).at(-1)!;
    await waitFor(() => expect(botaoSubmit).not.toBeDisabled());
    fireEvent.click(botaoSubmit);

    expect(await screen.findByText("Edição duplicada")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome da edição")).toBeInTheDocument();
  });
});
