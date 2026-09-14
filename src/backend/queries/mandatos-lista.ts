import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

// EST-09 (T19, design.md "ListaMandatos" -- Interfaces: `buscarMandatos`).
// Nome final `buscarMandatosLista`/`ContratoCard`: reconcilia o genérico
// `buscarMandatos` de design.md com o nome explícito que T21b usa pra
// consumir esta função (`buscarMandatosLista`) -- mesmo tipo de reconciliação
// de nomes já feito em TIP-05/06/07 (commit 2e2ea36).
//
// Lê fat_contrato (nunca fat_prospeccao -- EST-04 AC5: prospecções não são
// contrato, não aparecem na lista de Mandatos) e enriquece com os nomes que
// o card do Figma 202:554 exige: contratante, gestora, projeto, etapa atual
// e responsável. "Responsável" = papel_no_contrato 'mentor' (vínculo ativo):
// o card já mostra "Gestão" (papel 'gestora') como campo próprio -- ver
// rel_usuario_contrato em docs/schema_sistema.sql (papéis gestora/mentor/
// assessor/leitura). Decisão registrada no Registro de execução da Fase 5,
// não há AC nem design.md que nomeie a origem literal do campo.
export interface ContratoCard {
  idContrato: number;
  nomeContratante: string;
  dtInicio: string;
  // null passa adiante sem conversão (AD-005) -- "--" é responsabilidade do
  // componente (ListaMandatos, T20), nunca da camada de leitura.
  dtFim: string | null;
  status: "ativo" | "concluido" | "nao_concluido";
  nomeGestora: string | null;
  nomeProjeto: string | null;
  nomeEtapaAtual: string | null;
  nomeResponsavel: string | null;
  // Ajuste de fidelidade visual -- Mandatos (2026-09-14, Figma 202:554,
  // rodapé "Atualizado há X dias"). fat_contrato.atualizado_em já existe no
  // schema aprovado (docs/schema_sistema.sql) e no banco provisionado
  // (database.types.ts) -- dado real, não inventado (não confundir com
  // dt_fim, que é vigência do contrato).
  atualizadoEm: string;
}

// Os 5 filtros do Figma 202:554 (EST-09 AC3): data, gestora, projeto, etapa,
// status. "Data" filtra por dt_inicio (data de início do contrato) num
// intervalo [de, ate] -- o Figma mostra dois seletores de calendário lado a
// lado na mesma faixa de "Período e gestão"; nenhum AC/design.md define qual
// data literalmente, decisão registrada no Registro de execução.
export interface FiltroMandatosLista {
  idProduto: number;
  dtInicioDe?: string;
  dtInicioAte?: string;
  idGestora?: number;
  idProjeto?: number;
  idEtapa?: number;
  status?: "ativo" | "concluido" | "nao_concluido";
}

interface RowContratoLista {
  id_contrato: number;
  id_contratante: number;
  id_projeto: number | null;
  id_etapa_atual: number | null;
  status: "ativo" | "concluido" | "nao_concluido";
  dt_inicio: string;
  dt_fim: string | null;
  atualizado_em: string;
}

interface RowNomeado {
  nome: string;
}

// dt_fim IS NULL OR dt_fim >= hoje -- mesmo padrão de filtroVinculoAtivo em
// queries/kanban.ts.
function filtroVinculoAtivo(): string {
  const hoje = new Date().toISOString().slice(0, 10);
  return `dt_fim.is.null,dt_fim.gte.${hoje}`;
}

// Restringe idsContrato aos que têm vínculo ativo com idUsuario naquele
// papel -- mesmo padrão de idsContratoPorPapelPessoa em queries/kanban.ts.
async function idsContratoPorGestora(
  client: SupabaseClient<Database>,
  idsContrato: number[],
  idUsuario: number
): Promise<number[]> {
  if (idsContrato.length === 0) return [];
  const { data, error } = await client
    .from("rel_usuario_contrato")
    .select("id_contrato")
    .in("id_contrato", idsContrato)
    .eq("id_usuario", idUsuario)
    .eq("papel_no_contrato", "gestora")
    .or(filtroVinculoAtivo());
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((v) => v.id_contrato)));
}

// Nome de quem exerce `papel` num vínculo ativo, por contrato -- 1 nome por
// contrato (o primeiro vínculo ativo daquele papel encontrado). Contrato sem
// vínculo ativo naquele papel devolve null, nunca lança (AD-005).
async function buscarPessoaAtivaPorPapel(
  client: SupabaseClient<Database>,
  idsContrato: number[],
  papel: "gestora" | "mentor"
): Promise<Map<number, string | null>> {
  const mapa = new Map<number, string | null>();
  if (idsContrato.length === 0) return mapa;

  const { data, error } = await client
    .from("rel_usuario_contrato")
    .select("id_contrato, dim_usuario(nome)")
    .in("id_contrato", idsContrato)
    .eq("papel_no_contrato", papel)
    .or(filtroVinculoAtivo());
  if (error) throw error;

  for (const linha of (data ?? []) as unknown as { id_contrato: number; dim_usuario: RowNomeado | null }[]) {
    if (!mapa.has(linha.id_contrato)) {
      mapa.set(linha.id_contrato, linha.dim_usuario?.nome ?? null);
    }
  }
  return mapa;
}

async function buscarNomesPorId(
  client: SupabaseClient<Database>,
  tabela: "dim_contratante" | "ref_projeto" | "ref_etapa",
  coluna: string,
  ids: number[]
): Promise<Map<number, string>> {
  const mapa = new Map<number, string>();
  if (ids.length === 0) return mapa;

  const { data, error } = await client.from(tabela).select(`${coluna}, nome`).in(coluna, ids);
  if (error) throw error;

  for (const linha of (data ?? []) as unknown as Record<string, unknown>[]) {
    mapa.set(linha[coluna] as number, linha.nome as string);
  }
  return mapa;
}

// EST-09 (T19). Lista os contratos (fat_contrato) do produto com os 5
// filtros do Figma, aplicados por AND (nunca OR) quando combinados -- mesmo
// espírito de resolverIdsContratoDoFiltro em queries/pendencias.ts.
export async function buscarMandatosLista(
  client: SupabaseClient<Database>,
  filtro: FiltroMandatosLista
): Promise<ContratoCard[]> {
  let query = client
    .from("fat_contrato")
    .select("id_contrato, id_contratante, id_projeto, id_etapa_atual, status, dt_inicio, dt_fim, atualizado_em")
    .eq("id_produto", filtro.idProduto);

  if (filtro.idProjeto !== undefined) query = query.eq("id_projeto", filtro.idProjeto);
  if (filtro.idEtapa !== undefined) query = query.eq("id_etapa_atual", filtro.idEtapa);
  if (filtro.status !== undefined) query = query.eq("status", filtro.status);
  if (filtro.dtInicioDe !== undefined) query = query.gte("dt_inicio", filtro.dtInicioDe);
  if (filtro.dtInicioAte !== undefined) query = query.lte("dt_inicio", filtro.dtInicioAte);

  const { data, error } = await query.order("dt_inicio", { ascending: false });
  if (error) throw error;

  let contratos = (data ?? []) as RowContratoLista[];
  if (contratos.length === 0) return [];

  if (filtro.idGestora !== undefined) {
    const idsGestora = new Set(
      await idsContratoPorGestora(
        client,
        contratos.map((c) => c.id_contrato),
        filtro.idGestora
      )
    );
    contratos = contratos.filter((c) => idsGestora.has(c.id_contrato));
    if (contratos.length === 0) return [];
  }

  const idsContrato = contratos.map((c) => c.id_contrato);
  const idsContratante = Array.from(new Set(contratos.map((c) => c.id_contratante)));
  const idsProjeto = Array.from(
    new Set(contratos.map((c) => c.id_projeto).filter((id): id is number => id !== null))
  );
  const idsEtapa = Array.from(
    new Set(contratos.map((c) => c.id_etapa_atual).filter((id): id is number => id !== null))
  );

  const [nomesContratante, nomesProjeto, nomesEtapa, gestorasPorContrato, responsaveisPorContrato] =
    await Promise.all([
      buscarNomesPorId(client, "dim_contratante", "id_contratante", idsContratante),
      buscarNomesPorId(client, "ref_projeto", "id_projeto", idsProjeto),
      buscarNomesPorId(client, "ref_etapa", "id_etapa", idsEtapa),
      buscarPessoaAtivaPorPapel(client, idsContrato, "gestora"),
      buscarPessoaAtivaPorPapel(client, idsContrato, "mentor"),
    ]);

  return contratos.map((c) => ({
    idContrato: c.id_contrato,
    nomeContratante: nomesContratante.get(c.id_contratante) ?? "",
    dtInicio: c.dt_inicio,
    dtFim: c.dt_fim,
    status: c.status,
    nomeGestora: gestorasPorContrato.get(c.id_contrato) ?? null,
    nomeProjeto: c.id_projeto !== null ? nomesProjeto.get(c.id_projeto) ?? null : null,
    nomeEtapaAtual: c.id_etapa_atual !== null ? nomesEtapa.get(c.id_etapa_atual) ?? null : null,
    nomeResponsavel: responsaveisPorContrato.get(c.id_contrato) ?? null,
    atualizadoEm: c.atualizado_em,
  }));
}
