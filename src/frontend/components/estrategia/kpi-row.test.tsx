import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { EstrategiaKpi } from "@backend/queries/estrategia-kpi";
import { KpiRow } from "./kpi-row";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/tasks.md, T33
// "Done when" (EST-08 AC1, AC2) --
//  - Os 6 KPIs renderizam com os rótulos
//  - Ausência renderiza "—" e presença renderiza o número, TESTE DOS DOIS
//    LADOS (o Done-when de T33 é explícito nisso, então o corte de AD-046
//    não se aplica a este par).

afterEach(cleanup);

const KPI_COMPLETO: EstrategiaKpi = {
  mandatosAtivos: 25,
  iipMedio: 3.7,
  mandatosEmAtraso: 11,
  npsMedio: 62.5,
  pctAtingimentoMedio: 55.2,
  nrFatosGeradores: 1240,
};

const KPI_VAZIO: EstrategiaKpi = {
  mandatosAtivos: null,
  iipMedio: null,
  mandatosEmAtraso: null,
  npsMedio: null,
  pctAtingimentoMedio: null,
  nrFatosGeradores: null,
};

// Grafia do Figma 44:227 (caixa alta vem do CSS, não do texto). "Mandatos em
// atraso" não está no Figma mas está em EST-08 AC1 -- o spec manda no
// conjunto de KPIs, ver desvio 5 do Registro da Fase 8.
const ROTULOS = [
  "Mandatos ativos",
  "IIP — Índ. de impacto",
  "Mandatos em atraso",
  "NPS das imersões",
  "Atingimento plan.",
  "Fatos geradores reg.",
];

describe("KpiRow (EST-08)", () => {
  it("EST-08 AC1: renderiza os 6 KPIs com os rótulos do spec", () => {
    render(<KpiRow kpi={KPI_COMPLETO} />);

    for (const rotulo of ROTULOS) {
      expect(screen.getByText(rotulo)).toBeInTheDocument();
    }
    // Seis tiles, um por KPI -- não cinco nem sete.
    expect(screen.getAllByRole("group")).toHaveLength(6);
  });

  it("EST-08 AC2 (lado presente): cada KPI com valor renderiza o número formatado em pt-BR", () => {
    render(<KpiRow kpi={KPI_COMPLETO} />);

    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("3,7")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("62,5")).toBeInTheDocument();
    // Atingimento é percentual e sai com o sinal.
    expect(screen.getByText("55,2%")).toBeInTheDocument();
    // Separador de milhar pt-BR.
    expect(screen.getByText("1.240")).toBeInTheDocument();
    // Nenhum travessão quando há dado nos seis.
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("EST-08 AC2 (lado ausente): KPI null renderiza '—', nunca zero inventado", () => {
    render(<KpiRow kpi={KPI_VAZIO} />);

    expect(screen.getAllByText("—")).toHaveLength(6);
    // O zero inventado é o risco que AD-005 nomeia: se algum null virar 0, a
    // faixa mente dizendo que mediu.
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    // Os rótulos continuam lá -- a faixa não some, ela declara a ausência.
    for (const rotulo of ROTULOS) {
      expect(screen.getByText(rotulo)).toBeInTheDocument();
    }
  });

  it("AD-005: zero medido renderiza '0' e continua distinto da ausência, na mesma faixa", () => {
    render(
      <KpiRow
        kpi={{
          ...KPI_VAZIO,
          // Contagens reais que deram zero -- informação, não ausência.
          mandatosEmAtraso: 0,
          nrFatosGeradores: 0,
        }}
      />
    );

    // Os dois zeros aparecem como número...
    expect(screen.getAllByText("0")).toHaveLength(2);
    // ...e os quatro KPIs sem dado seguem como travessão, lado a lado com eles.
    expect(screen.getAllByText("—")).toHaveLength(4);
  });

  it("a ausência é anunciada para leitor de tela, não só pela pontuação", () => {
    render(<KpiRow kpi={KPI_VAZIO} />);

    expect(screen.getAllByText("Sem dado suficiente")).toHaveLength(6);
  });

  it("Figma 44:227: atingimento com valor ganha barra de progresso proporcional", () => {
    render(<KpiRow kpi={KPI_COMPLETO} />);

    const barra = screen.getByRole("progressbar");
    expect(barra).toHaveAttribute("aria-valuenow", "55.2");
    expect(barra).toHaveAttribute("aria-valuemax", "100");
    // A largura acompanha o percentual em vez de ser decorativa.
    expect(barra.firstElementChild).toHaveStyle({ width: "55.2%" });
  });

  it("AD-005: atingimento ausente não desenha barra -- barra vazia diria '0% atingido'", () => {
    render(<KpiRow kpi={KPI_VAZIO} />);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
