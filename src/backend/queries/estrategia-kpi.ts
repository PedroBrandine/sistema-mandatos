import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

// EST-08 (T32, .specs/features/redesenho-estrategia-tela-first/tasks.md).
// Lê vw_estrategia_kpi (T31), a view que agrega os 6 KPIs do topo do
// Dashboard na camada Saída.
//
// Esta função NÃO agrega nada, e isso é o ponto: os 6 números já vêm somados,
// contados e mediados pela view (AD-003 -- "impede que cada tela invente sua
// própria agregação"). O que ela faz é ESCOLHER QUAL LINHA ler. A view emite
// uma linha por combinação de escopo, e os filtros do Dashboard traduzem-se
// em igualdade sobre as colunas de escopo:
//
//   sem filtro         -> escopo_projeto = false, escopo_gestora = false
//   só projeto         -> escopo_projeto = true  + id_projeto
//   só gestora         -> escopo_gestora = true  + id_usuario_gestora
//   projeto e gestora  -> as duas condições, que é a interseção (AND)
//
// Por isso não existe aqui o resolverIdsContratoDoFiltro de
// queries/pendencias.ts: lá a view é no grão de contrato e o recorte precisa
// virar uma lista de ids; aqui o recorte é uma coordenada da própria linha.
export interface FiltroEstrategiaKpi {
  idProduto: number;
  idGestora?: number;
  idProjeto?: number;
}

// Os 6 KPIs de EST-08 AC1. Todos anuláveis, e nenhum recebe fallback: um
// KPI sem dado suficiente chega como null e a tela renderiza "—" (EST-08 AC2,
// AD-005). Trocar qualquer um destes por `?? 0` aqui seria exatamente o zero
// inventado que a AD proíbe -- e o mais perigoso, porque um zero numa faixa
// de KPI é indistinguível de um número real medido.
export interface EstrategiaKpi {
  mandatosAtivos: number | null;
  iipMedio: number | null;
  mandatosEmAtraso: number | null;
  npsMedio: number | null;
  pctAtingimentoMedio: number | null;
  nrFatosGeradores: number | null;
}

interface RowEstrategiaKpi {
  mandatos_ativos: number | null;
  iip_medio: number | null;
  mandatos_em_atraso: number | null;
  nps_medio: number | null;
  pct_atingimento_medio: number | null;
  nr_fatos_geradores: number | null;
}

// Recorte sem nenhum contrato visível não produz linha na view -- e a
// ausência da linha É a ausência de dado. Os 6 KPIs viram null em bloco, em
// vez de uma faixa de zeros que diria "medimos e deu zero" (AD-005).
const KPI_AUSENTE: EstrategiaKpi = {
  mandatosAtivos: null,
  iipMedio: null,
  mandatosEmAtraso: null,
  npsMedio: null,
  pctAtingimentoMedio: null,
  nrFatosGeradores: null,
};

export async function buscarEstrategiaKpi(
  client: SupabaseClient<Database>,
  filtro: FiltroEstrategiaKpi
): Promise<EstrategiaKpi> {
  // A lista de colunas fica literal e inline de propósito. O supabase-js
  // parseia essa string em tempo de tipo para inferir o formato da linha; uma
  // constante montada por concatenação não é um literal para o compilador, a
  // inferência degrada para GenericStringError[] e o cast abaixo vira erro de
  // build. Mesmo motivo pelo qual queries/pendencias.ts escreve a lista
  // inteira dentro do select.
  let query = client
    .from("vw_estrategia_kpi")
    .select("mandatos_ativos, iip_medio, mandatos_em_atraso, nps_medio, pct_atingimento_medio, nr_fatos_geradores")
    .eq("id_produto", filtro.idProduto)
    .eq("escopo_projeto", filtro.idProjeto !== undefined)
    .eq("escopo_gestora", filtro.idGestora !== undefined);

  if (filtro.idProjeto !== undefined) {
    query = query.eq("id_projeto", filtro.idProjeto);
  }
  if (filtro.idGestora !== undefined) {
    query = query.eq("id_usuario_gestora", filtro.idGestora);
  }

  const { data, error } = await query;
  if (error) throw error;

  const linha = ((data ?? []) as RowEstrategiaKpi[])[0];
  if (!linha) return KPI_AUSENTE;

  return {
    mandatosAtivos: linha.mandatos_ativos,
    iipMedio: linha.iip_medio,
    mandatosEmAtraso: linha.mandatos_em_atraso,
    npsMedio: linha.nps_medio,
    pctAtingimentoMedio: linha.pct_atingimento_medio,
    nrFatosGeradores: linha.nr_fatos_geradores,
  };
}
