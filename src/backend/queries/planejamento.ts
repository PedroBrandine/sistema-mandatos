import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

// Formas de leitura (view-models client-side), padrão de etapa-contrato.ts/
// kanban.ts: snake_case do banco -> camelCase, várias queries encadeadas
// compostas em memória (nenhum embed do PostgREST).

export interface MetaResumo {
  idMeta: number;
  idObjetivo: number;
  descricao: string;
  classe: "programatica" | "governanca" | null;
  prioridade: "alta" | "media" | "baixa" | null;
  status: "ativa" | "pausada" | "descartada";
  pctAtingimento: number | null;
  idPreditorPrimario: number | null;
  idPreditorSecundario: number | null;
  idAgenda: number | null;
  idUsuarioResponsavel: number | null;
}

export interface ObjetivoComMetas {
  idObjetivo: number;
  idPlanejamento: number;
  descricao: string;
  idPreditorPrimario: number | null;
  idPreditorSecundario: number | null;
  idAgenda: number | null;
  oportunidade: string | null;
  ameaca: string | null;
  pctAtingimento: number | null;
  metas: MetaResumo[];
}

export interface PlanejamentoCompleto {
  idPlanejamento: number;
  idContrato: number;
  objetivoAno: string | null;
  legado: string | null;
  analiseConjuntura: string | null;
  idPerfilAtuacao: number | null;
  pctAtingimento: number | null;
  atingimentoDesatualizado: boolean;
  objetivos: ObjetivoComMetas[];
}

export interface SucessoMensalGrade {
  idSucesso: number;
  idMeta: number;
  descricao: string;
  mesReferencia: string;
  dtLimite: string | null;
  peso: number;
  pctAtingimento: number | null;
  status: "pendente" | "realizado" | "nao_realizado";
  diasAtraso: number;
  estaAtrasado: boolean;
}

// PLM-01 (leitura). Busca dim_planejamento + a hierarquia Objetivo->Meta de um
// contrato, em 3 round-trips encadeados (mesmo padrão de buscarBoardKanban).
// Retorna null quando o contrato ainda não tem planejamento instanciado
// (nunca deveria acontecer pós operacao-regua-instanciacao, mas a leitura
// não assume).
export async function buscarPlanejamentoCompleto(
  client: SupabaseClient<Database>,
  idContrato: number
): Promise<PlanejamentoCompleto | null> {
  const { data: planejamento, error: erroPlanejamento } = await client
    .from("dim_planejamento")
    .select(
      "id_planejamento, id_contrato, objetivo_ano, legado, analise_conjuntura, id_perfil_atuacao, pct_atingimento, atingimento_desatualizado"
    )
    .eq("id_contrato", idContrato)
    .maybeSingle();
  if (erroPlanejamento) throw erroPlanejamento;
  if (!planejamento) return null;

  const { data: objetivosData, error: erroObjetivos } = await client
    .from("fat_objetivo_especifico")
    .select(
      "id_objetivo, id_planejamento, descricao, id_preditor_primario, id_preditor_secundario, id_agenda, oportunidade, ameaca, pct_atingimento"
    )
    .eq("id_planejamento", planejamento.id_planejamento)
    .order("ordem", { ascending: true });
  if (erroObjetivos) throw erroObjetivos;
  const objetivos = objetivosData ?? [];

  const idsObjetivo = objetivos.map((o) => o.id_objetivo);
  let metasPorObjetivo = new Map<number, MetaResumo[]>();
  if (idsObjetivo.length > 0) {
    const { data: metasData, error: erroMetas } = await client
      .from("fat_meta")
      .select(
        "id_meta, id_objetivo, descricao, classe, prioridade, status, pct_atingimento, id_preditor_primario, id_preditor_secundario, id_agenda, id_usuario_responsavel"
      )
      .in("id_objetivo", idsObjetivo)
      .order("ordem", { ascending: true });
    if (erroMetas) throw erroMetas;

    metasPorObjetivo = new Map();
    for (const m of metasData ?? []) {
      const lista = metasPorObjetivo.get(m.id_objetivo) ?? [];
      lista.push({
        idMeta: m.id_meta,
        idObjetivo: m.id_objetivo,
        descricao: m.descricao,
        classe: m.classe as "programatica" | "governanca" | null,
        prioridade: m.prioridade as "alta" | "media" | "baixa" | null,
        status: m.status as "ativa" | "pausada" | "descartada",
        pctAtingimento: m.pct_atingimento,
        idPreditorPrimario: m.id_preditor_primario,
        idPreditorSecundario: m.id_preditor_secundario,
        idAgenda: m.id_agenda,
        idUsuarioResponsavel: m.id_usuario_responsavel,
      });
      metasPorObjetivo.set(m.id_objetivo, lista);
    }
  }

  return {
    idPlanejamento: planejamento.id_planejamento,
    idContrato: planejamento.id_contrato,
    objetivoAno: planejamento.objetivo_ano,
    legado: planejamento.legado,
    analiseConjuntura: planejamento.analise_conjuntura,
    idPerfilAtuacao: planejamento.id_perfil_atuacao,
    pctAtingimento: planejamento.pct_atingimento,
    atingimentoDesatualizado: planejamento.atingimento_desatualizado,
    objetivos: objetivos.map((o) => ({
      idObjetivo: o.id_objetivo,
      idPlanejamento: o.id_planejamento,
      descricao: o.descricao,
      idPreditorPrimario: o.id_preditor_primario,
      idPreditorSecundario: o.id_preditor_secundario,
      idAgenda: o.id_agenda,
      oportunidade: o.oportunidade,
      ameaca: o.ameaca,
      pctAtingimento: o.pct_atingimento,
      metas: metasPorObjetivo.get(o.id_objetivo) ?? [],
    })),
  };
}

// PLM-01 (grade). Sucessos Mensais das Metas informadas -- idsMeta vem da hierarquia já
// carregada por buscarPlanejamentoCompleto (evita repetir o join até dim_planejamento).
// TODO(D-C) (.specs/features/planejamento-estrategico-redesenho/context.md): default
// adotado nesta feature é mostrar todos os Sucessos Mensais do ciclo, não só o mês de
// referência corrente -- Pedro pode reverter para "só mês corrente" a qualquer momento
// (é filtro de query, sem custo de migration). `_mesReferencia` fica como parâmetro
// opcional e não usado no filtro só para os consumidores existentes (page.tsx,
// planejamento-agregado-coalizao.tsx, ainda não migrados -- Fase 2/T10 desta feature)
// continuarem compilando com a chamada de 3 argumentos até serem atualizados.
export async function buscarGradeSucessosMensais(
  client: SupabaseClient<Database>,
  idsMeta: number[],
  _mesReferencia?: string
): Promise<SucessoMensalGrade[]> {
  if (idsMeta.length === 0) return [];

  const { data, error } = await client
    .from("vw_sucesso_mensal")
    .select("id_sucesso, id_meta, descricao, mes_referencia, dt_limite, peso, pct_atingimento, status, dias_atraso, esta_atrasado")
    .in("id_meta", idsMeta)
    .order("id_meta", { ascending: true })
    .order("mes_referencia", { ascending: true })
    .order("id_sucesso", { ascending: true });
  if (error) throw error;
  if (!data) return [];

  return data.map((linha) => ({
    idSucesso: linha.id_sucesso as number,
    idMeta: linha.id_meta as number,
    descricao: linha.descricao as string,
    mesReferencia: linha.mes_referencia as string,
    dtLimite: linha.dt_limite,
    peso: linha.peso as number,
    pctAtingimento: linha.pct_atingimento,
    status: linha.status as "pendente" | "realizado" | "nao_realizado",
    diasAtraso: linha.dias_atraso ?? 0,
    estaAtrasado: linha.esta_atrasado ?? false,
  }));
}

export interface CoalizaoInfo {
  idCoalizao: number;
  possuiPlanejamentoProprio: boolean;
}

// Edge Case do spec.md ("Coalizão sem planejamento próprio"). Só chamar
// quando ContratoParaFicha.tipoContratante === 'coalizao' (buscarContratoParaFicha,
// contrato.ts) -- decide se a página mostra a hierarquia real ou a leitura
// agregada dos membros.
export async function buscarCoalizaoInfo(
  client: SupabaseClient<Database>,
  idContratante: number
): Promise<CoalizaoInfo | null> {
  const { data, error } = await client
    .from("dim_coalizao")
    .select("id_coalizao, possui_planejamento_proprio")
    .eq("id_contratante", idContratante)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { idCoalizao: data.id_coalizao, possuiPlanejamentoProprio: data.possui_planejamento_proprio };
}

export interface ContratoMembro {
  idContrato: number;
  nomeContratante: string;
}

// Membros ativos (dt_saida IS NULL) de uma Coalizão sem planejamento próprio
// -- cada um tem seu próprio dim_planejamento (mandato de verdade), a
// leitura agregada mostra a planilha de cada um sem agregação nova (context.md).
export async function buscarContratosMembros(
  client: SupabaseClient<Database>,
  idCoalizao: number
): Promise<ContratoMembro[]> {
  const { data: membros, error } = await client
    .from("rel_coalizao_membro")
    .select("id_contrato")
    .eq("id_coalizao", idCoalizao)
    .is("dt_saida", null);
  if (error) throw error;
  if (!membros || membros.length === 0) return [];

  const idsContrato = membros.map((m) => m.id_contrato);
  const { data: contratos, error: erroContratos } = await client
    .from("fat_contrato")
    .select("id_contrato, id_contratante")
    .in("id_contrato", idsContrato);
  if (erroContratos) throw erroContratos;

  const idsContratante = (contratos ?? []).map((c) => c.id_contratante);
  const { data: contratantes, error: erroContratantes } = await client
    .from("dim_contratante")
    .select("id_contratante, nome")
    .in("id_contratante", idsContratante);
  if (erroContratantes) throw erroContratantes;
  const nomesPorId = new Map((contratantes ?? []).map((c) => [c.id_contratante, c.nome]));

  return (contratos ?? []).map((c) => ({
    idContrato: c.id_contrato,
    nomeContratante: nomesPorId.get(c.id_contratante) ?? "",
  }));
}

export interface PreditorPrioritarioLinha {
  idPreditor: number;
  ordem: number;
  // PLR-05 (.specs/features/planejamento-estrategico-redesenho): ContextoEstrategico
  // exibe os preditores prioritários pelo nome, não pelo id -- embed join em
  // ref_preditor(nome), mesmo padrão já usado em queries/contrato.ts.
  nomePreditor: string;
}

// PLM-16. Até 3 preditores prioritários do planejamento, ordenados.
export async function buscarPreditoresPlanejamento(
  client: SupabaseClient<Database>,
  idPlanejamento: number
): Promise<PreditorPrioritarioLinha[]> {
  const { data, error } = await client
    .from("rel_planejamento_preditor")
    .select("id_preditor, ordem, ref_preditor(nome)")
    .eq("id_planejamento", idPlanejamento)
    .order("ordem", { ascending: true });
  if (error) throw error;
  if (!data) return [];
  return data.map((linha) => ({
    idPreditor: linha.id_preditor,
    ordem: linha.ordem,
    nomePreditor: linha.ref_preditor?.nome ?? "",
  }));
}

export interface HistoricoAuditoria {
  idLog: number;
  quem: string;
  quando: string;
  acao: "insert" | "update" | "delete";
  valorAnterior: Record<string, unknown> | null;
  valorNovo: Record<string, unknown> | null;
}

// PLR-13. Histórico de auditoria de um item da árvore (Objetivo/Meta/Sucesso Mensal) --
// log_auditoria já existe e já está conectado às 5 tabelas do planejamento
// (app.trg_auditoria, docs/schema_sistema.sql:1690-1710); esta é a primeira leitura de UI
// dela. Nenhuma tabela/RLS nova -- log_auditoria e a RLS que já a protege
// (p_log_admin, docs/schema_sistema.sql:1627) existem desde a Fundação.
//
// Nota (nomenclatura confirmada contra o schema real antes de escrever, T3 pede
// explicitamente isso): não existe coluna "campo" -- valor_anterior/valor_novo são
// snapshots JSONB da linha inteira (to_jsonb(OLD)/to_jsonb(NEW) em app.trg_auditoria()),
// não um diff por campo único. HistoricoAuditoria expõe os snapshots completos; extrair
// "qual campo mudou de X para Y" a partir deles é responsabilidade do componente de
// leitura (ModalHistorico, Fase 4), não desta query.
export async function buscarHistoricoAuditoria(
  client: SupabaseClient<Database>,
  tabela: string,
  idRegistro: number
): Promise<HistoricoAuditoria[]> {
  const { data, error } = await client
    .from("log_auditoria")
    .select("id_log, id_usuario, ocorrido_em, acao, valor_anterior, valor_novo")
    .eq("tabela", tabela)
    .eq("id_registro_alvo", idRegistro)
    .order("ocorrido_em", { ascending: false });
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const idsUsuario = Array.from(new Set(data.map((linha) => linha.id_usuario)));
  const { data: usuarios, error: erroUsuarios } = await client
    .from("dim_usuario")
    .select("id_usuario, nome")
    .in("id_usuario", idsUsuario);
  if (erroUsuarios) throw erroUsuarios;
  const nomesPorId = new Map((usuarios ?? []).map((u) => [u.id_usuario, u.nome]));

  return data.map((linha) => ({
    idLog: linha.id_log as number,
    quem: nomesPorId.get(linha.id_usuario as number) ?? "",
    quando: linha.ocorrido_em as string,
    acao: linha.acao as "insert" | "update" | "delete",
    valorAnterior: (linha.valor_anterior as Record<string, unknown> | null) ?? null,
    valorNovo: (linha.valor_novo as Record<string, unknown> | null) ?? null,
  }));
}

export interface PessoaVinculada {
  idUsuario: number;
  nome: string;
  papelNoContrato: string;
}

// PLM-13. Pessoas com vínculo ativo neste contrato -- popula o Select de
// "responsável" da Meta (fat_meta.id_usuario_responsavel). Mesmo filtro de
// vínculo ativo de contarContratosEAssessoresAtivos (contrato.ts).
export async function buscarPessoasVinculadasAoContrato(
  client: SupabaseClient<Database>,
  idContrato: number
): Promise<PessoaVinculada[]> {
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: vinculos, error } = await client
    .from("rel_usuario_contrato")
    .select("id_usuario, papel_no_contrato")
    .eq("id_contrato", idContrato)
    .or(`dt_fim.is.null,dt_fim.gte.${hoje}`);
  if (error) throw error;
  if (!vinculos || vinculos.length === 0) return [];

  const idsUsuario = Array.from(new Set(vinculos.map((v) => v.id_usuario)));
  const { data: usuarios, error: erroUsuarios } = await client
    .from("dim_usuario")
    .select("id_usuario, nome")
    .in("id_usuario", idsUsuario);
  if (erroUsuarios) throw erroUsuarios;
  const nomesPorId = new Map((usuarios ?? []).map((u) => [u.id_usuario, u.nome]));

  return vinculos.map((v) => ({
    idUsuario: v.id_usuario,
    nome: nomesPorId.get(v.id_usuario) ?? "",
    papelNoContrato: v.papel_no_contrato,
  }));
}
