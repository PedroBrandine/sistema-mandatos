import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { mapeiaErroRpc } from "./errors";

export interface MarcarPresencaInput {
  idEncontro: number;
}

// EST-13 AC4/AC5 (T29). Único ponto de chamada de app.marcar_presenca
// (SECURITY INVOKER, migration 20260912023810) -- fecha o encontro como
// realizado a partir da Agenda.
//
// A função só levanta 42501 (encontro inexistente ou RLS negou), que
// mapeiaErroRpc já traduz para PermissaoNegadaError; nenhum código novo
// precisou entrar em MENSAGENS_*. Não há erro tipado de "já realizado":
// AC5 define esse caso como silencioso e idempotente, não como falha.
export async function marcarPresenca(
  client: SupabaseClient<Database>,
  input: MarcarPresencaInput
): Promise<void> {
  const { error } = await client.schema("app").rpc("marcar_presenca", {
    p_id_encontro: input.idEncontro,
  });

  if (error) throw mapeiaErroRpc(error);
}
