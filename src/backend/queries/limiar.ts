import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

// EST-07 (T18b, .specs/features/redesenho-estrategia-tela-first/tasks.md).
// Le os 4 limiares reais de ref_limiar_pendencia (T2/T4b, AD-041/AD-045) --
// nenhum numero magico no componente (AD-004). As duas bases (dias absoluto
// x percentual da duracao da etapa) chegam como vieram do banco, sem
// resolver aqui qual e' "de etapa": e' o consumidor (a pagina do Dashboard)
// quem sabe que so etapa_atencao/etapa_atrasado alimentam o Quadro -- este
// modulo so busca e tipa a tabela inteira, mesmo espirito de buscarQuadro
// nao filtrar categorias de pendencia (AD-004, ver queries/pendencias.ts).
export interface LimiarPendencia {
  codigo: string;
  dias: number | null;
  pctDuracaoEtapa: number | null;
  ativo: boolean;
}

interface RowLimiar {
  codigo: string;
  dias: number | null;
  pct_duracao_etapa: number | null;
  ativo: boolean;
}

export async function buscarLimiares(client: SupabaseClient<Database>): Promise<LimiarPendencia[]> {
  const { data, error } = await client.from("ref_limiar_pendencia").select("codigo, dias, pct_duracao_etapa, ativo");
  if (error) throw error;

  const rows = (data ?? []) as RowLimiar[];
  return rows.map((r) => ({
    codigo: r.codigo,
    dias: r.dias,
    pctDuracaoEtapa: r.pct_duracao_etapa,
    ativo: r.ativo,
  }));
}
