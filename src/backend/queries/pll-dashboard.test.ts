import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import {
  buscarMentoradosPll,
  buscarPllKpis,
  buscarRegistrosMentores,
  buscarStatusMentoriaPorMes,
} from "./pll-dashboard";

// Spec anchor: pll-dashboard-agenda T4-T7 Done-when
// (.specs/features/pll-dashboard-agenda/tasks.md) -- PLL-DB-02…14, D-11, D-7.
// Test Coverage Matrix (tasks.md): caminho feliz por função exportada +
// AD-005 (null vs 0) + erro do banco propaga.
//
// Mock roteado por nome de tabela, mesmo padrão de queries/kanban.test.ts e
// queries/pendencias.test.ts, estendido com `limit`/`maybeSingle` (usados
// por buscarRegistrosMentores e buscarMentoradosPll) e `count` (usado pela
// contagem exact/head de fat_fato_gerador).

type Chamada = { tabela: string; metodo: string; args: unknown[] };
type RespostaTabela = { data: unknown; error: { message: string } | null; count?: number };

function criarClienteMock(respostasPorTabela: Record<string, RespostaTabela | RespostaTabela[]>) {
  const chamadas: Chamada[] = [];
  const filas = new Map<string, RespostaTabela[]>(
    Object.entries(respostasPorTabela).map(([tabela, resp]) => [tabela, Array.isArray(resp) ? [...resp] : [resp]])
  );

  function proximaResposta(tabela: string): RespostaTabela {
    const fila = filas.get(tabela);
    if (!fila || fila.length === 0) return { data: null, error: null };
    return fila.length > 1 ? fila.shift()! : fila[0];
  }

  function criarBuilder(tabela: string) {
    const resposta = proximaResposta(tabela);
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
      is: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "is", args });
        return builder;
      },
      order: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "order", args });
        return builder;
      },
      limit: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "limit", args });
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

const OK = { error: null };

describe("buscarPllKpis (T4, PLL-DB-02/03/04)", () => {
  it("caminho feliz: os 5 KPIs batem com os dados do recorte", async () => {
    const { client } = criarClienteMock({
      fat_contrato: [
        { data: [{ id_contrato: 1 }, { id_contrato: 2 }, { id_contrato: 3 }], ...OK },
        {
          data: [
            { id_contrato: 1, status: "ativo", origem_encerramento: null },
            { id_contrato: 2, status: "nao_concluido", origem_encerramento: "desistencia" },
            { id_contrato: 3, status: "nao_concluido", origem_encerramento: "desligamento" },
          ],
          ...OK,
        },
      ],
      fat_encontro: {
        data: [{ status: "realizado" }, { status: "realizado" }, { status: "planejado" }, { status: "cancelado" }],
        ...OK,
      },
      dim_planejamento: { data: [{ pct_atingimento: 50 }, { pct_atingimento: 70 }], ...OK },
      fat_fato_gerador: { data: null, count: 4, ...OK },
    });

    const resultado = await buscarPllKpis(client, { idProduto: 9 });

    expect(resultado).toEqual({
      totalMentorados: 3,
      distribuicaoStatus: { ativo: 1, desistente: 1, desligado: 1, concluido: 0 },
      mentoriasRealizadas: 2,
      mentoriasPlanejadas: 3,
      atingimentoMedio: 60,
      fatosGeradoresRegistrados: 4,
    });
  });

  it("AD-005: recorte sem nenhum contrato devolve contagens 0 e atingimentoMedio null (nunca 0)", async () => {
    const { client } = criarClienteMock({
      fat_contrato: { data: [], ...OK },
    });

    const resultado = await buscarPllKpis(client, { idProduto: 9 });

    expect(resultado.totalMentorados).toBe(0);
    expect(resultado.distribuicaoStatus).toEqual({ ativo: 0, desistente: 0, desligado: 0, concluido: 0 });
    expect(resultado.atingimentoMedio).toBeNull();
    expect(resultado.fatosGeradoresRegistrados).toBe(0);
  });

  it("AD-005: recorte com contratos mas nenhum dim_planejamento devolve atingimentoMedio null, não 0", async () => {
    const { client } = criarClienteMock({
      fat_contrato: [
        { data: [{ id_contrato: 1 }], ...OK },
        { data: [{ id_contrato: 1, status: "ativo", origem_encerramento: null }], ...OK },
      ],
      fat_encontro: { data: [], ...OK },
      dim_planejamento: { data: [], ...OK },
      fat_fato_gerador: { data: null, count: 0, ...OK },
    });

    const resultado = await buscarPllKpis(client, { idProduto: 9 });

    expect(resultado.atingimentoMedio).toBeNull();
  });

  it("erro do banco propaga em vez de virar KPI zerado", async () => {
    const { client } = criarClienteMock({
      fat_contrato: { data: null, error: { message: "permission denied for table fat_contrato" } },
    });

    await expect(buscarPllKpis(client, { idProduto: 9 })).rejects.toMatchObject({
      message: "permission denied for table fat_contrato",
    });
  });
});

describe("buscarStatusMentoriaPorMes (T5, PLL-DB-05)", () => {
  const HOJE = new Date("2026-09-15T12:00:00Z"); // Setembro/2026 no fuso do produto

  it("caminho feliz: agrega por mês/status, mês realizado usa dt_realizada e mês sem Encontro fica zerado", async () => {
    const { client } = criarClienteMock({
      fat_contrato: { data: [{ id_contrato: 1 }], ...OK },
      fat_encontro: {
        data: [
          // Realizado em agosto, mas planejado originalmente para setembro --
          // conta em agosto (dt_realizada manda quando status=realizado).
          { status: "realizado", dt_prevista_inicio: "2026-09-01T12:00:00Z", dt_realizada: "2026-08-30T12:00:00Z" },
          { status: "planejado", dt_prevista_inicio: "2026-09-10T12:00:00Z", dt_realizada: null },
          { status: "cancelado", dt_prevista_inicio: "2026-09-12T12:00:00Z", dt_realizada: null },
          { status: "remarcado", dt_prevista_inicio: "2026-07-05T12:00:00Z", dt_realizada: null },
        ],
        ...OK,
      },
    });

    const serie = await buscarStatusMentoriaPorMes(client, { idProduto: 9 }, HOJE);

    expect(serie).toHaveLength(6);
    expect(serie.map((s) => s.mes)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);

    const agosto = serie.find((s) => s.mes === "2026-08");
    expect(agosto).toEqual({ mes: "2026-08", planejado: 0, realizado: 1, remarcado: 0, cancelado: 0 });

    const setembro = serie.find((s) => s.mes === "2026-09");
    expect(setembro).toEqual({ mes: "2026-09", planejado: 1, realizado: 0, remarcado: 0, cancelado: 1 });

    const julho = serie.find((s) => s.mes === "2026-07");
    expect(julho).toEqual({ mes: "2026-07", planejado: 0, realizado: 0, remarcado: 1, cancelado: 0 });

    // Meses sem nenhum Encontro (abril, maio, junho) continuam na série, zerados.
    const abril = serie.find((s) => s.mes === "2026-04");
    expect(abril).toEqual({ mes: "2026-04", planejado: 0, realizado: 0, remarcado: 0, cancelado: 0 });
  });

  it("recorte sem nenhum contrato devolve a janela de 6 meses inteira zerada, nunca lança", async () => {
    const { client } = criarClienteMock({ fat_contrato: { data: [], ...OK } });

    const serie = await buscarStatusMentoriaPorMes(client, { idProduto: 9 }, HOJE);

    expect(serie).toHaveLength(6);
    for (const linha of serie) {
      expect(linha).toMatchObject({ planejado: 0, realizado: 0, remarcado: 0, cancelado: 0 });
    }
  });

  it("erro do banco propaga", async () => {
    const { client } = criarClienteMock({
      fat_contrato: { data: [{ id_contrato: 1 }], ...OK },
      fat_encontro: { data: null, error: { message: "permission denied for table fat_encontro" } },
    });

    await expect(buscarStatusMentoriaPorMes(client, { idProduto: 9 }, HOJE)).rejects.toMatchObject({
      message: "permission denied for table fat_encontro",
    });
  });
});

describe("buscarMentoradosPll (T6, PLL-DB-07…10)", () => {
  it("caminho feliz: mapeia todas as colunas do design (nome, parlamentar, partido, UF, mentor, mentorias, ating., status, edição)", async () => {
    const { client } = criarClienteMock({
      fat_contrato: [
        { data: [{ id_contrato: 1 }], ...OK },
        {
          data: [
            {
              id_contrato: 1,
              id_contratante: 100,
              status: "ativo",
              origem_encerramento: null,
              id_partido_no_contrato: 5,
              id_cargo_no_contrato: 6,
              id_projeto: 7,
            },
          ],
          ...OK,
        },
      ],
      rel_usuario_contrato: {
        data: [
          { id_contrato: 1, id_usuario: 200, papel_no_contrato: "mentor" },
          { id_contrato: 1, id_usuario: 300, papel_no_contrato: "assessor" },
        ],
        ...OK,
      },
      dim_usuario: { data: [{ id_usuario: 200, nome: "Ana Mentora" }, { id_usuario: 300, nome: "Beto Mentorado" }], ...OK },
      dim_mandato: { data: [{ id_contratante: 100, nm_urna: "Carlos Silva", nm_civil: "Carlos da Silva" }], ...OK },
      ref_partido: { data: [{ id_partido: 5, sigla: "PXX" }], ...OK },
      ref_cargo: { data: [{ id_cargo: 6, nome: "Deputado(a) Federal" }], ...OK },
      dim_contratante: { data: [{ id_contratante: 100, sg_uf: "SP" }], ...OK },
      ref_projeto: { data: [{ id_projeto: 7, nome: "PLL 2026.1" }], ...OK },
      ref_tipo_registro: { data: { id_tipo_registro: 42 }, ...OK },
      fat_encontro: { data: [{ id_contrato: 1 }, { id_contrato: 1 }], ...OK },
      dim_planejamento: { data: [{ id_contrato: 1, pct_atingimento: 80 }], ...OK },
    });

    const resultado = await buscarMentoradosPll(client, { idProduto: 9 });

    expect(resultado).toEqual([
      {
        idContrato: 1,
        nomeMentorado: "Beto Mentorado",
        nomeParlamentar: "Dep. Carlos Silva",
        siglaPartido: "PXX",
        siglaUf: "SP",
        nomeMentor: "Ana Mentora",
        mentoriasRealizadas: 2,
        pctAtingimento: 80,
        status: "ativo",
        nomeEdicao: "PLL 2026.1",
      },
    ]);
  });

  it("AD-005: contrato sem mentor pareado entra com nomeMentor null, nunca célula inventada", async () => {
    const { client } = criarClienteMock({
      fat_contrato: [
        { data: [{ id_contrato: 1 }], ...OK },
        {
          data: [
            {
              id_contrato: 1,
              id_contratante: 100,
              status: "nao_concluido",
              origem_encerramento: "desistencia",
              id_partido_no_contrato: null,
              id_cargo_no_contrato: null,
              id_projeto: null,
            },
          ],
          ...OK,
        },
      ],
      // Só o vínculo de assessor -- nenhum mentor pareado.
      rel_usuario_contrato: { data: [{ id_contrato: 1, id_usuario: 300, papel_no_contrato: "assessor" }], ...OK },
      dim_usuario: { data: [{ id_usuario: 300, nome: "Beto Mentorado" }], ...OK },
      dim_mandato: { data: [{ id_contratante: 100, nm_urna: "Carlos Silva", nm_civil: null }], ...OK },
      ref_partido: { data: [], ...OK },
      ref_cargo: { data: [], ...OK },
      dim_contratante: { data: [{ id_contratante: 100, sg_uf: null }], ...OK },
      ref_projeto: { data: [], ...OK },
      ref_tipo_registro: { data: null, ...OK },
      dim_planejamento: { data: [], ...OK },
    });

    const resultado = await buscarMentoradosPll(client, { idProduto: 9 });

    expect(resultado).toHaveLength(1);
    expect(resultado[0].nomeMentor).toBeNull();
    expect(resultado[0].siglaPartido).toBeNull();
    expect(resultado[0].siglaUf).toBeNull();
    expect(resultado[0].pctAtingimento).toBeNull();
    expect(resultado[0].status).toBe("desistente");
  });

  it("recorte sem nenhum contrato devolve [], nunca lança", async () => {
    const { client } = criarClienteMock({ fat_contrato: { data: [], ...OK } });

    const resultado = await buscarMentoradosPll(client, { idProduto: 9 });

    expect(resultado).toEqual([]);
  });

  it("erro do banco propaga", async () => {
    const { client } = criarClienteMock({
      fat_contrato: { data: null, error: { message: "permission denied for table fat_contrato" } },
    });

    await expect(buscarMentoradosPll(client, { idProduto: 9 })).rejects.toMatchObject({
      message: "permission denied for table fat_contrato",
    });
  });
});

describe("buscarRegistrosMentores (T7, PLL-DB-12…14, D-7)", () => {
  it("caminho feliz: os N mais recentes, com autor, mentorado, data e resumo; limite vai para a query", async () => {
    const { client, chamadas } = criarClienteMock({
      fat_contrato: { data: [{ id_contrato: 1 }], ...OK },
      fat_registro: {
        data: [
          { id_registro: 10, id_contrato: 1, ocorrido_em: "2026-09-18T21:30:00Z", resumo: "Alinhamento", id_usuario_autor: 200 },
        ],
        ...OK,
      },
      dim_usuario: [
        { data: [{ id_usuario: 200, nome: "Ana Mentora" }], ...OK },
        { data: [{ id_usuario: 300, nome: "Beto Mentorado" }], ...OK },
      ],
      rel_usuario_contrato: { data: [{ id_contrato: 1, id_usuario: 300 }], ...OK },
    });

    const resultado = await buscarRegistrosMentores(client, { idProduto: 9 });

    expect(resultado).toEqual([
      {
        idRegistro: 10,
        nomeAutor: "Ana Mentora",
        nomeMentorado: "Beto Mentorado",
        ocorridoEm: "2026-09-18T21:30:00Z",
        resumo: "Alinhamento",
      },
    ]);
    const chamadaLimit = chamadas.find((c) => c.tabela === "fat_registro" && c.metodo === "limit");
    expect(chamadaLimit?.args).toEqual([10]);
  });

  it("limite customizado vai para a query no lugar do default 10", async () => {
    const { client, chamadas } = criarClienteMock({
      fat_contrato: { data: [{ id_contrato: 1 }], ...OK },
      fat_registro: { data: [], ...OK },
    });

    await buscarRegistrosMentores(client, { idProduto: 9, limite: 3 });

    const chamadaLimit = chamadas.find((c) => c.tabela === "fat_registro" && c.metodo === "limit");
    expect(chamadaLimit?.args).toEqual([3]);
  });

  it("AD-005: resumo nulo chega como null, nunca string vazia ou sentinela", async () => {
    const { client } = criarClienteMock({
      fat_contrato: { data: [{ id_contrato: 1 }], ...OK },
      fat_registro: {
        data: [{ id_registro: 10, id_contrato: 1, ocorrido_em: "2026-09-18T21:30:00Z", resumo: null, id_usuario_autor: 200 }],
        ...OK,
      },
      dim_usuario: [{ data: [{ id_usuario: 200, nome: "Ana Mentora" }], ...OK }, { data: [], ...OK }],
      rel_usuario_contrato: { data: [], ...OK },
    });

    const resultado = await buscarRegistrosMentores(client, { idProduto: 9 });

    expect(resultado[0].resumo).toBeNull();
    expect(resultado[0].nomeMentorado).toBeNull();
  });

  it("recorte sem nenhum contrato devolve [], nunca lança", async () => {
    const { client } = criarClienteMock({ fat_contrato: { data: [], ...OK } });

    const resultado = await buscarRegistrosMentores(client, { idProduto: 9 });

    expect(resultado).toEqual([]);
  });

  it("erro do banco propaga", async () => {
    const { client } = criarClienteMock({
      fat_contrato: { data: [{ id_contrato: 1 }], ...OK },
      fat_registro: { data: null, error: { message: "permission denied for table fat_registro" } },
    });

    await expect(buscarRegistrosMentores(client, { idProduto: 9 })).rejects.toMatchObject({
      message: "permission denied for table fat_registro",
    });
  });
});
