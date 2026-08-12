import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

// CVT-09/10. Leitura de estado do convite (single-table read, sem RPC --
// AD-024 é só pra escrita) pro Server Component pré-sessão
// (/convite/[token]/page.tsx). Sempre chamada com o cliente admin
// (service_role) -- pré-sessão não tem app.id_usuario, então a RLS de
// convite_contrato (p_por_contrato) bloquearia qualquer outro cliente.
export type EstadoConvite =
  | {
      estado: "valido";
      idContrato: number;
      papelNoContrato: string;
      cargo: string | null;
    }
  | { estado: "invalido" | "expirado" | "usado" };

export async function validarConvite(client: SupabaseClient<Database>, tokenHash: string): Promise<EstadoConvite> {
  const { data, error } = await client
    .from("convite_contrato")
    .select("id_contrato, papel_no_contrato, cargo, dt_expiracao, dt_uso")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { estado: "invalido" };
  if (data.dt_uso) return { estado: "usado" };
  if (new Date(data.dt_expiracao) < new Date()) return { estado: "expirado" };

  return {
    estado: "valido",
    idContrato: data.id_contrato,
    papelNoContrato: data.papel_no_contrato,
    cargo: data.cargo,
  };
}

// CVT-10. Repassa o booleano de app.checar_rate_limit_convite (T4) -- só
// chamada com o cliente admin (EXECUTE travado a service_role).
export async function checarRateLimitConvite(client: SupabaseClient<Database>, ip: string): Promise<boolean> {
  const { data, error } = await client.schema("app").rpc("checar_rate_limit_convite", { p_ip: ip });
  if (error) throw error;
  return data as boolean;
}
