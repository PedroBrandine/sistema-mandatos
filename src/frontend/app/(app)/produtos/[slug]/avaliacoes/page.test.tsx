import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

// PF2-01 (.specs/features/pente-fino-2026-09-23/spec.md), AC1/AC2: acessar
// `/produtos/pll/avaliacoes` renderiza uma página (não 404), com aviso
// não-bloqueante de "em desenvolvimento". O chrome/aba destacada é
// responsabilidade de `ProdutoLayout`/`ProdutoShell` (não desta página) --
// aqui só se prova que a rota monta conteúdo em vez de estourar/ficar em branco.

import ProdutoAvaliacoesPage from "./page";

describe("/produtos/[slug]/avaliacoes", () => {
  afterEach(cleanup);

  it("renderiza o placeholder 'em desenvolvimento', sem 404 nem tela em branco", () => {
    render(<ProdutoAvaliacoesPage />);

    expect(screen.getByText("Avaliações em desenvolvimento")).toBeInTheDocument();
  });
});
