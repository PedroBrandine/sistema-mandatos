import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P1: Informações
// Gerais do mandato" (FMC-05, FMC-06, FMC-07, FMC-10, FMC-11, FMC-12, FMC-13).
// Formas de leitura (view-models client-side) para os 4 cards de T25-T28.

export interface AreaTematicaVinculada {
  idAgenda: number;
  nome: string;
  ordem: number | null;
}

// A-04: derivado de rel_usuario_contrato + dim_usuario -- nunca digitado,
// evita duplicar dado pessoal em dim_mandato (LGPD).
export interface ContatoPessoa {
  idUsuario: number;
  nome: string;
  email: string;
  telefone: string | null;
}

export interface UsuarioResumo {
  idUsuario: number;
  nome: string;
}

// status cru de fat_contrato (ck_contrato_status) -- o rótulo canônico
// (Ativo/Concluído/Não concluído) é responsabilidade de rotuloStatusContrato
// (lib/ficha-formatos.ts, T16), não desta camada de query.
export interface HistoricoContratoLinha {
  idContrato: number;
  status: string;
  dtInicio: string;
  dtFim: string | null;
}

export interface ProjetoVinculado {
  idProjeto: number;
  nome: string;
}

export interface CoalizaoVinculada {
  idCoalizao: number;
  nome: string;
}

export interface NoticiaMandato {
  titulo: string;
  url: string;
}

export interface DiagnosticoMandato {
  idMandato: number;
  principaisDestaques: string[] | null;
  cargosLegislatura: string[] | null;
  principaisPls: string[] | null;
  principaisNoticias: NoticiaMandato[] | null;
  swotForcas: string[] | null;
  swotFraquezas: string[] | null;
  swotOportunidades: string[] | null;
  swotAmeacas: string[] | null;
}

export interface InformacoesGeraisMandato {
  idMandato: number;
  minibiografia: string | null;
  principaisPautas: string[] | null;
  areasTematicas: AreaTematicaVinculada[];
  // A-04: cada contato é `null` quando ausente (AD-005) -- nunca objeto vazio.
  contatoParlamentar: ContatoPessoa | null;
  contatoChefeGabinete: ContatoPessoa | null;
  // A-05: só uma tag de menção -- não é vínculo de rel_usuario_contrato.
  pontoFocal: UsuarioResumo | null;
  gestoras: UsuarioResumo[];
  historicoContratos: HistoricoContratoLinha[];
  projeto: ProjetoVinculado | null;
  coalizoes: CoalizaoVinculada[];
}

// FMC-05, FMC-06, FMC-07, FMC-10, FMC-11, FMC-12, FMC-13. Monta a leitura
// completa da aba "Informações Gerais" a partir do id_contrato: resolve
// id_contratante/id_mandato primeiro, depois busca cada bloco em paralelo.
// Devolve `null` quando o contrato não existe OU não tem dim_mandato
// associado (contrato de coalizão) -- a página (T29) decide o notFound(),
// esta função só sinaliza "não há ficha de mandato aqui".
//
// Cargo/papel não são filtrados por vigência de vínculo (dt_fim): nenhuma AC
// desta task pede isso (diferente de NAV-11, que filtra vínculo ativo para
// contagem) -- filtrar aqui seria requisito inventado.
export async function buscarInformacoesGeraisMandato(
  client: SupabaseClient<Database>,
  idContrato: number
): Promise<InformacoesGeraisMandato | null> {
  const { data: contrato, error: erroContrato } = await client
    .from("fat_contrato")
    .select("id_contrato, id_contratante, id_usuario_ponto_focal, ref_projeto(id_projeto, nome)")
    .eq("id_contrato", idContrato)
    .maybeSingle();
  if (erroContrato) throw erroContrato;
  if (!contrato) return null;

  const { data: mandato, error: erroMandato } = await client
    .from("dim_mandato")
    .select("id_mandato, minibiografia, principais_pautas")
    .eq("id_contratante", contrato.id_contratante)
    .maybeSingle();
  if (erroMandato) throw erroMandato;
  if (!mandato) return null;

  const projetoEmbed = contrato.ref_projeto as unknown as { id_projeto: number; nome: string } | null;

  const [areasTematicas, contatosEGestoras, historicoContratos, coalizoes] = await Promise.all([
    buscarAreasTematicasVinculadas(client, mandato.id_mandato),
    buscarContatosEGestoras(client, idContrato, contrato.id_usuario_ponto_focal),
    buscarHistoricoContratos(client, contrato.id_contratante),
    buscarCoalizoesVinculadas(client, idContrato),
  ]);

  return {
    idMandato: mandato.id_mandato,
    minibiografia: mandato.minibiografia,
    principaisPautas: mandato.principais_pautas,
    areasTematicas,
    contatoParlamentar: contatosEGestoras.contatoParlamentar,
    contatoChefeGabinete: contatosEGestoras.contatoChefeGabinete,
    pontoFocal: contatosEGestoras.pontoFocal,
    gestoras: contatosEGestoras.gestoras,
    historicoContratos,
    projeto: projetoEmbed ? { idProjeto: projetoEmbed.id_projeto, nome: projetoEmbed.nome } : null,
    coalizoes,
  };
}

// DIAG-10..DIAG-20 (.specs/features/diagnostico-mandato-estrategia/spec.md).
// Leitura enxuta da aba "Diagnóstico": só os campos novos de dim_mandato,
// sem os blocos de Informações Gerais (áreas temáticas, contatos, histórico
// de contratos, projeto/coalizões não fazem parte desta aba). Mesma resolução
// id_contrato -> id_contratante -> dim_mandato de buscarInformacoesGeraisMandato,
// devolve null quando o contrato não existe ou não tem dim_mandato associado.
export async function buscarDiagnosticoMandato(
  client: SupabaseClient<Database>,
  idContrato: number
): Promise<DiagnosticoMandato | null> {
  const { data: contrato, error: erroContrato } = await client
    .from("fat_contrato")
    .select("id_contratante")
    .eq("id_contrato", idContrato)
    .maybeSingle();
  if (erroContrato) throw erroContrato;
  if (!contrato) return null;

  const { data: mandato, error: erroMandato } = await client
    .from("dim_mandato")
    .select(
      "id_mandato, principais_destaques, cargos_legislatura, principais_pls, principais_noticias, swot_forcas, swot_fraquezas, swot_oportunidades, swot_ameacas"
    )
    .eq("id_contratante", contrato.id_contratante)
    .maybeSingle();
  if (erroMandato) throw erroMandato;
  if (!mandato) return null;

  return {
    idMandato: mandato.id_mandato,
    principaisDestaques: mandato.principais_destaques,
    cargosLegislatura: mandato.cargos_legislatura,
    principaisPls: mandato.principais_pls,
    principaisNoticias: (mandato.principais_noticias as unknown as NoticiaMandato[] | null) ?? null,
    swotForcas: mandato.swot_forcas,
    swotFraquezas: mandato.swot_fraquezas,
    swotOportunidades: mandato.swot_oportunidades,
    swotAmeacas: mandato.swot_ameacas,
  };
}

// FMC-07: temas vinculados ao mandato -- junção sem nome/ordem
// (rel_mandato_agenda_tematica só guarda os ids), então o nome e a ordem vêm
// de uma segunda consulta ao catálogo pelos ids vinculados.
async function buscarAreasTematicasVinculadas(
  client: SupabaseClient<Database>,
  idMandato: number
): Promise<AreaTematicaVinculada[]> {
  const { data: vinculos, error } = await client
    .from("rel_mandato_agenda_tematica")
    .select("id_agenda")
    .eq("id_mandato", idMandato);
  if (error) throw error;

  const idsAgenda = (vinculos ?? []).map((v) => v.id_agenda);
  if (idsAgenda.length === 0) return [];

  const { data: temas, error: erroTemas } = await client
    .from("ref_agenda_tematica")
    .select("id_agenda, nome, ordem")
    .in("id_agenda", idsAgenda)
    .order("ordem", { ascending: true });
  if (erroTemas) throw erroTemas;

  return (temas ?? []).map((t) => ({ idAgenda: t.id_agenda, nome: t.nome, ordem: t.ordem }));
}

// A-04 (contatos): cargo 'parlamentar' | 'chefe_gabinete' em rel_usuario_contrato.
// A-05 (ponto focal): fat_contrato.id_usuario_ponto_focal, resolvido aqui pra
// reaproveitar a mesma consulta a dim_usuario que os contatos e as gestoras
// (FMC-11) precisam -- uma leitura só, em vez de 3.
async function buscarContatosEGestoras(
  client: SupabaseClient<Database>,
  idContrato: number,
  idUsuarioPontoFocal: number | null
): Promise<{
  contatoParlamentar: ContatoPessoa | null;
  contatoChefeGabinete: ContatoPessoa | null;
  pontoFocal: UsuarioResumo | null;
  gestoras: UsuarioResumo[];
}> {
  const { data: vinculos, error } = await client
    .from("rel_usuario_contrato")
    .select("id_usuario, cargo, papel_no_contrato")
    .eq("id_contrato", idContrato);
  if (error) throw error;

  const linhas = vinculos ?? [];
  const idUsuarioParlamentar = linhas.find((v) => v.cargo === "parlamentar")?.id_usuario ?? null;
  const idUsuarioChefeGabinete = linhas.find((v) => v.cargo === "chefe_gabinete")?.id_usuario ?? null;
  const idsGestoras = linhas.filter((v) => v.papel_no_contrato === "gestora").map((v) => v.id_usuario);

  const idsUsuario = Array.from(
    new Set(
      [idUsuarioParlamentar, idUsuarioChefeGabinete, idUsuarioPontoFocal, ...idsGestoras].filter(
        (id): id is number => id !== null
      )
    )
  );

  const usuariosPorId = new Map<number, { id_usuario: number; nome: string; email: string; telefone: string | null }>();
  if (idsUsuario.length > 0) {
    const { data: usuarios, error: erroUsuarios } = await client
      .from("dim_usuario")
      .select("id_usuario, nome, email, telefone")
      .in("id_usuario", idsUsuario);
    if (erroUsuarios) throw erroUsuarios;
    for (const u of usuarios ?? []) usuariosPorId.set(u.id_usuario, u);
  }

  function contato(idUsuario: number | null): ContatoPessoa | null {
    if (idUsuario === null) return null;
    const u = usuariosPorId.get(idUsuario);
    if (!u) return null;
    return { idUsuario: u.id_usuario, nome: u.nome, email: u.email, telefone: u.telefone };
  }

  function resumo(idUsuario: number | null): UsuarioResumo | null {
    if (idUsuario === null) return null;
    const u = usuariosPorId.get(idUsuario);
    if (!u) return null;
    return { idUsuario: u.id_usuario, nome: u.nome };
  }

  return {
    contatoParlamentar: contato(idUsuarioParlamentar),
    contatoChefeGabinete: contato(idUsuarioChefeGabinete),
    pontoFocal: resumo(idUsuarioPontoFocal),
    gestoras: idsGestoras.map((id) => resumo(id)).filter((g): g is UsuarioResumo => g !== null),
  };
}

// FMC-12: todos os fat_contrato do mesmo id_contratante -- inclui o próprio
// contrato da ficha (edge case da spec: mandato sem outro contrato mostra a
// linha dele mesmo, nunca estado vazio).
async function buscarHistoricoContratos(
  client: SupabaseClient<Database>,
  idContratante: number
): Promise<HistoricoContratoLinha[]> {
  const { data, error } = await client
    .from("fat_contrato")
    .select("id_contrato, status, dt_inicio, dt_fim")
    .eq("id_contratante", idContratante)
    .order("dt_inicio", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((c) => ({
    idContrato: c.id_contrato,
    status: c.status,
    dtInicio: c.dt_inicio,
    dtFim: c.dt_fim,
  }));
}

// FMC-13: coalizões de rel_coalizao_membro -- o nome exibido vem de
// dim_contratante (mesmo padrão de buscarContratoParaFicha para o ramo
// coalizão: dim_coalizao não guarda nome próprio, só dim_contratante).
async function buscarCoalizoesVinculadas(
  client: SupabaseClient<Database>,
  idContrato: number
): Promise<CoalizaoVinculada[]> {
  const { data, error } = await client
    .from("rel_coalizao_membro")
    .select("id_coalizao, dim_coalizao(id_contratante, dim_contratante(nome))")
    .eq("id_contrato", idContrato);
  if (error) throw error;

  return (data ?? [])
    .map((linha) => {
      const coalizao = linha.dim_coalizao as unknown as {
        id_contratante: number;
        dim_contratante: { nome: string } | null;
      } | null;
      const nome = coalizao?.dim_contratante?.nome;
      if (!nome) return null;
      return { idCoalizao: linha.id_coalizao, nome };
    })
    .filter((c): c is CoalizaoVinculada => c !== null);
}
