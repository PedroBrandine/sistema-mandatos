import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import {
  buscarContratoParaFicha,
  buscarContratosAtivosPorProduto,
  buscarEtapasDoProduto,
  buscarPessoasComPapelNoProduto,
  contarContratosEAssessoresAtivos,
} from "./contrato";

type Chamada = { tabela: string; metodo: string; args: unknown[] };
type RespostaTabela = { data: unknown; error: { message: string } | null; count?: number };

// Mock de client com uma resposta canônica por tabela -- buscarContratoParaFicha
// encadeia múltiplas tabelas (fat_contrato, depois dim_mandato OU dim_coalizao),
// então o mock precisa rotear por nome de tabela em vez de uma única resposta
// fixa (diferente do padrão de tabela única de queries/tse.test.ts). Quando
// uma mesma tabela é consultada mais de uma vez na mesma chamada (ex.:
// contarContratosEAssessoresAtivos com filtro consulta rel_usuario_contrato
// duas vezes, com propósitos diferentes), a entrada pode ser uma lista --
// consumida em fila, uma resposta por `.from()` sucessivo.
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
      or: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "or", args });
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

describe("buscarContratoParaFicha", () => {
  // Done-when: "retorna null (não lança) quando id_contrato não existe"
  it("retorna null quando o id_contrato não existe", async () => {
    const { client } = criarClienteMock({ fat_contrato: { data: null, error: null } });
    const resultado = await buscarContratoParaFicha(client, 999999);
    expect(resultado).toBeNull();
  });

  // Done-when: "Ramo tipo_contratante === 'mandato' popula
  // cargoAtual/partidoAtual/sgUf"
  it("contrato de mandato popula cargoAtual, partidoAtual e sgUf", async () => {
    const { client } = criarClienteMock({
      fat_contrato: {
        data: {
          id_contrato: 1,
          id_produto: 2,
          id_contratante: 3,
          ref_produto: { nome: "Estratégia" },
          dim_contratante: { nome: "Fulano", tipo_contratante: "mandato", sg_uf: "SP" },
        },
        error: null,
      },
      dim_mandato: {
        data: { id_mandato: 42, ref_cargo: { nome: "Vereador" }, ref_partido: { sigla: "PT" } },
        error: null,
      },
    });

    const resultado = await buscarContratoParaFicha(client, 1);

    expect(resultado).toMatchObject({
      idContrato: 1,
      idProduto: 2,
      nomeProduto: "Estratégia",
      idContratante: 3,
      nomeContratante: "Fulano",
      tipoContratante: "mandato",
      idMandato: 42,
      cargoAtual: "Vereador",
      partidoAtual: "PT",
      sgUf: "SP",
    });
    expect(resultado?.nomeProjetoOrigem).toBeUndefined();
  });

  // Done-when: "ramo 'coalizao' popula nomeProjetoOrigem"
  it("contrato de coalizão popula nomeProjetoOrigem", async () => {
    const { client } = criarClienteMock({
      fat_contrato: {
        data: {
          id_contrato: 5,
          id_produto: 6,
          id_contratante: 7,
          ref_produto: { nome: "Coalizão" },
          dim_contratante: { nome: "Coalizão X", tipo_contratante: "coalizao", sg_uf: null },
        },
        error: null,
      },
      dim_coalizao: {
        data: { ref_projeto: { nome: "Projeto Origem X" } },
        error: null,
      },
    });

    const resultado = await buscarContratoParaFicha(client, 5);

    expect(resultado).toMatchObject({
      idContrato: 5,
      tipoContratante: "coalizao",
      nomeProjetoOrigem: "Projeto Origem X",
    });
    expect(resultado?.cargoAtual).toBeUndefined();
    expect(resultado?.partidoAtual).toBeUndefined();
  });

  // Done-when: "qualquer outro valor não popula nenhum dos dois (edge case do spec)"
  it("tipo_contratante genérico não popula nenhum dos campos ramificados", async () => {
    const { client } = criarClienteMock({
      fat_contrato: {
        data: {
          id_contrato: 8,
          id_produto: 2,
          id_contratante: 9,
          ref_produto: { nome: "PLL" },
          dim_contratante: { nome: "Outro Tipo", tipo_contratante: "outro", sg_uf: null },
        },
        error: null,
      },
    });

    const resultado = await buscarContratoParaFicha(client, 8);

    expect(resultado).toMatchObject({ idContrato: 8, tipoContratante: "outro", nomeContratante: "Outro Tipo" });
    expect(resultado?.cargoAtual).toBeUndefined();
    expect(resultado?.partidoAtual).toBeUndefined();
    expect(resultado?.sgUf).toBeUndefined();
    expect(resultado?.nomeProjetoOrigem).toBeUndefined();
  });
});

describe("buscarEtapasDoProduto", () => {
  // Done-when: "retorna a lista ordenada por ordem ascendente"
  it("retorna as etapas ordenadas por ordem ascendente", async () => {
    const { client, chamadas } = criarClienteMock({
      ref_etapa: {
        data: [
          { id_etapa: 1, codigo: "diagnostico", nome: "Diagnóstico", ordem: 1 },
          { id_etapa: 2, codigo: "planejamento", nome: "Planejamento", ordem: 2 },
          { id_etapa: 3, codigo: "execucao", nome: "Execução", ordem: 3 },
        ],
        error: null,
      },
    });

    const resultado = await buscarEtapasDoProduto(client, 2);

    expect(resultado.map((e) => e.ordem)).toEqual([1, 2, 3]);
    expect(resultado[0]).toEqual({ idEtapa: 1, codigo: "diagnostico", nome: "Diagnóstico", ordem: 1 });
    const chamadaOrder = chamadas.find((c) => c.tabela === "ref_etapa" && c.metodo === "order");
    expect(chamadaOrder?.args).toEqual(["ordem", { ascending: true }]);
  });

  // Done-when: "retorna [] (não lança) quando o produto não tem etapa cadastrada"
  it("retorna lista vazia quando o produto não tem etapa cadastrada", async () => {
    const { client } = criarClienteMock({ ref_etapa: { data: [], error: null } });
    const resultado = await buscarEtapasDoProduto(client, 999);
    expect(resultado).toEqual([]);
  });
});

describe("buscarContratosAtivosPorProduto", () => {
  // Done-when: "Filtra corretamente por id_produto e status='ativo' (nunca outro status)"
  it("retorna os contratos ativos do produto com o nome do contratante", async () => {
    const { client, chamadas } = criarClienteMock({
      fat_contrato: {
        data: [
          { id_contrato: 10, id_contratante: 1, dt_inicio: "2026-01-01" },
          { id_contrato: 11, id_contratante: 2, dt_inicio: "2026-02-01" },
        ],
        error: null,
      },
      dim_contratante: {
        data: [
          { id_contratante: 1, nome: "Fulano" },
          { id_contratante: 2, nome: "Coalizão X" },
        ],
        error: null,
      },
    });

    const resultado = await buscarContratosAtivosPorProduto(client, 2);

    expect(resultado).toEqual([
      { idContrato: 10, nomeContratante: "Fulano", dtInicio: "2026-01-01" },
      { idContrato: 11, nomeContratante: "Coalizão X", dtInicio: "2026-02-01" },
    ]);

    const eqsContrato = chamadas.filter((c) => c.tabela === "fat_contrato" && c.metodo === "eq").map((c) => c.args);
    expect(eqsContrato).toContainEqual(["id_produto", 2]);
    expect(eqsContrato).toContainEqual(["status", "ativo"]);
  });

  // Done-when: "Retorna [] (não lança) quando não há contrato ativo"
  it("retorna lista vazia quando não há contrato ativo do produto", async () => {
    const { client } = criarClienteMock({ fat_contrato: { data: [], error: null } });
    const resultado = await buscarContratosAtivosPorProduto(client, 2);
    expect(resultado).toEqual([]);
  });
});

describe("contarContratosEAssessoresAtivos", () => {
  // Done-when: "Sem filtro, conta todos os contratos ativos e todos os
  // vínculos de assessor ativos do produto"
  it("sem filtro conta todos os contratos ativos e todos os vínculos de assessor ativos", async () => {
    const { client, chamadas } = criarClienteMock({
      fat_contrato: {
        data: [{ id_contrato: 1 }, { id_contrato: 2 }, { id_contrato: 3 }],
        error: null,
      },
      rel_usuario_contrato: { data: null, count: 5, error: null },
    });

    const resultado = await contarContratosEAssessoresAtivos(client, 2);

    expect(resultado).toEqual({ contratosAtivos: 3, assessoresAtivos: 5 });
    const inAssessores = chamadas.find((c) => c.tabela === "rel_usuario_contrato" && c.metodo === "in");
    expect(inAssessores?.args).toEqual(["id_contrato", [1, 2, 3]]);
    const eqAssessores = chamadas
      .filter((c) => c.tabela === "rel_usuario_contrato" && c.metodo === "eq")
      .map((c) => c.args);
    expect(eqAssessores).toContainEqual(["papel_no_contrato", "assessor"]);
  });

  // Done-when: "Com filtro { papel, idUsuario }, restringe as duas contagens
  // aos contratos onde aquela pessoa tem vínculo ativo naquele papel (AC2 do
  // NAV-11, literal)"
  it("com filtro restringe as duas contagens aos contratos da pessoa naquele papel", async () => {
    const { client } = criarClienteMock({
      fat_contrato: {
        data: [{ id_contrato: 1 }, { id_contrato: 2 }, { id_contrato: 3 }],
        error: null,
      },
      rel_usuario_contrato: [
        { data: [{ id_contrato: 1 }, { id_contrato: 2 }], error: null },
        { data: null, count: 4, error: null },
      ],
    });

    const resultado = await contarContratosEAssessoresAtivos(client, 2, { papel: "gestora", idUsuario: 42 });

    expect(resultado).toEqual({ contratosAtivos: 2, assessoresAtivos: 4 });
  });
});

describe("buscarPessoasComPapelNoProduto", () => {
  it("retorna as pessoas com vínculo ativo naquele papel em algum contrato ativo do produto", async () => {
    const { client } = criarClienteMock({
      fat_contrato: { data: [{ id_contrato: 1 }, { id_contrato: 2 }], error: null },
      rel_usuario_contrato: { data: [{ id_usuario: 10 }, { id_usuario: 11 }, { id_usuario: 10 }], error: null },
      dim_usuario: {
        data: [
          { id_usuario: 10, nome: "Ana" },
          { id_usuario: 11, nome: "Beto" },
        ],
        error: null,
      },
    });

    const resultado = await buscarPessoasComPapelNoProduto(client, 2, "mentor");

    expect(resultado).toEqual([
      { idUsuario: 10, nome: "Ana" },
      { idUsuario: 11, nome: "Beto" },
    ]);
  });

  // Done-when: "buscarPessoasComPapelNoProduto retorna [] quando ninguém tem
  // aquele papel no produto"
  it("retorna lista vazia quando ninguém tem aquele papel no produto", async () => {
    const { client } = criarClienteMock({
      fat_contrato: { data: [{ id_contrato: 1 }, { id_contrato: 2 }], error: null },
      rel_usuario_contrato: { data: [], error: null },
    });

    const resultado = await buscarPessoasComPapelNoProduto(client, 2, "gestora");
    expect(resultado).toEqual([]);
  });
});
