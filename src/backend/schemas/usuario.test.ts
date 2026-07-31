import { describe, expect, it } from "vitest";

import { usuarioSchema } from "./usuario";

describe("usuarioSchema", () => {
  it("aceita um usuário válido completo", () => {
    const resultado = usuarioSchema.safeParse({
      email: "mentor@legislabrasil.org",
      nome: "Mentor Um",
      papel_global: "mentor",
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita nome vazio", () => {
    const resultado = usuarioSchema.safeParse({
      email: "x@y.com",
      nome: "",
      papel_global: "assessor",
    });
    expect(resultado.success).toBe(false);
  });

  // espelha ck_usuario_papel
  it("aceita cada valor válido de papel_global", () => {
    for (const papel of ["admin", "gestora", "mentor", "assessor"]) {
      const resultado = usuarioSchema.safeParse({
        email: "x@y.com",
        nome: "X",
        papel_global: papel,
      });
      expect(resultado.success).toBe(true);
    }
  });

  it("rejeita papel_global fora do domínio aprovado", () => {
    const resultado = usuarioSchema.safeParse({
      email: "x@y.com",
      nome: "X",
      papel_global: "estagiario",
    });
    expect(resultado.success).toBe(false);
  });

  // espelha ck_usuario_email: email = lower(btrim(email)) AND email LIKE '%@%.%'
  it("rejeita e-mail com letras maiúsculas", () => {
    const resultado = usuarioSchema.safeParse({
      email: "Mentor@Legislabrasil.org",
      nome: "X",
      papel_global: "mentor",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita e-mail com espaço nas bordas", () => {
    const resultado = usuarioSchema.safeParse({
      email: " mentor@legislabrasil.org ",
      nome: "X",
      papel_global: "mentor",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita e-mail sem ponto após o '@'", () => {
    const resultado = usuarioSchema.safeParse({
      email: "mentor@legislabrasil",
      nome: "X",
      papel_global: "mentor",
    });
    expect(resultado.success).toBe(false);
  });

  // espelha domínio texto_limpo (dim_usuario.telefone)
  it("rejeita telefone com sentinela de ausência", () => {
    const resultado = usuarioSchema.safeParse({
      email: "x@y.com",
      nome: "X",
      papel_global: "mentor",
      telefone: "Não Informado",
    });
    expect(resultado.success).toBe(false);
  });
});
