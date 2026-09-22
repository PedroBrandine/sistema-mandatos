import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarIncidenciaDoProduto } from "./incidencia-produto";

// Leitura agregada da Incidência por produto (aba "Fatos Geradores" do
// produto). O que precisa ficar provado: (1) escopo por lista de contratos,
// (2) o contrato de origem chega em cada item, (3) a resposta não é cortada
// nas 1000 linhas do PostgREST, (4) os nomes (autor, tipo, pilar, tipologia,
// origem da cadeia) são resolvidos como na leitura por contrato.

type Resposta = { data: unknown; error: { message: string } | null };
type Chamada = { tabela: string; metodo: string; args: unknown[] };

// `respostas[tabela]` pode ser uma resposta fixa ou uma função do intervalo
// pedido em `.range(de, ate)` -- é o que permite simular várias páginas.
type Fonte = Resposta | ((intervalo: [number, number] | null) => Resposta);

function criarClienteMock(fontes: Record<string, Fonte>) {
  const chamadas: Chamada[] = [];

  function criarBuilder(tabela: string) {
    let intervalo: [number, number] | null = null;
    const builder: Record<string, unknown> = {};
    for (const metodo of ["select", "in", "eq", "order"]) {
      builder[metodo] = (...args: unknown[]) => {
        chamadas.push({ tabela, metodo, args });
        return builder;
      };
    }
    builder.range = (...args: unknown[]) => {
      chamadas.push({ tabela, metodo: "range", args });
      intervalo = [args[0] as number, args[1] as number];
      return builder;
    };
    builder.then = (resolve: (r: Resposta) => void, reject: (e: unknown) => void) => {
      const fonte = fontes[tabela] ?? { data: [], error: null };
      const resposta = typeof fonte === "function" ? fonte(intervalo) : fonte;
      return Promise.resolve(resposta).then(resolve, reject);
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

describe("buscarIncidenciaDoProduto", () => {
  it("sem contrato no recorte devolve tudo vazio e nem vai ao banco", async () => {
    const { client, chamadas } = criarClienteMock({});

    const resultado = await buscarIncidenciaDoProduto(client, []);

    expect(resultado).toEqual({
      registros: [],
      insights: [],
      fatosGeradores: [],
      preInsights: [],
      timeline: [],
      cadeias: [],
    });
    expect(chamadas).toHaveLength(0);
  });

  it("escopa as 6 leituras pela lista de contratos (IN), não por um id só", async () => {
    const { client, chamadas } = criarClienteMock({});

    await buscarIncidenciaDoProduto(client, [7, 8, 9]);

    const tabelasLidas = [
      "fat_registro",
      "fat_insight",
      "fat_fato_gerador",
      "fat_pre_insight",
      "vw_timeline_incidencia",
      "vw_cadeia_incidencia",
    ];
    for (const tabela of tabelasLidas) {
      const filtro = chamadas.find((c) => c.tabela === tabela && c.metodo === "in");
      expect(filtro?.args, tabela).toEqual(["id_contrato", [7, 8, 9]]);
    }
  });

  it("preenche idContrato em cada item da Linha do Tempo e da Cadeia", async () => {
    const { client } = criarClienteMock({
      vw_timeline_incidencia: {
        data: [
          { id_contrato: 7, tipo: "insight", id_origem: 1, titulo: "I", data_evento: "2026-09-01", criado_em: null, id_usuario_autor: null },
          { id_contrato: 8, tipo: "fato_gerador", id_origem: 2, titulo: "F", data_evento: "2026-09-02", criado_em: null, id_usuario_autor: null },
        ],
        error: null,
      },
      vw_cadeia_incidencia: {
        data: [{ id_contrato: 8, id_fato_gerador: 2, titulo: "F", situacao: "realizado", data_evento: "2026-09-02", chave_origem: "fato:2" }],
        error: null,
      },
    });

    const r = await buscarIncidenciaDoProduto(client, [7, 8]);

    expect(r.timeline.map((i) => [i.tipo, i.idContrato])).toEqual([
      ["insight", 7],
      ["fato_gerador", 8],
    ]);
    expect(r.cadeias).toHaveLength(1);
    expect(r.cadeias[0]).toMatchObject({ idFatoGerador: 2, idContrato: 8, chaveOrigem: "fato:2", origem: null });
  });

  it("resolve nomes de autor, tipo de registro, pilar e tipologia", async () => {
    const { client } = criarClienteMock({
      fat_registro: {
        data: [{ id_registro: 1, id_tipo_registro: 5, ocorrido_em: "2026-09-01", resumo: "R", id_usuario_autor: 3 }],
        error: null,
      },
      fat_insight: { data: [{ id_insight: 2, conteudo: "C", id_pilar: 4, ocorrido_em: null }], error: null },
      fat_fato_gerador: {
        data: [
          {
            id_fato_gerador: 6,
            id_tipologia: 9,
            nivel_d1: "Baixo",
            nivel_d2: null,
            nivel_d3: null,
            titulo: "T",
            situacao: "projetado",
            dt_ocorrencia: null,
            dt_prevista: "2026-10-01",
            descricao_evidencia: "D",
          },
        ],
        error: null,
      },
      vw_timeline_incidencia: {
        data: [{ id_contrato: 7, tipo: "registro", id_origem: 1, titulo: "R", data_evento: "2026-09-01", criado_em: null, id_usuario_autor: 3 }],
        error: null,
      },
      dim_usuario: { data: [{ id_usuario: 3, nome: "Ana" }], error: null },
      ref_tipo_registro: { data: [{ id_tipo_registro: 5, nome: "Pontapé" }], error: null },
      ref_pilar_insight: { data: [{ id_pilar: 4, nome: "Incidência política" }], error: null },
      ref_tipologia: {
        data: [{ id_tipologia: 9, grupo: "2. Produção Legislativa", tipologia: "Projeto de lei", estado: "Em tramitação ativa" }],
        error: null,
      },
    });

    const r = await buscarIncidenciaDoProduto(client, [7]);

    expect(r.registros[0]).toMatchObject({ tipoRegistro: "Pontapé", nomeAutor: "Ana" });
    expect(r.insights[0].pilar).toBe("Incidência política");
    expect(r.fatosGeradores[0]).toMatchObject({
      tipologia: "2. Produção Legislativa · Projeto de lei · Em tramitação ativa",
      situacao: "projetado",
      dtPrevista: "2026-10-01",
    });
    expect(r.timeline[0].nomeAutor).toBe("Ana");
  });

  it("resolve o passo de origem da cadeia (Insight → Fato Gerador)", async () => {
    const { client } = criarClienteMock({
      vw_cadeia_incidencia: {
        data: [{ id_contrato: 7, id_fato_gerador: 2, titulo: "F", situacao: "realizado", data_evento: "2026-09-02", chave_origem: "insight:5" }],
        error: null,
      },
      fat_insight: { data: [{ id_insight: 5, conteudo: "Origem", ocorrido_em: "2026-08-01", id_pilar: null }], error: null },
    });

    const r = await buscarIncidenciaDoProduto(client, [7]);

    expect(r.cadeias[0].origem).toEqual({ tipo: "insight", titulo: "Origem", dataEvento: "2026-08-01" });
  });

  // O PostgREST devolve no máximo 1000 linhas por resposta, sem avisar. Sem a
  // paginação, um produto com muitos mandatos mostraria KPIs e itens cortados.
  it("segue pedindo páginas quando a primeira vem cheia (1000 linhas)", async () => {
    const linha = (id: number) => ({ id_registro: id, id_tipo_registro: 1, ocorrido_em: "2026-09-01", resumo: null, id_usuario_autor: 1 });
    const { client, chamadas } = criarClienteMock({
      fat_registro: (intervalo) => ({
        data:
          intervalo?.[0] === 0
            ? Array.from({ length: 1000 }, (_, i) => linha(i + 1))
            : [linha(1001), linha(1002)],
        error: null,
      }),
    });

    const r = await buscarIncidenciaDoProduto(client, [7]);

    expect(r.registros).toHaveLength(1002);
    const ranges = chamadas.filter((c) => c.tabela === "fat_registro" && c.metodo === "range").map((c) => c.args);
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("erro do banco propaga em vez de devolver lista parcial", async () => {
    const { client } = criarClienteMock({ fat_insight: { data: null, error: { message: "falhou" } } });

    await expect(buscarIncidenciaDoProduto(client, [7])).rejects.toMatchObject({ message: "falhou" });
  });
});
