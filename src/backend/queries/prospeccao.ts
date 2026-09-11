import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

// EST-04 / AD-040. Leitura das prospecções abertas de um produto — alimenta a
// raia de Prospecção do Quadro de Acompanhamento (design.md, `QuadroAcompanhamento`).
//
// Só lê `fat_prospeccao`; prospect não é contrato e por isso não aparece em
// nenhuma consulta de carteira (`vw_carteira`, `mv_numeros_impacto`, lista de
// Mandatos), conforme o trade-off registrado em AD-040.
export interface ProspeccaoAberta {
  idProspeccao: number;
  idContratante: number;
  nomeContratante: string;
  dtAbertura: string;
}

interface LinhaProspeccao {
  id_prospeccao: number;
  id_contratante: number;
  dt_abertura: string;
}

// A RLS de fat_prospeccao (T6) já recorta por id_usuario_resp/papel global —
// esta função não repete o filtro de permissão, só o de produto e status.
// Produto sem nenhuma prospecção aberta devolve [], nunca lança — mesmo
// padrão de buscarBoardKanban em queries/kanban.ts.
export async function buscarProspeccoesAbertas(
  client: SupabaseClient<Database>,
  idProduto: number
): Promise<ProspeccaoAberta[]> {
  const { data, error } = await client
    .from("fat_prospeccao")
    .select("id_prospeccao, id_contratante, dt_abertura")
    .eq("id_produto", idProduto)
    .eq("status", "aberta")
    .order("dt_abertura", { ascending: true });
  if (error) throw error;

  const prospeccoes = (data ?? []) as LinhaProspeccao[];
  if (prospeccoes.length === 0) return [];

  const { data: contratantes, error: erroContratantes } = await client
    .from("dim_contratante")
    .select("id_contratante, nome")
    .in(
      "id_contratante",
      prospeccoes.map((p) => p.id_contratante)
    );
  if (erroContratantes) throw erroContratantes;
  const nomesPorId = new Map((contratantes ?? []).map((c) => [c.id_contratante, c.nome]));

  return prospeccoes.map((p) => ({
    idProspeccao: p.id_prospeccao,
    idContratante: p.id_contratante,
    nomeContratante: nomesPorId.get(p.id_contratante) ?? "",
    dtAbertura: p.dt_abertura,
  }));
}
