import { describe, expect, it } from "vitest";

import { insightSchema } from "./insight";

describe("insightSchema", () => {
  // spec.md P2 AC3: "insight sem nenhum Registro de origem THEN o sistema
  // SHALL aceitar mesmo assim"
  it("aceita um insight válido sem nenhuma origem", () => {
    const resultado = insightSchema.safeParse({
      id_contrato: 1,
      conteudo: "Observação qualitativa sobre a reunião",
    });
    expect(resultado.success).toBe(true);
  });

  // spec.md P2 AC1: vínculo a um Registro de origem
  it("aceita um insight válido com Registro de origem", () => {
    const resultado = insightSchema.safeParse({
      id_contrato: 1,
      conteudo: "Observação qualitativa",
      id_registro: 7,
    });
    expect(resultado.success).toBe(true);
  });

  // spec.md P2 AC4: "Meta e/ou Sucesso Mensal... 0, 1 ou 2 vínculos simultâneos"
  it("aceita um insight válido com Meta e Sucesso simultâneos", () => {
    const resultado = insightSchema.safeParse({
      id_contrato: 1,
      conteudo: "Observação qualitativa",
      id_meta_origem: 3,
      id_sucesso_origem: 4,
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita ausência de id_contrato", () => {
    const resultado = insightSchema.safeParse({ conteudo: "Observação" });
    expect(resultado.success).toBe(false);
  });

  it("rejeita conteudo vazio", () => {
    const resultado = insightSchema.safeParse({ id_contrato: 1, conteudo: "" });
    expect(resultado.success).toBe(false);
  });

  it("rejeita ausência de conteudo", () => {
    const resultado = insightSchema.safeParse({ id_contrato: 1 });
    expect(resultado.success).toBe(false);
  });

  // spec.md P2 AC5: Pilar é campo opcional
  it("aceita id_pilar nulo", () => {
    const resultado = insightSchema.safeParse({
      id_contrato: 1,
      conteudo: "Observação",
      id_pilar: null,
    });
    expect(resultado.success).toBe(true);
  });

  it("aceita desdobramentos/comprovacao_dados/ocorrido_em nulos", () => {
    const resultado = insightSchema.safeParse({
      id_contrato: 1,
      conteudo: "Observação",
      desdobramentos: null,
      comprovacao_dados: null,
      ocorrido_em: null,
    });
    expect(resultado.success).toBe(true);
  });
});
