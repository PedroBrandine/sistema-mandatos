import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { mapeiaErroRpc } from "./errors";

// INC-01, INC-02, FGC-06/FGC-09/FGC-15 (T9). Único ponto de chamada de
// app.criar_fato_gerador (SECURITY INVOKER, T6) -- insere fat_fato_gerador +
// (quando houver origem) 1 linha em rel_fato_origem numa única transação
// (AD-024); id_usuario_autor é resolvido dentro da função via
// app.id_usuario(), nunca recebido como parâmetro do chamador (design.md,
// Data Models). titulo/situacao/dtPrevista/idPreInsightOrigem/
// idRegistroOrigem são os 5 parâmetros novos de T6.
export interface CriarFatoGeradorInput {
  idContrato: number;
  idTipologia: number;
  titulo?: string | null;
  situacao?: "projetado" | "realizado" | null;
  nivelD1?: string | null;
  nivelD2?: string | null;
  nivelD3?: string | null;
  idPreditor1?: number | null;
  idPreditor2?: number | null;
  contribuicaoLegisla?: number | null;
  descricaoEvidencia?: string | null;
  dtOcorrencia?: string | null;
  dtPrevista?: string | null;
  idMetaOrigem?: number | null;
  idInsightOrigem?: number | null;
  idPreInsightOrigem?: number | null;
  idRegistroOrigem?: number | null;
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
    p_titulo: input.titulo ?? undefined,
    p_situacao: input.situacao ?? undefined,
    p_dt_prevista: input.dtPrevista ?? undefined,
    p_id_pre_insight_origem: input.idPreInsightOrigem ?? undefined,
    p_id_registro_origem: input.idRegistroOrigem ?? undefined,
  });

  if (error) throw mapeiaErroRpc(error);

  return { idFatoGerador: data as unknown as number };
}

// T10 (fatos-geradores-ciclo-vida), FGC-08. Transição projetado -> realizado
// -- UPDATE direto (sem RPC nova): RLS p_por_contrato de fat_fato_gerador já
// cobre UPDATE por ser `FOR ALL` (20260813192341_incidencia_encontros_rls.sql:31-38),
// mesma classe de escrita direta de registro-form.tsx.
export async function marcarFatoRealizado(
  client: SupabaseClient<Database>,
  idFatoGerador: number,
  dtOcorrencia: string
): Promise<void> {
  const { error } = await client
    .from("fat_fato_gerador")
    .update({ situacao: "realizado", dt_ocorrencia: dtOcorrencia })
    .eq("id_fato_gerador", idFatoGerador);

  if (error) throw mapeiaErroRpc(error);
}
