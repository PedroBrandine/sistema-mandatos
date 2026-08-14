import { describe, expect, it } from "vitest";

import { apararUltimosMeses } from "./periodo";

// Fix pós-Verifier (Blocker, .specs/features/visao-gerencial-g3-g6/validation.md):
// filtro "Período" (FiltroRecorte.mesesEvolucao) era capturado da URL mas
// nunca consumido por nenhum componente -- os 3 valores do Select não
// tinham efeito nenhum. GER-07(d)/GER-08(c)/GER-12/GER-13 + Edge Case 5
// ("filtro Período afeta apenas os gráficos de evolução").
describe("apararUltimosMeses", () => {
  it("mesesEvolucao undefined -> devolve a série inteira, sem cortar", () => {
    const serie = [1, 2, 3, 4, 5];
    expect(apararUltimosMeses(serie, undefined)).toEqual([1, 2, 3, 4, 5]);
  });

  it("mesesEvolucao = 3 -> devolve só os 3 últimos pontos (mais recentes)", () => {
    const serie = [
      { mes: "2026-01-01" },
      { mes: "2026-02-01" },
      { mes: "2026-03-01" },
      { mes: "2026-04-01" },
    ];
    expect(apararUltimosMeses(serie, 3)).toEqual([{ mes: "2026-02-01" }, { mes: "2026-03-01" }, { mes: "2026-04-01" }]);
  });

  it("mesesEvolucao maior que o tamanho da série -> devolve a série inteira, sem lançar", () => {
    const serie = [1, 2];
    expect(apararUltimosMeses(serie, 12)).toEqual([1, 2]);
  });
});
