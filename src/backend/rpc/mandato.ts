import type { SupabaseClient } from "@supabase/supabase-js";

import type { ContratanteInput } from "../schemas/contratante";
import type { MandatoInput } from "../schemas/mandato";
import type { Database } from "../supabase/database.types";
import type { MandatoCriado } from "../types/fundacao";
import { mapeiaErroRpc } from "./errors";

// Espelha p_candidatura de app.criar_mandato (rel_mandato_candidatura) --
// presente só quando a Gestora confirma/seleciona uma candidatura do TSE.
// `type` (não `interface`): precisa ser estruturalmente atribuível a `Json`
// (database.types.ts) para o rpc(), e só tipos-literal satisfazem o índice
// implícito que `Json` exige -- uma `interface` sem index signature explícito
// não é aceita pelo compilador aqui.
export type CandidaturaParaConfirmar = {
  ano_eleicao: number;
  sq_candidato: number;
  nr_turno: number;
  metodo_match: "titulo_eleitoral" | "nome_uf_cargo" | "manual";
  confianca: "alta" | "media" | "baixa";
};

export interface CriarMandatoInput {
  contratante: ContratanteInput;
  mandato: MandatoInput;
  candidatura?: CandidaturaParaConfirmar | null;
  ignorarDuplicata?: boolean;
}

interface RetornoCriarMandato {
  id_contratante: number;
  id_mandato: number;
  id_vinculo_tse: number | null;
}

// FND-TSE-01/02/05/06. Único ponto de chamada de app.criar_mandato
// (SECURITY INVOKER, T20) -- mapeia MDU01/23514/23505/42501 conforme a Error
// Handling Strategy do design.md.
export async function criarMandato(
  client: SupabaseClient<Database>,
  input: CriarMandatoInput
): Promise<MandatoCriado> {
  const { data, error } = await client.schema("app").rpc("criar_mandato", {
    p_contratante: input.contratante,
    p_mandato: input.mandato,
    p_candidatura: input.candidatura ?? null,
    p_ignorar_duplicata: input.ignorarDuplicata ?? false,
  });

  if (error) throw mapeiaErroRpc(error);

  const resultado = data as unknown as RetornoCriarMandato;
  return {
    idContratante: resultado.id_contratante,
    idMandato: resultado.id_mandato,
    idVinculoTse: resultado.id_vinculo_tse,
  };
}

// FND-TSE-04. Único ponto de chamada de app.marcar_candidatura_vigente
// (SECURITY INVOKER, T21).
export async function marcarCandidaturaVigente(
  client: SupabaseClient<Database>,
  idVinculoTse: number
): Promise<void> {
  const { error } = await client.schema("app").rpc("marcar_candidatura_vigente", {
    p_id_vinculo_tse: idVinculoTse,
  });

  if (error) throw mapeiaErroRpc(error);
}
