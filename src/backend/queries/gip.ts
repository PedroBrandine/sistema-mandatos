import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P1: GIP
// conforme a metodologia vigente" (FMC-25, FMC-27, FMC-28). design.md,
// Components -> GipRegua/GipEvolucao. Leituras (view-models client-side)
// sobre o catálogo re-seedado (T11/T12, já aplicado em dev) -- nenhuma
// escrita aqui.

export type MomentoGip = "inicio" | "fim";

export interface NivelDimensaoGip {
  valor: number;
  descricao: string;
}

export interface DimensaoGipCatalogo {
  idDimensao: number;
  codigo: string;
  nome: string;
  ordem: number;
  valorMin: number;
  valorMax: number;
  /** Um nível por valor da faixa (Anexo A da spec), ordenado. */
  niveis: NivelDimensaoGip[];
  /** Valor já gravado nesta dimensão para o momento pedido -- `null` = ainda não respondido. */
  valorAtual: number | null;
}

export interface GipDoContrato {
  momento: MomentoGip;
  /** `true` quando já existe fat_gip para (id_contrato, momento) -- FMC-27 AC7. */
  aplicado: boolean;
  aplicadoEm: string | null;
  dimensoes: DimensaoGipCatalogo[];
}

// `eixo` de fat_gip_dimensao é o que trg_deriva_gip grava para O PRÓPRIO
// momento (A-09/AD-050): 'inicio' -> 'regua_sonhos', 'fim' -> 'onde_chegamos'.
// A linha de 'fim' também recebe uma CÓPIA de 'regua_sonhos' (D6, propagada
// pelo trigger só para vw_gip_evolucao encontrar os 2 eixos no mesmo id_gip)
// -- por isso o filtro por eixo aqui é obrigatório: sem ele, dois valores
// por dimensão apareceriam na linha de 'fim' e um sobrescreveria o outro
// silenciosamente.
function eixoDoMomento(momento: MomentoGip): "regua_sonhos" | "onde_chegamos" {
  return momento === "inicio" ? "regua_sonhos" : "onde_chegamos";
}

// FMC-25 AC3 (opções por nível), FMC-27 AC6/AC7 (momento aplicado, sem
// segundo envio). Dimensões e níveis vêm do catálogo (sempre presentes,
// re-seedado nas T11/T12); `aplicado`/`valorAtual` vêm de fat_gip/
// fat_gip_dimensao e nunca são confundidos com "sem dimensão nenhuma" --
// momento não aplicado é um booleano explícito, não uma lista vazia.
export async function buscarGipDoContrato(
  client: SupabaseClient<Database>,
  idContrato: number,
  momento: MomentoGip
): Promise<GipDoContrato> {
  const { data: dimensoesAtivas, error: erroDimensoes } = await client
    .from("ref_dimensao_gip")
    .select("id_dimensao, codigo, nome, ordem, valor_min, valor_max")
    .eq("ativo", true)
    .order("ordem", { ascending: true });
  if (erroDimensoes) throw erroDimensoes;

  const idsDimensao = (dimensoesAtivas ?? []).map((d) => d.id_dimensao);

  const { data: niveis, error: erroNiveis } =
    idsDimensao.length === 0
      ? { data: [] as { id_dimensao: number; valor: number; descricao: string }[], error: null }
      : await client
          .from("ref_nivel_dimensao_gip")
          .select("id_dimensao, valor, descricao")
          .in("id_dimensao", idsDimensao)
          .order("valor", { ascending: true });
  if (erroNiveis) throw erroNiveis;

  const { data: gip, error: erroGip } = await client
    .from("fat_gip")
    .select("id_gip, aplicado_em")
    .eq("id_contrato", idContrato)
    .eq("momento", momento)
    .maybeSingle();
  if (erroGip) throw erroGip;

  const valoresPorDimensao = new Map<number, number>();
  if (gip) {
    const { data: valores, error: erroValores } = await client
      .from("fat_gip_dimensao")
      .select("id_dimensao, valor")
      .eq("id_gip", gip.id_gip)
      .eq("eixo", eixoDoMomento(momento));
    if (erroValores) throw erroValores;
    for (const v of valores ?? []) valoresPorDimensao.set(v.id_dimensao, v.valor);
  }

  const niveisPorDimensao = new Map<number, NivelDimensaoGip[]>();
  for (const nivel of niveis ?? []) {
    const lista = niveisPorDimensao.get(nivel.id_dimensao) ?? [];
    lista.push({ valor: nivel.valor, descricao: nivel.descricao });
    niveisPorDimensao.set(nivel.id_dimensao, lista);
  }

  const dimensoes: DimensaoGipCatalogo[] = (dimensoesAtivas ?? []).map((d) => ({
    idDimensao: d.id_dimensao,
    codigo: d.codigo,
    nome: d.nome,
    ordem: d.ordem,
    valorMin: d.valor_min,
    valorMax: d.valor_max,
    niveis: niveisPorDimensao.get(d.id_dimensao) ?? [],
    valorAtual: valoresPorDimensao.get(d.id_dimensao) ?? null,
  }));

  return {
    momento,
    aplicado: gip !== null,
    aplicadoEm: gip?.aplicado_em ?? null,
    dimensoes,
  };
}

export interface LinhaEvolucaoGip {
  codigoDimensao: string;
  nomeDimensao: string;
  ordem: number;
  nivelInicio: number | null;
  nivelFim: number | null;
  /** vw_gip_evolucao.gap -- nunca recalculado no cliente (AD-003/AD-014). */
  gap: number | null;
}

// FMC-28 (AC8-AC11). vw_gip_evolucao tem 1 linha por (fat_gip, dimensão
// ativa) -- ou seja, até 2 linhas por dimensão (uma por momento aplicado).
// Só a linha de momento 'fim' carrega os DOIS eixos (regua_sonhos copiado +
// onde_chegamos próprio) e portanto o `gap` real; a linha de 'inicio'
// sempre tem onde_chegamos/gap NULL (ainda não existe leitura de Fim).
// Por isso a linha de 'fim' tem prioridade quando as duas existem, e a de
// 'inicio' serve só de fallback (dimensão com um único momento aplicado,
// AC10) -- nunca as duas juntas para a mesma dimensão.
export async function buscarEvolucaoGip(
  client: SupabaseClient<Database>,
  idContrato: number
): Promise<LinhaEvolucaoGip[]> {
  const { data, error } = await client
    .from("vw_gip_evolucao")
    .select("momento, dimensao, nome_dimensao, ordem, regua_sonhos, onde_chegamos, gap")
    .eq("id_contrato", idContrato)
    .order("ordem", { ascending: true });
  if (error) throw error;

  const porDimensao = new Map<string, LinhaEvolucaoGip>();
  for (const linha of data ?? []) {
    const codigo = linha.dimensao as string;
    const existente = porDimensao.get(codigo);
    if (!existente || linha.momento === "fim") {
      porDimensao.set(codigo, {
        codigoDimensao: codigo,
        nomeDimensao: linha.nome_dimensao as string,
        ordem: linha.ordem as number,
        nivelInicio: linha.regua_sonhos,
        nivelFim: linha.onde_chegamos,
        gap: linha.gap,
      });
    }
  }

  return Array.from(porDimensao.values()).sort((a, b) => a.ordem - b.ordem);
}
