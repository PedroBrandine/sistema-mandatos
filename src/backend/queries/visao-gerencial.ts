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

export interface FiltroCarteiraPonderada {
  papel: "gestora" | "mentor";
  idProduto?: number;
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
export async function buscarCarteiraPonderada(
  client: SupabaseClient<Database>,
  filtro: FiltroCarteiraPonderada
): Promise<LinhaCarteiraPonderada[]> {
  const { data: usuariosData, error: erroUsuarios } = await client
    .from("dim_usuario")
    .select("id_usuario, nome")
    .eq("papel_global", filtro.papel);
  if (erroUsuarios) throw erroUsuarios;
  const usuarios = (usuariosData ?? []) as RowUsuarioPapelGlobal[];

  let query = client
    .from("vw_carteira_ponderada")
    .select("id_usuario, nome_usuario, peso, pct_atingimento")
    .eq("papel_no_contrato", filtro.papel);
  if (filtro.idProduto !== undefined) {
    query = query.eq("id_produto", filtro.idProduto);
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

export interface FiltroCicloEtapa {
  idProduto?: number;
  idGestora?: number;
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
export async function buscarCicloEtapa(
  client: SupabaseClient<Database>,
  filtro?: FiltroCicloEtapa
): Promise<LinhaCicloEtapa[]> {
  let queryEtapas = client.from("ref_etapa").select("id_etapa, nome, ordem").order("ordem", { ascending: true });
  if (filtro?.idProduto !== undefined) {
    queryEtapas = queryEtapas.eq("id_produto", filtro.idProduto);
  }
  const { data: etapasData, error: erroEtapas } = await queryEtapas;
  if (erroEtapas) throw erroEtapas;
  const etapas = (etapasData ?? []) as RowRefEtapa[];
  if (etapas.length === 0) return [];

  let queryCiclo = client.from("vw_ciclo_etapa").select("id_etapa, dias_ciclo");
  if (filtro?.idProduto !== undefined) {
    queryCiclo = queryCiclo.eq("id_produto", filtro.idProduto);
  }
  if (filtro?.idGestora !== undefined) {
    queryCiclo = queryCiclo.eq("id_usuario_gestora", filtro.idGestora);
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
