import type { SupabaseClient } from "@supabase/supabase-js";

import type { CoalizaoInput } from "../schemas/coalizao";
import type { ContratanteInput } from "../schemas/contratante";
import type { Database } from "../supabase/database.types";
import type { CoalizaoCriada } from "../types/fundacao";
import { mapeiaErroRpc } from "./errors";

export interface CriarCoalizaoInput {
  contratante: ContratanteInput;
  coalizao: CoalizaoInput;
  ignorarDuplicata?: boolean;
}

interface RetornoCriarCoalizao {
  id_contratante: number;
  id_coalizao: number;
}

// FND-COL-01. Único ponto de chamada de app.criar_coalizao (SECURITY
// INVOKER, T22) -- mesma checagem de duplicata de criarMandato, mesmo
// mapeamento de erro (MDU01/23514/23505/42501, design.md).
export async function criarCoalizao(
  client: SupabaseClient<Database>,
  input: CriarCoalizaoInput
): Promise<CoalizaoCriada> {
  const { data, error } = await client.schema("app").rpc("criar_coalizao", {
    p_contratante: input.contratante,
    p_coalizao: input.coalizao,
    p_ignorar_duplicata: input.ignorarDuplicata ?? false,
  });

  if (error) throw mapeiaErroRpc(error);

  const resultado = data as unknown as RetornoCriarCoalizao;
  return { idContratante: resultado.id_contratante, idCoalizao: resultado.id_coalizao };
}
