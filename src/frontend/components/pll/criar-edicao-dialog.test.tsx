import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Select (Radix) precisa desses stubs em jsdom -- mesmo racional de
// vincular-tse-dialog.test.tsx.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoViewStub() {};
}
if (!Element.prototype.hasPointerCapture) {
  (Element.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
}

import { CriarEdicaoDialog } from "./criar-edicao-dialog";

afterEach(() => cleanup());

const PROJETOS = [{ id: 25, nome: "Bancada do Clima" }];

describe("CriarEdicaoDialog", () => {
  // PF2-03 (.specs/features/pente-fino-2026-09-23/spec.md) AC1: dialog exibe
  // só Nome/Data de início/Projeto -- sem nenhum campo de mentores.
  it("não exibe nenhum campo de mentores (PF2-03 AC1)", async () => {
    const onCriar = vi.fn().mockResolvedValue(undefined);
    render(<CriarEdicaoDialog projetos={PROJETOS} onCriar={onCriar} />);

    fireEvent.click(screen.getByRole("button", { name: "Criar edição" }));
    await screen.findByLabelText("Nome da edição");

    expect(screen.queryByText(/mentor/i)).not.toBeInTheDocument();
  });

  it("submit fica desabilitado até nome + data + projeto estarem preenchidos", async () => {
    const onCriar = vi.fn().mockResolvedValue(undefined);
    render(<CriarEdicaoDialog projetos={PROJETOS} onCriar={onCriar} />);

    fireEvent.click(screen.getByRole("button", { name: "Criar edição" }));
    const botaoSubmit = await screen.findByRole("button", { name: "Criar edição" });
    expect(botaoSubmit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Nome da edição"), { target: { value: "PLL 2026.1" } });
    expect(botaoSubmit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Data de início"), { target: { value: "2026-02-01" } });
    // Ainda falta o projeto -- select custom (Radix), não muda via fireEvent.change.
    expect(botaoSubmit).toBeDisabled();
  });

  // PF2-03 AC2: com os 3 obrigatórios preenchidos, onCriar recebe o payload
  // SEM idsMentores/p_mentores_padrao, e o diálogo fecha.
  it("com nome/data/projeto preenchidos, onCriar recebe o payload sem idsMentores e o diálogo fecha", async () => {
    const onCriar = vi.fn().mockResolvedValue(undefined);
    render(<CriarEdicaoDialog projetos={PROJETOS} onCriar={onCriar} />);

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
      })
    );
    expect(onCriar).not.toHaveBeenCalledWith(expect.objectContaining({ idsMentores: expect.anything() }));
    await waitFor(() => expect(screen.queryByLabelText("Nome da edição")).not.toBeInTheDocument());
  });

  // Erro na criação: diálogo permanece aberto e mostra a mensagem, nunca
  // engole a falha (mesmo racional de PLL-CP-13 nos outros diálogos do PLL).
  it("erro em onCriar mantém o diálogo aberto e mostra a mensagem", async () => {
    const onCriar = vi.fn().mockRejectedValue(new Error("Edição duplicada"));
    render(<CriarEdicaoDialog projetos={PROJETOS} onCriar={onCriar} />);

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
