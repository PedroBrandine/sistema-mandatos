import { describe, expect, it } from "vitest";

import { rotuloSequencia, rotuloStatusContrato } from "./ficha-formatos";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, FMC-12 (AC8) e
// FMC-15 (AC2, A-13). Test Coverage Matrix (tasks.md, T16): um teste por
// valor do enum `ck_contrato_status` (lição L-003/L-010), não um caso
// representativo; e os 4 casos literais de rotuloSequencia do Done-when.

describe("rotuloStatusContrato (FMC-12 AC8)", () => {
  it("ativo -> 'Ativo'", () => {
    expect(rotuloStatusContrato("ativo")).toBe("Ativo");
  });

  it("concluido -> 'Concluído'", () => {
    expect(rotuloStatusContrato("concluido")).toBe("Concluído");
  });

  it("nao_concluido -> 'Não concluído'", () => {
    expect(rotuloStatusContrato("nao_concluido")).toBe("Não concluído");
  });

  it("nunca produz 'Em andamento' (divergência vetada pela spec)", () => {
    expect(rotuloStatusContrato("ativo")).not.toBe("Em andamento");
    expect(rotuloStatusContrato("concluido")).not.toBe("Em andamento");
    expect(rotuloStatusContrato("nao_concluido")).not.toBe("Em andamento");
  });
});

describe("rotuloSequencia (FMC-15 AC2, A-13)", () => {
  it("com qtdPrevista: 'nº 3 de 4'", () => {
    expect(rotuloSequencia(3, 4)).toBe("nº 3 de 4");
  });

  it("qtdPrevista nula: só 'nº 3'", () => {
    expect(rotuloSequencia(3, null)).toBe("nº 3");
  });

  it("nr nulo: null, independente de qtdPrevista", () => {
    expect(rotuloSequencia(null, 4)).toBeNull();
    expect(rotuloSequencia(null, null)).toBeNull();
  });

  it("nr = 1 com qtdPrevista = 1: 'nº 1 de 1' (não pluraliza, é numeral)", () => {
    expect(rotuloSequencia(1, 1)).toBe("nº 1 de 1");
  });
});
