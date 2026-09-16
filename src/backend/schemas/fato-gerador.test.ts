import { describe, expect, it } from "vitest";

import { fatoGeradorSchema } from "./fato-gerador";

// Spec anchor: fatos-geradores-ciclo-vida T8 Done-when (.specs/features/fatos-geradores-ciclo-vida/tasks.md)
// -- FGC-06/FGC-09/FGC-15: titulo/situacao/dt_prevista/id_pre_insight_origem/id_registro_origem
// novos + refine condicional de situacao/dt_ocorrencia/dt_prevista (spec.md P1 AC10/AC11).
// Todo teste pré-existente (niveis/preditores/contribuicao) ganhou titulo + situacao (agora
// campos obrigatórios no schema) para continuar válido -- a asserção e o comportamento testado
// não mudaram.

describe("fatoGeradorSchema", () => {
  it("aceita um fato gerador válido mínimo (só nivel_d1 preenchido)", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      id_tipologia: 2,
      titulo: "Aprovação do projeto de lei",
      situacao: "realizado",
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
      titulo: "Aprovação do projeto de lei",
      situacao: "realizado",
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
      titulo: "Aprovação do projeto de lei",
      situacao: "realizado",
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
      titulo: "Aprovação do projeto de lei",
      situacao: "realizado",
      nivel_d1: "alto",
      dt_ocorrencia: "2026-08-14",
      id_insight_origem: 8,
    });
    expect(resultado.success).toBe(true);
  });

  // FGC-15/spec.md P2 "Registro e Pré-Insight como origem" AC1: rel_fato_origem
  // ganha id_pre_insight/id_registro, ambos nullable -- schema aceita como as
  // demais 2 origens já existentes.
  it("aceita um fato gerador válido com Pré-Insight de origem", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      id_tipologia: 2,
      titulo: "Aprovação do projeto de lei",
      situacao: "realizado",
      nivel_d1: "alto",
      dt_ocorrencia: "2026-08-14",
      id_pre_insight_origem: 9,
    });
    expect(resultado.success).toBe(true);
  });

  it("aceita um fato gerador válido com Registro de origem", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      id_tipologia: 2,
      titulo: "Aprovação do projeto de lei",
      situacao: "realizado",
      nivel_d1: "alto",
      dt_ocorrencia: "2026-08-14",
      id_registro_origem: 11,
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita ausência de id_contrato", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_tipologia: 2,
      titulo: "Aprovação do projeto de lei",
      situacao: "realizado",
      nivel_d1: "alto",
      dt_ocorrencia: "2026-08-14",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita ausência de id_tipologia", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      titulo: "Aprovação do projeto de lei",
      situacao: "realizado",
      nivel_d1: "alto",
      dt_ocorrencia: "2026-08-14",
    });
    expect(resultado.success).toBe(false);
  });

  // FGC-09: titulo obrigatório no client mesmo com a coluna nullable no banco
  // (design.md Tech Decisions "titulo nullable").
  it("rejeita ausência de titulo", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      id_tipologia: 2,
      situacao: "realizado",
      nivel_d1: "alto",
      dt_ocorrencia: "2026-08-14",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita titulo vazio", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      id_tipologia: 2,
      titulo: "",
      situacao: "realizado",
      nivel_d1: "alto",
      dt_ocorrencia: "2026-08-14",
    });
    expect(resultado.success).toBe(false);
  });

  // ck_fato_situacao_data ramo "realizado" (spec.md P1 AC10): exige dt_ocorrencia.
  it("rejeita situacao=realizado sem dt_ocorrencia", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      id_tipologia: 2,
      titulo: "Aprovação do projeto de lei",
      situacao: "realizado",
      nivel_d1: "alto",
    });
    expect(resultado.success).toBe(false);
  });

  // ck_fato_situacao_data ramo "projetado" (spec.md P1 AC11): exige dt_prevista.
  it("rejeita situacao=projetado sem dt_prevista", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      id_tipologia: 2,
      titulo: "Sanção esperada do projeto de lei",
      situacao: "projetado",
      nivel_d1: "alto",
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita situacao=projetado com dt_prevista, sem dt_ocorrencia", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      id_tipologia: 2,
      titulo: "Sanção esperada do projeto de lei",
      situacao: "projetado",
      nivel_d1: "alto",
      dt_prevista: "2026-12-01",
    });
    expect(resultado.success).toBe(true);
  });

  // spec.md P1 AC11: "SHALL NOT pedir data de ocorrência" -- projetado com
  // dt_ocorrencia preenchida é inválido, mesmo com dt_prevista presente.
  it("rejeita situacao=projetado com dt_ocorrencia preenchida", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      id_tipologia: 2,
      titulo: "Sanção esperada do projeto de lei",
      situacao: "projetado",
      nivel_d1: "alto",
      dt_prevista: "2026-12-01",
      dt_ocorrencia: "2026-08-14",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita ausência de situacao", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      id_tipologia: 2,
      titulo: "Aprovação do projeto de lei",
      nivel_d1: "alto",
      dt_ocorrencia: "2026-08-14",
    });
    expect(resultado.success).toBe(false);
  });

  // espelha ck_fato_niveis -- spec.md P1 AC2
  it("rejeita nenhum nível preenchido (nivel_d1/d2/d3 todos ausentes)", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      id_tipologia: 2,
      titulo: "Aprovação do projeto de lei",
      situacao: "realizado",
      dt_ocorrencia: "2026-08-14",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita nenhum nível preenchido (nivel_d1/d2/d3 todos null)", () => {
    const resultado = fatoGeradorSchema.safeParse({
      id_contrato: 1,
      id_tipologia: 2,
      titulo: "Aprovação do projeto de lei",
      situacao: "realizado",
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
        titulo: "Aprovação do projeto de lei",
        situacao: "realizado",
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
      titulo: "Aprovação do projeto de lei",
      situacao: "realizado",
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
      titulo: "Aprovação do projeto de lei",
      situacao: "realizado",
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
      titulo: "Aprovação do projeto de lei",
      situacao: "realizado",
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
      titulo: "Aprovação do projeto de lei",
      situacao: "realizado",
      nivel_d1: "alto",
      dt_ocorrencia: "2026-08-14",
      id_preditor_1: 3,
      id_preditor_2: 4,
    });
    expect(resultado.success).toBe(true);
  });
});
