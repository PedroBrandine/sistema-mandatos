import { describe, expect, it } from "vitest";

import { fatoGeradorSchema } from "./fato-gerador";

describe("fatoGeradorSchema", () => {
  it("aceita um fato gerador válido mínimo (só nivel_d1 preenchido)", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      id_tipologia: 2,
      nivel_d1: "alto",
      dt_ocorrencia: "2026-08-14",
    });
    expect(resultado.success).toBe(true);
  });

  // spec.md Edge Case: "fato tem só nivel_d1 preenchido (D2 e D3 nulos)" --
  // mesma prova para d2/d3 isolados, confirmando que ck_fato_niveis exige
  // "ao menos um", não um nível específico
  it("aceita um fato gerador válido com só nivel_d2 preenchido", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      id_tipologia: 2,
      nivel_d2: "medio",
      dt_ocorrencia: "2026-08-14",
    });
    expect(resultado.success).toBe(true);
  });

  // spec.md P1 AC3: vínculo a Meta
  it("aceita um fato gerador válido com Meta de origem", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      id_tipologia: 2,
      nivel_d1: "alto",
      dt_ocorrencia: "2026-08-14",
      id_meta_origem: 5,
    });
    expect(resultado.success).toBe(true);
  });

  // spec.md P1 AC4: vínculo a Insight (Meta e Insight não são mutuamente exclusivos)
  it("aceita um fato gerador válido com Insight de origem", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      id_tipologia: 2,
      nivel_d1: "alto",
      dt_ocorrencia: "2026-08-14",
      id_insight_origem: 8,
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita ausência de id_contrato", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_tipologia: 2,
      nivel_d1: "alto",
      dt_ocorrencia: "2026-08-14",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita ausência de id_tipologia", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      nivel_d1: "alto",
      dt_ocorrencia: "2026-08-14",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita ausência de dt_ocorrencia", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      id_tipologia: 2,
      nivel_d1: "alto",
    });
    expect(resultado.success).toBe(false);
  });

  // espelha ck_fato_niveis -- spec.md P1 AC2
  it("rejeita nenhum nível preenchido (nivel_d1/d2/d3 todos ausentes)", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      id_tipologia: 2,
      dt_ocorrencia: "2026-08-14",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita nenhum nível preenchido (nivel_d1/d2/d3 todos null)", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      id_tipologia: 2,
      nivel_d1: null,
      nivel_d2: null,
      nivel_d3: null,
      dt_ocorrencia: "2026-08-14",
    });
    expect(resultado.success).toBe(false);
  });

  // espelha ck_fato_contribuicao
  it("rejeita contribuicao_legisla fora de 0-5", () => {
    for (const valor of [-1, 6]) {
      const resultado = fatoGeradorSchema.safeParse({
        id_contrato: 1,
        id_tipologia: 2,
        nivel_d1: "alto",
        dt_ocorrencia: "2026-08-14",
        contribuicao_legisla: valor,
      });
      expect(resultado.success).toBe(false);
    }
  });

  it("aceita contribuicao_legisla nulo", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      id_tipologia: 2,
      nivel_d1: "alto",
      dt_ocorrencia: "2026-08-14",
      contribuicao_legisla: null,
    });
    expect(resultado.success).toBe(true);
  });

  // espelha ck_fato_preditores
  it("rejeita id_preditor_2 igual a id_preditor_1", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      id_tipologia: 2,
      nivel_d1: "alto",
      dt_ocorrencia: "2026-08-14",
      id_preditor_1: 3,
      id_preditor_2: 3,
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita id_preditor_2 preenchido sem id_preditor_1", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      id_tipologia: 2,
      nivel_d1: "alto",
      dt_ocorrencia: "2026-08-14",
      id_preditor_2: 3,
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita id_preditor_2 diferente de id_preditor_1", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      id_tipologia: 2,
      nivel_d1: "alto",
      dt_ocorrencia: "2026-08-14",
      id_preditor_1: 3,
      id_preditor_2: 4,
    });
    expect(resultado.success).toBe(true);
  });
});
