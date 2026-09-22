import type { SupabaseClient } from "@supabase/supabase-js";

import { buscarEncontrosDoMes, type EncontroAgenda } from "./agenda";
import { buscarProjetosDoProduto } from "./kanban";
import type { OpcaoAgenda } from "./agenda";
import type { Database } from "../supabase/database.types";

// pll-dashboard-agenda T14 (design.md "Ajuste de FiltrosAgenda ->
// FiltrosAgendaPll", PLL-AG-08). 3 leituras de opções de filtro para a
// Agenda do PLL: mentor(a), mentorado e edição -- D-4 da spec.
//
// `OpcaoAgenda` (queries/agenda.ts) é o tipo genérico {id, nome} que
// FiltrosAgenda já usa -- reaproveitado aqui para FiltrosAgendaPll consumir
// no mesmo formato, sem inventar um segundo tipo de opção equivalente.

// buscarOpcoesMentorPll JÁ EXISTE em queries/pll-dashboard.ts (T12, filtro
// "Filtrar por mentor(a)" do Dashboard) -- mesmo recorte que a Agenda
// precisa (vínculo papel_no_contrato='mentor' ativo em contrato PLL).
// Reexportado aqui em vez de duplicado (lição L-005: duplicata equivalente
// deriva em silêncio quando uma das duas muda).
export { buscarOpcoesMentorPll } from "./pll-dashboard";

async function buscarUsuariosPorPapel(
  client: SupabaseClient<Database>,
  idProduto: number,
  papel: string
): Promise<OpcaoAgenda[]> {
  const { data: contratos, error: erroContratos } = await client
    .from("fat_contrato")
    .select("id_contrato")
    .eq("id_produto", idProduto);
  if (erroContratos) throw erroContratos;
  const idsContrato = (contratos ?? []).map((c) => c.id_contrato);
  if (idsContrato.length === 0) return [];

  const { data: vinculos, error: erroVinculos } = await client
    .from("rel_usuario_contrato")
    .select("id_usuario")
    .in("id_contrato", idsContrato)
    .eq("papel_no_contrato", papel)
    .is("dt_fim", null);
  if (erroVinculos) throw erroVinculos;
  const idsUsuario = Array.from(new Set((vinculos ?? []).map((v) => v.id_usuario as number)));
  if (idsUsuario.length === 0) return [];

  const { data: usuarios, error: erroUsuarios } = await client
    .from("dim_usuario")
    .select("id_usuario, nome")
    .in("id_usuario", idsUsuario)
    .order("nome");
  if (erroUsuarios) throw erroUsuarios;
  return ((usuarios ?? []) as { id_usuario: number; nome: string }[]).map((u) => ({ id: u.id_usuario, nome: u.nome }));
}

// D-4/D-12: mentorado é usuário com vínculo papel_no_contrato='assessor'
// ativo num contrato PLL -- mesmo critério de D-12 (queries/pll-dashboard.ts,
// buscarMentoradosPll), aqui só como opção de dropdown (id + nome), não a
// linha inteira da tabela.
export async function buscarOpcoesMentoradoPll(
  client: SupabaseClient<Database>,
  idProduto: number
): Promise<OpcaoAgenda[]> {
  return buscarUsuariosPorPapel(client, idProduto, "assessor");
}

// D-4: Edição = ref_projeto com contrato PLL -- mesma leitura de
// buscarProjetosDoProduto (queries/kanban.ts, já escopada ao produto e usada
// pelo Dashboard de Estratégia/Coalizão e pelo Dashboard do PLL, T12), só
// remapeada para a forma {id, nome} de OpcaoAgenda em vez de {idProjeto, nome}.
export async function buscarOpcoesEdicaoPll(
  client: SupabaseClient<Database>,
  idProduto: number
): Promise<OpcaoAgenda[]> {
  const projetos = await buscarProjetosDoProduto(client, idProduto);
  return projetos.map((p) => ({ id: p.idProjeto, nome: p.nome }));
}

// =============================================================================
// T15: buscarEncontrosDoMesPll -- compõe buscarEncontrosDoMes (agenda.ts)
// SEM alterá-la (design.md "Existing Components to Leverage": "Filtro troca
// idsGestora/idsContrato por idsMentor/idsMentorado"). buscarEncontrosDoMes
// não conhece mentor(a)/mentorado -- só idsGestora/idsProjeto/idsContrato --
// então esta função resolve mentor(a)/mentorado num idsContrato aqui, e passa
// esse recorte pronto pro parâmetro idsContrato que já existe, junto com
// idsProjeto (que buscarEncontrosDoMes já aceita nativamente).
// =============================================================================

export interface FiltroAgendaPll {
  idProduto: number;
  ano: number;
  mes: number;
  idsMentor?: number[];
  idsMentorado?: number[];
  idsProjeto?: number[];
}

interface RowContratoId {
  id_contrato: number;
}

// Interseção (AND) entre mentor(a) e mentorado, mesmo critério de
// resolverIdsContratoPll (queries/pll-dashboard.ts) -- não reaproveitada
// diretamente porque aquela função só resolve idsMentor, não idsMentorado
// (a Agenda é o único dos dois telas que filtra por mentorado, D-4).
// Exportada: T15 (PllAgendaPage, D-10) também usa para achar o id_contrato
// do único mentorado marcado no filtro, para o botão "Novo agendamento".
export async function resolverIdsContratoPorMentorEMentorado(
  client: SupabaseClient<Database>,
  idProduto: number,
  idsMentor: number[] | undefined,
  idsMentorado: number[] | undefined
): Promise<number[]> {
  const { data: contratos, error: erroContratos } = await client
    .from("fat_contrato")
    .select("id_contrato")
    .eq("id_produto", idProduto);
  if (erroContratos) throw erroContratos;
  let ids = new Set((contratos ?? []).map((c) => (c as RowContratoId).id_contrato));

  async function restringirPorPapel(idsVinculo: number[], papel: string) {
    if (ids.size === 0) return;
    const { data: vinculos, error: erroVinculos } = await client
      .from("rel_usuario_contrato")
      .select("id_contrato")
      .in("id_contrato", [...ids])
      .in("id_usuario", idsVinculo)
      .eq("papel_no_contrato", papel)
      .is("dt_fim", null);
    if (erroVinculos) throw erroVinculos;
    const idsComPapel = new Set((vinculos ?? []).map((v) => (v as RowContratoId).id_contrato));
    ids = new Set([...ids].filter((id) => idsComPapel.has(id)));
  }

  if (idsMentor !== undefined && idsMentor.length > 0) await restringirPorPapel(idsMentor, "mentor");
  if (idsMentorado !== undefined && idsMentorado.length > 0) await restringirPorPapel(idsMentorado, "assessor");

  return [...ids];
}

// D-6(a): a lista "Encontros do mês" tem coluna Mentor(a), que
// EncontroAgenda (agenda.ts) não carrega -- reuse sem alteração significa
// enriquecer AQUI, não acrescentar a coluna na query genérica da Agenda
// (Estratégia/Coalizão não têm "mentor" no vocabulário).
export interface EncontroAgendaPll extends EncontroAgenda {
  nomeMentor: string | null;
}

async function buscarNomesMentorPorContrato(
  client: SupabaseClient<Database>,
  idsContrato: number[]
): Promise<Map<number, string>> {
  const mapa = new Map<number, string>();
  if (idsContrato.length === 0) return mapa;

  const { data: vinculos, error: erroVinculos } = await client
    .from("rel_usuario_contrato")
    .select("id_contrato, id_usuario")
    .in("id_contrato", idsContrato)
    .eq("papel_no_contrato", "mentor")
    .is("dt_fim", null);
  if (erroVinculos) throw erroVinculos;
  const linhas = (vinculos ?? []) as { id_contrato: number; id_usuario: number }[];
  if (linhas.length === 0) return mapa;

  const idsUsuario = Array.from(new Set(linhas.map((v) => v.id_usuario)));
  const { data: usuarios, error: erroUsuarios } = await client
    .from("dim_usuario")
    .select("id_usuario, nome")
    .in("id_usuario", idsUsuario);
  if (erroUsuarios) throw erroUsuarios;
  const nomesPorUsuario = new Map(
    ((usuarios ?? []) as { id_usuario: number; nome: string }[]).map((u) => [u.id_usuario, u.nome])
  );

  for (const v of linhas) {
    if (!mapa.has(v.id_contrato)) {
      const nome = nomesPorUsuario.get(v.id_usuario);
      if (nome !== undefined) mapa.set(v.id_contrato, nome);
    }
  }
  return mapa;
}

// PLL-AG-08/09: mentor(a)/mentorado/edição recortam a grade e a lista por
// interseção. `idsMentor`/`idsMentorado` resolvem um `idsContrato` explícito
// só quando pelo menos um dos dois está marcado -- sem filtro nenhum, a
// consulta segue sem `idsContrato` (todo o produto, mesmo comportamento de
// buscarEncontrosDoMes hoje). Cada Encontro sai com `nomeMentor` (D-6a),
// `null` quando o contrato não tem mentor pareado (AD-005).
export async function buscarEncontrosDoMesPll(
  client: SupabaseClient<Database>,
  filtro: FiltroAgendaPll
): Promise<EncontroAgendaPll[]> {
  const precisaResolverContrato =
    (filtro.idsMentor !== undefined && filtro.idsMentor.length > 0) ||
    (filtro.idsMentorado !== undefined && filtro.idsMentorado.length > 0);

  const idsContrato = precisaResolverContrato
    ? await resolverIdsContratoPorMentorEMentorado(client, filtro.idProduto, filtro.idsMentor, filtro.idsMentorado)
    : undefined;

  const encontros = await buscarEncontrosDoMes(client, {
    idProduto: filtro.idProduto,
    ano: filtro.ano,
    mes: filtro.mes,
    idsProjeto: filtro.idsProjeto,
    idsContrato,
  });
  if (encontros.length === 0) return [];

  const nomesPorContrato = await buscarNomesMentorPorContrato(
    client,
    Array.from(new Set(encontros.map((e) => e.idContrato)))
  );

  return encontros.map((e) => ({ ...e, nomeMentor: nomesPorContrato.get(e.idContrato) ?? null }));
}
