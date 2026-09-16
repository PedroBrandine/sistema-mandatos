import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: .specs/features/ficha-mandato-contrato/tasks.md, T34 Done-when
// (FMC-25, FMC-26, FMC-27) --
//  - Uma opção por nível, rotulada Nível N + descritor do catálogo
//  - Dimensão 0-2 renderiza 3 opções; 0-3 renderiza 4 -- a escala não estica
//  - Momento já aplicado renderiza como aplicado e não oferece novo envio (2 lados)
//  - Submissão vai por fat_submissao, nunca INSERT direto em fat_gip
//  - Erro renderiza <ErroInline>
//
// AD-042 integral: os dois lados de "momento aplicado" são testados.

const buscarGipDoContratoMock = vi.fn();
vi.mock("@backend/queries/gip", () => ({
  buscarGipDoContrato: (...args: unknown[]) => buscarGipDoContratoMock(...args),
}));

const idUsuarioMock = vi.fn<() => number | null>();
vi.mock("@/hooks/use-papel-global", () => ({
  usePapelGlobal: () => ({ idUsuario: idUsuarioMock(), papel: "gestora", carregando: false }),
}));

const insertMock = vi.fn();
const singleFormularioMock = vi.fn();

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({
    from: (tabela: string) => {
      if (tabela === "ref_formulario") {
        return {
          select: () => ({
            eq: () => ({
              single: () => singleFormularioMock(),
            }),
          }),
        };
      }
      if (tabela === "fat_submissao") {
        return { insert: (valores: Record<string, unknown>) => insertMock(valores) };
      }
      throw new Error(`tabela inesperada: ${tabela}`);
    },
  }),
}));

import { GipRegua } from "./gip-regua";

const DIMENSAO_0A3 = {
  idDimensao: 1,
  codigo: "performance_objetivos",
  nome: "Performance dos objetivos específicos atrelados aos preditores prioritários",
  ordem: 1,
  valorMin: 0,
  valorMax: 3,
  niveis: [
    { valor: 0, descricao: "Não apresenta padrões de atuação de mandatos de sucesso" },
    { valor: 1, descricao: "Apresenta algumas práticas e padrões de atuação de mandatos de sucesso" },
    { valor: 2, descricao: "Progride menos de 60%, em média" },
    { valor: 3, descricao: "Progride acima de 60%, em média" },
  ],
  valorAtual: null,
};

const DIMENSAO_0A2 = {
  idDimensao: 3,
  codigo: "capacidade_gestao",
  nome: "Capacidade de gestão",
  ordem: 3,
  valorMin: 0,
  valorMax: 2,
  niveis: [
    { valor: 0, descricao: "Não implementa rotinas de alinhamento" },
    { valor: 1, descricao: "Implementa rotinas de alinhamento" },
    { valor: 2, descricao: "Implementa estratégia de gestão de pessoas" },
  ],
  valorAtual: null,
};

beforeEach(() => {
  buscarGipDoContratoMock.mockReset();
  idUsuarioMock.mockReset();
  insertMock.mockReset();
  singleFormularioMock.mockReset();

  idUsuarioMock.mockReturnValue(42);
  singleFormularioMock.mockResolvedValue({ data: { id_formulario: 9, versao: 1 }, error: null });
  insertMock.mockResolvedValue({ error: null });
});

afterEach(cleanup);

describe("GipRegua — escala não estica (FMC-25 AC3)", () => {
  it("dimensão de faixa 0-2 renderiza exatamente 3 opções", async () => {
    buscarGipDoContratoMock.mockResolvedValue({
      momento: "inicio",
      aplicado: false,
      aplicadoEm: null,
      dimensoes: [DIMENSAO_0A2],
    });

    render(<GipRegua idContrato={7} momento="inicio" />);

    await screen.findByText("Capacidade de gestão");
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("dimensão de faixa 0-3 renderiza exatamente 4 opções -- lado oposto", async () => {
    buscarGipDoContratoMock.mockResolvedValue({
      momento: "inicio",
      aplicado: false,
      aplicadoEm: null,
      dimensoes: [DIMENSAO_0A3],
    });

    render(<GipRegua idContrato={7} momento="inicio" />);

    await screen.findByText(/Performance dos objetivos/);
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });

  it("cada opção é rotulada 'Nível N' + o descritor do catálogo", async () => {
    buscarGipDoContratoMock.mockResolvedValue({
      momento: "inicio",
      aplicado: false,
      aplicadoEm: null,
      dimensoes: [DIMENSAO_0A2],
    });

    const { container } = render(<GipRegua idContrato={7} momento="inicio" />);
    await screen.findByText("Capacidade de gestão");

    expect(container.textContent).toContain("Nível 2 — Implementa estratégia de gestão de pessoas");
  });
});

describe("GipRegua — momento já aplicado (FMC-27 AC7) — os dois lados", () => {
  it("aplicado=true: renderiza como aplicado, sem oferecer novo envio", async () => {
    buscarGipDoContratoMock.mockResolvedValue({
      momento: "inicio",
      aplicado: true,
      aplicadoEm: "2026-09-16",
      dimensoes: [{ ...DIMENSAO_0A2, valorAtual: 1 }],
    });

    render(<GipRegua idContrato={7} momento="inicio" />);

    expect(await screen.findByText(/já aplicado/i)).toBeInTheDocument();
    expect(screen.getByText("Nível 1 — Implementa rotinas de alinhamento")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /salvar/i })).not.toBeInTheDocument();
  });

  it("aplicado=false: oferece o formulário de preenchimento -- lado oposto", async () => {
    buscarGipDoContratoMock.mockResolvedValue({
      momento: "inicio",
      aplicado: false,
      aplicadoEm: null,
      dimensoes: [DIMENSAO_0A2],
    });

    render(<GipRegua idContrato={7} momento="inicio" />);

    await screen.findByText("Capacidade de gestão");
    expect(screen.queryByText(/já aplicado/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /salvar/i })).toBeInTheDocument();
  });
});

describe("GipRegua — submissão (FMC-26)", () => {
  it("salva via INSERT em fat_submissao, nunca em fat_gip diretamente", async () => {
    buscarGipDoContratoMock.mockResolvedValue({
      momento: "inicio",
      aplicado: false,
      aplicadoEm: null,
      dimensoes: [DIMENSAO_0A2],
    });

    render(<GipRegua idContrato={7} momento="inicio" />);
    await screen.findByText("Capacidade de gestão");

    const [, , radioNivel2] = screen.getAllByRole("radio");
    fireEvent.click(radioNivel2);
    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id_contrato: 7,
        id_formulario: 9,
        versao_formulario: 1,
        id_usuario_respondente: 42,
        momento: "inicio",
        respostas: { dimensoes: { capacidade_gestao: 2 } },
      })
    );
  });

  it("recarrega o estado do contrato após salvar com sucesso", async () => {
    buscarGipDoContratoMock.mockResolvedValue({
      momento: "inicio",
      aplicado: false,
      aplicadoEm: null,
      dimensoes: [DIMENSAO_0A2],
    });

    render(<GipRegua idContrato={7} momento="inicio" />);
    await screen.findByText("Capacidade de gestão");
    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await waitFor(() => expect(buscarGipDoContratoMock).toHaveBeenCalledTimes(2));
  });
});

describe("GipRegua — erro (design.md Error Handling Strategy)", () => {
  it("falha ao carregar exibe <ErroInline>", async () => {
    buscarGipDoContratoMock.mockRejectedValue(new Error("RLS negou a leitura."));

    render(<GipRegua idContrato={7} momento="inicio" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("RLS negou a leitura.");
  });

  it("falha ao salvar exibe <ErroInline>, sem perder as opções escolhidas -- lado oposto do sucesso", async () => {
    buscarGipDoContratoMock.mockResolvedValue({
      momento: "inicio",
      aplicado: false,
      aplicadoEm: null,
      dimensoes: [DIMENSAO_0A2],
    });
    insertMock.mockResolvedValue({ error: { code: "23514", message: "trg_gip_dimensao_faixa" } });

    render(<GipRegua idContrato={7} momento="inicio" />);
    await screen.findByText("Capacidade de gestão");
    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });
});
