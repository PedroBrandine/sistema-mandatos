import { describe, expect, it } from "vitest";

import type { PessoaVinculada } from "@backend/queries/planejamento";

import { resolveResponsavel } from "./planejamento-responsavel";

// Spec anchor: PLV-03 AC2-AC5
// (.specs/features/planejamento-estrategico-v2/spec.md:177) -- a coluna RESP. da
// grade mostra quem de fato toca aquela entrega: o responsável próprio do
// Sucesso Mensal, ou o da Meta marcado como herdado, ou "—".
//
// A herança é de EXIBIÇÃO, nunca gravada: id_usuario_responsavel do SM continua
// nulo quando ele herda. Persistir o herdado congelaria a resposta -- trocar o
// responsável da Meta deixaria de reverberar nos SMs que nunca tiveram um.

const JOANA: PessoaVinculada = { idUsuario: 1, nome: "Joana Martins", papelNoContrato: "assessor" };
const MARCOS: PessoaVinculada = { idUsuario: 2, nome: "Marcos Silva", papelNoContrato: "mentor" };
const EQUIPE = [JOANA, MARCOS];

describe("resolveResponsavel — os 4 casos da PLV-03", () => {
  it("responsável próprio do SM aparece, e não é herdado (AC2)", () => {
    expect(resolveResponsavel(1, 2, EQUIPE)).toEqual({
      pessoa: { idUsuario: 1, nome: "Joana Martins" },
      herdado: false,
    });
  });

  it("sem responsável próprio, herda o da Meta e marca como herdado (AC3)", () => {
    expect(resolveResponsavel(null, 2, EQUIPE)).toEqual({
      pessoa: { idUsuario: 2, nome: "Marcos Silva" },
      herdado: true,
    });
  });

  it("nem SM nem Meta têm responsável: pessoa nula, para a grade mostrar — (AC4)", () => {
    // AD-005: ausência é null, nunca "N/A" nem string vazia.
    expect(resolveResponsavel(null, null, EQUIPE)).toEqual({ pessoa: null, herdado: false });
  });

  it("pessoa sem vínculo ativo continua aparecendo, com nome nulo (AC5)", () => {
    // O vínculo pode ter terminado depois da atribuição. Devolver pessoa nula
    // aqui diria "ninguém responsável" onde a verdade é "alguém responsável,
    // fora da equipe atual" -- some com a atribuição em vez de sinalizá-la.
    // O picker é que se limita à equipe ativa; a leitura não.
    expect(resolveResponsavel(99, null, EQUIPE)).toEqual({
      pessoa: { idUsuario: 99, nome: null },
      herdado: false,
    });
  });
});

describe("resolveResponsavel — precedência e bordas", () => {
  it("o próprio vence o da Meta quando os dois existem", () => {
    const { pessoa, herdado } = resolveResponsavel(1, 2, EQUIPE);
    expect(pessoa?.idUsuario).toBe(1);
    expect(herdado).toBe(false);
  });

  it("próprio igual ao da Meta ainda é próprio, não herdado", () => {
    // A mesma pessoa nos dois lugares é atribuição explícita que coincide --
    // se virasse "herdado", tirar o responsável da Meta apagaria da grade um
    // responsável que o SM tem gravado.
    expect(resolveResponsavel(2, 2, EQUIPE)).toEqual({
      pessoa: { idUsuario: 2, nome: "Marcos Silva" },
      herdado: false,
    });
  });

  it("responsável da Meta sem vínculo ativo herda com nome nulo", () => {
    expect(resolveResponsavel(null, 99, EQUIPE)).toEqual({
      pessoa: { idUsuario: 99, nome: null },
      herdado: true,
    });
  });

  it("equipe vazia não apaga a atribuição", () => {
    expect(resolveResponsavel(1, null, [])).toEqual({
      pessoa: { idUsuario: 1, nome: null },
      herdado: false,
    });
  });

  it("nome em branco no cadastro vira nulo, e não célula vazia sem explicação", () => {
    // buscarPessoasVinculadasAoContrato devolve "" quando dim_usuario não tem o
    // nome (nomesPorId.get(...) ?? ""). Em tela isso seria um avatar mudo.
    const semNome: PessoaVinculada = { idUsuario: 3, nome: "", papelNoContrato: "assessor" };
    expect(resolveResponsavel(3, null, [semNome])).toEqual({
      pessoa: { idUsuario: 3, nome: null },
      herdado: false,
    });
  });

  it("o Independent Test: dois SMs da mesma Meta, só o primeiro atribuído", () => {
    // spec.md:198 -- "a grade mostra pessoas diferentes, a segunda marcada como
    // herdada".
    const primeiro = resolveResponsavel(1, 2, EQUIPE);
    const segundo = resolveResponsavel(null, 2, EQUIPE);
    expect(primeiro.pessoa?.nome).toBe("Joana Martins");
    expect(segundo.pessoa?.nome).toBe("Marcos Silva");
    expect(primeiro.herdado).toBe(false);
    expect(segundo.herdado).toBe(true);
  });
});
