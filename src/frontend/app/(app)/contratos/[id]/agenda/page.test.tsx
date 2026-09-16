import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P1: Barra de
// abas funcional da ficha" AC6 (por analogia -- a AC cobre Diagnóstico e
// Fatos Geradores, mas a mesma exigência "nunca tela em branco" vale para
// toda aba sem conteúdo ainda). Done-when da T23: as 4 rotas resolvem.
import ContratoAgendaPage from "./page";

afterEach(cleanup);

describe("/contratos/[id]/agenda resolve (FMC-04)", () => {
  it("renderiza um placeholder explícito, nunca tela em branco", () => {
    render(<ContratoAgendaPage />);

    expect(screen.getByText("Agenda em desenvolvimento")).toBeInTheDocument();
  });
});
