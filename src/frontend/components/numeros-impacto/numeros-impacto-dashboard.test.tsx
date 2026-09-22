import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import type { LinhaNumerosImpacto } from "@backend/queries/numeros-impacto";
import { NumerosImpactoDashboard } from "./numeros-impacto-dashboard";

afterEach(cleanup);

// Recharts' <ResponsiveContainer> (usado por ChartBarraHorizontal via
// ChartContainer) mede o pai com ResizeObserver e offsetWidth/offsetHeight --
// nenhum dos dois existe em jsdom, e sem eles o cálculo de layout do gráfico
// quebra em runtime (não é warning, derruba o render). Nenhum outro teste do
// projeto ainda importava um componente com <ChartContainer>, então este é o
// 1º a precisar do stub.
beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  global.ResizeObserver = ResizeObserverMock;
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, value: 600 });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 300 });
});

// AD-046: tela de leitura -- caminho feliz (renderiza filtros, KPIs, gráficos
// e tabela a partir de um conjunto carregado), sem par positivo/negativo de
// cada condicional. O estado vazio de "sem contrato nenhum" já é coberto na
// page.tsx (fora deste componente); aqui o recorte cobre "linhas presentes".
const LINHA_BASE: LinhaNumerosImpacto = {
  idContrato: 1,
  idContratante: 100,
  nomeContratante: "Contratante A",
  tipoContratante: "mandato",
  sgUf: "SP",
  nmMunicipio: "São Paulo",
  nomeProduto: "Estratégia",
  idProjeto: 5,
  nomeProjeto: "Projeto X",
  tematica: "Saúde",
  dtInicio: "2025-01-10",
  dtFim: null,
  anoInicio: 2025,
  status: "ativo",
  cargoNoContrato: "Vereador(a)",
  partidoNoContrato: "PT",
  nrContratosContratante: 1,
  dtPrimeiraContratacao: "2025-01-10",
  ordemContrato: 1,
  idGestora: 10,
  nomeGestora: "Gestora 1",
  dsGenero: "feminino",
  dsRaca: "parda",
  dsOrientacaoSexual: "heterossexual",
};

const LINHAS: LinhaNumerosImpacto[] = [
  LINHA_BASE,
  { ...LINHA_BASE, idContrato: 2, idContratante: 200, nomeContratante: "Contratante B", status: "concluido" },
  {
    ...LINHA_BASE,
    idContrato: 3,
    idContratante: 300,
    nomeContratante: "Coalizão C",
    tipoContratante: "coalizao",
    nomeProduto: "Coalizão",
  },
];

describe("NumerosImpactoDashboard", () => {
  it("renderiza KPIs, filtros, gráficos e a tabela a partir do conjunto carregado", () => {
    render(<NumerosImpactoDashboard linhas={LINHAS} />);

    // KPIs: 3 contratos, 2 mandatos, 1 coalizão (contratantes distintos por
    // tipo) -- cada StatTile é um role="group" nomeado pelo próprio rótulo
    // (aria-labelledby), então dá pra ler o número sem colidir com os
    // números repetidos da tabela (nrContratosContratante/ordemContrato).
    expect(screen.getByRole("group", { name: "Quantidade de contratos" })).toHaveTextContent("3");
    expect(screen.getByRole("group", { name: "Quantidade de mandatos" })).toHaveTextContent("2");
    expect(screen.getByRole("group", { name: "Quantidade de coalizões" })).toHaveTextContent("1");

    // Filtros (gestora/projeto/ano) presentes.
    expect(screen.getByRole("combobox", { name: "Filtrar por gestora" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filtrar por projeto" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filtrar por ano de início" })).toBeInTheDocument();

    // Botão de exportar, desabilitado (em desenvolvimento).
    expect(screen.getByRole("button", { name: /Exportar relatório \(em desenvolvimento\)/ })).toBeDisabled();

    // Gráficos (título aparece 2x: CardTitle do card + título interno de
    // ChartBarraHorizontal).
    expect(screen.getAllByText("Contratos por produto").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Contratos por projeto").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Contagem por status").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Contagem por ano de início").length).toBeGreaterThan(0);
    expect(screen.getByText("Perfil demográfico")).toBeInTheDocument();

    // Tabela original mantida, com as 3 linhas.
    expect(screen.getByText("Contratante A")).toBeInTheDocument();
    expect(screen.getByText("Contratante B")).toBeInTheDocument();
    expect(screen.getByText("Coalizão C")).toBeInTheDocument();
  });
});
