import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { mapeiaErroRpc } from "./errors";

// INC-01, INC-02. Único ponto de chamada de app.criar_fato_gerador (SECURITY
// INVOKER, T6) -- insere fat_fato_gerador + (quando houver origem) 1 linha em
// rel_fato_origem numa única transação (AD-024); id_usuario_autor é resolvido
// dentro da função via app.id_usuario(), nunca recebido como parâmetro do
// chamador (design.md, Data Models).
export interface CriarFatoGeradorInput {
  idContrato: number;
  idTipologia: number;
  nivelD1?: string | null;
  nivelD2?: string | null;
  nivelD3?: string | null;
  idPreditor1?: number | null;
  idPreditor2?: number | null;
  contribuicaoLegisla?: number | null;
  descricaoEvidencia?: string | null;
  dtOcorrencia?: string | null;
  idMetaOrigem?: number | null;
  idInsightOrigem?: number | null;
}

export async function criarFatoGerador(
  client: SupabaseClient<Database>,
  input: CriarFatoGeradorInput
): Promise<{ idFatoGerador: number }> {
  const { data, error } = await client.schema("app").rpc("criar_fato_gerador", {
    p_id_contrato: input.idContrato,
    p_id_tipologia: input.idTipologia,
    p_nivel_d1: input.nivelD1 ?? undefined,
    p_nivel_d2: input.nivelD2 ?? undefined,
    p_nivel_d3: input.nivelD3 ?? undefined,
    p_id_preditor_1: input.idPreditor1 ?? undefined,
    p_id_preditor_2: input.idPreditor2 ?? undefined,
    p_contribuicao_legisla: input.contribuicaoLegisla ?? undefined,
    p_descricao_evidencia: input.descricaoEvidencia ?? undefined,
    p_dt_ocorrencia: input.dtOcorrencia ?? undefined,
    p_id_meta_origem: input.idMetaOrigem ?? undefined,
    p_id_insight_origem: input.idInsightOrigem ?? undefined,
  });

  if (error) throw mapeiaErroRpc(error);

  return { idFatoGerador: data as unknown as number };
}
