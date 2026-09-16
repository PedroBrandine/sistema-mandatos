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
const updateMock = vi.fn();
const eqMock = vi.fn();

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({
    from: (tabela: string) => ({
      insert: (valores: Record<string, unknown>) => insertMock(tabela, valores),
      update: (valores: Record<string, unknown>) => {
        updateMock(tabela, valores);
        return { eq: (coluna: string, valor: unknown) => eqMock(coluna, valor) };
      },
    }),
  }),
}));

import { PreInsightForm } from "./pre-insight-form";

const onConcluido = vi.fn();

beforeEach(() => {
  idUsuarioMock.mockReset();
  carregandoUsuarioMock.mockReset();
  insertMock.mockReset();
  updateMock.mockReset();
  eqMock.mockReset();
  onConcluido.mockReset();

  idUsuarioMock.mockReturnValue(42);
  carregandoUsuarioMock.mockReturnValue(false);
  insertMock.mockResolvedValue({ error: null });
  eqMock.mockResolvedValue({ error: null });
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

describe("PreInsightForm — edição (fix task pós-T25, spec.md 'aba como casa única' AC2)", () => {
  it("com preInsightExistente, popula os valores e chama update pelo id, não insert -- lado oposto da criação", async () => {
    render(
      <PreInsightForm
        idContrato={7}
        preInsightExistente={{ idPreInsight: 12, conteudo: "Sinal antigo", ocorridoEm: "2026-08-01" }}
        onConcluido={onConcluido}
      />
    );

    expect(await screen.findByDisplayValue("Sinal antigo")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-08-01")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(eqMock).toHaveBeenCalledWith("id_pre_insight", 12);
    expect(insertMock).not.toHaveBeenCalled();
    expect(onConcluido).toHaveBeenCalledTimes(1);
  });

  it("edição não exige idUsuario resolvido (autor não muda) -- lado oposto da criação", async () => {
    idUsuarioMock.mockReturnValue(null);

    render(
      <PreInsightForm
        idContrato={7}
        preInsightExistente={{ idPreInsight: 12, conteudo: "Sinal antigo", ocorridoEm: null }}
        onConcluido={onConcluido}
      />
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(onConcluido).toHaveBeenCalledTimes(1);
  });

  it("falha do UPDATE mostra ErroInline e não conclui -- lado oposto do sucesso", async () => {
    eqMock.mockResolvedValue({ error: { message: "RLS negou a escrita.", code: "42501" } });

    render(
      <PreInsightForm
        idContrato={7}
        preInsightExistente={{ idPreInsight: 12, conteudo: "Sinal antigo", ocorridoEm: null }}
        onConcluido={onConcluido}
      />
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(onConcluido).not.toHaveBeenCalled();
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
