import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

// Formas de leitura (view-models client-side) definidas conforme design.md
// (## Components -- src/backend/queries/incidencia.ts). Mesmo padrão de
// etapa-contrato.ts/kanban.ts: client por parâmetro, snake_case do banco ->
// camelCase, `if (!data) return []`/`null`.

export interface RefOption {
  id: number;
  nome: string;
}

// INC-04, INC-05, INC-07, INC-08. Lê vw_iip_contrato -- 1 linha por
// contrato (nunca 0, T8), mas a leitura não assume isso (defensivo, mesmo
// padrão de buscarPlanejamentoCompleto). `iipProvisorio`/`nrFatos` chegam
// `null` quando o contrato não tem Fato Gerador (LEFT JOIN, AD-005) ou
// quando nenhuma ref_tipologia ainda tem id_indicador (Assumption #1b) --
// nunca 0 nesses casos.
export async function buscarIipContrato(
  client: SupabaseClient<Database>,
  idContrato: number
): Promise<{ nrFatos: number | null; iipProvisorio: number | null } | null> {
  const { data, error } = await client
    .from("vw_iip_contrato")
    .select("nr_fatos, iip_provisorio")
    .eq("id_contrato", idContrato)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return { nrFatos: data.nr_fatos, iipProvisorio: data.iip_provisorio };
}

// Catálogo de ref_tipologia ativas -- popula o Select de Tipologia do
// formulário de Fato Gerador. `nome` concatena grupo/tipologia/estado
// (mesmo tratamento de FatoGeradorResumo.tipologia, ver parte 2 deste
// arquivo) já que o catálogo não tem um único campo de rótulo.
export async function buscarTipologiasAtivas(client: SupabaseClient<Database>): Promise<RefOption[]> {
  const { data, error } = await client
    .from("ref_tipologia")
    .select("id_tipologia, grupo, tipologia, estado")
    .eq("ativo", true);
  if (error) throw error;
  if (!data) return [];

  return data.map((t) => ({ id: t.id_tipologia, nome: `${t.grupo} · ${t.tipologia} · ${t.estado}` }));
}

// INC-14. Catálogo de ref_pilar_insight ativos -- popula o Select de Pilar
// (opcional) do formulário de Insight.
export async function buscarPilaresInsight(client: SupabaseClient<Database>): Promise<RefOption[]> {
  const { data, error } = await client.from("ref_pilar_insight").select("id_pilar, nome").eq("ativo", true);
  if (error) throw error;
  if (!data) return [];

  return data.map((p) => ({ id: p.id_pilar, nome: p.nome }));
}

// Catálogo de ref_nivel_iip -- popula o Select de nível (D1/D2/D3) do
// formulário de Fato Gerador (baixo/medio/alto/maximo, seed T1).
export async function buscarNiveisIip(
  client: SupabaseClient<Database>
): Promise<{ codigo: string; rotulo: string }[]> {
  const { data, error } = await client.from("ref_nivel_iip").select("codigo, rotulo");
  if (error) throw error;
  if (!data) return [];

  return data.map((n) => ({ codigo: n.codigo, rotulo: n.rotulo }));
}

// INC-09. ref_tipo_registro ativos de uma etapa -- popula o Select de Tipo
// de Registro do formulário de Registro, escopado à etapa aberta (o banco
// ainda rejeita, via trg_valida_registro_produto, um tipo fora da régua do
// produto do contrato -- este catálogo só reduz a chance de tentar).
export async function buscarTiposRegistroDaEtapa(
  client: SupabaseClient<Database>,
  idEtapa: number
): Promise<RefOption[]> {
  const { data, error } = await client
    .from("ref_tipo_registro")
    .select("id_tipo_registro, nome")
    .eq("id_etapa", idEtapa)
    .eq("ativo", true);
  if (error) throw error;
  if (!data) return [];

  return data.map((t) => ({ id: t.id_tipo_registro, nome: t.nome }));
}
