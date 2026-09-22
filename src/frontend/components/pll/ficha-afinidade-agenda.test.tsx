import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FichaAfinidadeAgenda } from "./ficha-afinidade-agenda";

// Spec anchor: tasks.md T14 "Done when" (PLL-CP-16). AD-046: caminho feliz +
// estado vazio.
afterEach(cleanup);

describe("FichaAfinidadeAgenda", () => {
  // PLL-CP-16: as 4 notas 1-5 + chips de "outras pautas" selecionadas.
  it("exibe as 4 notas fixas e os chips de outras pautas selecionadas", () => {
    render(
      <FichaAfinidadeAgenda
        notaEducacao={5}
        notaSegurancaPublica={3}
        notaModernizacaoEstado={1}
        notaClima={4}
        outrasPautas={["Saúde", "Tecnologia"]}
        especifiquePauta="Mobilidade urbana"
      />
    );

    expect(screen.getByLabelText("Educação: nota 5 de 5")).toBeInTheDocument();
    expect(screen.getByLabelText("Segurança Pública: nota 3 de 5")).toBeInTheDocument();
    expect(screen.getByLabelText("Modernização do Estado: nota 1 de 5")).toBeInTheDocument();
    expect(screen.getByLabelText("Clima: nota 4 de 5")).toBeInTheDocument();
    expect(screen.getByText("Saúde")).toBeInTheDocument();
    expect(screen.getByText("Tecnologia")).toBeInTheDocument();
    expect(screen.getByText("Mobilidade urbana")).toBeInTheDocument();
  });

  // Estado vazio: nenhuma pauta informada.
  it("nenhuma pauta informada mostra o estado vazio", () => {
    render(
      <FichaAfinidadeAgenda
        notaEducacao={null}
        notaSegurancaPublica={null}
        notaModernizacaoEstado={null}
        notaClima={null}
        outrasPautas={[]}
        especifiquePauta={null}
      />
    );

    expect(screen.getByText("Nenhuma pauta prioritária informada")).toBeInTheDocument();
  });
});
