import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { mapeiaErroRpc } from "./errors";

export interface MarcarPresencaInput {
  idEncontro: number;
}

// Espelha rel_encontro_participante -- ck_participante_origem/ck_participante_identificacao
// (docs/schema_sistema.sql:907-910). Sem id_encontro: o encontro ainda não existe no
// momento da chamada, é criado na mesma transação (design.md, Data Models).
export interface ParticipanteEncontroInput {
  idUsuario?: number | null;
  nomeLivre?: string | null;
  origem: "legisla" | "mandato" | "externo";
}

export interface CriarEncontroInput {
  idContrato: number;
  titulo: string;
  idEtapa: number;
  idTipoRegistro: number;
  dtInicio: string;
  dtFim?: string | null;
  modalidade?: "presencial" | "online" | null;
  local?: string | null;
  tema?: string | null;
  participantes: ParticipanteEncontroInput[];
}

// FMC-30 (spec.md P2 Agenda AC2/AC3; design.md tabela de RPCs). Único ponto de
// chamada de app.criar_encontro (SECURITY INVOKER, AD-024; T18 -- ainda não
// aplicada em dev, política de push suspensa) -- insere fat_encontro + N linhas
// de rel_encontro_participante numa única transação. A assinatura é a que
// design.md já fechou: (p_id_contrato, p_titulo, p_id_etapa, p_id_tipo_registro,
// p_dt_inicio, p_dt_fim, p_modalidade, p_local, p_tema, p_participantes JSONB).
// id_usuario_autor (quando existir) é resolvido dentro da função via
// app.id_usuario(), nunca recebido como parâmetro do chamador (AD-006).
export async function criarEncontro(
  client: SupabaseClient<Database>,
  input: CriarEncontroInput
): Promise<{ idEncontro: number }> {
  const { data, error } = await client.schema("app").rpc("criar_encontro", {
    p_id_contrato: input.idContrato,
    p_titulo: input.titulo,
    p_id_etapa: input.idEtapa,
    p_id_tipo_registro: input.idTipoRegistro,
    p_dt_inicio: input.dtInicio,
    p_dt_fim: input.dtFim ?? undefined,
    p_modalidade: input.modalidade ?? undefined,
    p_local: input.local ?? undefined,
    p_tema: input.tema ?? undefined,
    p_participantes: input.participantes.map((participante) => ({
      id_usuario: participante.idUsuario ?? null,
      nome_livre: participante.nomeLivre ?? null,
      origem: participante.origem,
    })),
  });

  if (error) throw mapeiaErroRpc(error);

  return { idEncontro: data as unknown as number };
}

// EST-13 AC4/AC5 (T29). Único ponto de chamada de app.marcar_presenca
// (SECURITY INVOKER, migration 20260912023810) -- fecha o encontro como
// realizado a partir da Agenda.
//
// A função só levanta 42501 (encontro inexistente ou RLS negou), que
// mapeiaErroRpc já traduz para PermissaoNegadaError; nenhum código novo
// precisou entrar em MENSAGENS_*. Não há erro tipado de "já realizado":
// AC5 define esse caso como silencioso e idempotente, não como falha.
export async function marcarPresenca(
  client: SupabaseClient<Database>,
  input: MarcarPresencaInput
): Promise<void> {
  const { error } = await client.schema("app").rpc("marcar_presenca", {
    p_id_encontro: input.idEncontro,
  });

  if (error) throw mapeiaErroRpc(error);
}
