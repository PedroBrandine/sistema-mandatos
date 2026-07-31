import { describe, expect, it } from "vitest";

import { contratoSchema } from "./contrato";

describe("contratoSchema", () => {
  it("aceita um contrato ativo válido mínimo", () => {
    const resultado = contratoSchema.safeParse({
      id_produto: 1,
      dt_inicio: "2026-01-01",
      status: "ativo",
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita ausência de id_produto", () => {
    const resultado = contratoSchema.safeParse({
      dt_inicio: "2026-01-01",
      status: "ativo",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita ausência de dt_inicio", () => {
    const resultado = contratoSchema.safeParse({ id_produto: 1, status: "ativo" });
    expect(resultado.success).toBe(false);
  });

  // espelha ck_contrato_motivo + spec.md FND-CTR AC3 ("SHALL exigir
  // motivo_encerramento não vazio" quando status='nao_concluido')
  it("rejeita status='nao_concluido' sem motivo_encerramento", () => {
    const resultado = contratoSchema.safeParse({
      id_produto: 1,
      dt_inicio: "2026-01-01",
      status: "nao_concluido",
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita status='nao_concluido' com motivo_encerramento preenchido", () => {
    const resultado = contratoSchema.safeParse({
      id_produto: 1,
      dt_inicio: "2026-01-01",
      status: "nao_concluido",
      motivo_encerramento: "Mandato não reeleito",
    });
    expect(resultado.success).toBe(true);
  });

  it("aceita status='concluido' sem motivo_encerramento", () => {
    const resultado = contratoSchema.safeParse({
      id_produto: 1,
      dt_inicio: "2026-01-01",
      status: "concluido",
    });
    expect(resultado.success).toBe(true);
  });

  // espelha ck_contrato_status
  it("rejeita status fora do domínio aprovado", () => {
    const resultado = contratoSchema.safeParse({
      id_produto: 1,
      dt_inicio: "2026-01-01",
      status: "pausado",
    });
    expect(resultado.success).toBe(false);
  });

  // espelha ck_contrato_periodo: dt_fim IS NULL OR dt_inicio IS NULL OR dt_fim >= dt_inicio
  it("rejeita dt_fim anterior a dt_inicio", () => {
    const resultado = contratoSchema.safeParse({
      id_produto: 1,
      dt_inicio: "2026-06-01",
      dt_fim: "2026-01-01",
      status: "concluido",
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita dt_fim igual a dt_inicio", () => {
    const resultado = contratoSchema.safeParse({
      id_produto: 1,
      dt_inicio: "2026-06-01",
      dt_fim: "2026-06-01",
      status: "concluido",
    });
    expect(resultado.success).toBe(true);
  });

  // espelha ck_contrato_nao_e_proprio_anterior: id_contrato_anterior IS DISTINCT FROM id_contrato
  // (spec.md FND-CTR AC4: "Gestora tenta definir id_contrato_anterior como o
  // próprio contrato THEN o sistema SHALL rejeitar")
  it("rejeita id_contrato_anterior igual ao próprio id_contrato", () => {
    const resultado = contratoSchema.safeParse({
      id_contrato: 10,
      id_contrato_anterior: 10,
      id_produto: 1,
      dt_inicio: "2026-01-01",
      status: "ativo",
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita id_contrato_anterior diferente do próprio id_contrato", () => {
    const resultado = contratoSchema.safeParse({
      id_contrato: 10,
      id_contrato_anterior: 9,
      id_produto: 1,
      dt_inicio: "2026-01-01",
      status: "ativo",
    });
    expect(resultado.success).toBe(true);
  });

  // espelha ck_contrato_profundidade
  it("rejeita profundidade_impacto fora do domínio aprovado", () => {
    const resultado = contratoSchema.safeParse({
      id_produto: 1,
      dt_inicio: "2026-01-01",
      status: "ativo",
      profundidade_impacto: "baixo",
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita profundidade_impacto nulo", () => {
    const resultado = contratoSchema.safeParse({
      id_produto: 1,
      dt_inicio: "2026-01-01",
      status: "ativo",
      profundidade_impacto: null,
    });
    expect(resultado.success).toBe(true);
  });
});
