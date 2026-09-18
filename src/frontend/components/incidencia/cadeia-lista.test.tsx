import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CadeiaItem } from "@backend/queries/incidencia";

// T14 (pente-fino 2026-09, PF-08 AC1/AC2): RealizarFatoDialog mockado como
// componente opaco -- comportamento próprio já coberto em
// realizar-fato-dialog.test.tsx. Aqui a prova é de composição: qual card
// ganha a ação.
vi.mock("./realizar-fato-dialog", () => ({
  RealizarFatoDialog: ({ idFatoGerador, onConcluido }: { idFatoGerador: number; onConcluido: () => void }) => (
    <button type="button" onClick={onConcluido}>
      mock: marcar {idFatoGerador} como realizado
    </button>
  ),
}));

import { CadeiaLista } from "./cadeia-lista";

// Spec anchor: .specs/features/fatos-geradores-ciclo-vida/spec.md, "P2:
// Ciclo de Vida com cadeias" AC1-AC5.
//
// Spec anchor (pente-fino 2026-09): .specs/features/pente-fino-2026-09/spec.md
// P2 "Linha do Tempo e Ciclo de Vida — ajustes de UI e navegação" AC1/AC2.

afterEach(cleanup);

describe("CadeiaLista — estado vazio", () => {
  it("sem cadeias, mostra EstadoVazio explícito", () => {
    render(<CadeiaLista cadeias={[]} />);
    expect(screen.getByText("Nenhuma cadeia ainda")).toBeInTheDocument();
  });
});

describe("CadeiaLista — origem comum (spec.md AC3)", () => {
  it("dois fatos com a mesma origem aparecem juntos, marcados 'Origem comum'", () => {
    const cadeias: CadeiaItem[] = [
      { idFatoGerador: 1, titulo: "Fato A", situacao: "realizado", dataEvento: "2026-09-01", chaveOrigem: "insight:5" },
      { idFatoGerador: 2, titulo: "Fato B", situacao: "realizado", dataEvento: "2026-09-02", chaveOrigem: "insight:5" },
    ];
    render(<CadeiaLista cadeias={cadeias} />);

    expect(screen.getByText("Origem comum")).toBeInTheDocument();
    expect(screen.getByText("Fato A")).toBeInTheDocument();
    expect(screen.getByText("Fato B")).toBeInTheDocument();
  });

  it("cadeia direta no fato (1 elemento) NÃO mostra marca de incompletude -- lado oposto", () => {
    const cadeias: CadeiaItem[] = [
      { idFatoGerador: 3, titulo: "Fato solo", situacao: "realizado", dataEvento: "2026-09-03", chaveOrigem: "fato:3" },
    ];
    render(<CadeiaLista cadeias={cadeias} />);

    expect(screen.getByText("Fato solo")).toBeInTheDocument();
    expect(screen.queryByText("Origem comum")).not.toBeInTheDocument();
    expect(screen.queryByText(/incompleta/i)).not.toBeInTheDocument();
  });
});

describe("CadeiaLista — cadeia só-projetada (spec.md AC5)", () => {
  it("cadeia com só fatos projetados vai para a seção 'Cadeia Projetada (em análise)'", () => {
    const cadeias: CadeiaItem[] = [
      { idFatoGerador: 4, titulo: "Fato projetado", situacao: "projetado", dataEvento: "2026-11-01", chaveOrigem: "fato:4" },
    ];
    render(<CadeiaLista cadeias={cadeias} />);

    expect(screen.getByText("Cadeia Projetada (em análise)")).toBeInTheDocument();
    expect(screen.getByText("Fato projetado")).toBeInTheDocument();
  });

  it("cadeia com fato realizado NÃO cai na seção de projetadas -- lado oposto", () => {
    const cadeias: CadeiaItem[] = [
      { idFatoGerador: 5, titulo: "Fato realizado", situacao: "realizado", dataEvento: "2026-09-05", chaveOrigem: "fato:5" },
    ];
    render(<CadeiaLista cadeias={cadeias} />);

    expect(screen.queryByText("Cadeia Projetada (em análise)")).not.toBeInTheDocument();
  });
});

describe("CadeiaLista — rótulo posicional (AD-053)", () => {
  it("cadeias são rotuladas 'Cadeia A', 'Cadeia B' pela ordem, nunca por um campo do dado", () => {
    const cadeias: CadeiaItem[] = [
      { idFatoGerador: 1, titulo: "Primeira", situacao: "realizado", dataEvento: "2026-09-01", chaveOrigem: "fato:1" },
      { idFatoGerador: 2, titulo: "Segunda", situacao: "realizado", dataEvento: "2026-09-02", chaveOrigem: "fato:2" },
    ];
    render(<CadeiaLista cadeias={cadeias} />);

    expect(screen.getByText("Cadeia A")).toBeInTheDocument();
    expect(screen.getByText("Cadeia B")).toBeInTheDocument();
  });
});

describe("CadeiaLista — projetado vs realizado (pente-fino spec.md P2 AC1/AC2)", () => {
  it("cadeia unitária projetada mostra badge 'Projetado' e a ação de marcar como realizado", () => {
    const cadeias: CadeiaItem[] = [
      { idFatoGerador: 6, titulo: "Fato projetado solo", situacao: "projetado", dataEvento: "2026-11-01", chaveOrigem: "fato:6" },
    ];
    render(<CadeiaLista cadeias={cadeias} onRealizado={vi.fn()} />);

    expect(screen.getByText("Projetado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "mock: marcar 6 como realizado" })).toBeInTheDocument();
  });

  it("cadeia unitária realizada não mostra badge nem ação -- lado oposto", () => {
    const cadeias: CadeiaItem[] = [
      { idFatoGerador: 7, titulo: "Fato realizado solo", situacao: "realizado", dataEvento: "2026-09-07", chaveOrigem: "fato:7" },
    ];
    render(<CadeiaLista cadeias={cadeias} onRealizado={vi.fn()} />);

    expect(screen.queryByText("Projetado")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mock: marcar/ })).not.toBeInTheDocument();
  });

  it("em cadeia de origem comum com fatos mistos, só o item projetado ganha badge e ação", () => {
    const cadeias: CadeiaItem[] = [
      { idFatoGerador: 8, titulo: "Fato realizado", situacao: "realizado", dataEvento: "2026-09-08", chaveOrigem: "insight:9" },
      { idFatoGerador: 9, titulo: "Fato projetado", situacao: "projetado", dataEvento: "2026-11-02", chaveOrigem: "insight:9" },
    ];
    render(<CadeiaLista cadeias={cadeias} onRealizado={vi.fn()} />);

    expect(screen.getByRole("button", { name: "mock: marcar 9 como realizado" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mock: marcar 8 como realizado/ })).not.toBeInTheDocument();
  });

  it("confirmar a ação aciona onRealizado (recarrega os dados)", () => {
    const onRealizado = vi.fn();
    const cadeias: CadeiaItem[] = [
      { idFatoGerador: 6, titulo: "Fato projetado solo", situacao: "projetado", dataEvento: "2026-11-01", chaveOrigem: "fato:6" },
    ];
    render(<CadeiaLista cadeias={cadeias} onRealizado={onRealizado} />);

    fireEvent.click(screen.getByRole("button", { name: "mock: marcar 6 como realizado" }));

    expect(onRealizado).toHaveBeenCalledTimes(1);
  });

  it("sem onRealizado (prop ausente), a ação não aparece mesmo projetado -- lado oposto", () => {
    const cadeias: CadeiaItem[] = [
      { idFatoGerador: 6, titulo: "Fato projetado solo", situacao: "projetado", dataEvento: "2026-11-01", chaveOrigem: "fato:6" },
    ];
    render(<CadeiaLista cadeias={cadeias} />);

    expect(screen.getByText("Projetado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mock: marcar/ })).not.toBeInTheDocument();
  });
});

describe("CadeiaLista — clique abre o detalhe (pente-fino spec.md P2 AC4)", () => {
  it("cadeia unitária: clicar no passo do Fato Gerador aciona onAbrirDetalhe com o item certo", () => {
    const onAbrirDetalhe = vi.fn();
    const cadeias: CadeiaItem[] = [
      {
        idFatoGerador: 20,
        titulo: "Fato A",
        situacao: "realizado",
        dataEvento: "2026-09-01",
        chaveOrigem: "insight:5",
        origem: { tipo: "insight", titulo: "Insight de origem", dataEvento: "2026-08-20" },
      },
    ];
    render(<CadeiaLista cadeias={cadeias} onAbrirDetalhe={onAbrirDetalhe} />);

    fireEvent.click(screen.getByRole("button", { name: /Fato A/ }));

    expect(onAbrirDetalhe).toHaveBeenCalledWith(cadeias[0]);
    // O passo de origem (Insight) não é clicável -- só o Fato Gerador abre
    // o detalhe (ver comentário em PassoCard).
    expect(screen.queryByRole("button", { name: /Insight de origem/ })).not.toBeInTheDocument();
  });

  it("cadeia de origem comum: clicar numa linha específica aciona onAbrirDetalhe só com aquele item", () => {
    const onAbrirDetalhe = vi.fn();
    const cadeias: CadeiaItem[] = [
      { idFatoGerador: 21, titulo: "Fato B1", situacao: "realizado", dataEvento: "2026-09-01", chaveOrigem: "insight:9" },
      { idFatoGerador: 22, titulo: "Fato B2", situacao: "realizado", dataEvento: "2026-09-02", chaveOrigem: "insight:9" },
    ];
    render(<CadeiaLista cadeias={cadeias} onAbrirDetalhe={onAbrirDetalhe} />);

    fireEvent.click(screen.getByRole("button", { name: /Fato B2/ }));

    expect(onAbrirDetalhe).toHaveBeenCalledTimes(1);
    expect(onAbrirDetalhe).toHaveBeenCalledWith(cadeias[1]);
  });

  it("sem onAbrirDetalhe (prop ausente), o card não vira botão -- lado oposto", () => {
    const cadeias: CadeiaItem[] = [
      { idFatoGerador: 23, titulo: "Fato C", situacao: "realizado", dataEvento: "2026-09-03", chaveOrigem: "fato:23" },
    ];
    render(<CadeiaLista cadeias={cadeias} />);

    expect(screen.getByText("Fato C")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Fato C/ })).not.toBeInTheDocument();
  });
});
