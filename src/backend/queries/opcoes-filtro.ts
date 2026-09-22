import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

// Opções dos selects de Gestora e Projeto das telas do produto. Mesmas duas
// leituras que mandatos/page.tsx e dashboard/page.tsx já fazem inline
// (gestoras ativas do sistema, não escopadas ao produto; projetos ativos) --
// aqui como função com cliente injetado, para a aba de Fatos Geradores não
// ser a terceira cópia.
export interface OpcaoFiltro {
  id: number;
  nome: string;
}

export async function buscarGestorasAtivas(client: SupabaseClient<Database>): Promise<OpcaoFiltro[]> {
  const { data, error } = await client
    .from("dim_usuario")
    .select("id_usuario, nome")
    .eq("papel_global", "gestora")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return (data ?? []).map((u) => ({ id: u.id_usuario, nome: u.nome }));
}

export async function buscarProjetosAtivos(client: SupabaseClient<Database>): Promise<OpcaoFiltro[]> {
  const { data, error } = await client.from("ref_projeto").select("id_projeto, nome").eq("ativo", true).order("nome");
  if (error) throw error;
  return (data ?? []).map((p) => ({ id: p.id_projeto, nome: p.nome }));
}
