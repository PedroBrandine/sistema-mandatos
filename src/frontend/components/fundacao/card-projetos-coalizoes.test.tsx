import "@testing-library/jest-dom/vitest";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@backend/supabase/database.types";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P1: Informações
// Gerais do mandato" AC9 (FMC-13); .specs/features/pente-fino-2026-09-23/spec.md,
// "P3: Ação de editar nos cards..." AC2/AC3 (PF2-08). Cores confirmadas com a
// skill figma-dominio-legisla: "Coalizões → Roxo" (docs/Identidade Visual
// Legisla.md), `--chart-5` (#BA6BED).
//
// <Select> (Radix) stubado por um <select> nativo -- mesmo racional de
// card-ponto-focal.test.tsx: o que este teste precisa provar é a COMPOSIÇÃO
// (escolher um projeto grava o id certo), não o comportamento do Radix.
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
    <select aria-label="Projeto de origem" value={value ?? ""} onChange={(e) => onValueChange(e.target.value)}>
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
      insert: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "insert", args });
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

import { CardProjetosCoalizoes } from "./card-projetos-coalizoes";

const PROJETOS_RESP: Resp = {
  data: [
    { id_projeto: 5, nome: "Projeto Alfa" },
    { id_projeto: 6, nome: "Projeto Beta" },
  ],
  error: null,
};

const COALIZOES_CATALOGO_RESP: Resp = {
  data: [
    { id_coalizao: 7, dim_contratante: { nome: "Coalizão Verde" } },
    { id_coalizao: 8, dim_contratante: { nome: "Coalizão Azul" } },
  ],
  error: null,
};

afterEach(cleanup);

describe("CardProjetosCoalizoes — estado vazio e com vínculo (AC9)", () => {
  it("sem projeto e sem coalizão, renderiza <EstadoVazio>", () => {
    ({ client: clienteAtual } = criarClienteMock({}));
    render(<CardProjetosCoalizoes idContrato={1} projeto={null} coalizoes={[]} onAtualizado={vi.fn()} />);

    expect(screen.getByText("Nenhum projeto ou coalizão vinculado")).toBeInTheDocument();
  });

  it("com projeto e coalizões vinculados, renderiza a lista -- lado oposto", () => {
    ({ client: clienteAtual } = criarClienteMock({}));
    render(
      <CardProjetosCoalizoes
        idContrato={1}
        projeto={{ idProjeto: 5, nome: "Projeto Alfa" }}
        coalizoes={[{ idCoalizao: 7, nome: "Coalizão Verde" }]}
        onAtualizado={vi.fn()}
      />
    );

    expect(screen.getByText("Projeto Alfa")).toBeInTheDocument();
    expect(screen.getByText("Coalizão Verde")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum projeto ou coalizão vinculado")).not.toBeInTheDocument();
  });
});

describe("CardProjetosCoalizoes — badge de tipo conforme a origem", () => {
  it("projeto ganha o badge 'Projeto'", () => {
    ({ client: clienteAtual } = criarClienteMock({}));
    render(
      <CardProjetosCoalizoes
        idContrato={1}
        projeto={{ idProjeto: 5, nome: "Projeto Alfa" }}
        coalizoes={[]}
        onAtualizado={vi.fn()}
      />
    );

    expect(screen.getByText("Projeto")).toBeInTheDocument();
    expect(screen.queryByText("Coalizão")).not.toBeInTheDocument();
  });

  it("coalizão ganha o badge 'Coalizão', na cor roxa da codificação de produto (#BA6BED, chart-5)", () => {
    ({ client: clienteAtual } = criarClienteMock({}));
    render(
      <CardProjetosCoalizoes
        idContrato={1}
        projeto={null}
        coalizoes={[{ idCoalizao: 7, nome: "Coalizão Verde" }]}
        onAtualizado={vi.fn()}
      />
    );

    const badge = screen.getByText("Coalizão");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/bg-chart-5/);
    expect(screen.queryByText("Projeto")).not.toBeInTheDocument();
  });

  it("mais de uma coalizão vinculada renderiza um badge por coalizão", () => {
    ({ client: clienteAtual } = criarClienteMock({}));
    render(
      <CardProjetosCoalizoes
        idContrato={1}
        projeto={null}
        coalizoes={[
          { idCoalizao: 7, nome: "Coalizão Verde" },
          { idCoalizao: 8, nome: "Coalizão Azul" },
        ]}
        onAtualizado={vi.fn()}
      />
    );

    expect(screen.getAllByText("Coalizão")).toHaveLength(2);
    expect(screen.getByText("Coalizão Verde")).toBeInTheDocument();
    expect(screen.getByText("Coalizão Azul")).toBeInTheDocument();
  });
});

// PF2-08 (T10), AC2/AC3: "adicionar uma ação real de editar (trocar/remover
// projeto de origem e coalizões vinculadas)" + "persistir e refletir no card
// sem exigir reload manual".
describe("CardProjetosCoalizoes — botão Editar no header (AC1/AC2)", () => {
  it("exibe o botão 'Editar' no header, mesmo padrão dos demais cards (PF2-08)", () => {
    ({ client: clienteAtual } = criarClienteMock({}));
    render(<CardProjetosCoalizoes idContrato={1} projeto={null} coalizoes={[]} onAtualizado={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });

  it("clicar em Editar abre a edição de projeto e coalizões, e o botão do header desaparece", async () => {
    ({ client: clienteAtual } = criarClienteMock({
      ref_projeto: PROJETOS_RESP,
      dim_coalizao: COALIZOES_CATALOGO_RESP,
    }));
    render(<CardProjetosCoalizoes idContrato={1} projeto={null} coalizoes={[]} onAtualizado={vi.fn()} />);

    screen.getByRole("button", { name: "Editar" }).click();

    expect(await screen.findByRole("combobox", { name: "Projeto de origem" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });

  it("Cancelar sai da edição sem gravar nada", async () => {
    ({ client: clienteAtual } = criarClienteMock({
      ref_projeto: PROJETOS_RESP,
      dim_coalizao: COALIZOES_CATALOGO_RESP,
    }));
    render(<CardProjetosCoalizoes idContrato={1} projeto={null} coalizoes={[]} onAtualizado={vi.fn()} />);

    screen.getByRole("button", { name: "Editar" }).click();
    await screen.findByRole("combobox", { name: "Projeto de origem" });

    screen.getByRole("button", { name: "Cancelar" }).click();

    await waitFor(() =>
      expect(screen.queryByRole("combobox", { name: "Projeto de origem" })).not.toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });
});

describe("CardProjetosCoalizoes — salvar troca de projeto (AC2, AC3)", () => {
  it("trocar o projeto de origem grava fat_contrato.id_projeto e chama onAtualizado sem reload manual", async () => {
    const { client, chamadas } = criarClienteMock({
      ref_projeto: PROJETOS_RESP,
      dim_coalizao: COALIZOES_CATALOGO_RESP,
      fat_contrato: { data: null, error: null },
    });
    clienteAtual = client;
    const onAtualizado = vi.fn();
    render(
      <CardProjetosCoalizoes
        idContrato={7}
        projeto={{ idProjeto: 5, nome: "Projeto Alfa" }}
        coalizoes={[]}
        onAtualizado={onAtualizado}
      />
    );

    screen.getByRole("button", { name: "Editar" }).click();
    const select = await screen.findByRole("combobox", { name: "Projeto de origem" });
    fireEvent.change(select, { target: { value: "6" } });

    screen.getByRole("button", { name: "Salvar" }).click();

    await waitFor(() => expect(onAtualizado).toHaveBeenCalled());
    const update = chamadas.find((c) => c.tabela === "fat_contrato" && c.metodo === "update");
    expect(update?.args[0]).toEqual({ id_projeto: 6 });
    const eqContrato = chamadas.find((c) => c.tabela === "fat_contrato" && c.metodo === "eq");
    expect(eqContrato?.args).toEqual(["id_contrato", 7]);
  });

  it("trocar para 'Nenhum' desvincula o projeto (id_projeto: null)", async () => {
    const { client, chamadas } = criarClienteMock({
      ref_projeto: PROJETOS_RESP,
      dim_coalizao: COALIZOES_CATALOGO_RESP,
      fat_contrato: { data: null, error: null },
    });
    clienteAtual = client;
    const onAtualizado = vi.fn();
    render(
      <CardProjetosCoalizoes
        idContrato={7}
        projeto={{ idProjeto: 5, nome: "Projeto Alfa" }}
        coalizoes={[]}
        onAtualizado={onAtualizado}
      />
    );

    screen.getByRole("button", { name: "Editar" }).click();
    const select = await screen.findByRole("combobox", { name: "Projeto de origem" });
    fireEvent.change(select, { target: { value: "_nenhum" } });

    screen.getByRole("button", { name: "Salvar" }).click();

    await waitFor(() => expect(onAtualizado).toHaveBeenCalled());
    const update = chamadas.find((c) => c.tabela === "fat_contrato" && c.metodo === "update");
    expect(update?.args[0]).toEqual({ id_projeto: null });
  });

  it("erro ao salvar renderiza <ErroInline>", async () => {
    ({ client: clienteAtual } = criarClienteMock({
      ref_projeto: PROJETOS_RESP,
      dim_coalizao: COALIZOES_CATALOGO_RESP,
      fat_contrato: { data: null, error: { code: "500", message: "timeout" } },
    }));
    render(
      <CardProjetosCoalizoes
        idContrato={7}
        projeto={{ idProjeto: 5, nome: "Projeto Alfa" }}
        coalizoes={[]}
        onAtualizado={vi.fn()}
      />
    );

    screen.getByRole("button", { name: "Editar" }).click();
    const select = await screen.findByRole("combobox", { name: "Projeto de origem" });
    fireEvent.change(select, { target: { value: "6" } });
    screen.getByRole("button", { name: "Salvar" }).click();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});

describe("CardProjetosCoalizoes — adicionar/remover coalizão vinculada (AC2, AC3)", () => {
  it("marcar uma coalizão nova insere em rel_coalizao_membro (papel 'membro')", async () => {
    const { client, chamadas } = criarClienteMock({
      ref_projeto: PROJETOS_RESP,
      dim_coalizao: COALIZOES_CATALOGO_RESP,
      rel_coalizao_membro: { data: null, error: null },
    });
    clienteAtual = client;
    const onAtualizado = vi.fn();
    render(
      <CardProjetosCoalizoes idContrato={7} projeto={null} coalizoes={[]} onAtualizado={onAtualizado} />
    );

    screen.getByRole("button", { name: "Editar" }).click();
    const opcoes = await screen.findAllByRole("checkbox");
    expect(opcoes.map((o) => o.closest("label")?.textContent)).toEqual(["Coalizão Verde", "Coalizão Azul"]);
    fireEvent.click(opcoes[0]);

    screen.getByRole("button", { name: "Salvar" }).click();

    await waitFor(() => expect(onAtualizado).toHaveBeenCalled());
    const insert = chamadas.find((c) => c.tabela === "rel_coalizao_membro" && c.metodo === "insert");
    expect(insert?.args[0]).toEqual({ id_coalizao: 7, id_contrato: 7, papel: "membro" });
  });

  it("desmarcar uma coalizão já vinculada faz soft-exit (UPDATE dt_saida), sem projeto envolvido", async () => {
    const { client, chamadas } = criarClienteMock({
      ref_projeto: PROJETOS_RESP,
      dim_coalizao: COALIZOES_CATALOGO_RESP,
      rel_coalizao_membro: { data: null, error: null },
    });
    clienteAtual = client;
    const onAtualizado = vi.fn();
    render(
      <CardProjetosCoalizoes
        idContrato={7}
        projeto={null}
        coalizoes={[{ idCoalizao: 7, nome: "Coalizão Verde" }]}
        onAtualizado={onAtualizado}
      />
    );

    screen.getByRole("button", { name: "Editar" }).click();
    const opcoes = await screen.findAllByRole("checkbox");
    const checkboxVerde = opcoes.find((o) => o.closest("label")?.textContent === "Coalizão Verde")!;
    expect(checkboxVerde).toBeChecked();
    fireEvent.click(checkboxVerde);

    screen.getByRole("button", { name: "Salvar" }).click();

    await waitFor(() => expect(onAtualizado).toHaveBeenCalled());
    const update = chamadas.find((c) => c.tabela === "rel_coalizao_membro" && c.metodo === "update");
    expect(update?.args[0]).toHaveProperty("dt_saida");
    expect(chamadas.some((c) => c.tabela === "rel_coalizao_membro" && c.metodo === "insert")).toBe(false);
    const eq = chamadas.filter((c) => c.tabela === "rel_coalizao_membro" && c.metodo === "eq");
    expect(eq.map((c) => c.args)).toEqual([
      ["id_coalizao", 7],
      ["id_contrato", 7],
      ["papel", "membro"],
    ]);
  });
});
