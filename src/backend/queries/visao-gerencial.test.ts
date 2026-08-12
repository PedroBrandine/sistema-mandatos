import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarCarteiraPonderada } from "./visao-gerencial";

// Spec anchor: visao-gerencial-g1-g2 T9 Done-when (.specs/features/visao-gerencial-g1-g2/tasks.md) --
//  - Soma pondera corretamente por Gestora/Mentor (GG-05 AC1/AC2)
//  - Atingimento médio ignora NULL (GG-06 AC3)
//  - Gestora sem contrato ativo retorna somaPeso: 0 (Edge Case -- zero é contagem real)
//  - Contrato com peso NULL (lacuna de seed) é excluído da soma e contado em
//    qtdContratosSemPeso, nunca assume peso 1
//  - id_etapa_atual IS NULL já resolvido pela view (T5) -- a função não
//    reintroduz essa lógica
//
// spec.md P1 G1 (AC1-AC4) e Edge Cases ("dois contratos do mesmo Gestora na
// mesma etapa: peso somado uma vez por contrato, não deduplicado";
// "ref_peso_etapa sem linha: peso NULL, nunca assumir peso 1"; "zero é uma
// contagem real, não ausência de dado").

type Chamada = { tabela: string; metodo: string; args: unknown[] };
type RespostaTabela = { data: unknown; error: { message: string } | null };

// Mesmo padrão de kanban.test.ts: mock roteado por nome de tabela, builder
// encadeável (select/eq/order) resolvido via `.then()` -- só os métodos que
// visao-gerencial.ts de fato usa (sem .in/.or/.not/.maybeSingle/auth, que
// kanban.ts usa mas este arquivo não).
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

describe("buscarCarteiraPonderada", () => {
  // Done-when: "Soma pondera corretamente por Gestora/Mentor (GG-05 AC1)"
  it("soma o peso de todos os contratos ativos da mesma Gestora", async () => {
    const { client } = criarClienteMock({
      vw_carteira_ponderada: {
        data: [
          { id_usuario: 1, nome_usuario: "Gestora A", peso: 2, pct_atingimento: null },
          { id_usuario: 1, nome_usuario: "Gestora A", peso: 3, pct_atingimento: null },
        ],
        error: null,
      },
    });

    const resultado = await buscarCarteiraPonderada(client, { papel: "gestora" });

    expect(resultado).toEqual([
      {
        idUsuario: 1,
        nomeUsuario: "Gestora A",
        somaPeso: 5,
        qtdContratos: 2,
        qtdContratosSemPeso: 0,
        atingimentoMedio: null,
      },
    ]);
  });

  // Done-when: "Soma pondera corretamente por Gestora/Mentor (GG-05 AC2)" --
  // corte "por Mentor" filtra papel_no_contrato = 'mentor' e agrupa por Mentor.
  it("filtra por papel_no_contrato = mentor quando o corte é por Mentor", async () => {
    const { client, chamadas } = criarClienteMock({
      vw_carteira_ponderada: {
        data: [{ id_usuario: 9, nome_usuario: "Mentor X", peso: 4, pct_atingimento: null }],
        error: null,
      },
    });

    const resultado = await buscarCarteiraPonderada(client, { papel: "mentor" });

    expect(resultado).toEqual([
      {
        idUsuario: 9,
        nomeUsuario: "Mentor X",
        somaPeso: 4,
        qtdContratos: 1,
        qtdContratosSemPeso: 0,
        atingimentoMedio: null,
      },
    ]);
    const eqsPapel = chamadas
      .filter((c) => c.tabela === "vw_carteira_ponderada" && c.metodo === "eq")
      .map((c) => c.args);
    expect(eqsPapel).toContainEqual(["papel_no_contrato", "mentor"]);
  });

  // Done-when: "Atingimento médio ignora NULL (GG-06 AC3)"
  it("calcula atingimentoMedio ignorando linhas com pct_atingimento NULL", async () => {
    const { client } = criarClienteMock({
      vw_carteira_ponderada: {
        data: [
          { id_usuario: 1, nome_usuario: "Gestora A", peso: 1, pct_atingimento: 80 },
          { id_usuario: 1, nome_usuario: "Gestora A", peso: 1, pct_atingimento: null },
          { id_usuario: 1, nome_usuario: "Gestora A", peso: 1, pct_atingimento: 40 },
        ],
        error: null,
      },
    });

    const resultado = await buscarCarteiraPonderada(client, { papel: "gestora" });

    expect(resultado[0].atingimentoMedio).toBe(60); // (80 + 40) / 2, NULL fora da média
  });

  // Done-when: "Contrato com peso NULL (lacuna de seed) é excluído da soma e
  // contado em qtdContratosSemPeso, nunca assume peso 1"
  it("exclui contrato com peso NULL da soma e conta em qtdContratosSemPeso, sem assumir peso 1", async () => {
    const { client } = criarClienteMock({
      vw_carteira_ponderada: {
        data: [
          { id_usuario: 1, nome_usuario: "Gestora A", peso: 5, pct_atingimento: null },
          { id_usuario: 1, nome_usuario: "Gestora A", peso: null, pct_atingimento: null },
        ],
        error: null,
      },
    });

    const resultado = await buscarCarteiraPonderada(client, { papel: "gestora" });

    expect(resultado[0].somaPeso).toBe(5); // não 6 -- nunca assume peso 1 no lugar do NULL
    expect(resultado[0].qtdContratosSemPeso).toBe(1);
    expect(resultado[0].qtdContratos).toBe(2);
  });

  // Edge Case (spec.md): "zero é uma contagem real, não ausência de dado" --
  // quando todos os contratos de uma Gestora presente no filtro têm peso
  // NULL, a soma é 0 (contagem real), nunca NaN nem uma linha omitida.
  it("retorna somaPeso: 0 (não NaN, não omitida) quando todos os pesos da Gestora são NULL", async () => {
    const { client } = criarClienteMock({
      vw_carteira_ponderada: {
        data: [{ id_usuario: 1, nome_usuario: "Gestora A", peso: null, pct_atingimento: null }],
        error: null,
      },
    });

    const resultado = await buscarCarteiraPonderada(client, { papel: "gestora" });

    expect(resultado).toHaveLength(1);
    expect(resultado[0].somaPeso).toBe(0);
    expect(Number.isNaN(resultado[0].somaPeso)).toBe(false);
  });

  // Edge Case (spec.md): "dois contratos do mesmo Gestora estão na mesma
  // etapa: o peso daquela etapa SHALL ser somado uma vez por contrato (não
  // deduplicado)".
  it("soma o peso uma vez por contrato mesmo quando dois contratos da mesma Gestora estão na mesma etapa", async () => {
    const { client } = criarClienteMock({
      vw_carteira_ponderada: {
        data: [
          { id_usuario: 1, nome_usuario: "Gestora A", peso: 3, pct_atingimento: null },
          { id_usuario: 1, nome_usuario: "Gestora A", peso: 3, pct_atingimento: null },
        ],
        error: null,
      },
    });

    const resultado = await buscarCarteiraPonderada(client, { papel: "gestora" });

    expect(resultado[0].somaPeso).toBe(6); // 3 + 3, não deduplicado para 3
    expect(resultado[0].qtdContratos).toBe(2);
  });

  // Done-when: "id_etapa_atual IS NULL já resolvido pela view (T5) -- teste
  // confirma que a função não reintroduz lógica duplicada". A view já expõe
  // `peso` pronto (COALESCE feito em SQL) -- a função consome o valor
  // diretamente, sem selecionar nem inspecionar id_etapa_atual.
  it("consome peso diretamente da view, sem selecionar id_etapa_atual (já resolvido em SQL)", async () => {
    const { client, chamadas } = criarClienteMock({
      vw_carteira_ponderada: {
        data: [{ id_usuario: 1, nome_usuario: "Gestora A", peso: 1, pct_atingimento: null }],
        error: null,
      },
    });

    await buscarCarteiraPonderada(client, { papel: "gestora" });

    const chamadaSelect = chamadas.find((c) => c.tabela === "vw_carteira_ponderada" && c.metodo === "select");
    const colunasSelecionadas = String(chamadaSelect?.args[0] ?? "");
    expect(colunasSelecionadas).not.toContain("id_etapa_atual");
    expect(colunasSelecionadas).toContain("peso");
  });

  // Edge Case (spec.md): "corte por produto e corte por Gestora/Mentor
  // aplicados juntos SHALL restringir aos dois simultaneamente (AND)".
  it("combina o filtro de produto com o de papel por AND", async () => {
    const { client, chamadas } = criarClienteMock({
      vw_carteira_ponderada: { data: [], error: null },
    });

    await buscarCarteiraPonderada(client, { papel: "gestora", idProduto: 7 });

    const eqs = chamadas.filter((c) => c.tabela === "vw_carteira_ponderada" && c.metodo === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["papel_no_contrato", "gestora"]);
    expect(eqs).toContainEqual(["id_produto", 7]);
  });

  it("retorna [] sem lançar quando nenhuma linha casa o filtro", async () => {
    const { client } = criarClienteMock({
      vw_carteira_ponderada: { data: [], error: null },
    });

    const resultado = await buscarCarteiraPonderada(client, { papel: "gestora" });
    expect(resultado).toEqual([]);
  });
});
