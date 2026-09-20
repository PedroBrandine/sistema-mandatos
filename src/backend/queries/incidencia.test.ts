import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import {
  buscarCadeiasIncidencia,
  buscarEncontrosDoContrato,
  buscarFatosGeradoresDoContrato,
  buscarIipContrato,
  buscarInsightsDoContrato,
  buscarNiveisIip,
  buscarPilaresInsight,
  buscarPreInsightsDoContrato,
  buscarRegistrosDaEtapa,
  buscarRegistrosDoContrato,
  buscarTimelineIncidencia,
  buscarTiposRegistroDaEtapa,
  buscarTipologiasAtivas,
  buscarTipologiasCompletas,
} from "./incidencia";

// Spec anchor: incidencia-encontros T26/T27 Done-when (.specs/features/incidencia-encontros/tasks.md) --
//  - Cada função mapeia snake_case -> camelCase/shape do design.md
//  - `if (!data) return []`/`null` quando a consulta não retorna linha
//  - Campos NULL-safe (AD-005): nrFatos/iipProvisorio ficam null, nunca 0
//  - T27: as 4 funções novas cobrem shape + [] vazio (join client-side com catálogo, mesmo
//    padrão de buscarBoardKanban)
//
// spec.md INC-01, INC-02, INC-04, INC-05, INC-07, INC-08, INC-09, INC-11, INC-12, INC-13,
// INC-14, INC-16.

type RespostaTabela = { data: unknown; error: { message: string } | null };
type Chamada = { tabela: string; metodo: string; args: unknown[] };

// Mesmo padrão de kanban.test.ts: mock roteado por nome de tabela, builder
// thenable (resolve direto quando aguardado sem `.maybeSingle()`).
function criarClienteMock(respostasPorTabela: Record<string, RespostaTabela>) {
  const chamadas: Chamada[] = [];

  function criarBuilder(tabela: string) {
    const resposta = respostasPorTabela[tabela] ?? { data: null, error: null };
    const builder: Record<string, unknown> = {
      select: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "select", args });
        return builder;
      },
      eq: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "eq", args });
        return builder;
      },
      in: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "in", args });
        return builder;
      },
      gte: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "gte", args });
        return builder;
      },
      lte: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "lte", args });
        return builder;
      },
      order: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "order", args });
        return builder;
      },
      maybeSingle: () => {
        chamadas.push({ tabela, metodo: "maybeSingle", args: [] });
        return Promise.resolve(resposta);
      },
      then: (resolve: (valor: RespostaTabela) => void, reject: (erro: unknown) => void) =>
        Promise.resolve(resposta).then(resolve, reject),
    };
    return builder;
  }

  const client = {
    from: (tabela: string) => {
      chamadas.push({ tabela, metodo: "from", args: [tabela] });
      return criarBuilder(tabela);
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

describe("buscarIipContrato", () => {
  it("mapeia nr_fatos/iip_provisorio/componente_dN de vw_iip_contrato para o view-model", async () => {
    const { client, chamadas } = criarClienteMock({
      vw_iip_contrato: {
        data: { nr_fatos: 3, iip_provisorio: 12, componente_d1: 5, componente_d2: 4, componente_d3: 3 },
        error: null,
      },
    });

    const resultado = await buscarIipContrato(client, 42);

    expect(resultado).toEqual({
      nrFatos: 3,
      iipProvisorio: 12,
      componenteD1: 5,
      componenteD2: 4,
      componenteD3: 3,
    });
    const chamadaEq = chamadas.find((c) => c.tabela === "vw_iip_contrato" && c.metodo === "eq");
    expect(chamadaEq?.args).toEqual(["id_contrato", 42]);
  });

  // AD-005/Edge Case: contrato sem Fato Gerador -- todas as 5 colunas NULL, nunca 0.
  it("retorna nrFatos/iipProvisorio/componenteDN null quando o contrato não tem Fato Gerador", async () => {
    const { client } = criarClienteMock({
      vw_iip_contrato: {
        data: { nr_fatos: null, iip_provisorio: null, componente_d1: null, componente_d2: null, componente_d3: null },
        error: null,
      },
    });

    const resultado = await buscarIipContrato(client, 42);
    expect(resultado).toEqual({
      nrFatos: null,
      iipProvisorio: null,
      componenteD1: null,
      componenteD2: null,
      componenteD3: null,
    });
  });

  it("retorna null quando a view não tem nenhuma linha para o contrato", async () => {
    const { client } = criarClienteMock({ vw_iip_contrato: { data: null, error: null } });
    const resultado = await buscarIipContrato(client, 999);
    expect(resultado).toBeNull();
  });

  it("propaga o erro do PostgREST em vez de engolir", async () => {
    const { client } = criarClienteMock({ vw_iip_contrato: { data: null, error: { message: "boom" } } });
    await expect(buscarIipContrato(client, 1)).rejects.toEqual({ message: "boom" });
  });
});

describe("buscarTipologiasAtivas", () => {
  it("concatena grupo · tipologia · estado em nome (catálogo sem campo único de rótulo)", async () => {
    const { client } = criarClienteMock({
      ref_tipologia: {
        data: [{ id_tipologia: 1, grupo: "1. Planejamento e Agenda", tipologia: "Pautar Debates", estado: "Iniciado" }],
        error: null,
      },
    });

    const resultado = await buscarTipologiasAtivas(client);
    expect(resultado).toEqual([{ id: 1, nome: "1. Planejamento e Agenda · Pautar Debates · Iniciado" }]);
  });

  it("retorna [] quando não há nenhuma ref_tipologia ativa", async () => {
    const { client } = criarClienteMock({ ref_tipologia: { data: [], error: null } });
    expect(await buscarTipologiasAtivas(client)).toEqual([]);
  });
});

// Achado de UAT (Pedro, 2026-08-14): nível/preditor são atributo fixo da
// combinação Grupo+Tipologia+Estado (ref_tipologia.*_padrao), não escolha
// livre por ocorrência -- ver fato-gerador-form.tsx.
describe("buscarTipologiasCompletas", () => {
  it("mapeia a linha completa + nome dos preditores (resolvido client-side)", async () => {
    const { client } = criarClienteMock({
      ref_tipologia: {
        data: [
          {
            id_tipologia: 3,
            grupo: "2. Produção Legislativa",
            tipologia: "Projeto de lei / proposição",
            estado: "Aprovado em plenário",
            nivel_d1_padrao: "alto",
            nivel_d2_padrao: "alto",
            nivel_d3_padrao: "alto",
            id_preditor_1: 10,
            id_preditor_2: 20,
          },
        ],
        error: null,
      },
      ref_preditor: {
        data: [
          { id_preditor: 10, nome: "Articulam e mobilizam para a entrega de resultados" },
          { id_preditor: 20, nome: "Pautam os Debates" },
        ],
        error: null,
      },
    });

    const resultado = await buscarTipologiasCompletas(client);

    expect(resultado).toEqual([
      {
        idTipologia: 3,
        grupo: "2. Produção Legislativa",
        tipologia: "Projeto de lei / proposição",
        estado: "Aprovado em plenário",
        nivelD1Padrao: "alto",
        nivelD2Padrao: "alto",
        nivelD3Padrao: "alto",
        idPreditor1: 10,
        idPreditor2: 20,
        nomePreditor1: "Articulam e mobilizam para a entrega de resultados",
        nomePreditor2: "Pautam os Debates",
      },
    ]);
  });

  it("nomePreditor1/2 ficam null quando id_preditor_1/2 são null (sem 2ª consulta a ref_preditor)", async () => {
    const { client, chamadas } = criarClienteMock({
      ref_tipologia: {
        data: [
          {
            id_tipologia: 1,
            grupo: "1. Planejamento e Agenda",
            tipologia: "Planejamento estratégico do mandato",
            estado: "Diagnóstico realizado",
            nivel_d1_padrao: "baixo",
            nivel_d2_padrao: "baixo",
            nivel_d3_padrao: "baixo",
            id_preditor_1: null,
            id_preditor_2: null,
          },
        ],
        error: null,
      },
    });

    const resultado = await buscarTipologiasCompletas(client);

    expect(resultado[0].nomePreditor1).toBeNull();
    expect(resultado[0].nomePreditor2).toBeNull();
    expect(chamadas.some((c) => c.tabela === "ref_preditor")).toBe(false);
  });

  it("retorna [] quando não há nenhuma ref_tipologia ativa", async () => {
    const { client } = criarClienteMock({ ref_tipologia: { data: [], error: null } });
    expect(await buscarTipologiasCompletas(client)).toEqual([]);
  });
});

describe("buscarPilaresInsight", () => {
  it("mapeia id_pilar/nome para RefOption", async () => {
    const { client } = criarClienteMock({
      ref_pilar_insight: { data: [{ id_pilar: 1, nome: "Consciência" }], error: null },
    });

    expect(await buscarPilaresInsight(client)).toEqual([{ id: 1, nome: "Consciência" }]);
  });

  it("retorna [] quando não há nenhum ref_pilar_insight ativo", async () => {
    const { client } = criarClienteMock({ ref_pilar_insight: { data: [], error: null } });
    expect(await buscarPilaresInsight(client)).toEqual([]);
  });
});

describe("buscarNiveisIip", () => {
  it("mapeia codigo/rotulo de ref_nivel_iip", async () => {
    const { client } = criarClienteMock({
      ref_nivel_iip: {
        data: [
          { codigo: "baixo", rotulo: "Baixo" },
          { codigo: "maximo", rotulo: "Máximo" },
        ],
        error: null,
      },
    });

    expect(await buscarNiveisIip(client)).toEqual([
      { codigo: "baixo", rotulo: "Baixo" },
      { codigo: "maximo", rotulo: "Máximo" },
    ]);
  });

  it("retorna [] quando ref_nivel_iip não tem nenhuma linha", async () => {
    const { client } = criarClienteMock({ ref_nivel_iip: { data: [], error: null } });
    expect(await buscarNiveisIip(client)).toEqual([]);
  });
});

describe("buscarTiposRegistroDaEtapa", () => {
  it("mapeia id_tipo_registro/nome de ref_tipo_registro filtrado pela etapa", async () => {
    const { client, chamadas } = criarClienteMock({
      ref_tipo_registro: { data: [{ id_tipo_registro: 5, nome: "Monitoramento mensal" }], error: null },
    });

    const resultado = await buscarTiposRegistroDaEtapa(client, 10);

    expect(resultado).toEqual([{ id: 5, nome: "Monitoramento mensal" }]);
    const eqs = chamadas.filter((c) => c.tabela === "ref_tipo_registro" && c.metodo === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["id_etapa", 10]);
  });

  // Edge Case (spec.md): Coalizão não tem ref_tipo_registro seedado -- retorna [], não erro.
  it("retorna [] quando a etapa não tem nenhum tipo de registro cadastrado (ex.: Coalizão)", async () => {
    const { client } = criarClienteMock({ ref_tipo_registro: { data: [], error: null } });
    expect(await buscarTiposRegistroDaEtapa(client, 999)).toEqual([]);
  });
});

describe("buscarRegistrosDaEtapa", () => {
  it("mapeia fat_registro da etapa com tipoRegistro/nomeAutor resolvidos por join client-side", async () => {
    const { client, chamadas } = criarClienteMock({
      ref_tipo_registro: { data: [{ id_tipo_registro: 5, nome: "Monitoramento mensal" }], error: null },
      fat_registro: {
        data: [{ id_registro: 1, id_tipo_registro: 5, ocorrido_em: "2026-08-01", resumo: "Reunião ok", id_usuario_autor: 9 }],
        error: null,
      },
      dim_usuario: { data: [{ id_usuario: 9, nome: "Fulano" }], error: null },
    });

    const resultado = await buscarRegistrosDaEtapa(client, 100, 10);

    expect(resultado).toEqual([
      { idRegistro: 1, tipoRegistro: "Monitoramento mensal", ocorridoEm: "2026-08-01", resumo: "Reunião ok", nomeAutor: "Fulano" },
    ]);
    const eqsRegistro = chamadas.filter((c) => c.tabela === "fat_registro" && c.metodo === "eq").map((c) => c.args);
    expect(eqsRegistro).toContainEqual(["id_contrato", 100]);
  });

  // Edge Case (spec.md): Coalizão sem ref_tipo_registro seedado -- lista de Registro vazia, não erro.
  it("retorna [] quando a etapa não tem nenhum tipo de registro cadastrado", async () => {
    const { client } = criarClienteMock({ ref_tipo_registro: { data: [], error: null } });
    expect(await buscarRegistrosDaEtapa(client, 100, 999)).toEqual([]);
  });

  it("retorna [] quando não há nenhum fat_registro para os tipos da etapa", async () => {
    const { client } = criarClienteMock({
      ref_tipo_registro: { data: [{ id_tipo_registro: 5, nome: "Monitoramento mensal" }], error: null },
      fat_registro: { data: [], error: null },
    });
    expect(await buscarRegistrosDaEtapa(client, 100, 10)).toEqual([]);
  });
});

// FGC-16 (T25). Mesmo shape de buscarRegistrosDaEtapa, sem filtro por etapa
// -- resolve pelos tipos realmente usados nos registros do contrato inteiro.
describe("buscarRegistrosDoContrato", () => {
  it("mapeia todos os fat_registro do contrato, sem filtrar por etapa", async () => {
    const { client, chamadas } = criarClienteMock({
      fat_registro: {
        data: [
          { id_registro: 1, id_tipo_registro: 5, ocorrido_em: "2026-08-01", resumo: "Reunião ok", id_usuario_autor: 9 },
          { id_registro: 2, id_tipo_registro: 6, ocorrido_em: "2026-08-02", resumo: null, id_usuario_autor: 9 },
        ],
        error: null,
      },
      ref_tipo_registro: {
        data: [
          { id_tipo_registro: 5, nome: "Monitoramento mensal" },
          { id_tipo_registro: 6, nome: "Sprint" },
        ],
        error: null,
      },
      dim_usuario: { data: [{ id_usuario: 9, nome: "Fulano" }], error: null },
    });

    const resultado = await buscarRegistrosDoContrato(client, 100);

    expect(resultado).toEqual([
      { idRegistro: 1, tipoRegistro: "Monitoramento mensal", ocorridoEm: "2026-08-01", resumo: "Reunião ok", nomeAutor: "Fulano" },
      { idRegistro: 2, tipoRegistro: "Sprint", ocorridoEm: "2026-08-02", resumo: null, nomeAutor: "Fulano" },
    ]);
    const eqsRegistro = chamadas.filter((c) => c.tabela === "fat_registro" && c.metodo === "eq").map((c) => c.args);
    expect(eqsRegistro).toEqual([["id_contrato", 100]]);
    // Nenhum filtro de etapa -- diferença estrutural de buscarRegistrosDaEtapa.
    expect(chamadas.some((c) => c.tabela === "ref_tipo_registro" && c.metodo === "eq")).toBe(false);
  });

  it("retorna [] quando o contrato não tem nenhum registro -- lado oposto", async () => {
    const { client } = criarClienteMock({ fat_registro: { data: [], error: null } });
    expect(await buscarRegistrosDoContrato(client, 100)).toEqual([]);
  });
});

describe("buscarEncontrosDoContrato", () => {
  it("mapeia fat_encontro do contrato para EncontroResumo", async () => {
    const { client, chamadas } = criarClienteMock({
      fat_encontro: {
        data: [
          { id_encontro: 1, titulo: "Reunião com gabinete", status: "planejado", dt_prevista_inicio: "2026-09-01", dt_realizada: null },
        ],
        error: null,
      },
    });

    const resultado = await buscarEncontrosDoContrato(client, 100);

    expect(resultado).toEqual([
      { idEncontro: 1, titulo: "Reunião com gabinete", status: "planejado", dtPrevistaInicio: "2026-09-01", dtRealizada: null },
    ]);
    const eqs = chamadas.filter((c) => c.tabela === "fat_encontro" && c.metodo === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["id_contrato", 100]);
  });

  it("retorna [] quando o contrato não tem nenhum Encontro", async () => {
    const { client } = criarClienteMock({ fat_encontro: { data: [], error: null } });
    expect(await buscarEncontrosDoContrato(client, 100)).toEqual([]);
  });
});

describe("buscarInsightsDoContrato", () => {
  it("mapeia fat_insight do contrato com pilar resolvido por join client-side", async () => {
    const { client } = criarClienteMock({
      fat_insight: {
        data: [{ id_insight: 1, conteudo: "Observação", id_pilar: 2, ocorrido_em: "2026-08-01" }],
        error: null,
      },
      ref_pilar_insight: { data: [{ id_pilar: 2, nome: "Consciência" }], error: null },
    });

    const resultado = await buscarInsightsDoContrato(client, 100);

    expect(resultado).toEqual([{ idInsight: 1, conteudo: "Observação", pilar: "Consciência", ocorridoEm: "2026-08-01" }]);
  });

  // Edge Case (spec.md): Insight sem Pilar (id_pilar nullable) -- pilar null, sem consulta extra.
  it("mapeia pilar null quando id_pilar é null (sem origem)", async () => {
    const { client, chamadas } = criarClienteMock({
      fat_insight: { data: [{ id_insight: 1, conteudo: "Observação", id_pilar: null, ocorrido_em: null }], error: null },
    });

    const resultado = await buscarInsightsDoContrato(client, 100);

    expect(resultado).toEqual([{ idInsight: 1, conteudo: "Observação", pilar: null, ocorridoEm: null }]);
    expect(chamadas.some((c) => c.tabela === "ref_pilar_insight")).toBe(false);
  });

  it("retorna [] quando o contrato não tem nenhum Insight", async () => {
    const { client } = criarClienteMock({ fat_insight: { data: [], error: null } });
    expect(await buscarInsightsDoContrato(client, 100)).toEqual([]);
  });
});

describe("buscarFatosGeradoresDoContrato", () => {
  it("mapeia fat_fato_gerador do contrato com tipologia concatenada, niveis d1/d2/d3 e titulo/situacao/dt_prevista (T11)", async () => {
    const { client } = criarClienteMock({
      fat_fato_gerador: {
        data: [
          {
            id_fato_gerador: 1,
            id_tipologia: 3,
            nivel_d1: "alto",
            nivel_d2: null,
            nivel_d3: null,
            titulo: "Aprovação do projeto de lei",
            situacao: "realizado",
            dt_ocorrencia: "2026-08-01",
            dt_prevista: null,
          },
        ],
        error: null,
      },
      ref_tipologia: {
        data: [{ id_tipologia: 3, grupo: "1. Planejamento e Agenda", tipologia: "Pautar Debates", estado: "Iniciado" }],
        error: null,
      },
    });

    const resultado = await buscarFatosGeradoresDoContrato(client, 100);

    expect(resultado).toEqual([
      {
        idFatoGerador: 1,
        tipologia: "1. Planejamento e Agenda · Pautar Debates · Iniciado",
        niveis: { d1: "alto", d2: null, d3: null },
        titulo: "Aprovação do projeto de lei",
        situacao: "realizado",
        dtOcorrencia: "2026-08-01",
        dtPrevista: null,
      },
    ]);
  });

  // FGC-06/FGC-08 (T11): fato projetado ainda não tem dt_ocorrencia -- vem
  // null, situacao reflete "projetado", dtPrevista preenchida.
  it("mapeia um fato projetado sem dt_ocorrencia, com dt_prevista preenchida", async () => {
    const { client } = criarClienteMock({
      fat_fato_gerador: {
        data: [
          {
            id_fato_gerador: 2,
            id_tipologia: 3,
            nivel_d1: "alto",
            nivel_d2: null,
            nivel_d3: null,
            titulo: "Sanção esperada do projeto de lei",
            situacao: "projetado",
            dt_ocorrencia: null,
            dt_prevista: "2026-12-01",
          },
        ],
        error: null,
      },
      ref_tipologia: {
        data: [{ id_tipologia: 3, grupo: "1. Planejamento e Agenda", tipologia: "Pautar Debates", estado: "Iniciado" }],
        error: null,
      },
    });

    const resultado = await buscarFatosGeradoresDoContrato(client, 100);

    expect(resultado[0]).toMatchObject({ situacao: "projetado", dtOcorrencia: null, dtPrevista: "2026-12-01" });
  });

  it("retorna [] quando o contrato não tem nenhum Fato Gerador", async () => {
    const { client } = criarClienteMock({ fat_fato_gerador: { data: [], error: null } });
    expect(await buscarFatosGeradoresDoContrato(client, 100)).toEqual([]);
  });
});

describe("buscarPreInsightsDoContrato", () => {
  // FGC-05 (T11): mesmo molde de buscarInsightsDoContrato, sem join.
  it("mapeia fat_pre_insight do contrato para PreInsightResumo", async () => {
    const { client, chamadas } = criarClienteMock({
      fat_pre_insight: {
        data: [{ id_pre_insight: 1, conteudo: "Sinal bruto captado em reunião", ocorrido_em: "2026-09-01" }],
        error: null,
      },
    });

    const resultado = await buscarPreInsightsDoContrato(client, 100);

    expect(resultado).toEqual([
      { idPreInsight: 1, conteudo: "Sinal bruto captado em reunião", ocorridoEm: "2026-09-01" },
    ]);
    const eqs = chamadas.filter((c) => c.tabela === "fat_pre_insight" && c.metodo === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["id_contrato", 100]);
  });

  it("mapeia ocorridoEm null quando ocorrido_em é null", async () => {
    const { client } = criarClienteMock({
      fat_pre_insight: {
        data: [{ id_pre_insight: 1, conteudo: "Sinal bruto", ocorrido_em: null }],
        error: null,
      },
    });

    const resultado = await buscarPreInsightsDoContrato(client, 100);
    expect(resultado[0].ocorridoEm).toBeNull();
  });

  it("retorna [] quando o contrato não tem nenhum Pré-Insight", async () => {
    const { client } = criarClienteMock({ fat_pre_insight: { data: [], error: null } });
    expect(await buscarPreInsightsDoContrato(client, 100)).toEqual([]);
  });
});

describe("buscarTimelineIncidencia", () => {
  // FGC-10/FGC-13 (T12): union dos 4 tipos já feita pela view -- a query só filtra por contrato.
  it("mapeia vw_timeline_incidencia sem filtro de período", async () => {
    const { client, chamadas } = criarClienteMock({
      vw_timeline_incidencia: {
        data: [
          {
            tipo: "fato_gerador",
            id_origem: 1,
            titulo: "Aprovação do projeto de lei",
            data_evento: "2026-08-01",
            criado_em: "2026-08-01T10:00:00Z",
            id_usuario_autor: 9,
          },
        ],
        error: null,
      },
      dim_usuario: { data: [{ id_usuario: 9, nome: "Fulano" }], error: null },
    });

    const resultado = await buscarTimelineIncidencia(client, 100);

    expect(resultado).toEqual([
      {
        tipo: "fato_gerador",
        idOrigem: 1,
        titulo: "Aprovação do projeto de lei",
        dataEvento: "2026-08-01",
        criadoEm: "2026-08-01T10:00:00Z",
        idUsuarioAutor: 9,
        nomeAutor: "Fulano",
      },
    ]);
    expect(chamadas.some((c) => c.tabela === "vw_timeline_incidencia" && c.metodo === "gte")).toBe(false);
    expect(chamadas.some((c) => c.tabela === "vw_timeline_incidencia" && c.metodo === "lte")).toBe(false);
    const eqs = chamadas
      .filter((c) => c.tabela === "vw_timeline_incidencia" && c.metodo === "eq")
      .map((c) => c.args);
    expect(eqs).toContainEqual(["id_contrato", 100]);
  });

  // spec.md P1 (Linha do Tempo) AC3: "o usuário escolhe um período THEN o feed SHALL respeitá-lo".
  it("aplica gte/lte quando o período (inicio/fim) é informado", async () => {
    const { client, chamadas } = criarClienteMock({
      vw_timeline_incidencia: { data: [], error: null },
    });

    await buscarTimelineIncidencia(client, 100, { inicio: "2026-08-01", fim: "2026-08-31" });

    const gtes = chamadas
      .filter((c) => c.tabela === "vw_timeline_incidencia" && c.metodo === "gte")
      .map((c) => c.args);
    const ltes = chamadas
      .filter((c) => c.tabela === "vw_timeline_incidencia" && c.metodo === "lte")
      .map((c) => c.args);
    expect(gtes).toContainEqual(["data_evento", "2026-08-01"]);
    expect(ltes).toContainEqual(["data_evento", "2026-08-31"]);
  });

  it("retorna [] quando o contrato não tem nenhum item na timeline", async () => {
    const { client } = criarClienteMock({ vw_timeline_incidencia: { data: [], error: null } });
    expect(await buscarTimelineIncidencia(client, 100)).toEqual([]);
  });
});

describe("buscarCadeiasIncidencia", () => {
  // FGC-13 (T12): 1 linha por Fato Gerador, chave_origem é responsabilidade da view (T5).
  // Acerto de fidelidade visual (pós-Verifier, mockup 109:4): resolve o passo
  // de origem (Insight/Pré-Insight/Registro/Meta) a partir de chaveOrigem.
  it("mapeia vw_cadeia_incidencia do contrato e resolve a origem Insight", async () => {
    const { client, chamadas } = criarClienteMock({
      vw_cadeia_incidencia: {
        data: [
          {
            id_fato_gerador: 1,
            titulo: "Aprovação do projeto de lei",
            situacao: "realizado",
            data_evento: "2026-08-01",
            chave_origem: "insight:8",
          },
        ],
        error: null,
      },
      fat_insight: { data: [{ id_insight: 8, conteudo: "Insight de origem", ocorrido_em: "2026-07-20" }], error: null },
    });

    const resultado = await buscarCadeiasIncidencia(client, 100);

    expect(resultado).toEqual([
      {
        idFatoGerador: 1,
        titulo: "Aprovação do projeto de lei",
        situacao: "realizado",
        dataEvento: "2026-08-01",
        chaveOrigem: "insight:8",
        origem: { tipo: "insight", titulo: "Insight de origem", dataEvento: "2026-07-20" },
      },
    ]);
    const eqs = chamadas
      .filter((c) => c.tabela === "vw_cadeia_incidencia" && c.metodo === "eq")
      .map((c) => c.args);
    expect(eqs).toContainEqual(["id_contrato", 100]);
    const insightIns = chamadas.filter((c) => c.tabela === "fat_insight" && c.metodo === "in").map((c) => c.args);
    expect(insightIns).toContainEqual(["id_insight", [8]]);
  });

  it("resolve a origem Meta (fat_meta, fora do domínio da Incidência) -- lado oposto do tipo", async () => {
    const { client } = criarClienteMock({
      vw_cadeia_incidencia: {
        data: [
          { id_fato_gerador: 2, titulo: "Fato via Meta", situacao: "realizado", data_evento: "2026-08-05", chave_origem: "meta:3" },
        ],
        error: null,
      },
      fat_meta: { data: [{ id_meta: 3, descricao: "Meta de origem", criado_em: "2026-06-01T12:00:00Z" }], error: null },
    });

    const resultado = await buscarCadeiasIncidencia(client, 100);
    expect(resultado[0].origem).toEqual({ tipo: "meta", titulo: "Meta de origem", dataEvento: "2026-06-01" });
  });

  it("cadeia direta no fato (chave 'fato:<id>') não tem origem -- lado oposto de ter origem", async () => {
    const { client } = criarClienteMock({
      vw_cadeia_incidencia: {
        data: [{ id_fato_gerador: 3, titulo: "Fato solo", situacao: "realizado", data_evento: "2026-08-06", chave_origem: "fato:3" }],
        error: null,
      },
    });

    const resultado = await buscarCadeiasIncidencia(client, 100);
    expect(resultado[0].origem).toBeNull();
  });

  it("retorna [] quando o contrato não tem nenhum Fato Gerador", async () => {
    const { client } = criarClienteMock({ vw_cadeia_incidencia: { data: [], error: null } });
    expect(await buscarCadeiasIncidencia(client, 100)).toEqual([]);
  });
});
