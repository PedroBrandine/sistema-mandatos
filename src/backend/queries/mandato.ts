import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";

export interface MandatoExistenteResumo {
  idContratante: number;
  idMandato: number;
  nmUrna: string | null;
  nomeContratante: string | null;
}

export async function buscarMandatoExistentePorTitulo(
  client: SupabaseClient<Database>,
  nrTituloEleitoral: string
): Promise<MandatoExistenteResumo | null> {
  const { data, error } = await client
    .from("dim_mandato")
    .select("id_contratante, id_mandato, nm_urna, dim_contratante (nome)")
    .eq("nr_titulo_eleitoral", nrTituloEleitoral)
    .maybeSingle();

  if (error || !data) return null;

  return {
    idContratante: data.id_contratante,
    idMandato: data.id_mandato,
    nmUrna: data.nm_urna,
    nomeContratante: (data.dim_contratante as any)?.nome ?? null,
  };
}
