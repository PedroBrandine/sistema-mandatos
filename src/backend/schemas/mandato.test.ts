import { describe, expect, it } from "vitest";

import { mandatoSchema } from "./mandato";

describe("mandatoSchema", () => {
  it("aceita um mandato válido completo", () => {
    const resultado = mandatoSchema.safeParse({
      nr_titulo_eleitoral: "123456789012",
      nm_civil: "Fulano de Tal",
      ds_raca: "Parda",
      fl_pcd: false,
    });
    expect(resultado.success).toBe(true);
  });

  it("aceita nr_titulo_eleitoral nulo (mandato sem candidatura confirmada)", () => {
    const resultado = mandatoSchema.safeParse({ nr_titulo_eleitoral: null });
    expect(resultado.success).toBe(true);
  });

  // espelha ck_mandato_titulo
  it("aceita nr_titulo_eleitoral com 12 dígitos", () => {
    const resultado = mandatoSchema.safeParse({ nr_titulo_eleitoral: "000000000001" });
    expect(resultado.success).toBe(true);
  });

  // edge case explícito do spec.md: "editar nr_titulo_eleitoral para valor com
  // CPF (11 dígitos) THEN o sistema SHALL rejeitar"
  it("rejeita nr_titulo_eleitoral com 11 dígitos (CPF)", () => {
    const resultado = mandatoSchema.safeParse({ nr_titulo_eleitoral: "12345678901" });
    expect(resultado.success).toBe(false);
  });

  it("rejeita nr_titulo_eleitoral não numérico", () => {
    const resultado = mandatoSchema.safeParse({ nr_titulo_eleitoral: "abcdefghijkl" });
    expect(resultado.success).toBe(false);
  });

  it("aceita ds_raca nulo", () => {
    const resultado = mandatoSchema.safeParse({ ds_raca: null });
    expect(resultado.success).toBe(true);
  });

  // espelha ck_mandato_raca
  it("aceita cada valor válido de ds_raca", () => {
    for (const valor of ["Branca", "Preta", "Parda", "Amarela", "Indígena"]) {
      expect(mandatoSchema.safeParse({ ds_raca: valor }).success).toBe(true);
    }
  });

  it("rejeita ds_raca fora do domínio aprovado", () => {
    const resultado = mandatoSchema.safeParse({ ds_raca: "Outra" });
    expect(resultado.success).toBe(false);
  });

  // espelha domínio texto_limpo (dim_mandato.nm_civil)
  it("rejeita nm_civil com sentinela de ausência", () => {
    const resultado = mandatoSchema.safeParse({ nm_civil: "N/A" });
    expect(resultado.success).toBe(false);
  });

  it("rejeita nm_civil como string vazia", () => {
    const resultado = mandatoSchema.safeParse({ nm_civil: "" });
    expect(resultado.success).toBe(false);
  });
});
