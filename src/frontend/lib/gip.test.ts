import { describe, expect, it } from "vitest";

import { resumoEvolucaoGip, rotuloEvolucaoGip } from "./gip";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, FMC-28 (AC9-AC11).
// Test Coverage Matrix (tasks.md, T15): todos os ramos de `rotuloEvolucaoGip`
// (singular/plural nos dois sentidos, "Manteve", `gap = null`) e a regra de
// contagem de `resumoEvolucaoGip` (só dimensão com os dois momentos entra).

describe("rotuloEvolucaoGip (FMC-28 AC9)", () => {
  it("gap > 0 no singular: 'Subiu 1 nível'", () => {
    expect(rotuloEvolucaoGip(1)).toBe("Subiu 1 nível");
  });

  it("gap > 0 no plural: 'Subiu 2 níveis'", () => {
    expect(rotuloEvolucaoGip(2)).toBe("Subiu 2 níveis");
  });

  it("gap = 0: 'Manteve'", () => {
    expect(rotuloEvolucaoGip(0)).toBe("Manteve");
  });

  it("gap < 0 no singular: 'Regrediu 1 nível'", () => {
    expect(rotuloEvolucaoGip(-1)).toBe("Regrediu 1 nível");
  });

  it("gap < 0 no plural: 'Regrediu 2 níveis'", () => {
    expect(rotuloEvolucaoGip(-2)).toBe("Regrediu 2 níveis");
  });

  it("gap = null: estado explicativo, nunca '0' nem traço silencioso (AC10)", () => {
    const rotulo = rotuloEvolucaoGip(null);
    expect(rotulo).not.toBe("0");
    expect(rotulo).not.toBe("—");
    expect(rotulo).not.toBe("");
    expect(rotulo.length).toBeGreaterThan(0);
  });
});

describe("resumoEvolucaoGip (FMC-28 AC11)", () => {
  it("soma evoluíram/mantiveram/regrediram só das dimensões com os dois momentos", () => {
    const linhas = [
      { gap: 1 }, // evoluiu
      { gap: 2 }, // evoluiu
      { gap: 0 }, // manteve
      { gap: -1 }, // regrediu
      { gap: null }, // só um momento -- não entra em nenhuma contagem
    ];

    expect(resumoEvolucaoGip(linhas)).toEqual({ evoluiram: 2, mantiveram: 1, regrediram: 1 });
  });

  it("todas as dimensões com só um momento preenchido: soma zero em tudo", () => {
    const linhas = [{ gap: null }, { gap: null }, { gap: null }, { gap: null }];

    expect(resumoEvolucaoGip(linhas)).toEqual({ evoluiram: 0, mantiveram: 0, regrediram: 0 });
  });

  it("lista vazia: soma zero em tudo", () => {
    expect(resumoEvolucaoGip([])).toEqual({ evoluiram: 0, mantiveram: 0, regrediram: 0 });
  });

  it("o total das três contagens nunca inclui dimensão com gap null", () => {
    const linhas = [{ gap: 1 }, { gap: null }, { gap: null }];
    const resumo = resumoEvolucaoGip(linhas);

    expect(resumo.evoluiram + resumo.mantiveram + resumo.regrediram).toBe(1);
  });
});
