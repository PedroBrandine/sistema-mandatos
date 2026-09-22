import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FiltrosFatosGeradores } from "./filtros-fatos-geradores";

// Barra de filtros da aba "Fatos Geradores" do produto (Gestora / Projeto /
// Contrato). Tela de leitura (AD-046): caminho feliz de cada comportamento.
// O dropdown (Popover do Radix) não abre em jsdom sem custo alto; aqui se prova
// o que é do componente -- os 3 seletores com nome acessível, o resumo com
// várias opções e o "Limpar filtros". A lista em si tem teste próprio em
// multi-select-pesquisavel.test.tsx.

afterEach(cleanup);

const OPCOES = [{ id: 1, nome: "Opção" }];

describe("FiltrosFatosGeradores", () => {
  it("oferece Gestora, Projeto e Contrato, cada um com seu placeholder", () => {
    render(
      <FiltrosFatosGeradores filtro={{}} onChange={vi.fn()} gestoras={OPCOES} projetos={OPCOES} contratos={OPCOES} />
    );

    expect(screen.getByRole("combobox", { name: "Gestora" })).toHaveTextContent("Todas as gestoras");
    expect(screen.getByRole("combobox", { name: "Projeto" })).toHaveTextContent("Todos os projetos");
    expect(screen.getByRole("combobox", { name: "Contrato" })).toHaveTextContent("Todos os contratos");
  });

  it("com várias opções marcadas, cada seletor mostra a contagem no plural", () => {
    const duas = [
      { id: 1, nome: "Um" },
      { id: 2, nome: "Dois" },
    ];
    render(
      <FiltrosFatosGeradores
        filtro={{ idsGestora: [1, 2], idsContrato: [1, 2] }}
        onChange={vi.fn()}
        gestoras={duas}
        projetos={duas}
        contratos={duas}
      />
    );

    expect(screen.getByRole("combobox", { name: "Gestora" })).toHaveTextContent("2 gestoras");
    expect(screen.getByRole("combobox", { name: "Contrato" })).toHaveTextContent("2 contratos");
    expect(screen.getByRole("combobox", { name: "Projeto" })).toHaveTextContent("Todos os projetos");
  });

  it("'Limpar filtros' zera o filtro inteiro", () => {
    const onChange = vi.fn();
    render(
      <FiltrosFatosGeradores
        filtro={{ idsGestora: [1], idsProjeto: [1], idsContrato: [1] }}
        onChange={onChange}
        gestoras={OPCOES}
        projetos={OPCOES}
        contratos={OPCOES}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));

    expect(onChange).toHaveBeenCalledWith({});
  });

  it("sem filtro aplicado, 'Limpar filtros' fica desabilitado", () => {
    render(
      <FiltrosFatosGeradores filtro={{}} onChange={vi.fn()} gestoras={OPCOES} projetos={OPCOES} contratos={OPCOES} />
    );

    expect(screen.getByRole("button", { name: "Limpar filtros" })).toBeDisabled();
  });

  it("lista vazia num filtro conta como sem filtro -- 'Limpar filtros' continua desabilitado", () => {
    render(
      <FiltrosFatosGeradores
        filtro={{ idsGestora: [] }}
        onChange={vi.fn()}
        gestoras={OPCOES}
        projetos={OPCOES}
        contratos={OPCOES}
      />
    );

    expect(screen.getByRole("button", { name: "Limpar filtros" })).toBeDisabled();
  });
});
