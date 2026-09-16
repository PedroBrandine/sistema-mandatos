import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P1: Barra de
// abas funcional da ficha" (Done-when da T23: as 4 rotas resolvem).
import ContratoGipPage from "./page";

afterEach(cleanup);

describe("/contratos/[id]/gip resolve (FMC-04)", () => {
  it("renderiza um placeholder explícito, nunca tela em branco", () => {
    render(<ContratoGipPage />);

    expect(screen.getByText("GIP em desenvolvimento")).toBeInTheDocument();
  });
});
