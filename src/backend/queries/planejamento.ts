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
  status: "ativa" | "pausada" | "descartada";
  pctAtingimento: number | null;
  idPreditorPrimario: number | null;
  idPreditorSecundario: number | null;
}

export interface ObjetivoComMetas {
  idObjetivo: number;
  idPlanejamento: number;
  descricao: string;
  idPreditorPrimario: number | null;
  idPreditorSecundario: number | null;
  pctAtingimento: number | null;
  metas: MetaResumo[];
}

export interface PlanejamentoCompleto {
  idPlanejamento: number;
  idContrato: number;
  objetivoAno: string | null;
  legado: string | null;
  analiseConjuntura: string | null;
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
    .select("id_planejamento, id_contrato, objetivo_ano, legado, analise_conjuntura, pct_atingimento, atingimento_desatualizado")
    .eq("id_contrato", idContrato)
    .maybeSingle();
  if (erroPlanejamento) throw erroPlanejamento;
  if (!planejamento) return null;

  const { data: objetivosData, error: erroObjetivos } = await client
    .from("fat_objetivo_especifico")
    .select("id_objetivo, id_planejamento, descricao, id_preditor_primario, id_preditor_secundario, pct_atingimento")
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
        "id_meta, id_objetivo, descricao, classe, status, pct_atingimento, id_preditor_primario, id_preditor_secundario"
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
        status: m.status as "ativa" | "pausada" | "descartada",
        pctAtingimento: m.pct_atingimento,
        idPreditorPrimario: m.id_preditor_primario,
        idPreditorSecundario: m.id_preditor_secundario,
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
    pctAtingimento: planejamento.pct_atingimento,
    atingimentoDesatualizado: planejamento.atingimento_desatualizado,
    objetivos: objetivos.map((o) => ({
      idObjetivo: o.id_objetivo,
      idPlanejamento: o.id_planejamento,
      descricao: o.descricao,
      idPreditorPrimario: o.id_preditor_primario,
      idPreditorSecundario: o.id_preditor_secundario,
      pctAtingimento: o.pct_atingimento,
      metas: metasPorObjetivo.get(o.id_objetivo) ?? [],
    })),
  };
}

// PLM-01 (grade). Sucessos Mensais das Metas informadas, num mês de
// referência -- idsMeta vem da hierarquia já carregada por
// buscarPlanejamentoCompleto (evita repetir o join até dim_planejamento).
export async function buscarGradeSucessosMensais(
  client: SupabaseClient<Database>,
  idsMeta: number[],
  mesReferencia: string
): Promise<SucessoMensalGrade[]> {
  if (idsMeta.length === 0) return [];

  const { data, error } = await client
    .from("vw_sucesso_mensal")
    .select("id_sucesso, id_meta, descricao, mes_referencia, dt_limite, peso, pct_atingimento, status, dias_atraso, esta_atrasado")
    .in("id_meta", idsMeta)
    .eq("mes_referencia", mesReferencia)
    .order("id_meta", { ascending: true })
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
