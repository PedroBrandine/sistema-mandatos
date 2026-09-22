import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

// EST-08 (T32, .specs/features/redesenho-estrategia-tela-first/tasks.md).
// Lê os KPIs do topo do Dashboard, agregados na camada Saída (T31,
// vw_estrategia_kpi; hoje via fn_estrategia_kpi, ver abaixo).
//
// Esta função NÃO agrega nada, e isso é o ponto: os KPIs já vêm somados,
// contados e mediados no banco (AD-003 -- "impede que cada tela invente sua
// própria agregação").
//
// Fonte: fn_estrategia_kpi (migration 20260921230408), a versão de
// vw_estrategia_kpi que aceita um CONJUNTO de projetos/gestoras/contratos.
// A view só emite uma linha por (produto x UM projeto x UMA gestora), e com
// filtro de seleção múltipla somar essas linhas duplicaria contrato com mais
// de uma gestora e não preservaria o peso das médias. A função agrega no grão
// de contrato, uma vez, sobre o recorte inteiro; para 1 projeto e/ou 1
// gestora devolve a mesma linha da view (fn-estrategia-kpi.integration.test.ts
// compara as duas em todo o banco).
//
// Recorte: lista ausente ou vazia = sem filtro naquele eixo; dentro de um
// eixo é união (OR), entre eixos é interseção (AND).
export interface FiltroEstrategiaKpi {
  idProduto: number;
  idsGestora?: number[];
  idsProjeto?: number[];
  // Usado pela aba Fatos Geradores, que também filtra por contrato.
  idsContrato?: number[];
  // Intervalo de mês/ano por fat_contrato.dt_inicio (AAAA-MM-DD, dia 1 e
  // último dia do mês respectivamente). Evita que contrato histórico de um
  // mandatário com mais de um contrato (renovação, ciclo anterior) entre na
  // média/soma dos indicadores do período atual.
  dataInicio?: string;
  dataFim?: string;
}

// Os 5 KPIs da faixa (AD-050), mais a quebra por status do card "Mandatos
// ativos" (migration 20260915115846_estrategia_kpi_situacao_mandatos.sql).
// Todos anuláveis, e nenhum recebe fallback: um KPI sem dado suficiente
// chega como null e a tela renderiza "—" (EST-08 AC2, AD-005). Trocar
// qualquer um destes por `?? 0` aqui seria exatamente o zero inventado que a
// AD proíbe -- e o mais perigoso, porque um zero numa faixa de KPI é
// indistinguível de um número real medido.
//
// mandatosAtrasoAtrasados/Atencao/Normal PARTICIONAM mandatosAtivos: somam
// exatamente o total (AD-050/AD-051), e é isso que o card "Mandatos ativos"
// exibe -- número grande e as 3 linhas que o decompõem.
// mandatosAtrasoAtrasados/Atencao ficam null quando o limiar correspondente
// de ref_limiar_pendencia está inativo (coluna inteira indefinida, não zero);
// mandatosAtrasoNormal não tem essa trava (é o resíduo do que não bateu em
// nenhum limiar ativo, mesmo espírito de classificarLimiar quando um dos dois
// parâmetros vem null).
//
// `mandatos_em_atraso` NÃO está aqui de propósito. A view ainda expõe a
// coluna (removê-la exigiria DROP VIEW, que derrubaria a ACL), mas AD-050
// removeu o card que a consumia -- e foi a convivência das duas definições de
// atraso na mesma faixa que produziu o card contraditório. Trazê-la de volta
// para este tipo é reabrir exatamente esse defeito.
export interface EstrategiaKpi {
  mandatosAtivos: number | null;
  iipMedio: number | null;
  npsMedio: number | null;
  pctAtingimentoMedio: number | null;
  nrFatosGeradores: number | null;
  mandatosAtrasoAtrasados: number | null;
  mandatosAtrasoAtencao: number | null;
  mandatosAtrasoNormal: number | null;
  // AD-064 (20260920): média de componente_d1/d2/d3 no mesmo recorte de
  // iipMedio -- quais das 3 dimensões o conjunto de mandatos mais atingiu.
  componenteD1Medio: number | null;
  componenteD2Medio: number | null;
  componenteD3Medio: number | null;
}

interface RowEstrategiaKpi {
  mandatos_ativos: number | null;
  iip_medio: number | null;
  nps_medio: number | null;
  pct_atingimento_medio: number | null;
  nr_fatos_geradores: number | null;
  mandatos_atraso_atrasados: number | null;
  mandatos_atraso_atencao: number | null;
  mandatos_atraso_normal: number | null;
  componente_d1_medio: number | null;
  componente_d2_medio: number | null;
  componente_d3_medio: number | null;
}

// Recorte sem nenhum contrato visível não produz linha na view -- e a
// ausência da linha É a ausência de dado. Os 8 KPIs viram null em bloco, em
// vez de uma faixa de zeros que diria "medimos e deu zero" (AD-005).
const KPI_AUSENTE: EstrategiaKpi = {
  mandatosAtivos: null,
  iipMedio: null,
  npsMedio: null,
  pctAtingimentoMedio: null,
  nrFatosGeradores: null,
  mandatosAtrasoAtrasados: null,
  mandatosAtrasoAtencao: null,
  mandatosAtrasoNormal: null,
  componenteD1Medio: null,
  componenteD2Medio: null,
  componenteD3Medio: null,
};

export async function buscarEstrategiaKpi(
  client: SupabaseClient<Database>,
  filtro: FiltroEstrategiaKpi
): Promise<EstrategiaKpi> {
  const { data, error } = await client.rpc("fn_estrategia_kpi", {
    p_id_produto: filtro.idProduto,
    p_ids_projeto: filtro.idsProjeto,
    p_ids_gestora: filtro.idsGestora,
    p_ids_contrato: filtro.idsContrato,
    p_data_inicio: filtro.dataInicio,
    p_data_fim: filtro.dataFim,
  });
  if (error) throw error;

  // O gerador de tipos não sabe que as colunas são anuláveis (devolve
  // `number`); RowEstrategiaKpi é a forma real, com null.
  const linha = ((data ?? []) as unknown as RowEstrategiaKpi[])[0];
  if (!linha) return KPI_AUSENTE;

  return {
    mandatosAtivos: linha.mandatos_ativos,
    iipMedio: linha.iip_medio,
    npsMedio: linha.nps_medio,
    pctAtingimentoMedio: linha.pct_atingimento_medio,
    nrFatosGeradores: linha.nr_fatos_geradores,
    mandatosAtrasoAtrasados: linha.mandatos_atraso_atrasados,
    mandatosAtrasoAtencao: linha.mandatos_atraso_atencao,
    mandatosAtrasoNormal: linha.mandatos_atraso_normal,
    componenteD1Medio: linha.componente_d1_medio,
    componenteD2Medio: linha.componente_d2_medio,
    componenteD3Medio: linha.componente_d3_medio,
  };
}
