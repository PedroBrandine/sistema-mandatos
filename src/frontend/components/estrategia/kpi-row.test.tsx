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
  npsMedio: 62.5,
  pctAtingimentoMedio: 55.2,
  nrFatosGeradores: 1240,
  mandatosAtrasoAtrasados: 4,
  mandatosAtrasoAtencao: 3,
  mandatosAtrasoNormal: 18,
  componenteD1Medio: 1.4,
  componenteD2Medio: 1.6,
  componenteD3Medio: 0.7,
};

const KPI_VAZIO: EstrategiaKpi = {
  mandatosAtivos: null,
  iipMedio: null,
  npsMedio: null,
  pctAtingimentoMedio: null,
  nrFatosGeradores: null,
  mandatosAtrasoAtrasados: null,
  mandatosAtrasoAtencao: null,
  mandatosAtrasoNormal: null,
  componenteD1Medio: null,
  componenteD2Medio: null,
  componenteD3Medio: null,
};

// Grafia do Figma 44:227 (caixa alta vem do CSS, não do texto). São 5 desde
// AD-050, que removeu o card "Mandatos em atraso" -- o mesmo conjunto que o
// Figma 44:227 já desenhava.
const ROTULOS = [
  "Mandatos ativos",
  "IIP — Índ. de impacto",
  "NPS das imersões",
  "Atingimento plan.",
  "Fatos geradores reg.",
];

describe("KpiRow (EST-08 / AD-050)", () => {
  it("KSM-01: renderiza os 5 KPIs com os rótulos do spec", () => {
    render(<KpiRow kpi={KPI_COMPLETO} />);

    for (const rotulo of ROTULOS) {
      expect(screen.getByText(rotulo)).toBeInTheDocument();
    }
    // Cinco tiles, um por KPI -- não quatro nem seis.
    expect(screen.getAllByRole("group")).toHaveLength(5);
  });

  it("KSM-01: o card 'Mandatos em atraso' não existe mais na faixa", () => {
    render(<KpiRow kpi={KPI_COMPLETO} />);

    expect(screen.queryByText("Mandatos em atraso")).not.toBeInTheDocument();
  });

  it("EST-08 AC2 (lado presente): cada KPI com valor renderiza o número formatado em pt-BR", () => {
    render(<KpiRow kpi={KPI_COMPLETO} />);

    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("3,7")).toBeInTheDocument();
    expect(screen.getByText("62,5")).toBeInTheDocument();
    // Atingimento é percentual e sai com o sinal.
    expect(screen.getByText("55,2%")).toBeInTheDocument();
    // Separador de milhar pt-BR.
    expect(screen.getByText("1.240")).toBeInTheDocument();
    // Nenhum travessão quando há dado nos cinco.
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("EST-08 AC2 (lado ausente): KPI null renderiza '—', nunca zero inventado", () => {
    render(<KpiRow kpi={KPI_VAZIO} />);

    // Os 5 números grandes (Mandatos ativos, IIP, NPS, Atingimento, Fatos).
    // As 3 linhas da quebra não entram nesta contagem: cada uma é um nó de
    // texto misto ("— atrasados"), que texto exato não casa -- elas são
    // cobertas pelo teste de ausência independente por linha, mais abaixo.
    expect(screen.getAllByText("—")).toHaveLength(5);
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
          mandatosAtivos: 0,
          nrFatosGeradores: 0,
        }}
      />
    );

    // Os dois zeros aparecem como número...
    expect(screen.getAllByText("0")).toHaveLength(2);
    // ...e os três KPIs sem dado seguem como travessão, lado a lado com eles.
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  it("a ausência é anunciada para leitor de tela, não só pela pontuação", () => {
    render(<KpiRow kpi={KPI_VAZIO} />);

    // Os 5 números grandes + as 3 linhas da quebra, cada uma com seu próprio
    // anúncio independente.
    expect(screen.getAllByText("Sem dado suficiente")).toHaveLength(8);
  });

  // AD-064 (.specs/STATE.md): mesmo detalhe por dimensão do IipCard, agora na
  // média do recorte -- reusa DimensoesIip (components/incidencia).
  it("AD-064: IIP com dado mostra o detalhe por dimensão D1/D2/D3", () => {
    render(<KpiRow kpi={KPI_COMPLETO} />);

    expect(screen.getByText("D1")).toBeInTheDocument();
    expect(screen.getByText("D2")).toBeInTheDocument();
    expect(screen.getByText("D3")).toBeInTheDocument();
    expect(screen.getByText("1,4")).toBeInTheDocument();
    expect(screen.getByText("1,6")).toBeInTheDocument();
    expect(screen.getByText("0,7")).toBeInTheDocument();
  });

  it("AD-064: IIP sem dado não mostra o detalhe por dimensão", () => {
    render(<KpiRow kpi={KPI_VAZIO} />);

    expect(screen.queryByText("D1")).not.toBeInTheDocument();
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

  // Figma 86:44, agora no card "Mandatos ativos" (AD-050). As 3 linhas
  // renderizam número real, cada uma independente das outras, e somam o
  // número grande (4 + 3 + 18 = 25) -- o fechamento que a view garante
  // (KSM-03) e que este card existe para mostrar.
  it("KSM-02/KSM-03: Mandatos ativos renderiza o total e os 3 números da quebra que o decompõem", () => {
    render(<KpiRow kpi={KPI_COMPLETO} />);

    // Cada linha ("— rótulo" ou "N rótulo") é um único nó de texto misto na
    // mesma <span> (getByText de string exata não enxerga um número isolado
    // ali) -- por isso a asserção é toHaveTextContent (substring) sobre a
    // linha inteira, achada pelo rótulo.
    expect(screen.getByText(/atrasados/)).toHaveTextContent("4");
    expect(screen.getByText(/atenção/)).toHaveTextContent("3");
    expect(screen.getByText(/normal/)).toHaveTextContent("18");
    // O total é nó isolado (sem rótulo ao lado) -- casável por texto exato.
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("AD-005: cada linha da quebra por status declara ausência de forma independente -- um '—' não contamina as outras 2 linhas", () => {
    render(
      <KpiRow
        kpi={{
          ...KPI_COMPLETO,
          // Limiar de 'atrasado' desligado (ref_limiar_pendencia.ativo =
          // false): a coluna vem NULL, não 0 -- as outras 2 continuam com
          // número real na MESMA faixa.
          mandatosAtrasoAtrasados: null,
        }}
      />
    );

    expect(screen.getByText(/atenção/)).toHaveTextContent("3");
    expect(screen.getByText(/normal/)).toHaveTextContent("18");
    // Só a linha de "atrasados" mostra "—" -- as outras duas, no mesmo card,
    // continuam com número real.
    expect(screen.getByText(/atrasados/)).toHaveTextContent("—");
  });

  // Ajuste de fidelidade visual, 2026-09-14 (Figma 44:53). vw_estrategia_kpi
  // não expõe segmentação promotor/neutro/detrator nem contagem de
  // avaliações -- só a média. A barra e o chip continuam no layout; a barra
  // não desenha proporção nenhuma (nem chuta uma distribuição) e o chip
  // declara ausência em vez de uma contagem forjada.
  it("Figma 44:53: NPS mostra a barra e o chip de avaliações mesmo sem a quebra (spec-precision gap)", () => {
    render(<KpiRow kpi={KPI_COMPLETO} />);

    expect(screen.getByText(/Promotores/)).toBeInTheDocument();
    expect(screen.getByText(/Neutros/)).toBeInTheDocument();
    expect(screen.getByText(/Detratores/)).toBeInTheDocument();
    // Duas ocorrências: o chip visível e o texto sr-only que explica a
    // ausência -- getAllByText em vez de getByText por causa disso.
    expect(screen.getAllByText(/avaliações/).length).toBeGreaterThan(0);
    // A média (62,5) segue vindo da view -- só a segmentação é que falta.
    expect(screen.getByText("62,5")).toBeInTheDocument();
  });
});
