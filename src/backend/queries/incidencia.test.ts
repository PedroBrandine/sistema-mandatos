import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import {
  buscarEncontrosDoContrato,
  buscarFatosGeradoresDoContrato,
  buscarIipContrato,
  buscarInsightsDoContrato,
  buscarNiveisIip,
  buscarPilaresInsight,
  buscarRegistrosDaEtapa,
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
  it("mapeia nr_fatos/iip_provisorio de vw_iip_contrato para o view-model", async () => {
    const { client, chamadas } = criarClienteMock({
      vw_iip_contrato: { data: { nr_fatos: 3, iip_provisorio: 12 }, error: null },
    });

    const resultado = await buscarIipContrato(client, 42);

    expect(resultado).toEqual({ nrFatos: 3, iipProvisorio: 12 });
    const chamadaEq = chamadas.find((c) => c.tabela === "vw_iip_contrato" && c.metodo === "eq");
    expect(chamadaEq?.args).toEqual(["id_contrato", 42]);
  });

  // AD-005/Edge Case: contrato sem Fato Gerador -- nr_fatos/iip_provisorio NULL, nunca 0.
  it("retorna nrFatos/iipProvisorio null quando o contrato não tem Fato Gerador", async () => {
    const { client } = criarClienteMock({
      vw_iip_contrato: { data: { nr_fatos: null, iip_provisorio: null }, error: null },
    });

    const resultado = await buscarIipContrato(client, 42);
    expect(resultado).toEqual({ nrFatos: null, iipProvisorio: null });
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
  it("mapeia fat_fato_gerador do contrato com tipologia concatenada e niveis d1/d2/d3", async () => {
    const { client } = criarClienteMock({
      fat_fato_gerador: {
        data: [{ id_fato_gerador: 1, id_tipologia: 3, nivel_d1: "alto", nivel_d2: null, nivel_d3: null, dt_ocorrencia: "2026-08-01" }],
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
        dtOcorrencia: "2026-08-01",
      },
    ]);
  });

  it("retorna [] quando o contrato não tem nenhum Fato Gerador", async () => {
    const { client } = criarClienteMock({ fat_fato_gerador: { data: [], error: null } });
    expect(await buscarFatosGeradoresDoContrato(client, 100)).toEqual([]);
  });
});
