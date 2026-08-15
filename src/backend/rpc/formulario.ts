import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { mapeiaErroRpc } from "./errors";

// FRM-21. Único ponto de chamada de app.atualiza_avaliacao_nps (SECURITY
// DEFINER, T11, AD-035) -- refresh síncrono de mv_avaliacao_nps inteira, sob
// demanda (spec.md P3 AC2, sem pg_cron provisionado). Sem parâmetro: a
// função recalcula a MV inteira -- não há REFRESH parcial de materialized
// view no Postgres (mesmo padrão de rpc/iip.ts, design.md
// "src/backend/rpc/formulario.ts").
export async function atualizarAvaliacaoNps(client: SupabaseClient<Database>): Promise<void> {
  const { error } = await client.schema("app").rpc("atualiza_avaliacao_nps");

  if (error) throw mapeiaErroRpc(error);
}
