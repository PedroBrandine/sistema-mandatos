import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

// RGI-09/RGI-10 (.specs/features/operacao-regua-instanciacao/spec.md). Forma de leitura
// (view-model client-side) definida em design.md ("Frontend -- Tela da régua").
export interface EtapaRegua {
  idEtapaContrato: number;
  idEtapa: number;
  codigo: string;
  nome: string;
  ordem: number;
  status: string;
  dtPrevistaInicio: string | null;
  dtPrevistaConclusao: string | null;
  dtInicio: string | null;
  dtConclusao: string | null;
  diasAtraso: number;
  estaAtrasada: boolean;
}

// RGI-09. Régua completa do contrato -- todas as etapas do produto, ordenadas por
// ref_etapa.ordem, com atraso já derivado por vw_etapa_contrato (nunca recalculado no
// cliente, AD-005/RGI-10). Uma única leitura: a view já entrega codigo/nome/ordem via
// join com ref_etapa, sem precisar de buscarEtapasDoProduto para montar esta tabela.
export async function buscarReguaDoContrato(
  client: SupabaseClient<Database>,
  idContrato: number
): Promise<EtapaRegua[]> {
  const { data, error } = await client
    .from("vw_etapa_contrato")
    .select(
      "id_etapa_contrato, id_etapa, codigo_etapa, nome_etapa, ordem, status, dt_prevista_inicio, dt_prevista_conclusao, dt_inicio, dt_conclusao, dias_atraso, esta_atrasada"
    )
    .eq("id_contrato", idContrato)
    .order("ordem", { ascending: true });

  if (error) throw error;
  if (!data) return [];

  return data.map((linha) => ({
    idEtapaContrato: linha.id_etapa_contrato as number,
    idEtapa: linha.id_etapa as number,
    codigo: linha.codigo_etapa as string,
    nome: linha.nome_etapa as string,
    ordem: linha.ordem as number,
    status: linha.status as string,
    dtPrevistaInicio: linha.dt_prevista_inicio,
    dtPrevistaConclusao: linha.dt_prevista_conclusao,
    dtInicio: linha.dt_inicio,
    dtConclusao: linha.dt_conclusao,
    diasAtraso: linha.dias_atraso ?? 0,
    estaAtrasada: linha.esta_atrasada ?? false,
  }));
}
