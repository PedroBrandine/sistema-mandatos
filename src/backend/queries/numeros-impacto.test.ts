import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import {
  atualizaEBuscaNumerosImpacto,
  buscarNumerosImpacto,
  buscarVisaoMandato,
  filtraNumerosImpacto,
  opcoesFiltroNumerosImpacto,
  resumoNumerosImpacto,
  type LinhaNumerosImpacto,
} from "./numeros-impacto";

// Spec anchor: saida-numeros-impacto T7 Done-when (.specs/features/saida-numeros-impacto/tasks.md) --
//  - Mapeia todas as colunas de mv_numeros_impacto (design.md, LinhaNumerosImpacto) de
//    snake_case para camelCase
//  - Ordena por nomeContratante (a MV não define ordem própria)
//  - nr_contratos_contratante/ordem_contrato repassados sem recálculo
//
// spec.md P1 AC1/AC3.

function criarClienteMock(resultado: { data: unknown; error: { message: string } | null }) {
  const client = {
    from: (_tabela: string) => ({
      select: (_colunas: string) => Promise.resolve(resultado),
    }),
  };
  return { client: client as unknown as SupabaseClient<Database> };
}

const LINHA_COMPLETA = {
  id_contrato: 10,
  id_contratante: 1,
  nome_contratante: "Mandato Exemplo",
  tipo_contratante: "mandato",
  sg_uf: "SP",
  nm_municipio: "São Paulo",
  nome_produto: "Estratégia",
  id_projeto: 5,
  nome_projeto: "Projeto X",
  tematica: "Saúde",
  dt_inicio: "2025-01-10",
  dt_fim: null,
  ano_inicio: 2025,
  status: "ativo",
  cargo_no_contrato: "Vereador(a)",
  partido_no_contrato: "PT",
  nr_contratos_contratante: 1,
  dt_primeira_contratacao: "2025-01-10",
  ordem_contrato: 1,
  id_gestora: 7,
  nome_gestora: "Gestora Exemplo",
  ds_genero: "feminino",
  ds_raca: "parda",
  ds_orientacao_sexual: "heterossexual",
};

describe("buscarNumerosImpacto", () => {
  it("mapeia todas as colunas de mv_numeros_impacto para camelCase", async () => {
    const { client } = criarClienteMock({ data: [LINHA_COMPLETA], error: null });

    const resultado = await buscarNumerosImpacto(client);

    expect(resultado).toEqual([
      {
        idContrato: 10,
        idContratante: 1,
        nomeContratante: "Mandato Exemplo",
        tipoContratante: "mandato",
        sgUf: "SP",
        nmMunicipio: "São Paulo",
        nomeProduto: "Estratégia",
        idProjeto: 5,
        nomeProjeto: "Projeto X",
        tematica: "Saúde",
        dtInicio: "2025-01-10",
        dtFim: null,
        anoInicio: 2025,
        status: "ativo",
        cargoNoContrato: "Vereador(a)",
        partidoNoContrato: "PT",
        nrContratosContratante: 1,
        dtPrimeiraContratacao: "2025-01-10",
        ordemContrato: 1,
        idGestora: 7,
        nomeGestora: "Gestora Exemplo",
        dsGenero: "feminino",
        dsRaca: "parda",
        dsOrientacaoSexual: "heterossexual",
      },
    ]);
  });

  it("ordena o resultado por nomeContratante (a MV não define ordem própria)", async () => {
    const { client } = criarClienteMock({
      data: [
        { ...LINHA_COMPLETA, id_contrato: 1, nome_contratante: "Zulu Contratante" },
        { ...LINHA_COMPLETA, id_contrato: 2, nome_contratante: "Alfa Contratante" },
        { ...LINHA_COMPLETA, id_contrato: 3, nome_contratante: "Mike Contratante" },
      ],
      error: null,
    });

    const resultado = await buscarNumerosImpacto(client);

    expect(resultado.map((r) => r.nomeContratante)).toEqual(["Alfa Contratante", "Mike Contratante", "Zulu Contratante"]);
  });

  it("repassa nr_contratos_contratante/ordem_contrato tal como vêm da MV, sem recalcular no backend", async () => {
    // Valores deliberadamente "impossíveis" de derivar só olhando para 1 linha
    // (nr_contratos_contratante = 5 com uma única linha retornada) -- se a
    // função recalculasse localmente, o valor sairia 1, nunca 5.
    const { client } = criarClienteMock({
      data: [{ ...LINHA_COMPLETA, nr_contratos_contratante: 5, ordem_contrato: 3 }],
      error: null,
    });

    const resultado = await buscarNumerosImpacto(client);

    expect(resultado[0].nrContratosContratante).toBe(5);
    expect(resultado[0].ordemContrato).toBe(3);
  });
});

// Spec anchor: saida-numeros-impacto T8 Done-when (.specs/features/saida-numeros-impacto/tasks.md) --
//  - Filtra por id_contratante e ordena por ordem_contrato
//  - Mapeia id_contrato_anterior (nullable) corretamente
//
// spec.md P2 AC2.

type Chamada = { metodo: string; args: unknown[] };

function criarClienteMockVisaoMandato(resultado: { data: unknown; error: { message: string } | null }) {
  const chamadas: Chamada[] = [];
  const builder: Record<string, unknown> = {
    select: (...args: unknown[]) => {
      chamadas.push({ metodo: "select", args });
      return builder;
    },
    eq: (...args: unknown[]) => {
      chamadas.push({ metodo: "eq", args });
      return builder;
    },
    order: (...args: unknown[]) => {
      chamadas.push({ metodo: "order", args });
      return Promise.resolve(resultado);
    },
  };
  const client = { from: (_tabela: string) => builder };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

const LINHA_VISAO_MANDATO = {
  id_contrato: 20,
  dt_inicio: "2024-01-15",
  dt_fim: null,
  status: "concluido",
  nome_produto: "Estratégia",
  nome_projeto: "Projeto Y",
  cargo_no_contrato: "Vereador(a)",
  partido_no_contrato: "PT",
  id_contrato_anterior: null,
  ordem_contrato: 1,
  nome_contratante: "Mandato Exemplo",
  tipo_contratante: "mandato",
};

describe("buscarVisaoMandato", () => {
  it("filtra por id_contratante e ordena por ordem_contrato, mapeando id_contrato_anterior corretamente", async () => {
    const { client, chamadas } = criarClienteMockVisaoMandato({
      data: [
        LINHA_VISAO_MANDATO,
        { ...LINHA_VISAO_MANDATO, id_contrato: 21, id_contrato_anterior: 20, ordem_contrato: 2, status: "ativo" },
      ],
      error: null,
    });

    const resultado = await buscarVisaoMandato(client, 99);

    expect(resultado).toEqual([
      {
        idContrato: 20,
        dtInicio: "2024-01-15",
        dtFim: null,
        status: "concluido",
        nomeProduto: "Estratégia",
        nomeProjeto: "Projeto Y",
        cargoNoContrato: "Vereador(a)",
        partidoNoContrato: "PT",
        idContratoAnterior: null,
        ordemContrato: 1,
        nomeContratante: "Mandato Exemplo",
        tipoContratante: "mandato",
      },
      {
        idContrato: 21,
        dtInicio: "2024-01-15",
        dtFim: null,
        status: "ativo",
        nomeProduto: "Estratégia",
        nomeProjeto: "Projeto Y",
        cargoNoContrato: "Vereador(a)",
        partidoNoContrato: "PT",
        idContratoAnterior: 20,
        ordemContrato: 2,
        nomeContratante: "Mandato Exemplo",
        tipoContratante: "mandato",
      },
    ]);
    expect(chamadas.find((c) => c.metodo === "eq")?.args).toEqual(["id_contratante", 99]);
    expect(chamadas.find((c) => c.metodo === "order")?.args).toEqual(["ordem_contrato"]);
  });

  it("contratante com id_contrato_anterior presente em 1 linha e ausente (null) em outra", async () => {
    const { client } = criarClienteMockVisaoMandato({
      data: [
        LINHA_VISAO_MANDATO,
        { ...LINHA_VISAO_MANDATO, id_contrato: 21, id_contrato_anterior: 20, ordem_contrato: 2 },
      ],
      error: null,
    });

    const resultado = await buscarVisaoMandato(client, 99);

    expect(resultado[0].idContratoAnterior).toBeNull();
    expect(resultado[1].idContratoAnterior).toBe(20);
  });
});

// Fix F1 (.specs/features/saida-numeros-impacto/validation.md, achado do
// Verifier): a ordem refresh-então-leitura (spec.md P1.AC2) não tinha
// nenhuma proteção automática -- o sensor de mutação confirmou que invertê-la
// não quebra build/lint. Extraída para atualizaEBuscaNumerosImpacto,
// testada aqui via mock que registra a ordem real das chamadas (mesmo padrão
// de "chamadas" já usado acima para buscarVisaoMandato).
function criarClienteMockRefreshEBusca(resultado: { data: unknown; error: { message: string } | null }) {
  const chamadas: string[] = [];
  const client = {
    schema: (_schema: string) => ({
      rpc: (_fn: string) => {
        chamadas.push("rpc:atualiza_numeros_impacto");
        return Promise.resolve({ error: null });
      },
    }),
    from: (_tabela: string) => ({
      select: (_colunas: string) => {
        chamadas.push("select:mv_numeros_impacto");
        return Promise.resolve(resultado);
      },
    }),
  };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

describe("atualizaEBuscaNumerosImpacto", () => {
  it("chama o refresh (RPC) antes da leitura (SELECT) -- spec.md P1.AC2", async () => {
    const { client, chamadas } = criarClienteMockRefreshEBusca({ data: [LINHA_COMPLETA], error: null });

    const resultado = await atualizaEBuscaNumerosImpacto(client);

    expect(chamadas).toEqual(["rpc:atualiza_numeros_impacto", "select:mv_numeros_impacto"]);
    expect(resultado).toHaveLength(1);
  });

  it("propaga o erro do refresh sem nunca chegar a tentar a leitura", async () => {
    const chamadas: string[] = [];
    const client = {
      schema: (_schema: string) => ({
        rpc: (_fn: string) => {
          chamadas.push("rpc:atualiza_numeros_impacto");
          return Promise.resolve({ error: { message: "falhou", code: "XX000" } });
        },
      }),
      from: (_tabela: string) => ({
        select: (_colunas: string) => {
          chamadas.push("select:mv_numeros_impacto");
          return Promise.resolve({ data: [], error: null });
        },
      }),
    };

    await expect(atualizaEBuscaNumerosImpacto(client as unknown as SupabaseClient<Database>)).rejects.toThrow();
    expect(chamadas).toEqual(["rpc:atualiza_numeros_impacto"]);
  });
});

// Dashboard "Números de Impacto" (2026-09-22): filtro e agregação puros,
// sem Supabase -- testados só com dados em memória.
describe("filtraNumerosImpacto / opcoesFiltroNumerosImpacto / resumoNumerosImpacto", () => {
  const BASE: LinhaNumerosImpacto = {
    idContrato: 1,
    idContratante: 100,
    nomeContratante: "Contratante A",
    tipoContratante: "mandato",
    sgUf: "SP",
    nmMunicipio: "São Paulo",
    nomeProduto: "Estratégia",
    idProjeto: 5,
    nomeProjeto: "Projeto X",
    tematica: "Saúde",
    dtInicio: "2025-01-10",
    dtFim: null,
    anoInicio: 2025,
    status: "ativo",
    cargoNoContrato: "Vereador(a)",
    partidoNoContrato: "PT",
    nrContratosContratante: 1,
    dtPrimeiraContratacao: "2025-01-10",
    ordemContrato: 1,
    idGestora: 10,
    nomeGestora: "Gestora 1",
    dsGenero: "feminino",
    dsRaca: "parda",
    dsOrientacaoSexual: "heterossexual",
  };

  const LINHAS: LinhaNumerosImpacto[] = [
    BASE,
    { ...BASE, idContrato: 2, idContratante: 100, idProjeto: 6, nomeProjeto: "Projeto Y", anoInicio: 2025, status: "ativo", idGestora: 10, nomeGestora: "Gestora 1", dsGenero: "masculino", dsRaca: "branca", dsOrientacaoSexual: "heterossexual" },
    { ...BASE, idContrato: 3, idContratante: 200, nomeContratante: "Contratante B", idProjeto: null, nomeProjeto: null, anoInicio: 2026, status: "concluido", idGestora: 20, nomeGestora: "Gestora 2", dsGenero: null, dsRaca: null, dsOrientacaoSexual: null },
    {
      ...BASE,
      idContrato: 4,
      idContratante: 300,
      nomeContratante: "Coalizão C",
      tipoContratante: "coalizao",
      nomeProduto: "Coalizão",
      idProjeto: null,
      nomeProjeto: null,
      anoInicio: 2026,
      status: "ativo",
      idGestora: 20,
      nomeGestora: "Gestora 2",
    },
  ];

  it("filtraNumerosImpacto sem filtro devolve tudo", () => {
    expect(filtraNumerosImpacto(LINHAS, {})).toHaveLength(4);
  });

  it("filtraNumerosImpacto por idsGestora/idsProjeto/anos combina como E, não OU", () => {
    const resultado = filtraNumerosImpacto(LINHAS, { idsGestora: [10], anos: [2025] });
    expect(resultado.map((l) => l.idContrato)).toEqual([1, 2]);
  });

  it("filtraNumerosImpacto exclui linha com idProjeto null quando o filtro de projeto está ativo", () => {
    const resultado = filtraNumerosImpacto(LINHAS, { idsProjeto: [5] });
    expect(resultado.map((l) => l.idContrato)).toEqual([1]);
  });

  // PF2-04 (.specs/features/pente-fino-2026-09-23/spec.md) AC2.
  it("filtraNumerosImpacto por idsContratante recorta só as linhas do(s) contratante(s) escolhido(s)", () => {
    const resultado = filtraNumerosImpacto(LINHAS, { idsContratante: [200] });
    expect(resultado.map((l) => l.idContrato)).toEqual([3]);
  });

  it("filtraNumerosImpacto por produtos recorta só as linhas do(s) produto(s) escolhido(s)", () => {
    const resultado = filtraNumerosImpacto(LINHAS, { produtos: ["Coalizão"] });
    expect(resultado.map((l) => l.idContrato)).toEqual([4]);
  });

  it("filtraNumerosImpacto combina idsContratante/produtos com os demais filtros como E, não OU", () => {
    const resultado = filtraNumerosImpacto(LINHAS, { idsContratante: [100], anos: [2025] });
    expect(resultado.map((l) => l.idContrato)).toEqual([1, 2]);
  });

  it("opcoesFiltroNumerosImpacto deriva listas distintas e ordenadas do próprio conjunto", () => {
    const opcoes = opcoesFiltroNumerosImpacto(LINHAS);
    expect(opcoes.gestoras).toEqual([
      { id: 10, nome: "Gestora 1" },
      { id: 20, nome: "Gestora 2" },
    ]);
    expect(opcoes.projetos).toEqual([
      { id: 5, nome: "Projeto X" },
      { id: 6, nome: "Projeto Y" },
    ]);
    expect(opcoes.anos).toEqual([2025, 2026]);
    // PF2-04: contratantes/produtos derivados do mesmo conjunto carregado.
    expect(opcoes.contratantes).toEqual([
      { id: 300, nome: "Coalizão C" },
      { id: 100, nome: "Contratante A" },
      { id: 200, nome: "Contratante B" },
    ]);
    expect(opcoes.produtos).toEqual(["Coalizão", "Estratégia"]);
  });

  it("resumoNumerosImpacto conta contratos, mandatos e coalizões (contratantes distintos por tipo)", () => {
    const resumo = resumoNumerosImpacto(LINHAS);
    expect(resumo.qtdContratos).toBe(4);
    expect(resumo.qtdMandatos).toBe(2);
    expect(resumo.qtdCoalizoes).toBe(1);
  });

  it("resumoNumerosImpacto agrupa por produto", () => {
    const resumo = resumoNumerosImpacto(LINHAS);
    expect(resumo.porProduto).toEqual(
      expect.arrayContaining([
        { id: "Estratégia", rotulo: "Estratégia", valor: 3 },
        { id: "Coalizão", rotulo: "Coalizão", valor: 1 },
      ])
    );
  });

  it("resumoNumerosImpacto agrupa por projeto, status e ano", () => {
    const resumo = resumoNumerosImpacto(LINHAS);
    expect(resumo.porProjeto).toEqual(
      expect.arrayContaining([
        { id: "Projeto X", rotulo: "Projeto X", valor: 1 },
        { id: "Projeto Y", rotulo: "Projeto Y", valor: 1 },
        { id: "Sem projeto", rotulo: "Sem projeto", valor: 2 },
      ])
    );
    expect(resumo.porStatus).toEqual(
      expect.arrayContaining([
        { id: "ativo", rotulo: "ativo", valor: 3 },
        { id: "concluido", rotulo: "concluido", valor: 1 },
      ])
    );
    expect(resumo.porAno).toEqual([
      { id: "2025", rotulo: "2025", valor: 2 },
      { id: "2026", rotulo: "2026", valor: 2 },
    ]);
  });

  it("resumoNumerosImpacto calcula percentual sobre o total, com 'Não informado' para null", () => {
    const resumo = resumoNumerosImpacto(LINHAS);
    expect(resumo.percentualGenero).toEqual(
      expect.arrayContaining([
        { id: "feminino", rotulo: "feminino", valor: 50 },
        { id: "masculino", rotulo: "masculino", valor: 25 },
        { id: "Não informado", rotulo: "Não informado", valor: 25 },
      ])
    );
  });
});
