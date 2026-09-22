import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import {
  resolverOrigensCadeia,
  type CadeiaItem,
  type CadeiaOrigem,
  type FatoGeradorResumo,
  type InsightResumo,
  type PreInsightResumo,
  type RegistroResumo,
  type TimelineItem,
} from "./incidencia";

// Leitura agregada da Incidência de vários mandatos de uma vez -- a aba
// "Fatos Geradores" do produto (Estratégia). Mesmas 6 leituras que a aba do
// contrato (buscar*DoContrato, buscarTimelineIncidencia, buscarCadeiasIncidencia),
// mas com `id_contrato IN (...)` em vez de `= id`, e com o contrato de origem
// preenchido em cada item da Linha do Tempo e da Cadeia (é o que permite a
// tela dizer de qual mandato é cada card).
//
// Não agrega nada (AD-003): só traz as linhas dos contratos pedidos. Quem
// escolhe QUAIS contratos entram é a página, a partir dos filtros
// Gestora/Projeto/Contrato -- esta camada não conhece filtro nenhum.
//
// Por que existe em vez de reaproveitar as funções por contrato: chamá-las uma
// vez por mandato multiplicaria as idas ao banco por N (6 leituras + joins em
// cada), e as originais fixam `.eq("id_contrato", id)`.
//
// Paginação: o PostgREST corta respostas em 1000 linhas (max_rows) sem avisar.
// Um produto com dezenas de mandatos passa disso só em Registros (47 num
// mandato do mockup), e a tela mostraria um recorte silencioso -- contagem dos
// KPIs errada e itens sumindo. Por isso toda leitura de tabela/view larga
// passa por `lerTodas`, que segue pedindo páginas até esgotar.
export interface IncidenciaProduto {
  registros: RegistroResumo[];
  insights: InsightResumo[];
  fatosGeradores: FatoGeradorResumo[];
  preInsights: PreInsightResumo[];
  timeline: TimelineItem[];
  cadeias: CadeiaItem[];
}

const VAZIA: IncidenciaProduto = {
  registros: [],
  insights: [],
  fatosGeradores: [],
  preInsights: [],
  timeline: [],
  cadeias: [],
};

const TAMANHO_PAGINA = 1000;
// Lookups por id (nomes de tipo, autor, pilar, tipologia) vão na URL; lotes
// pequenos mantêm a query longe do limite de tamanho de URL do gateway.
const TAMANHO_LOTE_IDS = 200;

type Pagina<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

async function lerTodas<T>(pedirPagina: (inicio: number, fim: number) => Pagina<T>): Promise<T[]> {
  const todas: T[] = [];
  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    const { data, error } = await pedirPagina(inicio, inicio + TAMANHO_PAGINA - 1);
    if (error) throw error;
    const pagina = data ?? [];
    todas.push(...pagina);
    if (pagina.length < TAMANHO_PAGINA) return todas;
  }
}

function lotes(ids: number[]): number[][] {
  const resultado: number[][] = [];
  for (let i = 0; i < ids.length; i += TAMANHO_LOTE_IDS) resultado.push(ids.slice(i, i + TAMANHO_LOTE_IDS));
  return resultado;
}

function unicos(ids: (number | null | undefined)[]): number[] {
  return Array.from(new Set(ids.filter((id): id is number => id != null)));
}

async function nomesUsuarios(client: SupabaseClient<Database>, ids: number[]): Promise<Map<number, string>> {
  const mapa = new Map<number, string>();
  for (const lote of lotes(ids)) {
    const { data, error } = await client.from("dim_usuario").select("id_usuario, nome").in("id_usuario", lote);
    if (error) throw error;
    for (const u of data ?? []) mapa.set(u.id_usuario, u.nome);
  }
  return mapa;
}

export async function buscarIncidenciaDoProduto(
  client: SupabaseClient<Database>,
  idsContrato: number[]
): Promise<IncidenciaProduto> {
  // Sem contrato no recorte não há o que ler -- evita 6 idas ao banco só para
  // voltar vazio.
  if (idsContrato.length === 0) return VAZIA;

  const [registrosBrutos, insightsBrutos, fatosBrutos, preInsightsBrutos, timelineBruta, cadeiasBrutas] =
    await Promise.all([
      lerTodas((de, ate) =>
        client
          .from("fat_registro")
          .select("id_registro, id_tipo_registro, ocorrido_em, resumo, id_usuario_autor")
          .in("id_contrato", idsContrato)
          .order("id_registro")
          .range(de, ate)
      ),
      lerTodas((de, ate) =>
        client
          .from("fat_insight")
          .select("id_insight, conteudo, id_pilar, ocorrido_em")
          .in("id_contrato", idsContrato)
          .order("id_insight")
          .range(de, ate)
      ),
      lerTodas((de, ate) =>
        client
          .from("fat_fato_gerador")
          .select(
            "id_fato_gerador, id_tipologia, nivel_d1, nivel_d2, nivel_d3, titulo, situacao, dt_ocorrencia, dt_prevista, descricao_evidencia"
          )
          .in("id_contrato", idsContrato)
          .order("id_fato_gerador")
          .range(de, ate)
      ),
      lerTodas((de, ate) =>
        client
          .from("fat_pre_insight")
          .select("id_pre_insight, conteudo, ocorrido_em")
          .in("id_contrato", idsContrato)
          .order("id_pre_insight")
          .range(de, ate)
      ),
      lerTodas((de, ate) =>
        client
          .from("vw_timeline_incidencia")
          .select("id_contrato, tipo, id_origem, titulo, data_evento, criado_em, id_usuario_autor")
          .in("id_contrato", idsContrato)
          .order("tipo")
          .order("id_origem")
          .range(de, ate)
      ),
      lerTodas((de, ate) =>
        client
          .from("vw_cadeia_incidencia")
          .select("id_contrato, id_fato_gerador, titulo, situacao, data_evento, chave_origem")
          .in("id_contrato", idsContrato)
          .order("id_fato_gerador")
          .range(de, ate)
      ),
    ]);

  const idsTipoRegistro = unicos(registrosBrutos.map((r) => r.id_tipo_registro));
  const idsPilar = unicos(insightsBrutos.map((i) => i.id_pilar));
  const idsTipologia = unicos(fatosBrutos.map((f) => f.id_tipologia));
  const idsAutor = unicos([
    ...registrosBrutos.map((r) => r.id_usuario_autor),
    ...timelineBruta.map((t) => t.id_usuario_autor),
  ]);

  const [nomesPorAutor, nomesPorTipoRegistro, nomesPorPilar, nomesPorTipologia, resolveOrigem] = await Promise.all([
    nomesUsuarios(client, idsAutor),
    (async () => {
      const mapa = new Map<number, string>();
      for (const lote of lotes(idsTipoRegistro)) {
        const { data, error } = await client
          .from("ref_tipo_registro")
          .select("id_tipo_registro, nome")
          .in("id_tipo_registro", lote);
        if (error) throw error;
        for (const t of data ?? []) mapa.set(t.id_tipo_registro, t.nome);
      }
      return mapa;
    })(),
    (async () => {
      const mapa = new Map<number, string>();
      for (const lote of lotes(idsPilar)) {
        const { data, error } = await client.from("ref_pilar_insight").select("id_pilar, nome").in("id_pilar", lote);
        if (error) throw error;
        for (const p of data ?? []) mapa.set(p.id_pilar, p.nome);
      }
      return mapa;
    })(),
    (async () => {
      const mapa = new Map<number, string>();
      for (const lote of lotes(idsTipologia)) {
        const { data, error } = await client
          .from("ref_tipologia")
          .select("id_tipologia, grupo, tipologia, estado")
          .in("id_tipologia", lote);
        if (error) throw error;
        for (const t of data ?? []) mapa.set(t.id_tipologia, `${t.grupo} · ${t.tipologia} · ${t.estado}`);
      }
      return mapa;
    })(),
    resolverOrigensCadeiaEmLotes(client, cadeiasBrutas),
  ]);

  return {
    registros: registrosBrutos.map((r) => ({
      idRegistro: r.id_registro,
      tipoRegistro: nomesPorTipoRegistro.get(r.id_tipo_registro) ?? "",
      ocorridoEm: r.ocorrido_em,
      resumo: r.resumo,
      nomeAutor: nomesPorAutor.get(r.id_usuario_autor) ?? "",
    })),
    insights: insightsBrutos.map((i) => ({
      idInsight: i.id_insight,
      conteudo: i.conteudo,
      pilar: i.id_pilar != null ? (nomesPorPilar.get(i.id_pilar) ?? null) : null,
      ocorridoEm: i.ocorrido_em,
    })),
    fatosGeradores: fatosBrutos.map((f) => ({
      idFatoGerador: f.id_fato_gerador,
      tipologia: nomesPorTipologia.get(f.id_tipologia) ?? "",
      niveis: { d1: f.nivel_d1, d2: f.nivel_d2, d3: f.nivel_d3 },
      titulo: f.titulo,
      situacao: f.situacao as "projetado" | "realizado",
      dtOcorrencia: f.dt_ocorrencia,
      dtPrevista: f.dt_prevista,
      descricaoEvidencia: f.descricao_evidencia,
    })),
    preInsights: preInsightsBrutos.map((p) => ({
      idPreInsight: p.id_pre_insight,
      conteudo: p.conteudo,
      ocorridoEm: p.ocorrido_em,
    })),
    timeline: timelineBruta.map((i) => ({
      tipo: i.tipo as TimelineItem["tipo"],
      idOrigem: i.id_origem as number,
      titulo: i.titulo,
      dataEvento: i.data_evento,
      criadoEm: i.criado_em,
      idUsuarioAutor: i.id_usuario_autor,
      nomeAutor: i.id_usuario_autor != null ? (nomesPorAutor.get(i.id_usuario_autor) ?? null) : null,
      idContrato: i.id_contrato as number,
    })),
    cadeias: cadeiasBrutas.map((c) => ({
      idFatoGerador: c.id_fato_gerador as number,
      titulo: c.titulo,
      situacao: c.situacao as "projetado" | "realizado",
      dataEvento: c.data_evento,
      chaveOrigem: c.chave_origem as string,
      idContrato: c.id_contrato as number,
      origem: resolveOrigem(c.chave_origem as string),
    })),
  };
}

// resolverOrigensCadeia faz `.in(id, todosOsIds)` numa única query por tipo --
// certo para 1 contrato, mas com vários mandatos a lista de ids de origem
// cresce e a URL estoura. Aqui o resolvedor é chamado por lote de linhas e os
// resultados são combinados; a chave "<tipo>:<id>" é única entre mandatos,
// então nenhum lote sabe do outro.
async function resolverOrigensCadeiaEmLotes(
  client: SupabaseClient<Database>,
  rows: { chave_origem: string | null }[]
): Promise<(chaveOrigem: string) => CadeiaOrigem | null> {
  const chaves = Array.from(new Set(rows.map((r) => r.chave_origem).filter((c): c is string => !!c)));
  const resolvedores: Array<(chaveOrigem: string) => CadeiaOrigem | null> = [];

  for (let i = 0; i < chaves.length; i += TAMANHO_LOTE_IDS) {
    const lote = chaves.slice(i, i + TAMANHO_LOTE_IDS);
    resolvedores.push(await resolverOrigensCadeia(client, lote.map((chave_origem) => ({ chave_origem }))));
  }

  return (chave) => {
    for (const resolve of resolvedores) {
      const origem = resolve(chave);
      if (origem) return origem;
    }
    return null;
  };
}
