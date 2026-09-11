import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { mapeiaErroRpc } from "./errors";

export interface ConverterProspeccaoInput {
  idProspeccao: number;
  /** Data de início do contrato gerado, no formato ISO `YYYY-MM-DD`. */
  dtInicio: string;
}

// EST-04 AC3/AC4. Único ponto de chamada de app.converter_prospeccao
// (SECURITY INVOKER, T7) -- cria o fat_contrato e marca a prospecção como
// convertida numa única transação. Devolve o id do contrato gerado.
//
// Mapeia os dois erros tipados da T7 conforme a Error Handling Strategy do
// design.md: PRO01 (prospecção já encerrada, "Toast explicando que já virou
// contrato") e 42501 (RLS negou / prospecção inexistente). Os demais códigos
// de mapeiaErroRpc não são alcançáveis por esta função.
export async function converterProspeccao(
  client: SupabaseClient<Database>,
  input: ConverterProspeccaoInput
): Promise<number> {
  const { data, error } = await client.schema("app").rpc("converter_prospeccao", {
    p_id_prospeccao: input.idProspeccao,
    p_dt_inicio: input.dtInicio,
  });

  if (error) throw mapeiaErroRpc(error);

  return data as number;
}
