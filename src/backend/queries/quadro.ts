import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { buscarBoardKanban, type CardKanban, type ColunaKanban, type FiltroBoard } from "./kanban";
import { buscarProspeccoesAbertas } from "./prospeccao";

// EST-07 (T15, design.md "QuadroAcompanhamento"). Compõe as colunas de
// ref_etapa (via buscarBoardKanban, T8) com a raia de Prospecção (via
// buscarProspeccoesAbertas, T8/AD-040) numa estrutura só, na ordem que o
// Quadro renderiza: Prospecção sempre primeiro, depois as etapas por
// ref_etapa.ordem -- nenhuma lista literal de etapas no código (EST-07 AC1),
// o número de colunas de etapa é sempre etapas.length, então uma linha nova
// em ref_etapa muda a contagem sem tocar em código (EST-07 AC1b).
export interface CardEtapaQuadro extends CardKanban {
  // Estado atual do mandato (dim_mandato.id_cargo_atual/id_partido_atual),
  // mesmo propósito de buscarContratoParaFicha em queries/contrato.ts --
  // "o cargo/partido de agora", não o snapshot da contratação. Contratante
  // sem dim_mandato (ex.: Coalizão) devolve null nos dois -- nunca lança,
  // nunca inventa (AD-005).
  cargoAtual: string | null;
  partidoAtual: string | null;
}

export interface ColunaEtapaQuadro extends Omit<ColunaKanban, "cards"> {
  tipo: "etapa";
  // ref_etapa.duracao_prevista_dias -- base do percentual de classificarLimiar
  // (T14/AD-045). Etapa sem duração cadastrada devolve null, e a função pura
  // já trata isso como "não classificável" (nunca inventa um estado).
  duracaoPrevistaDias: number | null;
  cards: CardEtapaQuadro[];
}

export interface CardProspeccaoQuadro {
  idProspeccao: number;
  nomeContratante: string;
  diasEmAberto: number;
}

// idEtapa: null de propósito -- a raia de Prospecção não é uma ref_etapa
// real (fat_prospeccao não carrega id_contrato nem id_etapa, AD-040). Não é
// sentinela (AD-005): é a representação honesta de "isto não é uma etapa
// do catálogo", o mesmo raciocínio de id_etapa_atual IS NULL em
// buscarBoardKanban.
export interface ColunaProspeccaoQuadro {
  idEtapa: null;
  codigo: "prospeccao";
  nome: string;
  ordem: 0;
  tipo: "prospeccao";
  cards: CardProspeccaoQuadro[];
}

export type ColunaQuadro = ColunaProspeccaoQuadro | ColunaEtapaQuadro;

interface RowEtapaDuracao {
  id_etapa: number;
  duracao_prevista_dias: number | null;
}

interface RowContratoContratante {
  id_contrato: number;
  id_contratante: number;
}

interface RowMandatoCargoPartido {
  id_contratante: number;
  ref_cargo: { nome: string | null } | null;
  ref_partido: { sigla: string | null } | null;
}

// Mesmo cálculo de "dias corridos" de buscarBoardKanban/kanban.ts --
// duplicado aqui de propósito: a raia de Prospecção não tem etapa nem
// fat_etapa_contrato, então não há como reusar diretamente a função privada
// de kanban.ts sem alterar aquele arquivo (fora do escopo desta task).
function diasDesde(dataIso: string): number {
  const hoje = new Date();
  const referencia = new Date(dataIso);
  return Math.floor((hoje.getTime() - referencia.getTime()) / (1000 * 60 * 60 * 24));
}

async function buscarDuracaoPorEtapa(
  client: SupabaseClient<Database>,
  idProduto: number
): Promise<Map<number, number | null>> {
  const { data, error } = await client
    .from("ref_etapa")
    .select("id_etapa, duracao_prevista_dias")
    .eq("id_produto", idProduto);
  if (error) throw error;

  const linhas = (data ?? []) as RowEtapaDuracao[];
  return new Map(linhas.map((l) => [l.id_etapa, l.duracao_prevista_dias]));
}

// Cargo/partido atuais só dos contratantes que de fato aparecem numa coluna
// de etapa -- nunca varre o produto inteiro (mesmo espírito de
// buscarProspeccoesAbertas: resolve só o que precisa). Contratante sem linha
// em dim_mandato (Coalizão, ou RLS que não devolveu) cai no default
// null/null, nunca lança.
async function buscarCargoPartidoPorContrato(
  client: SupabaseClient<Database>,
  idsContrato: number[]
): Promise<Map<number, { cargoAtual: string | null; partidoAtual: string | null }>> {
  if (idsContrato.length === 0) return new Map();

  const { data: contratosData, error: erroContratos } = await client
    .from("fat_contrato")
    .select("id_contrato, id_contratante")
    .in("id_contrato", idsContrato);
  if (erroContratos) throw erroContratos;
  const contratos = (contratosData ?? []) as RowContratoContratante[];
  if (contratos.length === 0) return new Map();

  const idsContratante = Array.from(new Set(contratos.map((c) => c.id_contratante)));
  const { data: mandatosData, error: erroMandatos } = await client
    .from("dim_mandato")
    .select("id_contratante, ref_cargo(nome), ref_partido(sigla)")
    .in("id_contratante", idsContratante);
  if (erroMandatos) throw erroMandatos;
  const mandatos = (mandatosData ?? []) as unknown as RowMandatoCargoPartido[];

  const cargoPartidoPorContratante = new Map(
    mandatos.map((m) => [
      m.id_contratante,
      { cargoAtual: m.ref_cargo?.nome ?? null, partidoAtual: m.ref_partido?.sigla ?? null },
    ])
  );

  const porContrato = new Map<number, { cargoAtual: string | null; partidoAtual: string | null }>();
  for (const c of contratos) {
    porContrato.set(c.id_contrato, cargoPartidoPorContratante.get(c.id_contratante) ?? {
      cargoAtual: null,
      partidoAtual: null,
    });
  }
  return porContrato;
}

export async function buscarQuadro(
  client: SupabaseClient<Database>,
  args: { idProduto: number; filtro?: FiltroBoard }
): Promise<ColunaQuadro[]> {
  const [colunasEtapa, prospeccoes] = await Promise.all([
    buscarBoardKanban(client, args.idProduto, args.filtro),
    buscarProspeccoesAbertas(client, args.idProduto),
  ]);

  const idsContrato = colunasEtapa.flatMap((c) => c.cards.map((card) => card.idContrato));
  const [duracaoPorEtapa, cargoPartidoPorContrato] = await Promise.all([
    buscarDuracaoPorEtapa(client, args.idProduto),
    buscarCargoPartidoPorContrato(client, idsContrato),
  ]);

  const colunaProspeccao: ColunaProspeccaoQuadro = {
    idEtapa: null,
    codigo: "prospeccao",
    nome: "Prospecção",
    ordem: 0,
    tipo: "prospeccao",
    cards: prospeccoes.map((p) => ({
      idProspeccao: p.idProspeccao,
      nomeContratante: p.nomeContratante,
      diasEmAberto: diasDesde(p.dtAbertura),
    })),
  };

  const colunasEtapaEnriquecidas: ColunaEtapaQuadro[] = colunasEtapa.map((coluna) => ({
    idEtapa: coluna.idEtapa,
    codigo: coluna.codigo,
    nome: coluna.nome,
    ordem: coluna.ordem,
    tipo: "etapa",
    duracaoPrevistaDias: duracaoPorEtapa.get(coluna.idEtapa) ?? null,
    cards: coluna.cards.map((card) => ({
      ...card,
      ...(cargoPartidoPorContrato.get(card.idContrato) ?? { cargoAtual: null, partidoAtual: null }),
    })),
  }));

  return [colunaProspeccao, ...colunasEtapaEnriquecidas];
}
