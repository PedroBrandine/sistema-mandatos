import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P1: Barra de
// abas funcional da ficha" AC6/AC7: título próprio "Fatos Geradores e
// Registros" -- mesmo rótulo exato da barra (ficha-contrato-chrome.tsx),
// nunca uma tela em branco.
import ContratoFatosRegistrosPage from "./page";

afterEach(cleanup);

describe("/contratos/[id]/fatos-registros resolve com <EmDesenvolvimento> (FMC-04 AC6/AC7)", () => {
  it("renderiza o placeholder com título próprio 'Fatos Geradores e Registros'", () => {
    render(<ContratoFatosRegistrosPage />);

    expect(screen.getByText("Fatos Geradores e Registros")).toBeInTheDocument();
  });
});
