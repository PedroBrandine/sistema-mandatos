import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

// diagnostico-participante-pll (Agenda do PLL, Figma 328:1262). A Agenda de
// um contrato PLL não é o calendário genérico (/contratos/[id]/agenda usa
// buscarEncontrosDoMes, recorte por mês) -- é uma grade FIXA de N Mentorias
// (`ref_tipo_registro` 'PLL'/'mentorias'/'mentoria', `qtd_prevista=5` no seed
// atual, lido daqui, nunca hardcoded -- AD-004), cada slot com no máximo um
// `fat_encontro` "vivo" (`uq_encontro_sequencia`) e no máximo um
// `fat_registro` (`uq_registro_sequencia`).

export interface MentoriaRegistro {
  resumo: string | null;
  nomeAutor: string;
}

export interface MentoriaSlot {
  nrSequencia: number;
  idEncontro: number | null;
  /** null = slot sem nenhum encontro agendado ainda ("Não preenchido", Figma). */
  status: "planejado" | "realizado" | "cancelado" | "remarcado" | null;
  dtPrevistaInicio: string | null;
  dtRealizada: string | null;
  registro: MentoriaRegistro | null;
}

export interface AgendaMentoriasPll {
  /** IDs pra montar o "Agendar" (criarEncontro exige idEtapa/idTipoRegistro). */
  idEtapa: number;
  idTipoRegistro: number;
  qtdPrevista: number;
  nomeMentor: string | null;
  slots: MentoriaSlot[];
}

interface RowEncontro {
  id_encontro: number;
  nr_sequencia: number | null;
  status: string;
  dt_prevista_inicio: string | null;
  dt_realizada: string | null;
  criado_em: string;
}

interface RowRegistro {
  nr_sequencia: number | null;
  resumo: string | null;
  dim_usuario: { nome: string } | null;
}

/**
 * Grade fixa de Mentorias do contrato PLL (Figma 328:1262). Devolve `null`
 * quando o contrato não pertence a um produto com etapa/tipo 'mentorias'/
 * 'mentoria' provisionados (nunca deveria acontecer pra um contrato PLL real
 * -- edge case defensivo, AD-005: ausência é estado, não exceção).
 */
export async function buscarAgendaMentoriasPll(
  client: SupabaseClient<Database>,
  idContrato: number
): Promise<AgendaMentoriasPll | null> {
  const { data: contrato, error: erroContrato } = await client
    .from("fat_contrato")
    .select("id_produto")
    .eq("id_contrato", idContrato)
    .maybeSingle();
  if (erroContrato) throw erroContrato;
  if (!contrato) return null;

  const { data: etapa, error: erroEtapa } = await client
    .from("ref_etapa")
    .select("id_etapa")
    .eq("id_produto", contrato.id_produto)
    .eq("codigo", "mentorias")
    .maybeSingle();
  if (erroEtapa) throw erroEtapa;
  if (!etapa) return null;

  const { data: tipoRegistro, error: erroTipo } = await client
    .from("ref_tipo_registro")
    .select("id_tipo_registro, qtd_prevista")
    .eq("id_etapa", etapa.id_etapa)
    .eq("codigo", "mentoria")
    .maybeSingle();
  if (erroTipo) throw erroTipo;
  if (!tipoRegistro || tipoRegistro.qtd_prevista == null) return null;

  const [{ data: encontros, error: erroEncontros }, { data: registros, error: erroRegistros }, { data: mentor, error: erroMentor }] =
    await Promise.all([
      client
        .from("fat_encontro")
        .select("id_encontro, nr_sequencia, status, dt_prevista_inicio, dt_realizada, criado_em")
        .eq("id_contrato", idContrato)
        .eq("id_tipo_registro", tipoRegistro.id_tipo_registro)
        .not("nr_sequencia", "is", null)
        .order("criado_em", { ascending: false }),
      client
        .from("fat_registro")
        .select("nr_sequencia, resumo, dim_usuario(nome)")
        .eq("id_contrato", idContrato)
        .eq("id_tipo_registro", tipoRegistro.id_tipo_registro)
        .not("nr_sequencia", "is", null),
      client
        .from("rel_usuario_contrato")
        .select("dim_usuario(nome)")
        .eq("id_contrato", idContrato)
        .eq("papel_no_contrato", "mentor")
        .is("dt_fim", null)
        .limit(1)
        .maybeSingle(),
    ]);
  if (erroEncontros) throw erroEncontros;
  if (erroRegistros) throw erroRegistros;
  if (erroMentor) throw erroMentor;

  // Um slot pode ter mais de um fat_encontro ao longo do tempo (um
  // cancelado, outro agendado depois) -- uq_encontro_sequencia garante no
  // máximo 1 "vivo" (planejado/realizado) por vez, mas não impede vários
  // cancelados acumulados. Critério: prefere o vivo; sem nenhum vivo, o mais
  // recente (criado_em desc, já ordenado pela query).
  const encontroPorSlot = new Map<number, RowEncontro>();
  for (const linha of (encontros ?? []) as RowEncontro[]) {
    if (linha.nr_sequencia == null) continue;
    const atual = encontroPorSlot.get(linha.nr_sequencia);
    if (!atual) {
      encontroPorSlot.set(linha.nr_sequencia, linha);
      continue;
    }
    const atualEhVivo = atual.status === "planejado" || atual.status === "realizado";
    const linhaEhViva = linha.status === "planejado" || linha.status === "realizado";
    if (linhaEhViva && !atualEhVivo) encontroPorSlot.set(linha.nr_sequencia, linha);
  }

  const registroPorSlot = new Map<number, MentoriaRegistro>();
  for (const linha of (registros ?? []) as unknown as RowRegistro[]) {
    if (linha.nr_sequencia == null || !linha.dim_usuario) continue;
    registroPorSlot.set(linha.nr_sequencia, { resumo: linha.resumo, nomeAutor: linha.dim_usuario.nome });
  }

  const nomeMentor = (mentor as unknown as { dim_usuario: { nome: string } | null } | null)?.dim_usuario?.nome ?? null;

  const slots: MentoriaSlot[] = Array.from({ length: tipoRegistro.qtd_prevista }, (_, i) => {
    const nrSequencia = i + 1;
    const encontro = encontroPorSlot.get(nrSequencia) ?? null;
    return {
      nrSequencia,
      idEncontro: encontro?.id_encontro ?? null,
      status: (encontro?.status as MentoriaSlot["status"]) ?? null,
      dtPrevistaInicio: encontro?.dt_prevista_inicio ?? null,
      dtRealizada: encontro?.dt_realizada ?? null,
      registro: registroPorSlot.get(nrSequencia) ?? null,
    };
  });

  return {
    idEtapa: etapa.id_etapa,
    idTipoRegistro: tipoRegistro.id_tipo_registro,
    qtdPrevista: tipoRegistro.qtd_prevista,
    nomeMentor,
    slots,
  };
}
