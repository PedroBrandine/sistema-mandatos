import { describe, expect, it } from "vitest";

import { contratanteSchema } from "./contratante";

describe("contratanteSchema", () => {
  it("aceita um contratante válido completo", () => {
    const resultado = contratanteSchema.safeParse({
      nome: "Frente Parlamentar Mista",
      sg_uf: "SP",
      nm_municipio: "São Paulo",
      id_partido_relacionado: 1,
      localizador_legado: "LEG-123",
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita nome vazio", () => {
    const resultado = contratanteSchema.safeParse({ nome: "" });
    expect(resultado.success).toBe(false);
  });

  it("aceita sg_uf nulo", () => {
    const resultado = contratanteSchema.safeParse({ nome: "X", sg_uf: null });
    expect(resultado.success).toBe(true);
  });

  // espelha ck_contratante_uf: sg_uf IS NULL OR sg_uf ~ '^[A-Z]{2}$'
  it("rejeita sg_uf em minúsculas", () => {
    const resultado = contratanteSchema.safeParse({ nome: "X", sg_uf: "sp" });
    expect(resultado.success).toBe(false);
  });

  it("rejeita sg_uf com mais de 2 letras", () => {
    const resultado = contratanteSchema.safeParse({ nome: "X", sg_uf: "SPX" });
    expect(resultado.success).toBe(false);
  });

  it("aceita nm_municipio nulo", () => {
    const resultado = contratanteSchema.safeParse({ nome: "X", nm_municipio: null });
    expect(resultado.success).toBe(true);
  });

  // espelha domínio texto_limpo (dim_contratante.nm_municipio)
  it("rejeita nm_municipio como string vazia", () => {
    const resultado = contratanteSchema.safeParse({ nome: "X", nm_municipio: "" });
    expect(resultado.success).toBe(false);
  });

  it("rejeita nm_municipio com sentinela de ausência (edge case do spec)", () => {
    const resultado = contratanteSchema.safeParse({
      nome: "X",
      nm_municipio: "Pendente de Atualização",
    });
    expect(resultado.success).toBe(false);
  });
});
