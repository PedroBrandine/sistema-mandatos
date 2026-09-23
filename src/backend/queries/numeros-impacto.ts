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
  idProjeto: number | null;
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
  idGestora: number | null;
  nomeGestora: string | null;
  dsGenero: string | null;
  dsRaca: string | null;
  dsOrientacaoSexual: string | null;
}

interface RowNumerosImpacto {
  id_contrato: number;
  id_contratante: number;
  nome_contratante: string;
  tipo_contratante: string;
  sg_uf: string | null;
  nm_municipio: string | null;
  nome_produto: string;
  id_projeto: number | null;
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
  id_gestora: number | null;
  nome_gestora: string | null;
  ds_genero: string | null;
  ds_raca: string | null;
  ds_orientacao_sexual: string | null;
}

const COLUNAS_NUMEROS_IMPACTO =
  "id_contrato, id_contratante, nome_contratante, tipo_contratante, sg_uf, nm_municipio, " +
  "nome_produto, id_projeto, nome_projeto, tematica, dt_inicio, dt_fim, ano_inicio, status, " +
  "cargo_no_contrato, partido_no_contrato, nr_contratos_contratante, dt_primeira_contratacao, " +
  "ordem_contrato, id_gestora, nome_gestora, ds_genero, ds_raca, ds_orientacao_sexual";

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
      idProjeto: r.id_projeto,
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
      idGestora: r.id_gestora,
      nomeGestora: r.nome_gestora,
      dsGenero: r.ds_genero,
      dsRaca: r.ds_raca,
      dsOrientacaoSexual: r.ds_orientacao_sexual,
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

// Dashboard "Números de Impacto" (2026-09-22, apresentação do Pedro). O
// conjunto de LinhaNumerosImpacto já vem inteiro do Server Component (leitura
// deliberadamente organização-inteira, comentário de T2/20260831022144) --
// filtro e agregação para os gráficos/KPIs acontecem aqui, na camada de
// query, e não dentro do componente React (mesmo padrão de
// queries/visao-gerencial.ts: `acc.qtdContratos += 1`, `porCampo.get(campo)`
// -- a tela só recebe números prontos, nunca soma/conta sozinha).
export interface FiltroNumerosImpacto {
  idsGestora?: number[];
  idsProjeto?: number[];
  anos?: number[];
  // PF2-04 (.specs/features/pente-fino-2026-09-23/spec.md): idContratante/
  // nomeProduto já existem em cada LinhaNumerosImpacto -- filtro 100%
  // client-side, mesmo padrão de idsGestora/idsProjeto/anos, sem RPC/view
  // nova. nomeProduto não tem id próprio na MV (só o nome), então o filtro
  // usa o próprio nome como valor -- mesmo padrão já usado por `anos`.
  idsContratante?: number[];
  produtos?: string[];
}

function temValores<T>(lista: T[] | undefined): lista is T[] {
  return lista !== undefined && lista.length > 0;
}

export function filtraNumerosImpacto(
  linhas: LinhaNumerosImpacto[],
  filtro: FiltroNumerosImpacto
): LinhaNumerosImpacto[] {
  return linhas.filter((l) => {
    if (temValores(filtro.idsGestora) && (l.idGestora === null || !filtro.idsGestora.includes(l.idGestora))) {
      return false;
    }
    if (temValores(filtro.idsProjeto) && (l.idProjeto === null || !filtro.idsProjeto.includes(l.idProjeto))) {
      return false;
    }
    if (temValores(filtro.anos) && !filtro.anos.includes(l.anoInicio)) {
      return false;
    }
    if (temValores(filtro.idsContratante) && !filtro.idsContratante.includes(l.idContratante)) {
      return false;
    }
    if (temValores(filtro.produtos) && !filtro.produtos.includes(l.nomeProduto)) {
      return false;
    }
    return true;
  });
}

export interface OpcaoNumerosImpacto {
  id: number;
  nome: string;
}

export interface OpcoesFiltroNumerosImpacto {
  gestoras: OpcaoNumerosImpacto[];
  projetos: OpcaoNumerosImpacto[];
  anos: number[];
  // PF2-04: mesmo racional de gestoras/projetos (derivado do conjunto já
  // carregado); produtos é lista de nomes (sem id próprio na MV).
  contratantes: OpcaoNumerosImpacto[];
  produtos: string[];
}

// Opções derivadas do próprio conjunto carregado -- só gestora/projeto/ano/
// contratante/produto que de fato aparecem em algum contrato de
// mv_numeros_impacto entram na lista (sem 2ª consulta a dim_usuario/ref_projeto).
export function opcoesFiltroNumerosImpacto(linhas: LinhaNumerosImpacto[]): OpcoesFiltroNumerosImpacto {
  const gestoras = new Map<number, string>();
  const projetos = new Map<number, string>();
  const anos = new Set<number>();
  const contratantes = new Map<number, string>();
  const produtos = new Set<string>();

  for (const l of linhas) {
    if (l.idGestora !== null && l.nomeGestora !== null) gestoras.set(l.idGestora, l.nomeGestora);
    if (l.idProjeto !== null && l.nomeProjeto !== null) projetos.set(l.idProjeto, l.nomeProjeto);
    anos.add(l.anoInicio);
    contratantes.set(l.idContratante, l.nomeContratante);
    produtos.add(l.nomeProduto);
  }

  const porNome = (a: OpcaoNumerosImpacto, b: OpcaoNumerosImpacto) => a.nome.localeCompare(b.nome);

  return {
    gestoras: [...gestoras].map(([id, nome]) => ({ id, nome })).sort(porNome),
    projetos: [...projetos].map(([id, nome]) => ({ id, nome })).sort(porNome),
    anos: [...anos].sort((a, b) => a - b),
    contratantes: [...contratantes].map(([id, nome]) => ({ id, nome })).sort(porNome),
    produtos: [...produtos].sort((a, b) => a.localeCompare(b)),
  };
}

export interface ItemContagemNumerosImpacto {
  id: string;
  rotulo: string;
  valor: number;
}

const SEM_PROJETO = "Sem projeto";
const NAO_INFORMADO = "Não informado";

function contagemPor(linhas: LinhaNumerosImpacto[], chave: (l: LinhaNumerosImpacto) => string): ItemContagemNumerosImpacto[] {
  const contagem = new Map<string, number>();
  for (const l of linhas) {
    const rotulo = chave(l);
    contagem.set(rotulo, (contagem.get(rotulo) ?? 0) + 1);
  }
  return [...contagem].map(([rotulo, valor]) => ({ id: rotulo, rotulo, valor }));
}

// Percentual sobre o total filtrado (não só sobre quem respondeu) -- "Não
// informado" entra como fatia própria em vez de sumir do gráfico, mesmo
// espírito de AD-005 (ausência de dado é fato, não se esconde).
function percentualPor(linhas: LinhaNumerosImpacto[], chave: (l: LinhaNumerosImpacto) => string | null): ItemContagemNumerosImpacto[] {
  const total = linhas.length;
  const contagem = contagemPor(linhas, (l) => chave(l) ?? NAO_INFORMADO);
  if (total === 0) return contagem;
  return contagem.map((item) => ({ ...item, valor: Math.round((item.valor / total) * 1000) / 10 }));
}

// Contratantes distintos que casam com o predicado -- usado pra separar
// "quantidade de mandatos" de "quantidade de coalizões" por tipoContratante
// em vez de somar os dois num único número (o que a versão anterior fazia).
function qtdContratantesDistintos(linhas: LinhaNumerosImpacto[], predicado: (l: LinhaNumerosImpacto) => boolean): number {
  return new Set(linhas.filter(predicado).map((l) => l.idContratante)).size;
}

export interface ResumoNumerosImpacto {
  qtdContratos: number;
  qtdMandatos: number;
  qtdCoalizoes: number;
  porProduto: ItemContagemNumerosImpacto[];
  porProjeto: ItemContagemNumerosImpacto[];
  porStatus: ItemContagemNumerosImpacto[];
  porAno: ItemContagemNumerosImpacto[];
  percentualGenero: ItemContagemNumerosImpacto[];
  percentualRaca: ItemContagemNumerosImpacto[];
  percentualOrientacaoSexual: ItemContagemNumerosImpacto[];
}

// `linhas` aqui já é o recorte filtrado (filtraNumerosImpacto aplicado antes)
// -- esta função só soma/agrupa, nunca decide o que entra no recorte.
export function resumoNumerosImpacto(linhas: LinhaNumerosImpacto[]): ResumoNumerosImpacto {
  return {
    qtdContratos: linhas.length,
    qtdMandatos: qtdContratantesDistintos(linhas, (l) => l.tipoContratante === "mandato"),
    qtdCoalizoes: qtdContratantesDistintos(linhas, (l) => l.tipoContratante === "coalizao"),
    porProduto: contagemPor(linhas, (l) => l.nomeProduto),
    porProjeto: contagemPor(linhas, (l) => l.nomeProjeto ?? SEM_PROJETO),
    porStatus: contagemPor(linhas, (l) => l.status),
    porAno: contagemPor(linhas, (l) => String(l.anoInicio)).sort((a, b) => Number(a.rotulo) - Number(b.rotulo)),
    percentualGenero: percentualPor(linhas, (l) => l.dsGenero),
    percentualRaca: percentualPor(linhas, (l) => l.dsRaca),
    percentualOrientacaoSexual: percentualPor(linhas, (l) => l.dsOrientacaoSexual),
  };
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
