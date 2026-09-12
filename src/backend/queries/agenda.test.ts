import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarEncontrosDoMes, FUSO_HORARIO_PRODUTO, intervaloDoMes } from "./agenda";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/tasks.md, T25
// "Done when" (EST-12) --
//  - Retorna só encontros dentro do intervalo do mês pedido, fronteira nos
//    dois extremos (lição L-001)
//  - Mês sem encontros retorna [], nunca lança (edge case do spec)
//  - Filtros de gestora, projeto e contrato aplicam AND
//
// Mock roteado por nome de tabela, mesmo padrão de queries/kanban.test.ts,
// queries/quadro.test.ts, queries/pendencias.test.ts e
// queries/mandatos-lista.test.ts.
//
// Os argumentos de cada método encadeado ficam gravados em `chamadas`: o mock
// devolve o mesmo `data` independentemente do range recebido, então um erro
// de fronteira (mês seguinte incluído, primeiro dia perdido) só é detectável
// asserindo os valores exatos passados ao .gte()/.lt() -- lição L-029.

type Chamada = { tabela: string; metodo: string; args: unknown[] };
type RespostaTabela = { data: unknown; error: { message: string } | null };

function criarClienteMock(respostasPorTabela: Record<string, RespostaTabela | RespostaTabela[]>) {
  const chamadas: Chamada[] = [];
  const filas = new Map<string, RespostaTabela[]>(
    Object.entries(respostasPorTabela).map(([tabela, resp]) => [
      tabela,
      Array.isArray(resp) ? [...resp] : [resp],
    ])
  );

  function proximaResposta(tabela: string): RespostaTabela {
    const fila = filas.get(tabela);
    if (!fila || fila.length === 0) return { data: null, error: null };
    return fila.length > 1 ? fila.shift()! : fila[0];
  }

  function criarBuilder(tabela: string) {
    const resposta = proximaResposta(tabela);
    const registrar = (metodo: string) => (...args: unknown[]) => {
      chamadas.push({ tabela, metodo, args });
      return builder;
    };
    const builder: Record<string, unknown> = {
      select: registrar("select"),
      eq: registrar("eq"),
      in: registrar("in"),
      is: registrar("is"),
      gte: registrar("gte"),
      lt: registrar("lt"),
      order: registrar("order"),
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

function argsDe(chamadas: Chamada[], tabela: string, metodo: string): unknown[][] {
  return chamadas.filter((c) => c.tabela === tabela && c.metodo === metodo).map((c) => c.args);
}

const ENCONTRO_1 = {
  id_encontro: 501,
  id_contrato: 1,
  id_etapa: 1000,
  id_tipo_registro: 2000,
  titulo: "Mentoria 3",
  status: "planejado",
  dt_prevista_inicio: "2026-09-15T14:00:00-03:00",
  dt_prevista_fim: "2026-09-15T15:30:00-03:00",
  dt_realizada: null,
  modalidade: "online",
  local: null,
  tema_prioritario: "Orçamento",
};

describe("intervaloDoMes (EST-12 AC1) — fronteira do mês nos dois extremos", () => {
  it("início é o primeiro instante do mês pedido", () => {
    expect(intervaloDoMes(2026, 9).inicio).toBe("2026-09-01T00:00:00-03:00");
  });

  it("fim é o primeiro instante do mês seguinte, nunca do mês pedido", () => {
    expect(intervaloDoMes(2026, 9).fim).toBe("2026-10-01T00:00:00-03:00");
  });

  it("dezembro vira janeiro do ano seguinte", () => {
    expect(intervaloDoMes(2026, 12)).toEqual({
      inicio: "2026-12-01T00:00:00-03:00",
      fim: "2027-01-01T00:00:00-03:00",
    });
  });

  it("mês de um dígito sai com zero à esquerda", () => {
    expect(intervaloDoMes(2026, 1).inicio).toBe("2026-01-01T00:00:00-03:00");
  });

  it("o carimbo usa o fuso do produto, nunca o da máquina", () => {
    expect(FUSO_HORARIO_PRODUTO).toBe("-03:00");
    expect(intervaloDoMes(2026, 9).inicio.endsWith(FUSO_HORARIO_PRODUTO)).toBe(true);
  });
});

describe("buscarEncontrosDoMes (EST-12)", () => {
  it("restringe a consulta ao intervalo do mês: gte no primeiro instante, lt no mês seguinte (AC1)", async () => {
    const { client, chamadas } = criarClienteMock({
      fat_contrato: [{ data: [{ id_contrato: 1 }], error: null }, { data: [{ id_contrato: 1, id_contratante: 10 }], error: null }],
      fat_encontro: { data: [ENCONTRO_1], error: null },
      dim_contratante: { data: [{ id_contratante: 10, nome: "Gabinete A" }], error: null },
      ref_etapa: { data: [{ id_etapa: 1000, nome: "Diagnóstico" }], error: null },
      ref_tipo_registro: { data: [{ id_tipo_registro: 2000, nome: "Escuta" }], error: null },
      rel_encontro_participante: { data: [], error: null },
    });

    await buscarEncontrosDoMes(client, { idProduto: 1, ano: 2026, mes: 9 });

    expect(argsDe(chamadas, "fat_encontro", "gte")).toEqual([
      ["dt_prevista_inicio", "2026-09-01T00:00:00-03:00"],
    ]);
    expect(argsDe(chamadas, "fat_encontro", "lt")).toEqual([
      ["dt_prevista_inicio", "2026-10-01T00:00:00-03:00"],
    ]);
  });

  it("mês sem encontros retorna [], nunca lança (edge case do spec)", async () => {
    const { client } = criarClienteMock({
      fat_contrato: { data: [{ id_contrato: 1 }], error: null },
      fat_encontro: { data: [], error: null },
    });

    await expect(buscarEncontrosDoMes(client, { idProduto: 1, ano: 2026, mes: 9 })).resolves.toEqual([]);
  });

  it("produto sem nenhum contrato retorna [] sem consultar fat_encontro", async () => {
    const { client, chamadas } = criarClienteMock({
      fat_contrato: { data: [], error: null },
    });

    const resultado = await buscarEncontrosDoMes(client, { idProduto: 99, ano: 2026, mes: 9 });

    expect(resultado).toEqual([]);
    expect(chamadas.filter((c) => c.tabela === "fat_encontro")).toHaveLength(0);
  });

  it("erro do PostgREST propaga como throw (padrão do projeto)", async () => {
    const { client } = criarClienteMock({
      fat_contrato: { data: null, error: { message: "permission denied" } },
    });

    await expect(buscarEncontrosDoMes(client, { idProduto: 1, ano: 2026, mes: 9 })).rejects.toEqual({
      message: "permission denied",
    });
  });

  it("filtro de projeto e de contrato restringem a consulta de contratos", async () => {
    const { client, chamadas } = criarClienteMock({
      fat_contrato: { data: [], error: null },
    });

    await buscarEncontrosDoMes(client, {
      idProduto: 1,
      ano: 2026,
      mes: 9,
      idProjeto: 7,
      idContrato: 42,
    });

    expect(argsDe(chamadas, "fat_contrato", "eq")).toEqual([
      ["id_produto", 1],
      ["id_projeto", 7],
      ["id_contrato", 42],
    ]);
  });

  it("gestora aplica AND: só os contratos na interseção chegam em fat_encontro", async () => {
    // Os dois conjuntos são deliberadamente diferentes e não-coincidentes
    // (lição L-028): produto tem 1,2,3; gestora tem 2,3,4. União seria
    // [1,2,3,4] e "só o primeiro conjunto" seria [1,2,3] -- só a interseção
    // verdadeira é [2,3].
    const { client, chamadas } = criarClienteMock({
      fat_contrato: [
        { data: [{ id_contrato: 1 }, { id_contrato: 2 }, { id_contrato: 3 }], error: null },
        { data: [{ id_contrato: 2, id_contratante: 20 }], error: null },
      ],
      rel_usuario_contrato: {
        data: [{ id_contrato: 2 }, { id_contrato: 3 }, { id_contrato: 4 }],
        error: null,
      },
      fat_encontro: { data: [{ ...ENCONTRO_1, id_contrato: 2 }], error: null },
      dim_contratante: { data: [{ id_contratante: 20, nome: "Gabinete B" }], error: null },
      ref_etapa: { data: [], error: null },
      ref_tipo_registro: { data: [], error: null },
      rel_encontro_participante: { data: [], error: null },
    });

    await buscarEncontrosDoMes(client, { idProduto: 1, ano: 2026, mes: 9, idGestora: 55 });

    expect(argsDe(chamadas, "fat_encontro", "in")).toEqual([["id_contrato", [2, 3]]]);
  });

  it("mapeia os campos que o popover exibe, incluindo nulos como nulos (EST-13 AC1 / AD-005)", async () => {
    const { client } = criarClienteMock({
      fat_contrato: [
        { data: [{ id_contrato: 1 }], error: null },
        { data: [{ id_contrato: 1, id_contratante: 10 }], error: null },
      ],
      fat_encontro: { data: [{ ...ENCONTRO_1, local: null, id_etapa: null }], error: null },
      dim_contratante: { data: [{ id_contratante: 10, nome: "Gabinete A" }], error: null },
      ref_etapa: { data: [], error: null },
      ref_tipo_registro: { data: [{ id_tipo_registro: 2000, nome: "Escuta" }], error: null },
      rel_encontro_participante: { data: [], error: null },
    });

    const [encontro] = await buscarEncontrosDoMes(client, { idProduto: 1, ano: 2026, mes: 9 });

    expect(encontro).toEqual({
      idEncontro: 501,
      idContrato: 1,
      nomeContratante: "Gabinete A",
      titulo: "Mentoria 3",
      status: "planejado",
      dtPrevistaInicio: "2026-09-15T14:00:00-03:00",
      dtPrevistaFim: "2026-09-15T15:30:00-03:00",
      dtRealizada: null,
      nomeEtapa: null,
      nomeTipo: "Escuta",
      modalidade: "online",
      local: null,
      temaPrioritario: "Orçamento",
      participantes: [],
    });
  });

  it("participante identificado por id_usuario sai com o nome de dim_usuario", async () => {
    const { client } = criarClienteMock({
      fat_contrato: [
        { data: [{ id_contrato: 1 }], error: null },
        { data: [{ id_contrato: 1, id_contratante: 10 }], error: null },
      ],
      fat_encontro: { data: [ENCONTRO_1], error: null },
      dim_contratante: { data: [{ id_contratante: 10, nome: "Gabinete A" }], error: null },
      ref_etapa: { data: [], error: null },
      ref_tipo_registro: { data: [], error: null },
      rel_encontro_participante: {
        data: [
          {
            id_participacao: 9001,
            id_encontro: 501,
            id_usuario: 77,
            nome_livre: null,
            origem: "legisla",
            presente: true,
          },
        ],
        error: null,
      },
      dim_usuario: { data: [{ id_usuario: 77, nome: "Ana Gestora" }], error: null },
    });

    const [encontro] = await buscarEncontrosDoMes(client, { idProduto: 1, ano: 2026, mes: 9 });

    expect(encontro.participantes).toEqual([
      { idParticipacao: 9001, nome: "Ana Gestora", origem: "legisla", presente: true },
    ]);
  });

  it("participante sem id_usuario sai com o nome_livre (ck_participante_identificacao)", async () => {
    const { client } = criarClienteMock({
      fat_contrato: [
        { data: [{ id_contrato: 1 }], error: null },
        { data: [{ id_contrato: 1, id_contratante: 10 }], error: null },
      ],
      fat_encontro: { data: [ENCONTRO_1], error: null },
      dim_contratante: { data: [{ id_contratante: 10, nome: "Gabinete A" }], error: null },
      ref_etapa: { data: [], error: null },
      ref_tipo_registro: { data: [], error: null },
      rel_encontro_participante: {
        data: [
          {
            id_participacao: 9002,
            id_encontro: 501,
            id_usuario: null,
            nome_livre: "Assessor convidado",
            origem: "externo",
            presente: false,
          },
        ],
        error: null,
      },
    });

    const [encontro] = await buscarEncontrosDoMes(client, { idProduto: 1, ano: 2026, mes: 9 });

    expect(encontro.participantes).toEqual([
      { idParticipacao: 9002, nome: "Assessor convidado", origem: "externo", presente: false },
    ]);
  });
});
