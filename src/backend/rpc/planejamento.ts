import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { mapeiaErroRpc } from "./errors";

// PLM-07: chama a cascata já aprovada (app.recalcula_atingimento, verbatim
// docs/schema_sistema.sql:1476-1512) síncrono, ao abrir a tela do
// planejamento (design.md "Tech Decisions" -- não pg_cron, sem infra no
// projeto).
export async function recalcularAtingimento(client: SupabaseClient<Database>, idPlanejamento: number): Promise<void> {
  const { error } = await client.schema("app").rpc("recalcula_atingimento", {
    p_id_planejamento: idPlanejamento,
  });
  if (error) throw mapeiaErroRpc(error);
}

export interface AtualizacaoSucessoMensal {
  idSucesso: number;
  pctAtingimento: number;
}

export interface PreditorPrioritario {
  idPreditor: number;
  ordem: number;
}

// PLM-16: substitui o conjunto inteiro de preditores prioritários (até 3) num
// único DELETE+INSERT atômico (app.substitui_preditores_planejamento, T18) --
// AD-024, escrita que cruza mais de uma linha.
export async function substituirPreditoresPlanejamento(
  client: SupabaseClient<Database>,
  idPlanejamento: number,
  preditores: PreditorPrioritario[]
): Promise<void> {
  const { error } = await client.schema("app").rpc("substitui_preditores_planejamento", {
    p_id_planejamento: idPlanejamento,
    p_preditores: preditores.map((p) => ({ id_preditor: p.idPreditor, ordem: p.ordem })),
  });
  if (error) throw mapeiaErroRpc(error);
}

// PLM-03: escreve uma faixa colada de pct_atingimento num único UPDATE
// atômico (app.atualiza_sucessos_mensais_lote, T6) -- nunca N chamadas
// soltas, que deixariam estado parcial se uma falhar no meio (AD-024).
export async function atualizarSucessosEmLote(
  client: SupabaseClient<Database>,
  valores: AtualizacaoSucessoMensal[]
): Promise<void> {
  const { error } = await client.schema("app").rpc("atualiza_sucessos_mensais_lote", {
    p_valores: valores.map((v) => ({ id_sucesso: v.idSucesso, pct_atingimento: v.pctAtingimento })),
  });
  if (error) throw mapeiaErroRpc(error);
}

// PLV-06. Cria N Sucessos Mensais irmãos num único INSERT atômico
// (app.cria_sucessos_mensais_lote) -- AD-024, escrita que cruza mais de uma
// linha. Nunca N chamadas soltas: falha no meio deixaria o lote pela metade, e
// N chamadas disparariam N cascatas em vez de uma (AC6).
//
// Os irmãos nascem independentes: não existe vínculo de irmandade gravado, e
// editar um depois não toca nos outros.
export interface BaseSucessoMensalLote {
  descricao: string;
  peso: number;
  status: "pendente" | "realizado" | "nao_realizado";
  dtLimite?: string | null;
  pctAtingimento?: number | null;
  idUsuarioResponsavel?: number | null;
}

export async function criarSucessosEmLote(
  client: SupabaseClient<Database>,
  idMeta: number,
  base: BaseSucessoMensalLote,
  meses: string[]
): Promise<void> {
  const { error } = await client.schema("app").rpc("cria_sucessos_mensais_lote", {
    p_id_meta: idMeta,
    p_base: {
      descricao: base.descricao,
      peso: base.peso,
      status: base.status,
      dt_limite: base.dtLimite ?? null,
      pct_atingimento: base.pctAtingimento ?? null,
      id_usuario_responsavel: base.idUsuarioResponsavel ?? null,
    },
    p_meses: meses,
  });
  if (error) throw mapeiaErroRpc(error);
}

// PLV-09. Move uma Meta entre Objetivos ou um Sucesso Mensal entre Metas
// (app.move_item_hierarquia). É RPC e não UPDATE direto porque o invariante
// cruza mais de uma tabela (AD-024): além de trocar a FK, precisa marcar
// origem E destino como desatualizados e recusar destino de outro contrato.
export type TipoItemHierarquia = "meta" | "sucesso";

export async function moverItemHierarquia(
  client: SupabaseClient<Database>,
  tipo: TipoItemHierarquia,
  id: number,
  novoPai: number
): Promise<void> {
  const { error } = await client.schema("app").rpc("move_item_hierarquia", {
    p_tipo: tipo,
    p_id: id,
    p_novo_pai: novoPai,
  });
  if (error) throw mapeiaErroRpc(error);
}
