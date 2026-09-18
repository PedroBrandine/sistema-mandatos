import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { PlanejamentoKpi } from "@backend/queries/planejamento";

import { PlanejamentoKpis } from "./planejamento-kpis";

// Spec anchor: PLV-11 (.specs/features/planejamento-estrategico-v2/spec.md, "P2:
// KPIs e filtro por Objetivo" AC1/AC4). AD-042: com dado e vazio, placeholder
// de Fatos Geradores sempre presente.

const KPIS_COM_DADO: PlanejamentoKpi = {
  idPlanejamento: 1,
  idContrato: 7,
  pctAtingimento: 62,
  metasAtivas: 7,
  metasPrioritarias: 3,
  sucessosMensais: 12,
};

const KPIS_VAZIO: PlanejamentoKpi = {
  idPlanejamento: 1,
  idContrato: 7,
  pctAtingimento: null,
  metasAtivas: null,
  metasPrioritarias: null,
  sucessosMensais: null,
};

afterEach(cleanup);

describe("PlanejamentoKpis — com dado (AC1)", () => {
  it("mostra os 4 cartões com os rótulos literais da spec", () => {
    render(<PlanejamentoKpis kpis={KPIS_COM_DADO} carregando={false} />);
    expect(screen.getByText("Atingimento total do plano")).toBeInTheDocument();
    expect(screen.getByText("Metas prioritárias")).toBeInTheDocument();
    expect(screen.getByText("Sucessos Mensais")).toBeInTheDocument();
    expect(screen.getByText("Fatos Geradores")).toBeInTheDocument();
  });

  it("Atingimento vem formatado como porcentagem", () => {
    render(<PlanejamentoKpis kpis={KPIS_COM_DADO} carregando={false} />);
    expect(screen.getByText("62%")).toBeInTheDocument();
  });

  it("Metas prioritárias mostra a fração real 'X de Y', não um número solto", () => {
    render(<PlanejamentoKpis kpis={KPIS_COM_DADO} carregando={false} />);
    expect(screen.getByText("3 de 7")).toBeInTheDocument();
  });

  it("Sucessos Mensais mostra a contagem simples — a view não expõe um denominador", () => {
    render(<PlanejamentoKpis kpis={KPIS_COM_DADO} carregando={false} />);
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("Fatos Geradores é sempre o placeholder, mesmo com os outros 3 preenchidos", () => {
    render(<PlanejamentoKpis kpis={KPIS_COM_DADO} carregando={false} />);
    expect(screen.getByText("Em desenvolvimento")).toBeInTheDocument();
  });
});

describe("PlanejamentoKpis — vazio (AC4, Independent Test)", () => {
  // spec.md:299 -- "contrato sem metas mostra — em todos os KPIs".
  it("os 3 KPIs reais mostram —, nunca 0", () => {
    render(<PlanejamentoKpis kpis={KPIS_VAZIO} carregando={false} />);
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("kpis nulo (plano ainda não resolvido) também mostra — em todos, não quebra", () => {
    render(<PlanejamentoKpis kpis={null} carregando={false} />);
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  it("metas prioritárias com só um dos dois números nulo cai em —, não mistura fração incompleta", () => {
    render(
      <PlanejamentoKpis kpis={{ ...KPIS_COM_DADO, metasAtivas: null }} carregando={false} />
    );
    expect(screen.queryByText(/de null/)).not.toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("PlanejamentoKpis — carregando", () => {
  it("mostra reticências, não — nem 0, enquanto a query roda", () => {
    render(<PlanejamentoKpis kpis={null} carregando />);
    expect(screen.getAllByText("…")).toHaveLength(3);
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });
});
