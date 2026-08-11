import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarContratoParaFicha, buscarEtapasDoProduto } from "./contrato";

type Chamada = { tabela: string; metodo: string; args: unknown[] };
type RespostaTabela = { data: unknown; error: { message: string } | null };

// Mock de client com uma resposta canônica por tabela -- buscarContratoParaFicha
// encadeia múltiplas tabelas (fat_contrato, depois dim_mandato OU dim_coalizao),
// então o mock precisa rotear por nome de tabela em vez de uma única resposta
// fixa (diferente do padrão de tabela única de queries/tse.test.ts).
function criarClienteMock(respostas: Record<string, RespostaTabela>) {
  const chamadas: Chamada[] = [];

  function criarBuilder(tabela: string) {
    const resposta = respostas[tabela] ?? { data: null, error: null };
    const builder: Record<string, unknown> = {
      select: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "select", args });
        return builder;
      },
      eq: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "eq", args });
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
        data: { ref_cargo: { nome: "Vereador" }, ref_partido: { sigla: "PT" } },
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
