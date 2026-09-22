import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { CadeiaItem, TimelineItem } from "@backend/queries/incidencia";
import type { MapaContratos } from "@/lib/incidencia-contrato";

import { CadeiaLista } from "./cadeia-lista";
import { PainelDetalhe } from "./painel-detalhe";
import { TimelineFeed } from "./timeline-feed";

// Aba "Fatos Geradores" do produto: a lista mistura vários mandatos, então
// cada card da Linha do Tempo, o painel de detalhe e cada cadeia dizem de qual
// mandato é o item. Sem o mapa (aba do contrato), nada disso aparece.

afterEach(cleanup);

const CONTRATOS: MapaContratos = new Map([
  [7, { nome: "Dep. Ana Ribeiro", href: "/contratos/7/fatos-registros" }],
  [8, { nome: "Sen. Bruno Lima · Projeto Alfa", href: "/contratos/8/fatos-registros" }],
]);

const ITENS: TimelineItem[] = [
  { tipo: "insight", idOrigem: 1, titulo: "Insight da Ana", dataEvento: "2026-09-05", criadoEm: null, idUsuarioAutor: null, nomeAutor: null, idContrato: 7 },
  { tipo: "insight", idOrigem: 2, titulo: "Insight do Bruno", dataEvento: "2026-09-04", criadoEm: null, idUsuarioAutor: null, nomeAutor: null, idContrato: 8 },
];

const INSIGHTS = [
  { idInsight: 1, conteudo: "Insight da Ana", pilar: null, ocorridoEm: "2026-09-05" },
  { idInsight: 2, conteudo: "Insight do Bruno", pilar: null, ocorridoEm: "2026-09-04" },
];

function renderFeed(contratos?: MapaContratos) {
  render(
    <TimelineFeed
      itens={ITENS}
      registros={[]}
      insights={INSIGHTS}
      fatosGeradores={[]}
      preInsights={[]}
      contratos={contratos}
    />
  );
}

describe("TimelineFeed — identificação do mandato", () => {
  it("cada card mostra o mandato do próprio item", () => {
    renderFeed(CONTRATOS);

    expect(screen.getByRole("button", { name: /Insight da Ana/ })).toHaveTextContent("Dep. Ana Ribeiro");
    expect(screen.getByRole("button", { name: /Insight do Bruno/ })).toHaveTextContent("Sen. Bruno Lima · Projeto Alfa");
  });

  it("sem o mapa de contratos (aba do contrato), nenhum mandato é exibido", () => {
    renderFeed();

    expect(screen.queryByText("Dep. Ana Ribeiro")).not.toBeInTheDocument();
  });

  it("selecionar um item mostra o mandato no painel, com link para a ficha", () => {
    renderFeed(CONTRATOS);

    fireEvent.click(screen.getByRole("button", { name: /Insight do Bruno/ }));

    const link = screen.getByRole("link", { name: "Abrir ficha" });
    expect(link).toHaveAttribute("href", "/contratos/8/fatos-registros");
  });
});

describe("PainelDetalhe — mandato", () => {
  const item: TimelineItem = ITENS[0];

  it("sem `contrato`, não há link para a ficha", () => {
    render(<PainelDetalhe item={item} insight={INSIGHTS[0]} />);

    expect(screen.queryByRole("link", { name: "Abrir ficha" })).not.toBeInTheDocument();
  });
});

describe("CadeiaLista — identificação do mandato", () => {
  const CADEIAS: CadeiaItem[] = [
    { idFatoGerador: 1, titulo: "Fato da Ana", situacao: "realizado", dataEvento: "2026-09-01", chaveOrigem: "insight:10", idContrato: 7 },
    { idFatoGerador: 2, titulo: "Fato do Bruno", situacao: "realizado", dataEvento: "2026-09-02", chaveOrigem: "insight:20", idContrato: 8 },
  ];

  it("cada cadeia diz de qual mandato é", () => {
    render(<CadeiaLista cadeias={CADEIAS} contratos={CONTRATOS} />);

    expect(screen.getByText("Dep. Ana Ribeiro")).toBeInTheDocument();
    expect(screen.getByText("Sen. Bruno Lima · Projeto Alfa")).toBeInTheDocument();
  });

  it("sem o mapa de contratos, a cadeia não mostra mandato", () => {
    render(<CadeiaLista cadeias={CADEIAS} />);

    expect(screen.queryByText("Dep. Ana Ribeiro")).not.toBeInTheDocument();
  });
});
