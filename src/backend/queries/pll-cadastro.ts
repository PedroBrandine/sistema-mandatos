import type { SupabaseClient } from "@supabase/supabase-js";

import type { LinhaCadastroPll } from "../schemas/cadastro-participante-pll";
import type { Database } from "../supabase/database.types";

// Escrita direta em fat_cadastro_participante via `.upsert()` (design.md Tech
// Decisions): N linhas na MESMA tabela, sem invariante multi-tabela -- AD-024
// não se aplica, não é RPC.

export interface ResultadoUpsertCadastroPll {
  inseridos: number;
  atualizados: number;
}

/**
 * Insere/atualiza um lote de linhas já validadas (PLL-CP-01, PLL-CP-03) contra
 * `UNIQUE (id_projeto, email)`: e-mail já existente no projeto atualiza a
 * linha de staging existente, nunca duplica.
 *
 * Reimportação NUNCA limpa `id_contrato`/`id_vinculo_tse` (edge case da
 * spec.md, "reimportação nunca desfaz um vínculo confirmado"): o payload
 * enviado ao PostgREST só contém os 25 campos autodeclarados do Anexo A +
 * `id_produto`/`id_projeto`/`importado_por` -- colunas ausentes do payload
 * não entram no `SET` do `ON CONFLICT DO UPDATE` que o PostgREST gera, então
 * `id_contrato`/`id_vinculo_tse`/os campos editáveis no sistema (desafios,
 * destaques, ambição, SWOT) sobrevivem intactos a qualquer reimportação.
 * Verificado contra o dev real antes de escrever este código (Knowledge
 * Verification Chain Step 1): um UPDATE por conflito preserva colunas
 * omitidas do payload; um `id_projeto` NULL nunca gera conflito (semântica de
 * índice único parcial do Postgres para NULL) -- por isso `idProjeto` é
 * obrigatório aqui, ao contrário da coluna (que é anulável no schema para
 * cobrir produtos futuros sem edição).
 */
export async function upsertCadastroParticipantes(
  client: SupabaseClient<Database>,
  params: {
    idProduto: number;
    idProjeto: number;
    idUsuarioImportador?: number | null;
    linhas: LinhaCadastroPll[];
  }
): Promise<ResultadoUpsertCadastroPll> {
  const { idProduto, idProjeto, idUsuarioImportador, linhas } = params;
  if (linhas.length === 0) return { inseridos: 0, atualizados: 0 };

  const emails = linhas.map((linha) => linha.email);
  const { data: existentes, error: erroExistentes } = await client
    .from("fat_cadastro_participante")
    .select("email")
    .eq("id_projeto", idProjeto)
    .in("email", emails);
  if (erroExistentes) throw erroExistentes;
  const emailsExistentes = new Set((existentes ?? []).map((linha) => linha.email));

  const payload = linhas.map((linha) => ({
    ...linha,
    id_produto: idProduto,
    id_projeto: idProjeto,
    importado_por: idUsuarioImportador ?? null,
  }));

  const { error } = await client
    .from("fat_cadastro_participante")
    .upsert(payload, { onConflict: "id_projeto,email" });
  if (error) throw error;

  const atualizados = linhas.filter((linha) => emailsExistentes.has(linha.email)).length;
  return { inseridos: linhas.length - atualizados, atualizados };
}
