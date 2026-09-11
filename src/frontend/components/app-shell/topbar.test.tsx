import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Topbar } from "./topbar";

// Spec anchor: redesenho-estrategia-tela-first / EST-05 (T10, AD-046 -- tela
// de leitura, caminho feliz + a asserção negativa explícita que o próprio
// Done-when da task exige).
afterEach(cleanup);

describe("Topbar (EST-05)", () => {
  it("renderiza marca, link Hub e avatar (AC1)", () => {
    render(<Topbar />);

    expect(screen.getByText("Legisla Brasil")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /hub/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("nao renderiza 'Gestao de Usuarios' (AC2)", () => {
    render(<Topbar />);

    expect(screen.queryByText("Gestão de Usuários")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /gest.o de usu.rios/i })).not.toBeInTheDocument();
  });
});
