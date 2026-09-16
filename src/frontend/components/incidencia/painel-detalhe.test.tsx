import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PainelDetalhe } from "./painel-detalhe";

// Spec anchor: .specs/features/fatos-geradores-ciclo-vida/spec.md, "P1: Linha
// do Tempo" AC4 (atributos de classificação quando é Fato Gerador), AC5
// (data sem hora), AC6 (tipo de Registro de ref_tipo_registro), AC7 (Pilar
// dos 4 de ref_pilar_insight), AC8 (fato sem origem sem marca de falha).
// AD-042 integral.

afterEach(cleanup);

describe("PainelDetalhe — estado vazio", () => {
  it("sem item selecionado, mostra mensagem de seleção", () => {
    render(<PainelDetalhe item={null} />);
    expect(screen.getByText(/Selecione um item da linha do tempo/i)).toBeInTheDocument();
  });
});

describe("PainelDetalhe — Registro", () => {
  it("mostra tipo de registro (ref_tipo_registro), autor e resumo", () => {
    render(
      <PainelDetalhe
        item={{ tipo: "registro", idOrigem: 1, titulo: "Reunião com liderança", dataEvento: "2026-09-05", criadoEm: null, idUsuarioAutor: 9 }}
        registro={{ idRegistro: 1, tipoRegistro: "Pontapé", ocorridoEm: "2026-09-05", resumo: "Alinhamento inicial", nomeAutor: "Ana" }}
      />
    );

    expect(screen.getByText("Pontapé")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Alinhamento inicial")).toBeInTheDocument();
    // Reincidência catalogada: nunca "Reunião"/"Ofício"/"Nota de Reunião" como tipo.
    expect(screen.queryByText("Reunião")).not.toBeInTheDocument();
  });
});

describe("PainelDetalhe — Insight", () => {
  it("mostra Pilar (um dos 4 de ref_pilar_insight), nunca 'Financeiro'", () => {
    render(
      <PainelDetalhe
        item={{ tipo: "insight", idOrigem: 2, titulo: "Insight sobre pauta", dataEvento: "2026-09-06", criadoEm: null, idUsuarioAutor: 9 }}
        insight={{ idInsight: 2, conteudo: "Conteúdo do insight", pilar: "Incidência política", ocorridoEm: "2026-09-06" }}
      />
    );

    expect(screen.getByText("Incidência política")).toBeInTheDocument();
    expect(screen.queryByText(/Financeiro/i)).not.toBeInTheDocument();
  });
});

describe("PainelDetalhe — Fato Gerador", () => {
  it("mostra tipologia, situação e a régua de 4 níveis SEM legenda descritiva", () => {
    render(
      <PainelDetalhe
        item={{ tipo: "fato_gerador", idOrigem: 3, titulo: "Aprovação do PL", dataEvento: "2026-09-10", criadoEm: null, idUsuarioAutor: 9 }}
        fatoGerador={{
          idFatoGerador: 3,
          tipologia: "2. Produção Legislativa · Projeto de lei / proposição · Em tramitação ativa",
          niveis: { d1: "Baixo", d2: "Médio", d3: "Médio" },
          titulo: "Aprovação do PL",
          situacao: "realizado",
          dtOcorrencia: "2026-09-10",
          dtPrevista: null,
        }}
      />
    );

    expect(screen.getByText(/Nível D1: Baixo/)).toBeInTheDocument();
    expect(screen.getByText(/Nível D2: Médio/)).toBeInTheDocument();
    expect(screen.getByText(/Nível D3: Médio/)).toBeInTheDocument();
    // Reincidência catalogada: sem legenda descritiva (ex.: "Grau de Impacto").
    expect(screen.queryByText(/Grau de Impacto/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Urgência Política/i)).not.toBeInTheDocument();
    expect(screen.getByText("Realizado")).toBeInTheDocument();
  });

  it("fato projetado mostra PROJETADO -- lado oposto", () => {
    render(
      <PainelDetalhe
        item={{ tipo: "fato_gerador", idOrigem: 4, titulo: "Votação futura", dataEvento: "2026-11-01", criadoEm: null, idUsuarioAutor: 9 }}
        fatoGerador={{
          idFatoGerador: 4,
          tipologia: "2. Produção Legislativa · Projeto de lei / proposição · Em tramitação ativa",
          niveis: { d1: "Baixo", d2: null, d3: null },
          titulo: "Votação futura",
          situacao: "projetado",
          dtOcorrencia: null,
          dtPrevista: "2026-11-01",
        }}
      />
    );

    expect(screen.getByText("PROJETADO")).toBeInTheDocument();
    expect(screen.getByText(/Nível D2: —/)).toBeInTheDocument();
  });
});

describe("PainelDetalhe — data sem hora (FGC-12)", () => {
  it("formata a data como dd/mm/aaaa, sem hora", () => {
    render(
      <PainelDetalhe
        item={{ tipo: "registro", idOrigem: 5, titulo: "Registro", dataEvento: "2026-09-05", criadoEm: "2026-09-05T14:30:00Z", idUsuarioAutor: 9 }}
        registro={{ idRegistro: 5, tipoRegistro: "Sprint", ocorridoEm: "2026-09-05", resumo: null, nomeAutor: "Ana" }}
      />
    );

    expect(screen.getByText("05/09/2026")).toBeInTheDocument();
    expect(screen.queryByText(/14:30/)).not.toBeInTheDocument();
  });
});
