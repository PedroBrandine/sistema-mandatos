import { describe, expect, it } from "vitest";

import { registroSchema } from "./registro";

describe("registroSchema", () => {
  it("aceita um registro válido mínimo", () => {
    const resultado = registroSchema.safeParse({
      id_contrato: 1,
      id_tipo_registro: 2,
      ocorrido_em: "2026-08-14T12:00:00Z",
    });
    expect(resultado.success).toBe(true);
  });

  it("aceita um registro válido completo, com conteudo = {} (spec.md P1 AC5)", () => {
    const resultado = registroSchema.safeParse({
      id_contrato: 1,
      id_tipo_registro: 2,
      nr_sequencia: 3,
      id_encontro: 4,
      ocorrido_em: "2026-08-14T12:00:00Z",
      canal: "presencial",
      resumo: "Reunião de monitoramento mensal",
      conteudo: {},
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita ausência de id_contrato", () => {
    const resultado = registroSchema.safeParse({
      id_tipo_registro: 2,
      ocorrido_em: "2026-08-14T12:00:00Z",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita ausência de id_tipo_registro", () => {
    const resultado = registroSchema.safeParse({
      id_contrato: 1,
      ocorrido_em: "2026-08-14T12:00:00Z",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita ausência de ocorrido_em", () => {
    const resultado = registroSchema.safeParse({ id_contrato: 1, id_tipo_registro: 2 });
    expect(resultado.success).toBe(false);
  });

  // espelha ck_registro_canal
  it("rejeita canal fora do domínio aprovado", () => {
    const resultado = registroSchema.safeParse({
      id_contrato: 1,
      id_tipo_registro: 2,
      ocorrido_em: "2026-08-14T12:00:00Z",
      canal: "whatsapp",
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita canal nulo", () => {
    const resultado = registroSchema.safeParse({
      id_contrato: 1,
      id_tipo_registro: 2,
      ocorrido_em: "2026-08-14T12:00:00Z",
      canal: null,
    });
    expect(resultado.success).toBe(true);
  });

  // espelha ck_registro_sequencia
  it("rejeita nr_sequencia <= 0", () => {
    for (const valor of [0, -1]) {
      const resultado = registroSchema.safeParse({
        id_contrato: 1,
        id_tipo_registro: 2,
        ocorrido_em: "2026-08-14T12:00:00Z",
        nr_sequencia: valor,
      });
      expect(resultado.success).toBe(false);
    }
  });

  it("aceita nr_sequencia nulo", () => {
    const resultado = registroSchema.safeParse({
      id_contrato: 1,
      id_tipo_registro: 2,
      ocorrido_em: "2026-08-14T12:00:00Z",
      nr_sequencia: null,
    });
    expect(resultado.success).toBe(true);
  });
});
