import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { mapeiaErroRpc } from "./errors";

// INC-04. Único ponto de chamada de app.atualiza_iip_contrato (SECURITY
// DEFINER, T8, AD-035) -- refresh síncrono de mv_iip_contrato inteira, ao
// abrir a tela que exibe o IIP (Assumption #3). Sem parâmetro: a função
// recalcula a MV inteira -- não há REFRESH parcial de materialized view no
// Postgres (design.md, "src/backend/rpc/iip.ts").
export async function atualizaIipContrato(client: SupabaseClient<Database>): Promise<void> {
  const { error } = await client.schema("app").rpc("atualiza_iip_contrato");

  if (error) throw mapeiaErroRpc(error);
}
