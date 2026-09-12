import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarRegistrosDaAgenda } from "./registros-agenda";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/tasks.md, T27
// "Done when" (EST-12 AC5) --
//  - Sem filtro retorna todos do recorte; com idEncontro retorna só os dele
//  - Retorna tipo, data, descrição e responsável
//
// Mock roteado por nome de tabela, mesmo padrão de queries/agenda.test.ts.
// O mock devolve o mesmo `data` independentemente do filtro recebido, então
// "filtra por encontro" só é verificável asserindo o .eq() que foi (ou não
// foi) emitido -- lição L-029.

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

const REGISTRO_1 = {
  id_registro: 900,
  id_encontro: 501,
  id_contrato: 1,
  id_tipo_registro: 2000,
  ocorrido_em: "2026-09-15T16:00:00-03:00",
  resumo: "Alinhamento de pauta",
  id_usuario_autor: 77,
};

const RECORTE = { idProduto: 1, ano: 2026, mes: 9 };

function respostasPadrao(registros: unknown[]) {
  return {
    fat_contrato: { data: [{ id_contrato: 1 }], error: null },
    fat_registro: { data: registros, error: null },
    ref_tipo_registro: { data: [{ id_tipo_registro: 2000, nome: "Escuta Diagnóstica" }], error: null },
    dim_usuario: { data: [{ id_usuario: 77, nome: "Ana Gestora" }], error: null },
  };
}

describe("buscarRegistrosDaAgenda (EST-12 AC5)", () => {
  it("sem idEncontro não filtra por encontro: todos os registros do recorte", async () => {
    const { client, chamadas } = criarClienteMock(respostasPadrao([REGISTRO_1]));

    const resultado = await buscarRegistrosDaAgenda(client, RECORTE);

    expect(argsDe(chamadas, "fat_registro", "eq")).toEqual([]);
    expect(resultado).toHaveLength(1);
  });

  it("com idEncontro filtra a consulta por aquele encontro (AC5, lado oposto)", async () => {
    const { client, chamadas } = criarClienteMock(respostasPadrao([REGISTRO_1]));

    await buscarRegistrosDaAgenda(client, { ...RECORTE, idEncontro: 501 });

    expect(argsDe(chamadas, "fat_registro", "eq")).toEqual([["id_encontro", 501]]);
  });

  it("retorna tipo, data, descrição e responsável resolvidos", async () => {
    const { client } = criarClienteMock(respostasPadrao([REGISTRO_1]));

    const [registro] = await buscarRegistrosDaAgenda(client, RECORTE);

    expect(registro).toEqual({
      idRegistro: 900,
      idEncontro: 501,
      idContrato: 1,
      tipoRegistro: "Escuta Diagnóstica",
      ocorridoEm: "2026-09-15T16:00:00-03:00",
      resumo: "Alinhamento de pauta",
      nomeAutor: "Ana Gestora",
    });
  });

  it("resumo nulo passa adiante como nulo, nunca string vazia (AD-005)", async () => {
    const { client } = criarClienteMock(respostasPadrao([{ ...REGISTRO_1, resumo: null }]));

    const [registro] = await buscarRegistrosDaAgenda(client, RECORTE);

    expect(registro.resumo).toBeNull();
  });

  it("registro solto, sem encontro vinculado, mantém idEncontro nulo", async () => {
    const { client } = criarClienteMock(respostasPadrao([{ ...REGISTRO_1, id_encontro: null }]));

    const [registro] = await buscarRegistrosDaAgenda(client, RECORTE);

    expect(registro.idEncontro).toBeNull();
  });

  it("recorte sem registro retorna [], nunca lança", async () => {
    const { client } = criarClienteMock(respostasPadrao([]));

    await expect(buscarRegistrosDaAgenda(client, RECORTE)).resolves.toEqual([]);
  });

  it("produto sem contrato retorna [] sem consultar fat_registro", async () => {
    const { client, chamadas } = criarClienteMock({
      fat_contrato: { data: [], error: null },
    });

    const resultado = await buscarRegistrosDaAgenda(client, { ...RECORTE, idProduto: 99 });

    expect(resultado).toEqual([]);
    expect(chamadas.filter((c) => c.tabela === "fat_registro")).toHaveLength(0);
  });

  it("herda o recorte da grade: projeto e contrato restringem a consulta de contratos", async () => {
    const { client, chamadas } = criarClienteMock({ fat_contrato: { data: [], error: null } });

    await buscarRegistrosDaAgenda(client, { ...RECORTE, idProjeto: 7, idContrato: 42 });

    expect(argsDe(chamadas, "fat_contrato", "eq")).toEqual([
      ["id_produto", 1],
      ["id_projeto", 7],
      ["id_contrato", 42],
    ]);
  });

  it("erro do PostgREST propaga como throw (padrão do projeto)", async () => {
    const { client } = criarClienteMock({
      fat_contrato: { data: [{ id_contrato: 1 }], error: null },
      fat_registro: { data: null, error: { message: "permission denied" } },
    });

    await expect(buscarRegistrosDaAgenda(client, RECORTE)).rejects.toEqual({
      message: "permission denied",
    });
  });
});
