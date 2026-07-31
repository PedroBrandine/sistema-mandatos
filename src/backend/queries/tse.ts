import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import type { CandidaturaSugerida } from "../types/fundacao";

export interface FiltrosBuscaCandidatura {
  nome?: string;
  sgUf?: string;
  idCargo?: number;
  anoEleicao?: number;
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
