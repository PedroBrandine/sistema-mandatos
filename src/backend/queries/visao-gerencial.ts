import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

// Filtro compartilhado da barra de recorte (visao-gerencial-g3-g6,
// design.md "Data Models") -- toda função nova de T9 em diante recebe este
// shape único, nunca um filtro ad-hoc próprio (spec.md GER-01/GER-09:
// "nenhum bloco com filtro próprio contraditório"). mesesEvolucao é o
// filtro Período -- controla só o range dos gráficos de evolução exibidos
// no frontend, nunca reprocessa as views *_mensal (que sempre trazem os 12
// meses fixos, context.md "Filtro Período").
export interface FiltroRecorte {
  idProduto?: number;
  idProjeto?: number;
  idGestora?: number;
  idMentor?: number;
  mesesEvolucao?: number;
}

// Formas de leitura (view-models client-side) definidas verbatim conforme
// design.md (## Data Models -- src/backend/queries/visao-gerencial.ts).
export interface LinhaCarteiraPonderada {
  idUsuario: number;
  nomeUsuario: string;
  somaPeso: number;
  qtdContratos: number;
  qtdContratosSemPeso: number; // peso NULL -- lacuna de seed, excluído da soma
  atingimentoMedio: number | null;
}

interface RowCarteiraPonderada {
  id_usuario: number | null;
  nome_usuario: string | null;
  peso: number | null;
  pct_atingimento: number | null;
}

interface RowUsuarioPapelGlobal {
  id_usuario: number;
  nome: string;
}

interface AcumuladorCarteira {
  nomeUsuario: string;
  somaPeso: number;
  qtdContratos: number;
  qtdContratosSemPeso: number;
  somaAtingimento: number;
  qtdAtingimento: number;
}

function acumuladorVazio(nomeUsuario: string): AcumuladorCarteira {
  return { nomeUsuario, somaPeso: 0, qtdContratos: 0, qtdContratosSemPeso: 0, somaAtingimento: 0, qtdAtingimento: 0 };
}

// GG-05, GG-06. dim_usuario.papel_global é o backbone (mesmo papel de
// ref_etapa em buscarCicloEtapa/buscarBoardKanban): garante que toda pessoa
// com esse papel apareça no resultado, mesmo sem nenhum contrato ativo --
// somaPeso: 0, linha real, nunca omitida (spec.md Edge Cases). vw_carteira_
// ponderada já resolve id_etapa_atual IS NULL -> 1ª etapa do produto
// (COALESCE na própria view, T5) -- esta função só agrega, nunca reintroduz
// essa lógica. peso já vem NULL quando falta seed em ref_peso_etapa (LEFT
// JOIN da view); contratos assim são excluídos da soma e contados em
// qtdContratosSemPeso, nunca tratados como peso = 1 (spec.md Edge Cases).
//
// visao-gerencial-g3-g6, T11: `papel` é o alternador de exibição
// Gestora/Mentor de G1 (não um recorte -- design.md/context.md), separado do
// `filtro: FiltroRecorte` compartilhado com o resto da tela. idProjeto/
// idMentor entram via resolverIdsContratoDoRecorte (a view não expõe
// id_projeto), aplicados independente de `papel`.
export async function buscarCarteiraPonderada(
  client: SupabaseClient<Database>,
  papel: "gestora" | "mentor",
  filtro: FiltroRecorte = {}
): Promise<LinhaCarteiraPonderada[]> {
  const { data: usuariosData, error: erroUsuarios } = await client
    .from("dim_usuario")
    .select("id_usuario, nome")
    .eq("papel_global", papel);
  if (erroUsuarios) throw erroUsuarios;
  const usuarios = (usuariosData ?? []) as RowUsuarioPapelGlobal[];

  const idsContrato = await resolverIdsContratoDoRecorte(client, filtro);
  let query = client
    .from("vw_carteira_ponderada")
    .select("id_usuario, nome_usuario, peso, pct_atingimento")
    .eq("papel_no_contrato", papel);
  if (filtro.idProduto !== undefined) {
    query = query.eq("id_produto", filtro.idProduto);
  }
  if (idsContrato !== undefined) {
    query = query.in("id_contrato", idsContrato);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as RowCarteiraPonderada[];

  const porUsuario = new Map<number, AcumuladorCarteira>();

  for (const usuario of usuarios) {
    porUsuario.set(usuario.id_usuario, acumuladorVazio(usuario.nome));
  }

  for (const row of rows) {
    if (row.id_usuario === null) continue;

    const acc = porUsuario.get(row.id_usuario) ?? acumuladorVazio(row.nome_usuario ?? "");

    acc.qtdContratos += 1;
    if (row.peso === null) {
      acc.qtdContratosSemPeso += 1;
    } else {
      acc.somaPeso += row.peso;
    }
    if (row.pct_atingimento !== null) {
      acc.somaAtingimento += row.pct_atingimento;
      acc.qtdAtingimento += 1;
    }

    porUsuario.set(row.id_usuario, acc);
  }

  return Array.from(porUsuario.entries()).map(([idUsuario, acc]) => ({
    idUsuario,
    nomeUsuario: acc.nomeUsuario,
    somaPeso: acc.somaPeso,
    qtdContratos: acc.qtdContratos,
    qtdContratosSemPeso: acc.qtdContratosSemPeso,
    atingimentoMedio: acc.qtdAtingimento > 0 ? acc.somaAtingimento / acc.qtdAtingimento : null,
  }));
}

export interface LinhaCicloEtapa {
  idEtapa: number;
  nomeEtapa: string;
  ordem: number;
  mediana: number | null; // null = amostra vazia (AD-005, nunca 0)
  amostra: number;
}

interface RowRefEtapa {
  id_etapa: number;
  nome: string;
  ordem: number;
}

interface RowCicloEtapa {
  id_etapa: number | null;
  dias_ciclo: number | null;
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0 ? (ordenados[meio - 1] + ordenados[meio]) / 2 : ordenados[meio];
}

// GG-03, GG-04. ref_etapa é a "forma" do resultado (mesmo padrão de
// buscarBoardKanban) -- garante que toda etapa apareça, mesmo sem nenhuma
// ocorrência concluída ainda (mediana: null, amostra: 0), nunca omitindo a
// etapa nem mostrando 0 (spec.md P1 G2 AC3). vw_ciclo_etapa (já filtrada a
// status = 'concluida' na própria view) fornece as amostras de dias_ciclo;
// filtro por produto/Gestora restringe a amostra sem misturar outro
// produto/Gestora na mesma mediana (AC2).
//
// visao-gerencial-g3-g6, T11: filtro passa a ser FiltroRecorte compartilhado
// -- idProjeto/idMentor entram via resolverIdsContratoDoRecorte (vw_ciclo_etapa
// expõe id_contrato, permite .in()).
export async function buscarCicloEtapa(
  client: SupabaseClient<Database>,
  filtro?: FiltroRecorte
): Promise<LinhaCicloEtapa[]> {
  let queryEtapas = client.from("ref_etapa").select("id_etapa, nome, ordem").order("ordem", { ascending: true });
  if (filtro?.idProduto !== undefined) {
    queryEtapas = queryEtapas.eq("id_produto", filtro.idProduto);
  }
  const { data: etapasData, error: erroEtapas } = await queryEtapas;
  if (erroEtapas) throw erroEtapas;
  const etapas = (etapasData ?? []) as RowRefEtapa[];
  if (etapas.length === 0) return [];

  const idsContrato = await resolverIdsContratoDoRecorte(client, filtro ?? {});
  let queryCiclo = client.from("vw_ciclo_etapa").select("id_etapa, dias_ciclo");
  if (filtro?.idProduto !== undefined) {
    queryCiclo = queryCiclo.eq("id_produto", filtro.idProduto);
  }
  if (filtro?.idGestora !== undefined) {
    queryCiclo = queryCiclo.eq("id_usuario_gestora", filtro.idGestora);
  }
  if (idsContrato !== undefined) {
    queryCiclo = queryCiclo.in("id_contrato", idsContrato);
  }
  const { data: ciclosData, error: erroCiclo } = await queryCiclo;
  if (erroCiclo) throw erroCiclo;
  const ciclos = (ciclosData ?? []) as RowCicloEtapa[];

  const diasPorEtapa = new Map<number, number[]>();
  for (const row of ciclos) {
    if (row.id_etapa === null || row.dias_ciclo === null) continue;
    const lista = diasPorEtapa.get(row.id_etapa) ?? [];
    lista.push(row.dias_ciclo);
    diasPorEtapa.set(row.id_etapa, lista);
  }

  return etapas.map((e) => {
    const dias = diasPorEtapa.get(e.id_etapa) ?? [];
    return {
      idEtapa: e.id_etapa,
      nomeEtapa: e.nome,
      ordem: e.ordem,
      mediana: mediana(dias),
      amostra: dias.length,
    };
  });
}

// Resolve o conjunto de id_contrato que casam com o recorte (produto/
// projeto/Gestora/Mentor) -- undefined significa "sem filtro de contrato",
// nunca "nenhum contrato" (T9-T17 tratam undefined como "não aplicar .in()").
// Gestora + Mentor combinam por E lógico, só vínculo ATIVO (dt_fim IS NULL)
// -- decisão de context.md, "Combinação Gestora + Mentor no filtro". Não
// reusa vw_carteira (só expõe nome_produto/nome_projeto, não os ids) --
// lê fat_contrato/rel_usuario_contrato direto, RLS já escopa.
async function resolverIdsContratoDoRecorte(
  client: SupabaseClient<Database>,
  filtro: FiltroRecorte
): Promise<number[] | undefined> {
  if (
    filtro.idProduto === undefined &&
    filtro.idProjeto === undefined &&
    filtro.idGestora === undefined &&
    filtro.idMentor === undefined
  ) {
    return undefined;
  }

  // `ids === null` representa "nenhuma restrição aplicada ainda" (distinto
  // de Set vazio, que representa "restrição aplicada, zero contratos
  // casam") -- cada filtro presente faz uma interseção real com o que já
  // foi restringido, nunca começa de um conjunto vazio quando esse filtro
  // específico simplesmente não foi pedido (achado real: consultar
  // fat_contrato incondicionalmente e interseccionar com ele zerava o
  // resultado inteiro quando só idGestora/idMentor eram passados, sem
  // idProduto/idProjeto).
  let ids: Set<number> | null = null;
  const interseccionar = (novos: Set<number>) => {
    ids = ids === null ? novos : new Set([...ids].filter((id) => novos.has(id)));
  };

  if (filtro.idProduto !== undefined || filtro.idProjeto !== undefined) {
    let queryContrato = client.from("fat_contrato").select("id_contrato");
    if (filtro.idProduto !== undefined) queryContrato = queryContrato.eq("id_produto", filtro.idProduto);
    if (filtro.idProjeto !== undefined) queryContrato = queryContrato.eq("id_projeto", filtro.idProjeto);
    const { data: contratosData, error: erroContratos } = await queryContrato;
    if (erroContratos) throw erroContratos;
    interseccionar(new Set((contratosData ?? []).map((c) => (c as { id_contrato: number }).id_contrato)));
  }

  const vinculos: Array<["gestora" | "mentor", number | undefined]> = [
    ["gestora", filtro.idGestora],
    ["mentor", filtro.idMentor],
  ];
  for (const [papel, idUsuario] of vinculos) {
    if (idUsuario === undefined) continue;
    const { data: vinculosData, error: erroVinculos } = await client
      .from("rel_usuario_contrato")
      .select("id_contrato")
      .eq("id_usuario", idUsuario)
      .eq("papel_no_contrato", papel)
      .is("dt_fim", null);
    if (erroVinculos) throw erroVinculos;
    interseccionar(new Set((vinculosData ?? []).map((v) => (v as { id_contrato: number }).id_contrato)));
  }

  return [...(ids ?? new Set<number>())];
}

export interface SaudeCobertura {
  pctCobertura: number | null; // null = 0 contrato ativo no recorte (AD-005)
  qtdSemRegistro: number;
  qtdEtapasSemRegistro: number;
  evolucaoMensal: { mes: string; pct: number | null }[];
}

interface RowContratoAtivo {
  id_contrato: number;
}

interface RowEtapaConcluida {
  id_contrato: number;
  dt_inicio: string;
  dt_conclusao: string | null;
}

interface RowRegistroData {
  id_contrato: number;
  ocorrido_em: string;
}

interface RowCoberturaMensal {
  mes_referencia: string;
  id_contrato: number;
  id_produto: number;
  tem_registro: boolean;
}

function aplicarFiltroContrato<T extends { in: (coluna: string, valores: number[]) => T }>(
  query: T,
  idsContrato: number[] | undefined
): T {
  return idsContrato !== undefined ? query.in("id_contrato", idsContrato) : query;
}

// GER-07. Estado atual: % de contratos ativos no recorte com registro nos
// últimos 45 dias (vw_pendencias categoria sem_registro_recente já aplica a
// janela -- não replicar o limiar aqui, AD-004), contagem absoluta sem
// registro, e etapas concluídas sem nenhum fat_registro dentro do período da
// etapa (agregação em TS, mesmo padrão do resto do arquivo). Evolução:
// vw_cobertura_registro_mensal (grão fino por contrato), agregada em TS
// depois de aplicar o mesmo filtro de recorte -- nunca lida já agregada por
// mês (armadilha documentada em buscarCicloEtapa).
export async function buscarSaudeCobertura(
  client: SupabaseClient<Database>,
  filtro: FiltroRecorte
): Promise<SaudeCobertura> {
  const idsContrato = await resolverIdsContratoDoRecorte(client, filtro);

  const { data: ativosData, error: erroAtivos } = await aplicarFiltroContrato(
    client.from("fat_contrato").select("id_contrato").eq("status", "ativo"),
    idsContrato
  );
  if (erroAtivos) throw erroAtivos;
  const qtdAtivos = ((ativosData ?? []) as RowContratoAtivo[]).length;

  const { data: semRegistroData, error: erroSemRegistro } = await aplicarFiltroContrato(
    client.from("vw_pendencias").select("id_contrato").eq("categoria", "sem_registro_recente"),
    idsContrato
  );
  if (erroSemRegistro) throw erroSemRegistro;
  const qtdSemRegistro = ((semRegistroData ?? []) as RowContratoAtivo[]).length;

  const { data: etapasData, error: erroEtapas } = await aplicarFiltroContrato(
    client.from("vw_etapa_contrato").select("id_contrato, dt_inicio, dt_conclusao").eq("status", "concluida"),
    idsContrato
  );
  if (erroEtapas) throw erroEtapas;
  const etapasConcluidas = (etapasData ?? []) as RowEtapaConcluida[];

  const idsContratoComEtapa = [...new Set(etapasConcluidas.map((e) => e.id_contrato))];
  let registros: RowRegistroData[] = [];
  if (idsContratoComEtapa.length > 0) {
    const { data: registrosData, error: erroRegistros } = await client
      .from("fat_registro")
      .select("id_contrato, ocorrido_em")
      .in("id_contrato", idsContratoComEtapa);
    if (erroRegistros) throw erroRegistros;
    registros = (registrosData ?? []) as RowRegistroData[];
  }
  const qtdEtapasSemRegistro = etapasConcluidas.filter(
    (etapa) =>
      !registros.some(
        (r) =>
          r.id_contrato === etapa.id_contrato &&
          r.ocorrido_em >= etapa.dt_inicio &&
          (etapa.dt_conclusao === null || r.ocorrido_em <= etapa.dt_conclusao)
      )
  ).length;

  const { data: mensalData, error: erroMensal } = await aplicarFiltroContrato(
    client.from("vw_cobertura_registro_mensal").select("mes_referencia, id_contrato, id_produto, tem_registro"),
    idsContrato
  );
  if (erroMensal) throw erroMensal;
  const linhasMensal = (mensalData ?? []) as RowCoberturaMensal[];
  const linhasFiltradas =
    filtro.idProduto !== undefined ? linhasMensal.filter((l) => l.id_produto === filtro.idProduto) : linhasMensal;

  const porMes = new Map<string, { ativos: number; comRegistro: number }>();
  for (const linha of linhasFiltradas) {
    const acc = porMes.get(linha.mes_referencia) ?? { ativos: 0, comRegistro: 0 };
    acc.ativos += 1;
    if (linha.tem_registro) acc.comRegistro += 1;
    porMes.set(linha.mes_referencia, acc);
  }
  const evolucaoMensal = [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, acc]) => ({
      mes,
      pct: acc.ativos > 0 ? Math.round((acc.comRegistro / acc.ativos) * 10000) / 100 : null,
    }));

  return {
    pctCobertura: qtdAtivos > 0 ? Math.round(((qtdAtivos - qtdSemRegistro) / qtdAtivos) * 10000) / 100 : null,
    qtdSemRegistro,
    qtdEtapasSemRegistro,
    evolucaoMensal,
  };
}

export interface SaudeFormularios {
  porFormulario: { idFormulario: number; nomeFormulario: string; taxaResposta: number | null }[];
  qtdAbertosMais30Dias: number;
  evolucaoMensal: { mes: string; taxaMedia: number | null }[];
}

interface RowRespostaFormulario {
  id_formulario: number;
  nome_formulario: string;
  respondido: boolean;
}

interface RowRespostaFormularioMensal {
  mes_referencia: string;
  id_contrato: number;
  id_produto: number;
  tem_resposta: boolean;
}

// GER-08. Estado atual: taxa de resposta por formulário (agregação em TS,
// mesmo padrão de buscarCarteiraPonderada), ordenada pela taxa decrescente;
// contagem de "abertos há mais de 30 dias" vem só de vw_pendencias (categoria
// formulario_aberto já aplica o limiar -- não replicar, AD-004). Evolução:
// vw_resposta_formulario_mensal (grão fino), agregada em TS.
export async function buscarSaudeFormularios(
  client: SupabaseClient<Database>,
  filtro: FiltroRecorte
): Promise<SaudeFormularios> {
  const idsContrato = await resolverIdsContratoDoRecorte(client, filtro);

  const { data: respostaData, error: erroResposta } = await aplicarFiltroContrato(
    client.from("vw_resposta_formulario").select("id_formulario, nome_formulario, respondido"),
    idsContrato
  );
  if (erroResposta) throw erroResposta;
  const linhasResposta = (respostaData ?? []) as RowRespostaFormulario[];

  const porFormularioMap = new Map<number, { nome: string; total: number; respondidas: number }>();
  for (const linha of linhasResposta) {
    const acc = porFormularioMap.get(linha.id_formulario) ?? {
      nome: linha.nome_formulario,
      total: 0,
      respondidas: 0,
    };
    acc.total += 1;
    if (linha.respondido) acc.respondidas += 1;
    porFormularioMap.set(linha.id_formulario, acc);
  }
  const porFormulario = [...porFormularioMap.entries()]
    .map(([idFormulario, acc]) => ({
      idFormulario,
      nomeFormulario: acc.nome,
      taxaResposta: acc.total > 0 ? Math.round((acc.respondidas / acc.total) * 10000) / 100 : null,
    }))
    .sort((a, b) => (b.taxaResposta ?? -1) - (a.taxaResposta ?? -1));

  const { data: pendenciasData, error: erroPendencias } = await aplicarFiltroContrato(
    client.from("vw_pendencias").select("id_contrato").eq("categoria", "formulario_aberto"),
    idsContrato
  );
  if (erroPendencias) throw erroPendencias;
  const qtdAbertosMais30Dias = ((pendenciasData ?? []) as RowContratoAtivo[]).length;

  const { data: mensalData, error: erroMensal } = await aplicarFiltroContrato(
    client.from("vw_resposta_formulario_mensal").select("mes_referencia, id_contrato, id_produto, tem_resposta"),
    idsContrato
  );
  if (erroMensal) throw erroMensal;
  const linhasMensal = (mensalData ?? []) as RowRespostaFormularioMensal[];
  const linhasMensalFiltradas =
    filtro.idProduto !== undefined ? linhasMensal.filter((l) => l.id_produto === filtro.idProduto) : linhasMensal;

  const porMes = new Map<string, { total: number; respondidas: number }>();
  for (const linha of linhasMensalFiltradas) {
    const acc = porMes.get(linha.mes_referencia) ?? { total: 0, respondidas: 0 };
    acc.total += 1;
    if (linha.tem_resposta) acc.respondidas += 1;
    porMes.set(linha.mes_referencia, acc);
  }
  const evolucaoMensal = [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, acc]) => ({
      mes,
      taxaMedia: acc.total > 0 ? Math.round((acc.respondidas / acc.total) * 10000) / 100 : null,
    }));

  return { porFormulario, qtdAbertosMais30Dias, evolucaoMensal };
}

export interface PontoEvolucaoGestora {
  mes: string;
  somaPeso: number;
}

export interface SerieEvolucaoGestora {
  idUsuarioGestora: number | null; // null = série agregada "Outras"
  nomeGestora: string;
  pontos: PontoEvolucaoGestora[];
}

interface RowCarteiraPonderadaMensal {
  mes_referencia: string;
  id_usuario_gestora: number;
  nome_gestora: string;
  id_produto: number;
  id_contrato: number;
  peso: number | null;
}

const MAX_SERIES_EVOLUCAO_GESTORA = 8;

// GER-12. G1 é indicador derivado (Constituição §2.6) -- vw_carteira_
// ponderada_mensal (T4) já reconstrói "como estava no fim de cada mês" via
// generate_series; esta função só agrega em TS por Gestora, mesmo padrão de
// buscarCarteiraPonderada. peso NULL (lacuna de seed) é excluído da soma,
// nunca tratado como peso = 1. Mais de 8 Gestoras -> excedente agrupado em
// "Outras" (spec.md Edge Cases), ranqueadas pelo total somado nos 12 meses.
export async function buscarCarteiraPonderadaMensal(
  client: SupabaseClient<Database>,
  filtro: FiltroRecorte
): Promise<SerieEvolucaoGestora[]> {
  const idsContrato = await resolverIdsContratoDoRecorte(client, filtro);
  let query = client
    .from("vw_carteira_ponderada_mensal")
    .select("mes_referencia, id_usuario_gestora, nome_gestora, id_produto, id_contrato, peso");
  if (filtro.idProduto !== undefined) query = query.eq("id_produto", filtro.idProduto);
  if (idsContrato !== undefined) query = query.in("id_contrato", idsContrato);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as RowCarteiraPonderadaMensal[];

  const meses = [...new Set(rows.map((r) => r.mes_referencia))].sort((a, b) => a.localeCompare(b));

  const porGestora = new Map<number, { nome: string; total: number; porMes: Map<string, number> }>();
  for (const row of rows) {
    if (row.peso === null) continue;
    const acc = porGestora.get(row.id_usuario_gestora) ?? {
      nome: row.nome_gestora,
      total: 0,
      porMes: new Map<string, number>(),
    };
    acc.total += row.peso;
    acc.porMes.set(row.mes_referencia, (acc.porMes.get(row.mes_referencia) ?? 0) + row.peso);
    porGestora.set(row.id_usuario_gestora, acc);
  }

  const gestorasOrdenadas = [...porGestora.entries()].sort(([, a], [, b]) => b.total - a.total);
  const principais = gestorasOrdenadas.slice(0, MAX_SERIES_EVOLUCAO_GESTORA);
  const excedentes = gestorasOrdenadas.slice(MAX_SERIES_EVOLUCAO_GESTORA);

  const series: SerieEvolucaoGestora[] = principais.map(([idUsuarioGestora, acc]) => ({
    idUsuarioGestora,
    nomeGestora: acc.nome,
    pontos: meses.map((mes) => ({ mes, somaPeso: acc.porMes.get(mes) ?? 0 })),
  }));

  if (excedentes.length > 0) {
    const porMesOutras = new Map<string, number>();
    for (const [, acc] of excedentes) {
      for (const [mes, valor] of acc.porMes) {
        porMesOutras.set(mes, (porMesOutras.get(mes) ?? 0) + valor);
      }
    }
    series.push({
      idUsuarioGestora: null,
      nomeGestora: "Outras",
      pontos: meses.map((mes) => ({ mes, somaPeso: porMesOutras.get(mes) ?? 0 })),
    });
  }

  return series;
}

export interface LinhaDistribuicaoEtapa {
  idEtapa: number;
  nomeEtapa: string;
  ordem: number;
  qtdAtiva: number;
  qtdAtrasada: number;
}

interface RowRefEtapaDistribuicao {
  id_etapa: number;
  nome: string;
  ordem: number;
}

interface RowEtapaAtual {
  id_etapa: number;
  id_contrato: number;
  esta_atrasada: boolean;
}

// GER-10 (Bloco 1). ref_etapa é o backbone (mesmo padrão de buscarCicloEtapa/
// buscarBoardKanban) -- garante que toda etapa do produto apareça, mesmo com
// qtdAtiva: 0, nunca omitida; ordenação é sempre por ref_etapa.ordem, nunca
// pelo volume. "Etapa atual" = linha de vw_etapa_contrato com status =
// 'em_andamento' (a única aberta por contrato, AD-013). Restrito a contrato
// com fat_contrato.status = 'ativo' -- etapa 'em_andamento' de um contrato
// já encerrado não deveria existir, mas a leitura não assume isso.
export async function buscarDistribuicaoEtapas(
  client: SupabaseClient<Database>,
  filtro: FiltroRecorte
): Promise<LinhaDistribuicaoEtapa[]> {
  let queryEtapas = client.from("ref_etapa").select("id_etapa, nome, ordem").order("ordem", { ascending: true });
  if (filtro.idProduto !== undefined) queryEtapas = queryEtapas.eq("id_produto", filtro.idProduto);
  const { data: etapasData, error: erroEtapas } = await queryEtapas;
  if (erroEtapas) throw erroEtapas;
  const etapas = (etapasData ?? []) as RowRefEtapaDistribuicao[];
  if (etapas.length === 0) return [];

  const idsContrato = await resolverIdsContratoDoRecorte(client, filtro);
  const { data: ativosData, error: erroAtivos } = await aplicarFiltroContrato(
    client.from("fat_contrato").select("id_contrato").eq("status", "ativo"),
    idsContrato
  );
  if (erroAtivos) throw erroAtivos;
  const idsAtivos = new Set(((ativosData ?? []) as RowContratoAtivo[]).map((c) => c.id_contrato));

  const { data: atualData, error: erroAtual } = await aplicarFiltroContrato(
    client.from("vw_etapa_contrato").select("id_etapa, id_contrato, esta_atrasada").eq("status", "em_andamento"),
    idsContrato
  );
  if (erroAtual) throw erroAtual;
  const atuais = ((atualData ?? []) as RowEtapaAtual[]).filter((row) => idsAtivos.has(row.id_contrato));

  const porEtapa = new Map<number, { ativa: number; atrasada: number }>();
  for (const row of atuais) {
    const acc = porEtapa.get(row.id_etapa) ?? { ativa: 0, atrasada: 0 };
    acc.ativa += 1;
    if (row.esta_atrasada) acc.atrasada += 1;
    porEtapa.set(row.id_etapa, acc);
  }

  return etapas.map((e) => {
    const acc = porEtapa.get(e.id_etapa) ?? { ativa: 0, atrasada: 0 };
    return { idEtapa: e.id_etapa, nomeEtapa: e.nome, ordem: e.ordem, qtdAtiva: acc.ativa, qtdAtrasada: acc.atrasada };
  });
}

export interface LinhaAtingimento {
  nome: string;
  pctMedio: number | null;
}

export interface AtingimentoPorRecorte {
  porProduto: LinhaAtingimento[];
  porProjeto: LinhaAtingimento[];
  qtdDesatualizados: number;
  qtdSmNaoAtualizadosMesCorrente: number;
}

interface RowCarteiraAtingimento {
  id_contrato: number;
  nome_produto: string;
  nome_projeto: string | null;
  pct_atingimento: number | null;
  atingimento_desatualizado: boolean;
}

function agruparAtingimento(linhas: RowCarteiraAtingimento[], porChave: (l: RowCarteiraAtingimento) => string | null) {
  const acc = new Map<string, { soma: number; qtd: number }>();
  for (const linha of linhas) {
    const chave = porChave(linha);
    if (chave === null || linha.pct_atingimento === null) continue;
    const a = acc.get(chave) ?? { soma: 0, qtd: 0 };
    a.soma += linha.pct_atingimento;
    a.qtd += 1;
    acc.set(chave, a);
  }
  return [...acc.entries()]
    .map(([nome, a]) => ({ nome, pctMedio: a.qtd > 0 ? Math.round((a.soma / a.qtd) * 100) / 100 : null }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

// GER-14, GER-16. vw_carteira filtrada a papel_no_contrato = 'gestora' -- 1
// linha por contrato (mesma convenção já usada por vw_pendencias pra
// resolver a Gestora do contrato; um contrato com 2 gestoras simultâneas
// duplicaria a média, risco aceito, não é regra nova desta função).
// atingimento_desatualizado contado à parte do agregado (spec.md: "o número
// agregado não pode fingir estar fresco"). Contagem de SM não atualizados no
// mês corrente: cadeia dim_planejamento -> fat_objetivo_especifico ->
// fat_meta -> fat_sucesso_mensal (sem view própria -- mesmo padrão já aceito
// pra "etapas concluídas sem registro" em buscarSaudeCobertura, fonte
// explícita do pedido original).
export async function buscarAtingimentoPorRecorte(
  client: SupabaseClient<Database>,
  filtro: FiltroRecorte
): Promise<AtingimentoPorRecorte> {
  const idsContrato = await resolverIdsContratoDoRecorte(client, filtro);

  let queryCarteira = client
    .from("vw_carteira")
    .select("id_contrato, nome_produto, nome_projeto, pct_atingimento, atingimento_desatualizado")
    .eq("papel_no_contrato", "gestora");
  // vw_carteira não expõe id_produto (só nome_produto) -- o filtro de
  // produto já chega via idsContrato (resolverIdsContratoDoRecorte lê
  // fat_contrato.id_produto), sem precisar de coluna própria aqui.
  if (idsContrato !== undefined) queryCarteira = queryCarteira.in("id_contrato", idsContrato);
  const { data: carteiraData, error: erroCarteira } = await queryCarteira;
  if (erroCarteira) throw erroCarteira;
  const linhas = (carteiraData ?? []) as RowCarteiraAtingimento[];

  const porProduto = agruparAtingimento(linhas, (l) => l.nome_produto);
  const porProjeto = agruparAtingimento(linhas, (l) => l.nome_projeto);
  const qtdDesatualizados = linhas.filter((l) => l.atingimento_desatualizado).length;

  const mesCorrente = new Date();
  const mesCorrenteStr = `${mesCorrente.getFullYear()}-${String(mesCorrente.getMonth() + 1).padStart(2, "0")}-01`;

  const { data: planejamentoData, error: erroPlanejamento } = await aplicarFiltroContrato(
    client.from("dim_planejamento").select("id_planejamento"),
    idsContrato
  );
  if (erroPlanejamento) throw erroPlanejamento;
  const idsPlanejamento = ((planejamentoData ?? []) as { id_planejamento: number }[]).map((p) => p.id_planejamento);

  let qtdSmNaoAtualizadosMesCorrente = 0;
  if (idsPlanejamento.length > 0) {
    const { data: objetivosData, error: erroObjetivos } = await client
      .from("fat_objetivo_especifico")
      .select("id_objetivo")
      .in("id_planejamento", idsPlanejamento);
    if (erroObjetivos) throw erroObjetivos;
    const idsObjetivo = ((objetivosData ?? []) as { id_objetivo: number }[]).map((o) => o.id_objetivo);

    if (idsObjetivo.length > 0) {
      const { data: metasData, error: erroMetas } = await client
        .from("fat_meta")
        .select("id_meta")
        .in("id_objetivo", idsObjetivo);
      if (erroMetas) throw erroMetas;
      const idsMeta = ((metasData ?? []) as { id_meta: number }[]).map((m) => m.id_meta);

      if (idsMeta.length > 0) {
        const { data: smData, error: erroSm } = await client
          .from("fat_sucesso_mensal")
          .select("id_sucesso")
          .in("id_meta", idsMeta)
          .eq("status", "pendente")
          .eq("mes_referencia", mesCorrenteStr);
        if (erroSm) throw erroSm;
        qtdSmNaoAtualizadosMesCorrente = ((smData ?? []) as { id_sucesso: number }[]).length;
      }
    }
  }

  return { porProduto, porProjeto, qtdDesatualizados, qtdSmNaoAtualizadosMesCorrente };
}

export interface LinhaCompletudeCampo {
  campo: string;
  qtdContratos: number;
}

// Os 5 campos fixos que vw_pendencias categoria 'cadastro' checa (T1) --
// rótulo 'titulo_eleitoral' é o literal usado na view, não
// 'nr_titulo_eleitoral' (nome da coluna em dim_mandato).
const CAMPOS_CADASTRO = ["ds_genero", "ds_raca", "fl_pcd", "confianca", "titulo_eleitoral"] as const;

// GER-17. Os 5 campos sempre aparecem, mesmo com contagem 0 (backbone fixo,
// não derivado da presença de dado -- AD-005). Contrato de Coalizão nunca
// entra (já garantido pela view em T1, join contra dim_mandato não casa).
export async function buscarCompletudeCadastro(
  client: SupabaseClient<Database>,
  filtro: FiltroRecorte
): Promise<LinhaCompletudeCampo[]> {
  const idsContrato = await resolverIdsContratoDoRecorte(client, filtro);
  const { data, error } = await aplicarFiltroContrato(
    client.from("vw_pendencias").select("detalhe").eq("categoria", "cadastro"),
    idsContrato
  );
  if (error) throw error;
  const rows = (data ?? []) as { detalhe: string | null }[];

  const porCampo = new Map<string, number>();
  for (const row of rows) {
    if (row.detalhe === null) continue;
    porCampo.set(row.detalhe, (porCampo.get(row.detalhe) ?? 0) + 1);
  }

  return CAMPOS_CADASTRO.map((campo) => ({ campo, qtdContratos: porCampo.get(campo) ?? 0 }));
}

export interface LinhaDistribuicaoIip {
  nivel: string;
  qtdContratos: number;
}

export interface IipConsolidado {
  distribuicaoPorNivel: LinhaDistribuicaoIip[];
  valorMedio: number | null; // null = 0 contrato com fato gerador no recorte (AD-005)
  dtDadoMaisRecente: string | null; // TODO(D2)/proxy de frescor -- ver comentário da função
}

interface RowNivelIip {
  codigo: string;
  rotulo: string;
  valor: number;
  ordem: number;
}

interface RowIipContrato {
  id_contrato: number;
  iip_provisorio: number | null;
  dt_ultimo_fato: string | null;
}

// TODO(D2): aritmética final do IIP pendente com a área de conhecimento --
// iip_provisorio é lido tal como a materialized view calcula, nunca
// recalculado aqui (AD-014, a Incidência calcula, a Saída só lê).
//
// "Nível" não é uma FK direta em mv_iip_contrato (o campo é um score
// contínuo) -- bucketizado contra ref_nivel_iip pelo maior ordem cujo valor
// <= iip_provisorio (leitura padrão de tier/tabela de nível, também
// provisória enquanto D2 não fecha).
//
// dtDadoMaisRecente: Postgres não expõe em nenhum catálogo de sistema
// "quando esta materialized view foi atualizada pela última vez" -- não
// existe mecanismo nativo pra isso. MAX(dt_ultimo_fato) é o proxy mais
// próximo disponível hoje (data do fato mais recente já processado pela
// MV), não o timestamp exato do REFRESH. Rastrear o REFRESH de verdade
// exigiria uma tabela/coluna de metadado nova -- fora do escopo desta task.
export async function buscarIipConsolidado(
  client: SupabaseClient<Database>,
  filtro: FiltroRecorte
): Promise<IipConsolidado> {
  const idsContrato = await resolverIdsContratoDoRecorte(client, filtro);

  const { data: niveisData, error: erroNiveis } = await client
    .from("ref_nivel_iip")
    .select("codigo, rotulo, valor, ordem")
    .order("ordem", { ascending: true });
  if (erroNiveis) throw erroNiveis;
  const niveis = (niveisData ?? []) as RowNivelIip[];

  const { data: iipData, error: erroIip } = await aplicarFiltroContrato(
    client.from("mv_iip_contrato").select("id_contrato, iip_provisorio, dt_ultimo_fato"),
    idsContrato
  );
  if (erroIip) throw erroIip;
  const linhas = (iipData ?? []) as RowIipContrato[];

  const porNivel = new Map<string, number>(niveis.map((n) => [n.rotulo, 0]));
  let soma = 0;
  let qtd = 0;
  let dtMaisRecente: string | null = null;

  for (const linha of linhas) {
    if (linha.dt_ultimo_fato !== null && (dtMaisRecente === null || linha.dt_ultimo_fato > dtMaisRecente)) {
      dtMaisRecente = linha.dt_ultimo_fato;
    }
    if (linha.iip_provisorio === null) continue;
    soma += linha.iip_provisorio;
    qtd += 1;

    const nivelAplicavel = [...niveis].reverse().find((n) => (linha.iip_provisorio as number) >= n.valor);
    if (nivelAplicavel !== undefined) {
      porNivel.set(nivelAplicavel.rotulo, (porNivel.get(nivelAplicavel.rotulo) ?? 0) + 1);
    }
  }

  return {
    distribuicaoPorNivel: niveis.map((n) => ({ nivel: n.rotulo, qtdContratos: porNivel.get(n.rotulo) ?? 0 })),
    valorMedio: qtd > 0 ? Math.round((soma / qtd) * 100) / 100 : null,
    dtDadoMaisRecente: dtMaisRecente,
  };
}
