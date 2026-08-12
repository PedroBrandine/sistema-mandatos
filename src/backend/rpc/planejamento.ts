import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { mapeiaErroRpc } from "./errors";

// PLM-07: chama a cascata já aprovada (app.recalcula_atingimento, verbatim
// docs/schema_sistema.sql:1476-1512) síncrono, ao abrir a tela do
// planejamento (design.md "Tech Decisions" -- não pg_cron, sem infra no
// projeto).
export async function recalcularAtingimento(client: SupabaseClient<Database>, idPlanejamento: number): Promise<void> {
  const { error } = await client.schema("app").rpc("recalcula_atingimento", {
    p_id_planejamento: idPlanejamento,
  });
  if (error) throw mapeiaErroRpc(error);
}

export interface AtualizacaoSucessoMensal {
  idSucesso: number;
  pctAtingimento: number;
}

// PLM-03: escreve uma faixa colada de pct_atingimento num único UPDATE
// atômico (app.atualiza_sucessos_mensais_lote, T6) -- nunca N chamadas
// soltas, que deixariam estado parcial se uma falhar no meio (AD-024).
export async function atualizarSucessosEmLote(
  client: SupabaseClient<Database>,
  valores: AtualizacaoSucessoMensal[]
): Promise<void> {
  const { error } = await client.schema("app").rpc("atualiza_sucessos_mensais_lote", {
    p_valores: valores.map((v) => ({ id_sucesso: v.idSucesso, pct_atingimento: v.pctAtingimento })),
  });
  if (error) throw mapeiaErroRpc(error);
}
