import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarCarteiraPonderada, buscarCicloEtapa } from "./visao-gerencial";

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
//
// Fix (Verifier, rodada 1 de validation.md): "Gestora sem contrato ativo"
// exige um backbone independente de vw_carteira_ponderada (que só tem linha
// pra contrato ATIVO) -- dim_usuario.papel_global é esse backbone, mesmo
// papel de ref_etapa em buscarCicloEtapa/buscarBoardKanban. Sem ele, uma
// Gestora com zero contratos é omitida do array em vez de aparecer com
// somaPeso: 0 (achado real: o teste antigo "todos os pesos NULL" testava um
// cenário diferente -- 1 contrato com peso NULL, não zero contratos).

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

  // Complementa o Edge Case "Gestora sem contrato ativo": o backbone
  // (dim_usuario) tem que filtrar pelo mesmo papel do corte -- senão uma
  // Gestora sem carteira apareceria também na lista de Mentor (ou vice-versa).
  it("filtra o backbone de dim_usuario por papel_global igual ao filtro.papel", async () => {
    const { client, chamadas } = criarClienteMock({
      dim_usuario: { data: [{ id_usuario: 9, nome: "Mentor X" }], error: null },
      vw_carteira_ponderada: { data: [], error: null },
    });

    await buscarCarteiraPonderada(client, { papel: "mentor" });

    const eqsUsuario = chamadas.filter((c) => c.tabela === "dim_usuario" && c.metodo === "eq").map((c) => c.args);
    expect(eqsUsuario).toContainEqual(["papel_global", "mentor"]);
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

  // Caso relacionado (não é o Edge Case "zero contratos" -- ver teste
  // seguinte): quando o(s) único(s) contrato(s) de uma Gestora têm peso
  // NULL, a soma é 0 (contagem real), nunca NaN.
  it("retorna somaPeso: 0 (não NaN) quando todos os pesos da Gestora são NULL", async () => {
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

  // Edge Case (spec.md, literal): "WHEN uma Gestora não tem nenhum contrato
  // ativo THEN G1 SHALL mostrar 0" -- zero é uma contagem real, a Gestora
  // NUNCA é omitida da lista. dim_usuario.papel_global é o backbone (mesmo
  // papel de ref_etapa em buscarCicloEtapa) -- garante que ela apareça
  // mesmo sem nenhuma linha em vw_carteira_ponderada.
  it("mostra uma Gestora sem nenhum contrato ativo com somaPeso: 0, nunca omitida da lista", async () => {
    const { client } = criarClienteMock({
      dim_usuario: {
        data: [
          { id_usuario: 1, nome: "Gestora Com Carteira" },
          { id_usuario: 2, nome: "Gestora Sem Carteira" },
        ],
        error: null,
      },
      vw_carteira_ponderada: {
        data: [{ id_usuario: 1, nome_usuario: "Gestora Com Carteira", peso: 5, pct_atingimento: null }],
        error: null,
      },
    });

    const resultado = await buscarCarteiraPonderada(client, { papel: "gestora" });

    expect(resultado).toEqual([
      {
        idUsuario: 1,
        nomeUsuario: "Gestora Com Carteira",
        somaPeso: 5,
        qtdContratos: 1,
        qtdContratosSemPeso: 0,
        atingimentoMedio: null,
      },
      {
        idUsuario: 2,
        nomeUsuario: "Gestora Sem Carteira",
        somaPeso: 0,
        qtdContratos: 0,
        qtdContratosSemPeso: 0,
        atingimentoMedio: null,
      },
    ]);
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

// Spec anchor: visao-gerencial-g1-g2 T10 Done-when (.specs/features/visao-gerencial-g1-g2/tasks.md) --
//  - Mediana calculada corretamente sobre 2+ ocorrências concluídas de uma
//    mesma etapa (GG-03 AC1)
//  - Filtro por produto e por Gestora restringe a amostra sem misturar outro
//    produto/Gestora na mesma mediana (GG-04 AC2)
//  - Etapa sem nenhuma ocorrência concluída retorna mediana: null (nunca 0)
//    (GG-03 AC3)
//
// spec.md P1 G2 (AC1-AC3).

const ETAPA_CADASTRO = { id_etapa: 10, nome: "Cadastro", ordem: 1 };
const ETAPA_PONTAPE = { id_etapa: 11, nome: "Pontapé", ordem: 2 };

describe("buscarCicloEtapa", () => {
  // Done-when: "Mediana calculada corretamente sobre 2+ ocorrências
  // concluídas de uma mesma etapa (GG-03 AC1)"
  it("calcula a mediana de dias_ciclo sobre 2 ocorrências concluídas da mesma etapa", async () => {
    const { client } = criarClienteMock({
      ref_etapa: { data: [ETAPA_CADASTRO], error: null },
      vw_ciclo_etapa: {
        data: [
          { id_etapa: 10, dias_ciclo: 4 },
          { id_etapa: 10, dias_ciclo: 10 },
        ],
        error: null,
      },
    });

    const resultado = await buscarCicloEtapa(client);

    expect(resultado).toEqual([{ idEtapa: 10, nomeEtapa: "Cadastro", ordem: 1, mediana: 7, amostra: 2 }]);
  });

  // Done-when: "Etapa sem nenhuma ocorrência concluída retorna mediana: null
  // (nunca 0) (GG-03 AC3)" -- a etapa aparece no resultado (não é omitida),
  // com amostra: 0.
  it("retorna mediana: null e amostra: 0 para etapa sem nenhuma ocorrência concluída, nunca 0", async () => {
    const { client } = criarClienteMock({
      ref_etapa: { data: [ETAPA_CADASTRO, ETAPA_PONTAPE], error: null },
      vw_ciclo_etapa: { data: [{ id_etapa: 10, dias_ciclo: 5 }], error: null },
    });

    const resultado = await buscarCicloEtapa(client);

    const colunaPontape = resultado.find((r) => r.idEtapa === 11)!;
    expect(colunaPontape.mediana).toBeNull();
    expect(colunaPontape.amostra).toBe(0);
  });

  // Done-when: "Filtro por produto e por Gestora restringe a amostra sem
  // misturar outro produto/Gestora na mesma mediana (GG-04 AC2)"
  it("aplica os filtros de produto e Gestora na consulta de vw_ciclo_etapa", async () => {
    const { client, chamadas } = criarClienteMock({
      ref_etapa: { data: [ETAPA_CADASTRO], error: null },
      vw_ciclo_etapa: { data: [{ id_etapa: 10, dias_ciclo: 5 }], error: null },
    });

    await buscarCicloEtapa(client, { idProduto: 7, idGestora: 42 });

    const eqsCiclo = chamadas.filter((c) => c.tabela === "vw_ciclo_etapa" && c.metodo === "eq").map((c) => c.args);
    expect(eqsCiclo).toContainEqual(["id_produto", 7]);
    expect(eqsCiclo).toContainEqual(["id_usuario_gestora", 42]);
    const eqsEtapas = chamadas.filter((c) => c.tabela === "ref_etapa" && c.metodo === "eq").map((c) => c.args);
    expect(eqsEtapas).toContainEqual(["id_produto", 7]);
  });

  // Edge Case (mesma leitura de AC2): amostra de uma etapa não mistura
  // ocorrências de outra etapa na mesma mediana.
  it("não mistura dias_ciclo de outra etapa na mediana da etapa filtrada", async () => {
    const { client } = criarClienteMock({
      ref_etapa: { data: [ETAPA_CADASTRO, ETAPA_PONTAPE], error: null },
      vw_ciclo_etapa: {
        data: [
          { id_etapa: 10, dias_ciclo: 4 },
          { id_etapa: 10, dias_ciclo: 10 },
          { id_etapa: 11, dias_ciclo: 100 },
        ],
        error: null,
      },
    });

    const resultado = await buscarCicloEtapa(client);

    const colunaCadastro = resultado.find((r) => r.idEtapa === 10)!;
    const colunaPontape = resultado.find((r) => r.idEtapa === 11)!;
    expect(colunaCadastro.mediana).toBe(7); // (4+10)/2, não afetado pelo 100 da outra etapa
    expect(colunaCadastro.amostra).toBe(2);
    expect(colunaPontape.mediana).toBe(100);
    expect(colunaPontape.amostra).toBe(1);
  });

  // Done-when implícito (mesmo padrão de buscarBoardKanban): retorna uma
  // linha por ref_etapa, ordenada por ordem.
  it("retorna uma linha por ref_etapa, ordenada por ordem", async () => {
    const { client, chamadas } = criarClienteMock({
      ref_etapa: { data: [ETAPA_CADASTRO, ETAPA_PONTAPE], error: null },
      vw_ciclo_etapa: { data: [], error: null },
    });

    const resultado = await buscarCicloEtapa(client);

    expect(resultado.map((r) => r.ordem)).toEqual([1, 2]);
    const chamadaOrder = chamadas.find((c) => c.tabela === "ref_etapa" && c.metodo === "order");
    expect(chamadaOrder?.args).toEqual(["ordem", { ascending: true }]);
  });

  it("retorna [] sem lançar quando o produto não tem nenhuma etapa", async () => {
    const { client } = criarClienteMock({
      ref_etapa: { data: [], error: null },
    });

    const resultado = await buscarCicloEtapa(client, { idProduto: 999 });
    expect(resultado).toEqual([]);
  });
});
