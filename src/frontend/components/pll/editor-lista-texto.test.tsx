import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorListaTexto } from "./editor-lista-texto";

// Spec anchor: tasks.md T17 "Done when" (PLL-CP-20, PLL-CP-22). AD-042: os
// dois lados de cada condicional (com item/sem item, editável/somente leitura).
afterEach(cleanup);

describe("EditorListaTexto", () => {
  // PLL-CP-22: estado vazio com atalho.
  it("lista vazia mostra 'Nada registrado ainda' com o atalho de adicionar", () => {
    render(<EditorListaTexto titulo="Desafios" itens={[]} onChange={vi.fn()} />);
    expect(screen.getByText("Nada registrado ainda")).toBeInTheDocument();
    expect(screen.getByLabelText("Novo item de Desafios")).toBeInTheDocument();
  });

  // Lado oposto: com itens, a lista aparece (não o estado vazio).
  it("lado oposto: com itens, mostra a lista em vez do estado vazio", () => {
    render(<EditorListaTexto titulo="Desafios" itens={["Agenda apertada"]} onChange={vi.fn()} />);
    expect(screen.queryByText("Nada registrado ainda")).not.toBeInTheDocument();
    expect(screen.getByText("Agenda apertada")).toBeInTheDocument();
  });

  // PLL-CP-20: adicionar item.
  it("adicionar um item chama onChange com o item novo no fim da lista", () => {
    const onChange = vi.fn();
    render(<EditorListaTexto titulo="Desafios" itens={["Item 1"]} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Novo item de Desafios"), { target: { value: "Item 2" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(onChange).toHaveBeenCalledWith(["Item 1", "Item 2"]);
  });

  // Lado oposto: campo vazio não adiciona (botão desabilitado).
  it("lado oposto: campo vazio não permite adicionar", () => {
    const onChange = vi.fn();
    render(<EditorListaTexto titulo="Desafios" itens={[]} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Adicionar" })).toBeDisabled();
  });

  // PLL-CP-20: editar item existente.
  it("editar um item e salvar chama onChange com o item atualizado", () => {
    const onChange = vi.fn();
    render(<EditorListaTexto titulo="Destaques" itens={["Original"]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: 'Editar "Original"' }));
    const campoEdicao = screen.getByLabelText("Editar item 1 de Destaques");
    fireEvent.change(campoEdicao, { target: { value: "Editado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(onChange).toHaveBeenCalledWith(["Editado"]);
  });

  // PLL-CP-20: remover item.
  it("remover um item chama onChange sem ele", () => {
    const onChange = vi.fn();
    render(<EditorListaTexto titulo="Destaques" itens={["A", "B"]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: 'Remover "A"' }));

    expect(onChange).toHaveBeenCalledWith(["B"]);
  });

  // readOnly (PLL-CP-23): nenhum controle de edição aparece.
  it("readOnly esconde os controles de adicionar/editar/remover", () => {
    render(<EditorListaTexto titulo="Desafios" itens={["Item 1"]} onChange={vi.fn()} readOnly />);

    expect(screen.queryByLabelText("Novo item de Desafios")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: 'Editar "Item 1"' })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: 'Remover "Item 1"' })).not.toBeInTheDocument();
  });

  // Lado oposto de readOnly: editável, os 2 controles aparecem por item.
  it("lado oposto: editável (readOnly=false, padrão) mostra editar e remover por item", () => {
    render(<EditorListaTexto titulo="Desafios" itens={["Item 1"]} onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: 'Editar "Item 1"' })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: 'Remover "Item 1"' })).toBeInTheDocument();
  });
});
