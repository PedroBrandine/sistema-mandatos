import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { mapeiaErroRpc } from "./errors";

// Espelha rel_registro_participante -- ck_reg_part_origem/ck_reg_part_identificacao
// (design.md, Data Models; B-01/FMC-37). Sem `presente`: a linha É o fato de
// ter estado (design.md Tech Decisions "rel_registro_participante sem
// presente") -- por isso não reaproveita ParticipanteEncontroInput
// (rpc/encontro.ts), que tem `presente` porque ali a linha existe para todo
// convidado.
export interface ParticipanteRegistroInput {
  idUsuario?: number | null;
  nomeLivre?: string | null;
  origem: "legisla" | "mandato" | "externo";
}

// Espelha fat_artefato -- ck_artefato_tipo/ck_artefato_url (design.md, Data
// Models; FMC-17). Sem id_contrato/escopo/id_referencia: a RPC grava
// escopo='registro' e id_referencia = id do registro recém-criado, dentro da
// mesma transação -- não são recebidos do chamador.
export interface ArtefatoRegistroInput {
  tipo: string;
  url: string;
  descricao?: string | null;
}

export interface CriarRegistroInput {
  idContrato: number;
  idEncontro?: number | null;
  idTipoRegistro: number;
  ocorridoEm: string;
  resumo?: string | null;
  conteudo: Record<string, unknown>;
  artefatos: ArtefatoRegistroInput[];
  presentes: ParticipanteRegistroInput[];
}

// FMC-15, FMC-16, FMC-17, FMC-18, FMC-21 (spec.md P1 Registro; design.md
// tabela de RPCs). Único ponto de chamada de app.criar_registro (SECURITY
// INVOKER, AD-024; T20 -- ainda não aplicada em dev, política de push
// suspensa) -- insere fat_registro + conteudo + fat_artefato +
// rel_registro_participante numa única transação, com nr_sequencia atribuída
// pelo servidor (MAX+1 sob FOR UPDATE, FMC-15 AC3). id_usuario_autor é
// resolvido dentro da função via app.id_usuario(), nunca recebido como
// parâmetro do chamador (AD-006).
export async function criarRegistro(
  client: SupabaseClient<Database>,
  input: CriarRegistroInput
): Promise<{ idRegistro: number }> {
  const { data, error } = await client.schema("app").rpc("criar_registro", {
    p_id_contrato: input.idContrato,
    p_id_encontro: input.idEncontro ?? undefined,
    p_id_tipo_registro: input.idTipoRegistro,
    p_ocorrido_em: input.ocorridoEm,
    p_resumo: input.resumo ?? undefined,
    p_conteudo: input.conteudo,
    p_artefatos: input.artefatos.map((artefato) => ({
      tipo: artefato.tipo,
      url: artefato.url,
      descricao: artefato.descricao ?? null,
    })),
    p_presentes: input.presentes.map((participante) => ({
      id_usuario: participante.idUsuario ?? null,
      nome_livre: participante.nomeLivre ?? null,
      origem: participante.origem,
    })),
  });

  if (error) throw mapeiaErroRpc(error);

  return { idRegistro: data as unknown as number };
}
