import { describe, expect, it } from "vitest";

import { vinculoSchema } from "./vinculo";

describe("vinculoSchema", () => {
  it("aceita um vínculo válido completo", () => {
    const resultado = vinculoSchema.safeParse({
      id_contrato: 1,
      id_usuario: 1,
      papel_no_contrato: "mentor",
      cargo: "chefe_gabinete",
      dt_inicio: "2026-01-01",
    });
    expect(resultado.success).toBe(true);
  });

  // espelha ck_vinculo_papel
  it("rejeita papel_no_contrato fora do domínio aprovado", () => {
    const resultado = vinculoSchema.safeParse({
      id_contrato: 1,
      id_usuario: 1,
      papel_no_contrato: "estagiario",
    });
    expect(resultado.success).toBe(false);
  });

  // espelha ck_vinculo_cargo
  it("rejeita cargo fora do domínio aprovado", () => {
    const resultado = vinculoSchema.safeParse({
      id_contrato: 1,
      id_usuario: 1,
      papel_no_contrato: "assessor",
      cargo: "coordenador",
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita cargo nulo", () => {
    const resultado = vinculoSchema.safeParse({
      id_contrato: 1,
      id_usuario: 1,
      papel_no_contrato: "assessor",
      cargo: null,
    });
    expect(resultado.success).toBe(true);
  });

  // espelha ck_vinculo_periodo: dt_fim IS NULL OR dt_fim >= dt_inicio
  it("rejeita dt_fim anterior a dt_inicio", () => {
    const resultado = vinculoSchema.safeParse({
      id_contrato: 1,
      id_usuario: 1,
      papel_no_contrato: "assessor",
      dt_inicio: "2026-06-01",
      dt_fim: "2026-01-01",
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita dt_fim igual a dt_inicio", () => {
    const resultado = vinculoSchema.safeParse({
      id_contrato: 1,
      id_usuario: 1,
      papel_no_contrato: "assessor",
      dt_inicio: "2026-06-01",
      dt_fim: "2026-06-01",
    });
    expect(resultado.success).toBe(true);
  });

  // espelha domínio texto_limpo (rel_usuario_contrato.grau_responsabilidade)
  it("rejeita grau_responsabilidade com sentinela de ausência", () => {
    const resultado = vinculoSchema.safeParse({
      id_contrato: 1,
      id_usuario: 1,
      papel_no_contrato: "assessor",
      grau_responsabilidade: "N/A",
    });
    expect(resultado.success).toBe(false);
  });
});
