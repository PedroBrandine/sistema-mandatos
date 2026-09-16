import { describe, expect, it } from "vitest";

import { rotulaCadeias, type ItemCadeia } from "./incidencia-cadeia";

// Spec anchor: fatos-geradores-ciclo-vida T14 Done-when (.specs/features/fatos-geradores-ciclo-vida/tasks.md)
// -- spec.md P2 "Ciclo de Vida com cadeias" AC1-AC5, AD-053 (letra é gerada no render, nunca
// persistida). 4 cenários exigidos: cadeia de 1 fato, N-fatos-origem-comum, cadeia direta no
// fato (sem rel_fato_origem), cadeia só-projetada isolada numa seção própria.

function item(parcial: Partial<ItemCadeia>): ItemCadeia {
  return {
    idFatoGerador: 1,
    titulo: "Fato",
    situacao: "realizado",
    dataEvento: "2026-08-01",
    chaveOrigem: "insight:5",
    ...parcial,
  };
}

describe("rotulaCadeias", () => {
  it("retorna listas vazias para uma lista vazia", () => {
    expect(rotulaCadeias([])).toEqual({ realizadas: [], projetadas: [] });
  });

  // Cenário 1: cadeia de 1 fato (uma origem, um único Fato Gerador vinculado).
  it("cadeia de 1 fato: origemComum é false e o rótulo é gerado (Cadeia A)", () => {
    const resultado = rotulaCadeias([item({ idFatoGerador: 1, chaveOrigem: "insight:5" })]);

    expect(resultado.realizadas).toEqual([
      { rotulo: "Cadeia A", origemComum: false, itens: [item({ idFatoGerador: 1, chaveOrigem: "insight:5" })] },
    ]);
  });

  // Cenário 2: N-fatos-origem-comum -- spec.md P2 AC3 "Origem comum".
  it("agrupa N fatos com a mesma origem e marca origemComum=true", () => {
    const resultado = rotulaCadeias([
      item({ idFatoGerador: 1, chaveOrigem: "insight:5" }),
      item({ idFatoGerador: 2, chaveOrigem: "insight:5" }),
      item({ idFatoGerador: 3, chaveOrigem: "insight:5" }),
    ]);

    expect(resultado.realizadas).toHaveLength(1);
    expect(resultado.realizadas[0].origemComum).toBe(true);
    expect(resultado.realizadas[0].itens.map((i) => i.idFatoGerador)).toEqual([1, 2, 3]);
  });

  // Cenário 3: cadeia direta no fato -- vw_cadeia_incidencia usa "fato:<id>" quando não há
  // linha em rel_fato_origem (T5). spec.md P2 AC4: exibida normalmente, sem marca de
  // incompletude -- aqui isso significa origemComum=false, igual a qualquer cadeia unitária.
  it("cadeia direta no fato (chaveOrigem='fato:<id>', sem rel_fato_origem) é exibida sem marca de incompletude", () => {
    const resultado = rotulaCadeias([item({ idFatoGerador: 9, chaveOrigem: "fato:9" })]);

    expect(resultado.realizadas[0]).toEqual({
      rotulo: "Cadeia A",
      origemComum: false,
      itens: [item({ idFatoGerador: 9, chaveOrigem: "fato:9" })],
    });
  });

  // Cenário 4: cadeia só-projetada isolada em seção própria (spec.md P2 AC5).
  it("separa cadeia com todos os fatos projetados na seção 'projetadas'", () => {
    const resultado = rotulaCadeias([
      item({ idFatoGerador: 1, chaveOrigem: "insight:5", situacao: "realizado" }),
      item({ idFatoGerador: 2, chaveOrigem: "registro:7", situacao: "projetado" }),
    ]);

    expect(resultado.realizadas).toHaveLength(1);
    expect(resultado.realizadas[0].itens.map((i) => i.idFatoGerador)).toEqual([1]);
    expect(resultado.projetadas).toHaveLength(1);
    expect(resultado.projetadas[0].itens.map((i) => i.idFatoGerador)).toEqual([2]);
  });

  // spec.md P2 AC5: "contém apenas fatos projetados" -- cadeia com mistura de situação (ao
  // menos 1 realizado) não entra na seção projetada, mesmo tendo membro projetado.
  it("cadeia com mistura de situação (nem todos projetados) permanece em realizadas", () => {
    const resultado = rotulaCadeias([
      item({ idFatoGerador: 1, chaveOrigem: "meta:3", situacao: "realizado" }),
      item({ idFatoGerador: 2, chaveOrigem: "meta:3", situacao: "projetado" }),
    ]);

    expect(resultado.realizadas).toHaveLength(1);
    expect(resultado.projetadas).toHaveLength(0);
  });

  // AD-053: a letra nunca vem de um campo do item de entrada -- ItemCadeia não tem nenhum
  // campo de rótulo/letra, e a ordem de chegada (não um id) decide a posição.
  it("gera as letras a partir da posição de chegada, nunca de um campo do dado (AD-053)", () => {
    const resultado = rotulaCadeias([
      item({ idFatoGerador: 1, chaveOrigem: "insight:5" }),
      item({ idFatoGerador: 2, chaveOrigem: "meta:3" }),
      item({ idFatoGerador: 3, chaveOrigem: "registro:7" }),
    ]);

    expect(resultado.realizadas.map((c) => c.rotulo)).toEqual(["Cadeia A", "Cadeia B", "Cadeia C"]);
  });
});
