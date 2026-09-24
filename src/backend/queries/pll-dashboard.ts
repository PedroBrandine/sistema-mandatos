import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { buscarIdsContratoDasEdicoes } from "./pll-edicao";

// pll-dashboard-agenda T4-T7 (design.md "Components" -- buscarPllKpis,
// buscarStatusMentoriaPorMes, buscarMentoradosPll, buscarRegistrosMentores).
//
// Filtro achatado num objeto só (sem o aninhamento `{ idProduto, filtro }`
// que design.md escreve pras 4 funções) -- mesma reconciliação já registrada
// em queries/agenda.ts para FiltroAgenda: um nome, uma forma, reaproveitada
// pelas 4 funções deste arquivo. `idsMentor` mapeia rel_usuario_contrato
// (papel_no_contrato = 'mentor'), D-4 da spec.
export interface FiltroPllDashboard {
  idProduto: number;
  idsMentor?: number[];
  /** fat_edicao (PLL1, PLL2...), não ref_projeto -- ver buscarIdsContratoDasEdicoes. */
  idsEdicao?: number[];
}

interface RowContratoId {
  id_contrato: number;
}

interface RowVinculo {
  id_contrato: number;
  id_usuario: number;
  papel_no_contrato: string;
}

// Contratos do produto (PLL), restringidos por edição (via linha do
// participante, buscarIdsContratoDasEdicoes) e por mentor (rel_usuario_contrato, vínculo ativo --
// dt_fim IS NULL, mesmo critério de resolverIdsContratoDoFiltro em
// queries/agenda.ts). Compartilhada pelas 4 funções deste arquivo.
async function resolverIdsContratoPll(
  client: SupabaseClient<Database>,
  filtro: FiltroPllDashboard
): Promise<number[]> {
  const porEdicao = filtro.idsEdicao !== undefined && filtro.idsEdicao.length > 0;
  const idsDasEdicoes = porEdicao ? await buscarIdsContratoDasEdicoes(client, filtro.idsEdicao as number[]) : [];
  if (porEdicao && idsDasEdicoes.length === 0) return [];

  let query = client.from("fat_contrato").select("id_contrato").eq("id_produto", filtro.idProduto);
  if (porEdicao) query = query.in("id_contrato", idsDasEdicoes);
  const { data, error } = await query;
  if (error) throw error;
  let ids = new Set((data ?? []).map((c) => (c as RowContratoId).id_contrato));

  if (filtro.idsMentor !== undefined && filtro.idsMentor.length > 0) {
    if (ids.size === 0) return [];
    const { data: vinculos, error: erroVinculos } = await client
      .from("rel_usuario_contrato")
      .select("id_contrato")
      .in("id_contrato", [...ids])
      .in("id_usuario", filtro.idsMentor)
      .eq("papel_no_contrato", "mentor")
      .is("dt_fim", null);
    if (erroVinculos) throw erroVinculos;
    const idsComMentor = new Set((vinculos ?? []).map((v) => (v as RowContratoId).id_contrato));
    ids = new Set([...ids].filter((id) => idsComMentor.has(id)));
  }

  return [...ids];
}

// =============================================================================
// T4: buscarPllKpis (PLL-DB-02, PLL-DB-03, PLL-DB-04)
// =============================================================================

// D-1: dentro de nao_concluido, origem_encerramento distingue Desistente de
// Desligado; concluido é um 4º estado que o desenho do Figma não mostra mas
// existe no banco (spec.md D-1).
export interface DistribuicaoStatusPll {
  ativo: number;
  desistente: number;
  desligado: number;
  concluido: number;
}

// AD-005: nenhum destes é 0 travestido de ausência. Recorte sem contrato
// devolve o objeto todo zerado para as contagens (0 é medição real: "nenhum
// contrato neste recorte") e null para as médias (atingimentoMedio -- sem
// amostra não tem média, PLL-DB-04).
export interface PllKpi {
  totalMentorados: number;
  distribuicaoStatus: DistribuicaoStatusPll;
  mentoriasRealizadas: number;
  mentoriasPlanejadas: number;
  atingimentoMedio: number | null;
  fatosGeradoresRegistrados: number;
}

const KPI_VAZIO: PllKpi = {
  totalMentorados: 0,
  distribuicaoStatus: { ativo: 0, desistente: 0, desligado: 0, concluido: 0 },
  mentoriasRealizadas: 0,
  mentoriasPlanejadas: 0,
  atingimentoMedio: null,
  fatosGeradoresRegistrados: 0,
};

interface RowContratoStatus {
  id_contrato: number;
  status: string;
  origem_encerramento: string | null;
}

interface RowEncontroStatus {
  status: string;
}

interface RowPctAtingimento {
  pct_atingimento: number | null;
}

// PLL-DB-02/03/04, D-11. Nenhum número é calculado no componente (AD-003) --
// esta função já entrega os 5 KPIs prontos, cada um de uma contagem/média
// real sobre o recorte.
export async function buscarPllKpis(
  client: SupabaseClient<Database>,
  filtro: FiltroPllDashboard
): Promise<PllKpi> {
  const idsContrato = await resolverIdsContratoPll(client, filtro);
  if (idsContrato.length === 0) return KPI_VAZIO;

  const { data: contratosData, error: erroContratos } = await client
    .from("fat_contrato")
    .select("id_contrato, status, origem_encerramento")
    .in("id_contrato", idsContrato);
  if (erroContratos) throw erroContratos;
  const contratos = (contratosData ?? []) as RowContratoStatus[];

  const distribuicaoStatus: DistribuicaoStatusPll = { ativo: 0, desistente: 0, desligado: 0, concluido: 0 };
  for (const c of contratos) {
    if (c.status === "ativo") distribuicaoStatus.ativo += 1;
    else if (c.status === "concluido") distribuicaoStatus.concluido += 1;
    else if (c.status === "nao_concluido") {
      if (c.origem_encerramento === "desistencia") distribuicaoStatus.desistente += 1;
      else if (c.origem_encerramento === "desligamento") distribuicaoStatus.desligado += 1;
    }
  }

  // D-11: "Mentorias realizadas x planejadas" = realizadas/planejadas, TODOS
  // os Encontros do recorte (não só os do tipo Mentoria -- essa restrição é
  // só da coluna "Mentorias" da tabela de mentorados, T6). Remarcado e
  // cancelado ficam fora do denominador.
  const { data: encontrosData, error: erroEncontros } = await client
    .from("fat_encontro")
    .select("status")
    .in("id_contrato", idsContrato);
  if (erroEncontros) throw erroEncontros;
  const encontros = (encontrosData ?? []) as RowEncontroStatus[];
  const mentoriasRealizadas = encontros.filter((e) => e.status === "realizado").length;
  const mentoriasPlanejadas = mentoriasRealizadas + encontros.filter((e) => e.status === "planejado").length;

  // PLL-DB-04: sem nenhum dim_planejamento no recorte, atingimentoMedio fica
  // null -- nunca 0 (AD-005).
  const { data: planejamentosData, error: erroPlanejamentos } = await client
    .from("dim_planejamento")
    .select("pct_atingimento")
    .in("id_contrato", idsContrato);
  if (erroPlanejamentos) throw erroPlanejamentos;
  const pctsValidos = ((planejamentosData ?? []) as RowPctAtingimento[])
    .map((p) => p.pct_atingimento)
    .filter((v): v is number => v !== null);
  const atingimentoMedio =
    pctsValidos.length > 0 ? pctsValidos.reduce((soma, v) => soma + v, 0) / pctsValidos.length : null;

  // D-11: fat_fato_gerador com situacao = 'realizado' dos contratos do recorte.
  const { count: fatosCount, error: erroFatos } = await client
    .from("fat_fato_gerador")
    .select("*", { count: "exact", head: true })
    .in("id_contrato", idsContrato)
    .eq("situacao", "realizado");
  if (erroFatos) throw erroFatos;

  return {
    totalMentorados: contratos.length,
    distribuicaoStatus,
    mentoriasRealizadas,
    mentoriasPlanejadas,
    atingimentoMedio,
    fatosGeradoresRegistrados: fatosCount ?? 0,
  };
}

// =============================================================================
// T12: buscarOpcoesMentorPll (opções do filtro "Filtrar por mentor(a)" do
// Dashboard, design.md "Tech Decisions" / D-4)
// =============================================================================

export interface OpcaoMentorPll {
  id: number;
  nome: string;
}

// D-4: mentor(a) é usuário com vínculo papel_no_contrato='mentor' ATIVO
// (dt_fim IS NULL) num contrato PLL -- não a lista global de gestoras
// (buscarGestorasAtivas, produtos/[slug]/mandatos/page.tsx) nem
// buscarOpcoesGestora (queries/agenda.ts), que filtram por papel_global.
export async function buscarOpcoesMentorPll(
  client: SupabaseClient<Database>,
  idProduto: number
): Promise<OpcaoMentorPll[]> {
  const { data: contratos, error: erroContratos } = await client
    .from("fat_contrato")
    .select("id_contrato")
    .eq("id_produto", idProduto);
  if (erroContratos) throw erroContratos;
  const idsContrato = (contratos ?? []).map((c) => (c as RowContratoId).id_contrato);
  if (idsContrato.length === 0) return [];

  const { data: vinculos, error: erroVinculos } = await client
    .from("rel_usuario_contrato")
    .select("id_usuario")
    .in("id_contrato", idsContrato)
    .eq("papel_no_contrato", "mentor")
    .is("dt_fim", null);
  if (erroVinculos) throw erroVinculos;
  const idsMentor = Array.from(new Set((vinculos ?? []).map((v) => (v as { id_usuario: number }).id_usuario)));
  if (idsMentor.length === 0) return [];

  const { data: usuarios, error: erroUsuarios } = await client
    .from("dim_usuario")
    .select("id_usuario, nome")
    .in("id_usuario", idsMentor)
    .order("nome");
  if (erroUsuarios) throw erroUsuarios;
  return ((usuarios ?? []) as { id_usuario: number; nome: string }[]).map((u) => ({ id: u.id_usuario, nome: u.nome }));
}

// =============================================================================
// T5: buscarStatusMentoriaPorMes (PLL-DB-05)
// =============================================================================

export interface SerieMensalStatus {
  mes: string; // "AAAA-MM"
  planejado: number;
  realizado: number;
  remarcado: number;
  cancelado: number;
}

// Mesmo fuso fixo que agenda.ts usa (FUSO_HORARIO_PRODUTO = "-03:00", Brasil
// não observa horário de verão desde 2019) -- necessário porque
// dt_prevista_inicio/dt_realizada são TIMESTAMPTZ: ler o mês em UTC puro
// erraria o dia/mês de um Encontro perto da virada, mesma classe de bug que
// aquele arquivo já documenta.
function chaveMesNoFusoDoProduto(iso: string): string {
  const data = new Date(iso);
  const comOffset = new Date(data.getTime() - 3 * 60 * 60 * 1000);
  return `${comOffset.getUTCFullYear()}-${String(comOffset.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Janela de 6 meses terminando no mês de `hoje` (PLL-DB-05: "últimos 6 meses,
// janela real = mês corrente − 5 até mês corrente", design.md). `hoje` é
// parâmetro opcional (default `new Date()`) só para permitir teste
// determinístico -- design.md não dá a esta função um parâmetro de mês
// (diferente de buscarEncontrosDoMes, que segue L-002 e recebe ano/mes da
// página); aqui a própria função decide "os últimos 6 meses" porque é o que
// o gráfico sempre mostra, sem navegação de mês na tela (PLL-DB-05 não tem
// setas como a Agenda).
function ultimosSeisMeses(hoje: Date = new Date()): { ano: number; mes: number }[] {
  const comOffset = new Date(hoje.getTime() - 3 * 60 * 60 * 1000);
  const anoAtual = comOffset.getUTCFullYear();
  const mesAtual = comOffset.getUTCMonth() + 1; // 1-12
  const janela: { ano: number; mes: number }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const totalMeses = anoAtual * 12 + (mesAtual - 1) - i;
    janela.push({ ano: Math.floor(totalMeses / 12), mes: (totalMeses % 12) + 1 });
  }
  return janela;
}

interface RowEncontroSerie {
  status: string;
  dt_prevista_inicio: string | null;
  dt_realizada: string | null;
}

// PLL-DB-05. Uma query só (todos os Encontros do recorte, sem filtro de
// data) -- a soma por mês/status acontece aqui, em TS, não em SQL GROUP BY
// (nenhuma migration de view/função nova está no escopo de T1-T7, design.md
// "Risks & Concerns"). Meses sem Encontro aparecem com todas as contagens 0
// (nunca omitidos, PLL-DB-05 / Done-when de T5).
export async function buscarStatusMentoriaPorMes(
  client: SupabaseClient<Database>,
  filtro: FiltroPllDashboard,
  hoje: Date = new Date()
): Promise<SerieMensalStatus[]> {
  const janela = ultimosSeisMeses(hoje);
  const base: SerieMensalStatus[] = janela.map(({ ano, mes }) => ({
    mes: `${ano}-${String(mes).padStart(2, "0")}`,
    planejado: 0,
    realizado: 0,
    remarcado: 0,
    cancelado: 0,
  }));

  const idsContrato = await resolverIdsContratoPll(client, filtro);
  if (idsContrato.length === 0) return base;

  const { data, error } = await client
    .from("fat_encontro")
    .select("status, dt_prevista_inicio, dt_realizada")
    .in("id_contrato", idsContrato);
  if (error) throw error;

  const indicePorMes = new Map(base.map((linha, indice) => [linha.mes, indice]));

  for (const encontro of (data ?? []) as RowEncontroSerie[]) {
    // PLL-DB-05: o mês de um Encontro realizado é o de dt_realizada; nos
    // demais, o de dt_prevista_inicio.
    const dataQueConta = encontro.status === "realizado" ? encontro.dt_realizada : encontro.dt_prevista_inicio;
    if (!dataQueConta) continue;

    const chave = chaveMesNoFusoDoProduto(dataQueConta);
    const indice = indicePorMes.get(chave);
    if (indice === undefined) continue; // fora da janela de 6 meses

    const linha = base[indice];
    if (encontro.status === "planejado") linha.planejado += 1;
    else if (encontro.status === "realizado") linha.realizado += 1;
    else if (encontro.status === "remarcado") linha.remarcado += 1;
    else if (encontro.status === "cancelado") linha.cancelado += 1;
  }

  return base;
}

// =============================================================================
// T6: buscarMentoradosPll (PLL-DB-07…10)
// =============================================================================

// Rótulo canônico "Cor/raça do parlamentar" (D-5) usa o prefixo de cargo em
// cima de dim_mandato.nm_urna. Só os cargos eletivos do seed
// (0007_catalogos_fundacao.sql) têm prefixo definido; qualquer outro nome
// (inclusive null) aparece por extenso -- nenhum rótulo inventado.
const PREFIXO_CARGO: Record<string, string> = {
  "Deputado(a) Federal": "Dep.",
  "Deputado(a) Estadual": "Dep.",
  "Deputado(a) Distrital": "Dep.",
  "Senador(a)": "Sen.",
  "Vereador(a)": "Ver.",
  "Prefeito(a)": "Pref.",
  "Vice-Prefeito(a)": "Vice-Pref.",
  "Governador(a)": "Gov.",
};

// PLL-DB-07…11, D-12 CORRIGIDO em sessão ao vivo com Pedro (22/09): D-12
// original definia mentorado como o vínculo papel_no_contrato='assessor' --
// mas o fluxo real de importação/vínculo TSE (spec irmã
// pll-cadastro-participantes) nunca cria esse vínculo (não existe
// dim_usuario/conta de login para um deputado importado por planilha), só o
// contrato. Mentorado passa a ser lido direto de fat_cadastro_participante
// via id_contrato -- mesmo padrão que os 3 painéis analíticos (T16-T19,
// buscarAnaliseParticipantePll etc.) já usavam, corretamente, desde o início.
// Uma linha por (mentorado, contrato): `UNIQUE (id_edicao, email)` em
// fat_cadastro_participante não impede duas linhas de edições diferentes
// apontarem pro mesmo id_contrato (troca de vínculo, PLL-CP-12) -- filtra só
// as mais recentes por atualizado_em pra não duplicar a linha.
//
// busca/ordenação NÃO são parâmetro desta função -- mesmo padrão de
// ListaMandatos/TabelaPendencias (client-side, no componente T10):
// design.md lista `busca?/ordenacao?` no protótipo da função mas descreve o
// "Reuses" como "mesmo formato de paginação/ordenação client-side já usado
// em TabelaPendencias", que não filtra no backend. Reconciliado a favor do
// Reuses, que é o padrão já estabelecido no restante do código.
export interface MentoradoPll {
  idContrato: number;
  nomeMentorado: string;
  nomeParlamentar: string;
  siglaPartido: string | null;
  siglaUf: string | null;
  nomeMentor: string | null;
  mentoriasRealizadas: number;
  pctAtingimento: number | null;
  status: "ativo" | "desistente" | "desligado" | "concluido";
  nomeEdicao: string | null;
}

interface RowContratoMentorado {
  id_contrato: number;
  id_contratante: number;
  status: string;
  origem_encerramento: string | null;
  id_partido_no_contrato: number | null;
  id_cargo_no_contrato: number | null;
}

function statusMentoradoPll(status: string, origemEncerramento: string | null): MentoradoPll["status"] {
  if (status === "nao_concluido") {
    return origemEncerramento === "desligamento" ? "desligado" : "desistente";
  }
  return status as MentoradoPll["status"];
}

export async function buscarMentoradosPll(
  client: SupabaseClient<Database>,
  filtro: FiltroPllDashboard
): Promise<MentoradoPll[]> {
  const idsContrato = await resolverIdsContratoPll(client, filtro);
  if (idsContrato.length === 0) return [];

  const { data: contratosData, error: erroContratos } = await client
    .from("fat_contrato")
    .select("id_contrato, id_contratante, status, origem_encerramento, id_partido_no_contrato, id_cargo_no_contrato")
    .in("id_contrato", idsContrato);
  if (erroContratos) throw erroContratos;
  const contratos = (contratosData ?? []) as RowContratoMentorado[];
  if (contratos.length === 0) return [];

  const { data: vinculosData, error: erroVinculos } = await client
    .from("rel_usuario_contrato")
    .select("id_contrato, id_usuario, papel_no_contrato")
    .in("id_contrato", idsContrato)
    .eq("papel_no_contrato", "mentor")
    .is("dt_fim", null);
  if (erroVinculos) throw erroVinculos;
  const vinculos = (vinculosData ?? []) as RowVinculo[];

  const mentorPorContrato = new Map<number, number>();
  for (const v of vinculos) {
    if (!mentorPorContrato.has(v.id_contrato)) mentorPorContrato.set(v.id_contrato, v.id_usuario);
  }

  // Mentorado = fat_cadastro_participante vinculado a este contrato (D-12
  // corrigido). Mais de uma linha de staging apontando pro mesmo id_contrato
  // (troca de vínculo, PLL-CP-12) -- mantém só a mais recente por contrato.
  const { data: cadastrosData, error: erroCadastros } = await client
    .from("fat_cadastro_participante")
    .select("id_contrato, nome_completo, id_edicao, atualizado_em")
    .in("id_contrato", idsContrato);
  if (erroCadastros) throw erroCadastros;
  const cadastroPorContrato = new Map<number, { nomeCompleto: string; idEdicao: number | null; atualizadoEm: string }>();
  for (const c of (cadastrosData ?? []) as {
    id_contrato: number | null;
    nome_completo: string;
    id_edicao: number | null;
    atualizado_em: string;
  }[]) {
    if (c.id_contrato === null) continue;
    const atual = cadastroPorContrato.get(c.id_contrato);
    if (!atual || c.atualizado_em > atual.atualizadoEm) {
      cadastroPorContrato.set(c.id_contrato, {
        nomeCompleto: c.nome_completo,
        idEdicao: c.id_edicao,
        atualizadoEm: c.atualizado_em,
      });
    }
  }
  const paresMentorado = Array.from(cadastroPorContrato.entries()).map(([idContrato, c]) => ({
    idContrato,
    nomeMentorado: c.nomeCompleto,
    idEdicao: c.idEdicao,
  }));
  if (paresMentorado.length === 0) return [];

  const idsMentor = Array.from(new Set(mentorPorContrato.values()));
  const { data: usuariosData, error: erroUsuarios } =
    idsMentor.length > 0
      ? await client.from("dim_usuario").select("id_usuario, nome").in("id_usuario", idsMentor)
      : { data: [], error: null };
  if (erroUsuarios) throw erroUsuarios;
  const nomesPorUsuario = new Map(
    ((usuariosData ?? []) as { id_usuario: number; nome: string }[]).map((u) => [u.id_usuario, u.nome])
  );

  const idsContratante = Array.from(new Set(contratos.map((c) => c.id_contratante)));
  const { data: mandatosData, error: erroMandatos } = await client
    .from("dim_mandato")
    .select("id_contratante, nm_urna, nm_civil")
    .in("id_contratante", idsContratante);
  if (erroMandatos) throw erroMandatos;
  const mandatoPorContratante = new Map(
    ((mandatosData ?? []) as { id_contratante: number; nm_urna: string | null; nm_civil: string | null }[]).map(
      (m) => [m.id_contratante, m]
    )
  );

  const idsPartido = Array.from(
    new Set(contratos.map((c) => c.id_partido_no_contrato).filter((id): id is number => id !== null))
  );
  const { data: partidosData, error: erroPartidos } =
    idsPartido.length > 0
      ? await client.from("ref_partido").select("id_partido, sigla").in("id_partido", idsPartido)
      : { data: [], error: null };
  if (erroPartidos) throw erroPartidos;
  const siglaPorPartido = new Map(
    ((partidosData ?? []) as { id_partido: number; sigla: string }[]).map((p) => [p.id_partido, p.sigla])
  );

  const idsCargo = Array.from(
    new Set(contratos.map((c) => c.id_cargo_no_contrato).filter((id): id is number => id !== null))
  );
  const { data: cargosData, error: erroCargos } =
    idsCargo.length > 0
      ? await client.from("ref_cargo").select("id_cargo, nome").in("id_cargo", idsCargo)
      : { data: [], error: null };
  if (erroCargos) throw erroCargos;
  const nomePorCargo = new Map(
    ((cargosData ?? []) as { id_cargo: number; nome: string }[]).map((c) => [c.id_cargo, c.nome])
  );

  const { data: contratantesData, error: erroContratantes } = await client
    .from("dim_contratante")
    .select("id_contratante, sg_uf")
    .in("id_contratante", idsContratante);
  if (erroContratantes) throw erroContratantes;
  const ufPorContratante = new Map(
    ((contratantesData ?? []) as { id_contratante: number; sg_uf: string | null }[]).map((c) => [
      c.id_contratante,
      c.sg_uf,
    ])
  );

  // PF3-05 (.specs/features/pente-fino-2026-09-23-lote2/spec.md): "Edição"
  // é o código real da edição do PLL (fat_edicao.nome, ex. "PLL 2026.1"),
  // via fat_cadastro_participante.id_edicao -- não o nome do PROJETO
  // (ref_projeto) vinculado ao contrato, que é uma entidade diferente.
  const idsEdicao = Array.from(
    new Set(paresMentorado.map((p) => p.idEdicao).filter((id): id is number => id !== null))
  );
  const { data: edicoesData, error: erroEdicoes } =
    idsEdicao.length > 0
      ? await client.from("fat_edicao").select("id_edicao, nome").in("id_edicao", idsEdicao)
      : { data: [], error: null };
  if (erroEdicoes) throw erroEdicoes;
  const nomePorEdicao = new Map(
    ((edicoesData ?? []) as { id_edicao: number; nome: string }[]).map((e) => [e.id_edicao, e.nome])
  );

  // D-11: "Mentorias" (tabela) = Encontros realizado do TIPO Mentoria no
  // contrato -- diferente do KPI (T4), que soma todos os tipos.
  const { data: tipoMentoriaData, error: erroTipoMentoria } = await client
    .from("ref_tipo_registro")
    .select("id_tipo_registro")
    .eq("nome", "Mentoria")
    .maybeSingle();
  if (erroTipoMentoria) throw erroTipoMentoria;
  const idTipoMentoria = (tipoMentoriaData as { id_tipo_registro: number } | null)?.id_tipo_registro;

  const mentoriasPorContrato = new Map<number, number>();
  if (idTipoMentoria !== undefined) {
    const { data: encontrosData, error: erroEncontros } = await client
      .from("fat_encontro")
      .select("id_contrato")
      .in("id_contrato", idsContrato)
      .eq("id_tipo_registro", idTipoMentoria)
      .eq("status", "realizado");
    if (erroEncontros) throw erroEncontros;
    for (const e of (encontrosData ?? []) as RowContratoId[]) {
      mentoriasPorContrato.set(e.id_contrato, (mentoriasPorContrato.get(e.id_contrato) ?? 0) + 1);
    }
  }

  const { data: planejamentosData, error: erroPlanejamentos } = await client
    .from("dim_planejamento")
    .select("id_contrato, pct_atingimento")
    .in("id_contrato", idsContrato);
  if (erroPlanejamentos) throw erroPlanejamentos;
  const pctPorContrato = new Map(
    ((planejamentosData ?? []) as { id_contrato: number; pct_atingimento: number | null }[]).map((p) => [
      p.id_contrato,
      p.pct_atingimento,
    ])
  );

  const contratoPorId = new Map(contratos.map((c) => [c.id_contrato, c]));

  return paresMentorado.map(({ idContrato, nomeMentorado, idEdicao }) => {
    const contrato = contratoPorId.get(idContrato) as RowContratoMentorado;
    const mandato = mandatoPorContratante.get(contrato.id_contratante);
    const nomeUrna = mandato?.nm_urna ?? mandato?.nm_civil ?? "";
    const nomeCargo = contrato.id_cargo_no_contrato !== null ? nomePorCargo.get(contrato.id_cargo_no_contrato) : undefined;
    const prefixo = nomeCargo !== undefined ? (PREFIXO_CARGO[nomeCargo] ?? nomeCargo) : null;
    const idMentor = mentorPorContrato.get(idContrato);

    return {
      idContrato,
      nomeMentorado,
      nomeParlamentar: prefixo !== null && nomeUrna ? `${prefixo} ${nomeUrna}` : nomeUrna,
      siglaPartido: contrato.id_partido_no_contrato !== null ? siglaPorPartido.get(contrato.id_partido_no_contrato) ?? null : null,
      siglaUf: ufPorContratante.get(contrato.id_contratante) ?? null,
      nomeMentor: idMentor !== undefined ? nomesPorUsuario.get(idMentor) ?? null : null,
      mentoriasRealizadas: mentoriasPorContrato.get(idContrato) ?? 0,
      pctAtingimento: pctPorContrato.get(idContrato) ?? null,
      status: statusMentoradoPll(contrato.status, contrato.origem_encerramento),
      nomeEdicao: idEdicao !== null ? nomePorEdicao.get(idEdicao) ?? null : null,
    };
  });
}

// =============================================================================
// T7: buscarRegistrosMentores (PLL-DB-12…14)
// =============================================================================

// D-7 corrigido (22/09, mesmo motivo de buscarMentoradosPll): "Mentorado" no
// feed vem de fat_cadastro_participante.nome_completo via id_contrato, não de
// um vínculo 'assessor' que o fluxo de import/TSE nunca cria. Sem reaproveitar
// buscarMentoradosPll porque o recorte de saída é diferente (10 mais recentes
// do produto inteiro, não uma linha por contrato).
export interface RegistroMentor {
  idRegistro: number;
  nomeAutor: string;
  nomeMentorado: string | null;
  ocorridoEm: string;
  resumo: string | null;
}

interface RowRegistroMentor {
  id_registro: number;
  id_contrato: number;
  ocorrido_em: string;
  resumo: string | null;
  id_usuario_autor: number;
}

// PLL-DB-12…14, D-7. Os `limite` Registros mais recentes (ocorrido_em desc)
// dos contratos do recorte. `limite` é parte do filtro achatado (mesma
// reconciliação do topo do arquivo) em vez de 3º argumento posicional.
export async function buscarRegistrosMentores(
  client: SupabaseClient<Database>,
  filtro: FiltroPllDashboard & { limite?: number }
): Promise<RegistroMentor[]> {
  const limite = filtro.limite ?? 10;
  const idsContrato = await resolverIdsContratoPll(client, filtro);
  if (idsContrato.length === 0) return [];

  const { data, error } = await client
    .from("fat_registro")
    .select("id_registro, id_contrato, ocorrido_em, resumo, id_usuario_autor")
    .in("id_contrato", idsContrato)
    .order("ocorrido_em", { ascending: false })
    .limit(limite);
  if (error) throw error;
  const registros = (data ?? []) as RowRegistroMentor[];
  if (registros.length === 0) return [];

  const idsAutor = Array.from(new Set(registros.map((r) => r.id_usuario_autor)));
  const { data: usuariosData, error: erroUsuarios } = await client
    .from("dim_usuario")
    .select("id_usuario, nome")
    .in("id_usuario", idsAutor);
  if (erroUsuarios) throw erroUsuarios;
  const nomesPorUsuario = new Map(
    ((usuariosData ?? []) as { id_usuario: number; nome: string }[]).map((u) => [u.id_usuario, u.nome])
  );

  const idsContratoRegistros = Array.from(new Set(registros.map((r) => r.id_contrato)));
  const { data: cadastrosData, error: erroCadastros } = await client
    .from("fat_cadastro_participante")
    .select("id_contrato, nome_completo, atualizado_em")
    .in("id_contrato", idsContratoRegistros);
  if (erroCadastros) throw erroCadastros;
  // Mais de uma linha de staging pro mesmo contrato (troca de vínculo,
  // PLL-CP-12) -- mantém só a mais recente, mesmo critério de buscarMentoradosPll.
  const nomeMentoradoPorContrato = new Map<number, { nome: string; atualizadoEm: string }>();
  for (const c of (cadastrosData ?? []) as { id_contrato: number | null; nome_completo: string; atualizado_em: string }[]) {
    if (c.id_contrato === null) continue;
    const atual = nomeMentoradoPorContrato.get(c.id_contrato);
    if (!atual || c.atualizado_em > atual.atualizadoEm) {
      nomeMentoradoPorContrato.set(c.id_contrato, { nome: c.nome_completo, atualizadoEm: c.atualizado_em });
    }
  }

  return registros.map((r) => ({
    idRegistro: r.id_registro,
    nomeAutor: nomesPorUsuario.get(r.id_usuario_autor) ?? "",
    nomeMentorado: nomeMentoradoPorContrato.get(r.id_contrato)?.nome ?? null,
    ocorridoEm: r.ocorrido_em,
    resumo: r.resumo,
  }));
}

// =============================================================================
// Helpers de agregação demográfica compartilhados por T16/T17
// (PLL-DB-15…19, D-5; D-13 revogada em 22/09, ver comentário abaixo).
// =============================================================================

// PLL-DB-19: o percentual de cada categoria na legenda, arredondado a 1 casa
// -- a soma "fecha 100% (±1 por arredondamento)" é uma propriedade do
// arredondamento por categoria, não recalculada à parte.
function arredondarPercentual(valor: number): number {
  return Math.round(valor * 10) / 10;
}

export interface CategoriaDistribuicao {
  categoria: string;
  quantidade: number;
  percentual: number;
}

// D-5(c): "'Prefere não informar' é categoria própria; ausência de resposta
// não entra no gráfico e o card mostra 'N sem resposta'." Duas coisas
// diferentes: um valor de texto real (mesmo que seja literalmente "Prefere
// não informar", vindo da planilha) é RESPOSTA e vira categoria/fatia da
// rosca; `null`/vazio é AUSÊNCIA e fica de fora do denominador -- por isso
// `n` (centro da rosca, PLL-DB-19) é a contagem de respondentes, não do
// recorte inteiro, e `semResposta` é informado à parte.
//
// D-13 REVOGADA em sessão ao vivo com Pedro (22/09): o limiar "n < 5 suprime
// o gráfico" travava o Dashboard inteiro com qualquer recorte pequeno (ex.:
// os 3 primeiros participantes vinculados ao TSE em dev) -- Pedro pediu a
// remoção explícita. O campo `suprimido` e a mensagem "Dados insuficientes"
// saem por inteiro (não é só desligar a condição): quem quiser reintroduzir
// um piso de privacidade decide o valor e o lugar certo (ex.: RLS/view, não
// UI) como uma decisão nova, não reaproveitando este código morto.
export interface DistribuicaoDemografica {
  n: number;
  semResposta: number;
  categorias: CategoriaDistribuicao[];
}

// Mesma forma de DistribuicaoDemografica, mas para campos sem noção de
// "ausência de resposta" (ex.: quantidade de candidaturas anteriores é
// sempre um número conhecido -- 0 é medição real, AD-005 -- não uma
// pergunta que ficou sem resposta).
export interface DistribuicaoCategorica {
  n: number;
  categorias: CategoriaDistribuicao[];
}

function agruparCategorias(valores: string[]): CategoriaDistribuicao[] {
  const contagem = new Map<string, number>();
  for (const v of valores) contagem.set(v, (contagem.get(v) ?? 0) + 1);
  const n = valores.length;
  return [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([categoria, quantidade]) => ({
      categoria,
      quantidade,
      percentual: n > 0 ? arredondarPercentual((quantidade / n) * 100) : 0,
    }));
}

function distribuicaoComAusencia(valores: (string | null)[]): DistribuicaoDemografica {
  const respondidos = valores
    .map((v) => v?.trim())
    .filter((v): v is string => v !== undefined && v.length > 0);
  const semResposta = valores.length - respondidos.length;
  const n = respondidos.length;
  return { n, semResposta, categorias: agruparCategorias(respondidos) };
}

function distribuicaoSemAusencia(valores: string[]): DistribuicaoCategorica {
  const n = valores.length;
  return { n, categorias: agruparCategorias(valores) };
}

// D-5(f): partido político agrupa além dos 8 maiores em "Outros".
function agruparComOutros(valores: (string | null)[], topN: number): DistribuicaoDemografica {
  const base = distribuicaoComAusencia(valores);
  if (base.categorias.length <= topN) return base;
  const top = base.categorias.slice(0, topN);
  const outros = base.categorias.slice(topN);
  const quantidadeOutros = outros.reduce((soma, c) => soma + c.quantidade, 0);
  const percentualOutros = base.n > 0 ? arredondarPercentual((quantidadeOutros / base.n) * 100) : 0;
  return {
    ...base,
    categorias: [...top, { categoria: "Outros", quantidade: quantidadeOutros, percentual: percentualOutros }],
  };
}

// =============================================================================
// T16: buscarAnaliseParticipantePll + buscarAfinidadeAgendaPll
// (PLL-DB-15, PLL-DB-17) -- dependem de fat_cadastro_participante
// (pll-cadastro-participantes, migration 20260922072328_*).
// =============================================================================

export interface AnaliseParticipantePll {
  participantesAtivos: number;
  identidadeGenero: DistribuicaoDemografica;
  orientacaoSexual: DistribuicaoDemografica;
  corRaca: DistribuicaoDemografica;
  tempoNaPolitica: DistribuicaoDemografica;
}

const DISTRIBUICAO_VAZIA: DistribuicaoDemografica = { n: 0, semResposta: 0, categorias: [] };

const ANALISE_PARTICIPANTE_VAZIA: AnaliseParticipantePll = {
  participantesAtivos: 0,
  identidadeGenero: DISTRIBUICAO_VAZIA,
  orientacaoSexual: DISTRIBUICAO_VAZIA,
  corRaca: DISTRIBUICAO_VAZIA,
  tempoNaPolitica: DISTRIBUICAO_VAZIA,
};

interface RowCadastroDemografico {
  identidade_genero: string | null;
  orientacao_sexual: string | null;
  cor_raca: string | null;
  tempo_na_politica: string | null;
}

// PLL-DB-15. `fat_cadastro_participante.papel = 'mentorado'` -- o painel é
// "Análise do PARTICIPANTE" no sentido de D-12 (o mentorado é quem tem
// mandato/perfil analisado; o mentor não entra nesta leitura, mesmo recorte
// de pessoa que a tabela de mentorados (T6) usa). "N Participantes Ativos"
// (selo do painel) é `fat_contrato.status = 'ativo'` do recorte -- não
// depende da planilha de cadastro estar preenchida.
export async function buscarAnaliseParticipantePll(
  client: SupabaseClient<Database>,
  filtro: FiltroPllDashboard
): Promise<AnaliseParticipantePll> {
  const idsContrato = await resolverIdsContratoPll(client, filtro);
  if (idsContrato.length === 0) return ANALISE_PARTICIPANTE_VAZIA;

  const { count, error: erroAtivos } = await client
    .from("fat_contrato")
    .select("*", { count: "exact", head: true })
    .in("id_contrato", idsContrato)
    .eq("status", "ativo");
  if (erroAtivos) throw erroAtivos;

  const { data, error } = await client
    .from("fat_cadastro_participante")
    .select("identidade_genero, orientacao_sexual, cor_raca, tempo_na_politica")
    .in("id_contrato", idsContrato)
    .eq("papel", "mentorado");
  if (error) throw error;
  const linhas = (data ?? []) as RowCadastroDemografico[];

  return {
    participantesAtivos: count ?? 0,
    identidadeGenero: distribuicaoComAusencia(linhas.map((l) => l.identidade_genero)),
    orientacaoSexual: distribuicaoComAusencia(linhas.map((l) => l.orientacao_sexual)),
    corRaca: distribuicaoComAusencia(linhas.map((l) => l.cor_raca)),
    tempoNaPolitica: distribuicaoComAusencia(linhas.map((l) => l.tempo_na_politica)),
  };
}

export interface DistribuicaoNota {
  nota: 1 | 2 | 3 | 4 | 5;
  quantidade: number;
  percentual: number;
}

export interface PautaAfinidade {
  pauta: string;
  n: number;
  distribuicaoNotas: DistribuicaoNota[];
}

export interface CategoriaOutraPauta {
  pauta: string;
  quantidade: number;
  percentual: number;
}

export interface OutrasPautasAfinidade {
  n: number;
  itens: CategoriaOutraPauta[];
}

export interface AfinidadeAgendaPll {
  pautas: PautaAfinidade[];
  outrasPautas: OutrasPautasAfinidade;
}

interface RowCadastroPautas {
  nota_educacao: number | null;
  nota_seguranca_publica: number | null;
  nota_modernizacao_estado: number | null;
  nota_clima: number | null;
  outras_pautas: string[] | null;
}

// Anexo A / D-3: as 4 pautas fixas do formulário de diagnóstico do PLL, nesta
// ordem (spec.md Anexo A / PLL-DB-17) -- NÃO é `ref_agenda_tematica` (D-3,
// resolvida).
const PAUTAS_FIXAS: {
  pauta: string;
  coluna: "nota_educacao" | "nota_seguranca_publica" | "nota_modernizacao_estado" | "nota_clima";
}[] = [
  { pauta: "Educação", coluna: "nota_educacao" },
  { pauta: "Segurança Pública", coluna: "nota_seguranca_publica" },
  { pauta: "Modernização do Estado", coluna: "nota_modernizacao_estado" },
  { pauta: "Clima", coluna: "nota_clima" },
];

function distribuicaoNotas(valores: (number | null)[]): { n: number; distribuicaoNotas: DistribuicaoNota[] } {
  const validas = valores.filter((v): v is number => v !== null);
  const n = validas.length;
  const contagem = new Map<number, number>([
    [5, 0],
    [4, 0],
    [3, 0],
    [2, 0],
    [1, 0],
  ]);
  for (const v of validas) contagem.set(v, (contagem.get(v) ?? 0) + 1);
  const distribuicaoNotas: DistribuicaoNota[] = [5, 4, 3, 2, 1].map((nota) => ({
    nota: nota as DistribuicaoNota["nota"],
    quantidade: contagem.get(nota) ?? 0,
    percentual: n > 0 ? arredondarPercentual(((contagem.get(nota) ?? 0) / n) * 100) : 0,
  }));
  return { n, distribuicaoNotas };
}

const AFINIDADE_VAZIA: AfinidadeAgendaPll = {
  pautas: PAUTAS_FIXAS.map(({ pauta }) => ({ pauta, n: 0, distribuicaoNotas: distribuicaoNotas([]).distribuicaoNotas })),
  outrasPautas: { n: 0, itens: [] },
};

// PLL-DB-17. `outras_pautas` é múltipla escolha (TEXT[], Anexo A) -- ao
// contrário das 4 pautas fixas (1 nota por pessoa), uma pessoa pode marcar
// mais de um item. SPEC_DEVIATION documentada: o percentual desta lista é
// sobre quem marcou pelo menos 1 item (`n`), e por ser múltipla escolha a
// soma das fatias PODE passar de 100% -- PLL-DB-19 pede soma 100% "para
// qualquer rosca", regra pensada para categoria única (as outras 6 roscas do
// Dashboard cumprem). Não há como reconciliar as duas sem inventar uma
// regra de exclusividade que a planilha não tem; sinalizado aqui e no
// relatório de fechamento da fase, não resolvido em silêncio.
export async function buscarAfinidadeAgendaPll(
  client: SupabaseClient<Database>,
  filtro: FiltroPllDashboard
): Promise<AfinidadeAgendaPll> {
  const idsContrato = await resolverIdsContratoPll(client, filtro);
  if (idsContrato.length === 0) return AFINIDADE_VAZIA;

  const { data, error } = await client
    .from("fat_cadastro_participante")
    .select("nota_educacao, nota_seguranca_publica, nota_modernizacao_estado, nota_clima, outras_pautas")
    .in("id_contrato", idsContrato)
    .eq("papel", "mentorado");
  if (error) throw error;
  const linhas = (data ?? []) as RowCadastroPautas[];

  const pautas: PautaAfinidade[] = PAUTAS_FIXAS.map(({ pauta, coluna }) => {
    const { n, distribuicaoNotas: dn } = distribuicaoNotas(linhas.map((l) => l[coluna]));
    return { pauta, n, distribuicaoNotas: dn };
  });

  const linhasComOutras = linhas.filter((l) => (l.outras_pautas ?? []).length > 0);
  const n = linhasComOutras.length;
  const contagem = new Map<string, number>();
  for (const l of linhasComOutras) {
    for (const item of l.outras_pautas ?? []) {
      contagem.set(item, (contagem.get(item) ?? 0) + 1);
    }
  }
  const itens: CategoriaOutraPauta[] = [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([pautaItem, quantidade]) => ({
      pauta: pautaItem,
      quantidade,
      percentual: n > 0 ? arredondarPercentual((quantidade / n) * 100) : 0,
    }));

  return { pautas, outrasPautas: { n, itens } };
}

// =============================================================================
// T17: buscarAnaliseMandatoPll (PLL-DB-16) -- sem dependência da tabela de
// staging da spec-irmã; usa dim_mandato/fat_contrato/rel_mandato_candidatura,
// já existentes.
// =============================================================================

export interface AnaliseMandatoPll {
  corRacaParlamentar: DistribuicaoDemografica;
  partidoPolitico: DistribuicaoDemografica;
  estadoEleicao: DistribuicaoDemografica;
  cargosAnteriores: DistribuicaoCategorica;
  mandatosAnteriores: DistribuicaoCategorica;
}

const DISTRIBUICAO_CATEGORICA_VAZIA: DistribuicaoCategorica = { n: 0, categorias: [] };

const ANALISE_MANDATO_VAZIA: AnaliseMandatoPll = {
  corRacaParlamentar: DISTRIBUICAO_VAZIA,
  partidoPolitico: DISTRIBUICAO_VAZIA,
  estadoEleicao: DISTRIBUICAO_VAZIA,
  cargosAnteriores: DISTRIBUICAO_CATEGORICA_VAZIA,
  mandatosAnteriores: DISTRIBUICAO_CATEGORICA_VAZIA,
};

interface RowContratoMandatoPainel {
  id_contrato: number;
  id_contratante: number;
  id_partido_no_contrato: number | null;
}

interface RowMandatoPainel {
  id_mandato: number;
  id_contratante: number;
  ds_raca: string | null;
}

interface RowCandidaturaConfirmada {
  id_mandato: number;
  ano_eleicao: number;
  sq_candidato: number;
  nr_turno: number;
}

interface RowMvCargo {
  ano_eleicao: number | null;
  sq_candidato: number | null;
  nr_turno: number | null;
  ds_cargo: string | null;
}

// D-5(e): "Mandatos anteriores" bucketa em 0/1/2/"3 ou mais" -- 0 é medição
// real (mandato de primeiro mandato), nunca ausência (AD-005), por isso usa
// DistribuicaoCategorica (sem semResposta) e não DistribuicaoDemografica.
function bucketMandatosAnteriores(quantidade: number): string {
  if (quantidade === 0) return "0";
  if (quantidade === 1) return "1";
  if (quantidade === 2) return "2";
  return "3 ou mais";
}

// PLL-DB-16, D-5. "Antes do contrato" (D-5e) é lido aqui como "confirmado e
// NÃO vigente" -- `eh_mandato_vigente` já marca o mandato correspondente ao
// cargo atual (rel_mandato_candidatura, docs/schema_sistema.sql:768/777);
// as demais candidaturas confirmadas do mesmo `id_mandato` são,
// necessariamente, de eleições anteriores. Assunção registrada aqui (Step 5
// da Knowledge Verification Chain) porque a spec não formaliza "antes do
// contrato" em termos de coluna: nenhuma tabela associa ano_eleicao a
// dt_inicio do contrato de forma direta, e `eh_mandato_vigente` é o único
// marcador de "mandato atual" que o schema já expõe.
export async function buscarAnaliseMandatoPll(
  client: SupabaseClient<Database>,
  filtro: FiltroPllDashboard
): Promise<AnaliseMandatoPll> {
  const idsContrato = await resolverIdsContratoPll(client, filtro);
  if (idsContrato.length === 0) return ANALISE_MANDATO_VAZIA;

  const { data: contratosData, error: erroContratos } = await client
    .from("fat_contrato")
    .select("id_contrato, id_contratante, id_partido_no_contrato")
    .in("id_contrato", idsContrato);
  if (erroContratos) throw erroContratos;
  const contratos = (contratosData ?? []) as RowContratoMandatoPainel[];
  if (contratos.length === 0) return ANALISE_MANDATO_VAZIA;

  const idsContratante = Array.from(new Set(contratos.map((c) => c.id_contratante)));

  const { data: mandatosData, error: erroMandatos } = await client
    .from("dim_mandato")
    .select("id_mandato, id_contratante, ds_raca")
    .in("id_contratante", idsContratante);
  if (erroMandatos) throw erroMandatos;
  const mandatos = (mandatosData ?? []) as RowMandatoPainel[];

  const { data: contratantesData, error: erroContratantes } = await client
    .from("dim_contratante")
    .select("id_contratante, sg_uf")
    .in("id_contratante", idsContratante);
  if (erroContratantes) throw erroContratantes;
  const ufPorContratante = new Map(
    ((contratantesData ?? []) as { id_contratante: number; sg_uf: string | null }[]).map((c) => [
      c.id_contratante,
      c.sg_uf,
    ])
  );

  const idsPartido = Array.from(
    new Set(contratos.map((c) => c.id_partido_no_contrato).filter((id): id is number => id !== null))
  );
  const { data: partidosData, error: erroPartidos } =
    idsPartido.length > 0
      ? await client.from("ref_partido").select("id_partido, sigla").in("id_partido", idsPartido)
      : { data: [], error: null };
  if (erroPartidos) throw erroPartidos;
  const siglaPorPartido = new Map(
    ((partidosData ?? []) as { id_partido: number; sigla: string }[]).map((p) => [p.id_partido, p.sigla])
  );

  const corRacaParlamentar = distribuicaoComAusencia(mandatos.map((m) => m.ds_raca));
  const partidoPolitico = agruparComOutros(
    contratos.map((c) => (c.id_partido_no_contrato !== null ? siglaPorPartido.get(c.id_partido_no_contrato) ?? null : null)),
    8
  );
  const estadoEleicao = distribuicaoComAusencia(contratos.map((c) => ufPorContratante.get(c.id_contratante) ?? null));

  const idsMandato = mandatos.map((m) => m.id_mandato);
  const { data: candidaturasData, error: erroCandidaturas } =
    idsMandato.length > 0
      ? await client
          .from("rel_mandato_candidatura")
          .select("id_mandato, ano_eleicao, sq_candidato, nr_turno")
          .in("id_mandato", idsMandato)
          .eq("status", "confirmado")
          .eq("eh_mandato_vigente", false)
      : { data: [], error: null };
  if (erroCandidaturas) throw erroCandidaturas;
  const candidaturas = (candidaturasData ?? []) as RowCandidaturaConfirmada[];

  const idsSqCandidato = Array.from(new Set(candidaturas.map((c) => c.sq_candidato)));
  const { data: mvData, error: erroMv } =
    idsSqCandidato.length > 0
      ? await client
          .schema("tse")
          .from("mv_candidatura_resumo")
          .select("ano_eleicao, sq_candidato, nr_turno, ds_cargo")
          .in("sq_candidato", idsSqCandidato)
      : { data: [], error: null };
  if (erroMv) throw erroMv;
  const cargoPorChave = new Map(
    ((mvData ?? []) as RowMvCargo[]).map((r) => [`${r.ano_eleicao}|${r.sq_candidato}|${r.nr_turno}`, r.ds_cargo])
  );

  const cargosAnteriores = distribuicaoSemAusencia(
    candidaturas
      .map((c) => cargoPorChave.get(`${c.ano_eleicao}|${c.sq_candidato}|${c.nr_turno}`))
      .filter((v): v is string => !!v)
  );

  const contagemPorMandato = new Map<number, number>(idsMandato.map((id) => [id, 0]));
  for (const c of candidaturas) {
    contagemPorMandato.set(c.id_mandato, (contagemPorMandato.get(c.id_mandato) ?? 0) + 1);
  }
  const mandatosAnteriores = distribuicaoSemAusencia(
    [...contagemPorMandato.values()].map(bucketMandatosAnteriores)
  );

  return { corRacaParlamentar, partidoPolitico, estadoEleicao, cargosAnteriores, mandatosAnteriores };
}
