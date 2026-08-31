import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { mapeiaErroRpc } from "./errors";

// SAI-02. Único ponto de chamada de app.atualiza_numeros_impacto (SECURITY
// DEFINER, T2, AD-035) -- refresh síncrono de mv_numeros_impacto inteira, ao
// abrir a tela que exibe os números de impacto. Sem parâmetro: a função
// recalcula a MV inteira -- não há REFRESH parcial de materialized view no
// Postgres (design.md, "src/backend/rpc/numeros-impacto.ts"), mesmo molde de
// rpc/iip.ts (atualizaIipContrato).
export async function atualizaNumerosImpacto(client: SupabaseClient<Database>): Promise<void> {
  const { error } = await client.schema("app").rpc("atualiza_numeros_impacto");

  if (error) throw mapeiaErroRpc(error);
}
