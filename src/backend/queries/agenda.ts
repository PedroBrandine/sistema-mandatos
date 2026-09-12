import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

// EST-12 (T25, design.md "AgendaMes + EncontroPopover" -- Interfaces:
// `buscarEncontrosDoMes(client, { idProduto, ano, mes, filtros })`).
// Filtro achatado num objeto só (sem o aninhamento `filtros` de design.md),
// mesma forma de FiltroPendencias (T17) e FiltroMandatosLista (T19) -- os
// dois nomes nunca colidiam, só precisavam ser escolhidos de forma
// consistente, mesma reconciliação registrada na Fase 5.
//
// FUSO: dt_prevista_inicio é TIMESTAMPTZ (diferente de dt_inicio/dt_fim de
// fat_contrato, que são DATE puro). "Mês corrente" e "dia correto" (EST-12
// AC1) são do ponto de vista de quem usa, no Brasil -- um encontro às 21h de
// 30/09 em São Paulo é 01/10 em UTC e cairia no mês errado da grade. O spec
// não nomeia fuso nenhum: SPEC-PRECISION GAP registrado no commit desta task.
// A escolha fica aqui, explícita e num lugar só, nunca implícita no fuso da
// máquina que roda o código (lição L-002).
export const FUSO_HORARIO_PRODUTO = "-03:00";

// Intervalo meio-aberto [inicio, fim): o primeiro instante do mês pedido e o
// primeiro instante do mês seguinte. Meio-aberto em vez de [inicio, último
// instante] porque TIMESTAMPTZ tem precisão de microssegundo -- um "23:59:59"
// como teto perderia um encontro às 23:59:59.5.
export function intervaloDoMes(ano: number, mes: number): { inicio: string; fim: string } {
  const anoSeguinte = mes === 12 ? ano + 1 : ano;
  const mesSeguinte = mes === 12 ? 1 : mes + 1;
  const carimbo = (a: number, m: number) =>
    `${a}-${String(m).padStart(2, "0")}-01T00:00:00${FUSO_HORARIO_PRODUTO}`;
  return { inicio: carimbo(ano, mes), fim: carimbo(anoSeguinte, mesSeguinte) };
}

// Uma linha de rel_encontro_participante já resolvida para exibição: a tabela
// identifica a pessoa por id_usuario OU por nome_livre (ck_participante_
// identificacao garante exatamente um dos dois), então o nome sai de um ou de
// outro e o componente não precisa saber qual.
export interface ParticipanteEncontro {
  idParticipacao: number;
  nome: string;
  origem: string;
  presente: boolean;
}

// Campos que EST-13 AC1 nomeia (status, etapa, tipo, data/horário,
// modalidade, local, tema, participantes) vêm todos daqui: T28 (popover) não
// tem query própria no tasks.md, recebe o encontro por prop.
// Nulo passa adiante como nulo (AD-005) -- "—" é responsabilidade do
// componente, nunca da camada de leitura.
export interface EncontroAgenda {
  idEncontro: number;
  idContrato: number;
  nomeContratante: string;
  titulo: string;
  status: "planejado" | "realizado" | "cancelado" | "remarcado";
  dtPrevistaInicio: string | null;
  dtPrevistaFim: string | null;
  dtRealizada: string | null;
  nomeEtapa: string | null;
  nomeTipo: string | null;
  modalidade: string | null;
  local: string | null;
  temaPrioritario: string | null;
  participantes: ParticipanteEncontro[];
}

export interface FiltroAgenda {
  idProduto: number;
  ano: number;
  mes: number;
  idGestora?: number;
  idProjeto?: number;
  idContrato?: number;
}

interface RowEncontro {
  id_encontro: number;
  id_contrato: number;
  id_etapa: number | null;
  id_tipo_registro: number | null;
  titulo: string;
  status: string;
  dt_prevista_inicio: string | null;
  dt_prevista_fim: string | null;
  dt_realizada: string | null;
  modalidade: string | null;
  local: string | null;
  tema_prioritario: string | null;
}

interface RowContratoId {
  id_contrato: number;
}

interface RowParticipante {
  id_participacao: number;
  id_encontro: number;
  id_usuario: number | null;
  nome_livre: string | null;
  origem: string;
  presente: boolean;
}

// Gestora, projeto e contrato restringem por interseção (AND), nunca por
// união -- mesma regra de resolverIdsContratoDoFiltro em queries/pendencias.ts.
// idProduto sempre entra: a Agenda é por produto.
//
// Exportada para queries/registros-agenda.ts (T27): a lista de Registros da
// Agenda usa exatamente este recorte, com o mesmo tipo FiltroAgenda. Clonar
// a função lá seria uma duplicata equivalente que deriva em silêncio quando
// uma das duas mudar (lição L-005) -- diferente do caso de pendencias.ts vs
// visao-gerencial.ts, onde os tipos de filtro eram de fato distintos.
export async function resolverIdsContratoDoFiltro(
  client: SupabaseClient<Database>,
  filtro: FiltroAgenda
): Promise<number[]> {
  let queryContrato = client.from("fat_contrato").select("id_contrato").eq("id_produto", filtro.idProduto);
  if (filtro.idProjeto !== undefined) {
    queryContrato = queryContrato.eq("id_projeto", filtro.idProjeto);
  }
  if (filtro.idContrato !== undefined) {
    queryContrato = queryContrato.eq("id_contrato", filtro.idContrato);
  }
  const { data: contratosData, error: erroContratos } = await queryContrato;
  if (erroContratos) throw erroContratos;
  let ids = new Set((contratosData ?? []).map((c) => (c as RowContratoId).id_contrato));

  if (filtro.idGestora !== undefined) {
    if (ids.size === 0) return [];
    const { data: vinculosData, error: erroVinculos } = await client
      .from("rel_usuario_contrato")
      .select("id_contrato")
      .in("id_contrato", [...ids])
      .eq("id_usuario", filtro.idGestora)
      .eq("papel_no_contrato", "gestora")
      .is("dt_fim", null);
    if (erroVinculos) throw erroVinculos;
    const idsGestora = new Set((vinculosData ?? []).map((v) => (v as RowContratoId).id_contrato));
    ids = new Set([...ids].filter((id) => idsGestora.has(id)));
  }

  return [...ids];
}

async function buscarNomesPorId(
  client: SupabaseClient<Database>,
  tabela: "dim_contratante" | "ref_etapa" | "ref_tipo_registro",
  coluna: string,
  ids: number[]
): Promise<Map<number, string>> {
  const mapa = new Map<number, string>();
  if (ids.length === 0) return mapa;

  const { data, error } = await client.from(tabela).select(`${coluna}, nome`).in(coluna, ids);
  if (error) throw error;

  for (const linha of (data ?? []) as unknown as Record<string, unknown>[]) {
    mapa.set(linha[coluna] as number, linha.nome as string);
  }
  return mapa;
}

async function buscarParticipantes(
  client: SupabaseClient<Database>,
  idsEncontro: number[]
): Promise<Map<number, ParticipanteEncontro[]>> {
  const mapa = new Map<number, ParticipanteEncontro[]>();
  if (idsEncontro.length === 0) return mapa;

  const { data, error } = await client
    .from("rel_encontro_participante")
    .select("id_participacao, id_encontro, id_usuario, nome_livre, origem, presente")
    .in("id_encontro", idsEncontro);
  if (error) throw error;

  const linhas = (data ?? []) as RowParticipante[];
  const idsUsuario = Array.from(
    new Set(linhas.map((p) => p.id_usuario).filter((id): id is number => id !== null))
  );

  const nomesPorUsuario = new Map<number, string>();
  if (idsUsuario.length > 0) {
    const { data: usuarios, error: erroUsuarios } = await client
      .from("dim_usuario")
      .select("id_usuario, nome")
      .in("id_usuario", idsUsuario);
    if (erroUsuarios) throw erroUsuarios;
    for (const u of (usuarios ?? []) as { id_usuario: number; nome: string }[]) {
      nomesPorUsuario.set(u.id_usuario, u.nome);
    }
  }

  for (const p of linhas) {
    const lista = mapa.get(p.id_encontro) ?? [];
    lista.push({
      idParticipacao: p.id_participacao,
      nome: p.id_usuario !== null ? nomesPorUsuario.get(p.id_usuario) ?? "" : p.nome_livre ?? "",
      origem: p.origem,
      presente: p.presente,
    });
    mapa.set(p.id_encontro, lista);
  }
  return mapa;
}

// EST-12 AC1/AC3 (T25). Encontros de UM mês do produto. Mês sem encontro
// devolve [], nunca lança (edge case do spec) -- mesmo padrão de
// buscarBoardKanban.
export async function buscarEncontrosDoMes(
  client: SupabaseClient<Database>,
  filtro: FiltroAgenda
): Promise<EncontroAgenda[]> {
  const idsContrato = await resolverIdsContratoDoFiltro(client, filtro);
  if (idsContrato.length === 0) return [];

  const { inicio, fim } = intervaloDoMes(filtro.ano, filtro.mes);

  const { data, error } = await client
    .from("fat_encontro")
    .select(
      "id_encontro, id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario"
    )
    .in("id_contrato", idsContrato)
    .gte("dt_prevista_inicio", inicio)
    .lt("dt_prevista_inicio", fim)
    .order("dt_prevista_inicio", { ascending: true });
  if (error) throw error;

  const encontros = (data ?? []) as RowEncontro[];
  if (encontros.length === 0) return [];

  const { data: contratos, error: erroContratos } = await client
    .from("fat_contrato")
    .select("id_contrato, id_contratante")
    .in("id_contrato", Array.from(new Set(encontros.map((e) => e.id_contrato))));
  if (erroContratos) throw erroContratos;
  const contratantePorContrato = new Map(
    ((contratos ?? []) as { id_contrato: number; id_contratante: number }[]).map((c) => [
      c.id_contrato,
      c.id_contratante,
    ])
  );

  const idsEtapa = Array.from(
    new Set(encontros.map((e) => e.id_etapa).filter((id): id is number => id !== null))
  );
  const idsTipo = Array.from(
    new Set(encontros.map((e) => e.id_tipo_registro).filter((id): id is number => id !== null))
  );

  const [nomesContratante, nomesEtapa, nomesTipo, participantesPorEncontro] = await Promise.all([
    buscarNomesPorId(
      client,
      "dim_contratante",
      "id_contratante",
      Array.from(new Set([...contratantePorContrato.values()]))
    ),
    buscarNomesPorId(client, "ref_etapa", "id_etapa", idsEtapa),
    buscarNomesPorId(client, "ref_tipo_registro", "id_tipo_registro", idsTipo),
    buscarParticipantes(
      client,
      encontros.map((e) => e.id_encontro)
    ),
  ]);

  return encontros.map((e) => {
    const idContratante = contratantePorContrato.get(e.id_contrato);
    return {
      idEncontro: e.id_encontro,
      idContrato: e.id_contrato,
      nomeContratante: idContratante !== undefined ? nomesContratante.get(idContratante) ?? "" : "",
      titulo: e.titulo,
      status: e.status as EncontroAgenda["status"],
      dtPrevistaInicio: e.dt_prevista_inicio,
      dtPrevistaFim: e.dt_prevista_fim,
      dtRealizada: e.dt_realizada,
      nomeEtapa: e.id_etapa !== null ? nomesEtapa.get(e.id_etapa) ?? null : null,
      nomeTipo: e.id_tipo_registro !== null ? nomesTipo.get(e.id_tipo_registro) ?? null : null,
      modalidade: e.modalidade,
      local: e.local,
      temaPrioritario: e.tema_prioritario,
      participantes: participantesPorEncontro.get(e.id_encontro) ?? [],
    };
  });
}
