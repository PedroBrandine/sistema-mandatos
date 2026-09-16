import { describe, expect, it } from "vitest";

import { agrupaPorMes, type ItemTimeline } from "./incidencia-timeline";

// Spec anchor: fatos-geradores-ciclo-vida T13 Done-when (.specs/features/fatos-geradores-ciclo-vida/tasks.md)
// -- FGC-10/FGC-12: spec.md P1 "Linha do Tempo" AC1 (ordem cronológica decrescente, agrupada por
// mês) e AC5 (data sem hora).

function item(parcial: Partial<ItemTimeline>): ItemTimeline {
  return {
    tipo: "fato_gerador",
    idOrigem: 1,
    titulo: "Item",
    dataEvento: "2026-08-01",
    ...parcial,
  };
}

describe("agrupaPorMes", () => {
  it("retorna [] para uma lista vazia (estado vazio)", () => {
    expect(agrupaPorMes([])).toEqual([]);
  });

  // spec.md P1 AC1: ordem cronológica decrescente.
  it("ordena em ordem decrescente itens de meses diferentes", () => {
    const resultado = agrupaPorMes([
      item({ idOrigem: 1, dataEvento: "2026-07-15" }),
      item({ idOrigem: 2, dataEvento: "2026-09-01" }),
      item({ idOrigem: 3, dataEvento: "2026-08-20" }),
    ]);

    expect(resultado.map((g) => g.mes)).toEqual(["Setembro de 2026", "Agosto de 2026", "Julho de 2026"]);
    expect(resultado.map((g) => g.itens[0].idOrigem)).toEqual([2, 3, 1]);
  });

  it("agrupa itens do mesmo mês num único grupo, mantendo ordem decrescente dentro do grupo", () => {
    const resultado = agrupaPorMes([
      item({ idOrigem: 1, dataEvento: "2026-09-01" }),
      item({ idOrigem: 2, dataEvento: "2026-09-20" }),
      item({ idOrigem: 3, dataEvento: "2026-09-10" }),
    ]);

    expect(resultado).toHaveLength(1);
    expect(resultado[0].mes).toBe("Setembro de 2026");
    expect(resultado[0].itens.map((i) => i.idOrigem)).toEqual([2, 3, 1]);
  });

  // AD-053/AD-003 análogo: mesmo mês em anos diferentes não pode colidir num só grupo.
  it("não agrupa o mesmo mês de anos diferentes", () => {
    const resultado = agrupaPorMes([
      item({ idOrigem: 1, dataEvento: "2025-09-01" }),
      item({ idOrigem: 2, dataEvento: "2026-09-01" }),
    ]);

    expect(resultado.map((g) => g.mes)).toEqual(["Setembro de 2026", "Setembro de 2025"]);
  });

  // FGC-12/spec.md P1 AC5: data de ocorrência exibida sem hora -- o cabeçalho de mês (derivado da
  // mesma dataEvento) nunca carrega componente de hora, mesmo formatando manualmente (L-002).
  it("formata o cabeçalho de mês sem nenhum componente de hora", () => {
    const resultado = agrupaPorMes([item({ dataEvento: "2026-09-16" })]);

    expect(resultado[0].mes).toBe("Setembro de 2026");
    expect(resultado[0].mes).not.toMatch(/:/);
  });

  // Edge case defensivo (dataEvento null não é esperado da view, T5 garante COALESCE, mas a
  // função não deve quebrar se receber): cai num grupo "Sem data" próprio.
  it("agrupa item sem dataEvento num grupo 'Sem data' próprio", () => {
    const resultado = agrupaPorMes([item({ idOrigem: 1, dataEvento: null }), item({ idOrigem: 2, dataEvento: "2026-09-01" })]);

    expect(resultado.map((g) => g.mes)).toContain("Sem data");
    const grupoSemData = resultado.find((g) => g.mes === "Sem data");
    expect(grupoSemData?.itens.map((i) => i.idOrigem)).toEqual([1]);
  });
});
