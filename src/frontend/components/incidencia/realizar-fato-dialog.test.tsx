import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: .specs/features/fatos-geradores-ciclo-vida/spec.md, "P1: Fato
// projetado e sua realização" AC4 -- exige Data de ocorrência no ato, sem
// transição automática. AD-042 integral: os dois lados (data preenchida
// habilita / vazia bloqueia), sucesso e erro.

const marcarFatoRealizadoMock = vi.fn();

vi.mock("@backend/rpc/fato-gerador", () => ({
  marcarFatoRealizado: (...args: unknown[]) => marcarFatoRealizadoMock(...args),
}));

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({}),
}));

import { RealizarFatoDialog } from "./realizar-fato-dialog";

const onConcluido = vi.fn();

beforeEach(() => {
  marcarFatoRealizadoMock.mockReset();
  onConcluido.mockReset();
  marcarFatoRealizadoMock.mockResolvedValue(undefined);
});

afterEach(cleanup);

function abrirDialogo() {
  fireEvent.click(screen.getByRole("button", { name: "Registrar como realizado" }));
}

describe("RealizarFatoDialog — Data de ocorrência exigida no ato", () => {
  it("sem data preenchida, Confirmar fica desabilitado", () => {
    render(<RealizarFatoDialog idFatoGerador={10} onConcluido={onConcluido} />);
    abrirDialogo();

    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();
  });

  it("com data preenchida, Confirmar habilita -- lado oposto", () => {
    render(<RealizarFatoDialog idFatoGerador={10} onConcluido={onConcluido} />);
    abrirDialogo();

    fireEvent.change(screen.getByLabelText("Data de ocorrência"), { target: { value: "2026-09-16" } });

    expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled();
  });
});

describe("RealizarFatoDialog — confirmação", () => {
  it("chama marcarFatoRealizado com o id e a data, e conclui", async () => {
    render(<RealizarFatoDialog idFatoGerador={10} onConcluido={onConcluido} />);
    abrirDialogo();

    fireEvent.change(screen.getByLabelText("Data de ocorrência"), { target: { value: "2026-09-16" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(marcarFatoRealizadoMock).toHaveBeenCalledTimes(1));
    const [, idFatoGerador, dtOcorrencia] = marcarFatoRealizadoMock.mock.calls[0];
    expect(idFatoGerador).toBe(10);
    expect(dtOcorrencia).toBe("2026-09-16");
    expect(onConcluido).toHaveBeenCalledTimes(1);
  });

  it("falha (RLS/erro) exibe ErroInline e não conclui -- lado oposto", async () => {
    marcarFatoRealizadoMock.mockRejectedValue(new Error("RLS negou a escrita."));

    render(<RealizarFatoDialog idFatoGerador={10} onConcluido={onConcluido} />);
    abrirDialogo();

    fireEvent.change(screen.getByLabelText("Data de ocorrência"), { target: { value: "2026-09-16" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("RLS negou a escrita.");
    expect(onConcluido).not.toHaveBeenCalled();
  });
});
