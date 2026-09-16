import "@testing-library/jest-dom/vitest";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@backend/supabase/database.types";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P1: Informações
// Gerais do mandato" AC7 (FMC-11, A-05). Test Coverage Matrix (tasks.md,
// T26): AD-042 integral -- os dois lados de cada condicional.
//
// <Select> (Radix) é stubado por um <select> nativo, mesmo racional do
// <Popover> stubado em produtos/[slug]/agenda/page.test.tsx: abrir o
// combobox de verdade no jsdom é caro e o que este card precisa provar é a
// COMPOSIÇÃO (escolher uma opção grava o id certo), não o comportamento do
// Radix em si.
vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <select
      aria-label="Ponto Focal"
      value={value ?? ""}
      onChange={(e) => onValueChange(e.target.value)}
    >
      <option value="" disabled />
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

type Resp = { data?: unknown; error: unknown };

function criarClienteMock(respostasPorTabela: Record<string, Resp>) {
  const chamadas: { tabela: string; metodo: string; args: unknown[] }[] = [];
  function criarBuilder(tabela: string) {
    const resposta = respostasPorTabela[tabela] ?? { data: null, error: null };
    const builder: Record<string, unknown> = {
      select: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "select", args });
        return builder;
      },
      eq: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "eq", args });
        return builder;
      },
      order: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "order", args });
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

import { CardPontoFocal } from "./card-ponto-focal";

const USUARIOS_RESP: Resp = {
  data: [
    { id_usuario: 20, nome: "Ana Legisla" },
    { id_usuario: 21, nome: "Beto Legisla" },
  ],
  error: null,
};

afterEach(cleanup);

describe("CardPontoFocal — Ponto Focal (FMC-11, AC7, A-05)", () => {
  it("sem ponto focal, renderiza o controle 'Vincular usuário'", () => {
    ({ client: clienteAtual } = criarClienteMock({}));
    render(<CardPontoFocal idContrato={1} pontoFocal={null} gestoras={[]} onAtualizado={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Vincular usuário" })).toBeInTheDocument();
  });

  it("com ponto focal, exibe a tag com o nome do usuário", () => {
    ({ client: clienteAtual } = criarClienteMock({}));
    render(
      <CardPontoFocal
        idContrato={1}
        pontoFocal={{ idUsuario: 20, nome: "Ana Legisla" }}
        gestoras={[]}
        onAtualizado={vi.fn()}
      />
    );

    expect(screen.getByText("Ana Legisla")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Vincular usuário" })).not.toBeInTheDocument();
  });

  it("escolher um usuário e salvar grava fat_contrato.id_usuario_ponto_focal", async () => {
    const { client, chamadas } = criarClienteMock({
      dim_usuario: USUARIOS_RESP,
      fat_contrato: { data: null, error: null },
    });
    clienteAtual = client;
    const onAtualizado = vi.fn();
    render(<CardPontoFocal idContrato={7} pontoFocal={null} gestoras={[]} onAtualizado={onAtualizado} />);

    screen.getByRole("button", { name: "Vincular usuário" }).click();

    const select = await screen.findByRole("combobox", { name: "Ponto Focal" });
    fireEvent.change(select, { target: { value: "21" } });

    screen.getByRole("button", { name: "Salvar" }).click();

    await waitFor(() => expect(onAtualizado).toHaveBeenCalled());
    const update = chamadas.find((c) => c.tabela === "fat_contrato" && c.metodo === "update");
    expect(update?.args[0]).toEqual({ id_usuario_ponto_focal: 21 });
    const eqContrato = chamadas.find((c) => c.tabela === "fat_contrato" && c.metodo === "eq");
    expect(eqContrato?.args).toEqual(["id_contrato", 7]);
  });

  it("Cancelar sai da edição sem gravar nada", async () => {
    const { client, chamadas } = criarClienteMock({ dim_usuario: USUARIOS_RESP });
    clienteAtual = client;
    render(<CardPontoFocal idContrato={7} pontoFocal={null} gestoras={[]} onAtualizado={vi.fn()} />);

    screen.getByRole("button", { name: "Vincular usuário" }).click();
    await screen.findByRole("combobox", { name: "Ponto Focal" });

    screen.getByRole("button", { name: "Cancelar" }).click();

    await waitFor(() =>
      expect(screen.queryByRole("combobox", { name: "Ponto Focal" })).not.toBeInTheDocument()
    );
    expect(chamadas.some((c) => c.metodo === "update")).toBe(false);
  });

  it("erro ao salvar renderiza <ErroInline>", async () => {
    const { client } = criarClienteMock({
      dim_usuario: USUARIOS_RESP,
      fat_contrato: { data: null, error: { code: "500", message: "timeout" } },
    });
    clienteAtual = client;
    render(
      <CardPontoFocal
        idContrato={7}
        pontoFocal={{ idUsuario: 20, nome: "Ana Legisla" }}
        gestoras={[]}
        onAtualizado={vi.fn()}
      />
    );

    screen.getByRole("button", { name: "Alterar" }).click();
    const select = await screen.findByRole("combobox", { name: "Ponto Focal" });
    fireEvent.change(select, { target: { value: "21" } });
    screen.getByRole("button", { name: "Salvar" }).click();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});

describe("CardPontoFocal — Gestoras, em leitura (FMC-11)", () => {
  it("gestoras vinculadas aparecem como badges", () => {
    ({ client: clienteAtual } = criarClienteMock({}));
    render(
      <CardPontoFocal
        idContrato={1}
        pontoFocal={null}
        gestoras={[{ idUsuario: 40, nome: "Gestora Uma" }]}
        onAtualizado={vi.fn()}
      />
    );

    expect(screen.getByText("Gestora Uma")).toBeInTheDocument();
  });

  it("sem gestora vinculada, renderiza '—'", () => {
    ({ client: clienteAtual } = criarClienteMock({}));
    render(<CardPontoFocal idContrato={1} pontoFocal={null} gestoras={[]} onAtualizado={vi.fn()} />);

    const titulo = screen.getByText("Gestoras");
    expect(titulo.nextElementSibling).toHaveTextContent("—");
  });
});
