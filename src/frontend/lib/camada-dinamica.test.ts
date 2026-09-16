import { describe, expect, it } from "vitest";

import { parseSchemaCampos } from "./camada-dinamica";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, FMC-16 (P1 Registro
// AC4/AC5) + edge case "tipo que a UI não conhece" + design.md "Contrato de
// ref_tipo_registro.schema_campos".

describe("parseSchemaCampos", () => {
  it("aceita os 5 tipos conhecidos e preserva chave/rotulo/tipo de cada um", () => {
    const resultado = parseSchemaCampos({
      versao: 1,
      campos: [
        { chave: "resumo_curto", rotulo: "Resumo curto", tipo: "texto_curto" },
        { chave: "adequacoes", rotulo: "Adequações a serem realizadas", tipo: "texto_longo" },
        { chave: "organograma", rotulo: "Organograma", tipo: "link", artefato_tipo: "organograma" },
        { chave: "local", rotulo: "Local", tipo: "leitura_encontro", origem: "local" },
        { chave: "fotos", rotulo: "Fotos", tipo: "arquivo", artefato_tipo: "foto", estado: "em_desenvolvimento" },
      ],
    });

    expect(resultado.campos).toHaveLength(5);
    expect(resultado.campos.map((c) => c.tipo)).toEqual([
      "texto_curto",
      "texto_longo",
      "link",
      "leitura_encontro",
      "arquivo",
    ]);
    expect(resultado.ignorados).toEqual([]);
  });

  it("campo do tipo link inclui artefatoTipo do enum ck_artefato_tipo", () => {
    const resultado = parseSchemaCampos({
      versao: 1,
      campos: [{ chave: "organograma", rotulo: "Organograma", tipo: "link", artefato_tipo: "organograma" }],
    });

    expect(resultado.campos[0]).toMatchObject({ tipo: "link", artefatoTipo: "organograma" });
  });

  it("campo do tipo leitura_encontro inclui origem (chave lida de fat_encontro)", () => {
    const resultado = parseSchemaCampos({
      versao: 1,
      campos: [{ chave: "local", rotulo: "Local", tipo: "leitura_encontro", origem: "local" }],
    });

    expect(resultado.campos[0]).toMatchObject({ tipo: "leitura_encontro", origem: "local" });
  });

  it("campo do tipo arquivo preserva o estado em_desenvolvimento (FMC-22)", () => {
    const resultado = parseSchemaCampos({
      versao: 1,
      campos: [{ chave: "fotos", rotulo: "Fotos", tipo: "arquivo", estado: "em_desenvolvimento" }],
    });

    expect(resultado.campos[0]).toMatchObject({ tipo: "arquivo", estado: "em_desenvolvimento" });
  });

  it("campo de tipo desconhecido vai para ignorados, nunca lança (edge case da spec)", () => {
    expect(() =>
      parseSchemaCampos({
        versao: 1,
        campos: [{ chave: "assinatura_biometrica", rotulo: "Assinatura biométrica", tipo: "assinatura" }],
      })
    ).not.toThrow();

    const resultado = parseSchemaCampos({
      versao: 1,
      campos: [{ chave: "assinatura_biometrica", rotulo: "Assinatura biométrica", tipo: "assinatura" }],
    });

    expect(resultado.campos).toEqual([]);
    expect(resultado.ignorados).toEqual(["assinatura_biometrica"]);
  });

  it("mistura campo válido e campo de tipo desconhecido: preserva o válido, ignora o outro", () => {
    const resultado = parseSchemaCampos({
      versao: 1,
      campos: [
        { chave: "adequacoes", rotulo: "Adequações a serem realizadas", tipo: "texto_longo" },
        { chave: "assinatura_biometrica", rotulo: "Assinatura biométrica", tipo: "assinatura" },
      ],
    });

    expect(resultado.campos).toEqual([
      { chave: "adequacoes", rotulo: "Adequações a serem realizadas", tipo: "texto_longo", obrigatorio: undefined, artefatoTipo: undefined, origem: undefined, estado: undefined },
    ]);
    expect(resultado.ignorados).toEqual(["assinatura_biometrica"]);
  });

  it("versao diferente de 1 devolve campos vazio e uma entrada em ignorados", () => {
    const resultado = parseSchemaCampos({ versao: 2, campos: [{ chave: "x", rotulo: "X", tipo: "texto_curto" }] });

    expect(resultado.campos).toEqual([]);
    expect(resultado.ignorados).toHaveLength(1);
  });

  it("JSON malformado (string inválida) devolve lista vazia sem lançar", () => {
    expect(() => parseSchemaCampos("{ isto não é json")).not.toThrow();

    const resultado = parseSchemaCampos("{ isto não é json");
    expect(resultado).toEqual({ campos: [], ignorados: [] });
  });

  it("null devolve lista vazia sem lançar", () => {
    expect(() => parseSchemaCampos(null)).not.toThrow();
    expect(parseSchemaCampos(null)).toEqual({ campos: [], ignorados: [] });
  });

  it("{} devolve lista vazia sem lançar", () => {
    expect(() => parseSchemaCampos({})).not.toThrow();
    expect(parseSchemaCampos({})).toEqual({ campos: [], ignorados: [] });
  });

  it("versao=1 sem array campos devolve lista vazia sem lançar", () => {
    expect(() => parseSchemaCampos({ versao: 1 })).not.toThrow();
    expect(parseSchemaCampos({ versao: 1 })).toEqual({ campos: [], ignorados: [] });
  });
});
