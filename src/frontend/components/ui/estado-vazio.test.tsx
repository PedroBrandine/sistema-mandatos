import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EstadoVazio } from "./estado-vazio";

// Spec anchor: redesenho-estrategia-tela-first / EST-01 (AD-042).
// Smoke test do harness de componente: prova que `.test.tsx` é coletado, que a
// renderização acontece via @testing-library/react em `jsdom`, e que remover um
// elemento renderizado de `estado-vazio.tsx` derruba o gate (EST-01 AC3).
afterEach(cleanup);

describe("EstadoVazio (harness de componente — EST-01)", () => {
  it("renderiza no DOM do jsdom via @testing-library/react (AC2)", () => {
    render(<EstadoVazio titulo="Nenhum mandato" />);

    expect(document.defaultView?.navigator.userAgent).toContain("jsdom");
    expect(screen.getByText("Nenhum mandato")).toBeInTheDocument();
  });

  it("exibe o titulo recebido (AC3 — remover o <p> do titulo derruba este teste)", () => {
    render(<EstadoVazio titulo="Nenhum contrato nesta etapa" />);

    expect(screen.getByText("Nenhum contrato nesta etapa")).toBeInTheDocument();
  });

  it("exibe a mensagem recebida quando informada (AC3)", () => {
    render(
      <EstadoVazio titulo="Nenhum mandato" mensagem="Cadastre o primeiro mandato." />,
    );

    expect(screen.getByText("Cadastre o primeiro mandato.")).toBeInTheDocument();
  });

  it("sem mensagem, exibe o texto padrao do componente (AC3)", () => {
    render(<EstadoVazio titulo="Nenhum mandato" />);

    expect(
      screen.getByText(
        "Esta área ainda não possui dados ou está em fase de construção.",
      ),
    ).toBeInTheDocument();
  });

  it("renderiza a acao recebida e a omite quando ausente (AC3)", () => {
    const { unmount } = render(
      <EstadoVazio titulo="Nenhum mandato" acao={<button>Novo mandato</button>} />,
    );

    expect(screen.getByRole("button", { name: "Novo mandato" })).toBeInTheDocument();

    unmount();
    render(<EstadoVazio titulo="Nenhum mandato" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
