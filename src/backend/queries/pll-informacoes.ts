import type { SupabaseClient } from "@supabase/supabase-js";

import { buscarPerfilCandidatura, buscarTodasCandidaturasPorTitulo } from "./tse";
import type { Database } from "../supabase/database.types";

// diagnostico-participante-pll (Informações Gerais do PLL, Figma 449:4,
// restilizado pra Anton/Commissioner/paleta oficial -- decisão do Pedro,
// 23/09). "Base Eleitoral" do frame NÃO tem coluna correspondente em
// nenhuma tabela (checado: dim_mandato não tem esse campo) -- omitida aqui,
// nunca inventada (regra nº1 de figma-dominio-legisla).

export interface EdicaoParticipacaoPll {
  nomeEdicao: string;
  dtInicio: string;
  dtFim: string | null;
  /** status do CONTRATO daquela edição -- null quando a linha de staging
   * daquela edição nunca chegou a virar contrato (sem vínculo TSE). */
  statusContrato: string | null;
}

export interface InformacoesGeraisPll {
  idCadastroParticipante: number;
  // Dados Pessoais (fat_cadastro_participante -- autodeclarado)
  identidadeGenero: string | null;
  orientacaoSexual: string | null;
  corRaca: string | null;
  tempoNaPolitica: string | null;
  // Idade/Escolaridade só existem via perfil TSE (buscarPerfilCandidatura),
  // portanto só depois do vínculo -- null até lá (AD-005).
  idade: number | null;
  escolaridade: string | null;
  // Dados do Mandato -- "Estado de eleição" e os 2 campos anteriores são os
  // únicos específicos daqui. Cargo/Partido ATUAIS (dim_mandato) já vêm
  // resolvidos por `buscarContratoParaFicha` (cargoAtual/partidoAtual/sgUf) --
  // a página compõe os dois, sem duplicar aquela query aqui.
  mandatosAnteriores: string | null;
  cargosAnteriores: string | null;
  // Mentor Responsável
  nomeMentor: string | null;
  // Vínculo de Acesso
  origemCadastro: { dataImportacao: string; nomeUsuario: string } | null;
  // Edição Vinculada (a do contrato atual)
  edicaoAtual: EdicaoParticipacaoPll | null;
  // Histórico de Participação -- TODAS as edições em que este e-mail
  // apareceu em fat_cadastro_participante, mais recente primeiro (inclui a atual).
  historico: EdicaoParticipacaoPll[];
}

interface RowCadastro {
  id_cadastro_participante: number;
  email: string;
  identidade_genero: string | null;
  orientacao_sexual: string | null;
  cor_raca: string | null;
  tempo_na_politica: string | null;
  mandatos_anteriores: string | null;
  cargos_anteriores: string | null;
  id_vinculo_tse: number | null;
  id_edicao: number | null;
  importado_em: string | null;
  importado_por: number | null;
}

/**
 * Painel "Informações Gerais" do contrato PLL. Devolve `null` quando o
 * contrato não tem uma linha correspondente em `fat_cadastro_participante`
 * (mesmo edge case de `buscarCadastroParticipanteFichaPorContrato`).
 */
export async function buscarInformacoesGeraisPll(
  client: SupabaseClient<Database>,
  idContrato: number
): Promise<InformacoesGeraisPll | null> {
  const { data: cadastro, error: erroCadastro } = await client
    .from("fat_cadastro_participante")
    .select(
      "id_cadastro_participante, email, identidade_genero, orientacao_sexual, cor_raca, tempo_na_politica, mandatos_anteriores, cargos_anteriores, id_vinculo_tse, id_edicao, importado_em, importado_por"
    )
    .eq("id_contrato", idContrato)
    .maybeSingle();
  if (erroCadastro) throw erroCadastro;
  if (!cadastro) return null;

  const row = cadastro as unknown as RowCadastro;

  const [mentor, importador, edicaoAtual, historicoBruto, tse] = await Promise.all([
    buscarNomeMentor(client, idContrato),
    row.importado_por != null ? buscarNomeUsuario(client, row.importado_por) : Promise.resolve(null),
    row.id_edicao != null ? buscarEdicao(client, row.id_edicao) : Promise.resolve(null),
    buscarHistoricoParticipacao(client, row.email),
    row.id_vinculo_tse != null ? buscarIdadeEscolaridade(client, row.id_vinculo_tse) : Promise.resolve(null),
  ]);

  return {
    idCadastroParticipante: row.id_cadastro_participante,
    identidadeGenero: row.identidade_genero,
    orientacaoSexual: row.orientacao_sexual,
    corRaca: row.cor_raca,
    tempoNaPolitica: row.tempo_na_politica,
    idade: tse?.idade ?? null,
    escolaridade: tse?.escolaridade ?? null,
    mandatosAnteriores: row.mandatos_anteriores,
    cargosAnteriores: row.cargos_anteriores,
    nomeMentor: mentor,
    origemCadastro:
      row.importado_em != null ? { dataImportacao: row.importado_em, nomeUsuario: importador ?? "—" } : null,
    edicaoAtual,
    historico: historicoBruto,
  };
}

async function buscarNomeMentor(client: SupabaseClient<Database>, idContrato: number): Promise<string | null> {
  const { data, error } = await client
    .from("rel_usuario_contrato")
    .select("dim_usuario(nome)")
    .eq("id_contrato", idContrato)
    .eq("papel_no_contrato", "mentor")
    .is("dt_fim", null)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as { dim_usuario: { nome: string } | null } | null)?.dim_usuario?.nome ?? null;
}

async function buscarNomeUsuario(client: SupabaseClient<Database>, idUsuario: number): Promise<string | null> {
  const { data, error } = await client.from("dim_usuario").select("nome").eq("id_usuario", idUsuario).maybeSingle();
  if (error) throw error;
  return data?.nome ?? null;
}

async function buscarEdicao(client: SupabaseClient<Database>, idEdicao: number): Promise<EdicaoParticipacaoPll | null> {
  const { data, error } = await client
    .from("fat_edicao")
    .select("nome, dt_inicio, dt_fim")
    .eq("id_edicao", idEdicao)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { nomeEdicao: data.nome, dtInicio: data.dt_inicio, dtFim: data.dt_fim, statusContrato: null };
}

interface RowHistorico {
  id_edicao: number | null;
  id_contrato: number | null;
  fat_edicao: { nome: string; dt_inicio: string; dt_fim: string | null } | null;
  fat_contrato: { status: string } | null;
}

/** Todas as edições (fat_edicao) em que este e-mail já apareceu em
 * fat_cadastro_participante, mais recente primeiro. */
async function buscarHistoricoParticipacao(
  client: SupabaseClient<Database>,
  email: string
): Promise<EdicaoParticipacaoPll[]> {
  const { data, error } = await client
    .from("fat_cadastro_participante")
    .select("id_edicao, id_contrato, fat_edicao(nome, dt_inicio, dt_fim), fat_contrato(status)")
    .eq("email", email)
    .not("id_edicao", "is", null);
  if (error) throw error;

  const linhas = (data ?? []) as unknown as RowHistorico[];
  return linhas
    .filter((linha): linha is RowHistorico & { fat_edicao: NonNullable<RowHistorico["fat_edicao"]> } => linha.fat_edicao !== null)
    .map((linha) => ({
      nomeEdicao: linha.fat_edicao.nome,
      dtInicio: linha.fat_edicao.dt_inicio,
      dtFim: linha.fat_edicao.dt_fim,
      statusContrato: linha.fat_contrato?.status ?? null,
    }))
    .sort((a, b) => (a.dtInicio < b.dtInicio ? 1 : -1));
}

async function buscarIdadeEscolaridade(
  client: SupabaseClient<Database>,
  idVinculoTse: number
): Promise<{ idade: number | null; escolaridade: string | null } | null> {
  const { data: vinculo } = await client
    .from("rel_mandato_candidatura")
    .select("id_mandato")
    .eq("id_vinculo_tse", idVinculoTse)
    .maybeSingle();
  if (!vinculo) return null;

  const { data: mandato } = await client
    .from("dim_mandato")
    .select("nr_titulo_eleitoral")
    .eq("id_mandato", vinculo.id_mandato)
    .maybeSingle();
  if (!mandato?.nr_titulo_eleitoral) return null;

  const candidaturas = await buscarTodasCandidaturasPorTitulo(client, mandato.nr_titulo_eleitoral);
  if (candidaturas.length === 0) return null;
  const maisRecente = [...candidaturas].sort((a, b) => b.anoEleicao - a.anoEleicao)[0];

  const perfil = await buscarPerfilCandidatura(client, {
    anoEleicao: maisRecente.anoEleicao,
    sqCandidato: maisRecente.sqCandidato,
    nrTurno: maisRecente.nrTurno,
  }).catch(() => null);
  if (!perfil) return null;

  return { idade: perfil.idade, escolaridade: perfil.grauInstrucao };
}
