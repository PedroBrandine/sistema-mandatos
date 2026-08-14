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
