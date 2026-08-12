import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

// Formas de leitura (view-models client-side) definidas verbatim conforme
// design.md (## Data Models -- src/backend/queries/visao-gerencial.ts).
export interface LinhaCarteiraPonderada {
  idUsuario: number;
  nomeUsuario: string;
  somaPeso: number;
  qtdContratos: number;
  qtdContratosSemPeso: number; // peso NULL -- lacuna de seed, excluído da soma
  atingimentoMedio: number | null;
}

export interface FiltroCarteiraPonderada {
  papel: "gestora" | "mentor";
  idProduto?: number;
}

interface RowCarteiraPonderada {
  id_usuario: number | null;
  nome_usuario: string | null;
  peso: number | null;
  pct_atingimento: number | null;
}

interface AcumuladorCarteira {
  nomeUsuario: string;
  somaPeso: number;
  qtdContratos: number;
  qtdContratosSemPeso: number;
  somaAtingimento: number;
  qtdAtingimento: number;
}

// GG-05, GG-06. vw_carteira_ponderada já resolve id_etapa_atual IS NULL -> 1ª
// etapa do produto (COALESCE na própria view, T5) -- esta função só agrega,
// nunca reintroduz essa lógica. peso já vem NULL quando falta seed em
// ref_peso_etapa (LEFT JOIN da view); contratos assim são excluídos da soma e
// contados em qtdContratosSemPeso, nunca tratados como peso = 1 (spec.md Edge
// Cases). soma/contagens partem de 0 -- Gestora presente no filtro sem
// nenhum peso válido soma 0 (contagem real), nunca NaN/omitida (spec.md Edge
// Cases, "zero é uma contagem real").
export async function buscarCarteiraPonderada(
  client: SupabaseClient<Database>,
  filtro: FiltroCarteiraPonderada
): Promise<LinhaCarteiraPonderada[]> {
  let query = client
    .from("vw_carteira_ponderada")
    .select("id_usuario, nome_usuario, peso, pct_atingimento")
    .eq("papel_no_contrato", filtro.papel);
  if (filtro.idProduto !== undefined) {
    query = query.eq("id_produto", filtro.idProduto);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as RowCarteiraPonderada[];

  const porUsuario = new Map<number, AcumuladorCarteira>();

  for (const row of rows) {
    if (row.id_usuario === null) continue;

    const acc = porUsuario.get(row.id_usuario) ?? {
      nomeUsuario: row.nome_usuario ?? "",
      somaPeso: 0,
      qtdContratos: 0,
      qtdContratosSemPeso: 0,
      somaAtingimento: 0,
      qtdAtingimento: 0,
    };

    acc.qtdContratos += 1;
    if (row.peso === null) {
      acc.qtdContratosSemPeso += 1;
    } else {
      acc.somaPeso += row.peso;
    }
    if (row.pct_atingimento !== null) {
      acc.somaAtingimento += row.pct_atingimento;
      acc.qtdAtingimento += 1;
    }

    porUsuario.set(row.id_usuario, acc);
  }

  return Array.from(porUsuario.entries()).map(([idUsuario, acc]) => ({
    idUsuario,
    nomeUsuario: acc.nomeUsuario,
    somaPeso: acc.somaPeso,
    qtdContratos: acc.qtdContratos,
    qtdContratosSemPeso: acc.qtdContratosSemPeso,
    atingimentoMedio: acc.qtdAtingimento > 0 ? acc.somaAtingimento / acc.qtdAtingimento : null,
  }));
}
