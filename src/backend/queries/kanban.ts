import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

// Formas de leitura (view-models client-side) definidas verbatim conforme
// design.md (## Data Models -- src/backend/queries/kanban.ts).
export interface ColunaKanban {
  idEtapa: number;
  codigo: string;
  nome: string;
  ordem: number;
  cards: CardKanban[];
}

export interface CardKanban {
  idContrato: number;
  nomeContratante: string;
  statusContrato: "ativo" | "concluido" | "nao_concluido";
  diasNaEtapaAtual: number;
}

export interface FiltroBoard {
  idGestora?: number;
  idMentor?: number;
  idProjeto?: number;
  minhaCarteira?: boolean; // restringe a contratos com vínculo ativo do usuário logado
}

interface ContratoBoard {
  id_contrato: number;
  id_etapa_atual: number | null;
  id_contratante: number;
  status: "ativo" | "concluido" | "nao_concluido";
  dt_inicio: string;
}

// dt_fim IS NULL OR dt_fim >= hoje -- mesmo padrão de filtroVinculoAtivo em
// src/backend/queries/contrato.ts.
function filtroVinculoAtivo(): string {
  const hoje = new Date().toISOString().slice(0, 10);
  return `dt_fim.is.null,dt_fim.gte.${hoje}`;
}

// Restringe idsContrato aos contratos onde idUsuario tem vínculo ativo
// naquele papel -- mesmo padrão de contarContratosEAssessoresAtivos.
async function idsContratoPorPapelPessoa(
  client: SupabaseClient<Database>,
  idsContrato: number[],
  papel: "gestora" | "mentor",
  idUsuario: number
): Promise<number[]> {
  if (idsContrato.length === 0) return [];
  const { data, error } = await client
    .from("rel_usuario_contrato")
    .select("id_contrato")
    .in("id_contrato", idsContrato)
    .eq("id_usuario", idUsuario)
    .eq("papel_no_contrato", papel)
    .or(filtroVinculoAtivo());
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((v) => v.id_contrato)));
}

// Restringe idsContrato aos contratos onde o usuário logado (sessão atual)
// tem vínculo ativo, independente do papel (KAN-10).
async function idsContratoMinhaCarteira(client: SupabaseClient<Database>, idsContrato: number[]): Promise<number[]> {
  if (idsContrato.length === 0) return [];

  const { data: auth } = await client.auth.getUser();
  const email = auth.user?.email ?? null;
  if (!email) return [];

  const { data: usuario, error: erroUsuario } = await client
    .from("dim_usuario")
    .select("id_usuario")
    .eq("email", email)
    .maybeSingle();
  if (erroUsuario) throw erroUsuario;
  if (!usuario) return [];

  const { data, error } = await client
    .from("rel_usuario_contrato")
    .select("id_contrato")
    .in("id_contrato", idsContrato)
    .eq("id_usuario", usuario.id_usuario)
    .or(filtroVinculoAtivo());
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((v) => v.id_contrato)));
}

// KAN-01, KAN-02, KAN-03, KAN-10. Board completo de um produto: 1 coluna por
// ref_etapa (ordenada por ordem) + cards de fat_contrato posicionados pela
// etapa atual -- id_etapa_atual IS NULL cai na coluna ordem=1 (design.md,
// contexto confirmado). Filtros (papel+pessoa, projeto, minha carteira)
// combinados por AND (intersecção de conjuntos de id_contrato).
export async function buscarBoardKanban(
  client: SupabaseClient<Database>,
  idProduto: number,
  filtro?: FiltroBoard
): Promise<ColunaKanban[]> {
  const { data: etapas, error: erroEtapas } = await client
    .from("ref_etapa")
    .select("id_etapa, codigo, nome, ordem")
    .eq("id_produto", idProduto)
    .order("ordem", { ascending: true });
  if (erroEtapas) throw erroEtapas;
  if (!etapas || etapas.length === 0) return [];

  const idEtapaOrdem1 = etapas[0].id_etapa;

  let queryContratos = client
    .from("fat_contrato")
    .select("id_contrato, id_etapa_atual, id_contratante, status, dt_inicio")
    .eq("id_produto", idProduto);
  if (filtro?.idProjeto !== undefined) {
    queryContratos = queryContratos.eq("id_projeto", filtro.idProjeto);
  }

  const { data: contratosData, error: erroContratos } = await queryContratos;
  if (erroContratos) throw erroContratos;
  const contratos = (contratosData ?? []) as ContratoBoard[];

  if (contratos.length === 0) {
    return etapas.map((e) => ({ idEtapa: e.id_etapa, codigo: e.codigo, nome: e.nome, ordem: e.ordem, cards: [] }));
  }

  let idsContrato = contratos.map((c) => c.id_contrato);

  if (filtro?.idGestora !== undefined) {
    idsContrato = await idsContratoPorPapelPessoa(client, idsContrato, "gestora", filtro.idGestora);
  }
  if (filtro?.idMentor !== undefined) {
    idsContrato = await idsContratoPorPapelPessoa(client, idsContrato, "mentor", filtro.idMentor);
  }
  if (filtro?.minhaCarteira) {
    idsContrato = await idsContratoMinhaCarteira(client, idsContrato);
  }

  const idsContratoSet = new Set(idsContrato);
  const contratosFiltrados = contratos.filter((c) => idsContratoSet.has(c.id_contrato));

  if (contratosFiltrados.length === 0) {
    return etapas.map((e) => ({ idEtapa: e.id_etapa, codigo: e.codigo, nome: e.nome, ordem: e.ordem, cards: [] }));
  }

  const idsContratante = contratosFiltrados.map((c) => c.id_contratante);
  const { data: contratantes, error: erroContratantes } = await client
    .from("dim_contratante")
    .select("id_contratante, nome")
    .in("id_contratante", idsContratante);
  if (erroContratantes) throw erroContratantes;
  const nomesPorId = new Map((contratantes ?? []).map((c) => [c.id_contratante, c.nome]));

  const idsContratoFiltrados = contratosFiltrados.map((c) => c.id_contrato);
  const { data: etapasContrato, error: erroEtapasContrato } = await client
    .from("fat_etapa_contrato")
    .select("id_contrato, id_etapa, dt_inicio")
    .in("id_contrato", idsContratoFiltrados);
  if (erroEtapasContrato) throw erroEtapasContrato;
  const dtInicioEtapaPorChave = new Map(
    (etapasContrato ?? []).map((ec) => [`${ec.id_contrato}-${ec.id_etapa}`, ec.dt_inicio])
  );

  const hoje = new Date();
  function diasEntre(dtInicio: string): number {
    const inicio = new Date(dtInicio);
    return Math.floor((hoje.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
  }

  const cardsPorEtapa = new Map<number, CardKanban[]>();
  for (const contrato of contratosFiltrados) {
    const idEtapaColuna = contrato.id_etapa_atual ?? idEtapaOrdem1;

    // Regra de "dias na etapa atual" (design.md, Agent's Discretion): usa
    // fat_etapa_contrato.dt_inicio da etapa atual quando setado; senão usa
    // fat_contrato.dt_inicio (único marco real disponível, AD-005).
    const dtInicioEtapa = dtInicioEtapaPorChave.get(`${contrato.id_contrato}-${idEtapaColuna}`) ?? null;
    const dtInicioAncora = dtInicioEtapa ?? contrato.dt_inicio;

    const card: CardKanban = {
      idContrato: contrato.id_contrato,
      nomeContratante: nomesPorId.get(contrato.id_contratante) ?? "",
      statusContrato: contrato.status,
      diasNaEtapaAtual: diasEntre(dtInicioAncora),
    };

    const lista = cardsPorEtapa.get(idEtapaColuna) ?? [];
    lista.push(card);
    cardsPorEtapa.set(idEtapaColuna, lista);
  }

  return etapas.map((e) => ({
    idEtapa: e.id_etapa,
    codigo: e.codigo,
    nome: e.nome,
    ordem: e.ordem,
    cards: cardsPorEtapa.get(e.id_etapa) ?? [],
  }));
}

// KAN-03. Projetos distintos entre os contratos do produto -- popula o
// Select de projeto do filtro do board.
export async function buscarProjetosDoProduto(
  client: SupabaseClient<Database>,
  idProduto: number
): Promise<{ idProjeto: number; nome: string }[]> {
  const { data: contratos, error } = await client
    .from("fat_contrato")
    .select("id_projeto")
    .eq("id_produto", idProduto)
    .not("id_projeto", "is", null);
  if (error) throw error;

  const idsProjeto = Array.from(new Set((contratos ?? []).map((c) => c.id_projeto as number)));
  if (idsProjeto.length === 0) return [];

  const { data: projetos, error: erroProjetos } = await client
    .from("ref_projeto")
    .select("id_projeto, nome")
    .in("id_projeto", idsProjeto);
  if (erroProjetos) throw erroProjetos;

  return (projetos ?? []).map((p) => ({ idProjeto: p.id_projeto, nome: p.nome }));
}
