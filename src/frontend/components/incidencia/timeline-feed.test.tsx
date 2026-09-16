import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TimelineItem } from "@backend/queries/incidencia";

import { TimelineFeed } from "./timeline-feed";

// Spec anchor: .specs/features/fatos-geradores-ciclo-vida/spec.md, "P1: Linha
// do Tempo" AC1-AC9. AD-042 integral.

afterEach(cleanup);

const ITENS: TimelineItem[] = [
  { tipo: "registro", idOrigem: 1, titulo: "Registro de setembro", dataEvento: "2026-09-05", criadoEm: null, idUsuarioAutor: 9 },
  { tipo: "insight", idOrigem: 2, titulo: "Insight de agosto", dataEvento: "2026-08-20", criadoEm: null, idUsuarioAutor: 9 },
  {
    tipo: "fato_gerador",
    idOrigem: 3,
    titulo: null,
    dataEvento: "2026-09-10",
    criadoEm: null,
    idUsuarioAutor: 9,
  },
];

const FATO_SEM_ORIGEM = {
  idFatoGerador: 3,
  tipologia: "2. Produção Legislativa · Projeto de lei / proposição · Em tramitação ativa",
  niveis: { d1: "baixo", d2: null, d3: null },
  titulo: null,
  situacao: "realizado" as const,
  dtOcorrencia: "2026-09-10",
  dtPrevista: null,
};

function renderFeed(itens: TimelineItem[] = ITENS, onEditar?: (item: TimelineItem) => void) {
  render(
    <TimelineFeed
      itens={itens}
      registros={[{ idRegistro: 1, tipoRegistro: "Pontapé", ocorridoEm: "2026-09-05", resumo: null, nomeAutor: "Ana" }]}
      insights={[{ idInsight: 2, conteudo: "Conteúdo", pilar: "Incidência política", ocorridoEm: "2026-08-20" }]}
      fatosGeradores={[FATO_SEM_ORIGEM]}
      preInsights={[]}
      onEditar={onEditar}
    />
  );
}

describe("TimelineFeed — filtro por tipo (spec.md AC2)", () => {
  it("desmarcar 'Registro' oculta só os registros, mantendo a ordem dos demais", () => {
    renderFeed();

    expect(screen.getByText("Registro de setembro")).toBeInTheDocument();
    expect(screen.getByText("Insight de agosto")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Registro"));

    expect(screen.queryByText("Registro de setembro")).not.toBeInTheDocument();
    // O Fato Gerador de setembro (10/09) continua visível -- só o Registro
    // (05/09) some, o resto mantém posição e ordem.
    expect(screen.getByText("10/09/2026")).toBeInTheDocument();
    const setembro = screen.getByText("Setembro de 2026");
    const agosto = screen.getByText("Agosto de 2026");
    expect(setembro.compareDocumentPosition(agosto) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("TimelineFeed — filtro por período (spec.md AC3)", () => {
  it("período sem itens exibe estado vazio explícito, não lista vazia -- lado oposto", () => {
    renderFeed();

    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2027-01-01" } });

    expect(screen.getByText("Nenhum item no período")).toBeInTheDocument();
    expect(screen.queryByText("Registro de setembro")).not.toBeInTheDocument();
  });

  it("período que cobre os itens continua exibindo a lista -- lado oposto do vazio", () => {
    renderFeed();

    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-08-01" } });
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-09-30" } });

    expect(screen.getByText("Registro de setembro")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum item no período")).not.toBeInTheDocument();
  });
});

describe("TimelineFeed — fato sem origem (spec.md AC8, reincidência catalogada)", () => {
  it("fato sem origem aparece na timeline sem nenhuma marca de falha", () => {
    renderFeed();

    expect(screen.queryByText(/Não Conectado/i)).not.toBeInTheDocument();
  });
});

describe("TimelineFeed — data sem hora (spec.md AC5/FGC-12)", () => {
  it("data de ocorrência aparece como dd/mm/aaaa, sem hora, nos cards da lista", () => {
    renderFeed();
    expect(screen.getByText("05/09/2026")).toBeInTheDocument();
  });
});

describe("TimelineFeed — seleção mostra detalhe no painel", () => {
  it("clicar num item mostra seus atributos de classificação no painel (AC4)", () => {
    renderFeed();

    fireEvent.click(screen.getByRole("button", { name: /Insight de agosto/ }));

    expect(screen.getByText("Incidência política")).toBeInTheDocument();
  });
});

describe("TimelineFeed — Editar repassado ao PainelDetalhe (fix task pós-T25, spec.md AC2)", () => {
  it("selecionar um Insight e clicar Editar aciona onEditar com o item certo", () => {
    const onEditar = vi.fn();
    renderFeed(ITENS, onEditar);

    fireEvent.click(screen.getByRole("button", { name: /Insight de agosto/ }));
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    expect(onEditar).toHaveBeenCalledWith(ITENS[1]);
  });

  it("selecionar um Fato Gerador NÃO mostra Editar -- lado oposto (sem edição pronta ainda)", () => {
    const onEditar = vi.fn();
    renderFeed(ITENS, onEditar);

    fireEvent.click(screen.getByRole("button", { name: /10\/09\/2026/ }));

    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });
});
