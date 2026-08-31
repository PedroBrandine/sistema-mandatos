import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

// Formas de leitura (view-models client-side) definidas verbatim conforme
// design.md (## Data Models -- src/backend/queries/numeros-impacto.ts).

// SAI-01, SAI-03. 1 linha = 1 fat_contrato; nrContratosContratante/
// dtPrimeiraContratacao/ordemContrato são window functions já resolvidas
// pela MV (nunca recalculadas aqui, spec.md P1.AC1/AC3).
export interface LinhaNumerosImpacto {
  idContrato: number;
  idContratante: number;
  nomeContratante: string;
  tipoContratante: string; // 'mandato' | 'coalizao'
  sgUf: string | null;
  nmMunicipio: string | null;
  nomeProduto: string;
  nomeProjeto: string | null;
  tematica: string | null;
  dtInicio: string;
  dtFim: string | null;
  anoInicio: number;
  status: string;
  cargoNoContrato: string | null;
  partidoNoContrato: string | null;
  nrContratosContratante: number;
  dtPrimeiraContratacao: string;
  ordemContrato: number;
}

interface RowNumerosImpacto {
  id_contrato: number;
  id_contratante: number;
  nome_contratante: string;
  tipo_contratante: string;
  sg_uf: string | null;
  nm_municipio: string | null;
  nome_produto: string;
  nome_projeto: string | null;
  tematica: string | null;
  dt_inicio: string;
  dt_fim: string | null;
  ano_inicio: number;
  status: string;
  cargo_no_contrato: string | null;
  partido_no_contrato: string | null;
  nr_contratos_contratante: number;
  dt_primeira_contratacao: string;
  ordem_contrato: number;
}

const COLUNAS_NUMEROS_IMPACTO =
  "id_contrato, id_contratante, nome_contratante, tipo_contratante, sg_uf, nm_municipio, " +
  "nome_produto, nome_projeto, tematica, dt_inicio, dt_fim, ano_inicio, status, " +
  "cargo_no_contrato, partido_no_contrato, nr_contratos_contratante, dt_primeira_contratacao, " +
  "ordem_contrato";

// SAI-01, SAI-03. Leitura de mv_numeros_impacto sem filtro de status (D4,
// verbatim do schema aprovado -- todo contrato é contrato assinado) --
// ordenada por nomeContratante no backend, já que a MV não define ordem
// própria (design.md, "src/backend/queries/numeros-impacto.ts").
export async function buscarNumerosImpacto(client: SupabaseClient<Database>): Promise<LinhaNumerosImpacto[]> {
  const { data, error } = await client.from("mv_numeros_impacto").select(COLUNAS_NUMEROS_IMPACTO);
  if (error) throw error;
  const rows = (data ?? []) as unknown as RowNumerosImpacto[];

  return rows
    .map((r) => ({
      idContrato: r.id_contrato,
      idContratante: r.id_contratante,
      nomeContratante: r.nome_contratante,
      tipoContratante: r.tipo_contratante,
      sgUf: r.sg_uf,
      nmMunicipio: r.nm_municipio,
      nomeProduto: r.nome_produto,
      nomeProjeto: r.nome_projeto,
      tematica: r.tematica,
      dtInicio: r.dt_inicio,
      dtFim: r.dt_fim,
      anoInicio: r.ano_inicio,
      status: r.status,
      cargoNoContrato: r.cargo_no_contrato,
      partidoNoContrato: r.partido_no_contrato,
      nrContratosContratante: r.nr_contratos_contratante,
      dtPrimeiraContratacao: r.dt_primeira_contratacao,
      ordemContrato: r.ordem_contrato,
    }))
    .sort((a, b) => a.nomeContratante.localeCompare(b.nomeContratante));
}
