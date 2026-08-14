import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarSaudeCobertura, buscarSaudeFormularios } from "./visao-gerencial";

// Spec anchor: .specs/features/visao-gerencial-g3-g6/spec.md GER-07 +
// tasks.md T9 Done-when.
//  - retorna pctCobertura: null quando zero contratos ativos no recorte (AD-005)
//  - cálculo correto do %, contagem absoluta, etapas concluídas sem registro
//  - evolução mensal populada a partir de vw_cobertura_registro_mensal,
//    agregada em TS (não lida já agregada por mês)
//  - filtro idProduto restringe a evolução mensal (grão fino, T5 corrigida)

type RespostaTabela = { data: unknown; error: { message: string } | null };

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
