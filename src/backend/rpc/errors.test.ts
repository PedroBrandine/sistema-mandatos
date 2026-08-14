import type { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { mapeiaErroRpc, ViolacaoConstraintError, ViolacaoUnicaError } from "./errors";

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
