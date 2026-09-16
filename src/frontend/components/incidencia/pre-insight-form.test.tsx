import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: .specs/features/fatos-geradores-ciclo-vida/spec.md, "P1:
// Pré-Insight como entidade" AC2 (autor resolvido pela sessão, nunca
// digitado) -- mesmo padrão de registro-form.tsx. AD-042 integral: os dois
// lados de cada condicional (usuário resolvido/não resolvido, sucesso/erro).

const idUsuarioMock = vi.fn<() => number | null>();
const carregandoUsuarioMock = vi.fn<() => boolean>();

vi.mock("@/hooks/use-papel-global", () => ({
  usePapelGlobal: () => ({
    idUsuario: idUsuarioMock(),
    papel: "mentor",
    carregando: carregandoUsuarioMock(),
  }),
}));

const insertMock = vi.fn();

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({
    from: (tabela: string) => ({
      insert: (valores: Record<string, unknown>) => insertMock(tabela, valores),
    }),
  }),
}));

import { PreInsightForm } from "./pre-insight-form";

const onConcluido = vi.fn();

beforeEach(() => {
  idUsuarioMock.mockReset();
  carregandoUsuarioMock.mockReset();
  insertMock.mockReset();
  onConcluido.mockReset();

  idUsuarioMock.mockReturnValue(42);
  carregandoUsuarioMock.mockReturnValue(false);
  insertMock.mockResolvedValue({ error: null });
});

afterEach(cleanup);

describe("PreInsightForm — conteúdo obrigatório", () => {
  it("sem conteúdo, o botão de criar fica desabilitado", () => {
    render(<PreInsightForm idContrato={7} onConcluido={onConcluido} />);
    expect(screen.getByRole("button", { name: "Criar Pré-Insight" })).toBeDisabled();
  });

  it("com conteúdo preenchido, o botão habilita -- lado oposto", async () => {
    render(<PreInsightForm idContrato={7} onConcluido={onConcluido} />);

    fireEvent.change(screen.getByLabelText("Conteúdo"), { target: { value: "Sinal captado em campo" } });

    await waitFor(() => expect(screen.getByRole("button", { name: "Criar Pré-Insight" })).toBeEnabled());
  });
});

describe("PreInsightForm — autor nunca digitado (spec.md P1 AC2)", () => {
  it("envia id_usuario_autor resolvido da sessão, sem nenhum campo de autor no formulário", async () => {
    render(<PreInsightForm idContrato={7} onConcluido={onConcluido} />);

    expect(screen.queryByLabelText(/autor/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Conteúdo"), { target: { value: "Sinal captado em campo" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Criar Pré-Insight" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Criar Pré-Insight" }));

    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    const [tabela, payload] = insertMock.mock.calls[0];
    expect(tabela).toBe("fat_pre_insight");
    expect(payload).toMatchObject({ id_contrato: 7, conteudo: "Sinal captado em campo", id_usuario_autor: 42 });
    expect(onConcluido).toHaveBeenCalledTimes(1);
  });

  it("usuário não resolvido: mostra erro explícito e não tenta o INSERT -- lado oposto", async () => {
    idUsuarioMock.mockReturnValue(null);

    render(<PreInsightForm idContrato={7} onConcluido={onConcluido} />);

    fireEvent.change(screen.getByLabelText("Conteúdo"), { target: { value: "Sinal captado em campo" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Criar Pré-Insight" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Criar Pré-Insight" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível identificar o usuário autor");
    expect(insertMock).not.toHaveBeenCalled();
    expect(onConcluido).not.toHaveBeenCalled();
  });
});

describe("PreInsightForm — data opcional", () => {
  it("sem data preenchida, o INSERT sucede mesmo assim (ocorrido_em é opcional)", async () => {
    render(<PreInsightForm idContrato={7} onConcluido={onConcluido} />);

    fireEvent.change(screen.getByLabelText("Conteúdo"), { target: { value: "Sinal sem data" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Criar Pré-Insight" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Criar Pré-Insight" }));

    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    const [, payload] = insertMock.mock.calls[0];
    expect(payload.ocorrido_em).toBeUndefined();
  });
});

describe("PreInsightForm — erro de RLS (L-008)", () => {
  it("INSERT negado pela RLS exibe ErroInline e não conclui", async () => {
    insertMock.mockResolvedValue({ error: { message: "RLS negou a escrita.", code: "42501" } });

    render(<PreInsightForm idContrato={7} onConcluido={onConcluido} />);

    fireEvent.change(screen.getByLabelText("Conteúdo"), { target: { value: "Sinal captado em campo" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Criar Pré-Insight" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Criar Pré-Insight" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(onConcluido).not.toHaveBeenCalled();
  });
});
