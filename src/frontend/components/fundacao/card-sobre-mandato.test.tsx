import "@testing-library/jest-dom/vitest";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@backend/supabase/database.types";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P1: Informações
// Gerais do mandato" AC1-AC7, AC10 (FMC-05, FMC-06, FMC-07, FMC-08, FMC-10).
// Test Coverage Matrix (tasks.md, T25): AD-042 integral -- os dois lados de
// cada condicional, estado vazio e estado de erro.

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
      in: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "in", args });
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
      delete: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "delete", args });
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

import { CardSobreMandato } from "./card-sobre-mandato";

const CATALOGO_PADRAO: Resp = {
  data: [
    { id_agenda: 1, nome: "Educação", ordem: 1 },
    { id_agenda: 2, nome: "Saúde", ordem: 2 },
  ],
  error: null,
};

function propsBase() {
  return {
    idMandato: 100,
    minibiografia: null,
    principaisPautas: null,
    areasTematicas: [],
    contatoParlamentar: null,
    contatoChefeGabinete: null,
    onAtualizado: vi.fn(),
  };
}

afterEach(cleanup);

describe("CardSobreMandato — Minibiografia (FMC-05, AC1/AC2)", () => {
  it("bio ausente renderiza '—' (AD-005)", () => {
    ({ client: clienteAtual } = criarClienteMock({ ref_agenda_tematica: CATALOGO_PADRAO }));
    render(<CardSobreMandato {...propsBase()} />);

    expect(screen.getByText("Minibiografia").nextElementSibling).toHaveTextContent("—");
  });

  it("bio presente renderiza o texto", () => {
    ({ client: clienteAtual } = criarClienteMock({ ref_agenda_tematica: CATALOGO_PADRAO }));
    render(<CardSobreMandato {...propsBase()} minibiografia="Trajetória de luta pela educação pública." />);

    expect(screen.getByText("Trajetória de luta pela educação pública.")).toBeInTheDocument();
  });
});

describe("CardSobreMandato — Principais Pautas (FMC-06, AC10)", () => {
  it("pautas vazias renderizam '—'", () => {
    ({ client: clienteAtual } = criarClienteMock({ ref_agenda_tematica: CATALOGO_PADRAO }));
    render(<CardSobreMandato {...propsBase()} principaisPautas={[]} />);

    const titulo = screen.getByText("Principais Pautas");
    expect(titulo.nextElementSibling).toHaveTextContent("—");
  });

  it("pautas presentes viram chips, na ordem gravada", () => {
    ({ client: clienteAtual } = criarClienteMock({ ref_agenda_tematica: CATALOGO_PADRAO }));
    render(<CardSobreMandato {...propsBase()} principaisPautas={["Saúde", "Educação"]} />);

    const chips = screen.getAllByText(/^(Saúde|Educação)$/);
    expect(chips.map((c) => c.textContent)).toEqual(["Saúde", "Educação"]);
  });
});

describe("CardSobreMandato — Áreas Temáticas vinculadas (FMC-07)", () => {
  it("sem tema vinculado renderiza '—'", () => {
    ({ client: clienteAtual } = criarClienteMock({ ref_agenda_tematica: CATALOGO_PADRAO }));
    render(<CardSobreMandato {...propsBase()} areasTematicas={[]} />);

    const titulo = screen.getByText("Áreas Temáticas");
    expect(titulo.nextElementSibling).toHaveTextContent("—");
  });

  it("temas vinculados aparecem como chips", () => {
    ({ client: clienteAtual } = criarClienteMock({ ref_agenda_tematica: CATALOGO_PADRAO }));
    render(
      <CardSobreMandato
        {...propsBase()}
        areasTematicas={[{ idAgenda: 1, nome: "Educação", ordem: 1 }]}
      />
    );

    expect(screen.getByText("Educação")).toBeInTheDocument();
  });
});

describe("CardSobreMandato — Dados de Contato (A-04, AC6)", () => {
  it("contato ausente renderiza '—' para Parlamentar e Chefe de Gabinete, cada um independente", () => {
    ({ client: clienteAtual } = criarClienteMock({ ref_agenda_tematica: CATALOGO_PADRAO }));
    render(<CardSobreMandato {...propsBase()} />);

    expect(screen.getByText("Parlamentar: —")).toBeInTheDocument();
    expect(screen.getByText("Chefe de Gabinete: —")).toBeInTheDocument();
  });

  it("contato presente renderiza nome, email e telefone", () => {
    ({ client: clienteAtual } = criarClienteMock({ ref_agenda_tematica: CATALOGO_PADRAO }));
    render(
      <CardSobreMandato
        {...propsBase()}
        contatoParlamentar={{ idUsuario: 1, nome: "Dep. Fulano", email: "fulano@camara.gov", telefone: "119999" }}
      />
    );

    expect(screen.getByText("Parlamentar: Dep. Fulano · fulano@camara.gov · 119999")).toBeInTheDocument();
    expect(screen.getByText("Chefe de Gabinete: —")).toBeInTheDocument();
  });
});

describe("CardSobreMandato — seletor de áreas temáticas na edição (FMC-08)", () => {
  it("lista os temas ativos do catálogo, ordenados por ordem", async () => {
    ({ client: clienteAtual } = criarClienteMock({ ref_agenda_tematica: CATALOGO_PADRAO }));
    render(<CardSobreMandato {...propsBase()} />);

    screen.getByRole("button", { name: "Editar" }).click();

    const opcoes = await screen.findAllByRole("checkbox");
    expect(opcoes.map((o) => o.closest("label")?.textContent)).toEqual(["Educação", "Saúde"]);
  });

  it("catálogo vazio renderiza <EstadoVazio>, nunca um seletor mudo (edge case da spec)", async () => {
    ({ client: clienteAtual } = criarClienteMock({ ref_agenda_tematica: { data: [], error: null } }));
    render(<CardSobreMandato {...propsBase()} />);

    screen.getByRole("button", { name: "Editar" }).click();

    expect(await screen.findByText("Nenhuma área temática cadastrada")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("falha ao carregar o catálogo renderiza <ErroInline>", async () => {
    ({ client: clienteAtual } = criarClienteMock({
      ref_agenda_tematica: { data: null, error: { code: "500", message: "timeout" } },
    }));
    render(<CardSobreMandato {...propsBase()} />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});

describe("CardSobreMandato — edição salva bio, pautas e áreas temáticas", () => {
  it("Salvar grava minibiografia e principais_pautas em dim_mandato", async () => {
    const { client, chamadas } = criarClienteMock({
      ref_agenda_tematica: CATALOGO_PADRAO,
      dim_mandato: { data: null, error: null },
    });
    clienteAtual = client;
    render(<CardSobreMandato {...propsBase()} />);

    screen.getByRole("button", { name: "Editar" }).click();
    await screen.findAllByRole("checkbox");

    const textarea = screen.getByLabelText("Minibiografia");
    fireEvent.change(textarea, { target: { value: "Nova bio" } });

    screen.getByRole("button", { name: "Salvar" }).click();

    await waitFor(() => expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument());

    const updateMandato = chamadas.find((c) => c.tabela === "dim_mandato" && c.metodo === "update");
    expect(updateMandato?.args[0]).toMatchObject({ minibiografia: "Nova bio" });
  });

  it("marcar um tema novo grava em rel_mandato_agenda_tematica via insert", async () => {
    const { client, chamadas } = criarClienteMock({
      ref_agenda_tematica: CATALOGO_PADRAO,
      dim_mandato: { data: null, error: null },
      rel_mandato_agenda_tematica: { data: null, error: null },
    });
    clienteAtual = client;
    render(<CardSobreMandato {...propsBase()} />);

    screen.getByRole("button", { name: "Editar" }).click();
    const [educacao] = await screen.findAllByRole("checkbox");
    educacao.click();

    screen.getByRole("button", { name: "Salvar" }).click();

    await waitFor(() => expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument());

    const insert = chamadas.find((c) => c.tabela === "rel_mandato_agenda_tematica" && c.metodo === "insert");
    expect(insert?.args[0]).toEqual([{ id_mandato: 100, id_agenda: 1 }]);
  });

  it("desmarcar um tema já vinculado grava a remoção via delete", async () => {
    const { client, chamadas } = criarClienteMock({
      ref_agenda_tematica: CATALOGO_PADRAO,
      dim_mandato: { data: null, error: null },
      rel_mandato_agenda_tematica: { data: null, error: null },
    });
    clienteAtual = client;
    render(
      <CardSobreMandato {...propsBase()} areasTematicas={[{ idAgenda: 1, nome: "Educação", ordem: 1 }]} />
    );

    screen.getByRole("button", { name: "Editar" }).click();
    const [educacao] = await screen.findAllByRole("checkbox");
    expect(educacao).toBeChecked();
    educacao.click();

    screen.getByRole("button", { name: "Salvar" }).click();

    await waitFor(() => expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument());

    const del = chamadas.find((c) => c.tabela === "rel_mandato_agenda_tematica" && c.metodo === "delete");
    expect(del).toBeDefined();
    const inDel = chamadas.find((c) => c.tabela === "rel_mandato_agenda_tematica" && c.metodo === "in");
    expect(inDel?.args).toEqual(["id_agenda", [1]]);
  });

  it("Cancelar sai da edição sem gravar nada", async () => {
    const { client, chamadas } = criarClienteMock({ ref_agenda_tematica: CATALOGO_PADRAO });
    clienteAtual = client;
    render(<CardSobreMandato {...propsBase()} />);

    screen.getByRole("button", { name: "Editar" }).click();
    await screen.findAllByRole("checkbox");

    screen.getByRole("button", { name: "Cancelar" }).click();

    await waitFor(() => expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument());
    expect(chamadas.some((c) => c.metodo === "update" || c.metodo === "insert" || c.metodo === "delete")).toBe(false);
  });

  it("erro ao salvar renderiza <ErroInline>, sem sair do modo de edição", async () => {
    const { client } = criarClienteMock({
      ref_agenda_tematica: CATALOGO_PADRAO,
      dim_mandato: { data: null, error: { code: "23514", message: "violates check constraint" } },
    });
    clienteAtual = client;
    render(<CardSobreMandato {...propsBase()} />);

    screen.getByRole("button", { name: "Editar" }).click();
    await screen.findAllByRole("checkbox");

    screen.getByRole("button", { name: "Salvar" }).click();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
  });
});
