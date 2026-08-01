import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import type { CandidaturaSugerida, PerfilCandidatura, PerfilEleitorado } from "../types/fundacao";

export interface FiltrosBuscaCandidatura {
  nome?: string;
  sgUf?: string;
  idCargo?: number;
  anoEleicao?: number;
}

// Chave que identifica uma candidatura TSE nas 3 fontes usadas nesta feature
// (mv_candidatura_resumo, dim_candidatura, mv_perfil_eleitorado_candidatura)
// -- mesma chave de rel_mandato_candidatura (design.md, Data Models).
export interface ChaveCandidatura {
  anoEleicao: number;
  sqCandidato: number;
  nrTurno: number;
}

type LinhaCandidaturaResumo = Database["tse"]["Views"]["mv_candidatura_resumo"]["Row"];

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

function normaliza(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// Aproxima a mesma noção de "quão parecido" do índice GIN trigram de T18
// (app.normaliza_nome(nm_urna)) -- o operador `%`/similarity() do pg_trgm não é
// exposto pela grade de filtros REST do PostgREST, então o ranking de
// confiança é calculado aqui em cima das linhas já filtradas no banco por
// ILIKE (que o índice GIN trigram acelera). Coeficiente de Dice sobre
// bigramas dos nomes normalizados -- mesma família de métrica que pg_trgm usa
// internamente para `similarity()`.
function bigramas(valor: string): string[] {
  const alvo = ` ${valor} `;
  const pares: string[] = [];
  for (let i = 0; i < alvo.length - 1; i += 1) {
    pares.push(alvo.slice(i, i + 2));
  }
  return pares;
}

function similaridade(a: string, b: string): number {
  if (a === b) return 1;
  const bigA = bigramas(a);
  const bigB = [...bigramas(b)];
  let interseccao = 0;
  for (const par of bigA) {
    const indice = bigB.indexOf(par);
    if (indice !== -1) {
      interseccao += 1;
      bigB.splice(indice, 1);
    }
  }
  const total = bigA.length + bigramas(b).length;
  return total === 0 ? 0 : (2 * interseccao) / total;
}

// Spec-precision gap: spec.md (P1 AC1) exige `confianca` (alta/média/baixa)
// visível por resultado, mas não define os limiares numéricos. Sem termo de
// busca (busca só por UF/cargo/ano) não há nenhum sinal de nome para avaliar
// -- classificado como 'baixa' por padrão, decisão tomada nesta implementação.
function calculaConfianca(termoNormalizado: string | null, nomeUrna: string | null): "alta" | "media" | "baixa" {
  if (termoNormalizado == null || nomeUrna == null) return "baixa";
  const score = similaridade(termoNormalizado, normaliza(nomeUrna));
  if (score >= 0.6) return "alta";
  if (score >= 0.3) return "media";
  return "baixa";
}

function paraCandidaturaSugerida(
  linha: LinhaCandidaturaResumo,
  termoNormalizado: string | null
): CandidaturaSugerida {
  return {
    anoEleicao: linha.ano_eleicao ?? 0,
    sqCandidato: linha.sq_candidato ?? 0,
    nrTurno: linha.nr_turno ?? 0,
    nrTituloEleitoral: linha.nr_titulo_eleitoral,
    nmCandidato: linha.nm_candidato,
    nmUrna: linha.nm_urna,
    sgUf: linha.sg_uf,
    nmMunicipioPrincipal: linha.nm_municipio_principal,
    sgPartido: linha.sg_partido,
    cdCargo: linha.cd_cargo,
    dsGenero: null, // Fetched later if needed, or left null
    qtVotosTotal: linha.qt_votos_total ?? 0,
    // esta função só faz busca por nome/UF/cargo/ano sobre a MV -- nunca por
    // nr_titulo_eleitoral exato e nunca 'manual' (isso é decidido pela UI/RPC
    // quando a Gestora confirma uma seleção manual, FND-TSM-02)
    metodoMatch: "nome_uf_cargo",
    confianca: calculaConfianca(termoNormalizado, linha.nm_urna),
  };
}

const ORDEM_CONFIANCA: Record<"alta" | "media" | "baixa", number> = { alta: 2, media: 1, baixa: 0 };

// FND-TSE-01, FND-TSM-01. Consulta direta a tse.mv_candidatura_resumo (sem
// RPC -- é leitura, design.md). `client` é recebido por parâmetro (em vez de
// importado internamente) para permitir mock em teste unitário, sem depender
// de um Supabase real.
export async function buscarCandidaturas(
  client: SupabaseClient<Database>,
  filtros: FiltrosBuscaCandidatura
): Promise<CandidaturaSugerida[]> {
  let query = client.schema("tse").from("mv_candidatura_resumo").select("*");

  if (filtros.nome) {
    query = query.ilike("nm_urna", `%${filtros.nome}%`);
  }
  if (filtros.sgUf) {
    query = query.eq("sg_uf", filtros.sgUf);
  }
  if (filtros.idCargo != null) {
    query = query.eq("cd_cargo", filtros.idCargo);
  }
  if (filtros.anoEleicao != null) {
    query = query.eq("ano_eleicao", filtros.anoEleicao);
  }

  const { data, error } = await query;
  if (error) throw error;
  // ausência de match: lista vazia, nunca erro (spec.md Edge Cases / design.md
  // Error Handling Strategy)
  if (!data) return [];

  const termoNormalizado = filtros.nome ? normaliza(filtros.nome) : null;

  return data
    .map((linha) => paraCandidaturaSugerida(linha, termoNormalizado))
    .sort((a, b) => ORDEM_CONFIANCA[b.confianca] - ORDEM_CONFIANCA[a.confianca]);
}

// Spec-precision gap: spec.md (P1 AC2) pede "idade (calculada a partir de
// dt_nascimento)" sem definir a data de referência do cálculo. Usa 1º de
// outubro do ano_eleicao (data usual do 1º turno das eleições brasileiras)
// em vez da data corrente -- assim o perfil da candidatura (retrato
// histórico) não muda a cada carregamento de tela conforme os dias passam.
function calculaIdade(dtNascimento: string | null, anoEleicao: number): number | null {
  if (dtNascimento == null) return null;
  const nascimento = new Date(dtNascimento);
  if (Number.isNaN(nascimento.getTime())) return null;

  const referencia = new Date(Date.UTC(anoEleicao, 9, 1));
  let idade = referencia.getUTCFullYear() - nascimento.getUTCFullYear();
  const aniversarioAindaNaoChegou =
    referencia.getUTCMonth() < nascimento.getUTCMonth() ||
    (referencia.getUTCMonth() === nascimento.getUTCMonth() && referencia.getUTCDate() < nascimento.getUTCDate());
  if (aniversarioAindaNaoChegou) idade -= 1;
  return idade;
}

// CAD-10. Perfil pessoal da candidatura -- leitura direta de
// tse.dim_candidatura (tabela dimensão, segura de ler crua -- não é a
// fat_votacao_zona grande). Retorna null quando não há linha correspondente
// (mesmo espírito de "ausência de match: nunca erro" de buscarCandidaturas).
export async function buscarPerfilCandidatura(
  client: SupabaseClient<Database>,
  chave: ChaveCandidatura
): Promise<PerfilCandidatura | null> {
  const { data, error } = await client
    .schema("tse")
    .from("dim_candidatura")
    .select("*")
    .eq("ano_eleicao", chave.anoEleicao)
    .eq("sq_candidato", chave.sqCandidato)
    .eq("nr_turno", chave.nrTurno);

  if (error) throw error;
  const linha = data?.[0];
  if (!linha) return null;

  return {
    idade: calculaIdade(linha.dt_nascimento, linha.ano_eleicao),
    genero: linha.ds_genero,
    corRaca: linha.ds_cor_raca,
    grauInstrucao: linha.ds_grau_instrucao,
    ocupacao: linha.ds_ocupacao,
    coligacao: linha.nm_coligacao,
    nmUe: linha.nm_ue,
  };
}

const DIMENSAO_PARA_CHAVE: Record<string, keyof PerfilEleitorado> = {
  genero: "genero",
  faixa_etaria: "faixaEtaria",
  grau_escolaridade: "grauEscolaridade",
};

// CAD-11/CAD-12. Perfil demográfico do eleitorado do município principal --
// leitura da nova view tse.mv_perfil_eleitorado_candidatura (0019), formato
// longo (dimensao/categoria/qt_eleitores) agrupado aqui em 3 listas.
// Retorna null quando não há nenhuma linha pra essa chave (candidatura sem
// município principal identificável -- CAD-12, nunca lê fat_votacao_zona
// direto).
export async function buscarPerfilEleitoradoCandidatura(
  client: SupabaseClient<Database>,
  chave: ChaveCandidatura
): Promise<PerfilEleitorado | null> {
  const { data, error } = await client
    .schema("tse")
    .from("mv_perfil_eleitorado_candidatura")
    .select("*")
    .eq("ano_eleicao", chave.anoEleicao)
    .eq("sq_candidato", chave.sqCandidato)
    .eq("nr_turno", chave.nrTurno);

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const perfil: PerfilEleitorado = { genero: [], faixaEtaria: [], grauEscolaridade: [] };
  for (const linha of data) {
    const chaveDimensao = linha.dimensao ? DIMENSAO_PARA_CHAVE[linha.dimensao] : undefined;
    if (!chaveDimensao || linha.categoria == null || linha.qt_eleitores == null) continue;
    perfil[chaveDimensao].push({ categoria: linha.categoria, qtEleitores: linha.qt_eleitores });
  }
  return perfil;
}

export interface CandidaturaCompletaTse {
  anoEleicao: number;
  sqCandidato: number;
  nrTurno: number;
  nrTituloEleitoral: string | null;
  nmCandidato: string | null;
  nmUrna: string | null;
  sgUf: string | null;
  nmUe: string | null;
  nmMunicipioPrincipal: string | null;
  sgPartido: string | null;
  cdCargo: number | null;
  dsCargo: string | null;
  dsGenero: string | null;
  dsCorRaca: string | null;
  dsGrauInstrucao: string | null;
  dsOcupacao: string | null;
  dsSituacaoCandidatura: string | null;
  dsSitTotTurno: string | null;
  qtVotosTotal: number;
}

// Puxar todas as candidaturas e votos da base pelo título de eleitor + sequencial
export async function buscarTodasCandidaturasPorTitulo(
  client: SupabaseClient<Database>,
  nrTituloEleitoral: string
): Promise<CandidaturaCompletaTse[]> {
  if (!nrTituloEleitoral || nrTituloEleitoral.trim().length === 0) return [];

  // 1. Puxar da base tse.dim_candidatura pelo título de eleitor
  const { data: candidaturas, error } = await client
    .schema("tse")
    .from("dim_candidatura")
    .select("*")
    .eq("nr_titulo_eleitoral", nrTituloEleitoral.trim())
    .order("ano_eleicao", { ascending: false });

  if (error || !candidaturas || candidaturas.length === 0) return [];

  // 2. Para cada candidatura capturada pelo título, buscar votos (resumo ou fat_votacao_zona)
  const resultado = await Promise.all(
    candidaturas.map(async (c) => {
      let qtVotos = 0;
      let nmMunicipio = c.nm_ue !== c.sg_uf ? c.nm_ue : null;

      // Tentar resumo primeiro
      const { data: resumo } = await client
        .schema("tse")
        .from("mv_candidatura_resumo")
        .select("qt_votos_total, nm_municipio_principal")
        .eq("ano_eleicao", c.ano_eleicao)
        .eq("sq_candidato", c.sq_candidato)
        .eq("nr_turno", c.nr_turno)
        .maybeSingle();

      if (resumo?.qt_votos_total) {
        qtVotos = resumo.qt_votos_total;
        if (resumo.nm_municipio_principal) nmMunicipio = resumo.nm_municipio_principal;
      } else {
        // Fallback direto na fat_votacao_zona se resumo ainda não tiver atualizado
        const { data: votosZona } = await client
          .schema("tse")
          .from("fat_votacao_zona")
          .select("qt_votos_nominais")
          .eq("sq_candidato", c.sq_candidato);

        if (votosZona) {
          qtVotos = votosZona.reduce((acc, curr) => acc + (curr.qt_votos_nominais ?? 0), 0);
        }
      }

      return {
        anoEleicao: c.ano_eleicao,
        sqCandidato: c.sq_candidato,
        nrTurno: c.nr_turno,
        nrTituloEleitoral: c.nr_titulo_eleitoral,
        nmCandidato: c.nm_candidato,
        nmUrna: c.nm_urna,
        sgUf: c.sg_uf,
        nmUe: c.nm_ue,
        nmMunicipioPrincipal: nmMunicipio ?? c.nm_ue ?? c.sg_uf,
        sgPartido: c.sg_partido,
        cdCargo: c.cd_cargo,
        dsCargo: c.ds_cargo,
        dsGenero: c.ds_genero,
        dsCorRaca: c.ds_cor_raca,
        dsGrauInstrucao: c.ds_grau_instrucao,
        dsOcupacao: c.ds_ocupacao,
        dsSituacaoCandidatura: c.ds_situacao_candidatura,
        dsSitTotTurno: c.ds_sit_tot_turno,
        qtVotosTotal: qtVotos,
      };
    })
  );

  return resultado;
}
