import "@testing-library/jest-dom/vitest";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@backend/supabase/database.types";

// DIAG-10..DIAG-17 (.specs/features/diagnostico-mandato-estrategia/spec.md,
// "P1: Campos de texto livre do Diagnóstico"). Mesmo padrão de
// card-sobre-mandato.test.tsx: mock de builder do Supabase por tabela.

type Resp = { data?: unknown; error: unknown };

function criarClienteMock(respostasPorTabela: Record<string, Resp | Resp[]>) {
  const chamadas: { tabela: string; metodo: string; args: unknown[] }[] = [];
  const filas = new Map<string, Resp[]>(
    Object.entries(respostasPorTabela).map(([t, r]) => [t, Array.isArray(r) ? [...r] : [r]])
  );

  function proximaResposta(tabela: string): Resp {
    const fila = filas.get(tabela);
    if (!fila || fila.length === 0) return { data: null, error: null };
    return fila.length > 1 ? fila.shift()! : fila[0];
  }

  function criarBuilder(tabela: string) {
    const resposta = proximaResposta(tabela);
    const builder: Record<string, unknown> = {
      eq: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "eq", args });
        return builder;
      },
      update: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "update", args });
        return builder;
      },
      then: (resolve: (v: Resp) => void, reject: (e: unknown) => void) =>
        Promise.resolve(resposta).then(resolve, reject),
    };
    return builder;
  }

  const client = { from: (tabela: string) => criarBuilder(tabela) };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

let clienteAtual: SupabaseClient<Database>;

vi.mock("@backend/supabase/client", () => ({
  createClient: () => clienteAtual,
}));

import { CardDiagnosticoMandato } from "./card-diagnostico-mandato";

function propsBase() {
  return {
    idMandato: 200,
    principaisDestaques: null,
    cargosLegislatura: null,
    principaisPls: null,
    principaisNoticias: null,
    onAtualizado: vi.fn(),
  };
}

afterEach(cleanup);

describe("CardDiagnosticoMandato — exibição (AD-005: ausente = '—')", () => {
  it("campos ausentes renderizam '—' / estado vazio, nunca undefined", () => {
    ({ client: clienteAtual } = criarClienteMock({}));
    render(<CardDiagnosticoMandato {...propsBase()} />);

    expect(screen.getByText("Principais Destaques").nextElementSibling).toHaveTextContent("—");
    expect(screen.getByText("Cargos na Legislatura").nextElementSibling).toHaveTextContent("—");
    expect(screen.getByText("Principais PLs").nextElementSibling).toHaveTextContent("—");
    expect(screen.getByText("Principais Notícias").nextElementSibling).toHaveTextContent("—");
  });

  it("campos presentes renderizam os itens (destaques/cargos/pls como chips, notícias como links)", () => {
    ({ client: clienteAtual } = criarClienteMock({}));
    render(
      <CardDiagnosticoMandato
        {...propsBase()}
        principaisDestaques={["Aprovou a Lei X"]}
        cargosLegislatura={["Vice-líder"]}
        principaisPls={["PL 123/2026"]}
        principaisNoticias={[{ titulo: "Matéria sobre o mandato", url: "https://exemplo.com/materia" }]}
      />
    );

    expect(screen.getByText("Aprovou a Lei X")).toBeInTheDocument();
    expect(screen.getByText("Vice-líder")).toBeInTheDocument();
    expect(screen.getByText("PL 123/2026")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Matéria sobre o mandato" });
    expect(link).toHaveAttribute("href", "https://exemplo.com/materia");
  });
});

describe("CardDiagnosticoMandato — edição salva os 4 campos em dim_mandato (DIAG-10..DIAG-17)", () => {
  it("Salvar grava as 3 listas de tags e a lista de notícias, nulo quando vazio", async () => {
    const { client, chamadas } = criarClienteMock({ dim_mandato: { data: null, error: null } });
    clienteAtual = client;
    render(<CardDiagnosticoMandato {...propsBase()} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    fireEvent.change(screen.getByPlaceholderText("Novo destaque"), { target: { value: "Aprovou a Lei X" } });
    fireEvent.keyDown(screen.getByPlaceholderText("Novo destaque"), { key: "Enter" });

    fireEvent.change(screen.getByPlaceholderText("Título da notícia"), { target: { value: "Matéria" } });
    fireEvent.change(screen.getByPlaceholderText("https://…"), { target: { value: "https://exemplo.com" } });
    fireEvent.keyDown(screen.getByPlaceholderText("https://…"), { key: "Enter" });

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument());

    const update = chamadas.find((c) => c.tabela === "dim_mandato" && c.metodo === "update");
    expect(update?.args[0]).toMatchObject({
      principais_destaques: ["Aprovou a Lei X"],
      cargos_legislatura: null,
      principais_pls: null,
      principais_noticias: [{ titulo: "Matéria", url: "https://exemplo.com" }],
    });
  });

  it("URL inválida em Principais Notícias bloqueia o item e mostra erro, sem quebrar a edição", async () => {
    ({ client: clienteAtual } = criarClienteMock({}));
    render(<CardDiagnosticoMandato {...propsBase()} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    fireEvent.change(screen.getByPlaceholderText("Título da notícia"), { target: { value: "Matéria" } });
    fireEvent.change(screen.getByPlaceholderText("https://…"), { target: { value: "não-é-url" } });
    fireEvent.keyDown(screen.getByPlaceholderText("https://…"), { key: "Enter" });

    expect(await screen.findByText(/URL inválida/)).toBeInTheDocument();
    expect(screen.queryByText("Matéria")).not.toBeInTheDocument();
  });

  it("erro ao salvar renderiza <ErroInline>, sem sair do modo de edição", async () => {
    const { client } = criarClienteMock({
      dim_mandato: { data: null, error: { code: "500", message: "timeout" } },
    });
    clienteAtual = client;
    render(<CardDiagnosticoMandato {...propsBase()} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
  });
});
