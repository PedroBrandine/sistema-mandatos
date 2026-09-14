import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FiltrosAgenda } from "./filtros-agenda";

// Ajuste de fidelidade visual — Agenda (2026-09-14, Figma 163:4
// "filter-bar"): relato do Pedro -- "os filtros de gestora, projeto e
// contrato também não aparecem como foi definido no Figma". Presentational
// puro, mesmo espírito do teste de FiltrosMandatos (T21): não interage com o
// listbox do Radix Select (custo alto em jsdom, mesma razão documentada em
// EncontroPopover/T28), só afirma o que a tela mostra a partir de props.

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
    render(<FiltrosAgenda filtro={{ idContrato: 42 }} onChange={vi.fn()} {...OPCOES} />);

    expect(screen.getByRole("combobox", { name: "Filtrar por contrato" })).toHaveTextContent(
      "Dep. Ana Ribeiro"
    );
  });
});
