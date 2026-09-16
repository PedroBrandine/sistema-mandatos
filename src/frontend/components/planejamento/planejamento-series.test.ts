import { describe, expect, it } from "vitest";

import type { LinhaEvolucaoMensal } from "@backend/queries/planejamento";

import { calculaAvancoMensal } from "./planejamento-series";

// Spec anchor: PLV-13 AC3 (.specs/features/planejamento-estrategico-v2/spec.md:296)
// -- "o sistema SHALL exibir o avanço daquele mês (Atingido(M) − Atingido(M−1)),
// não apenas o acumulado". É a pergunta que Pedro faz todo mês: "quanto eu
// avancei no mês X?".
//
// O acumulado vem da view (AC2, AD-003: número de gestão nunca é agregado no
// cliente). Esta função NÃO agrega nada -- só faz a diferença entre dois pontos
// que a view já calculou, que é subtração de leitura, não regra de negócio
// reimplementada no browser.

function linha(mes: string, pctEsperado: number | null, pctAtingido: number | null): LinhaEvolucaoMensal {
  return { mes, pctEsperado, pctAtingido };
}

describe("calculaAvancoMensal — Independent Test da PLV-13", () => {
  // Verbatim do spec.md:310 -- plano com 2 SMs de peso 50 (ago e set), o de
  // agosto a 100% e o de setembro a 0%.
  const serie = [linha("2026-08-01", 50, 50), linha("2026-09-01", 100, 50)];

  it("reproduz os números do Independent Test, incluindo Avanço(set)=0", () => {
    expect(calculaAvancoMensal(serie)).toEqual([
      { mes: "2026-08-01", pctEsperado: 50, pctAtingido: 50, avanco: 50 },
      { mes: "2026-09-01", pctEsperado: 100, pctAtingido: 50, avanco: 0 },
    ]);
  });

  it("avanço zero é 0 de verdade, não ausência de avanço", () => {
    // O lado oposto do teste acima: se 0 virasse null, setembro apareceria como
    // "—" na tela (AD-005) e a Gestora leria "não medido" onde o certo é
    // "medido, e não andou". São diagnósticos opostos.
    const [, setembro] = calculaAvancoMensal(serie);
    expect(setembro.avanco).toBe(0);
    expect(setembro.avanco).not.toBeNull();
  });
});

describe("calculaAvancoMensal — forma da série", () => {
  it("o primeiro mês tem avanço igual ao próprio acumulado", () => {
    // Não existe M−1 antes do início do plano: a linha de base é zero, então
    // todo o acumulado do primeiro mês foi avanço dele.
    const [primeiro] = calculaAvancoMensal([linha("2026-01-01", 10, 7)]);
    expect(primeiro.avanco).toBe(7);
  });

  it("série vazia devolve série vazia, sem estourar", () => {
    expect(calculaAvancoMensal([])).toEqual([]);
  });

  it("preserva a ordem e o tamanho da série que recebeu", () => {
    const entrada = [
      linha("2026-01-01", 10, 5),
      linha("2026-02-01", 30, 20),
      linha("2026-03-01", 60, 50),
    ];
    const saida = calculaAvancoMensal(entrada);
    expect(saida.map((l) => l.mes)).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
    expect(saida.map((l) => l.avanco)).toEqual([5, 15, 30]);
  });

  it("não muta a série de entrada", () => {
    const entrada = [linha("2026-01-01", 10, 5)];
    calculaAvancoMensal(entrada);
    expect(entrada[0]).toEqual({ mes: "2026-01-01", pctEsperado: 10, pctAtingido: 5 });
  });

  it("carrega pctEsperado adiante intacto, inclusive nulo", () => {
    const saida = calculaAvancoMensal([linha("2026-01-01", null, 5)]);
    expect(saida[0].pctEsperado).toBeNull();
  });
});

describe("calculaAvancoMensal — meses sem Atingido (PLV-13 AC8)", () => {
  // AC8: "a curva Esperado SHALL se estender até o último mês com SM, e a
  // Atingido SHALL parar no mês corrente". Os meses futuros chegam com
  // pctAtingido nulo -- é ausência de medição, não medição de zero (AD-005).

  it("mês futuro sem Atingido tem avanço nulo, nunca 0", () => {
    const saida = calculaAvancoMensal([
      linha("2026-08-01", 50, 50),
      linha("2026-09-01", 100, null),
    ]);
    expect(saida[1].avanco).toBeNull();
  });

  it("o mês seguinte a um ponto nulo também fica nulo, sem pular para o último medido", () => {
    // Um buraco no meio da série é anomalia de dado, não convite para
    // interpolar. Diferença contra um mês não medido não é avanço de um mês --
    // seria um número inventado com cara de medição.
    const saida = calculaAvancoMensal([
      linha("2026-01-01", 20, 10),
      linha("2026-02-01", 40, null),
      linha("2026-03-01", 60, 45),
    ]);
    expect(saida.map((l) => l.avanco)).toEqual([10, null, null]);
  });

  it("primeiro mês sem Atingido tem avanço nulo, não o próprio valor", () => {
    const saida = calculaAvancoMensal([linha("2026-01-01", 10, null)]);
    expect(saida[0].avanco).toBeNull();
  });

  it("série inteiramente sem Atingido devolve avanço nulo em todos os pontos", () => {
    // Plano com P=0 cai aqui (AC7): a tela mostra estado vazio explícito, e
    // nenhum ponto pode chegar nela como 0%.
    const saida = calculaAvancoMensal([linha("2026-01-01", null, null), linha("2026-02-01", null, null)]);
    expect(saida.map((l) => l.avanco)).toEqual([null, null]);
  });
});
