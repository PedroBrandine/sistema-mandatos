import "@testing-library/jest-dom/vitest";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@backend/supabase/database.types";

// DIAG-18..DIAG-20 (.specs/features/diagnostico-mandato-estrategia/spec.md,
// "P1: Análise SWOT do mandato"). Reaproveita EditorSwot (já testado em
// pll/editor-swot.test.tsx) -- este teste cobre só a persistência nova:
// o botão Salvar só aparece após mudança, e grava as 4 colunas em
// dim_mandato com nulo quando vazio.

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

import { CardSwotMandato } from "./card-swot-mandato";

function adicionarForca(valor: string) {
  const input = screen.getByPlaceholderText("Adicionar força…");
  fireEvent.change(input, { target: { value: valor } });
  const linha = input.closest("div") as HTMLElement;
  fireEvent.click(within(linha).getByRole("button", { name: "Adicionar" }));
}

function propsBase() {
  return {
    idMandato: 200,
    swotForcas: null,
    swotFraquezas: null,
    swotOportunidades: null,
    swotAmeacas: null,
    onAtualizado: vi.fn(),
  };
}

afterEach(cleanup);

describe("CardSwotMandato — botão Salvar só aparece após mudança", () => {
  it("sem edição, não mostra o botão Salvar", () => {
    ({ client: clienteAtual } = criarClienteMock({}));
    render(<CardSwotMandato {...propsBase()} />);

    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument();
  });

  it("após adicionar um item em qualquer quadrante, mostra o botão Salvar", () => {
    ({ client: clienteAtual } = criarClienteMock({}));
    render(<CardSwotMandato {...propsBase()} />);

    adicionarForca("Boa base eleitoral");

    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
  });
});

describe("CardSwotMandato — Salvar grava os 4 quadrantes em dim_mandato (DIAG-19)", () => {
  it("grava swot_forcas preenchido e os demais nulo quando vazios", async () => {
    const { client, chamadas } = criarClienteMock({ dim_mandato: { data: null, error: null } });
    clienteAtual = client;
    render(<CardSwotMandato {...propsBase()} />);

    adicionarForca("Boa base eleitoral");

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument());

    const update = chamadas.find((c) => c.tabela === "dim_mandato" && c.metodo === "update");
    expect(update?.args[0]).toMatchObject({
      swot_forcas: ["Boa base eleitoral"],
      swot_fraquezas: null,
      swot_oportunidades: null,
      swot_ameacas: null,
    });
  });

  it("erro ao salvar renderiza <ErroInline> e mantém o botão Salvar visível", async () => {
    const { client } = criarClienteMock({
      dim_mandato: { data: null, error: { code: "500", message: "timeout" } },
    });
    clienteAtual = client;
    render(<CardSwotMandato {...propsBase()} />);

    adicionarForca("Boa base eleitoral");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
  });
});
