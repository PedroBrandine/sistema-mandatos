import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorAmbicaoPolitica } from "./editor-ambicao-politica";

// Spec anchor: tasks.md T18 "Done when" (PLL-CP-21). AD-042: os dois lados
// de cada condicional.
afterEach(cleanup);

describe("EditorAmbicaoPolitica", () => {
  // PLL-CP-21: texto livre.
  it("editar o texto livre chama onChangeTexto", () => {
    const onChangeTexto = vi.fn();
    render(
      <EditorAmbicaoPolitica texto="" tags={[]} onChangeTexto={onChangeTexto} onChangeTags={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText("Texto da Ambição Política"), {
      target: { value: "Concorrer a deputado estadual" },
    });

    expect(onChangeTexto).toHaveBeenCalledWith("Concorrer a deputado estadual");
  });

  // PLL-CP-21: adicionar até 3 marcadores.
  it("adicionar um marcador chama onChangeTags com o marcador novo", () => {
    const onChangeTags = vi.fn();
    render(
      <EditorAmbicaoPolitica texto="" tags={["reeleição"]} onChangeTexto={vi.fn()} onChangeTags={onChangeTags} />
    );

    fireEvent.change(screen.getByLabelText("Novo marcador da Ambição Política"), {
      target: { value: "estadual" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(onChangeTags).toHaveBeenCalledWith(["reeleição", "estadual"]);
  });

  // PLL-CP-21: limita a 3 tags.
  it("com 3 marcadores, o campo de adicionar fica desabilitado (limite atingido)", () => {
    render(
      <EditorAmbicaoPolitica
        texto=""
        tags={["a", "b", "c"]}
        onChangeTexto={vi.fn()}
        onChangeTags={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Novo marcador da Ambição Política")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Adicionar" })).toBeDisabled();
  });

  // Lado oposto: abaixo do limite, o campo continua habilitado.
  it("lado oposto: com menos de 3 marcadores, o campo de adicionar continua habilitado", () => {
    render(
      <EditorAmbicaoPolitica texto="" tags={["a"]} onChangeTexto={vi.fn()} onChangeTags={vi.fn()} />
    );
    expect(screen.getByLabelText("Novo marcador da Ambição Política")).not.toBeDisabled();
  });

  it("remover um marcador chama onChangeTags sem ele", () => {
    const onChangeTags = vi.fn();
    render(
      <EditorAmbicaoPolitica
        texto=""
        tags={["reeleição", "estadual"]}
        onChangeTexto={vi.fn()}
        onChangeTags={onChangeTags}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: 'Remover marcador "reeleição"' }));

    expect(onChangeTags).toHaveBeenCalledWith(["estadual"]);
  });

  // readOnly (PLL-CP-23): sem textarea nem controles, só o texto e os chips.
  it("readOnly mostra o texto como parágrafo e os chips sem botão de remover", () => {
    render(
      <EditorAmbicaoPolitica
        texto="Concorrer em 2026"
        tags={["reeleição"]}
        onChangeTexto={vi.fn()}
        onChangeTags={vi.fn()}
        readOnly
      />
    );

    expect(screen.getByText("Concorrer em 2026")).toBeInTheDocument();
    expect(screen.queryByLabelText("Texto da Ambição Política")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: 'Remover marcador "reeleição"' })).not.toBeInTheDocument();
  });

  // Lado oposto de readOnly, sem texto: "Nada registrado ainda."
  it("readOnly sem texto mostra 'Nada registrado ainda.'", () => {
    render(
      <EditorAmbicaoPolitica texto={null} tags={[]} onChangeTexto={vi.fn()} onChangeTags={vi.fn()} readOnly />
    );
    expect(screen.getByText("Nada registrado ainda.")).toBeInTheDocument();
  });
});
