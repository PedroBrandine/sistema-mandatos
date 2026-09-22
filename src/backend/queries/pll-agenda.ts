import type { SupabaseClient } from "@supabase/supabase-js";

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
