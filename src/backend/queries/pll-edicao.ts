import type { SupabaseClient } from "@supabase/supabase-js";

import { mapeiaErroRpc } from "../rpc/errors";
import type { Database } from "../supabase/database.types";

// Sessão ao vivo com Pedro (22/09): a aba Participantes do PLL ganhou uma
// entidade própria de "edição" (fat_edicao, migration
// 20260922160505_pll_edicao_estrutura.sql) -- nome, data de início, projeto
// de origem (ref_projeto) e um pool de mentores padrão (rel_edicao_mentor)
// aplicado a cada contrato via app.criar_mandato(p_mentores_padrao).

export interface EdicaoPll {
  idEdicao: number;
  nome: string;
  dtInicio: string;
  idProjeto: number;
  nomeProjeto: string;
}

interface RowEdicao {
  id_edicao: number;
  nome: string;
  dt_inicio: string;
  id_projeto: number;
  ref_projeto: { nome: string } | null;
}

/** Edições ativas do produto, mais recentes primeiro (PLL-CP: seletor da tela Participantes). */
export async function buscarEdicoesPll(
  client: SupabaseClient<Database>,
  idProduto: number
): Promise<EdicaoPll[]> {
  const { data, error } = await client
    .from("fat_edicao")
    .select("id_edicao, nome, dt_inicio, id_projeto, ref_projeto(nome)")
    .eq("id_produto", idProduto)
    .eq("ativo", true)
    .order("dt_inicio", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as RowEdicao[]).map((r) => ({
    idEdicao: r.id_edicao,
    nome: r.nome,
    dtInicio: r.dt_inicio,
    idProjeto: r.id_projeto,
    nomeProjeto: r.ref_projeto?.nome ?? "—",
  }));
}

export interface CriarEdicaoPllInput {
  idProduto: number;
  idProjeto: number;
  nome: string;
  dtInicio: string;
  idsMentores: number[];
}

/**
 * Cria a edição e seu pool de mentores padrão na mesma transação
 * (app.criar_edicao_pll, AD-024 -- duas tabelas, fat_edicao + rel_edicao_mentor).
 */
export async function criarEdicaoPll(
  client: SupabaseClient<Database>,
  input: CriarEdicaoPllInput
): Promise<{ idEdicao: number }> {
  const { data, error } = await client.schema("app").rpc("criar_edicao_pll", {
    p_id_produto: input.idProduto,
    p_id_projeto: input.idProjeto,
    p_nome: input.nome,
    p_dt_inicio: input.dtInicio,
    p_mentores: input.idsMentores.length > 0 ? input.idsMentores : undefined,
  });
  if (error) throw mapeiaErroRpc(error);

  const resultado = data as unknown as { id_edicao: number };
  return { idEdicao: resultado.id_edicao };
}

/** Projetos ativos (ref_projeto) para o select "Projeto/temática" do formulário de nova edição. */
export async function buscarProjetosAtivos(
  client: SupabaseClient<Database>
): Promise<{ id: number; nome: string }[]> {
  const { data, error } = await client.from("ref_projeto").select("id_projeto, nome").eq("ativo", true).order("nome");
  if (error) throw error;
  return (data ?? []).map((p) => ({ id: p.id_projeto, nome: p.nome }));
}

/** Usuários com papel_global='mentor', ativos -- para o multiselect de mentores padrão. */
export async function buscarMentoresDisponiveis(
  client: SupabaseClient<Database>
): Promise<{ id: number; nome: string }[]> {
  const { data, error } = await client
    .from("dim_usuario")
    .select("id_usuario, nome")
    .eq("papel_global", "mentor")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return (data ?? []).map((u) => ({ id: u.id_usuario, nome: u.nome }));
}
