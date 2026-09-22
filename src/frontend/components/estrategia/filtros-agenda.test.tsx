import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FiltrosAgenda } from "./filtros-agenda";

// Ajuste de fidelidade visual — Agenda (2026-09-14, Figma 163:4
// "filter-bar"): relato do Pedro -- "os filtros de gestora, projeto e
// contrato também não aparecem como foi definido no Figma". Presentational
// puro, mesmo espírito do teste de FiltrosMandatos (T21): não abre o dropdown
// (a interação com a lista está em multi-select-pesquisavel.test.tsx), só
// afirma o que a tela mostra a partir de props.

afterEach(cleanup);

const OPCOES = {
  gestoras: [{ id: 1, nome: "Ana Gestora" }],
  projetos: [{ id: 10, nome: "Projeto Alfa" }],
  contratos: [{ id: 42, nome: "Dep. Ana Ribeiro" }],
};

describe("FiltrosAgenda (ajuste de fidelidade visual 2026-09-14)", () => {
  it("os 3 dropdowns do Figma existem, cada um com seu próprio rótulo", () => {
    render(<FiltrosAgenda filtro={{}} onChange={vi.fn()} {...OPCOES} />);

    expect(screen.getByRole("combobox", { name: "Filtrar por gestora" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filtrar por projeto" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filtrar por contrato" })).toBeInTheDocument();
  });

  it("sem filtro aplicado, cada dropdown mostra o próprio rótulo como texto (estado 'todos' do Figma)", () => {
    render(<FiltrosAgenda filtro={{}} onChange={vi.fn()} {...OPCOES} />);

    expect(screen.getByRole("combobox", { name: "Filtrar por gestora" })).toHaveTextContent(
      "Filtrar por gestora"
    );
    expect(screen.getByRole("combobox", { name: "Filtrar por contrato" })).toHaveTextContent(
      "Filtrar por contrato"
    );
  });

  it("com filtro aplicado, o dropdown mostra o nome da opção escolhida, não o rótulo genérico", () => {
    render(<FiltrosAgenda filtro={{ idsContrato: [42] }} onChange={vi.fn()} {...OPCOES} />);

    expect(screen.getByRole("combobox", { name: "Filtrar por contrato" })).toHaveTextContent(
      "Dep. Ana Ribeiro"
    );
  });

  it("com várias opções marcadas, o dropdown mostra a contagem no plural", () => {
    render(
      <FiltrosAgenda
        filtro={{ idsGestora: [1, 2] }}
        onChange={vi.fn()}
        {...OPCOES}
        gestoras={[...OPCOES.gestoras, { id: 2, nome: "Bia Gestora" }]}
      />
    );

    expect(screen.getByRole("combobox", { name: "Filtrar por gestora" })).toHaveTextContent("2 gestoras");
  });

  // Pedido do Pedro, 2026-09-14: um botão zera os 3 filtros de uma vez, em
  // vez de exigir 3 cliques (um por dropdown voltando a "todos").
  it("Limpar filtros devolve o filtro vazio, mesmo com os 3 aplicados", () => {
    const onChange = vi.fn();
    render(
      <FiltrosAgenda
        filtro={{ idsGestora: [1], idsProjeto: [10], idsContrato: [42] }}
        onChange={onChange}
        {...OPCOES}
      />
    );

    screen.getByRole("button", { name: "Limpar filtros" }).click();

    expect(onChange).toHaveBeenCalledWith({});
  });
});
