import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { intervaloDoMes, resolverIdsContratoDoFiltro, type FiltroAgenda } from "./agenda";

// EST-12 AC5 (T27, design.md "AgendaMes + EncontroPopover" -- Interfaces:
// `buscarRegistrosDaAgenda(client, { idEncontro? })`).
//
// O recorte é o MESMO da grade (produto, mês, gestora, projeto, contrato):
// a lista de Registros vive ao lado do calendário e acompanha seus filtros.
// Por isso o filtro estende FiltroAgenda em vez de declarar um recorte
// próprio, e o resolvedor de contratos é reusado de queries/agenda.ts.
//
// `idEncontro` é o filtro adicional de AC5 -- quando a usuária seleciona um
// encontro na grade, a lista passa a mostrar só os registros dele. Ausente,
// a lista mostra todos os registros do recorte.
export interface FiltroRegistrosAgenda extends FiltroAgenda {
  idEncontro?: number;
}

// Campos que o "Done when" da T27 nomeia: tipo, data, descrição e
// responsável. Mesmos nomes de RegistroResumo em queries/incidencia.ts, mais
// o vínculo com o encontro (AC5) e o contrato.
// Nulo passa adiante como nulo (AD-005).
export interface RegistroAgenda {
  idRegistro: number;
  idEncontro: number | null;
  idContrato: number;
  tipoRegistro: string;
  ocorridoEm: string;
  resumo: string | null;
  nomeAutor: string;
}

interface RowRegistro {
  id_registro: number;
  id_encontro: number | null;
  id_contrato: number;
  id_tipo_registro: number;
  ocorrido_em: string;
  resumo: string | null;
  id_usuario_autor: number;
}

// EST-12 AC5 (T27). Registros do recorte da Agenda, opcionalmente filtrados
// por encontro. Recorte sem registro devolve [], nunca lança -- mesmo padrão
// de buscarBoardKanban e de buscarEncontrosDoMes (T25).
export async function buscarRegistrosDaAgenda(
  client: SupabaseClient<Database>,
  filtro: FiltroRegistrosAgenda
): Promise<RegistroAgenda[]> {
  const idsContrato = await resolverIdsContratoDoFiltro(client, filtro);
  if (idsContrato.length === 0) return [];

  // O recorte de mês vale para os registros tanto quanto para os encontros:
  // sem ele, `ano`/`mes` do filtro só resolviam os contratos e a lista repetia
  // os mesmos registros em qualquer mês navegado (relato do Pedro, 2026-09-12,
  // vendo registros de agosto na tela de setembro). Mesmo par gte/lt e mesmo
  // `intervaloDoMes` de buscarEncontrosDoMes (T25), para os dois recortes não
  // divergirem na virada de mês nem no fuso.
  const { inicio, fim } = intervaloDoMes(filtro.ano, filtro.mes);

  let query = client
    .from("fat_registro")
    .select("id_registro, id_encontro, id_contrato, id_tipo_registro, ocorrido_em, resumo, id_usuario_autor")
    .in("id_contrato", idsContrato)
    .gte("ocorrido_em", inicio)
    .lt("ocorrido_em", fim);

  if (filtro.idEncontro !== undefined) {
    query = query.eq("id_encontro", filtro.idEncontro);
  }

  const { data, error } = await query.order("ocorrido_em", { ascending: false });
  if (error) throw error;

  const registros = (data ?? []) as RowRegistro[];
  if (registros.length === 0) return [];

  const idsTipo = Array.from(new Set(registros.map((r) => r.id_tipo_registro)));
  const { data: tipos, error: erroTipos } = await client
    .from("ref_tipo_registro")
    .select("id_tipo_registro, nome")
    .in("id_tipo_registro", idsTipo);
  if (erroTipos) throw erroTipos;
  const nomesPorTipo = new Map(
    ((tipos ?? []) as { id_tipo_registro: number; nome: string }[]).map((t) => [
      t.id_tipo_registro,
      t.nome,
    ])
  );

  const idsUsuario = Array.from(new Set(registros.map((r) => r.id_usuario_autor)));
  const { data: usuarios, error: erroUsuarios } = await client
    .from("dim_usuario")
    .select("id_usuario, nome")
    .in("id_usuario", idsUsuario);
  if (erroUsuarios) throw erroUsuarios;
  const nomesPorUsuario = new Map(
    ((usuarios ?? []) as { id_usuario: number; nome: string }[]).map((u) => [u.id_usuario, u.nome])
  );

  return registros.map((r) => ({
    idRegistro: r.id_registro,
    idEncontro: r.id_encontro,
    idContrato: r.id_contrato,
    tipoRegistro: nomesPorTipo.get(r.id_tipo_registro) ?? "",
    ocorridoEm: r.ocorrido_em,
    resumo: r.resumo,
    nomeAutor: nomesPorUsuario.get(r.id_usuario_autor) ?? "",
  }));
}
