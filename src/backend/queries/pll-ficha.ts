import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buscarComposicaoPartidariaCasa,
  buscarPerfilCandidatura,
  buscarTodasCandidaturasPorTitulo,
  type ComposicaoPartido,
} from "./tse";
import type { Database } from "../supabase/database.types";

// diagnostico-participante-pll (design.md "Reuses"): extraído de
// produtos/pll/participantes/[id]/page.tsx (T15/T19,
// pll-cadastro-participantes/spec.md, PLL-CP-14..19) para ser reaproveitado
// também pela aba Diagnóstico da ficha de contrato (/contratos/[id]/
// diagnostico) quando o contrato é do produto PLL — mesmo dado, duas rotas,
// zero duplicação de query (lição L-005).

export interface CadastroParticipanteFicha {
  idCadastroParticipante: number;
  nomeCompleto: string;
  papel: "mentorado" | "mentor";
  idVinculoTse: number | null;
  notaEducacao: number | null;
  notaSegurancaPublica: number | null;
  notaModernizacaoEstado: number | null;
  notaClima: number | null;
  outrasPautas: string[];
  especifiquePauta: string | null;
  desafios: string[];
  destaques: string[];
  ambicaoTexto: string | null;
  ambicaoTags: string[];
  swotForcas: string[];
  swotFraquezas: string[];
  swotOportunidades: string[];
  swotAmeacas: string[];
}

const SELECT_CADASTRO_PARTICIPANTE_FICHA =
  "id_cadastro_participante, nome_completo, papel, id_vinculo_tse, nota_educacao, nota_seguranca_publica, nota_modernizacao_estado, nota_clima, outras_pautas, especifique_pauta, desafios, destaques, ambicao_texto, ambicao_tags, swot_forcas, swot_fraquezas, swot_oportunidades, swot_ameacas";

interface RowCadastroParticipanteFicha {
  id_cadastro_participante: number;
  nome_completo: string;
  papel: string;
  id_vinculo_tse: number | null;
  nota_educacao: number | null;
  nota_seguranca_publica: number | null;
  nota_modernizacao_estado: number | null;
  nota_clima: number | null;
  outras_pautas: string[] | null;
  especifique_pauta: string | null;
  desafios: string[] | null;
  destaques: string[] | null;
  ambicao_texto: string | null;
  ambicao_tags: string[] | null;
  swot_forcas: string[] | null;
  swot_fraquezas: string[] | null;
  swot_oportunidades: string[] | null;
  swot_ameacas: string[] | null;
}

function mapeiaLinhaCadastroParticipanteFicha(data: RowCadastroParticipanteFicha): CadastroParticipanteFicha {
  return {
    idCadastroParticipante: data.id_cadastro_participante,
    nomeCompleto: data.nome_completo,
    papel: data.papel as "mentorado" | "mentor",
    idVinculoTse: data.id_vinculo_tse,
    notaEducacao: data.nota_educacao,
    notaSegurancaPublica: data.nota_seguranca_publica,
    notaModernizacaoEstado: data.nota_modernizacao_estado,
    notaClima: data.nota_clima,
    outrasPautas: data.outras_pautas ?? [],
    especifiquePauta: data.especifique_pauta,
    desafios: data.desafios ?? [],
    destaques: data.destaques ?? [],
    ambicaoTexto: data.ambicao_texto,
    ambicaoTags: data.ambicao_tags ?? [],
    swotForcas: data.swot_forcas ?? [],
    swotFraquezas: data.swot_fraquezas ?? [],
    swotOportunidades: data.swot_oportunidades ?? [],
    swotAmeacas: data.swot_ameacas ?? [],
  };
}

export async function buscarCadastroParticipanteFicha(
  client: SupabaseClient<Database>,
  idCadastroParticipante: number
): Promise<CadastroParticipanteFicha | null> {
  const { data, error } = await client
    .from("fat_cadastro_participante")
    .select(SELECT_CADASTRO_PARTICIPANTE_FICHA)
    .eq("id_cadastro_participante", idCadastroParticipante)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapeiaLinhaCadastroParticipanteFicha(data);
}

// DPP-01/DPP-04 (.specs/features/diagnostico-participante-pll/spec.md): a
// aba Diagnóstico da ficha de contrato só conhece `idContrato` -- esta busca
// é o elo entre o contrato (criado por `vincularParticipanteAoTse`,
// pll-cadastro.ts) e a linha de staging original em
// `fat_cadastro_participante` (que carrega os campos PLL-específicos). Sem
// linha correspondente (edge case: contrato PLL criado por outro caminho),
// devolve `null` -- o chamador decide o estado vazio (AD-005), nunca cai no
// conteúdo de Estratégia por engano.
export async function buscarCadastroParticipanteFichaPorContrato(
  client: SupabaseClient<Database>,
  idContrato: number
): Promise<CadastroParticipanteFicha | null> {
  const { data, error } = await client
    .from("fat_cadastro_participante")
    .select(SELECT_CADASTRO_PARTICIPANTE_FICHA)
    .eq("id_contrato", idContrato)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapeiaLinhaCadastroParticipanteFicha(data);
}

// Formato consumido por FichaDadosTse (frontend/components/pll/ficha-dados-tse.tsx)
// -- mesmo shape, definido aqui de novo (não importado de lá) para não
// inverter a camada Operação->Plataforma (AD-007: queries/ nunca depende de
// frontend/components/).
export interface CandidaturaFichaTse {
  anoEleicao: number;
  situacaoEleitoral: string | null;
  coligacao: string | null;
  votosRecebidos: number;
}

export interface DadosTseFicha {
  candidaturas: CandidaturaFichaTse[];
  composicao: ComposicaoPartido[];
}

/**
 * Candidaturas TSE + composição partidária da Casa do mandato vigente, a
 * partir do `id_vinculo_tse` gravado em `fat_cadastro_participante`. Devolve
 * listas vazias (nunca lança) quando o vínculo/mandato/título não resolve --
 * mesmo padrão de "ausência é estado" (AD-005) que o restante da Ficha usa.
 */
export async function buscarDadosTseFicha(
  client: SupabaseClient<Database>,
  idVinculoTse: number
): Promise<DadosTseFicha> {
  const vazio: DadosTseFicha = { candidaturas: [], composicao: [] };

  const { data: vinculo } = await client
    .from("rel_mandato_candidatura")
    .select("id_mandato")
    .eq("id_vinculo_tse", idVinculoTse)
    .maybeSingle();
  if (!vinculo) return vazio;

  const { data: mandato } = await client
    .from("dim_mandato")
    .select("nr_titulo_eleitoral")
    .eq("id_mandato", vinculo.id_mandato)
    .maybeSingle();
  if (!mandato?.nr_titulo_eleitoral) return vazio;

  const brutas = await buscarTodasCandidaturasPorTitulo(client, mandato.nr_titulo_eleitoral);
  if (brutas.length === 0) return vazio;

  const perfis = await Promise.all(
    brutas.map((c) =>
      buscarPerfilCandidatura(client, {
        anoEleicao: c.anoEleicao,
        sqCandidato: c.sqCandidato,
        nrTurno: c.nrTurno,
      }).catch(() => null)
    )
  );

  const candidaturas: CandidaturaFichaTse[] = brutas
    .map((c, i) => ({
      anoEleicao: c.anoEleicao,
      situacaoEleitoral: c.dsSituacaoCandidatura ?? c.dsSitTotTurno,
      coligacao: perfis[i]?.coligacao ?? null,
      votosRecebidos: c.qtVotosTotal,
    }))
    .sort((a, b) => b.anoEleicao - a.anoEleicao);

  // PLL-CP-17: composição da Casa/UF/ano do mandato VIGENTE
  // (eh_mandato_vigente) -- nunca de uma candidatura anterior (spec.md Edge
  // Cases).
  const { data: vigenteRow } = await client
    .from("rel_mandato_candidatura")
    .select("ano_eleicao")
    .eq("id_mandato", vinculo.id_mandato)
    .eq("eh_mandato_vigente", true)
    .maybeSingle();
  const anoVigente = vigenteRow?.ano_eleicao ?? candidaturas[0]?.anoEleicao ?? null;
  const brutaVigente = anoVigente != null ? brutas.find((c) => c.anoEleicao === anoVigente) : undefined;

  const composicao =
    brutaVigente && brutaVigente.cdCargo != null && brutaVigente.sgUf
      ? await buscarComposicaoPartidariaCasa(client, {
          anoEleicao: brutaVigente.anoEleicao,
          cdCargo: brutaVigente.cdCargo,
          sgUf: brutaVigente.sgUf,
        }).catch(() => [])
      : [];

  return { candidaturas, composicao };
}
