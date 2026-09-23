import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarMandatosLista } from "./mandatos-lista";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/tasks.md, T19
// "Done when" (EST-09 AC1, AC2, AC3; EST-04 AC5) --
//  - Cada filtro (data, gestora, projeto, etapa, status) restringe isoladamente
//  - Dois filtros juntos aplicam AND
//  - Prospecções não aparecem
//  - Contagem total acompanha o filtro
//
// Mock roteado por nome de tabela, mesmo padrão de queries/kanban.test.ts,
// queries/quadro.test.ts e queries/pendencias.test.ts.

type Chamada = { tabela: string; metodo: string; args: unknown[] };
type RespostaTabela = { data: unknown; error: { message: string } | null };

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
      gte: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "gte", args });
        return builder;
      },
      lte: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "lte", args });
        return builder;
      },
      or: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "or", args });
        return builder;
      },
      order: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "order", args });
        return builder;
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

const CONTRATO_1 = {
  id_contrato: 1,
  id_contratante: 10,
  id_projeto: 100,
  id_etapa_atual: 1000,
  status: "ativo" as const,
  dt_inicio: "2026-01-10",
  dt_fim: null,
  atualizado_em: "2026-09-12T10:00:00Z",
};

const CONTRATO_2 = {
  id_contrato: 2,
  id_contratante: 20,
  id_projeto: 200,
  id_etapa_atual: 2000,
  status: "concluido" as const,
  dt_inicio: "2026-02-15",
  dt_fim: "2026-08-01",
  atualizado_em: "2026-08-01T15:30:00Z",
};

function respostasBase() {
  return {
    fat_contrato: { data: [CONTRATO_1, CONTRATO_2], error: null },
    dim_contratante: {
      data: [
        { id_contratante: 10, nome: "Dep. Ana Ribeiro" },
        { id_contratante: 20, nome: "Ver. Marcos Duarte" },
      ],
      error: null,
    },
    ref_projeto: {
      data: [
        { id_projeto: 100, nome: "Projeto Alfa" },
        { id_projeto: 200, nome: "Projeto Beta" },
      ],
      error: null,
    },
    ref_etapa: {
      data: [
        { id_etapa: 1000, nome: "Diagnóstico" },
        { id_etapa: 2000, nome: "Monitoramento" },
      ],
      error: null,
    },
    rel_usuario_contrato: { data: [], error: null },
  };
}

describe("buscarMandatosLista (EST-09)", () => {
  it("mapeia contratante, vigência, status, gestora, projeto, etapa atual e responsável (AC1)", async () => {
    const { client } = criarClienteMock({
      ...respostasBase(),
      // Duas chamadas separadas a rel_usuario_contrato (buscarPessoaAtivaPorPapel
      // roda uma vez por papel: gestora, depois mentor) -- fila com uma
      // resposta por chamada, na ordem em que acontecem.
      rel_usuario_contrato: [
        { data: [{ id_contrato: 1, dim_usuario: { nome: "Gestora Um" } }], error: null },
        { data: [{ id_contrato: 1, dim_usuario: { nome: "Mentor Um" } }], error: null },
      ],
    });

    const resultado = await buscarMandatosLista(client, { idProduto: 7 });

    expect(resultado[0]).toEqual({
      idContrato: 1,
      nomeContratante: "Dep. Ana Ribeiro",
      dtInicio: "2026-01-10",
      dtFim: null,
      status: "ativo",
      nomeGestora: "Gestora Um",
      nomeProjeto: "Projeto Alfa",
      nomeEtapaAtual: "Diagnóstico",
      nomeResponsavel: "Mentor Um",
      atualizadoEm: "2026-09-12T10:00:00Z",
    });
  });

  it("dt_fim nula passa adiante como null, nunca sentinela (AD-005)", async () => {
    const { client } = criarClienteMock(respostasBase());

    const resultado = await buscarMandatosLista(client, { idProduto: 7 });

    expect(resultado.find((c) => c.idContrato === 1)?.dtFim).toBeNull();
    expect(resultado.find((c) => c.idContrato === 2)?.dtFim).toBe("2026-08-01");
  });

  it("sem filtro aplicado, a contagem acompanha o total de contratos do produto (AC2)", async () => {
    const { client } = criarClienteMock(respostasBase());

    const resultado = await buscarMandatosLista(client, { idProduto: 7 });

    expect(resultado).toHaveLength(2);
  });

  it("produto sem contratos retorna [] sem consultar as tabelas de enriquecimento", async () => {
    const { client, chamadas } = criarClienteMock({ fat_contrato: { data: [], error: null } });

    const resultado = await buscarMandatosLista(client, { idProduto: 7 });

    expect(resultado).toEqual([]);
    expect(chamadas.some((c) => c.tabela === "dim_contratante")).toBe(false);
  });

  it("nunca consulta fat_prospeccao -- prospecções não aparecem na lista (EST-04 AC5)", async () => {
    const { client, chamadas } = criarClienteMock(respostasBase());

    await buscarMandatosLista(client, { idProduto: 7 });

    expect(chamadas.some((c) => c.tabela === "fat_prospeccao")).toBe(false);
  });

  it("filtro de data (dtInicioDe/dtInicioAte) restringe isoladamente (AC3)", async () => {
    const { client, chamadas } = criarClienteMock(respostasBase());

    await buscarMandatosLista(client, { idProduto: 7, dtInicioDe: "2026-01-01", dtInicioAte: "2026-12-31" });

    const filtrosContrato = chamadas.filter((c) => c.tabela === "fat_contrato");
    expect(filtrosContrato.some((c) => c.metodo === "gte" && c.args[0] === "dt_inicio" && c.args[1] === "2026-01-01")).toBe(true);
    expect(filtrosContrato.some((c) => c.metodo === "lte" && c.args[0] === "dt_inicio" && c.args[1] === "2026-12-31")).toBe(true);
  });

  it("filtro de projeto restringe isoladamente -- entra no select de fat_contrato (AC3)", async () => {
    const { client, chamadas } = criarClienteMock(respostasBase());

    await buscarMandatosLista(client, { idProduto: 7, idsProjeto: [100] });

    const insContrato = chamadas.filter((c) => c.tabela === "fat_contrato" && c.metodo === "in").map((c) => c.args);
    expect(insContrato).toContainEqual(["id_projeto", [100]]);
  });

  it("vários projetos viram um único IN -- união dentro do mesmo filtro", async () => {
    const { client, chamadas } = criarClienteMock(respostasBase());

    await buscarMandatosLista(client, { idProduto: 7, idsProjeto: [100, 101] });

    const insContrato = chamadas.filter((c) => c.tabela === "fat_contrato" && c.metodo === "in").map((c) => c.args);
    expect(insContrato).toContainEqual(["id_projeto", [100, 101]]);
  });

  it("lista vazia em qualquer filtro equivale a sem filtro (não vira IN ())", async () => {
    const { client, chamadas } = criarClienteMock(respostasBase());

    await buscarMandatosLista(client, { idProduto: 7, idsProjeto: [], idsEtapa: [], status: [], idsGestora: [] });

    const filtrosContrato = chamadas.filter(
      (c) => c.tabela === "fat_contrato" && c.metodo === "in" && ["id_projeto", "id_etapa_atual", "status"].includes(c.args[0] as string)
    );
    expect(filtrosContrato).toEqual([]);
    expect(chamadas.some((c) => c.tabela === "rel_usuario_contrato" && c.metodo === "in" && c.args[0] === "id_usuario")).toBe(false);
  });

  it("filtro de etapa restringe isoladamente -- entra no select de fat_contrato (AC3)", async () => {
    const { client, chamadas } = criarClienteMock(respostasBase());

    await buscarMandatosLista(client, { idProduto: 7, idsEtapa: [1000] });

    const insContrato = chamadas.filter((c) => c.tabela === "fat_contrato" && c.metodo === "in").map((c) => c.args);
    expect(insContrato).toContainEqual(["id_etapa_atual", [1000]]);
  });

  it("filtro de status restringe isoladamente -- entra no select de fat_contrato (AC3)", async () => {
    const { client, chamadas } = criarClienteMock(respostasBase());

    await buscarMandatosLista(client, { idProduto: 7, status: ["ativo", "concluido"] });

    const insContrato = chamadas.filter((c) => c.tabela === "fat_contrato" && c.metodo === "in").map((c) => c.args);
    expect(insContrato).toContainEqual(["status", ["ativo", "concluido"]]);
  });

  it("filtro de gestora restringe isoladamente -- consulta rel_usuario_contrato por papel gestora (AC3)", async () => {
    const { client, chamadas } = criarClienteMock({
      ...respostasBase(),
      rel_usuario_contrato: { data: [{ id_contrato: 1 }], error: null },
    });

    const resultado = await buscarMandatosLista(client, { idProduto: 7, idsGestora: [42, 43] });

    expect(resultado.map((c) => c.idContrato)).toEqual([1]);
    const chamadaVinculo = chamadas.find(
      (c) => c.tabela === "rel_usuario_contrato" && c.metodo === "eq" && c.args[0] === "papel_no_contrato"
    );
    expect(chamadaVinculo?.args).toEqual(["papel_no_contrato", "gestora"]);
    const chamadaGestoras = chamadas.find(
      (c) => c.tabela === "rel_usuario_contrato" && c.metodo === "in" && c.args[0] === "id_usuario"
    );
    expect(chamadaGestoras?.args).toEqual(["id_usuario", [42, 43]]);
  });

  it("gestora e projeto juntos aplicam AND (interseção), não OR", async () => {
    const { client } = criarClienteMock({
      // Recorte de produto+projeto (100) devolve só o contrato 1.
      fat_contrato: { data: [CONTRATO_1], error: null },
      dim_contratante: respostasBase().dim_contratante,
      ref_projeto: respostasBase().ref_projeto,
      ref_etapa: respostasBase().ref_etapa,
      // Gestora 42 só tem vínculo ativo com o contrato 2 -- fora do recorte
      // de projeto. A interseção deve devolver [], nunca a união.
      rel_usuario_contrato: { data: [{ id_contrato: 2 }], error: null },
    });

    const resultado = await buscarMandatosLista(client, { idProduto: 7, idsProjeto: [100], idsGestora: [42] });

    expect(resultado).toEqual([]);
  });

  // PF3-03 (.specs/features/pente-fino-2026-09-23-lote2/spec.md): PLL filtra
  // por mentor, não gestora -- mesma mecânica, papel diferente.
  it("filtro de mentor restringe isoladamente -- consulta rel_usuario_contrato por papel mentor (PF3-03)", async () => {
    const { client, chamadas } = criarClienteMock({
      ...respostasBase(),
      rel_usuario_contrato: { data: [{ id_contrato: 2 }], error: null },
    });

    const resultado = await buscarMandatosLista(client, { idProduto: 7, idsMentor: [77] });

    expect(resultado.map((c) => c.idContrato)).toEqual([2]);
    const chamadaVinculo = chamadas.find(
      (c) => c.tabela === "rel_usuario_contrato" && c.metodo === "eq" && c.args[0] === "papel_no_contrato"
    );
    expect(chamadaVinculo?.args).toEqual(["papel_no_contrato", "mentor"]);
    const chamadaMentores = chamadas.find(
      (c) => c.tabela === "rel_usuario_contrato" && c.metodo === "in" && c.args[0] === "id_usuario"
    );
    expect(chamadaMentores?.args).toEqual(["id_usuario", [77]]);
  });
});
