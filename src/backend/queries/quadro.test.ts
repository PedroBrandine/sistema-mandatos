import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarQuadro } from "./quadro";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/tasks.md, T15
// "Done when" (EST-07 AC1, AC1b) --
//  - Raia de Prospecção vem primeiro; demais colunas por ref_etapa.ordem
//  - Para a Estratégia com o seed atual retorna 7 colunas (simulado aqui com
//    6 etapas mockadas -- a contagem real do seed é preocupação de
//    integração, fora do gate quick desta task)
//  - Etapa sem contrato retorna coluna vazia com contador 0
//  - Contrato sem id_etapa_atual cai em coluna, nunca some
//  - Adicionar linha em ref_etapa muda a contagem de colunas sem tocar em código
//
// Mock roteado por nome de tabela com fila de respostas, mesmo padrão de
// queries/kanban.test.ts (buscarBoardKanban e buscarCargoPartidoPorContrato
// consultam fat_contrato/ref_etapa mais de uma vez na mesma chamada).

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

function etapa(id: number, ordem: number, duracao: number | null = 30) {
  return { id_etapa: id, codigo: `etapa_${id}`, nome: `Etapa ${id}`, ordem, duracao_prevista_dias: duracao };
}

describe("buscarQuadro (EST-07)", () => {
  it("raia de Prospecção vem primeiro; demais colunas por ref_etapa.ordem (AC1)", async () => {
    const { client } = criarClienteMock({
      ref_etapa: [
        { data: [etapa(1, 1), etapa(2, 2)], error: null },
        { data: [etapa(1, 1), etapa(2, 2)], error: null },
      ],
      fat_contrato: { data: [], error: null },
      fat_prospeccao: {
        data: [{ id_prospeccao: 1, id_contratante: 50, dt_abertura: "2026-08-01" }],
        error: null,
      },
      dim_contratante: { data: [{ id_contratante: 50, nome: "Mandato Prospect" }], error: null },
    });

    const resultado = await buscarQuadro(client, { idProduto: 7 });

    expect(resultado.map((c) => c.tipo)).toEqual(["prospeccao", "etapa", "etapa"]);
    expect(resultado[1].idEtapa).toBe(1);
    expect(resultado[2].idEtapa).toBe(2);
  });

  it("com 6 etapas (equivalente ao seed atual da Estratégia) e nenhuma prospecção, retorna 7 colunas (AC1)", async () => {
    const seisEtapas = Array.from({ length: 6 }, (_, i) => etapa(i + 1, i + 1));
    const { client } = criarClienteMock({
      ref_etapa: [
        { data: seisEtapas, error: null },
        { data: seisEtapas, error: null },
      ],
      fat_contrato: { data: [], error: null },
      fat_prospeccao: { data: [], error: null },
    });

    const resultado = await buscarQuadro(client, { idProduto: 7 });

    expect(resultado).toHaveLength(7);
  });

  it("etapa sem contrato retorna coluna vazia com contador 0 (edge case)", async () => {
    const { client } = criarClienteMock({
      ref_etapa: [
        { data: [etapa(1, 1)], error: null },
        { data: [etapa(1, 1)], error: null },
      ],
      fat_contrato: { data: [], error: null },
      fat_prospeccao: { data: [], error: null },
    });

    const resultado = await buscarQuadro(client, { idProduto: 7 });

    const colunaEtapa = resultado.find((c) => c.idEtapa === 1);
    expect(colunaEtapa?.cards).toEqual([]);
  });

  it("contrato sem id_etapa_atual não some -- aparece em alguma coluna de etapa (edge case)", async () => {
    const { client } = criarClienteMock({
      ref_etapa: [
        { data: [etapa(1, 1), etapa(2, 2)], error: null },
        { data: [etapa(1, 1), etapa(2, 2)], error: null },
      ],
      fat_contrato: [
        {
          data: [
            { id_contrato: 100, id_etapa_atual: null, id_contratante: 1, status: "ativo", dt_inicio: "2026-01-01" },
          ],
          error: null,
        },
        { data: [], error: null }, // buscarCargoPartidoPorContrato -- id_contratante do card 100
      ],
      dim_contratante: { data: [{ id_contratante: 1, nome: "Mandato Alfa" }], error: null },
      fat_etapa_contrato: { data: [], error: null },
    });

    const resultado = await buscarQuadro(client, { idProduto: 7 });

    const totalCards = resultado.filter((c) => c.tipo === "etapa").reduce((soma, c) => soma + c.cards.length, 0);
    expect(totalCards).toBe(1);
  });

  it("adicionar linha em ref_etapa muda a contagem de colunas sem tocar em código (AC1b)", async () => {
    const tresEtapas = Array.from({ length: 3 }, (_, i) => etapa(i + 1, i + 1));
    const { client } = criarClienteMock({
      ref_etapa: [
        { data: tresEtapas, error: null },
        { data: tresEtapas, error: null },
      ],
      fat_contrato: { data: [], error: null },
      fat_prospeccao: { data: [], error: null },
    });

    const resultado = await buscarQuadro(client, { idProduto: 7 });

    expect(resultado).toHaveLength(4); // 3 etapas + 1 raia de Prospecção -- não 7 fixo
  });

  it("card de etapa traz cargo/partido atuais do mandato do contratante (EST-07 AC2)", async () => {
    const { client } = criarClienteMock({
      ref_etapa: [
        { data: [{ id_etapa: 1, codigo: "e1", nome: "Etapa 1", ordem: 1 }], error: null },
        { data: [etapa(1, 1)], error: null },
      ],
      fat_contrato: [
        {
          data: [{ id_contrato: 100, id_etapa_atual: 1, id_contratante: 1, status: "ativo", dt_inicio: "2026-01-01" }],
          error: null,
        },
        { data: [{ id_contrato: 100, id_contratante: 1 }], error: null },
      ],
      dim_contratante: { data: [{ id_contratante: 1, nome: "Mandato Alfa" }], error: null },
      fat_etapa_contrato: { data: [], error: null },
      dim_mandato: {
        data: [{ id_contratante: 1, ref_cargo: { nome: "Deputado Estadual" }, ref_partido: { sigla: "ABC" } }],
        error: null,
      },
    });

    const resultado = await buscarQuadro(client, { idProduto: 7 });

    const coluna = resultado.find((c) => c.idEtapa === 1);
    expect(coluna?.cards[0]).toMatchObject({ cargoAtual: "Deputado Estadual", partidoAtual: "ABC" });
  });

  it("contratante sem dim_mandato (ex.: Coalizão) devolve cargo/partido null, sem lançar", async () => {
    const { client } = criarClienteMock({
      ref_etapa: [
        { data: [{ id_etapa: 1, codigo: "e1", nome: "Etapa 1", ordem: 1 }], error: null },
        { data: [etapa(1, 1)], error: null },
      ],
      fat_contrato: [
        {
          data: [{ id_contrato: 100, id_etapa_atual: 1, id_contratante: 9, status: "ativo", dt_inicio: "2026-01-01" }],
          error: null,
        },
        { data: [{ id_contrato: 100, id_contratante: 9 }], error: null },
      ],
      dim_contratante: { data: [{ id_contratante: 9, nome: "Coalizão X" }], error: null },
      fat_etapa_contrato: { data: [], error: null },
      dim_mandato: { data: [], error: null },
    });

    const resultado = await buscarQuadro(client, { idProduto: 7 });

    const coluna = resultado.find((c) => c.idEtapa === 1);
    expect(coluna?.cards[0]).toMatchObject({ cargoAtual: null, partidoAtual: null });
  });

  it("coluna de etapa carrega duracaoPrevistaDias de ref_etapa, null quando ausente", async () => {
    const { client } = criarClienteMock({
      ref_etapa: [
        {
          data: [
            { id_etapa: 1, codigo: "e1", nome: "Etapa 1", ordem: 1 },
            { id_etapa: 2, codigo: "e2", nome: "Etapa 2", ordem: 2 },
          ],
          error: null,
        },
        { data: [etapa(1, 1, 21), etapa(2, 2, null)], error: null },
      ],
      fat_contrato: { data: [], error: null },
      fat_prospeccao: { data: [], error: null },
    });

    const resultado = await buscarQuadro(client, { idProduto: 7 });

    expect(resultado.find((c) => c.idEtapa === 1)).toMatchObject({ duracaoPrevistaDias: 21 });
    expect(resultado.find((c) => c.idEtapa === 2)).toMatchObject({ duracaoPrevistaDias: null });
  });

  it("card de prospecção calcula dias em aberto a partir de dt_abertura", async () => {
    const hoje = new Date();
    const dtAbertura = new Date(hoje.getTime() - 10 * 86400000).toISOString().slice(0, 10);
    const { client } = criarClienteMock({
      ref_etapa: [{ data: [], error: null }],
      fat_contrato: { data: [], error: null },
      fat_prospeccao: { data: [{ id_prospeccao: 1, id_contratante: 50, dt_abertura: dtAbertura }], error: null },
      dim_contratante: { data: [{ id_contratante: 50, nome: "Mandato Prospect" }], error: null },
    });

    const resultado = await buscarQuadro(client, { idProduto: 7 });

    const raia = resultado.find((c) => c.tipo === "prospeccao");
    expect(raia?.cards[0]).toMatchObject({ nomeContratante: "Mandato Prospect", diasEmAberto: 10 });
  });
});
