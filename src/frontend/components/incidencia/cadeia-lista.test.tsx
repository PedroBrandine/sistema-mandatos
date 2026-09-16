import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { CadeiaItem } from "@backend/queries/incidencia";

import { CadeiaLista } from "./cadeia-lista";

// Spec anchor: .specs/features/fatos-geradores-ciclo-vida/spec.md, "P2:
// Ciclo de Vida com cadeias" AC1-AC5.

afterEach(cleanup);

describe("CadeiaLista — estado vazio", () => {
  it("sem cadeias, mostra EstadoVazio explícito", () => {
    render(<CadeiaLista cadeias={[]} />);
    expect(screen.getByText("Nenhuma cadeia ainda")).toBeInTheDocument();
  });
});

describe("CadeiaLista — origem comum (spec.md AC3)", () => {
  it("dois fatos com a mesma origem aparecem juntos, marcados 'Origem comum'", () => {
    const cadeias: CadeiaItem[] = [
      { idFatoGerador: 1, titulo: "Fato A", situacao: "realizado", dataEvento: "2026-09-01", chaveOrigem: "insight:5" },
      { idFatoGerador: 2, titulo: "Fato B", situacao: "realizado", dataEvento: "2026-09-02", chaveOrigem: "insight:5" },
    ];
    render(<CadeiaLista cadeias={cadeias} />);

    expect(screen.getByText("Origem comum")).toBeInTheDocument();
    expect(screen.getByText("Fato A")).toBeInTheDocument();
    expect(screen.getByText("Fato B")).toBeInTheDocument();
  });

  it("cadeia direta no fato (1 elemento) NÃO mostra marca de incompletude -- lado oposto", () => {
    const cadeias: CadeiaItem[] = [
      { idFatoGerador: 3, titulo: "Fato solo", situacao: "realizado", dataEvento: "2026-09-03", chaveOrigem: "fato:3" },
    ];
    render(<CadeiaLista cadeias={cadeias} />);

    expect(screen.getByText("Fato solo")).toBeInTheDocument();
    expect(screen.queryByText("Origem comum")).not.toBeInTheDocument();
    expect(screen.queryByText(/incompleta/i)).not.toBeInTheDocument();
  });
});

describe("CadeiaLista — cadeia só-projetada (spec.md AC5)", () => {
  it("cadeia com só fatos projetados vai para a seção 'Cadeia Projetada (em análise)'", () => {
    const cadeias: CadeiaItem[] = [
      { idFatoGerador: 4, titulo: "Fato projetado", situacao: "projetado", dataEvento: "2026-11-01", chaveOrigem: "fato:4" },
    ];
    render(<CadeiaLista cadeias={cadeias} />);

    expect(screen.getByText("Cadeia Projetada (em análise)")).toBeInTheDocument();
    expect(screen.getByText("Fato projetado")).toBeInTheDocument();
  });

  it("cadeia com fato realizado NÃO cai na seção de projetadas -- lado oposto", () => {
    const cadeias: CadeiaItem[] = [
      { idFatoGerador: 5, titulo: "Fato realizado", situacao: "realizado", dataEvento: "2026-09-05", chaveOrigem: "fato:5" },
    ];
    render(<CadeiaLista cadeias={cadeias} />);

    expect(screen.queryByText("Cadeia Projetada (em análise)")).not.toBeInTheDocument();
  });
});

describe("CadeiaLista — rótulo posicional (AD-053)", () => {
  it("cadeias são rotuladas 'Cadeia A', 'Cadeia B' pela ordem, nunca por um campo do dado", () => {
    const cadeias: CadeiaItem[] = [
      { idFatoGerador: 1, titulo: "Primeira", situacao: "realizado", dataEvento: "2026-09-01", chaveOrigem: "fato:1" },
      { idFatoGerador: 2, titulo: "Segunda", situacao: "realizado", dataEvento: "2026-09-02", chaveOrigem: "fato:2" },
    ];
    render(<CadeiaLista cadeias={cadeias} />);

    expect(screen.getByText("Cadeia A")).toBeInTheDocument();
    expect(screen.getByText("Cadeia B")).toBeInTheDocument();
  });
});
