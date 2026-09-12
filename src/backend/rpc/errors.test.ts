import type { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  descreveErroDesconhecido,
  ErroBancoNaoMapeadoError,
  mapeiaErroRpc,
  ViolacaoChaveEstrangeiraError,
  ViolacaoConstraintError,
  ViolacaoUnicaError,
} from "./errors";

// incidencia-encontros T18: cobre as 7 constraints novas (design.md, Error
// Handling Strategy) + o fallback genérico das duas famílias (23514/23505).
// Constraints/mensagens pré-existentes (MDU01/42501/KAN01/demais ck_*/uq_*)
// já têm cobertura própria em rpc/mandato.test.ts e não são reafirmadas aqui.

function erro(codigo: string, mensagem: string): PostgrestError {
  return { code: codigo, message: mensagem } as PostgrestError;
}

describe("mapeiaErroRpc — constraints novas de incidencia-encontros", () => {
  it("ck_fato_niveis: ViolacaoConstraintError com a mensagem de nível", () => {
    const resultado = mapeiaErroRpc(erro("23514", 'new row violates check constraint "ck_fato_niveis"'));

    expect(resultado).toBeInstanceOf(ViolacaoConstraintError);
    expect((resultado as ViolacaoConstraintError).constraint).toBe("ck_fato_niveis");
    expect(resultado.message).toBe("Preencha ao menos um nível (D1, D2 ou D3).");
  });

  it("ck_encontro_planejado: ViolacaoConstraintError com a mensagem de data prevista", () => {
    const resultado = mapeiaErroRpc(erro("23514", 'new row violates check constraint "ck_encontro_planejado"'));

    expect(resultado).toBeInstanceOf(ViolacaoConstraintError);
    expect(resultado.message).toBe("Data prevista de início é obrigatória para encontro planejado.");
  });

  it("ck_encontro_realizado: ViolacaoConstraintError com a mensagem de data realizada", () => {
    const resultado = mapeiaErroRpc(erro("23514", 'new row violates check constraint "ck_encontro_realizado"'));

    expect(resultado).toBeInstanceOf(ViolacaoConstraintError);
    expect(resultado.message).toBe("Data de realização é obrigatória para encontro realizado.");
  });

  it("ck_participante_identificacao: ViolacaoConstraintError com a mensagem de XOR", () => {
    const resultado = mapeiaErroRpc(
      erro("23514", 'new row violates check constraint "ck_participante_identificacao"')
    );

    expect(resultado).toBeInstanceOf(ViolacaoConstraintError);
    expect(resultado.message).toBe(
      "Informe um usuário do sistema OU um nome de participante externo, nunca os dois."
    );
  });

  it("uq_registro_sequencia: ViolacaoUnicaError com a mensagem de sequência de registro", () => {
    const resultado = mapeiaErroRpc(
      erro("23505", 'duplicate key value violates unique constraint "uq_registro_sequencia"')
    );

    expect(resultado).toBeInstanceOf(ViolacaoUnicaError);
    expect((resultado as ViolacaoUnicaError).constraint).toBe("uq_registro_sequencia");
    expect(resultado.message).toBe("Já existe um registro com este número de sequência.");
  });

  it("uq_encontro_sequencia: ViolacaoUnicaError com a mensagem de sequência de encontro", () => {
    const resultado = mapeiaErroRpc(
      erro("23505", 'duplicate key value violates unique constraint "uq_encontro_sequencia"')
    );

    expect(resultado).toBeInstanceOf(ViolacaoUnicaError);
    expect(resultado.message).toBe("Já existe um encontro com este número de sequência.");
  });

  it("uq_encontro_participante_usuario: ViolacaoUnicaError com a mensagem de participante duplicado", () => {
    const resultado = mapeiaErroRpc(
      erro("23505", 'duplicate key value violates unique constraint "uq_encontro_participante_usuario"')
    );

    expect(resultado).toBeInstanceOf(ViolacaoUnicaError);
    expect(resultado.message).toBe("Este participante já está na lista.");
  });

  it("23514 com constraint não mapeada cai no fallback genérico", () => {
    const resultado = mapeiaErroRpc(erro("23514", 'new row violates check constraint "ck_algo_nao_mapeado"'));

    expect(resultado).toBeInstanceOf(ViolacaoConstraintError);
    expect(resultado.message).toBe("Valor informado viola uma regra do campo.");
  });

  it("23505 com constraint não mapeada cai no fallback genérico", () => {
    const resultado = mapeiaErroRpc(
      erro("23505", 'duplicate key value violates unique constraint "uq_algo_nao_mapeado"')
    );

    expect(resultado).toBeInstanceOf(ViolacaoUnicaError);
    expect(resultado.message).toBe("Já existe um registro conflitante.");
  });
});

// redesenho-estrategia-tela-first T24: o encobrimento que fazia a tela de
// Novo Contrato mostrar "Erro ao cadastrar mandato ou contrato." em vez da
// causa. Ver ErroBancoNaoMapeadoError para a evidência de runtime.
describe("mapeiaErroRpc — todo erro vira um Error de verdade", () => {
  it("23503 da FK de coalizão: mensagem específica", () => {
    const resultado = mapeiaErroRpc(
      erro(
        "23503",
        'insert or update on table "rel_coalizao_membro" violates foreign key constraint "rel_coalizao_membro_id_coalizao_fkey"'
      )
    );

    expect(resultado).toBeInstanceOf(ViolacaoChaveEstrangeiraError);
    expect((resultado as ViolacaoChaveEstrangeiraError).constraint).toBe(
      "rel_coalizao_membro_id_coalizao_fkey"
    );
    expect(resultado.message).toBe(
      "A coalizão selecionada não existe mais. Recarregue a página e escolha de novo."
    );
  });

  it("23503 com constraint não mapeada cai no fallback da família", () => {
    const resultado = mapeiaErroRpc(
      erro("23503", 'violates foreign key constraint "alguma_outra_fkey"')
    );

    expect(resultado).toBeInstanceOf(ViolacaoChaveEstrangeiraError);
    expect(resultado.message).toBe(
      "Um dos itens selecionados não existe mais. Recarregue a página e escolha de novo."
    );
  });

  it("código desconhecido vira Error com o código e a mensagem do banco", () => {
    const resultado = mapeiaErroRpc(erro("22P02", 'invalid input syntax for type bigint: ""'));

    // O ponto central: instanceof Error. O objeto cru do PostgREST não é,
    // e era isso que fazia o catch da tela descartar a mensagem.
    expect(resultado).toBeInstanceOf(Error);
    expect(resultado).toBeInstanceOf(ErroBancoNaoMapeadoError);
    expect((resultado as ErroBancoNaoMapeadoError).codigo).toBe("22P02");
    expect(resultado.message).toContain("22P02");
    expect(resultado.message).toContain('invalid input syntax for type bigint');
  });

  it("não vaza details nem hint, que carregam valores da linha recusada", () => {
    const bruto = {
      code: "23503",
      message: 'violates foreign key constraint "alguma_outra_fkey"',
      details: "Key (id_coalizao)=(447) is not present in table \"dim_coalizao\".",
      hint: "algum hint",
    } as PostgrestError;

    const resultado = mapeiaErroRpc(bruto);

    expect(resultado.message).not.toContain("447");
    expect(resultado.message).not.toContain("algum hint");
  });

  it("23502 (NOT NULL) também chega como Error, não como objeto cru", () => {
    const resultado = mapeiaErroRpc(
      erro("23502", 'null value in column "dt_inicio" violates not-null constraint')
    );

    expect(resultado).toBeInstanceOf(Error);
    expect(resultado.message).toContain("23502");
    expect(resultado.message).toContain("dt_inicio");
  });
});

describe("descreveErroDesconhecido", () => {
  it("Error comum: devolve a própria mensagem", () => {
    expect(descreveErroDesconhecido(new Error("estourou aqui"))).toBe("estourou aqui");
  });

  it("objeto cru do PostgREST (não é Error): monta código + mensagem", () => {
    const descricao = descreveErroDesconhecido({
      code: "23503",
      message: "violates foreign key constraint",
      details: "Key (id_coalizao)=(447) is not present.",
      hint: null,
    });

    expect(descricao).toContain("23503");
    expect(descricao).toContain("violates foreign key constraint");
    expect(descricao).not.toContain("447");
  });

  it("string solta: devolve a string", () => {
    expect(descreveErroDesconhecido("deu ruim")).toBe("deu ruim");
  });

  it("valor sem mensagem nenhuma: admite que não sabe, em vez de inventar", () => {
    const descricao = descreveErroDesconhecido(undefined);

    expect(descricao).toContain("Erro inesperado");
    expect(descricao).toContain("sem mensagem");
  });

  it("objeto vazio não vira string vazia", () => {
    expect(descreveErroDesconhecido({})).toContain("Erro inesperado");
  });
});
