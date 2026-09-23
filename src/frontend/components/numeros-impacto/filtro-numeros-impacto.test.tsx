import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { FiltroNumerosImpacto, OpcaoNumerosImpacto } from "@backend/queries/numeros-impacto";
import { FiltroNumerosImpactoBar } from "./filtro-numeros-impacto";

afterEach(cleanup);

// PF2-04 AC3 (.specs/features/pente-fino-2026-09-23/spec.md, validation.md
// Fix 2): filtro-numeros-impacto.tsx não tinha arquivo de teste próprio --
// numeros-impacto-dashboard.test.tsx só provava a presença dos 2 novos
// comboboxes (AC1), nunca que "Limpar filtros" zera os 5 campos (os 3 já
// existentes + os 2 novos de contratante/produto). Wrapper com estado real
// (useState), como o consumidor de produção usa o componente -- não um
// onChange mockado, porque o que a AC3 exige é o ESTADO resultante após o
// clique, não só a chamada.
const GESTORAS: OpcaoNumerosImpacto[] = [{ id: 1, nome: "Gestora 1" }];
const PROJETOS: OpcaoNumerosImpacto[] = [{ id: 2, nome: "Projeto X" }];
const CONTRATANTES: OpcaoNumerosImpacto[] = [{ id: 3, nome: "Contratante A" }];
const ANOS = [2025];
const PRODUTOS = ["Estratégia"];

const FILTRO_TODOS_PREENCHIDOS: FiltroNumerosImpacto = {
  idsGestora: [1],
  idsProjeto: [2],
  idsContratante: [3],
  produtos: ["Estratégia"],
  anos: [2025],
};

function FiltroComEstado({ inicial }: { inicial: FiltroNumerosImpacto }) {
  const [filtro, setFiltro] = useState<FiltroNumerosImpacto>(inicial);
  return (
    <FiltroNumerosImpactoBar
      filtro={filtro}
      onChange={setFiltro}
      gestoras={GESTORAS}
      projetos={PROJETOS}
      contratantes={CONTRATANTES}
      anos={ANOS}
      produtos={PRODUTOS}
    />
  );
}

describe("FiltroNumerosImpactoBar", () => {
  it("com os 5 filtros preenchidos, cada combobox mostra a seleção (não o placeholder)", () => {
    render(<FiltroComEstado inicial={FILTRO_TODOS_PREENCHIDOS} />);

    expect(screen.getByRole("combobox", { name: "Filtrar por contratante" })).toHaveTextContent("Contratante A");
    expect(screen.getByRole("combobox", { name: "Filtrar por produto" })).toHaveTextContent("Estratégia");
    expect(screen.getByRole("combobox", { name: "Filtrar por gestora" })).toHaveTextContent("Gestora 1");
    expect(screen.getByRole("combobox", { name: "Filtrar por projeto" })).toHaveTextContent("Projeto X");
    expect(screen.getByRole("combobox", { name: "Filtrar por ano de início" })).toHaveTextContent("2025");
  });

  // AC3: clicar em "Limpar filtros" zera também contratante/produto, junto
  // com gestora/projeto/ano já existentes -- os 5 comboboxes voltam a
  // mostrar o placeholder (nenhuma seleção), prova do ESTADO pós-clique, não
  // só de o botão ter sido clicado.
  it('clicar em "Limpar filtros" zera os 5 filtros (gestora/projeto/ano + contratante/produto novos) (PF2-04 AC3)', () => {
    render(<FiltroComEstado inicial={FILTRO_TODOS_PREENCHIDOS} />);

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));

    expect(screen.getByRole("combobox", { name: "Filtrar por contratante" })).toHaveTextContent(
      "Filtrar por contratante"
    );
    expect(screen.getByRole("combobox", { name: "Filtrar por produto" })).toHaveTextContent("Filtrar por produto");
    expect(screen.getByRole("combobox", { name: "Filtrar por gestora" })).toHaveTextContent("Filtrar por gestora");
    expect(screen.getByRole("combobox", { name: "Filtrar por projeto" })).toHaveTextContent("Filtrar por projeto");
    expect(screen.getByRole("combobox", { name: "Filtrar por ano de início" })).toHaveTextContent(
      "Filtrar por ano de início"
    );
  });
});
