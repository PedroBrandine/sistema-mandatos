import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { gerarToken, hashToken } from "../lib/convite-token";
import { mapeiaErroRpc } from "./errors";

export interface EmitirConviteInput {
  idContrato: number;
  email: string;
  papelNoContrato: "mentor" | "assessor";
  cargo?: "parlamentar" | "chefe_gabinete" | "assessor" | "secretaria_executiva" | "nao_se_aplica" | null;
  grauResponsabilidade?: string | null;
  areas?: string[] | null;
}

// CVT-01/02. Único ponto de chamada de app.emitir_convite (SECURITY INVOKER,
// T2) -- gera o token e o hash no navegador (Web Crypto, T6) e passa só o
// hash pro RPC; o token em claro nunca viaja além desta função e da URL
// devolvida. Caminho (não a origem) -- o componente (ConviteForm) monta a
// URL completa com `window.location.origin`, que não existe no runtime de
// teste (Node); manter essa leitura fora daqui é o que torna esta função
// testável com client mockado (mesmo padrão de vinculo.ts).
export async function emitirConvite(
  client: SupabaseClient<Database>,
  input: EmitirConviteInput
): Promise<{ caminho: string }> {
  const token = gerarToken();
  const tokenHash = await hashToken(token);

  const { error } = await client.schema("app").rpc("emitir_convite", {
    p_id_contrato: input.idContrato,
    p_email: input.email.trim().toLowerCase(),
    p_papel: input.papelNoContrato,
    // Campos opcionais: DEFAULT NULL no lado do banco (mesmo padrão de
    // app.substituir_vinculo) -- `undefined` faz o supabase-js omitir a
    // chave do payload, não `null` (o gerador de types tipa cada parâmetro
    // como obrigatório e não-nulo sem visibilidade do DEFAULT do Postgres).
    p_cargo: input.cargo ?? undefined,
    p_grau_responsabilidade: input.grauResponsabilidade ?? undefined,
    p_areas: input.areas ?? undefined,
    p_token_hash: tokenHash,
  });

  if (error) throw mapeiaErroRpc(error);

  return { caminho: `/convite/${token}` };
}
