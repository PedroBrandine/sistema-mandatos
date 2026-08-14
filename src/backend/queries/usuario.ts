import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

export type PapelGlobal = "admin" | "gestora" | "mentor" | "assessor";

interface RowDimUsuarioPapel {
  papel_global: string;
}

// Versão server-safe de src/frontend/hooks/use-papel-global.ts:22-53 (mesmo
// shape de query -- auth.getUser() -> email -> dim_usuario.papel_global) --
// usada pelo gate de papel de page.tsx (visao-gerencial-g3-g6, T19), que
// roda em Server Component, onde o hook (client-only, "use client") não
// pode ser chamado.
export async function buscarPapelGlobalAtual(
  client: SupabaseClient<Database>
): Promise<PapelGlobal | null> {
  const { data: auth } = await client.auth.getUser();
  const email = auth.user?.email ?? null;
  if (!email) return null;

  const { data: usuario, error } = await client
    .from("dim_usuario")
    .select("papel_global")
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;

  const row = usuario as RowDimUsuarioPapel | null;
  return (row?.papel_global as PapelGlobal | undefined) ?? null;
}
