import { describe, expect, it } from "vitest";

import { encontroSchema, participanteSchema } from "./encontro";

describe("encontroSchema", () => {
  it("aceita um encontro planejado válido com dt_prevista_inicio preenchida", () => {
    const resultado = encontroSchema.safeParse({
      id_contrato: 1,
      titulo: "Monitoramento mensal",
      status: "planejado",
      dt_prevista_inicio: "2026-09-01T10:00:00Z",
    });
    expect(resultado.success).toBe(true);
  });

  // espelha ck_encontro_planejado -- spec.md P2 AC1
  it("rejeita status='planejado' sem dt_prevista_inicio", () => {
    const resultado = encontroSchema.safeParse({
      id_contrato: 1,
      titulo: "Monitoramento mensal",
      status: "planejado",
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita um encontro realizado válido com dt_realizada preenchida", () => {
    const resultado = encontroSchema.safeParse({
      id_contrato: 1,
      titulo: "Monitoramento mensal",
      status: "realizado",
      dt_realizada: "2026-09-01T10:00:00Z",
    });
    expect(resultado.success).toBe(true);
  });

  // espelha ck_encontro_realizado -- spec.md P2 AC2
  it("rejeita status='realizado' sem dt_realizada", () => {
    const resultado = encontroSchema.safeParse({
      id_contrato: 1,
      titulo: "Monitoramento mensal",
      status: "realizado",
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita status='cancelado' sem nenhuma data", () => {
    const resultado = encontroSchema.safeParse({
      id_contrato: 1,
      titulo: "Monitoramento mensal",
      status: "cancelado",
    });
    expect(resultado.success).toBe(true);
  });

  it("aceita status='remarcado' sem nenhuma data", () => {
    const resultado = encontroSchema.safeParse({
      id_contrato: 1,
      titulo: "Monitoramento mensal",
      status: "remarcado",
    });
    expect(resultado.success).toBe(true);
  });

  // espelha ck_encontro_status
  it("rejeita status fora do domínio aprovado", () => {
    const resultado = encontroSchema.safeParse({
      id_contrato: 1,
      titulo: "Monitoramento mensal",
      status: "agendado",
    });
    expect(resultado.success).toBe(false);
  });

  // espelha ck_encontro_modalidade
  it("rejeita modalidade fora do domínio aprovado", () => {
    const resultado = encontroSchema.safeParse({
      id_contrato: 1,
      titulo: "Monitoramento mensal",
      status: "cancelado",
      modalidade: "hibrido",
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita modalidade nula", () => {
    const resultado = encontroSchema.safeParse({
      id_contrato: 1,
      titulo: "Monitoramento mensal",
      status: "cancelado",
      modalidade: null,
    });
    expect(resultado.success).toBe(true);
  });

  // espelha ck_encontro_sequencia
  it("rejeita nr_sequencia <= 0", () => {
    for (const valor of [0, -1]) {
      const resultado = encontroSchema.safeParse({
        id_contrato: 1,
        titulo: "Monitoramento mensal",
        status: "cancelado",
        nr_sequencia: valor,
      });
      expect(resultado.success).toBe(false);
    }
  });

  it("aceita nr_sequencia nulo", () => {
    const resultado = encontroSchema.safeParse({
      id_contrato: 1,
      titulo: "Monitoramento mensal",
      status: "cancelado",
      nr_sequencia: null,
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita ausência de id_contrato", () => {
    const resultado = encontroSchema.safeParse({ titulo: "Monitoramento mensal", status: "cancelado" });
    expect(resultado.success).toBe(false);
  });

  it("rejeita titulo vazio", () => {
    const resultado = encontroSchema.safeParse({ id_contrato: 1, titulo: "", status: "cancelado" });
    expect(resultado.success).toBe(false);
  });

  // espelha domínio texto_limpo (fat_encontro.local)
  it("rejeita local com sentinela de ausência", () => {
    const resultado = encontroSchema.safeParse({
      id_contrato: 1,
      titulo: "Monitoramento mensal",
      status: "cancelado",
      local: "N/A",
    });
    expect(resultado.success).toBe(false);
  });
});

describe("participanteSchema", () => {
  it("aceita participante identificado por id_usuario", () => {
    const resultado = participanteSchema.safeParse({
      id_encontro: 1,
      id_usuario: 5,
      origem: "legisla",
    });
    expect(resultado.success).toBe(true);
  });

  it("aceita participante identificado por nome_livre (externo)", () => {
    const resultado = participanteSchema.safeParse({
      id_encontro: 1,
      nome_livre: "Fulano de Tal",
      origem: "externo",
    });
    expect(resultado.success).toBe(true);
  });

  // espelha ck_participante_identificacao (XOR) -- spec.md P2 AC3
  it("rejeita participante com id_usuario e nome_livre preenchidos simultaneamente", () => {
    const resultado = participanteSchema.safeParse({
      id_encontro: 1,
      id_usuario: 5,
      nome_livre: "Fulano de Tal",
      origem: "legisla",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita participante sem id_usuario e sem nome_livre", () => {
    const resultado = participanteSchema.safeParse({ id_encontro: 1, origem: "legisla" });
    expect(resultado.success).toBe(false);
  });

  it("rejeita ausência de id_encontro", () => {
    const resultado = participanteSchema.safeParse({ id_usuario: 5, origem: "legisla" });
    expect(resultado.success).toBe(false);
  });

  // espelha ck_participante_origem
  it("rejeita origem fora do domínio aprovado", () => {
    const resultado = participanteSchema.safeParse({
      id_encontro: 1,
      id_usuario: 5,
      origem: "convidado",
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita presente ausente (DEFAULT true assume na coluna)", () => {
    const resultado = participanteSchema.safeParse({ id_encontro: 1, id_usuario: 5, origem: "legisla" });
    expect(resultado.success).toBe(true);
  });
});
