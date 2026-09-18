import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarEvolucaoGip, buscarGipDoContrato } from "./gip";

// Spec anchor: .specs/features/ficha-mandato-contrato/tasks.md, T33 Done-when
// (FMC-25, FMC-27, FMC-28) --
//  - Devolve dimensões ativas ordenadas, com níveis e descritores do catálogo
//  - Momento não aplicado devolve estado "não aplicado", não lista vazia ambígua
//  - Evolução devolve `gap` da view -- nunca recalculado no cliente (AD-003/AD-014)

type Chamada = { tabela: string; metodo: string; args: unknown[] };
type RespostaTabela = { data: unknown; error: { message: string } | null };

// Mesmo padrão de queries/formulario.test.ts: roteia por nome de tabela,
// builder encadeável e "thenable".
function criarClienteMock(respostasPorTabela: Record<string, RespostaTabela>) {
  const chamadas: Chamada[] = [];

  function criarBuilder(tabela: string) {
    const resposta = respostasPorTabela[tabela] ?? { data: [], error: null };
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
      then: (resolve: (r: RespostaTabela) => unknown, reject: (e: unknown) => unknown) =>
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

const DIMENSOES = [
  { id_dimensao: 1, codigo: "performance_objetivos", nome: "Performance dos objetivos específicos", ordem: 1, valor_min: 0, valor_max: 3 },
  { id_dimensao: 2, codigo: "monitoramento", nome: "Monitoramento e atingimento do planejamento", ordem: 2, valor_min: 0, valor_max: 3 },
  { id_dimensao: 3, codigo: "capacidade_gestao", nome: "Capacidade de gestão", ordem: 3, valor_min: 0, valor_max: 2 },
  { id_dimensao: 4, codigo: "capacidade_absorcao", nome: "Capacidade de absorção de incidência política", ordem: 4, valor_min: 0, valor_max: 2 },
];

const NIVEIS = [
  { id_dimensao: 1, valor: 0, descricao: "Não apresenta padrões" },
  { id_dimensao: 1, valor: 1, descricao: "Apresenta algumas práticas" },
  { id_dimensao: 1, valor: 2, descricao: "Progride menos de 60%" },
  { id_dimensao: 1, valor: 3, descricao: "Progride acima de 60%" },
  { id_dimensao: 3, valor: 0, descricao: "Não implementa rotinas" },
  { id_dimensao: 3, valor: 1, descricao: "Implementa rotinas" },
  { id_dimensao: 3, valor: 2, descricao: "Implementa estratégia de gestão" },
];

describe("buscarGipDoContrato (FMC-25, FMC-27)", () => {
  it("momento não aplicado: devolve aplicado=false explícito, com o catálogo cheio e valorAtual null em cada dimensão", async () => {
    const { client } = criarClienteMock({
      ref_dimensao_gip: { data: DIMENSOES, error: null },
      ref_nivel_dimensao_gip: { data: NIVEIS, error: null },
      fat_gip: { data: null, error: null },
    });

    const resultado = await buscarGipDoContrato(client, 7, "inicio");

    expect(resultado.aplicado).toBe(false);
    expect(resultado.aplicadoEm).toBeNull();
    expect(resultado.idSubmissao).toBeNull();
    expect(resultado.dimensoes).toHaveLength(4);
    expect(resultado.dimensoes.every((d) => d.valorAtual === null)).toBe(true);
  });

  it("dimensões ativas vêm ordenadas por `ordem`, com os descritores de nível do catálogo", async () => {
    const { client } = criarClienteMock({
      ref_dimensao_gip: { data: DIMENSOES, error: null },
      ref_nivel_dimensao_gip: { data: NIVEIS, error: null },
      fat_gip: { data: null, error: null },
    });

    const resultado = await buscarGipDoContrato(client, 7, "inicio");

    expect(resultado.dimensoes.map((d) => d.ordem)).toEqual([1, 2, 3, 4]);
    expect(resultado.dimensoes[0].niveis).toEqual([
      { valor: 0, descricao: "Não apresenta padrões" },
      { valor: 1, descricao: "Apresenta algumas práticas" },
      { valor: 2, descricao: "Progride menos de 60%" },
      { valor: 3, descricao: "Progride acima de 60%" },
    ]);
  });

  it("dimensão de faixa 0-2 devolve exatamente 3 níveis, sem esticar a escala", async () => {
    const { client } = criarClienteMock({
      ref_dimensao_gip: { data: DIMENSOES, error: null },
      ref_nivel_dimensao_gip: { data: NIVEIS, error: null },
      fat_gip: { data: null, error: null },
    });

    const resultado = await buscarGipDoContrato(client, 7, "inicio");
    const capacidadeGestao = resultado.dimensoes.find((d) => d.codigo === "capacidade_gestao");

    expect(capacidadeGestao?.niveis).toHaveLength(3);
  });

  it("momento aplicado: devolve aplicado=true, aplicadoEm e o valor gravado por dimensão (eixo do PRÓPRIO momento)", async () => {
    const { client } = criarClienteMock({
      ref_dimensao_gip: { data: DIMENSOES, error: null },
      ref_nivel_dimensao_gip: { data: NIVEIS, error: null },
      fat_gip: { data: { id_gip: 501, aplicado_em: "2026-09-16", id_submissao: 9001 }, error: null },
      fat_gip_dimensao: {
        data: [
          { id_dimensao: 1, valor: 2 },
          { id_dimensao: 3, valor: 1 },
        ],
        error: null,
      },
    });

    const resultado = await buscarGipDoContrato(client, 7, "inicio");

    expect(resultado.aplicado).toBe(true);
    expect(resultado.aplicadoEm).toBe("2026-09-16");
    expect(resultado.idSubmissao).toBe(9001);
    expect(resultado.dimensoes.find((d) => d.idDimensao === 1)?.valorAtual).toBe(2);
    expect(resultado.dimensoes.find((d) => d.idDimensao === 3)?.valorAtual).toBe(1);
    expect(resultado.dimensoes.find((d) => d.idDimensao === 2)?.valorAtual).toBeNull();
  });

  it("momento aplicado filtra fat_gip_dimensao pelo eixo do próprio momento (fim), não pega a régua_sonhos copiada", async () => {
    const { client, chamadas } = criarClienteMock({
      ref_dimensao_gip: { data: DIMENSOES, error: null },
      ref_nivel_dimensao_gip: { data: NIVEIS, error: null },
      fat_gip: { data: { id_gip: 501, aplicado_em: "2026-10-01" }, error: null },
      fat_gip_dimensao: { data: [{ id_dimensao: 1, valor: 3 }], error: null },
    });

    await buscarGipDoContrato(client, 7, "fim");

    const chamadaEixo = chamadas.find(
      (c) => c.tabela === "fat_gip_dimensao" && c.metodo === "eq" && c.args[0] === "eixo"
    );
    expect(chamadaEixo?.args).toEqual(["eixo", "onde_chegamos"]);
  });
});

describe("buscarEvolucaoGip (FMC-28 AC8-AC10) — gap nunca recalculado no cliente", () => {
  it("os dois momentos aplicados: devolve nivelInicio, nivelFim e o gap exatamente como a view devolveu", async () => {
    const { client } = criarClienteMock({
      vw_gip_evolucao: {
        data: [
          {
            momento: "inicio",
            dimensao: "performance_objetivos",
            nome_dimensao: "Performance dos objetivos específicos",
            ordem: 1,
            regua_sonhos: 1,
            onde_chegamos: null,
            gap: null,
          },
          {
            momento: "fim",
            dimensao: "performance_objetivos",
            nome_dimensao: "Performance dos objetivos específicos",
            ordem: 1,
            regua_sonhos: 1,
            onde_chegamos: 3,
            gap: 2,
          },
        ],
        error: null,
      },
    });

    const resultado = await buscarEvolucaoGip(client, 7);

    expect(resultado).toEqual([
      {
        codigoDimensao: "performance_objetivos",
        nomeDimensao: "Performance dos objetivos específicos",
        ordem: 1,
        nivelInicio: 1,
        nivelFim: 3,
        gap: 2,
      },
    ]);
  });

  it("só o momento Início existe: nivelFim e gap chegam null, nunca recalculados a partir de nivelInicio", async () => {
    const { client } = criarClienteMock({
      vw_gip_evolucao: {
        data: [
          {
            momento: "inicio",
            dimensao: "capacidade_gestao",
            nome_dimensao: "Capacidade de gestão",
            ordem: 3,
            regua_sonhos: 2,
            onde_chegamos: null,
            gap: null,
          },
        ],
        error: null,
      },
    });

    const resultado = await buscarEvolucaoGip(client, 7);

    expect(resultado).toEqual([
      {
        codigoDimensao: "capacidade_gestao",
        nomeDimensao: "Capacidade de gestão",
        ordem: 3,
        nivelInicio: 2,
        nivelFim: null,
        gap: null,
      },
    ]);
  });

  it("linhas vêm ordenadas por `ordem` do catálogo", async () => {
    const { client } = criarClienteMock({
      vw_gip_evolucao: {
        data: [
          { momento: "fim", dimensao: "capacidade_absorcao", nome_dimensao: "D4", ordem: 4, regua_sonhos: 1, onde_chegamos: 1, gap: 0 },
          { momento: "fim", dimensao: "performance_objetivos", nome_dimensao: "D1", ordem: 1, regua_sonhos: 1, onde_chegamos: 0, gap: -1 },
        ],
        error: null,
      },
    });

    const resultado = await buscarEvolucaoGip(client, 7);

    expect(resultado.map((r) => r.ordem)).toEqual([1, 4]);
  });
});
