import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import type { PapelGlobal } from "./usuario";

// Formas de leitura (view-models client-side) definidas verbatim conforme
// design.md (## Components -- queries/formulario.ts). Leituras da aba
// Formulários e da página de resposta -- nunca escreve.

export interface FormularioListado {
  idFormulario: number;
  idAbertura: number;
  codigo: string;
  nome: string;
  respondente: string | null;
  estado: "aberto" | "fechado";
  exigeAnexo: boolean;
  permiteEdicaoAberta: boolean;
  jaRespondeu: boolean;
}

export interface MetricaFormulario {
  idMetrica: number;
  codigoCampo: string;
  rotulo: string;
  tipo: string;
  ehNps: boolean;
  agrupador: string | null;
}

export interface Submissao {
  idSubmissao: number;
  versaoFormulario: number;
  respostas: Record<string, unknown>;
  momento: string | null;
  aceiteEm: string | null;
  enviadaEm: string;
  atualizadaEm: string | null;
}

export interface DimensaoGip {
  idDimensao: number;
  codigo: string;
  nome: string;
  valorMin: number;
  valorMax: number;
  ordem: number;
}

export interface GipEvolucao {
  momento: string;
  aplicadoEm: string;
  dimensao: string;
  nomeDimensao: string;
  ordem: number;
  reguaSonhos: number | null;
  ondeChegamos: number | null;
  gap: number | null;
  situacao: string | null;
  quadrante: string | null;
}

export interface AvaliacaoNps {
  idFormulario: number;
  idProjetoGrupo: number;
  idMetrica: number;
  rotulo: string;
  agrupador: string | null;
  ehNps: boolean;
  nrRespostas: number;
  media: number | null;
  promotores: number;
  neutros: number;
  detratores: number;
  nps: number | null;
}

// design.md, Tech Decisions "Mapeamento respondente -> papel real": só 3
// valores do CHECK aprovado (ck_formulario_respondente) restringem a
// visibilidade de Mentor/Assessor -- os outros 3 (gestora,
// cargo_cg_parlamentar, mandato) já são sempre visíveis a Gestora/Admin
// (FRM-14, que veem os 16 independente de respondente), então não entram
// aqui.
const PAPEL_POR_RESPONDENTE: Record<string, PapelGlobal> = {
  mentor: "mentor",
  assessor: "assessor",
  mentorado: "assessor", // PLL, sem papel de login próprio (context.md)
};

// FRM-01, FRM-02, FRM-14. Gestora/Admin veem os 16 formulários do produto do
// contrato; Mentor/Assessor só os endereçados ao papel dele (mapeamento
// fixo acima) que estão abertos, ou que ele já respondeu.
export async function buscarFormulariosDoContrato(
  client: SupabaseClient<Database>,
  idContrato: number,
  papel: PapelGlobal,
  idUsuario: number
): Promise<FormularioListado[]> {
  const { data, error } = await client
    .from("rel_formulario_contrato")
    .select(
      "id_abertura, id_formulario, estado, ref_formulario(codigo, nome, respondente, exige_anexo, permite_edicao_aberta)"
    )
    .eq("id_contrato", idContrato);
  if (error) throw error;

  const { data: submissoes, error: erroSubmissoes } = await client
    .from("fat_submissao")
    .select("id_formulario")
    .eq("id_contrato", idContrato)
    .eq("id_usuario_respondente", idUsuario);
  if (erroSubmissoes) throw erroSubmissoes;
  const idsFormularioRespondidos = new Set((submissoes ?? []).map((s) => s.id_formulario));

  const listados: FormularioListado[] = (data ?? [])
    .map((linha) => {
      const formulario = linha.ref_formulario as unknown as {
        codigo: string;
        nome: string;
        respondente: string | null;
        exige_anexo: boolean;
        permite_edicao_aberta: boolean;
      } | null;
      if (!formulario) return null;

      return {
        idFormulario: linha.id_formulario,
        idAbertura: linha.id_abertura,
        codigo: formulario.codigo,
        nome: formulario.nome,
        respondente: formulario.respondente,
        estado: linha.estado as "aberto" | "fechado",
        exigeAnexo: formulario.exige_anexo,
        permiteEdicaoAberta: formulario.permite_edicao_aberta,
        jaRespondeu: idsFormularioRespondidos.has(linha.id_formulario),
      };
    })
    .filter((item): item is FormularioListado => item !== null);

  if (papel === "admin" || papel === "gestora") return listados;

  return listados.filter(
    (item) =>
      PAPEL_POR_RESPONDENTE[item.respondente ?? ""] === papel && (item.estado === "aberto" || item.jaRespondeu)
  );
}

// FRM-04, FRM-05. Campos ativos de um formulário -- dirige o Zod schema
// dinâmico do formulário genérico (design.md, FormularioGenericoForm).
export async function buscarMetricasAtivas(
  client: SupabaseClient<Database>,
  idFormulario: number
): Promise<MetricaFormulario[]> {
  const { data, error } = await client
    .from("ref_metrica_formulario")
    .select("id_metrica, codigo_campo, rotulo, tipo, eh_nps, agrupador")
    .eq("id_formulario", idFormulario)
    .eq("ativo", true);
  if (error) throw error;

  return (data ?? []).map((m) => ({
    idMetrica: m.id_metrica,
    codigoCampo: m.codigo_campo,
    rotulo: m.rotulo,
    tipo: m.tipo,
    ehNps: m.eh_nps,
    agrupador: m.agrupador,
  }));
}

// FRM-10, FRM-11. 1 linha de fat_submissao do próprio usuário, pela chave de
// negócio (id_contrato, id_formulario, id_usuario_respondente, momento) --
// nunca por id_submissao adivinhado (design.md, Risks & Concerns:
// uq_submissao_respondente é índice parcial/por expressão, upsert não mira
// nele com segurança). momento omitido ou null busca a linha "única"
// (formulários fora do GIP, onde momento é sempre NULL).
export async function buscarSubmissaoPropria(
  client: SupabaseClient<Database>,
  idContrato: number,
  idFormulario: number,
  idUsuario: number,
  momento?: string | null
): Promise<Submissao | null> {
  let query = client
    .from("fat_submissao")
    .select("id_submissao, versao_formulario, respostas, momento, aceite_em, enviada_em, atualizada_em")
    .eq("id_contrato", idContrato)
    .eq("id_formulario", idFormulario)
    .eq("id_usuario_respondente", idUsuario);
  query = momento ? query.eq("momento", momento) : query.is("momento", null);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    idSubmissao: data.id_submissao,
    versaoFormulario: data.versao_formulario,
    respostas: data.respostas as Record<string, unknown>,
    momento: data.momento,
    aceiteEm: data.aceite_em,
    enviadaEm: data.enviada_em,
    atualizadaEm: data.atualizada_em,
  };
}

// FRM-15 a FRM-19. As 4 dimensões ativas do GIP, na ordem de exibição --
// alimenta a tela sob medida (FormularioGipForm).
export async function buscarDimensoesGipAtivas(client: SupabaseClient<Database>): Promise<DimensaoGip[]> {
  const { data, error } = await client
    .from("ref_dimensao_gip")
    .select("id_dimensao, codigo, nome, valor_min, valor_max, ordem")
    .eq("ativo", true)
    .order("ordem", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((d) => ({
    idDimensao: d.id_dimensao,
    codigo: d.codigo,
    nome: d.nome,
    valorMin: d.valor_min,
    valorMax: d.valor_max,
    ordem: d.ordem,
  }));
}

// FRM-19. Lê vw_gip_evolucao (100% derivada por trigger, nunca escrita
// direta) para a tela do GIP mostrar o que já foi aplicado -- os 2 eixos e
// o gap por dimensão.
export async function buscarGipDoContrato(
  client: SupabaseClient<Database>,
  idContrato: number
): Promise<GipEvolucao[]> {
  const { data, error } = await client
    .from("vw_gip_evolucao")
    .select(
      "momento, aplicado_em, dimensao, nome_dimensao, ordem, regua_sonhos, onde_chegamos, gap, situacao, quadrante"
    )
    .eq("id_contrato", idContrato)
    .order("ordem", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((g) => ({
    momento: g.momento as string,
    aplicadoEm: g.aplicado_em as string,
    dimensao: g.dimensao as string,
    nomeDimensao: g.nome_dimensao as string,
    ordem: g.ordem as number,
    reguaSonhos: g.regua_sonhos,
    ondeChegamos: g.onde_chegamos,
    gap: g.gap,
    situacao: g.situacao,
    quadrante: g.quadrante,
  }));
}

// FRM-20, FRM-23. Lê mv_avaliacao_nps filtrada pelos formulários do produto
// (via ref_etapa.id_produto -- a MV não tem id_produto direto). RLS/GRANT
// nega a leitura pra quem não é Gestora/Admin (T10) -- o erro (42501)
// propaga cru daqui, nunca vira lista vazia, para não confundir "sem dado"
// com "sem permissão" (design.md, Components).
export async function buscarAvaliacaoNps(
  client: SupabaseClient<Database>,
  idProduto: number
): Promise<AvaliacaoNps[]> {
  const { data: etapas, error: erroEtapas } = await client
    .from("ref_etapa")
    .select("id_etapa")
    .eq("id_produto", idProduto);
  if (erroEtapas) throw erroEtapas;
  const idsEtapa = (etapas ?? []).map((e) => e.id_etapa);
  if (idsEtapa.length === 0) return [];

  const { data: formularios, error: erroFormularios } = await client
    .from("ref_formulario")
    .select("id_formulario")
    .in("id_etapa", idsEtapa);
  if (erroFormularios) throw erroFormularios;
  const idsFormulario = (formularios ?? []).map((f) => f.id_formulario);
  if (idsFormulario.length === 0) return [];

  const { data, error } = await client
    .from("mv_avaliacao_nps")
    .select(
      "id_formulario, id_projeto_grupo, id_metrica, rotulo, agrupador, eh_nps, nr_respostas, media, promotores, neutros, detratores, nps"
    )
    .in("id_formulario", idsFormulario);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    idFormulario: row.id_formulario as number,
    idProjetoGrupo: row.id_projeto_grupo as number,
    idMetrica: row.id_metrica as number,
    rotulo: row.rotulo as string,
    agrupador: row.agrupador,
    ehNps: row.eh_nps as boolean,
    nrRespostas: row.nr_respostas as number,
    media: row.media,
    promotores: row.promotores as number,
    neutros: row.neutros as number,
    detratores: row.detratores as number,
    nps: row.nps,
  }));
}
