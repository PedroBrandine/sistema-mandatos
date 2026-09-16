import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: .specs/features/fatos-geradores-ciclo-vida/spec.md, "P1:
// Registrar Fato Gerador pelo wizard" AC2/AC3/AC4, e Edge Case "busca sem
// resultado oferece sem origem". AD-042 integral: os dois lados de cada
// condicional (aba ativa/inativa, resultado presente/ausente, selecionado/
// não selecionado).

const buscarPreInsightsDoContratoMock = vi.fn();
const buscarInsightsDoContratoMock = vi.fn();
const buscarPlanejamentoCompletoMock = vi.fn();

vi.mock("@backend/queries/incidencia", () => ({
  buscarPreInsightsDoContrato: (...args: unknown[]) => buscarPreInsightsDoContratoMock(...args),
  buscarInsightsDoContrato: (...args: unknown[]) => buscarInsightsDoContratoMock(...args),
}));

vi.mock("@backend/queries/planejamento", () => ({
  buscarPlanejamentoCompleto: (...args: unknown[]) => buscarPlanejamentoCompletoMock(...args),
}));

// Builder encadeável e "thenable" para fat_registro -- mesmo padrão de
// mandato-wizard.test.tsx (criarClienteFake).
const REGISTROS: { id_registro: number; ocorrido_em: string; resumo: string | null }[] = [
  { id_registro: 900, ocorrido_em: "2026-09-01", resumo: "Reunião com liderança" },
];

function criarClienteFake() {
  return {
    from() {
      const builder: Record<string, unknown> = {
        then: (resolve: (r: { data: unknown[]; error: null }) => unknown) =>
          Promise.resolve({ data: REGISTROS, error: null }).then(resolve),
      };
      for (const metodo of ["select", "eq", "order"]) {
        builder[metodo] = () => builder;
      }
      return builder;
    },
  };
}

vi.mock("@backend/supabase/client", () => ({
  createClient: () => criarClienteFake(),
}));

import { SeletorOrigem, type OrigemFato } from "./seletor-origem";

beforeEach(() => {
  buscarPreInsightsDoContratoMock.mockReset();
  buscarInsightsDoContratoMock.mockReset();
  buscarPlanejamentoCompletoMock.mockReset();

  buscarPreInsightsDoContratoMock.mockResolvedValue([
    { idPreInsight: 1, conteudo: "Sinal bruto sobre orçamento", ocorridoEm: "2026-09-01" },
  ]);
  buscarInsightsDoContratoMock.mockResolvedValue([
    { idInsight: 2, conteudo: "Insight sobre saúde", pilar: null, ocorridoEm: "2026-09-02" },
  ]);
  buscarPlanejamentoCompletoMock.mockResolvedValue({
    objetivos: [{ metas: [{ idMeta: 3, descricao: "Meta de mobilização" }] }],
  });
});

afterEach(cleanup);

function Wrapper() {
  const [valor, setValor] = useState<OrigemFato | null>(null);
  return <SeletorOrigem idContrato={7} valor={valor} onSelecionar={setValor} />;
}

describe("SeletorOrigem — 4 abas escopadas ao contrato (AC2/AC4)", () => {
  it("carrega as 4 fontes já filtradas por idContrato", async () => {
    render(<Wrapper />);
    await waitFor(() => expect(buscarPreInsightsDoContratoMock).toHaveBeenCalledWith(expect.anything(), 7));
    expect(buscarInsightsDoContratoMock).toHaveBeenCalledWith(expect.anything(), 7);
    expect(buscarPlanejamentoCompletoMock).toHaveBeenCalledWith(expect.anything(), 7);
  });

  it("mostra a aba Pré-Insight ativa por padrão, com seu item", async () => {
    render(<Wrapper />);
    expect(await screen.findByText("Sinal bruto sobre orçamento")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Pré-Insight" })).toHaveAttribute("aria-selected", "true");
  });

  it("trocar para a aba Insight mostra o item de Insight e esconde o de Pré-Insight", async () => {
    render(<Wrapper />);
    await screen.findByText("Sinal bruto sobre orçamento");

    fireEvent.click(screen.getByRole("tab", { name: "Insight" }));

    expect(await screen.findByText("Insight sobre saúde")).toBeInTheDocument();
    expect(screen.queryByText("Sinal bruto sobre orçamento")).not.toBeInTheDocument();
  });

  it("trocar para a aba Registro mostra o item lido inline de fat_registro", async () => {
    render(<Wrapper />);
    await screen.findByText("Sinal bruto sobre orçamento");
    expect(screen.queryByText(/Reunião com liderança/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Registro" }));

    expect(await screen.findByText(/Reunião com liderança/)).toBeInTheDocument();
  });

  it("trocar para a aba Meta mostra a meta vinda de buscarPlanejamentoCompleto", async () => {
    render(<Wrapper />);
    fireEvent.click(screen.getByRole("tab", { name: "Meta" }));

    expect(await screen.findByText("Meta de mobilização")).toBeInTheDocument();
  });
});

describe("SeletorOrigem — busca filtra a aba ativa", () => {
  it("busca que casa com o item mantém ele visível", async () => {
    render(<Wrapper />);
    await screen.findByText("Sinal bruto sobre orçamento");

    fireEvent.change(screen.getByLabelText("Buscar origem"), { target: { value: "orçamento" } });

    expect(screen.getByText("Sinal bruto sobre orçamento")).toBeInTheDocument();
  });

  it("busca que não casa com nada esconde o item e oferece sem origem (Edge Case)", async () => {
    render(<Wrapper />);
    await screen.findByText("Sinal bruto sobre orçamento");

    fireEvent.change(screen.getByLabelText("Buscar origem"), { target: { value: "zzz-nao-existe" } });

    expect(screen.queryByText("Sinal bruto sobre orçamento")).not.toBeInTheDocument();
    expect(screen.getByText("Nenhum resultado encontrado.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar sem origem" })).toBeInTheDocument();
  });

  it("o botão de sem origem do estado de busca vazia seleciona sem origem (Edge Case, não bloqueia)", async () => {
    render(<Wrapper />);
    await screen.findByText("Sinal bruto sobre orçamento");

    fireEvent.change(screen.getByLabelText("Buscar origem"), { target: { value: "zzz-nao-existe" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar sem origem" }));

    expect(screen.getByRole("button", { name: "Fato sem origem" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("SeletorOrigem — Fato sem origem é caminho de primeira classe (AC3)", () => {
  it("clicar em Fato sem origem seleciona sem nenhuma marca de erro/pendência", async () => {
    render(<Wrapper />);
    await screen.findByText("Sinal bruto sobre orçamento");

    fireEvent.click(screen.getByRole("button", { name: "Fato sem origem" }));

    expect(screen.getByRole("button", { name: "Fato sem origem" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/erro/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pendente/i)).not.toBeInTheDocument();
  });

  it("sem seleção nenhuma, o botão de sem origem não aparece marcado (lado oposto)", async () => {
    render(<Wrapper />);
    await screen.findByText("Sinal bruto sobre orçamento");

    expect(screen.getByRole("button", { name: "Fato sem origem" })).toHaveAttribute("aria-pressed", "false");
  });

  it("selecionar um item real marca ele, não o botão de sem origem (lado oposto)", async () => {
    render(<Wrapper />);
    fireEvent.click(await screen.findByText("Sinal bruto sobre orçamento"));

    expect(screen.getByRole("button", { name: "Sinal bruto sobre orçamento" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Fato sem origem" })).toHaveAttribute("aria-pressed", "false");
  });
});
