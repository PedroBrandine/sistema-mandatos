import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import {
  buscarSaudeCobertura,
  buscarSaudeFormularios,
  buscarCarteiraPonderadaMensal,
  buscarDistribuicaoEtapas,
  buscarAtingimentoPorRecorte,
  buscarCompletudeCadastro,
  buscarIipConsolidado,
  buscarPendencias,
  buscarCicloEtapaMensal,
} from "./visao-gerencial";

// Spec anchor: .specs/features/visao-gerencial-g3-g6/spec.md GER-07 +
// tasks.md T9 Done-when.
//  - retorna pctCobertura: null quando zero contratos ativos no recorte (AD-005)
//  - cálculo correto do %, contagem absoluta, etapas concluídas sem registro
//  - evolução mensal populada a partir de vw_cobertura_registro_mensal,
//    agregada em TS (não lida já agregada por mês)
//  - filtro idProduto restringe a evolução mensal (grão fino, T5 corrigida)

type RespostaTabela = { data: unknown; error: { message: string } | null; count?: number };

// Mock roteado por nome de tabela, builder encadeável (select/eq/is/in)
// resolvido via `.then()` -- mesmo padrão de visao-gerencial.test.ts,
// estendido com .is()/.in() (usados por resolverIdsContratoDoRecorte,
// função interna não exportada, exercida indiretamente aqui).
function criarClienteMock(respostasPorTabela: Record<string, RespostaTabela>) {
  function criarBuilder(tabela: string) {
    const resposta = respostasPorTabela[tabela] ?? { data: [], error: null };
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      is: () => builder,
      in: () => builder,
      order: () => builder,
      range: () => builder,
      then: (resolve: (valor: RespostaTabela) => void, reject: (erro: unknown) => void) =>
        Promise.resolve(resposta).then(resolve, reject),
    };
    return builder;
  }

  const client = {
    from: (tabela: string) => criarBuilder(tabela),
  };
  return client as unknown as SupabaseClient<Database>;
}

describe("buscarSaudeCobertura", () => {
  it("calcula pctCobertura, qtdSemRegistro e evolução mensal a partir do dado bruto", async () => {
    const client = criarClienteMock({
      fat_contrato: { data: [{ id_contrato: 1 }, { id_contrato: 2 }, { id_contrato: 3 }, { id_contrato: 4 }], error: null },
      vw_pendencias: { data: [{ id_contrato: 3 }], error: null }, // 1 de 4 sem registro
      vw_etapa_contrato: { data: [], error: null },
      vw_cobertura_registro_mensal: {
        data: [
          { mes_referencia: "2026-06-01", id_contrato: 1, id_produto: 10, tem_registro: true },
          { mes_referencia: "2026-06-01", id_contrato: 2, id_produto: 10, tem_registro: false },
          { mes_referencia: "2026-07-01", id_contrato: 1, id_produto: 10, tem_registro: true },
        ],
        error: null,
      },
    });

    const resultado = await buscarSaudeCobertura(client, {});

    // 4 ativos, 1 sem registro -> 3/4 = 75%
    expect(resultado.pctCobertura).toBe(75);
    expect(resultado.qtdSemRegistro).toBe(1);
    expect(resultado.qtdEtapasSemRegistro).toBe(0);
    expect(resultado.evolucaoMensal).toEqual([
      { mes: "2026-06-01", pct: 50 }, // 1 de 2 com registro
      { mes: "2026-07-01", pct: 100 }, // 1 de 1 com registro
    ]);
  });

  it("zero contratos ativos no recorte -> pctCobertura null, nunca 0 (AD-005)", async () => {
    const client = criarClienteMock({
      fat_contrato: { data: [], error: null },
      vw_pendencias: { data: [], error: null },
      vw_etapa_contrato: { data: [], error: null },
      vw_cobertura_registro_mensal: { data: [], error: null },
    });

    const resultado = await buscarSaudeCobertura(client, {});

    expect(resultado.pctCobertura).toBeNull();
    expect(resultado.evolucaoMensal).toEqual([]);
  });

  it("etapa concluída sem nenhum fat_registro dentro do período conta em qtdEtapasSemRegistro", async () => {
    const client = criarClienteMock({
      fat_contrato: { data: [{ id_contrato: 1 }], error: null },
      vw_pendencias: { data: [], error: null },
      vw_etapa_contrato: {
        data: [
          { id_contrato: 1, dt_inicio: "2026-01-01", dt_conclusao: "2026-01-10" }, // sem registro no período
          { id_contrato: 1, dt_inicio: "2026-02-01", dt_conclusao: "2026-02-10" }, // com registro no período
        ],
        error: null,
      },
      fat_registro: {
        data: [{ id_contrato: 1, ocorrido_em: "2026-02-05" }],
        error: null,
      },
      vw_cobertura_registro_mensal: { data: [], error: null },
    });

    const resultado = await buscarSaudeCobertura(client, {});

    expect(resultado.qtdEtapasSemRegistro).toBe(1);
  });

  it("filtro idProduto restringe a evolução mensal ao produto do recorte", async () => {
    const client = criarClienteMock({
      fat_contrato: { data: [{ id_contrato: 1 }], error: null },
      vw_pendencias: { data: [], error: null },
      vw_etapa_contrato: { data: [], error: null },
      vw_cobertura_registro_mensal: {
        data: [
          { mes_referencia: "2026-06-01", id_contrato: 1, id_produto: 10, tem_registro: true },
          { mes_referencia: "2026-06-01", id_contrato: 2, id_produto: 20, tem_registro: false },
        ],
        error: null,
      },
    });

    const resultado = await buscarSaudeCobertura(client, { idProduto: 10 });

    expect(resultado.evolucaoMensal).toEqual([{ mes: "2026-06-01", pct: 100 }]);
  });
});

// Spec anchor: .specs/features/visao-gerencial-g3-g6/spec.md GER-08 +
// tasks.md T10 Done-when.
describe("buscarSaudeFormularios", () => {
  it("ordena por taxa de resposta decrescente e conta abertos > 30 dias só via vw_pendencias", async () => {
    const client = criarClienteMock({
      vw_resposta_formulario: {
        data: [
          { id_formulario: 1, nome_formulario: "Diagnóstico", respondido: true },
          { id_formulario: 1, nome_formulario: "Diagnóstico", respondido: false },
          { id_formulario: 2, nome_formulario: "Encerramento", respondido: true },
        ],
        error: null,
      },
      vw_pendencias: { data: [{ id_contrato: 5 }, { id_contrato: 6 }], error: null },
      vw_resposta_formulario_mensal: { data: [], error: null },
    });

    const resultado = await buscarSaudeFormularios(client, {});

    expect(resultado.porFormulario).toEqual([
      { idFormulario: 2, nomeFormulario: "Encerramento", taxaResposta: 100 },
      { idFormulario: 1, nomeFormulario: "Diagnóstico", taxaResposta: 50 },
    ]);
    expect(resultado.qtdAbertosMais30Dias).toBe(2);
  });

  it("evolução mensal agregada a partir do grão fino, filtrada por idProduto quando presente", async () => {
    const client = criarClienteMock({
      vw_resposta_formulario: { data: [], error: null },
      vw_pendencias: { data: [], error: null },
      vw_resposta_formulario_mensal: {
        data: [
          { mes_referencia: "2026-05-01", id_contrato: 1, id_produto: 10, tem_resposta: true },
          { mes_referencia: "2026-05-01", id_contrato: 2, id_produto: 20, tem_resposta: false },
        ],
        error: null,
      },
    });

    const resultado = await buscarSaudeFormularios(client, { idProduto: 10 });

    expect(resultado.evolucaoMensal).toEqual([{ mes: "2026-05-01", taxaMedia: 100 }]);
  });

  it("nenhuma abertura -> porFormulario e evolucaoMensal vazios, sem erro", async () => {
    const client = criarClienteMock({
      vw_resposta_formulario: { data: [], error: null },
      vw_pendencias: { data: [], error: null },
      vw_resposta_formulario_mensal: { data: [], error: null },
    });

    const resultado = await buscarSaudeFormularios(client, {});

    expect(resultado.porFormulario).toEqual([]);
    expect(resultado.qtdAbertosMais30Dias).toBe(0);
    expect(resultado.evolucaoMensal).toEqual([]);
  });
});

// Spec anchor: .specs/features/visao-gerencial-g3-g6/spec.md GER-12 +
// tasks.md T12 Done-when.
describe("buscarCarteiraPonderadaMensal", () => {
  it("agrega peso por Gestora e por mês, ignorando peso NULL (lacuna de seed)", async () => {
    const client = criarClienteMock({
      vw_carteira_ponderada_mensal: {
        data: [
          { mes_referencia: "2026-06-01", id_usuario_gestora: 1, nome_gestora: "Gestora A", id_produto: 10, id_contrato: 100, peso: 2 },
          { mes_referencia: "2026-06-01", id_usuario_gestora: 1, nome_gestora: "Gestora A", id_produto: 10, id_contrato: 101, peso: 3 },
          { mes_referencia: "2026-06-01", id_usuario_gestora: 1, nome_gestora: "Gestora A", id_produto: 10, id_contrato: 102, peso: null },
          { mes_referencia: "2026-07-01", id_usuario_gestora: 1, nome_gestora: "Gestora A", id_produto: 10, id_contrato: 100, peso: 4 },
        ],
        error: null,
      },
    });

    const resultado = await buscarCarteiraPonderadaMensal(client, {});

    expect(resultado).toEqual([
      {
        idUsuarioGestora: 1,
        nomeGestora: "Gestora A",
        pontos: [
          { mes: "2026-06-01", somaPeso: 5 },
          { mes: "2026-07-01", somaPeso: 4 },
        ],
      },
    ]);
  });

  it("mais de 8 Gestoras -> excedente agrupado em série 'Outras', nunca 9+ séries nomeadas", async () => {
    const linhas = Array.from({ length: 10 }, (_, i) => ({
      mes_referencia: "2026-06-01",
      id_usuario_gestora: i + 1,
      nome_gestora: `Gestora ${i + 1}`,
      id_produto: 10,
      id_contrato: 100 + i,
      // pesos decrescentes -- garante ordem determinística de ranking
      peso: 10 - i,
    }));
    const client = criarClienteMock({
      vw_carteira_ponderada_mensal: { data: linhas, error: null },
    });

    const resultado = await buscarCarteiraPonderadaMensal(client, {});

    expect(resultado).toHaveLength(9); // 8 principais + "Outras"
    expect(resultado[8].idUsuarioGestora).toBeNull();
    expect(resultado[8].nomeGestora).toBe("Outras");
    // Outras = soma das 2 gestoras excedentes (peso 2 + peso 1, as 2 últimas do ranking)
    expect(resultado[8].pontos).toEqual([{ mes: "2026-06-01", somaPeso: 3 }]);
  });

  it("sem nenhuma linha -> array vazio, sem lançar", async () => {
    const client = criarClienteMock({
      vw_carteira_ponderada_mensal: { data: [], error: null },
    });

    expect(await buscarCarteiraPonderadaMensal(client, {})).toEqual([]);
  });
});

// Spec anchor: .specs/features/visao-gerencial-g3-g6/spec.md GER-10 +
// tasks.md T13 Done-when.
describe("buscarDistribuicaoEtapas", () => {
  it("etapa sem nenhum contrato aparece com qtdAtiva: 0, nunca omitida; ordenação por ref_etapa.ordem", async () => {
    const client = criarClienteMock({
      ref_etapa: {
        data: [
          { id_etapa: 10, nome: "Cadastro", ordem: 1 },
          { id_etapa: 11, nome: "Pontapé", ordem: 2 },
        ],
        error: null,
      },
      fat_contrato: { data: [{ id_contrato: 100 }], error: null },
      vw_etapa_contrato: {
        data: [{ id_etapa: 10, id_contrato: 100, esta_atrasada: false }],
        error: null,
      },
    });

    const resultado = await buscarDistribuicaoEtapas(client, {});

    expect(resultado).toEqual([
      { idEtapa: 10, nomeEtapa: "Cadastro", ordem: 1, qtdAtiva: 1, qtdAtrasada: 0 },
      { idEtapa: 11, nomeEtapa: "Pontapé", ordem: 2, qtdAtiva: 0, qtdAtrasada: 0 },
    ]);
  });

  it("conta atrasados dentro da contagem ativa (esta_atrasada = true)", async () => {
    const client = criarClienteMock({
      ref_etapa: { data: [{ id_etapa: 10, nome: "Cadastro", ordem: 1 }], error: null },
      fat_contrato: { data: [{ id_contrato: 100 }, { id_contrato: 101 }], error: null },
      vw_etapa_contrato: {
        data: [
          { id_etapa: 10, id_contrato: 100, esta_atrasada: true },
          { id_etapa: 10, id_contrato: 101, esta_atrasada: false },
        ],
        error: null,
      },
    });

    const resultado = await buscarDistribuicaoEtapas(client, {});

    expect(resultado).toEqual([{ idEtapa: 10, nomeEtapa: "Cadastro", ordem: 1, qtdAtiva: 2, qtdAtrasada: 1 }]);
  });

  it("etapa em_andamento de contrato não-ativo (fat_contrato.status != 'ativo') não conta", async () => {
    const client = criarClienteMock({
      ref_etapa: { data: [{ id_etapa: 10, nome: "Cadastro", ordem: 1 }], error: null },
      fat_contrato: { data: [{ id_contrato: 100 }], error: null }, // só 100 está 'ativo'
      vw_etapa_contrato: {
        data: [
          { id_etapa: 10, id_contrato: 100, esta_atrasada: false },
          { id_etapa: 10, id_contrato: 999, esta_atrasada: false }, // não está em fat_contrato 'ativo'
        ],
        error: null,
      },
    });

    const resultado = await buscarDistribuicaoEtapas(client, {});

    expect(resultado).toEqual([{ idEtapa: 10, nomeEtapa: "Cadastro", ordem: 1, qtdAtiva: 1, qtdAtrasada: 0 }]);
  });

  it("produto sem nenhuma etapa cadastrada -> array vazio", async () => {
    const client = criarClienteMock({
      ref_etapa: { data: [], error: null },
    });

    expect(await buscarDistribuicaoEtapas(client, { idProduto: 99 })).toEqual([]);
  });
});

// Spec anchor: .specs/features/visao-gerencial-g3-g6/spec.md GER-14/GER-16 +
// tasks.md T14 Done-when.
describe("buscarAtingimentoPorRecorte", () => {
  it("calcula pctMedio por produto e por projeto, ignorando NULL", async () => {
    const client = criarClienteMock({
      vw_carteira: {
        data: [
          { id_contrato: 1, nome_produto: "Estratégia", nome_projeto: "Imagina", pct_atingimento: 80, atingimento_desatualizado: false },
          { id_contrato: 2, nome_produto: "Estratégia", nome_projeto: "Imagina", pct_atingimento: 60, atingimento_desatualizado: false },
          { id_contrato: 3, nome_produto: "Estratégia", nome_projeto: null, pct_atingimento: null, atingimento_desatualizado: false },
        ],
        error: null,
      },
      dim_planejamento: { data: [], error: null },
    });

    const resultado = await buscarAtingimentoPorRecorte(client, {});

    expect(resultado.porProduto).toEqual([{ nome: "Estratégia", pctMedio: 70 }]);
    expect(resultado.porProjeto).toEqual([{ nome: "Imagina", pctMedio: 70 }]);
  });

  it("qtdDesatualizados conta separado do agregado (spec.md: agregado não pode fingir estar fresco)", async () => {
    const client = criarClienteMock({
      vw_carteira: {
        data: [
          { id_contrato: 1, nome_produto: "PLL", nome_projeto: null, pct_atingimento: 90, atingimento_desatualizado: true },
          { id_contrato: 2, nome_produto: "PLL", nome_projeto: null, pct_atingimento: 50, atingimento_desatualizado: false },
        ],
        error: null,
      },
      dim_planejamento: { data: [], error: null },
    });

    const resultado = await buscarAtingimentoPorRecorte(client, {});

    expect(resultado.qtdDesatualizados).toBe(1);
    expect(resultado.porProduto).toEqual([{ nome: "PLL", pctMedio: 70 }]);
  });

  it("conta SM pendente do mês corrente via a cadeia dim_planejamento -> objetivo -> meta -> sucesso", async () => {
    const client = criarClienteMock({
      vw_carteira: { data: [], error: null },
      dim_planejamento: { data: [{ id_planejamento: 1 }], error: null },
      fat_objetivo_especifico: { data: [{ id_objetivo: 10 }], error: null },
      fat_meta: { data: [{ id_meta: 100 }], error: null },
      fat_sucesso_mensal: { data: [{ id_sucesso: 1000 }, { id_sucesso: 1001 }], error: null },
    });

    const resultado = await buscarAtingimentoPorRecorte(client, {});

    expect(resultado.qtdSmNaoAtualizadosMesCorrente).toBe(2);
  });

  it("sem nenhum planejamento no recorte -> qtdSmNaoAtualizadosMesCorrente = 0, sem consultar a cadeia inteira", async () => {
    const client = criarClienteMock({
      vw_carteira: { data: [], error: null },
      dim_planejamento: { data: [], error: null },
    });

    const resultado = await buscarAtingimentoPorRecorte(client, {});

    expect(resultado.qtdSmNaoAtualizadosMesCorrente).toBe(0);
  });
});

// Spec anchor: .specs/features/visao-gerencial-g3-g6/spec.md GER-17 +
// tasks.md T15 Done-when.
describe("buscarCompletudeCadastro", () => {
  it("os 5 campos sempre aparecem, mesmo com contagem 0 (AD-005)", async () => {
    const client = criarClienteMock({
      vw_pendencias: {
        data: [{ detalhe: "ds_genero" }, { detalhe: "ds_genero" }, { detalhe: "fl_pcd" }],
        error: null,
      },
    });

    const resultado = await buscarCompletudeCadastro(client, {});

    expect(resultado).toEqual([
      { campo: "ds_genero", qtdContratos: 2 },
      { campo: "ds_raca", qtdContratos: 0 },
      { campo: "fl_pcd", qtdContratos: 1 },
      { campo: "confianca", qtdContratos: 0 },
      { campo: "titulo_eleitoral", qtdContratos: 0 },
    ]);
  });

  it("sem nenhuma pendência de cadastro -> todos os campos com 0, sem lançar", async () => {
    const client = criarClienteMock({ vw_pendencias: { data: [], error: null } });

    const resultado = await buscarCompletudeCadastro(client, {});

    expect(resultado.every((r) => r.qtdContratos === 0)).toBe(true);
    expect(resultado).toHaveLength(5);
  });
});

// Spec anchor: .specs/features/visao-gerencial-g3-g6/spec.md GER-18 +
// tasks.md T16 Done-when.
describe("buscarIipConsolidado", () => {
  const NIVEIS = {
    data: [
      { codigo: "baixo", rotulo: "Baixo", valor: 0, ordem: 1 },
      { codigo: "medio", rotulo: "Médio", valor: 30, ordem: 2 },
      { codigo: "alto", rotulo: "Alto", valor: 60, ordem: 3 },
      { codigo: "critico", rotulo: "Crítico", valor: 85, ordem: 4 },
    ],
    error: null,
  };

  it("bucketiza cada contrato no maior nível cujo valor <= iip_provisorio; todos os níveis sempre aparecem", async () => {
    const client = criarClienteMock({
      ref_nivel_iip: NIVEIS,
      mv_iip_contrato: {
        data: [
          { id_contrato: 1, iip_provisorio: 50, dt_ultimo_fato: "2026-06-01" }, // Médio (30<=50<60)
          { id_contrato: 2, iip_provisorio: 90, dt_ultimo_fato: "2026-07-01" }, // Crítico
        ],
        error: null,
      },
    });

    const resultado = await buscarIipConsolidado(client, {});

    expect(resultado.distribuicaoPorNivel).toEqual([
      { nivel: "Baixo", qtdContratos: 0 },
      { nivel: "Médio", qtdContratos: 1 },
      { nivel: "Alto", qtdContratos: 0 },
      { nivel: "Crítico", qtdContratos: 1 },
    ]);
  });

  it("valorMedio é a média dos iip_provisorio não-nulos; dtDadoMaisRecente é o maior dt_ultimo_fato", async () => {
    const client = criarClienteMock({
      ref_nivel_iip: NIVEIS,
      mv_iip_contrato: {
        data: [
          { id_contrato: 1, iip_provisorio: 40, dt_ultimo_fato: "2026-06-01" },
          { id_contrato: 2, iip_provisorio: 60, dt_ultimo_fato: "2026-08-01" },
        ],
        error: null,
      },
    });

    const resultado = await buscarIipConsolidado(client, {});

    expect(resultado.valorMedio).toBe(50);
    expect(resultado.dtDadoMaisRecente).toBe("2026-08-01");
  });

  it("zero contratos com IIP no recorte -> valorMedio null, nunca 0 (AD-005)", async () => {
    const client = criarClienteMock({
      ref_nivel_iip: NIVEIS,
      mv_iip_contrato: { data: [], error: null },
    });

    const resultado = await buscarIipConsolidado(client, {});

    expect(resultado.valorMedio).toBeNull();
    expect(resultado.dtDadoMaisRecente).toBeNull();
    expect(resultado.distribuicaoPorNivel.every((n) => n.qtdContratos === 0)).toBe(true);
  });
});

// Spec anchor: .specs/features/visao-gerencial-g3-g6/spec.md GER-19 +
// tasks.md T17 Done-when.
describe("buscarPendencias", () => {
  it("mapeia as 6 categorias sem inventar nenhuma, ordenadas por dias_em_aberto decrescente, e devolve o total real (não só a página)", async () => {
    const client = criarClienteMock({
      vw_pendencias: {
        data: [
          { id_contrato: 1, nome_contratante: "Mandato A", categoria: "etapa_atrasada", detalhe: "pontape", dt_referencia: "2026-05-01", dias_em_aberto: 30, id_usuario_gestora: 5, nome_gestora: "Gestora X" },
          { id_contrato: 2, nome_contratante: "Mandato B", categoria: "sem_registro_recente", detalhe: null, dt_referencia: "2026-04-01", dias_em_aberto: 60, id_usuario_gestora: null, nome_gestora: null },
        ],
        error: null,
        count: 137,
      },
    });

    const resultado = await buscarPendencias(client, {});

    expect(resultado.total).toBe(137);
    expect(resultado.linhas).toEqual([
      {
        idContrato: 1,
        nomeContratante: "Mandato A",
        categoria: "etapa_atrasada",
        detalhe: "pontape",
        dtReferencia: "2026-05-01",
        diasEmAberto: 30,
        idUsuarioGestora: 5,
        nomeGestora: "Gestora X",
      },
      {
        idContrato: 2,
        nomeContratante: "Mandato B",
        categoria: "sem_registro_recente",
        detalhe: null,
        dtReferencia: "2026-04-01",
        diasEmAberto: 60,
        idUsuarioGestora: null,
        nomeGestora: null,
      },
    ]);
  });

  it("pagina via .range() -- nunca traz a tabela inteira de uma vez", async () => {
    const client = criarClienteMock({
      vw_pendencias: { data: [], error: null, count: 0 },
    });
    // Assert indireto: a chamada não lança e não exige nenhum dado além do
    // que o mock devolve pra 1 página -- prova que a função não faz uma
    // segunda consulta sem `.range()` pra "trazer tudo".
    const resultado = await buscarPendencias(client, {}, 2, 10);
    expect(resultado.linhas).toEqual([]);
    expect(resultado.total).toBe(0);
  });

  it("recorte sem nenhuma pendência -> linhas vazias, total 0, sem lançar", async () => {
    const client = criarClienteMock({
      vw_pendencias: { data: [], error: null, count: 0 },
    });

    const resultado = await buscarPendencias(client, {});

    expect(resultado.linhas).toEqual([]);
    expect(resultado.total).toBe(0);
  });
});

// Spec anchor: .specs/features/visao-gerencial-g3-g6/spec.md GER-13 +
// tasks.md T23 (adendo: buscarCicloEtapaMensal, lacuna real achada durante
// T23 -- G2 evolução mensal nunca tinha função de query própria).
describe("buscarCicloEtapaMensal", () => {
  it("etapa sem nenhum ciclo concluído aparece com pontos: [] (backbone ref_etapa), nunca omitida", async () => {
    const client = criarClienteMock({
      ref_etapa: {
        data: [
          { id_etapa: 10, nome: "Cadastro", ordem: 1 },
          { id_etapa: 11, nome: "Pontapé", ordem: 2 },
        ],
        error: null,
      },
      vw_ciclo_etapa: {
        data: [{ id_etapa: 10, dias_ciclo: 5, dt_conclusao: "2026-06-15", id_contrato: 1, id_produto: 10 }],
        error: null,
      },
    });

    const resultado = await buscarCicloEtapaMensal(client, {});

    expect(resultado).toHaveLength(2);
    expect(resultado[0].pontos).toEqual([{ mes: "2026-06-01", mediana: 5, amostra: 1 }]);
    expect(resultado[1].idEtapa).toBe(11);
    expect(resultado[1].pontos).toEqual([]);
  });

  it("bucketiza pelo mês de dt_conclusao (não pelo mês corrente) e calcula mediana por mês", async () => {
    const client = criarClienteMock({
      ref_etapa: { data: [{ id_etapa: 10, nome: "Cadastro", ordem: 1 }], error: null },
      vw_ciclo_etapa: {
        data: [
          { id_etapa: 10, dias_ciclo: 4, dt_conclusao: "2026-05-03", id_contrato: 1, id_produto: 10 },
          { id_etapa: 10, dias_ciclo: 8, dt_conclusao: "2026-05-20", id_contrato: 2, id_produto: 10 },
          { id_etapa: 10, dias_ciclo: 10, dt_conclusao: "2026-06-01", id_contrato: 3, id_produto: 10 },
        ],
        error: null,
      },
    });

    const resultado = await buscarCicloEtapaMensal(client, {});

    expect(resultado[0].pontos).toEqual([
      { mes: "2026-05-01", mediana: 6, amostra: 2 },
      { mes: "2026-06-01", mediana: 10, amostra: 1 },
    ]);
  });

  it("produto sem nenhuma etapa cadastrada -> array vazio", async () => {
    const client = criarClienteMock({ ref_etapa: { data: [], error: null } });
    expect(await buscarCicloEtapaMensal(client, { idProduto: 99 })).toEqual([]);
  });
});
