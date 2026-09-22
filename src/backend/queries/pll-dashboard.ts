import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

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
  idsProjeto?: number[];
}

interface RowContratoId {
  id_contrato: number;
}

interface RowVinculo {
  id_contrato: number;
  id_usuario: number;
  papel_no_contrato: string;
}

// Contratos do produto (PLL), restringidos por projeto (direto em
// fat_contrato) e por mentor (rel_usuario_contrato, vínculo ativo --
// dt_fim IS NULL, mesmo critério de resolverIdsContratoDoFiltro em
// queries/agenda.ts). Compartilhada pelas 4 funções deste arquivo.
async function resolverIdsContratoPll(
  client: SupabaseClient<Database>,
  filtro: FiltroPllDashboard
): Promise<number[]> {
  let query = client.from("fat_contrato").select("id_contrato").eq("id_produto", filtro.idProduto);
  if (filtro.idsProjeto !== undefined && filtro.idsProjeto.length > 0) {
    query = query.in("id_projeto", filtro.idsProjeto);
  }
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

// PLL-DB-07…11, D-12. Uma linha por (mentorado, contrato): mentorado é o
// vínculo papel_no_contrato='assessor' ativo (D-12). Um contrato com mais de
// um assessor ativo gera mais de uma linha -- D-12 registra isso como ponto
// em aberto a verificar na base, não resolvido aqui. Contrato sem nenhum
// assessor ativo não aparece na tabela (não há "mentorado" pra mostrar).
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
  id_projeto: number | null;
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
    .select("id_contrato, id_contratante, status, origem_encerramento, id_partido_no_contrato, id_cargo_no_contrato, id_projeto")
    .in("id_contrato", idsContrato);
  if (erroContratos) throw erroContratos;
  const contratos = (contratosData ?? []) as RowContratoMentorado[];
  if (contratos.length === 0) return [];

  const { data: vinculosData, error: erroVinculos } = await client
    .from("rel_usuario_contrato")
    .select("id_contrato, id_usuario, papel_no_contrato")
    .in("id_contrato", idsContrato)
    .in("papel_no_contrato", ["assessor", "mentor"])
    .is("dt_fim", null);
  if (erroVinculos) throw erroVinculos;
  const vinculos = (vinculosData ?? []) as RowVinculo[];

  const mentorPorContrato = new Map<number, number>();
  const paresMentorado: { idContrato: number; idUsuarioMentorado: number }[] = [];
  for (const v of vinculos) {
    if (v.papel_no_contrato === "mentor" && !mentorPorContrato.has(v.id_contrato)) {
      mentorPorContrato.set(v.id_contrato, v.id_usuario);
    }
    if (v.papel_no_contrato === "assessor") {
      paresMentorado.push({ idContrato: v.id_contrato, idUsuarioMentorado: v.id_usuario });
    }
  }
  if (paresMentorado.length === 0) return [];

  const idsUsuario = Array.from(
    new Set([...mentorPorContrato.values(), ...paresMentorado.map((p) => p.idUsuarioMentorado)])
  );
  const { data: usuariosData, error: erroUsuarios } =
    idsUsuario.length > 0
      ? await client.from("dim_usuario").select("id_usuario, nome").in("id_usuario", idsUsuario)
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

  const idsProjeto = Array.from(
    new Set(contratos.map((c) => c.id_projeto).filter((id): id is number => id !== null))
  );
  const { data: projetosData, error: erroProjetos } =
    idsProjeto.length > 0
      ? await client.from("ref_projeto").select("id_projeto, nome").in("id_projeto", idsProjeto)
      : { data: [], error: null };
  if (erroProjetos) throw erroProjetos;
  const nomePorProjeto = new Map(
    ((projetosData ?? []) as { id_projeto: number; nome: string }[]).map((p) => [p.id_projeto, p.nome])
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

  return paresMentorado.map(({ idContrato, idUsuarioMentorado }) => {
    const contrato = contratoPorId.get(idContrato) as RowContratoMentorado;
    const mandato = mandatoPorContratante.get(contrato.id_contratante);
    const nomeUrna = mandato?.nm_urna ?? mandato?.nm_civil ?? "";
    const nomeCargo = contrato.id_cargo_no_contrato !== null ? nomePorCargo.get(contrato.id_cargo_no_contrato) : undefined;
    const prefixo = nomeCargo !== undefined ? (PREFIXO_CARGO[nomeCargo] ?? nomeCargo) : null;
    const idMentor = mentorPorContrato.get(idContrato);

    return {
      idContrato,
      nomeMentorado: nomesPorUsuario.get(idUsuarioMentorado) ?? "",
      nomeParlamentar: prefixo !== null && nomeUrna ? `${prefixo} ${nomeUrna}` : nomeUrna,
      siglaPartido: contrato.id_partido_no_contrato !== null ? siglaPorPartido.get(contrato.id_partido_no_contrato) ?? null : null,
      siglaUf: ufPorContratante.get(contrato.id_contratante) ?? null,
      nomeMentor: idMentor !== undefined ? nomesPorUsuario.get(idMentor) ?? null : null,
      mentoriasRealizadas: mentoriasPorContrato.get(idContrato) ?? 0,
      pctAtingimento: pctPorContrato.get(idContrato) ?? null,
      status: statusMentoradoPll(contrato.status, contrato.origem_encerramento),
      nomeEdicao: contrato.id_projeto !== null ? nomePorProjeto.get(contrato.id_projeto) ?? null : null,
    };
  });
}

// =============================================================================
// T7: buscarRegistrosMentores (PLL-DB-12…14)
// =============================================================================

// D-7: "Mentorado" no feed é o assessor do contrato -- mesmo mapeamento de
// papel usado em buscarMentoradosPll (T6), sem reaproveitar aquela função
// porque o recorte de saída é diferente (10 mais recentes do produto
// inteiro, não uma linha por contrato).
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
  const { data: vinculosData, error: erroVinculos } = await client
    .from("rel_usuario_contrato")
    .select("id_contrato, id_usuario")
    .in("id_contrato", idsContratoRegistros)
    .eq("papel_no_contrato", "assessor")
    .is("dt_fim", null);
  if (erroVinculos) throw erroVinculos;
  const mentoradoPorContrato = new Map<number, number>();
  for (const v of (vinculosData ?? []) as { id_contrato: number; id_usuario: number }[]) {
    if (!mentoradoPorContrato.has(v.id_contrato)) mentoradoPorContrato.set(v.id_contrato, v.id_usuario);
  }
  const idsMentorado = Array.from(new Set([...mentoradoPorContrato.values()]));
  const { data: mentoradosData, error: erroMentorados } =
    idsMentorado.length > 0
      ? await client.from("dim_usuario").select("id_usuario, nome").in("id_usuario", idsMentorado)
      : { data: [], error: null };
  if (erroMentorados) throw erroMentorados;
  const nomesPorMentorado = new Map(
    ((mentoradosData ?? []) as { id_usuario: number; nome: string }[]).map((u) => [u.id_usuario, u.nome])
  );

  return registros.map((r) => {
    const idMentorado = mentoradoPorContrato.get(r.id_contrato);
    return {
      idRegistro: r.id_registro,
      nomeAutor: nomesPorUsuario.get(r.id_usuario_autor) ?? "",
      nomeMentorado: idMentorado !== undefined ? nomesPorMentorado.get(idMentorado) ?? null : null,
      ocorridoEm: r.ocorrido_em,
      resumo: r.resumo,
    };
  });
}
