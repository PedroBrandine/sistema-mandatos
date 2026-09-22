import type { SupabaseClient } from "@supabase/supabase-js";

import { criarMandato, type CandidaturaParaConfirmar } from "../rpc/mandato";
import { mapeiaErroRpc } from "../rpc/errors";
import type { ContratanteInput } from "../schemas/contratante";
import type { LinhaCadastroPll } from "../schemas/cadastro-participante-pll";
import type { MandatoInput } from "../schemas/mandato";
import type { Database } from "../supabase/database.types";
import type { MandatoCriado } from "../types/fundacao";

// Escrita direta em fat_cadastro_participante via `.upsert()` (design.md Tech
// Decisions): N linhas na MESMA tabela, sem invariante multi-tabela -- AD-024
// não se aplica, não é RPC.

export interface ResultadoUpsertCadastroPll {
  inseridos: number;
  atualizados: number;
}

/**
 * Insere/atualiza um lote de linhas já validadas (PLL-CP-01, PLL-CP-03) contra
 * `UNIQUE (id_edicao, email)`: e-mail já existente na edição atualiza a
 * linha de staging existente, nunca duplica.
 *
 * Reimportação NUNCA limpa `id_contrato`/`id_vinculo_tse` (edge case da
 * spec.md, "reimportação nunca desfaz um vínculo confirmado"): o payload
 * enviado ao PostgREST só contém os 25 campos autodeclarados do Anexo A +
 * `id_produto`/`id_edicao`/`importado_por` -- colunas ausentes do payload
 * não entram no `SET` do `ON CONFLICT DO UPDATE` que o PostgREST gera, então
 * `id_contrato`/`id_vinculo_tse`/os campos editáveis no sistema (desafios,
 * destaques, ambição, SWOT) sobrevivem intactos a qualquer reimportação.
 * Verificado contra o dev real antes de escrever este código (Knowledge
 * Verification Chain Step 1): um UPDATE por conflito preserva colunas
 * omitidas do payload; um `id_edicao` NULL nunca gera conflito (semântica de
 * índice único parcial do Postgres para NULL) -- por isso `idEdicao` é
 * obrigatório aqui, ao contrário da coluna (que é anulável no schema para
 * cobrir produtos futuros sem edição -- migration
 * 20260922160511_pll_cadastro_participante_id_edicao.sql).
 */
export async function upsertCadastroParticipantes(
  client: SupabaseClient<Database>,
  params: {
    idProduto: number;
    idEdicao: number;
    idUsuarioImportador?: number | null;
    linhas: LinhaCadastroPll[];
  }
): Promise<ResultadoUpsertCadastroPll> {
  const { idProduto, idEdicao, idUsuarioImportador, linhas } = params;
  if (linhas.length === 0) return { inseridos: 0, atualizados: 0 };

  const emails = linhas.map((linha) => linha.email);
  const { data: existentes, error: erroExistentes } = await client
    .from("fat_cadastro_participante")
    .select("email")
    .eq("id_edicao", idEdicao)
    .in("email", emails);
  if (erroExistentes) throw erroExistentes;
  const emailsExistentes = new Set((existentes ?? []).map((linha) => linha.email));

  const payload = linhas.map((linha) => ({
    ...linha,
    id_produto: idProduto,
    id_edicao: idEdicao,
    importado_por: idUsuarioImportador ?? null,
  }));

  const { error } = await client
    .from("fat_cadastro_participante")
    .upsert(payload, { onConflict: "id_edicao,email" });
  if (error) throw error;

  const atualizados = linhas.filter((linha) => emailsExistentes.has(linha.email)).length;
  return { inseridos: linhas.length - atualizados, atualizados };
}

// -----------------------------------------------------------------------------
// buscarCadastroParticipantesPll (T7) -- lista com busca/filtro/paginação
// (PLL-CP-05…09). Leitura direta de fat_cadastro_participante (RLS decide o
// que cada papel vê -- Gestora/Admin tudo, Mentor só a própria carteira já
// vinculada, ninguém além de Gestora/Admin vê linha sem vínculo).
// -----------------------------------------------------------------------------

const TAMANHO_PAGINA_PADRAO_CADASTRO_PLL = 20;

export interface FiltroCadastroParticipantesPll {
  idProduto: number;
  idEdicao?: number;
  /** Busca por nome, e-mail OU parlamentar (PLL-CP-06). */
  busca?: string;
  /** Design.md ParticipantePll: "siglaPartido -- partido_filiado ou partido
   * do mandato, a decidir em Tasks". Decisão desta task: partido/UF são os
   * do MANDATO (partido_parlamentar/estado_eleicao), não os do participante
   * (partido_filiado) -- são os campos que também alimentam o vínculo TSE
   * (T10/T11), e a coluna vizinha na tabela é "Parlamentar" (D-1), reforçando
   * que o agrupamento visual da linha é pelo lado do mandato. */
  partido?: string;
  uf?: string;
  pagina?: number;
  tamanhoPagina?: number;
}

export interface ParticipantePll {
  idCadastroParticipante: number;
  papel: "mentorado" | "mentor";
  nomeCompleto: string;
  siglaPartido: string | null;
  siglaUf: string | null;
  nomeParlamentar: string | null;
  email: string;
  telefone: string | null;
  nomeMentorPareado: string | null;
  vinculadoTse: boolean;
  statusCadastro: "completo" | "incompleto" | "pendente_revisao";
  idContrato: number | null;
}

export interface ResultadoBuscaCadastroParticipantesPll {
  linhas: ParticipantePll[];
  total: number;
}

interface RowCadastroParticipante {
  id_cadastro_participante: number;
  papel: string;
  nome_completo: string;
  partido_parlamentar: string | null;
  estado_eleicao: string | null;
  nome_parlamentar: string | null;
  email: string;
  telefone: string | null;
  status_cadastro: string;
  id_contrato: number | null;
}

// "Mentor(a) pareado" (PLL-CP-05) é o vínculo ATIVO de papel 'mentor' em
// rel_usuario_contrato para o id_contrato da linha -- só existe depois do
// vínculo TSE (T10/T11), quando id_contrato deixa de ser null. Mesmo filtro
// de vínculo ativo (dt_fim nulo ou futuro) de buscarPessoaAtivaPorPapel em
// queries/mandatos-lista.ts, reescrito aqui (arquivo próprio da feature,
// função interna não exportada de lá).
async function buscarMentoresPareadosPorContrato(
  client: SupabaseClient<Database>,
  idsContrato: number[]
): Promise<Map<number, string | null>> {
  const mapa = new Map<number, string | null>();
  if (idsContrato.length === 0) return mapa;

  const hoje = new Date().toISOString().slice(0, 10);
  const { data, error } = await client
    .from("rel_usuario_contrato")
    .select("id_contrato, dim_usuario(nome)")
    .in("id_contrato", idsContrato)
    .eq("papel_no_contrato", "mentor")
    .or(`dt_fim.is.null,dt_fim.gte.${hoje}`);
  if (error) throw error;

  for (const linha of (data ?? []) as unknown as {
    id_contrato: number;
    dim_usuario: { nome: string } | null;
  }[]) {
    if (!mapa.has(linha.id_contrato)) {
      mapa.set(linha.id_contrato, linha.dim_usuario?.nome ?? null);
    }
  }
  return mapa;
}

/**
 * Lista de participantes importados (PLL-CP-05…09): busca por nome/e-mail/
 * parlamentar, filtro combinável por partido/UF (do mandato, ver
 * FiltroCadastroParticipantesPll), paginação com total real (`count: "exact"`,
 * nunca traz a tabela inteira -- mesmo padrão de buscarPendencias em
 * queries/visao-gerencial.ts).
 */
export async function buscarCadastroParticipantesPll(
  client: SupabaseClient<Database>,
  filtro: FiltroCadastroParticipantesPll
): Promise<ResultadoBuscaCadastroParticipantesPll> {
  const pagina = filtro.pagina ?? 1;
  const tamanhoPagina = filtro.tamanhoPagina ?? TAMANHO_PAGINA_PADRAO_CADASTRO_PLL;

  let query = client
    .from("fat_cadastro_participante")
    .select(
      "id_cadastro_participante, papel, nome_completo, partido_parlamentar, estado_eleicao, nome_parlamentar, email, telefone, status_cadastro, id_contrato",
      { count: "exact" }
    )
    .eq("id_produto", filtro.idProduto);

  if (filtro.idEdicao !== undefined) query = query.eq("id_edicao", filtro.idEdicao);
  if (filtro.partido !== undefined) query = query.eq("partido_parlamentar", filtro.partido);
  if (filtro.uf !== undefined) query = query.eq("estado_eleicao", filtro.uf);
  if (filtro.busca !== undefined && filtro.busca.trim().length > 0) {
    const termo = filtro.busca.trim();
    query = query.or(`nome_completo.ilike.%${termo}%,email.ilike.%${termo}%,nome_parlamentar.ilike.%${termo}%`);
  }

  const inicio = (pagina - 1) * tamanhoPagina;
  const fim = inicio + tamanhoPagina - 1;
  query = query.order("nome_completo", { ascending: true }).range(inicio, fim);

  const { data, error, count } = await query;
  if (error) throw error;

  const rows = (data ?? []) as RowCadastroParticipante[];
  const idsContrato = Array.from(
    new Set(rows.map((r) => r.id_contrato).filter((id): id is number => id !== null))
  );
  const mentoresPareados = await buscarMentoresPareadosPorContrato(client, idsContrato);

  const linhas: ParticipantePll[] = rows.map((r) => ({
    idCadastroParticipante: r.id_cadastro_participante,
    // `papel` é `TEXT` sem enum no banco de dados gerado (CHECK, não domain
    // Postgres) -- a validação de valor já aconteceu na entrada (T2 CHECK +
    // T3 Zod), então o cast aqui só reafirma o tipo pro TS, não valida de novo.
    papel: r.papel as "mentorado" | "mentor",
    nomeCompleto: r.nome_completo,
    siglaPartido: r.partido_parlamentar,
    siglaUf: r.estado_eleicao,
    nomeParlamentar: r.nome_parlamentar,
    email: r.email,
    telefone: r.telefone,
    nomeMentorPareado: r.id_contrato !== null ? (mentoresPareados.get(r.id_contrato) ?? null) : null,
    vinculadoTse: r.id_contrato !== null,
    statusCadastro: r.status_cadastro as "completo" | "incompleto" | "pendente_revisao",
    idContrato: r.id_contrato,
  }));

  return { linhas, total: count ?? 0 };
}

// -----------------------------------------------------------------------------
// buscarMetricasCadastroPll (T9) -- as 3 métricas do UploadPlanilhaCard
// (PLL-CP-04) + "Última importação: DD/MM/AAAA por ‹nome›", derivadas de
// fat_cadastro_participante. Vive aqui (mesmo arquivo das outras leituras da
// tabela) porque a página (T9) monta UploadPlanilhaCard com dado real, e não
// existe tabela de log de importação -- "última importação" é o
// MAX(importado_em) das próprias linhas de staging, mesmo raciocínio de
// "head: true" para as contagens (buscarPendencias, hub.ts).
// -----------------------------------------------------------------------------

export interface MetricasCadastroPll {
  participantesCadastrados: number;
  pendentesRevisao: number;
  comDadosIncompletos: number;
  ultimaImportacao: { data: string; nomeUsuario: string } | null;
}

async function contarPorStatus(
  client: SupabaseClient<Database>,
  filtro: { idProduto: number; idEdicao?: number },
  status: string
): Promise<number> {
  let query = client
    .from("fat_cadastro_participante")
    .select("id_cadastro_participante", { count: "exact", head: true })
    .eq("id_produto", filtro.idProduto)
    .eq("status_cadastro", status);
  if (filtro.idEdicao !== undefined) query = query.eq("id_edicao", filtro.idEdicao);
  const { error, count } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function buscarMetricasCadastroPll(
  client: SupabaseClient<Database>,
  filtro: { idProduto: number; idEdicao?: number }
): Promise<MetricasCadastroPll> {
  const [participantesCadastrados, pendentesRevisao, comDadosIncompletos] = await Promise.all([
    (async () => {
      let query = client
        .from("fat_cadastro_participante")
        .select("id_cadastro_participante", { count: "exact", head: true })
        .eq("id_produto", filtro.idProduto);
      if (filtro.idEdicao !== undefined) query = query.eq("id_edicao", filtro.idEdicao);
      const { error, count } = await query;
      if (error) throw error;
      return count ?? 0;
    })(),
    contarPorStatus(client, filtro, "pendente_revisao"),
    contarPorStatus(client, filtro, "incompleto"),
  ]);

  let queryUltima = client
    .from("fat_cadastro_participante")
    .select("importado_em, dim_usuario(nome)")
    .eq("id_produto", filtro.idProduto)
    .not("importado_em", "is", null)
    .order("importado_em", { ascending: false })
    .limit(1);
  if (filtro.idEdicao !== undefined) queryUltima = queryUltima.eq("id_edicao", filtro.idEdicao);
  const { data: ultimaLinha, error: erroUltima } = await queryUltima;
  if (erroUltima) throw erroUltima;

  const linhaUltima = (ultimaLinha ?? [])[0] as
    | { importado_em: string; dim_usuario: { nome: string } | null }
    | undefined;

  return {
    participantesCadastrados,
    pendentesRevisao,
    comDadosIncompletos,
    ultimaImportacao: linhaUltima
      ? { data: linhaUltima.importado_em, nomeUsuario: linhaUltima.dim_usuario?.nome ?? "—" }
      : null,
  };
}

// -----------------------------------------------------------------------------
// vincularParticipanteAoTse (T10) -- orquestra app.criar_mandato (existente,
// sem RPC nova -- AD-024, design.md Tech Decisions) e promove a linha de
// staging (PLL-CP-11): grava id_contrato/id_vinculo_tse resultantes.
//
// RetornoCriarMandato/criarMandato (rpc/mandato.ts:33-38,59-65) JÁ expõe
// idContrato de forma suficiente para esta chamada -- checado antes de codar
// (task Tools note); nenhum ajuste em mandato.ts foi necessário.
// -----------------------------------------------------------------------------

export interface ParametrosVincularParticipanteAoTse {
  idCadastroParticipante: number;
  idProduto: number;
  idEdicao?: number | null;
  candidatura: CandidaturaParaConfirmar;
  contratante?: ContratanteInput;
  mandato?: MandatoInput;
  /** PLL-CP-12 (trocar vínculo): mesmo contratante já existente -- omite
   * contratante/mandato da chamada (mesmo padrão de mandato-wizard.tsx
   * `submeter`), preservando o histórico em rel_mandato_candidatura que
   * app.criar_mandato já garante para esse caso. */
  idContratanteExistente?: number;
}

/** rel_edicao_mentor da edição -- pool de mentores padrão aplicado ao novo
 * contrato (sessão 22/09, app.criar_mandato(p_mentores_padrao)). */
async function buscarPoolMentoresDaEdicao(
  client: SupabaseClient<Database>,
  idEdicao: number
): Promise<number[]> {
  const { data, error } = await client.from("rel_edicao_mentor").select("id_usuario").eq("id_edicao", idEdicao);
  if (error) throw error;
  return (data ?? []).map((r) => r.id_usuario);
}

export async function vincularParticipanteAoTse(
  client: SupabaseClient<Database>,
  params: ParametrosVincularParticipanteAoTse
): Promise<MandatoCriado> {
  const [edicao, mentoresPadrao] = await Promise.all([
    params.idEdicao
      ? client.from("fat_edicao").select("id_projeto").eq("id_edicao", params.idEdicao).single()
      : Promise.resolve({ data: null, error: null }),
    params.idEdicao ? buscarPoolMentoresDaEdicao(client, params.idEdicao) : Promise.resolve([]),
  ]);
  if (edicao.error) throw edicao.error;

  const resultado = await criarMandato(client, {
    contratante: params.idContratanteExistente ? undefined : params.contratante,
    mandato: params.idContratanteExistente ? undefined : params.mandato,
    candidatura: params.candidatura,
    idContratanteExistente: params.idContratanteExistente,
    contrato: {
      id_produto: params.idProduto,
      id_projeto: edicao.data?.id_projeto ?? null,
      dt_inicio: new Date().toISOString().slice(0, 10),
    },
    mentoresPadrao,
  });

  const { error } = await client
    .from("fat_cadastro_participante")
    .update({ id_contrato: resultado.idContrato, id_vinculo_tse: resultado.idVinculoTse })
    .eq("id_cadastro_participante", params.idCadastroParticipante);
  if (error) throw error;

  return resultado;
}

// -----------------------------------------------------------------------------
// atualizarCamposEditaveisParticipante (T16) -- UPDATE direto (sem RPC, mesma
// tabela -- design.md Tech Decisions) dos 8 campos editáveis no sistema
// (PLL-CP-20, PLL-CP-21, PLL-CP-24): desafios, destaques, ambição
// (texto+tags), SWOT (4 quadrantes). Assessor não tem GRANT nenhum na tabela
// (T2, fat-cadastro-participante-rls.integration.test.ts): a tentativa de
// escrita chega aqui como erro 42501, mapeado por mapeiaErroRpc em vez de
// propagar o objeto cru do PostgREST (mesmo racional de vincularParticipanteAoTse).
// -----------------------------------------------------------------------------

export interface CamposEditaveisParticipante {
  desafios?: string[];
  destaques?: string[];
  ambicaoTexto?: string | null;
  ambicaoTags?: string[];
  swotForcas?: string[];
  swotFraquezas?: string[];
  swotOportunidades?: string[];
  swotAmeacas?: string[];
}

/**
 * Atualiza QUALQUER subconjunto dos 8 campos editáveis, sem sobrescrever os
 * demais: só as chaves presentes em `campos` entram no `.update()` enviado
 * ao PostgREST -- uma chave ausente do objeto nunca vira `SET coluna = NULL`.
 */
export async function atualizarCamposEditaveisParticipante(
  client: SupabaseClient<Database>,
  idCadastroParticipante: number,
  campos: CamposEditaveisParticipante
): Promise<void> {
  type PayloadUpdate = Database["public"]["Tables"]["fat_cadastro_participante"]["Update"];
  const payload: PayloadUpdate = {};
  if (campos.desafios !== undefined) payload.desafios = campos.desafios;
  if (campos.destaques !== undefined) payload.destaques = campos.destaques;
  if (campos.ambicaoTexto !== undefined) payload.ambicao_texto = campos.ambicaoTexto;
  if (campos.ambicaoTags !== undefined) payload.ambicao_tags = campos.ambicaoTags;
  if (campos.swotForcas !== undefined) payload.swot_forcas = campos.swotForcas;
  if (campos.swotFraquezas !== undefined) payload.swot_fraquezas = campos.swotFraquezas;
  if (campos.swotOportunidades !== undefined) payload.swot_oportunidades = campos.swotOportunidades;
  if (campos.swotAmeacas !== undefined) payload.swot_ameacas = campos.swotAmeacas;

  if (Object.keys(payload).length === 0) return;

  const { error } = await client
    .from("fat_cadastro_participante")
    .update(payload)
    .eq("id_cadastro_participante", idCadastroParticipante);
  if (error) throw mapeiaErroRpc(error);
}
