import { describe, expect, it } from "vitest";

import { coalizaoSchema, membroCoalizaoSchema } from "./coalizao";

describe("coalizaoSchema", () => {
  it("aceita uma coalizão válida completa", () => {
    const resultado = coalizaoSchema.safeParse({
      id_projeto_origem: 1,
      possui_planejamento_proprio: true,
    });
    expect(resultado.success).toBe(true);
  });

  it("aceita possui_planejamento_proprio omitido (default é decidido pela RPC)", () => {
    const resultado = coalizaoSchema.safeParse({ id_projeto_origem: null });
    expect(resultado.success).toBe(true);
  });
});

describe("membroCoalizaoSchema", () => {
  // espelha ck_membro_grupo: (papel = 'grupo_trabalho') = (nome_grupo IS NOT NULL)
  it("aceita papel='grupo_trabalho' com nome_grupo preenchido", () => {
    const resultado = membroCoalizaoSchema.safeParse({
      papel: "grupo_trabalho",
      nome_grupo: "GT Clima",
      dt_entrada: "2026-01-01",
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita papel='grupo_trabalho' sem nome_grupo", () => {
    const resultado = membroCoalizaoSchema.safeParse({
      papel: "grupo_trabalho",
      dt_entrada: "2026-01-01",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita papel='membro' com nome_grupo preenchido", () => {
    const resultado = membroCoalizaoSchema.safeParse({
      papel: "membro",
      nome_grupo: "GT Clima",
      dt_entrada: "2026-01-01",
    });
    expect(resultado.success).toBe(false);
  });

  // espelha ck_membro_papel
  it("rejeita papel fora do domínio aprovado", () => {
    const resultado = membroCoalizaoSchema.safeParse({ papel: "coordenador" });
    expect(resultado.success).toBe(false);
  });

  // espelha ck_membro_periodo: dt_saida IS NULL OR dt_saida >= dt_entrada
  it("rejeita dt_saida anterior a dt_entrada", () => {
    const resultado = membroCoalizaoSchema.safeParse({
      papel: "membro",
      dt_entrada: "2026-06-01",
      dt_saida: "2026-01-01",
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita dt_saida igual a dt_entrada", () => {
    const resultado = membroCoalizaoSchema.safeParse({
      papel: "membro",
      dt_entrada: "2026-06-01",
      dt_saida: "2026-06-01",
    });
    expect(resultado.success).toBe(true);
  });
});
