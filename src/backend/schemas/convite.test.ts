import { describe, expect, it } from "vitest";

import { consumirSenhaSchema, convidarSchema } from "./convite";

describe("convidarSchema", () => {
  it("aceita um convite válido completo", () => {
    const resultado = convidarSchema.safeParse({
      email: "assessor@exemplo.com",
      papel_no_contrato: "assessor",
      cargo: "assessor",
      grau_responsabilidade: "titular",
      areas: ["saude", "educacao"],
    });
    expect(resultado.success).toBe(true);
  });

  // espelha ck_convite_papel (CVT-07) -- só mentor/assessor, nunca admin/gestora
  it("aceita mentor e assessor", () => {
    for (const papel of ["mentor", "assessor"]) {
      const resultado = convidarSchema.safeParse({ email: "x@y.com", papel_no_contrato: papel });
      expect(resultado.success).toBe(true);
    }
  });

  it("rejeita admin/gestora/leitura -- nunca cria papel privilegiado via convite", () => {
    for (const papel of ["admin", "gestora", "leitura"]) {
      const resultado = convidarSchema.safeParse({ email: "x@y.com", papel_no_contrato: papel });
      expect(resultado.success).toBe(false);
    }
  });

  // espelha ck_convite_email: email = lower(btrim(email)) AND email LIKE '%@%.%'
  it("rejeita e-mail com letras maiúsculas", () => {
    const resultado = convidarSchema.safeParse({ email: "Assessor@Exemplo.com", papel_no_contrato: "assessor" });
    expect(resultado.success).toBe(false);
  });

  it("rejeita e-mail com espaço nas bordas", () => {
    const resultado = convidarSchema.safeParse({ email: " x@y.com ", papel_no_contrato: "assessor" });
    expect(resultado.success).toBe(false);
  });

  it("rejeita e-mail sem ponto após o '@'", () => {
    const resultado = convidarSchema.safeParse({ email: "x@y", papel_no_contrato: "assessor" });
    expect(resultado.success).toBe(false);
  });

  // espelha ck_convite_cargo
  it("rejeita cargo fora do domínio aprovado", () => {
    const resultado = convidarSchema.safeParse({
      email: "x@y.com",
      papel_no_contrato: "assessor",
      cargo: "estagiario",
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita convite sem cargo/grau/áreas (todos opcionais)", () => {
    const resultado = convidarSchema.safeParse({ email: "x@y.com", papel_no_contrato: "mentor" });
    expect(resultado.success).toBe(true);
  });

  // espelha domínio texto_limpo (convite_contrato.grau_responsabilidade)
  it("rejeita grau_responsabilidade com sentinela de ausência", () => {
    const resultado = convidarSchema.safeParse({
      email: "x@y.com",
      papel_no_contrato: "assessor",
      grau_responsabilidade: "Não Informado",
    });
    expect(resultado.success).toBe(false);
  });
});

describe("consumirSenhaSchema", () => {
  it("aceita nome+senha+confirmarSenha válidos e iguais", () => {
    const resultado = consumirSenhaSchema.safeParse({
      nome: "Convidado Teste",
      senha: "senha123",
      confirmarSenha: "senha123",
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita quando senha e confirmarSenha não coincidem", () => {
    const resultado = consumirSenhaSchema.safeParse({
      nome: "Convidado Teste",
      senha: "senha123",
      confirmarSenha: "outraSenha",
    });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0].path).toEqual(["confirmarSenha"]);
    }
  });

  it("rejeita nome vazio", () => {
    const resultado = consumirSenhaSchema.safeParse({ nome: "", senha: "senha123", confirmarSenha: "senha123" });
    expect(resultado.success).toBe(false);
  });

  // espelha minimum_password_length = 6 (supabase/config.toml)
  it("rejeita senha com menos de 6 caracteres", () => {
    const resultado = consumirSenhaSchema.safeParse({ nome: "X", senha: "123", confirmarSenha: "123" });
    expect(resultado.success).toBe(false);
  });
});
