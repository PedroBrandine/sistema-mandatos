import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { mapeiaErroRpc } from "./errors";

// PF-04. Investigação (T3): não existia uma função reutilizável de escrita
// para fat_contrato.status fora de um formulário inteiro -- só o `enviar` de
// ContratoForm (src/frontend/components/fundacao/contrato-form.tsx, modo
// "encerrar") fazia esse UPDATE, direto via PostgREST, sem RPC de banco
// (design.md: "sem RPC, single-table"). Este wrapper extrai esse mesmo
// UPDATE para ser reutilizável pela página de informações gerais (T4), sem
// duplicar a leitura de dt_fim/motivo que só a tela de encerramento precisa.
//
// Espelha ck_contrato_motivo (status <> 'nao_concluido' OR motivo_encerramento
// IS NOT NULL) -- mesma regra e mesma mensagem que contratoSchema.refine já
// usa (src/backend/schemas/contrato.ts), checada aqui antes do round-trip ao
// banco para não depender de mapear 23514 pra um texto amigável.
export async function atualizarStatusContrato(
  client: SupabaseClient<Database>,
  idContrato: number,
  status: "ativo" | "concluido" | "nao_concluido",
  motivoEncerramento?: string | null
): Promise<void> {
  if (status === "nao_concluido" && !motivoEncerramento) {
    throw new Error("motivo_encerramento é obrigatório quando status='nao_concluido'");
  }

  const { error } = await client
    .from("fat_contrato")
    .update({ status, motivo_encerramento: motivoEncerramento ?? null })
    .eq("id_contrato", idContrato);

  if (error) throw mapeiaErroRpc(error);
}
