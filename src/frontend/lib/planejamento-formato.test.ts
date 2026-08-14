import { describe, expect, it } from "vitest";

import { normalizaEntradaPct } from "./planejamento-formato";

// Spec anchor: PLR-16 (.specs/features/planejamento-estrategico-redesenho/spec.md) --
// Success Criteria: "Colar 5 valores do Sheets numa célula preenche 5 células para baixo,
// aceitando vírgula/ponto/%". Test Coverage Matrix (tasks.md, T2): vírgula, ponto, sufixo %,
// valor fora de 0-100, string vazia, não numérico.

describe("normalizaEntradaPct", () => {
  it("aceita vírgula como separador decimal", () => {
    expect(normalizaEntradaPct("85,5")).toBe(85.5);
  });

  it("aceita ponto como separador decimal", () => {
    expect(normalizaEntradaPct("85.5")).toBe(85.5);
  });

  it("aceita sufixo % sem separador decimal", () => {
    expect(normalizaEntradaPct("85%")).toBe(85);
  });

  it("aceita vírgula decimal + sufixo %", () => {
    expect(normalizaEntradaPct("85,5%")).toBe(85.5);
  });

  it("aceita valores inteiros simples", () => {
    expect(normalizaEntradaPct("0")).toBe(0);
    expect(normalizaEntradaPct("100")).toBe(100);
  });

  it("aceita espaços em volta do valor", () => {
    expect(normalizaEntradaPct("  85  ")).toBe(85);
  });

  it("rejeita valor acima de 100", () => {
    expect(normalizaEntradaPct("150")).toBeNull();
  });

  it("rejeita valor negativo", () => {
    expect(normalizaEntradaPct("-5")).toBeNull();
  });

  it("rejeita string não numérica", () => {
    expect(normalizaEntradaPct("abc")).toBeNull();
  });

  it("rejeita string vazia", () => {
    expect(normalizaEntradaPct("")).toBeNull();
  });

  it("rejeita string só com espaços", () => {
    expect(normalizaEntradaPct("   ")).toBeNull();
  });
});
