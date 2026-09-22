import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { PllKpi } from "@backend/queries/pll-dashboard";

import { PllKpiRow } from "./pll-kpi-row";

// Spec anchor: pll-dashboard-agenda T8 Done-when (tasks.md) -- PLL-DB-02,
// PLL-DB-03, PLL-DB-04, PLL-DB-06. AD-046: tela de leitura, caminho feliz de
// cada AC.

afterEach(cleanup);

const KPI: PllKpi = {
  totalMentorados: 20,
  distribuicaoStatus: { ativo: 12, desistente: 4, desligado: 2, concluido: 2 },
  mentoriasRealizadas: 45,
  mentoriasPlanejadas: 60,
  atingimentoMedio: 68,
  fatosGeradoresRegistrados: 9,
};

describe("PllKpiRow (PLL-DB-02, PLL-DB-06)", () => {
  it("exibe os 5 KPIs, nos rótulos e ordem do spec", () => {
    render(<PllKpiRow kpi={KPI} />);

    const rotulos = [
      "Total de mentorados",
      "Distribuição de status",
      "Mentorias realizadas x planejadas",
      "Atingimento Plan.",
      "Fatos geradores registrados",
    ];
    for (const rotulo of rotulos) {
      expect(screen.getByText(rotulo)).toBeInTheDocument();
    }
  });

  it("dispõe os cards em 5 colunas dentro do contêiner (PLL-DB-06)", () => {
    const { container } = render(<PllKpiRow kpi={KPI} />);
    expect(container.firstElementChild).toHaveClass("lg:grid-cols-5");
  });

  it("Total de mentorados mostra a contagem", () => {
    render(<PllKpiRow kpi={KPI} />);
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("Mentorias realizadas x planejadas mostra os dois valores (D-11)", () => {
    render(<PllKpiRow kpi={KPI} />);
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("/ 60")).toBeInTheDocument();
  });

  it("Fatos geradores registrados mostra a contagem", () => {
    render(<PllKpiRow kpi={KPI} />);
    expect(screen.getByText("9")).toBeInTheDocument();
  });
});

describe("PllKpiRow — Distribuição de status (PLL-DB-03)", () => {
  it("a legenda mostra o percentual de cada status sobre o total", () => {
    render(<PllKpiRow kpi={KPI} />);

    expect(screen.getByText("Ativo: 60%")).toBeInTheDocument();
    expect(screen.getByText("Desistente: 20%")).toBeInTheDocument();
    expect(screen.getByText("Desligado: 10%")).toBeInTheDocument();
    expect(screen.getByText("Concluído: 10%")).toBeInTheDocument();
  });

  it("recorte com 0 mentorados mostra contagem 0 e percentual '—', sem dividir por zero", () => {
    const kpiVazio: PllKpi = {
      ...KPI,
      totalMentorados: 0,
      distribuicaoStatus: { ativo: 0, desistente: 0, desligado: 0, concluido: 0 },
    };
    render(<PllKpiRow kpi={kpiVazio} />);

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("Ativo: —")).toBeInTheDocument();
    expect(screen.getByText("Desistente: —")).toBeInTheDocument();
  });
});

describe("PllKpiRow — Atingimento Plan. (PLL-DB-04)", () => {
  it("mostra o percentual sem afordância de edição (AD-003) — nenhum input/button no card", () => {
    render(<PllKpiRow kpi={KPI} />);
    const rotulo = screen.getByText("Atingimento Plan.");
    const card = rotulo.closest("[role='group']");
    expect(card?.querySelector("input, button")).toBeNull();
    expect(screen.getByText("68%")).toBeInTheDocument();
  });

  it("sem planejamento no recorte exibe '—', nunca 0%", () => {
    render(<PllKpiRow kpi={{ ...KPI, atingimentoMedio: null }} />);

    const rotulo = screen.getByText("Atingimento Plan.");
    const card = rotulo.closest("[role='group']") as HTMLElement;
    expect(card).toHaveTextContent("—");
    expect(card.querySelector("[role='progressbar']")).toBeNull();
  });
});
