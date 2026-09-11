import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FiltrosMandatos, type ValorFiltrosMandatos } from "./filtros-mandatos";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/tasks.md, T21
// "Done when" (EST-09 AC2, AC3, AC4, AD-046 -- tela de leitura, caminho
// feliz de cada AC).

afterEach(cleanup);

const OPCOES = {
  gestoras: [{ id: 1, nome: "Gestora Um" }],
  projetos: [{ id: 10, nome: "Projeto Alfa" }],
  etapas: [{ id: 100, nome: "Diagnóstico" }],
};

describe("FiltrosMandatos (EST-09)", () => {
  it("altera o filtro de data e chama onChange com o novo valor (AC2, AC3)", () => {
    const onChange = vi.fn();
    render(<FiltrosMandatos filtro={{}} onChange={onChange} {...OPCOES} contagem={5} />);

    fireEvent.change(screen.getByLabelText("Início — de"), { target: { value: "2026-01-01" } });

    expect(onChange).toHaveBeenCalledWith({ dtInicioDe: "2026-01-01" });
  });

  it("exibe a contagem recebida (AC2)", () => {
    render(<FiltrosMandatos filtro={{}} onChange={vi.fn()} {...OPCOES} contagem={5} />);

    expect(screen.getByText("5 mandatos")).toBeInTheDocument();
  });

  it("'Limpar filtros' devolve o filtro ao estado inicial (AC4)", () => {
    const onChange = vi.fn();
    const filtroAplicado: ValorFiltrosMandatos = { idGestora: 1, idProjeto: 10, status: "ativo" };
    render(<FiltrosMandatos filtro={filtroAplicado} onChange={onChange} {...OPCOES} contagem={1} />);

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));

    expect(onChange).toHaveBeenCalledWith({});
  });
});
