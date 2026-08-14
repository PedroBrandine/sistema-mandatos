import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

// Formas de leitura (view-models client-side) definidas conforme design.md
// (## Components -- src/backend/queries/incidencia.ts). Mesmo padrão de
// etapa-contrato.ts/kanban.ts: client por parâmetro, snake_case do banco ->
// camelCase, `if (!data) return []`/`null`.

export interface RefOption {
  id: number;
  nome: string;
}

// INC-04, INC-05, INC-07, INC-08. Lê vw_iip_contrato -- 1 linha por
// contrato (nunca 0, T8), mas a leitura não assume isso (defensivo, mesmo
// padrão de buscarPlanejamentoCompleto). `iipProvisorio`/`nrFatos` chegam
// `null` quando o contrato não tem Fato Gerador (LEFT JOIN, AD-005) ou
// quando nenhuma ref_tipologia ainda tem id_indicador (Assumption #1b) --
// nunca 0 nesses casos.
export async function buscarIipContrato(
  client: SupabaseClient<Database>,
  idContrato: number
): Promise<{ nrFatos: number | null; iipProvisorio: number | null } | null> {
  const { data, error } = await client
    .from("vw_iip_contrato")
    .select("nr_fatos, iip_provisorio")
    .eq("id_contrato", idContrato)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return { nrFatos: data.nr_fatos, iipProvisorio: data.iip_provisorio };
}

// Catálogo de ref_tipologia ativas -- popula o Select de Tipologia do
// formulário de Fato Gerador. `nome` concatena grupo/tipologia/estado
// (mesmo tratamento de FatoGeradorResumo.tipologia, ver parte 2 deste
// arquivo) já que o catálogo não tem um único campo de rótulo.
export async function buscarTipologiasAtivas(client: SupabaseClient<Database>): Promise<RefOption[]> {
  const { data, error } = await client
    .from("ref_tipologia")
    .select("id_tipologia, grupo, tipologia, estado")
    .eq("ativo", true);
  if (error) throw error;
  if (!data) return [];

  return data.map((t) => ({ id: t.id_tipologia, nome: `${t.grupo} · ${t.tipologia} · ${t.estado}` }));
}

export interface TipologiaCompleta {
  idTipologia: number;
  grupo: string;
  tipologia: string;
  estado: string;
  nivelD1Padrao: string | null;
  nivelD2Padrao: string | null;
  nivelD3Padrao: string | null;
  idPreditor1: number | null;
  idPreditor2: number | null;
  nomePreditor1: string | null;
  nomePreditor2: string | null;
}

// Achado de UAT (Pedro, 2026-08-14): Preditor 1/2 e os níveis D1/D2/D3 do CSV
// (docs/DB_Fatos_Geradores - Ref_Tipologias.csv) não são escolha livre da
// Gestora por ocorrência -- são atributo FIXO de cada combinação
// Grupo+Tipologia+Estado, já gravado em ref_tipologia.{nivel_d1_padrao,
// nivel_d2_padrao,nivel_d3_padrao,id_preditor_1,id_preditor_2} desde o seed
// (T1). Esta leitura traz a linha completa (+ nome dos preditores, resolvido
// client-side, mesmo padrão de buscarFatosGeradoresDoContrato) pra
// FatoGeradorForm popular a cascata Grupo→Tipologia→Estado e derivar
// nível/preditor automaticamente, em vez de reexpor os 2 catálogos como
// Selects independentes.
export async function buscarTipologiasCompletas(client: SupabaseClient<Database>): Promise<TipologiaCompleta[]> {
  const { data, error } = await client
    .from("ref_tipologia")
    .select(
      "id_tipologia, grupo, tipologia, estado, nivel_d1_padrao, nivel_d2_padrao, nivel_d3_padrao, id_preditor_1, id_preditor_2"
    )
    .eq("ativo", true)
    // Ordem de inserção do seed (T1) segue a numeração de Grupo do CSV
    // (1..11) -- ordenar por id preserva essa ordem; ordem alfabética
    // quebraria ("10."/"11." viriam antes de "2." como string).
    .order("id_tipologia", { ascending: true });
  if (error) throw error;
  if (!data) return [];

  const idsPreditor = Array.from(
    new Set(
      data.flatMap((t) => [t.id_preditor_1, t.id_preditor_2]).filter((id): id is number => id != null)
    )
  );
  let nomesPorPreditor = new Map<number, string>();
  if (idsPreditor.length > 0) {
    const { data: preditores, error: erroPreditores } = await client
      .from("ref_preditor")
      .select("id_preditor, nome")
      .in("id_preditor", idsPreditor);
    if (erroPreditores) throw erroPreditores;
    nomesPorPreditor = new Map((preditores ?? []).map((p) => [p.id_preditor, p.nome]));
  }

  return data.map((t) => ({
    idTipologia: t.id_tipologia,
    grupo: t.grupo,
    tipologia: t.tipologia,
    estado: t.estado,
    nivelD1Padrao: t.nivel_d1_padrao,
    nivelD2Padrao: t.nivel_d2_padrao,
    nivelD3Padrao: t.nivel_d3_padrao,
    idPreditor1: t.id_preditor_1,
    idPreditor2: t.id_preditor_2,
    nomePreditor1: t.id_preditor_1 != null ? (nomesPorPreditor.get(t.id_preditor_1) ?? null) : null,
    nomePreditor2: t.id_preditor_2 != null ? (nomesPorPreditor.get(t.id_preditor_2) ?? null) : null,
  }));
}

// INC-14. Catálogo de ref_pilar_insight ativos -- popula o Select de Pilar
// (opcional) do formulário de Insight.
export async function buscarPilaresInsight(client: SupabaseClient<Database>): Promise<RefOption[]> {
  const { data, error } = await client.from("ref_pilar_insight").select("id_pilar, nome").eq("ativo", true);
  if (error) throw error;
  if (!data) return [];

  return data.map((p) => ({ id: p.id_pilar, nome: p.nome }));
}

// Catálogo de ref_nivel_iip -- popula o Select de nível (D1/D2/D3) do
// formulário de Fato Gerador (baixo/medio/alto/maximo, seed T1).
export async function buscarNiveisIip(
  client: SupabaseClient<Database>
): Promise<{ codigo: string; rotulo: string }[]> {
  const { data, error } = await client.from("ref_nivel_iip").select("codigo, rotulo");
  if (error) throw error;
  if (!data) return [];

  return data.map((n) => ({ codigo: n.codigo, rotulo: n.rotulo }));
}

// INC-09. ref_tipo_registro ativos de uma etapa -- popula o Select de Tipo
// de Registro do formulário de Registro, escopado à etapa aberta (o banco
// ainda rejeita, via trg_valida_registro_produto, um tipo fora da régua do
// produto do contrato -- este catálogo só reduz a chance de tentar).
export async function buscarTiposRegistroDaEtapa(
  client: SupabaseClient<Database>,
  idEtapa: number
): Promise<RefOption[]> {
  const { data, error } = await client
    .from("ref_tipo_registro")
    .select("id_tipo_registro, nome")
    .eq("id_etapa", idEtapa)
    .eq("ativo", true);
  if (error) throw error;
  if (!data) return [];

  return data.map((t) => ({ id: t.id_tipo_registro, nome: t.nome }));
}

export interface RegistroResumo {
  idRegistro: number;
  tipoRegistro: string;
  ocorridoEm: string;
  resumo: string | null;
  nomeAutor: string;
}

// INC-09, INC-11. fat_registro de uma etapa do contrato -- filtra por
// id_contrato + id_tipo_registro pertencente à etapa (join client-side com
// ref_tipo_registro, mesmo padrão de buscarBoardKanban: nenhum embed do
// PostgREST, várias consultas compostas em memória). Popula a listagem
// abaixo da tabela de régua em etapas/[codigo]/page.tsx.
export async function buscarRegistrosDaEtapa(
  client: SupabaseClient<Database>,
  idContrato: number,
  idEtapa: number
): Promise<RegistroResumo[]> {
  const { data: tipos, error: erroTipos } = await client
    .from("ref_tipo_registro")
    .select("id_tipo_registro, nome")
    .eq("id_etapa", idEtapa);
  if (erroTipos) throw erroTipos;
  if (!tipos || tipos.length === 0) return [];

  const nomesPorTipo = new Map(tipos.map((t) => [t.id_tipo_registro, t.nome]));
  const idsTipoRegistro = tipos.map((t) => t.id_tipo_registro);

  const { data: registros, error: erroRegistros } = await client
    .from("fat_registro")
    .select("id_registro, id_tipo_registro, ocorrido_em, resumo, id_usuario_autor")
    .eq("id_contrato", idContrato)
    .in("id_tipo_registro", idsTipoRegistro);
  if (erroRegistros) throw erroRegistros;
  if (!registros || registros.length === 0) return [];

  const idsUsuario = Array.from(new Set(registros.map((r) => r.id_usuario_autor)));
  const { data: usuarios, error: erroUsuarios } = await client
    .from("dim_usuario")
    .select("id_usuario, nome")
    .in("id_usuario", idsUsuario);
  if (erroUsuarios) throw erroUsuarios;
  const nomesPorUsuario = new Map((usuarios ?? []).map((u) => [u.id_usuario, u.nome]));

  return registros.map((r) => ({
    idRegistro: r.id_registro,
    tipoRegistro: nomesPorTipo.get(r.id_tipo_registro) ?? "",
    ocorridoEm: r.ocorrido_em,
    resumo: r.resumo,
    nomeAutor: nomesPorUsuario.get(r.id_usuario_autor) ?? "",
  }));
}

export interface EncontroResumo {
  idEncontro: number;
  titulo: string;
  status: "planejado" | "realizado" | "cancelado" | "remarcado";
  dtPrevistaInicio: string | null;
  dtRealizada: string | null;
}

// INC-15, INC-16, INC-17. Encontros do contrato -- popula EncontrosLista.
export async function buscarEncontrosDoContrato(
  client: SupabaseClient<Database>,
  idContrato: number
): Promise<EncontroResumo[]> {
  const { data, error } = await client
    .from("fat_encontro")
    .select("id_encontro, titulo, status, dt_prevista_inicio, dt_realizada")
    .eq("id_contrato", idContrato);
  if (error) throw error;
  if (!data) return [];

  return data.map((e) => ({
    idEncontro: e.id_encontro,
    titulo: e.titulo,
    status: e.status as "planejado" | "realizado" | "cancelado" | "remarcado",
    dtPrevistaInicio: e.dt_prevista_inicio,
    dtRealizada: e.dt_realizada,
  }));
}

export interface InsightResumo {
  idInsight: number;
  conteudo: string;
  pilar: string | null;
  ocorridoEm: string | null;
}

// INC-12, INC-13, INC-14. Insights do contrato -- pilar resolvido client-side
// (join com ref_pilar_insight, mesmo padrão de nomesPorId em kanban.ts/
// planejamento.ts) já que fat_insight só guarda id_pilar.
export async function buscarInsightsDoContrato(
  client: SupabaseClient<Database>,
  idContrato: number
): Promise<InsightResumo[]> {
  const { data, error } = await client
    .from("fat_insight")
    .select("id_insight, conteudo, id_pilar, ocorrido_em")
    .eq("id_contrato", idContrato);
  if (error) throw error;
  if (!data) return [];

  const idsPilar = Array.from(new Set(data.map((i) => i.id_pilar).filter((id): id is number => id != null)));
  let nomesPorPilar = new Map<number, string>();
  if (idsPilar.length > 0) {
    const { data: pilares, error: erroPilares } = await client
      .from("ref_pilar_insight")
      .select("id_pilar, nome")
      .in("id_pilar", idsPilar);
    if (erroPilares) throw erroPilares;
    nomesPorPilar = new Map((pilares ?? []).map((p) => [p.id_pilar, p.nome]));
  }

  return data.map((i) => ({
    idInsight: i.id_insight,
    conteudo: i.conteudo,
    pilar: i.id_pilar != null ? (nomesPorPilar.get(i.id_pilar) ?? null) : null,
    ocorridoEm: i.ocorrido_em,
  }));
}

export interface FatoGeradorResumo {
  idFatoGerador: number;
  tipologia: string; // grupo · tipologia · estado, concatenado
  niveis: { d1: string | null; d2: string | null; d3: string | null };
  dtOcorrencia: string;
}

// INC-01, INC-02. Fatos Geradores do contrato -- tipologia resolvida
// client-side (join com ref_tipologia, mesma concatenação de
// buscarTipologiasAtivas) já que fat_fato_gerador só guarda id_tipologia.
export async function buscarFatosGeradoresDoContrato(
  client: SupabaseClient<Database>,
  idContrato: number
): Promise<FatoGeradorResumo[]> {
  const { data, error } = await client
    .from("fat_fato_gerador")
    .select("id_fato_gerador, id_tipologia, nivel_d1, nivel_d2, nivel_d3, dt_ocorrencia")
    .eq("id_contrato", idContrato);
  if (error) throw error;
  if (!data) return [];

  const idsTipologia = Array.from(new Set(data.map((f) => f.id_tipologia)));
  const { data: tipologias, error: erroTipologias } = await client
    .from("ref_tipologia")
    .select("id_tipologia, grupo, tipologia, estado")
    .in("id_tipologia", idsTipologia);
  if (erroTipologias) throw erroTipologias;
  const nomesPorTipologia = new Map(
    (tipologias ?? []).map((t) => [t.id_tipologia, `${t.grupo} · ${t.tipologia} · ${t.estado}`])
  );

  return data.map((f) => ({
    idFatoGerador: f.id_fato_gerador,
    tipologia: nomesPorTipologia.get(f.id_tipologia) ?? "",
    niveis: { d1: f.nivel_d1, d2: f.nivel_d2, d3: f.nivel_d3 },
    dtOcorrencia: f.dt_ocorrencia,
  }));
}
