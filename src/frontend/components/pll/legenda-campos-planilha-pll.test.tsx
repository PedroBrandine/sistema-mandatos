import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

// Pedro, 23/09: "cola" dos campos da planilha -- reaproveita MAPA_CABECALHOS
// (fonte única do parser, cadastro-participante-pll.ts) pra listar
// cabeçalho -> campo gravado. Guarda de regressão real: se um cabeçalho do
// GRUPOS local (duplicado só pra agrupamento visual) sair de sincronia com
// MAPA_CABECALHOS, o campo mapeado renderiza "undefined" silenciosamente na
// tela -- este teste prova que isso não acontece hoje.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
  (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver ?? ResizeObserverStub;
if (!Element.prototype.hasPointerCapture) {
  (Element.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
}

import { LegendaCamposPlanilhaPll } from "./legenda-campos-planilha-pll";

afterEach(cleanup);

describe("LegendaCamposPlanilhaPll", () => {
  it("abre o popover e mostra os 3 grupos do Anexo A com o campo mapeado de cada cabeçalho (sem 'undefined')", () => {
    render(<LegendaCamposPlanilhaPll />);

    fireEvent.click(screen.getByRole("button", { name: "Ver mapa de campos da planilha" }));

    expect(screen.getByText("Dados pessoais (mentorado/assessor)")).toBeInTheDocument();
    expect(screen.getByText("Dados do mandato (autodeclarados -- usados no match com o TSE)")).toBeInTheDocument();
    expect(screen.getByText("Pautas prioritárias")).toBeInTheDocument();

    // Um representante de cada grupo, provando o mapeamento real (não um valor solto).
    expect(screen.getByText("Nome Completo")).toBeInTheDocument();
    expect(screen.getByText("nome_completo")).toBeInTheDocument();
    expect(screen.getByText("Cargos anteriores")).toBeInTheDocument();
    expect(screen.getByText("cargos_anteriores")).toBeInTheDocument();
    expect(screen.getByText("Especifique a pauta")).toBeInTheDocument();
    expect(screen.getByText("especifique_pauta")).toBeInTheDocument();

    expect(screen.queryByText("undefined")).not.toBeInTheDocument();
  });
});
