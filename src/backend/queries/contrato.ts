import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

// Formas de leitura (view-models client-side) definidas verbatim conforme
// design.md (## Data Models / ## Components -- src/backend/queries/contrato.ts).
export interface ContratoParaFicha {
  idContrato: number;
  idProduto: number;
  nomeProduto: string;
  idContratante: number;
  nomeContratante: string;
  tipoContratante: string; // 'mandato' | 'coalizao' | outro (edge case)
  // presentes só quando tipoContratante === 'mandato':
  cargoAtual?: string | null;
  partidoAtual?: string | null;
  sgUf?: string | null;
  // presentes só quando tipoContratante === 'coalizao':
  nomeProjetoOrigem?: string | null;
}

export interface EtapaResumo {
  idEtapa: number;
  codigo: string;
  nome: string;
  ordem: number;
}

export interface ContratoAtivoResumo {
  idContrato: number;
  nomeContratante: string;
  dtInicio: string;
}

// NAV-04. Monta a ficha do contrato por 2-3 queries encadeadas (fat_contrato
// +dim_contratante+ref_produto primeiro via embed do PostgREST, depois
// dim_mandato OU dim_coalizao conforme tipo_contratante) -- nunca via
// vw_contrato, que existe só em docs/schema_sistema.sql e nunca foi migrada
// (design.md Risks). Cargo/partido vêm de dim_mandato.id_cargo_atual/
// id_partido_atual (atuais), nunca do snapshot fat_contrato.id_cargo_no_contrato/
// id_partido_no_contrato (nunca populado, FND-CTR-05).
export async function buscarContratoParaFicha(
  client: SupabaseClient<Database>,
  idContrato: number
): Promise<ContratoParaFicha | null> {
  const { data, error } = await client
    .from("fat_contrato")
    .select("id_contrato, id_produto, id_contratante, ref_produto(nome), dim_contratante(nome, tipo_contratante, sg_uf)")
    .eq("id_contrato", idContrato)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const produto = data.ref_produto as unknown as { nome: string | null } | null;
  const contratante = data.dim_contratante as unknown as {
    nome: string;
    tipo_contratante: string;
    sg_uf: string | null;
  } | null;

  const base: ContratoParaFicha = {
    idContrato: data.id_contrato,
    idProduto: data.id_produto,
    nomeProduto: produto?.nome ?? "",
    idContratante: data.id_contratante,
    nomeContratante: contratante?.nome ?? "",
    tipoContratante: contratante?.tipo_contratante ?? "",
  };

  if (base.tipoContratante === "mandato") {
    const { data: mandato, error: erroMandato } = await client
      .from("dim_mandato")
      .select("ref_cargo(nome), ref_partido(sigla)")
      .eq("id_contratante", data.id_contratante)
      .maybeSingle();
    if (erroMandato) throw erroMandato;

    const cargo = mandato?.ref_cargo as unknown as { nome: string | null } | null;
    const partido = mandato?.ref_partido as unknown as { sigla: string | null } | null;

    return {
      ...base,
      cargoAtual: cargo?.nome ?? null,
      partidoAtual: partido?.sigla ?? null,
      sgUf: contratante?.sg_uf ?? null,
    };
  }

  if (base.tipoContratante === "coalizao") {
    const { data: coalizao, error: erroCoalizao } = await client
      .from("dim_coalizao")
      .select("ref_projeto(nome)")
      .eq("id_contratante", data.id_contratante)
      .maybeSingle();
    if (erroCoalizao) throw erroCoalizao;

    const projeto = coalizao?.ref_projeto as unknown as { nome: string | null } | null;

    return { ...base, nomeProjetoOrigem: projeto?.nome ?? null };
  }

  return base;
}

// NAV-04. Abas de etapa da ficha do contrato, ordenadas por ordem ascendente.
export async function buscarEtapasDoProduto(
  client: SupabaseClient<Database>,
  idProduto: number
): Promise<EtapaResumo[]> {
  const { data, error } = await client
    .from("ref_etapa")
    .select("id_etapa, codigo, nome, ordem")
    .eq("id_produto", idProduto)
    .order("ordem", { ascending: true });

  if (error) throw error;
  if (!data) return [];

  return data.map((linha) => ({
    idEtapa: linha.id_etapa,
    codigo: linha.codigo,
    nome: linha.nome,
    ordem: linha.ordem,
  }));
}

// NAV-03. Contratos ativos do produto -- join manual com dim_contratante em
// TypeScript (mesmo padrão de app/(app)/contratos/page.tsx hoje, sem
// vw_contrato).
export async function buscarContratosAtivosPorProduto(
  client: SupabaseClient<Database>,
  idProduto: number
): Promise<ContratoAtivoResumo[]> {
  const { data: contratos, error } = await client
    .from("fat_contrato")
    .select("id_contrato, id_contratante, dt_inicio")
    .eq("id_produto", idProduto)
    .eq("status", "ativo");

  if (error) throw error;
  if (!contratos || contratos.length === 0) return [];

  const idsContratante = contratos.map((c) => c.id_contratante);
  const { data: contratantes, error: erroContratantes } = await client
    .from("dim_contratante")
    .select("id_contratante, nome")
    .in("id_contratante", idsContratante);

  if (erroContratantes) throw erroContratantes;

  const nomesPorId = new Map((contratantes ?? []).map((c) => [c.id_contratante, c.nome]));

  return contratos.map((c) => ({
    idContrato: c.id_contrato,
    nomeContratante: nomesPorId.get(c.id_contratante) ?? "",
    dtInicio: c.dt_inicio,
  }));
}

async function idsContratosAtivosDoProduto(client: SupabaseClient<Database>, idProduto: number): Promise<number[]> {
  const { data, error } = await client
    .from("fat_contrato")
    .select("id_contrato")
    .eq("id_produto", idProduto)
    .eq("status", "ativo");

  if (error) throw error;
  return (data ?? []).map((c) => c.id_contrato);
}

// dt_fim IS NULL OR dt_fim >= hoje (AC1 do NAV-10, literal).
function filtroVinculoAtivo(): string {
  const hoje = new Date().toISOString().slice(0, 10);
  return `dt_fim.is.null,dt_fim.gte.${hoje}`;
}

// NAV-10/NAV-11. Contagens do Dashboard do produto. Sem filtro, conta todos
// os contratos ativos do produto e todos os vínculos de assessor ativos
// desses contratos; com filtro (papel+idUsuario), restringe as duas
// contagens aos contratos onde aquela pessoa tem vínculo ativo naquele papel
// (AC2 do NAV-11, literal).
export async function contarContratosEAssessoresAtivos(
  client: SupabaseClient<Database>,
  idProduto: number,
  filtro?: { papel: "gestora" | "mentor"; idUsuario: number }
): Promise<{ contratosAtivos: number; assessoresAtivos: number }> {
  let idsContrato = await idsContratosAtivosDoProduto(client, idProduto);

  if (filtro && idsContrato.length > 0) {
    const { data, error } = await client
      .from("rel_usuario_contrato")
      .select("id_contrato")
      .in("id_contrato", idsContrato)
      .eq("id_usuario", filtro.idUsuario)
      .eq("papel_no_contrato", filtro.papel)
      .or(filtroVinculoAtivo());
    if (error) throw error;
    idsContrato = Array.from(new Set((data ?? []).map((v) => v.id_contrato)));
  }

  if (idsContrato.length === 0) return { contratosAtivos: 0, assessoresAtivos: 0 };

  const { count, error: erroAssessores } = await client
    .from("rel_usuario_contrato")
    .select("id_vinculo", { count: "exact", head: true })
    .in("id_contrato", idsContrato)
    .eq("papel_no_contrato", "assessor")
    .or(filtroVinculoAtivo());
  if (erroAssessores) throw erroAssessores;

  return { contratosAtivos: idsContrato.length, assessoresAtivos: count ?? 0 };
}

// NAV-11. Pessoas com vínculo ativo naquele papel em algum contrato ativo do
// produto -- popula o segundo Select em cascata do filtro do Dashboard.
export async function buscarPessoasComPapelNoProduto(
  client: SupabaseClient<Database>,
  idProduto: number,
  papel: "gestora" | "mentor"
): Promise<{ idUsuario: number; nome: string }[]> {
  const idsContrato = await idsContratosAtivosDoProduto(client, idProduto);
  if (idsContrato.length === 0) return [];

  const { data: vinculos, error } = await client
    .from("rel_usuario_contrato")
    .select("id_usuario")
    .in("id_contrato", idsContrato)
    .eq("papel_no_contrato", papel)
    .or(filtroVinculoAtivo());
  if (error) throw error;

  const idsUsuario = Array.from(new Set((vinculos ?? []).map((v) => v.id_usuario)));
  if (idsUsuario.length === 0) return [];

  const { data: usuarios, error: erroUsuarios } = await client
    .from("dim_usuario")
    .select("id_usuario, nome")
    .in("id_usuario", idsUsuario);
  if (erroUsuarios) throw erroUsuarios;

  return (usuarios ?? []).map((u) => ({ idUsuario: u.id_usuario, nome: u.nome }));
}
