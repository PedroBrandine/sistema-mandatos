import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { atualizaNumerosImpacto } from "../rpc/numeros-impacto";

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

// Fix F1 (validation.md, achado do Verifier): extrai a sequência
// refresh-então-leitura pra uma função nomeada e testável em vez de deixar
// as 2 chamadas soltas dentro do Server Component (spec.md P1.AC2 exige essa
// ordem -- refresh antes de servir a consulta; o sensor de mutação do
// Verifier confirmou que invertê-las não quebrava build+lint, camada sem
// outra proteção). A ordem (`atualizaNumerosImpacto` antes de
// `buscarNumerosImpacto`) é a invariante testada por
// numeros-impacto.test.ts.
export async function atualizaEBuscaNumerosImpacto(client: SupabaseClient<Database>): Promise<LinhaNumerosImpacto[]> {
  await atualizaNumerosImpacto(client);
  return buscarNumerosImpacto(client);
}

// SAI-05, SAI-06. N linhas por id_contratante (1 timeline); idContratoAnterior
// liga renovações -- a UI usa isso pra desenhar continuidade, nunca dois
// cards desconexos quando ele não é null.
//
// Fix F2 (validation.md, achado do Verifier): nomeContratante/tipoContratante
// incluídos aqui -- vw_visao_mandato já seleciona ct.nome AS nome_contratante
// verbatim (docs/schema_sistema.sql:1304-1324), a coluna sempre existiu na
// view; só faltava entrar nesta interface/projeção. Sem JOIN novo, sem
// query adicional -- a justificativa anterior em context.md (que dizia
// exigir consulta extra) estava incorreta.
export interface LinhaVisaoMandato {
  idContrato: number;
  dtInicio: string;
  dtFim: string | null;
  status: string;
  nomeProduto: string;
  nomeProjeto: string | null;
  cargoNoContrato: string | null;
  partidoNoContrato: string | null;
  idContratoAnterior: number | null;
  ordemContrato: number;
  nomeContratante: string;
  tipoContratante: string;
}

interface RowVisaoMandato {
  id_contrato: number;
  dt_inicio: string;
  dt_fim: string | null;
  status: string;
  nome_produto: string;
  nome_projeto: string | null;
  cargo_no_contrato: string | null;
  partido_no_contrato: string | null;
  id_contrato_anterior: number | null;
  ordem_contrato: number;
  nome_contratante: string;
  tipo_contratante: string;
}

const COLUNAS_VISAO_MANDATO =
  "id_contrato, dt_inicio, dt_fim, status, nome_produto, nome_projeto, cargo_no_contrato, " +
  "partido_no_contrato, id_contrato_anterior, ordem_contrato, nome_contratante, tipo_contratante";

// SAI-05, SAI-06. Timeline consolidada de um contratante -- vw_visao_mandato
// filtrada por id_contratante, ordenada por ordem_contrato (spec.md P2.AC1).
export async function buscarVisaoMandato(
  client: SupabaseClient<Database>,
  idContratante: number
): Promise<LinhaVisaoMandato[]> {
  const { data, error } = await client
    .from("vw_visao_mandato")
    .select(COLUNAS_VISAO_MANDATO)
    .eq("id_contratante", idContratante)
    .order("ordem_contrato");
  if (error) throw error;
  const rows = (data ?? []) as unknown as RowVisaoMandato[];

  return rows.map((r) => ({
    idContrato: r.id_contrato,
    dtInicio: r.dt_inicio,
    dtFim: r.dt_fim,
    status: r.status,
    nomeProduto: r.nome_produto,
    nomeProjeto: r.nome_projeto,
    cargoNoContrato: r.cargo_no_contrato,
    partidoNoContrato: r.partido_no_contrato,
    idContratoAnterior: r.id_contrato_anterior,
    ordemContrato: r.ordem_contrato,
    nomeContratante: r.nome_contratante,
    tipoContratante: r.tipo_contratante,
  }));
}
