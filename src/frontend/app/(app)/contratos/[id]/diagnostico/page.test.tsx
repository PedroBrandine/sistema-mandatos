import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P1: Barra de
// abas funcional da ficha" AC6: "WHEN as abas 'Diagnóstico' ou 'Fatos
// Geradores e Registros' são abertas THEN o sistema SHALL renderizar
// <EmDesenvolvimento> com título próprio, nunca uma tela em branco."
import ContratoDiagnosticoPage from "./page";

afterEach(cleanup);

describe("/contratos/[id]/diagnostico resolve com <EmDesenvolvimento> (FMC-04 AC6)", () => {
  it("renderiza o placeholder com título próprio 'Diagnóstico'", () => {
    render(<ContratoDiagnosticoPage />);

    expect(screen.getByText("Diagnóstico")).toBeInTheDocument();
  });
});
