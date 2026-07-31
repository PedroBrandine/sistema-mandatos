import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { mapeiaErroRpc } from "./errors";

export interface SubstituirVinculoInput {
  idVinculoAntigo: number;
  idUsuarioNovo: number;
  cargo?: "parlamentar" | "chefe_gabinete" | "assessor" | "secretaria_executiva" | "nao_se_aplica" | null;
  grauResponsabilidade?: string | null;
  areas?: string[] | null;
}

// FND-USR-05. Único ponto de chamada de app.substituir_vinculo (SECURITY
// INVOKER, T23) -- fecha o vínculo antigo e cria o novo na mesma transação;
// retorna o id_vinculo da linha nova. Mapeia 23514/23505/42501 conforme a
// Error Handling Strategy do design.md; MDU01 não se aplica aqui (não há
// checagem de duplicata de contratante nesta função).
export async function substituirVinculo(
  client: SupabaseClient<Database>,
  input: SubstituirVinculoInput
): Promise<number> {
  const { data, error } = await client.schema("app").rpc("substituir_vinculo", {
    p_id_vinculo_antigo: input.idVinculoAntigo,
    p_id_usuario_novo: input.idUsuarioNovo,
    p_cargo: input.cargo ?? undefined,
    p_grau_responsabilidade: input.grauResponsabilidade ?? undefined,
    p_areas: input.areas ?? undefined,
  });

  if (error) throw mapeiaErroRpc(error);

  return data as unknown as number;
}
