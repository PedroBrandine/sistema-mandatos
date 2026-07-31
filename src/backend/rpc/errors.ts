import type { PostgrestError } from "@supabase/supabase-js";

import type { ContratanteSimilar } from "../types/fundacao";

// Mapeamento de erro compartilhado pelos 3 wrappers RPC (mandato/coalizao/
// vinculo.ts) -- os 4 tratam exatamente os mesmos 4 códigos da Error Handling
// Strategy do design.md (MDU01/23514/23505/42501); extraído para não repetir
// a mesma tabela/lógica 3 vezes (mesmo racional de texto-limpo.ts em T26).

/** MDU01: contratante(s) parecido(s) já cadastrado(s) (app.criar_mandato/app.criar_coalizao). */
export class DuplicataDetectadaError extends Error {
  constructor(public readonly similares: ContratanteSimilar[]) {
    super("Contratante(s) similar(es) já cadastrado(s).");
    this.name = "DuplicataDetectadaError";
  }
}

/** 23514 (check_violation): valor viola uma constraint de campo. */
export class ViolacaoConstraintError extends Error {
  constructor(
    public readonly constraint: string | null,
    message: string
  ) {
    super(message);
    this.name = "ViolacaoConstraintError";
  }
}

/** 23505 (unique_violation): já existe uma linha conflitante. */
export class ViolacaoUnicaError extends Error {
  constructor(
    public readonly constraint: string | null,
    message: string
  ) {
    super(message);
    this.name = "ViolacaoUnicaError";
  }
}

/** 42501 (insufficient_privilege): RLS negou a escrita. Mensagem genérica de
 * propósito -- nunca revela dado da linha negada (design.md Error Handling
 * Strategy). */
export class PermissaoNegadaError extends Error {
  constructor() {
    super("Você não tem permissão para realizar esta operação.");
    this.name = "PermissaoNegadaError";
  }
}

// Mensagens de campo por constraint (ck_*) alcançáveis pelas 4 funções RPC de
// T20-T23. Constraint não mapeada cai no fallback genérico -- nunca lança sem
// mensagem.
const MENSAGENS_CHECK: Record<string, string> = {
  ck_contratante_uf: "UF deve ter exatamente 2 letras maiúsculas (ex.: SP).",
  ck_mandato_titulo: "Título eleitoral deve ter exatamente 12 dígitos.",
  ck_mandato_raca: "Raça/cor informada não é uma opção válida.",
  ck_vinculo_papel: "Papel no contrato não é uma opção válida.",
  ck_vinculo_cargo: "Cargo informado não é uma opção válida.",
  ck_vinculo_periodo: "Data de fim não pode ser anterior à data de início.",
  ck_match_metodo: "Método de match não é uma opção válida.",
  ck_match_confianca: "Nível de confiança não é uma opção válida.",
  ck_match_status: "Status da candidatura não é uma opção válida.",
};

// Mensagens de conflito por constraint UNIQUE alcançáveis pelas 4 funções RPC.
const MENSAGENS_UNICA: Record<string, string> = {
  uq_vinculo: "Já existe um vínculo aberto para esta pessoa, papel e contrato.",
  uq_mandato_candidatura: "Esta candidatura já está vinculada a este mandato.",
  uq_mandato_candidatura_vigente: "Este mandato já tem uma candidatura vigente.",
  dim_mandato_nr_titulo_eleitoral_key: "Já existe um mandato cadastrado com este título eleitoral.",
  dim_mandato_id_contratante_key: "Este contratante já tem um mandato cadastrado.",
  dim_coalizao_id_contratante_key: "Este contratante já tem uma coalizão cadastrada.",
};

function extraiNomeConstraint(mensagem: string): string | null {
  const encontrado = /constraint "([^"]+)"/.exec(mensagem);
  return encontrado ? encontrado[1] : null;
}

/** Mapeia o erro do PostgREST para um dos 4 erros tipados da Error Handling
 * Strategy (design.md); códigos não mapeados são relançados sem alteração. */
export function mapeiaErroRpc(error: PostgrestError): Error {
  if (error.code === "MDU01") {
    const similares = error.details ? (JSON.parse(error.details) as ContratanteSimilar[]) : [];
    return new DuplicataDetectadaError(similares);
  }

  if (error.code === "23514") {
    const constraint = extraiNomeConstraint(error.message);
    const mensagem = (constraint && MENSAGENS_CHECK[constraint]) || "Valor informado viola uma regra do campo.";
    return new ViolacaoConstraintError(constraint, mensagem);
  }

  if (error.code === "23505") {
    const constraint = extraiNomeConstraint(error.message);
    const mensagem = (constraint && MENSAGENS_UNICA[constraint]) || "Já existe um registro conflitante.";
    return new ViolacaoUnicaError(constraint, mensagem);
  }

  if (error.code === "42501") {
    return new PermissaoNegadaError();
  }

  return error;
}
