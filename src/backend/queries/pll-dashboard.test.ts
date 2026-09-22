import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import {
  buscarAfinidadeAgendaPll,
  buscarAnaliseMandatoPll,
  buscarAnaliseParticipantePll,
  buscarMentoradosPll,
  buscarOpcoesMentorPll,
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
    // T17: buscarAnaliseMandatoPll consulta tse.mv_candidatura_resumo --
    // mesmo padrão de tse.test.ts, roteado pela mesma fila por nome de
    // tabela (a chave "mv_candidatura_resumo" no mapa de respostas).
    schema: (nomeSchema: string) => {
      chamadas.push({ tabela: nomeSchema, metodo: "schema", args: [nomeSchema] });
      return {
        from: (tabela: string) => {
          chamadas.push({ tabela, metodo: "from", args: [tabela] });
          return criarBuilder(tabela);
        },
      };
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

describe("buscarOpcoesMentorPll (T12, filtro 'Filtrar por mentor(a)' do Dashboard)", () => {
  it("caminho feliz: devolve os mentores com vínculo ativo em contratos do produto", async () => {
    const { client } = criarClienteMock({
      fat_contrato: { data: [{ id_contrato: 1 }, { id_contrato: 2 }], ...OK },
      rel_usuario_contrato: { data: [{ id_usuario: 200 }, { id_usuario: 201 }], ...OK },
      dim_usuario: { data: [{ id_usuario: 200, nome: "Ana Mentora" }, { id_usuario: 201, nome: "Bia Mentora" }], ...OK },
    });

    const resultado = await buscarOpcoesMentorPll(client, 9);

    expect(resultado).toEqual([
      { id: 200, nome: "Ana Mentora" },
      { id: 201, nome: "Bia Mentora" },
    ]);
  });

  it("recorte sem nenhum contrato devolve [], nunca lança", async () => {
    const { client } = criarClienteMock({ fat_contrato: { data: [], ...OK } });

    const resultado = await buscarOpcoesMentorPll(client, 9);

    expect(resultado).toEqual([]);
  });

  it("erro do banco propaga", async () => {
    const { client } = criarClienteMock({
      fat_contrato: { data: null, error: { message: "permission denied for table fat_contrato" } },
    });

    await expect(buscarOpcoesMentorPll(client, 9)).rejects.toMatchObject({
      message: "permission denied for table fat_contrato",
    });
  });
});

// Spec anchor: pll-dashboard-agenda T16 Done-when (tasks.md) -- PLL-DB-15,
// PLL-DB-17, D-13. Depende de fat_cadastro_participante
// (pll-cadastro-participantes, migration 20260922072328_*, já commitada).
describe("buscarAnaliseParticipantePll (T16, PLL-DB-15)", () => {
  it("caminho feliz: agrega por categoria com contagem/percentual, ausência vira semResposta (D-5c)", async () => {
    const { client } = criarClienteMock({
      fat_contrato: [{ data: [{ id_contrato: 1 }, { id_contrato: 2 }], ...OK }, { data: null, count: 1, ...OK }],
      fat_cadastro_participante: {
        data: [
          { identidade_genero: "Mulher cis", orientacao_sexual: "Heterossexual", cor_raca: "Parda", tempo_na_politica: "1 a 3 anos" },
          { identidade_genero: "Mulher cis", orientacao_sexual: "Heterossexual", cor_raca: "Preta", tempo_na_politica: "1 a 3 anos" },
          { identidade_genero: "Homem cis", orientacao_sexual: null, cor_raca: "Parda", tempo_na_politica: null },
        ],
        ...OK,
      },
    });

    const resultado = await buscarAnaliseParticipantePll(client, { idProduto: 9 });

    expect(resultado.participantesAtivos).toBe(1);
    expect(resultado.identidadeGenero).toEqual({
      n: 3,
      semResposta: 0,
      suprimido: true, // n < 5 (D-13) -- amostra pequena de propósito no teste
      categorias: [
        { categoria: "Mulher cis", quantidade: 2, percentual: 66.7 },
        { categoria: "Homem cis", quantidade: 1, percentual: 33.3 },
      ],
    });
    // D-5(c): ausência (null) NÃO entra na legenda -- fica em semResposta, fora do denominador.
    expect(resultado.orientacaoSexual).toEqual({
      n: 2,
      semResposta: 1,
      suprimido: true,
      categorias: [{ categoria: "Heterossexual", quantidade: 2, percentual: 100 }],
    });
    expect(resultado.tempoNaPolitica.semResposta).toBe(1);
  });

  it("recorte sem contrato devolve tudo vazio/suprimido, nunca lança", async () => {
    const { client } = criarClienteMock({ fat_contrato: { data: [], ...OK } });

    const resultado = await buscarAnaliseParticipantePll(client, { idProduto: 9 });

    expect(resultado.participantesAtivos).toBe(0);
    expect(resultado.corRaca).toEqual({ n: 0, semResposta: 0, suprimido: true, categorias: [] });
  });

  it("erro do banco propaga", async () => {
    const { client } = criarClienteMock({
      fat_contrato: { data: null, error: { message: "permission denied for table fat_contrato" } },
    });

    await expect(buscarAnaliseParticipantePll(client, { idProduto: 9 })).rejects.toMatchObject({
      message: "permission denied for table fat_contrato",
    });
  });
});

describe("buscarAfinidadeAgendaPll (T16, PLL-DB-17, D-3)", () => {
  it("caminho feliz: distribuição de notas 5..1 por pauta fixa + outras pautas (múltipla escolha)", async () => {
    const { client } = criarClienteMock({
      fat_contrato: { data: [{ id_contrato: 1 }, { id_contrato: 2 }], ...OK },
      fat_cadastro_participante: {
        data: [
          { nota_educacao: 5, nota_seguranca_publica: 3, nota_modernizacao_estado: null, nota_clima: 2, outras_pautas: ["Saúde", "Infraestrutura"] },
          { nota_educacao: 4, nota_seguranca_publica: 3, nota_modernizacao_estado: 5, nota_clima: 2, outras_pautas: ["Saúde"] },
        ],
        ...OK,
      },
    });

    const resultado = await buscarAfinidadeAgendaPll(client, { idProduto: 9 });

    expect(resultado.pautas.map((p) => p.pauta)).toEqual(["Educação", "Segurança Pública", "Modernização do Estado", "Clima"]);
    const educacao = resultado.pautas.find((p) => p.pauta === "Educação")!;
    expect(educacao.n).toBe(2);
    expect(educacao.distribuicaoNotas).toEqual([
      { nota: 5, quantidade: 1, percentual: 50 },
      { nota: 4, quantidade: 1, percentual: 50 },
      { nota: 3, quantidade: 0, percentual: 0 },
      { nota: 2, quantidade: 0, percentual: 0 },
      { nota: 1, quantidade: 0, percentual: 0 },
    ]);
    const modernizacao = resultado.pautas.find((p) => p.pauta === "Modernização do Estado")!;
    expect(modernizacao.n).toBe(1); // um dos dois é null -- fora do denominador

    expect(resultado.outrasPautas.n).toBe(2);
    expect(resultado.outrasPautas.itens).toEqual([
      { pauta: "Saúde", quantidade: 2, percentual: 100 },
      { pauta: "Infraestrutura", quantidade: 1, percentual: 50 },
    ]);
  });

  it("recorte sem contrato devolve as 4 pautas zeradas/suprimidas, nunca lança", async () => {
    const { client } = criarClienteMock({ fat_contrato: { data: [], ...OK } });

    const resultado = await buscarAfinidadeAgendaPll(client, { idProduto: 9 });

    expect(resultado.pautas).toHaveLength(4);
    expect(resultado.pautas.every((p) => p.suprimido)).toBe(true);
    expect(resultado.outrasPautas).toEqual({ n: 0, suprimido: true, itens: [] });
  });

  it("erro do banco propaga", async () => {
    const { client } = criarClienteMock({
      fat_contrato: { data: [{ id_contrato: 1 }], ...OK },
      fat_cadastro_participante: { data: null, error: { message: "permission denied" } },
    });

    await expect(buscarAfinidadeAgendaPll(client, { idProduto: 9 })).rejects.toMatchObject({
      message: "permission denied",
    });
  });
});

// Spec anchor: pll-dashboard-agenda T17 Done-when (tasks.md) -- PLL-DB-16,
// D-5. Sem dependência de fat_cadastro_participante.
describe("buscarAnaliseMandatoPll (T17, PLL-DB-16)", () => {
  it("caminho feliz: ds_raca nulo entra em 'sem resposta' (semResposta), partido além dos 8 maiores agrupa em Outros", async () => {
    const { client } = criarClienteMock({
      fat_contrato: {
        data: [
          { id_contrato: 1, id_contratante: 100, id_partido_no_contrato: 1 },
          { id_contrato: 2, id_contratante: 101, id_partido_no_contrato: 2 },
        ],
        ...OK,
      },
      dim_mandato: {
        data: [
          { id_mandato: 10, id_contratante: 100, ds_raca: "Parda" },
          { id_mandato: 11, id_contratante: 101, ds_raca: null },
        ],
        ...OK,
      },
      dim_contratante: {
        data: [
          { id_contratante: 100, sg_uf: "SP" },
          { id_contratante: 101, sg_uf: "RJ" },
        ],
        ...OK,
      },
      ref_partido: {
        data: [
          { id_partido: 1, sigla: "PA" },
          { id_partido: 2, sigla: "PB" },
        ],
        ...OK,
      },
      rel_mandato_candidatura: {
        data: [
          { id_mandato: 10, ano_eleicao: 2018, sq_candidato: 555, nr_turno: 1 },
          { id_mandato: 10, ano_eleicao: 2014, sq_candidato: 556, nr_turno: 1 },
        ],
        ...OK,
      },
      mv_candidatura_resumo: {
        data: [
          { ano_eleicao: 2018, sq_candidato: 555, nr_turno: 1, ds_cargo: "Deputado Estadual" },
          { ano_eleicao: 2014, sq_candidato: 556, nr_turno: 1, ds_cargo: "Vereador" },
        ],
        ...OK,
      },
    });

    const resultado = await buscarAnaliseMandatoPll(client, { idProduto: 9 });

    expect(resultado.corRacaParlamentar).toEqual({
      n: 1,
      semResposta: 1,
      suprimido: true,
      categorias: [{ categoria: "Parda", quantidade: 1, percentual: 100 }],
    });
    expect(resultado.estadoEleicao.categorias).toEqual(
      expect.arrayContaining([
        { categoria: "SP", quantidade: 1, percentual: 50 },
        { categoria: "RJ", quantidade: 1, percentual: 50 },
      ])
    );
    expect(resultado.partidoPolitico.n).toBe(2);
    expect(resultado.cargosAnteriores.n).toBe(2);
    expect(resultado.cargosAnteriores.categorias).toEqual(
      expect.arrayContaining([
        { categoria: "Deputado Estadual", quantidade: 1, percentual: 50 },
        { categoria: "Vereador", quantidade: 1, percentual: 50 },
      ])
    );
    // Mandato 10 tem 2 candidaturas anteriores confirmadas -> bucket "2"; mandato 11 tem 0 -> bucket "0".
    expect(resultado.mandatosAnteriores.n).toBe(2);
    expect(resultado.mandatosAnteriores.categorias).toEqual(
      expect.arrayContaining([
        { categoria: "2", quantidade: 1, percentual: 50 },
        { categoria: "0", quantidade: 1, percentual: 50 },
      ])
    );
  });

  it("recorte sem contrato devolve tudo vazio/suprimido, nunca lança", async () => {
    const { client } = criarClienteMock({ fat_contrato: { data: [], ...OK } });

    const resultado = await buscarAnaliseMandatoPll(client, { idProduto: 9 });

    expect(resultado.corRacaParlamentar).toEqual({ n: 0, semResposta: 0, suprimido: true, categorias: [] });
    expect(resultado.mandatosAnteriores).toEqual({ n: 0, suprimido: true, categorias: [] });
  });

  it("erro do banco propaga", async () => {
    const { client } = criarClienteMock({
      fat_contrato: { data: null, error: { message: "permission denied for table fat_contrato" } },
    });

    await expect(buscarAnaliseMandatoPll(client, { idProduto: 9 })).rejects.toMatchObject({
      message: "permission denied for table fat_contrato",
    });
  });
});
