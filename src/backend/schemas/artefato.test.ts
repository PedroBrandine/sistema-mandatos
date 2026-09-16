import { describe, expect, it } from "vitest";

import { artefatoSchema } from "./artefato";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, FMC-17 (P1 Registro
// AC6/AC7) + design.md "Data Models" (fat_artefato, docs/schema_sistema.sql:931-948).

const TIPOS_ARTEFATO = [
  "termo_assinado",
  "mapa_politico",
  "escuta_diagnostica",
  "cronograma",
  "pre_planejamento",
  "mural",
  "organograma",
  "material_replicacao",
  "foto",
  "planilha_legada",
  "pasta_drive",
  "outro",
] as const;

describe("artefatoSchema", () => {
  it("aceita um artefato válido de escopo 'registro', com id_referencia e URL https", () => {
    const resultado = artefatoSchema.safeParse({
      id_contrato: 1,
      escopo: "registro",
      id_referencia: 42,
      tipo: "cronograma",
      url: "https://drive.google.com/x",
    });
    expect(resultado.success).toBe(true);
  });

  // ck_artefato_url: url ~* '^https?://'
  it("aceita URL começando com http://", () => {
    const resultado = artefatoSchema.safeParse({
      id_contrato: 1,
      escopo: "registro",
      id_referencia: 42,
      tipo: "cronograma",
      url: "http://drive.google.com/x",
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita URL que não começa com http:// nem https:// (ck_artefato_url)", () => {
    const resultado = artefatoSchema.safeParse({
      id_contrato: 1,
      escopo: "registro",
      id_referencia: 42,
      tipo: "cronograma",
      url: "drive.google.com/x",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita URL com esquema ftp:// (ck_artefato_url)", () => {
    const resultado = artefatoSchema.safeParse({
      id_contrato: 1,
      escopo: "registro",
      id_referencia: 42,
      tipo: "cronograma",
      url: "ftp://drive.google.com/x",
    });
    expect(resultado.success).toBe(false);
  });

  // ck_artefato_tipo -- um teste por valor do enum (lição L-003/L-010)
  it.each(TIPOS_ARTEFATO)("aceita tipo='%s'", (tipo) => {
    const resultado = artefatoSchema.safeParse({
      id_contrato: 1,
      escopo: "registro",
      id_referencia: 42,
      tipo,
      url: "https://drive.google.com/x",
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita tipo fora do domínio aprovado (ck_artefato_tipo)", () => {
    const resultado = artefatoSchema.safeParse({
      id_contrato: 1,
      escopo: "registro",
      id_referencia: 42,
      tipo: "assinatura_biometrica",
      url: "https://drive.google.com/x",
    });
    expect(resultado.success).toBe(false);
  });

  // ck_artefato_escopo -- um teste por valor do enum
  it.each(["registro", "submissao", "encontro", "etapa"])(
    "aceita escopo='%s' com id_referencia preenchido",
    (escopo) => {
      const resultado = artefatoSchema.safeParse({
        id_contrato: 1,
        escopo,
        id_referencia: 42,
        tipo: "outro",
        url: "https://drive.google.com/x",
      });
      expect(resultado.success).toBe(true);
    }
  );

  it("rejeita escopo fora do domínio aprovado (ck_artefato_escopo)", () => {
    const resultado = artefatoSchema.safeParse({
      id_contrato: 1,
      escopo: "mandato",
      id_referencia: 42,
      tipo: "outro",
      url: "https://drive.google.com/x",
    });
    expect(resultado.success).toBe(false);
  });

  // ck_artefato_referencia: (escopo = 'contrato') = (id_referencia IS NULL)
  it("aceita escopo='contrato' com id_referencia nulo", () => {
    const resultado = artefatoSchema.safeParse({
      id_contrato: 1,
      escopo: "contrato",
      id_referencia: null,
      tipo: "outro",
      url: "https://drive.google.com/x",
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita escopo='contrato' com id_referencia preenchido (ck_artefato_referencia)", () => {
    const resultado = artefatoSchema.safeParse({
      id_contrato: 1,
      escopo: "contrato",
      id_referencia: 42,
      tipo: "outro",
      url: "https://drive.google.com/x",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita escopo='registro' sem id_referencia (ck_artefato_referencia)", () => {
    const resultado = artefatoSchema.safeParse({
      id_contrato: 1,
      escopo: "registro",
      tipo: "outro",
      url: "https://drive.google.com/x",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita ausência de id_contrato", () => {
    const resultado = artefatoSchema.safeParse({
      escopo: "registro",
      id_referencia: 42,
      tipo: "outro",
      url: "https://drive.google.com/x",
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita descricao nula", () => {
    const resultado = artefatoSchema.safeParse({
      id_contrato: 1,
      escopo: "registro",
      id_referencia: 42,
      tipo: "outro",
      url: "https://drive.google.com/x",
      descricao: null,
    });
    expect(resultado.success).toBe(true);
  });

  // espelha domínio texto_limpo (fat_artefato.descricao)
  it("rejeita descricao com sentinela de ausência", () => {
    const resultado = artefatoSchema.safeParse({
      id_contrato: 1,
      escopo: "registro",
      id_referencia: 42,
      tipo: "outro",
      url: "https://drive.google.com/x",
      descricao: "N/A",
    });
    expect(resultado.success).toBe(false);
  });
});
