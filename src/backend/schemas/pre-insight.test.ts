import { describe, expect, it } from "vitest";

import { preInsightSchema } from "./pre-insight";

// Spec anchor: fatos-geradores-ciclo-vida T7 Done-when (.specs/features/fatos-geradores-ciclo-vida/tasks.md)
// -- FGC-05: fat_pre_insight só tem conteudo (obrigatório) + ocorrido_em (opcional) além de
// id_contrato/autor/timestamp. Mesmo nível de cobertura de insight.test.ts (molde).

describe("preInsightSchema", () => {
  it("aceita um pré-insight válido só com id_contrato e conteudo", () => {
    const resultado = preInsightSchema.safeParse({
      id_contrato: 1,
      conteudo: "Sinal bruto captado em reunião",
    });
    expect(resultado.success).toBe(true);
  });

  it("aceita ocorrido_em preenchido", () => {
    const resultado = preInsightSchema.safeParse({
      id_contrato: 1,
      conteudo: "Sinal bruto",
      ocorrido_em: "2026-09-16",
    });
    expect(resultado.success).toBe(true);
  });

  it("aceita ocorrido_em nulo", () => {
    const resultado = preInsightSchema.safeParse({
      id_contrato: 1,
      conteudo: "Sinal bruto",
      ocorrido_em: null,
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita ausência de id_contrato", () => {
    const resultado = preInsightSchema.safeParse({ conteudo: "Sinal bruto" });
    expect(resultado.success).toBe(false);
  });

  it("rejeita conteudo vazio", () => {
    const resultado = preInsightSchema.safeParse({ id_contrato: 1, conteudo: "" });
    expect(resultado.success).toBe(false);
  });

  it("rejeita ausência de conteudo", () => {
    const resultado = preInsightSchema.safeParse({ id_contrato: 1 });
    expect(resultado.success).toBe(false);
  });
});
