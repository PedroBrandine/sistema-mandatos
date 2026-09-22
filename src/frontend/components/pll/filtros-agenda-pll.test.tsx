import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FiltrosAgendaPll } from "./filtros-agenda-pll";

// Spec anchor: pll-dashboard-agenda T13 Done-when (tasks.md) -- PLL-AG-08.
// Presentational puro, mesmo espírito do teste de FiltrosAgenda (Estratégia):
// não abre o dropdown, só afirma o que a tela mostra a partir de props.

afterEach(cleanup);

const OPCOES = {
  mentores: [{ id: 1, nome: "Carla Mentora" }],
  mentorados: [{ id: 2, nome: "Ana Souza" }],
  edicoes: [{ id: 10, nome: "2026.1" }],
};

describe("FiltrosAgendaPll (PLL-AG-08)", () => {
  it("os 3 dropdowns do spec existem, cada um com seu próprio rótulo", () => {
    render(<FiltrosAgendaPll filtro={{}} onChange={vi.fn()} {...OPCOES} />);

    expect(screen.getByRole("combobox", { name: "Filtrar por mentor(a)" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filtrar por mentorado" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filtrar por edição" })).toBeInTheDocument();
  });

  it("com filtro aplicado, o dropdown mostra o nome da opção escolhida", () => {
    render(<FiltrosAgendaPll filtro={{ idsMentorado: [2] }} onChange={vi.fn()} {...OPCOES} />);

    expect(screen.getByRole("combobox", { name: "Filtrar por mentorado" })).toHaveTextContent("Ana Souza");
  });

  it("Limpar filtros devolve o filtro vazio, mesmo com os 3 aplicados", () => {
    const onChange = vi.fn();
    render(
      <FiltrosAgendaPll
        filtro={{ idsMentor: [1], idsMentorado: [2], idsProjeto: [10] }}
        onChange={onChange}
        {...OPCOES}
      />
    );

    screen.getByRole("button", { name: "Limpar filtros" }).click();

    expect(onChange).toHaveBeenCalledWith({});
  });
});
