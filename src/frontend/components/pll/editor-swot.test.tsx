import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorSwot } from "./editor-swot";

// Spec anchor: tasks.md T18 "Done when" (PLL-CP-24, PLL-CP-25). AD-042: os
// dois lados de cada condicional.
afterEach(cleanup);

function montar(overrides: Partial<Parameters<typeof EditorSwot>[0]> = {}) {
  const props = {
    forcas: [],
    fraquezas: [],
    oportunidades: [],
    ameacas: [],
    onChangeForcas: vi.fn(),
    onChangeFraquezas: vi.fn(),
    onChangeOportunidades: vi.fn(),
    onChangeAmeacas: vi.fn(),
    ...overrides,
  };
  render(<EditorSwot {...props} />);
  return props;
}

describe("EditorSwot", () => {
  // PLL-CP-25: quadrante preenchido só, os outros 3 ficam em estado vazio
  // independente, sem esconder o preenchido.
  it("preencher só 'Forças' mostra os outros 3 quadrantes em estado vazio, sem esconder Forças", () => {
    montar({ forcas: ["Boa oratória"] });

    expect(screen.getByText("Boa oratória")).toBeInTheDocument();
    const vazios = screen.getAllByText("Nada registrado ainda");
    // Fraquezas, Oportunidades e Ameaças vazios -- Forças não conta (tem item).
    expect(vazios).toHaveLength(3);
  });

  // Lado oposto: todos os 4 quadrantes com item, nenhum estado vazio.
  it("lado oposto: todos os 4 quadrantes preenchidos não mostram nenhum estado vazio", () => {
    montar({
      forcas: ["F"],
      fraquezas: ["Fr"],
      oportunidades: ["O"],
      ameacas: ["A"],
    });

    expect(screen.queryByText("Nada registrado ainda")).not.toBeInTheDocument();
  });

  // PLL-CP-24: cada quadrante edita independentemente.
  it("adicionar item em 'Ameaças' chama só onChangeAmeacas, não os outros 3", () => {
    const props = montar();

    fireEvent.change(screen.getByLabelText("Novo item de Ameaças"), { target: { value: "Nova ameaça" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Adicionar" })[3]);

    expect(props.onChangeAmeacas).toHaveBeenCalledWith(["Nova ameaça"]);
    expect(props.onChangeForcas).not.toHaveBeenCalled();
    expect(props.onChangeFraquezas).not.toHaveBeenCalled();
    expect(props.onChangeOportunidades).not.toHaveBeenCalled();
  });

  // readOnly (PLL-CP-23) propagado aos 4 quadrantes: nenhum campo de
  // adicionar aparece em nenhum deles.
  it("readOnly esconde os controles de edição dos 4 quadrantes", () => {
    montar({ forcas: ["F"], readOnly: true } as never);

    expect(screen.queryByLabelText("Novo item de Forças")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Novo item de Fraquezas")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Novo item de Oportunidades")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Novo item de Ameaças")).not.toBeInTheDocument();
  });

  // Lado oposto: editável (padrão), os 4 campos de adicionar aparecem.
  it("lado oposto: editável (padrão) mostra o campo de adicionar nos 4 quadrantes", () => {
    montar();

    expect(screen.getByLabelText("Novo item de Forças")).toBeInTheDocument();
    expect(screen.getByLabelText("Novo item de Fraquezas")).toBeInTheDocument();
    expect(screen.getByLabelText("Novo item de Oportunidades")).toBeInTheDocument();
    expect(screen.getByLabelText("Novo item de Ameaças")).toBeInTheDocument();
  });
});
