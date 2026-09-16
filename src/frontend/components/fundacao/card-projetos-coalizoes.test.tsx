import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CardProjetosCoalizoes } from "./card-projetos-coalizoes";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P1: Informações
// Gerais do mandato" AC9 (FMC-13). Cores confirmadas com a skill
// figma-dominio-legisla: "Coalizões → Roxo" (docs/Identidade Visual
// Legisla.md), `--chart-5` (#BA6BED).

afterEach(cleanup);

describe("CardProjetosCoalizoes — estado vazio e com vínculo (AC9)", () => {
  it("sem projeto e sem coalizão, renderiza <EstadoVazio>", () => {
    render(<CardProjetosCoalizoes projeto={null} coalizoes={[]} />);

    expect(screen.getByText("Nenhum projeto ou coalizão vinculado")).toBeInTheDocument();
  });

  it("com projeto e coalizões vinculados, renderiza a lista -- lado oposto", () => {
    render(
      <CardProjetosCoalizoes
        projeto={{ idProjeto: 5, nome: "Projeto Alfa" }}
        coalizoes={[{ idCoalizao: 7, nome: "Coalizão Verde" }]}
      />
    );

    expect(screen.getByText("Projeto Alfa")).toBeInTheDocument();
    expect(screen.getByText("Coalizão Verde")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum projeto ou coalizão vinculado")).not.toBeInTheDocument();
  });
});

describe("CardProjetosCoalizoes — badge de tipo conforme a origem", () => {
  it("projeto ganha o badge 'Projeto'", () => {
    render(<CardProjetosCoalizoes projeto={{ idProjeto: 5, nome: "Projeto Alfa" }} coalizoes={[]} />);

    expect(screen.getByText("Projeto")).toBeInTheDocument();
    expect(screen.queryByText("Coalizão")).not.toBeInTheDocument();
  });

  it("coalizão ganha o badge 'Coalizão', na cor roxa da codificação de produto (#BA6BED, chart-5)", () => {
    render(<CardProjetosCoalizoes projeto={null} coalizoes={[{ idCoalizao: 7, nome: "Coalizão Verde" }]} />);

    const badge = screen.getByText("Coalizão");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/bg-chart-5/);
    expect(screen.queryByText("Projeto")).not.toBeInTheDocument();
  });

  it("mais de uma coalizão vinculada renderiza um badge por coalizão", () => {
    render(
      <CardProjetosCoalizoes
        projeto={null}
        coalizoes={[
          { idCoalizao: 7, nome: "Coalizão Verde" },
          { idCoalizao: 8, nome: "Coalizão Azul" },
        ]}
      />
    );

    expect(screen.getAllByText("Coalizão")).toHaveLength(2);
    expect(screen.getByText("Coalizão Verde")).toBeInTheDocument();
    expect(screen.getByText("Coalizão Azul")).toBeInTheDocument();
  });
});
