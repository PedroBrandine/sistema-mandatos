import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { mapeiaErroRpc } from "./errors";

// Exclusão DEFINITIVA de mandato (contrato) e de itens da Incidência.
// Migrations 20260921224737_fundacao_fn_excluir_contrato.sql e
// 20260921230313_fundacao_fn_excluir_incidencia.sql. Só admin/gestora: o banco
// devolve 42501 (PermissaoNegadaError) para qualquer outro papel, e a tela
// esconde o botão -- mas quem decide é o banco.
//
// Cada exclusão tem um par: `resumo*` (somente leitura, o que vai sair ou ser
// desfeito) e `excluir*` (apaga, e devolve o MESMO resumo). A tela mostra o
// resumo ANTES de pedir confirmação -- consentimento dado sobre lista
// incompleta não vale.

// Contagem por dependente, chave -> quantidade. As chaves são as de
// app.resumo_exclusao_contrato / app.resumo_exclusao_incidencia; quem exibe
// traduz para texto.
export type ContagensExclusao = Record<string, number>;

export interface ResumoExclusaoContrato {
  idContrato: number;
  nomeContratante: string;
  tipoContratante: string;
  // Verdadeiro quando a pessoa ficaria órfã (sem outro contrato, prospecção ou
  // coalizão) e o cadastro dela (contratante + mandato) sai junto.
  apagaContratante: boolean;
  contagens: ContagensExclusao;
}

interface RetornoResumoContrato {
  id_contrato: number;
  nome_contratante: string;
  tipo_contratante: string;
  apaga_contratante: boolean;
  contagens: ContagensExclusao;
}

function paraResumoContrato(dado: unknown): ResumoExclusaoContrato {
  const r = dado as RetornoResumoContrato;
  return {
    idContrato: r.id_contrato,
    nomeContratante: r.nome_contratante,
    tipoContratante: r.tipo_contratante,
    apagaContratante: r.apaga_contratante,
    contagens: r.contagens,
  };
}

export async function resumoExclusaoContrato(
  client: SupabaseClient<Database>,
  idContrato: number
): Promise<ResumoExclusaoContrato> {
  const { data, error } = await client.schema("app").rpc("resumo_exclusao_contrato", { p_id_contrato: idContrato });
  if (error) throw mapeiaErroRpc(error);
  return paraResumoContrato(data);
}

export async function excluirContrato(
  client: SupabaseClient<Database>,
  idContrato: number
): Promise<ResumoExclusaoContrato> {
  const { data, error } = await client.schema("app").rpc("excluir_contrato", { p_id_contrato: idContrato });
  if (error) throw mapeiaErroRpc(error);
  return paraResumoContrato(data);
}

export type TipoItemIncidencia = "registro" | "insight" | "pre_insight" | "fato_gerador";

export interface ResumoExclusaoIncidencia {
  tipo: TipoItemIncidencia;
  id: number;
  // Só para Fato Gerador: realizado entra no IIP, projetado não.
  situacao: "realizado" | "projetado" | null;
  contagens: ContagensExclusao;
}

interface RetornoResumoIncidencia {
  tipo: TipoItemIncidencia;
  id: number;
  situacao?: "realizado" | "projetado";
  contagens: ContagensExclusao;
}

function paraResumoIncidencia(dado: unknown): ResumoExclusaoIncidencia {
  const r = dado as RetornoResumoIncidencia;
  return { tipo: r.tipo, id: r.id, situacao: r.situacao ?? null, contagens: r.contagens };
}

export async function resumoExclusaoIncidencia(
  client: SupabaseClient<Database>,
  tipo: TipoItemIncidencia,
  id: number
): Promise<ResumoExclusaoIncidencia> {
  const { data, error } = await client.schema("app").rpc("resumo_exclusao_incidencia", { p_tipo: tipo, p_id: id });
  if (error) throw mapeiaErroRpc(error);
  return paraResumoIncidencia(data);
}

export async function excluirIncidencia(
  client: SupabaseClient<Database>,
  tipo: TipoItemIncidencia,
  id: number
): Promise<ResumoExclusaoIncidencia> {
  const { data, error } = await client.schema("app").rpc("excluir_incidencia", { p_tipo: tipo, p_id: id });
  if (error) throw mapeiaErroRpc(error);
  return paraResumoIncidencia(data);
}
