import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { mapeiaErroRpc } from "./errors";

// INC-12, INC-13, INC-14. Único ponto de chamada de app.criar_insight
// (SECURITY INVOKER, T7) -- insere fat_insight + (quando houver origem) até
// 2 colunas em 1 linha de rel_insight_origem numa única transação (AD-024);
// id_usuario_autor é resolvido dentro da função via app.id_usuario(), nunca
// recebido como parâmetro do chamador (design.md, Data Models).
export interface CriarInsightInput {
  idContrato: number;
  conteudo: string;
  desdobramentos?: string | null;
  comprovacaoDados?: string | null;
  ocorridoEm?: string | null;
  idPilar?: number | null;
  idRegistro?: number | null;
  idMetaOrigem?: number | null;
  idSucessoOrigem?: number | null;
}

export async function criarInsight(
  client: SupabaseClient<Database>,
  input: CriarInsightInput
): Promise<{ idInsight: number }> {
  const { data, error } = await client.schema("app").rpc("criar_insight", {
    p_id_contrato: input.idContrato,
    p_conteudo: input.conteudo,
    p_desdobramentos: input.desdobramentos ?? undefined,
    p_comprovacao_dados: input.comprovacaoDados ?? undefined,
    p_ocorrido_em: input.ocorridoEm ?? undefined,
    p_id_pilar: input.idPilar ?? undefined,
    p_id_registro: input.idRegistro ?? undefined,
    p_id_meta_origem: input.idMetaOrigem ?? undefined,
    p_id_sucesso_origem: input.idSucessoOrigem ?? undefined,
  });

  if (error) throw mapeiaErroRpc(error);

  return { idInsight: data as unknown as number };
}
