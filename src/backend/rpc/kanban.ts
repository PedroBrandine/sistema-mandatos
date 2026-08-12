import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { mapeiaErroRpc } from "./errors";

export interface MoverEtapaKanbanInput {
  idContrato: number;
  idEtapaDestino: number;
}

// KAN-04, KAN-07, KAN-09. Único ponto de chamada de app.mover_etapa_kanban
// (SECURITY INVOKER, T3) -- avança ou retrocede a etapa do contrato numa
// única transação. Mapeia KAN01/42501 conforme a Error Handling Strategy do
// design.md; 23514/23505/MDU01 não se aplicam aqui (esta função não tem
// checagem de constraint de campo nem de duplicata de contratante).
export async function moverEtapaKanban(
  client: SupabaseClient<Database>,
  input: MoverEtapaKanbanInput
): Promise<void> {
  const { error } = await client.schema("app").rpc("mover_etapa_kanban", {
    p_id_contrato: input.idContrato,
    p_id_etapa_destino: input.idEtapaDestino,
  });

  if (error) throw mapeiaErroRpc(error);
}
