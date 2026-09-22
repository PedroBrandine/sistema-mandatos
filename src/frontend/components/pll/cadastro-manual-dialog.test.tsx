import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
  (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver ?? ResizeObserverStub;
if (!Element.prototype.hasPointerCapture) {
  (Element.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
}

import { CadastroManualDialog } from "./cadastro-manual-dialog";

afterEach(() => cleanup());

describe("CadastroManualDialog", () => {
  it("submit fica desabilitado sem nome/e-mail preenchidos", async () => {
    const onCriar = vi.fn().mockResolvedValue(undefined);
    render(<CadastroManualDialog onCriar={onCriar} />);

    fireEvent.click(screen.getByRole("button", { name: "Cadastrar participante" }));
    const botaoSubmit = await screen.findByRole("button", { name: "Cadastrar" });
    expect(botaoSubmit).toBeDisabled();
  });

  // Happy path: nome+e-mail válidos chamam onCriar com a linha já validada
  // pelo MESMO schema Zod do Anexo A (linhaCadastroPllSchema), e-mail em
  // minúsculas (mesma normalização da importação por planilha).
  it("com nome e e-mail válidos, onCriar recebe a linha validada e o diálogo fecha", async () => {
    const onCriar = vi.fn().mockResolvedValue(undefined);
    render(<CadastroManualDialog onCriar={onCriar} />);

    fireEvent.click(screen.getByRole("button", { name: "Cadastrar participante" }));
    fireEvent.change(await screen.findByLabelText("Nome completo"), { target: { value: "Fulana de Tal" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "Fulana@Teste.com" } });

    const botaoSubmit = screen.getByRole("button", { name: "Cadastrar" });
    await waitFor(() => expect(botaoSubmit).not.toBeDisabled());
    fireEvent.click(botaoSubmit);

    await waitFor(() =>
      expect(onCriar).toHaveBeenCalledWith(
        expect.objectContaining({
          papel: "mentorado",
          nome_completo: "Fulana de Tal",
          email: "fulana@teste.com",
        })
      )
    );
    await waitFor(() => expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument());
  });

  // Lado oposto: e-mail malformado é barrado pelo MESMO Zod, antes de chamar
  // onCriar -- mensagem de erro do schema aparece, nada é enviado ao banco.
  it("e-mail malformado é rejeitado pelo schema, sem chamar onCriar", async () => {
    const onCriar = vi.fn();
    render(<CadastroManualDialog onCriar={onCriar} />);

    fireEvent.click(screen.getByRole("button", { name: "Cadastrar participante" }));
    fireEvent.change(await screen.findByLabelText("Nome completo"), { target: { value: "Fulana de Tal" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "fulana-sem-arroba" } });

    fireEvent.click(screen.getByRole("button", { name: "Cadastrar" }));

    expect(await screen.findByText("email malformado")).toBeInTheDocument();
    expect(onCriar).not.toHaveBeenCalled();
  });
});
