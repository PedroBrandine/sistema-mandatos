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

// PF2-08 (T8): escrita single-table de rel_coalizao_membro pro dialog de
// edição de "Projetos e Coalizões Vinculados" (card-projetos-coalizoes.tsx).
// Mesmo padrão de adicionarMembro em coalizoes/[id]/page.tsx:126-142, mas só
// papel='membro' (o card não gerencia secretaria_executiva/grupo_trabalho) --
// respeita uq_coalizao_membro (id_coalizao, id_contrato, papel) e
// ck_membro_papel.
export async function adicionarMembroCoalizao(
  client: SupabaseClient<Database>,
  idCoalizao: number,
  idContrato: number
): Promise<void> {
  const { error } = await client
    .from("rel_coalizao_membro")
    .insert({ id_coalizao: idCoalizao, id_contrato: idContrato, papel: "membro" });

  if (error) throw mapeiaErroRpc(error);
}

// PF2-08 (T8): soft-exit -- grava dt_saida = CURRENT_DATE, nunca DELETE
// (mesmo padrão de encerrarMembro em coalizoes/[id]/page.tsx:144-158). Filtra
// por papel='membro' também, pra não encerrar por engano uma linha de
// secretaria_executiva/grupo_trabalho do mesmo par coalizão/contrato.
export async function removerMembroCoalizao(
  client: SupabaseClient<Database>,
  idCoalizao: number,
  idContrato: number
): Promise<void> {
  const { error } = await client
    .from("rel_coalizao_membro")
    .update({ dt_saida: new Date().toISOString().slice(0, 10) })
    .eq("id_coalizao", idCoalizao)
    .eq("id_contrato", idContrato)
    .eq("papel", "membro");

  if (error) throw mapeiaErroRpc(error);
}
