import { describe, expect, it } from "vitest";

import { linhasExclusaoContrato, linhasExclusaoIncidencia } from "./exclusao-rotulos";

// Texto que a caixa de confirmação mostra ANTES de apagar. Função pura: o que
// importa é que só apareça o que existe, com o plural certo, e que o efeito
// colateral de apagar uma origem seja dito com todas as letras.

describe("linhasExclusaoContrato", () => {
  it("lista só o que tem quantidade, com singular/plural", () => {
    const linhas = linhasExclusaoContrato({ registros: 47, fatos_geradores: 1, insights: 0, metas: 2 });

    expect(linhas).toEqual(["47 registros", "1 fato gerador", "2 metas"]);
  });

  it("inclui o 2º nível (objetivos, metas, sucessos mensais), não só o 1º", () => {
    const linhas = linhasExclusaoContrato({ objetivos: 1, metas: 3, sucessos_mensais: 12 });

    expect(linhas).toEqual(["1 objetivo específico", "3 metas", "12 sucessos mensais"]);
  });

  it("contrato vazio não gera linha nenhuma", () => {
    expect(linhasExclusaoContrato({ registros: 0 })).toEqual([]);
  });
});

describe("linhasExclusaoIncidencia", () => {
  it("apagar uma origem diz que os fatos NÃO são apagados", () => {
    const linhas = linhasExclusaoIncidencia({
      tipo: "insight",
      id: 1,
      situacao: null,
      contagens: { fatos_origem_desfeita: 2 },
    });

    expect(linhas).toEqual(["2 fatos geradores perdem a origem (eles não são apagados)"]);
  });

  it("registro: insight desvinculado no singular", () => {
    const linhas = linhasExclusaoIncidencia({
      tipo: "registro",
      id: 1,
      situacao: null,
      contagens: { insights_desvinculados: 1 },
    });

    expect(linhas).toEqual(["1 insight perde o vínculo com este registro (ele não é apagado)"]);
  });

  it("Fato Gerador realizado avisa que o IIP será recalculado", () => {
    const linhas = linhasExclusaoIncidencia({
      tipo: "fato_gerador",
      id: 1,
      situacao: "realizado",
      contagens: { vinculos_origem: 1 },
    });

    expect(linhas).toContain("O IIP do mandato será recalculado sem este fato gerador");
  });

  it("Fato Gerador projetado NÃO mexe no IIP (projeção não entra no cálculo)", () => {
    const linhas = linhasExclusaoIncidencia({
      tipo: "fato_gerador",
      id: 1,
      situacao: "projetado",
      contagens: {},
    });

    expect(linhas).toEqual([]);
  });
});
