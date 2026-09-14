import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FiltroDashboard } from "./filtro-dashboard";

// Ajuste de fidelidade visual, 2026-09-14 (Figma 44:29 "filter-bar").
// Componente presentational novo -- mesmo espírito de teste de
// filtros-mandatos.test.tsx: cobre o que a interação do Select permite
// verificar sem simular abrir o dropdown do Radix (não testado em nenhum dos
// componentes já existentes que usam <Select> nesta base).
afterEach(cleanup);

const OPCOES = {
  gestoras: [{ id: 1, nome: "Gestora Um" }],
  projetos: [{ id: 10, nome: "Projeto Alfa" }],
};

describe("FiltroDashboard", () => {
  it("mostra os placeholders quando nenhum filtro está aplicado", () => {
    render(<FiltroDashboard filtro={{}} onChange={vi.fn()} {...OPCOES} />);

    expect(screen.getByText("Filtrar por gestora")).toBeInTheDocument();
    expect(screen.getByText("Filtrar por projeto")).toBeInTheDocument();
  });

  it("mostra o nome já selecionado quando o filtro chega com gestora/projeto aplicados", () => {
    render(<FiltroDashboard filtro={{ idGestora: 1, idProjeto: 10 }} onChange={vi.fn()} {...OPCOES} />);

    expect(screen.getByText("Gestora Um")).toBeInTheDocument();
    expect(screen.getByText("Projeto Alfa")).toBeInTheDocument();
  });
});
