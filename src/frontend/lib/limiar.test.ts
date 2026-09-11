import { describe, expect, it } from "vitest";

import { classificarLimiar } from "./limiar";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/tasks.md, T14
// "Done when" (EST-07 AC3, AD-004, AD-005, AD-045) --
//  - Um caso de teste de cada lado de cada limiar, incluindo o valor exato
//    de fronteira (lição L-001)
//  - Limiar ausente ou nulo devolve 'normal', nunca lança
//  - Nenhum número mágico no arquivo -- limiares chegam por parâmetro
//
// duracaoPrevistaDias = 100 mantém dias == percentual decorrido, deixando as
// fronteiras (70/100) legíveis sem aritmética extra nos casos de teste.
const LIMIARES_PADRAO = { atencaoPct: 70, atrasadoPct: 100 };

describe("classificarLimiar (EST-07)", () => {
  it("um dia abaixo do limiar de atenção permanece normal (fronteira 70%, lado de baixo)", () => {
    expect(classificarLimiar(69, 100, LIMIARES_PADRAO)).toBe("normal");
  });

  it("exatamente no limiar de atenção já classifica como atencao (fronteira 70%, valor exato)", () => {
    expect(classificarLimiar(70, 100, LIMIARES_PADRAO)).toBe("atencao");
  });

  it("um dia abaixo do limiar de atraso permanece em atencao (fronteira 100%, lado de baixo)", () => {
    expect(classificarLimiar(99, 100, LIMIARES_PADRAO)).toBe("atencao");
  });

  it("exatamente no limiar de atraso já classifica como atrasado (fronteira 100%, valor exato)", () => {
    expect(classificarLimiar(100, 100, LIMIARES_PADRAO)).toBe("atrasado");
  });

  it("acima do limiar de atraso continua atrasado", () => {
    expect(classificarLimiar(150, 100, LIMIARES_PADRAO)).toBe("atrasado");
  });

  it("limiares ausentes (undefined) devolvem normal, nunca lançam", () => {
    expect(classificarLimiar(500, 100, undefined)).toBe("normal");
  });

  it("limiares nulos devolvem normal, nunca lançam", () => {
    expect(classificarLimiar(500, 100, null)).toBe("normal");
  });

  it("duração prevista ausente (etapa não classificável) devolve normal, nunca lança (AD-005)", () => {
    expect(classificarLimiar(500, null, LIMIARES_PADRAO)).toBe("normal");
    expect(classificarLimiar(500, undefined, LIMIARES_PADRAO)).toBe("normal");
  });

  it("nenhum percentual é fixo no código -- limiares diferentes mudam o resultado pro mesmo dia (AD-004)", () => {
    expect(classificarLimiar(50, 100, { atencaoPct: 40, atrasadoPct: 90 })).toBe("atencao");
    expect(classificarLimiar(50, 100, LIMIARES_PADRAO)).toBe("normal");
  });
});
