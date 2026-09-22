import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FichaDadosTse } from "./ficha-dados-tse";

// Spec anchor: tasks.md T14 "Done when" (PLL-CP-14, PLL-CP-15). AD-046:
// caminho feliz de cada AC + estado vazio.
afterEach(cleanup);

describe("FichaDadosTse", () => {
  // PLL-CP-15: não vinculado mostra estado vazio com atalho.
  it("participante não vinculado mostra 'Ainda não vinculado ao TSE' com atalho", () => {
    const onVincular = vi.fn();
    render(<FichaDadosTse vinculadoTse={false} candidaturas={[]} onVincular={onVincular} />);

    expect(screen.getByText("Ainda não vinculado ao TSE")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Vincular ao TSE" }));
    expect(onVincular).toHaveBeenCalledTimes(1);
  });

  // PLL-CP-14: vinculado exibe Situação Eleitoral, Coligação, Votos
  // Recebidos e Evolução de Votos por ano -- sem os 3 campos do D-2.
  it("participante vinculado exibe Situação Eleitoral, Coligação e Votos Recebidos por ano", () => {
    render(
      <FichaDadosTse
        vinculadoTse
        candidaturas={[
          { anoEleicao: 2022, situacaoEleitoral: "Eleito", coligacao: "Coligação Exemplo", votosRecebidos: 45000 },
          { anoEleicao: 2018, situacaoEleitoral: "Não eleito", coligacao: null, votosRecebidos: 12000 },
        ]}
      />
    );

    expect(screen.getAllByText("2022").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Eleito")).toBeInTheDocument();
    expect(screen.getByText("Coligação Exemplo")).toBeInTheDocument();
    expect(screen.getByText("45.000")).toBeInTheDocument();
    // Evolução de votos: os 2 anos aparecem na lista.
    expect(screen.getByText("Evolução de Votos")).toBeInTheDocument();
    expect(screen.getByText("12.000 votos")).toBeInTheDocument();
    // D-2: nenhum dos 3 campos inexistentes no espelho aparece na tela.
    expect(screen.queryByText(/Número do Candidato/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Classificação na Lista/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Despesa de Campanha/i)).not.toBeInTheDocument();
  });

  // AD-005: campo ausente vira "—", nunca em branco.
  it("coligação ausente vira '—'", () => {
    render(
      <FichaDadosTse
        vinculadoTse
        candidaturas={[{ anoEleicao: 2022, situacaoEleitoral: null, coligacao: null, votosRecebidos: 0 }]}
      />
    );
    const tracos = screen.getAllByText("—");
    expect(tracos.length).toBeGreaterThanOrEqual(2);
  });
});
