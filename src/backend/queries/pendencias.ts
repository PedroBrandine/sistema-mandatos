import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

// EST-07 (T17, design.md "TabelaPendencias"). Lê vw_pendencias (T3, AD-041)
// com os filtros do Dashboard do produto -- mesmo dado de
// queries/visao-gerencial.ts (buscarPendencias), reimplementado aqui porque
// o consumo de lá está atrás de FiltroRecorte + resolverIdsContratoDoRecorte,
// funções privadas daquele arquivo (fora do escopo desta task tocá-lo). As 6
// categorias que a view emite (cadastro, formulario_aberto, etapa_atrasada,
// encontro_vencido, sem_registro_recente, sucesso_mensal_atrasado -- mesma
// enumeração de CategoriaPendencia em visao-gerencial.ts) nunca são
// filtradas ou limitadas aqui: a função só passa adiante o que a view
// devolve, nunca hardcoda a lista de tipos (AD-004).
export type CategoriaPendencia =
  | "cadastro"
  | "formulario_aberto"
  | "etapa_atrasada"
  | "encontro_vencido"
  | "sem_registro_recente"
  | "sucesso_mensal_atrasado";

export interface Pendencia {
  idContrato: number;
  nomeContratante: string;
  categoria: CategoriaPendencia;
  detalhe: string | null;
  dtReferencia: string;
  diasEmAberto: number;
}

export interface FiltroPendencias {
  idProduto: number;
  idGestora?: number;
  idProjeto?: number;
}

interface RowPendencia {
  id_contrato: number;
  nome_contratante: string;
  categoria: CategoriaPendencia;
  detalhe: string | null;
  dt_referencia: string;
  dias_em_aberto: number;
}

interface RowContratoId {
  id_contrato: number;
}

// Gestora e Projeto restringem por interseção (AND), nunca por união (OR) --
// mesma regra de resolverIdsContratoDoRecorte em visao-gerencial.ts. idProduto
// sempre entra no recorte porque o Dashboard é por produto; os outros dois
// só entram quando informados.
async function resolverIdsContratoDoFiltro(
  client: SupabaseClient<Database>,
  filtro: FiltroPendencias
): Promise<number[]> {
  let queryContrato = client.from("fat_contrato").select("id_contrato").eq("id_produto", filtro.idProduto);
  if (filtro.idProjeto !== undefined) {
    queryContrato = queryContrato.eq("id_projeto", filtro.idProjeto);
  }
  const { data: contratosData, error: erroContratos } = await queryContrato;
  if (erroContratos) throw erroContratos;
  let ids = new Set((contratosData ?? []).map((c) => (c as RowContratoId).id_contrato));

  if (filtro.idGestora !== undefined) {
    if (ids.size === 0) return [];
    const { data: vinculosData, error: erroVinculos } = await client
      .from("rel_usuario_contrato")
      .select("id_contrato")
      .in("id_contrato", [...ids])
      .eq("id_usuario", filtro.idGestora)
      .eq("papel_no_contrato", "gestora")
      .is("dt_fim", null);
    if (erroVinculos) throw erroVinculos;
    const idsGestora = new Set((vinculosData ?? []).map((v) => (v as RowContratoId).id_contrato));
    ids = new Set([...ids].filter((id) => idsGestora.has(id)));
  }

  return [...ids];
}

export async function buscarPendenciasDashboard(
  client: SupabaseClient<Database>,
  filtro: FiltroPendencias
): Promise<Pendencia[]> {
  const idsContrato = await resolverIdsContratoDoFiltro(client, filtro);
  if (idsContrato.length === 0) return [];

  const { data, error } = await client
    .from("vw_pendencias")
    .select("id_contrato, nome_contratante, categoria, detalhe, dt_referencia, dias_em_aberto")
    .in("id_contrato", idsContrato)
    .order("dias_em_aberto", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as RowPendencia[];
  return rows.map((r) => ({
    idContrato: r.id_contrato,
    nomeContratante: r.nome_contratante,
    categoria: r.categoria,
    detalhe: r.detalhe,
    dtReferencia: r.dt_referencia,
    diasEmAberto: r.dias_em_aberto,
  }));
}
