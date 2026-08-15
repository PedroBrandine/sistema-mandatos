import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import {
  buscarAvaliacaoNps,
  buscarDimensoesGipAtivas,
  buscarFormulariosDoContrato,
  buscarGipDoContrato,
  buscarMetricasAtivas,
  buscarSubmissaoPropria,
} from "./formulario";

// Spec anchor: formularios-produto T14 Done-when (.specs/features/formularios-produto/tasks.md) --
//  - 6 funções implementadas com as assinaturas de design.md
//  - buscarFormulariosDoContrato cobre os 2 ramos de filtro por papel
//    (Gestora/Admin vs Mentor/Assessor)
//  - 1 teste por função no mínimo + os 2 ramos de filtro
//
// spec.md FRM-04, FRM-05, FRM-14, FRM-19, FRM-23.

type Chamada = { tabela: string; metodo: string; args: unknown[] };
type RespostaTabela = { data: unknown; error: { message: string; code?: string } | null };

// Mesmo padrão de queries/contrato.test.ts: roteia por nome de tabela (esta
// feature encadeia várias -- rel_formulario_contrato+fat_submissao,
// ref_etapa+ref_formulario+mv_avaliacao_nps). `.is` adicionado (não existe
// no mock de contrato.test.ts) para o ramo `momento IS NULL` de
// buscarSubmissaoPropria.
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
      is: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "is", args });
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

describe("buscarFormulariosDoContrato", () => {
  const linhas = [
    {
      id_abertura: 1,
      id_formulario: 10,
      estado: "aberto",
      ref_formulario: { codigo: "termo_compromisso", nome: "Termo de Compromisso", respondente: "gestora", exige_anexo: true, permite_edicao_aberta: false },
    },
    {
      id_abertura: 2,
      id_formulario: 11,
      estado: "aberto",
      ref_formulario: { codigo: "avaliacao_imersao", nome: "Avaliação da Imersão", respondente: "assessor", exige_anexo: false, permite_edicao_aberta: true },
    },
    {
      id_abertura: 3,
      id_formulario: 12,
      estado: "aberto",
      ref_formulario: { codigo: "organograma", nome: "Organograma", respondente: "mentor", exige_anexo: false, permite_edicao_aberta: true },
    },
    {
      id_abertura: 4,
      id_formulario: 13,
      estado: "fechado",
      ref_formulario: { codigo: "avaliacao_fim_ciclo", nome: "Avaliação Fim de Ciclo", respondente: "mentorado", exige_anexo: false, permite_edicao_aberta: true },
    },
  ];

  // Done-when: "Gestora/Admin veem os 16 formulários do produto + toggle
  // funcional" (T16, consumidor) -- aqui: nenhum filtro aplicado, os 4 da
  // fixture (inclusive fechado/não-respondido) todos retornam.
  it("Gestora/Admin: retorna todos os formulários do contrato, sem filtro por respondente ou estado", async () => {
    const { client } = criarClienteMock({
      rel_formulario_contrato: { data: linhas, error: null },
      fat_submissao: { data: [], error: null },
    });

    const resultado = await buscarFormulariosDoContrato(client, 42, "gestora", 900);

    expect(resultado).toHaveLength(4);
    expect(resultado.map((r) => r.idFormulario)).toEqual([10, 11, 12, 13]);
    expect(resultado.every((r) => r.jaRespondeu === false)).toBe(true);
  });

  // Done-when: "Mentor/Assessor veem só os endereçados ao papel dele
  // (mapeamento fixo, design.md)". Mentor só vê id_formulario=12
  // (respondente='mentor'), e só porque está aberto -- os outros 3
  // (gestora/assessor/mentorado) ficam de fora mesmo os abertos.
  it("Mentor: vê só o formulário endereçado a 'mentor' que está aberto", async () => {
    const { client } = criarClienteMock({
      rel_formulario_contrato: { data: linhas, error: null },
      fat_submissao: { data: [], error: null },
    });

    const resultado = await buscarFormulariosDoContrato(client, 42, "mentor", 901);

    expect(resultado).toHaveLength(1);
    expect(resultado[0].idFormulario).toBe(12);
  });

  // Done-when mesmo ramo, cenário complementar: Assessor vê 'assessor'
  // (mapeamento direto) e 'mentorado' (mapeamento fixo, design.md) --
  // id_formulario=11 está aberto, id_formulario=13 está fechado mas o
  // Assessor já respondeu -- ambos aparecem; 'gestora'/'mentor' ficam de fora.
  it("Assessor: vê 'assessor' (direto) e 'mentorado' (mapeado) -- fechado só aparece se já respondeu", async () => {
    const { client } = criarClienteMock({
      rel_formulario_contrato: { data: linhas, error: null },
      fat_submissao: { data: [{ id_formulario: 13 }], error: null },
    });

    const resultado = await buscarFormulariosDoContrato(client, 42, "assessor", 902);

    expect(resultado).toHaveLength(2);
    expect(resultado.map((r) => r.idFormulario).sort()).toEqual([11, 13]);
    expect(resultado.find((r) => r.idFormulario === 13)?.jaRespondeu).toBe(true);
  });

  // Done-when complementar: fechado + nunca respondido não aparece pro
  // Mentor/Assessor (só é visível se aberto OU já respondido).
  it("Assessor: formulário fechado e nunca respondido não aparece", async () => {
    const { client } = criarClienteMock({
      rel_formulario_contrato: {
        data: [
          {
            id_abertura: 5,
            id_formulario: 14,
            estado: "fechado",
            ref_formulario: { codigo: "avaliacao_parcial_participante", nome: "Avaliação Parcial", respondente: "assessor", exige_anexo: false, permite_edicao_aberta: true },
          },
        ],
        error: null,
      },
      fat_submissao: { data: [], error: null },
    });

    const resultado = await buscarFormulariosDoContrato(client, 42, "assessor", 902);

    expect(resultado).toEqual([]);
  });
});

describe("buscarMetricasAtivas", () => {
  it("mapeia as métricas ativas de ref_metrica_formulario", async () => {
    const { client, chamadas } = criarClienteMock({
      ref_metrica_formulario: {
        data: [{ id_metrica: 5, codigo_campo: "nps_recomendacao", rotulo: "Recomendaria?", tipo: "escala_0_10", eh_nps: true, agrupador: null }],
        error: null,
      },
    });

    const resultado = await buscarMetricasAtivas(client, 11);

    expect(resultado).toEqual([
      { idMetrica: 5, codigoCampo: "nps_recomendacao", rotulo: "Recomendaria?", tipo: "escala_0_10", ehNps: true, agrupador: null },
    ]);
    const chamadaEq = chamadas.filter((c) => c.tabela === "ref_metrica_formulario" && c.metodo === "eq");
    expect(chamadaEq.map((c) => c.args)).toEqual([
      ["id_formulario", 11],
      ["ativo", true],
    ]);
  });
});

describe("buscarSubmissaoPropria", () => {
  // Done-when (design.md): "chave de negócio, nunca por id_submissao
  // adivinhado" -- momento omitido busca a linha com momento IS NULL
  // (formulário fora do GIP).
  it("momento omitido: busca por momento IS NULL e mapeia a submissão", async () => {
    const { client, chamadas } = criarClienteMock({
      fat_submissao: {
        data: {
          id_submissao: 77,
          versao_formulario: 1,
          respostas: { nps_recomendacao: 9 },
          momento: null,
          aceite_em: null,
          enviada_em: "2026-08-01T00:00:00Z",
          atualizada_em: null,
        },
        error: null,
      },
    });

    const resultado = await buscarSubmissaoPropria(client, 42, 11, 900);

    expect(resultado).toEqual({
      idSubmissao: 77,
      versaoFormulario: 1,
      respostas: { nps_recomendacao: 9 },
      momento: null,
      aceiteEm: null,
      enviadaEm: "2026-08-01T00:00:00Z",
      atualizadaEm: null,
    });
    const chamadaIs = chamadas.find((c) => c.metodo === "is");
    expect(chamadaIs?.args).toEqual(["momento", null]);
  });

  it("momento informado (GIP): filtra por eq('momento', ...) em vez de IS NULL", async () => {
    const { client, chamadas } = criarClienteMock({
      fat_submissao: { data: null, error: null },
    });

    const resultado = await buscarSubmissaoPropria(client, 42, 20, 900, "inicio");

    expect(resultado).toBeNull();
    const chamadaEqMomento = chamadas.find((c) => c.metodo === "eq" && c.args[0] === "momento");
    expect(chamadaEqMomento?.args).toEqual(["momento", "inicio"]);
    expect(chamadas.some((c) => c.metodo === "is")).toBe(false);
  });
});

describe("buscarDimensoesGipAtivas", () => {
  it("mapeia as dimensões ativas de ref_dimensao_gip, ordenadas", async () => {
    const { client, chamadas } = criarClienteMock({
      ref_dimensao_gip: {
        data: [{ id_dimensao: 1, codigo: "planejamento", nome: "Planejamento", valor_min: 1, valor_max: 4, ordem: 1 }],
        error: null,
      },
    });

    const resultado = await buscarDimensoesGipAtivas(client);

    expect(resultado).toEqual([{ idDimensao: 1, codigo: "planejamento", nome: "Planejamento", valorMin: 1, valorMax: 4, ordem: 1 }]);
    const chamadaOrder = chamadas.find((c) => c.metodo === "order");
    expect(chamadaOrder?.args).toEqual(["ordem", { ascending: true }]);
  });
});

describe("buscarGipDoContrato", () => {
  it("mapeia vw_gip_evolucao filtrada por id_contrato, com o gap calculado", async () => {
    const { client, chamadas } = criarClienteMock({
      vw_gip_evolucao: {
        data: [
          {
            momento: "meio",
            aplicado_em: "2026-08-01",
            dimensao: "planejamento",
            nome_dimensao: "Planejamento",
            ordem: 1,
            regua_sonhos: 4,
            onde_chegamos: 3,
            gap: -1,
            situacao: "proximo",
            quadrante: "Q1 - Estrutura e entrega",
          },
        ],
        error: null,
      },
    });

    const resultado = await buscarGipDoContrato(client, 42);

    expect(resultado).toEqual([
      {
        momento: "meio",
        aplicadoEm: "2026-08-01",
        dimensao: "planejamento",
        nomeDimensao: "Planejamento",
        ordem: 1,
        reguaSonhos: 4,
        ondeChegamos: 3,
        gap: -1,
        situacao: "proximo",
        quadrante: "Q1 - Estrutura e entrega",
      },
    ]);
    const chamadaEq = chamadas.find((c) => c.tabela === "vw_gip_evolucao" && c.metodo === "eq");
    expect(chamadaEq?.args).toEqual(["id_contrato", 42]);
  });
});

describe("buscarAvaliacaoNps", () => {
  it("resolve os formulários do produto (via ref_etapa) e mapeia mv_avaliacao_nps", async () => {
    const { client } = criarClienteMock({
      ref_etapa: { data: [{ id_etapa: 3 }], error: null },
      ref_formulario: { data: [{ id_formulario: 11 }], error: null },
      mv_avaliacao_nps: {
        data: [
          {
            id_formulario: 11,
            id_projeto_grupo: 24,
            id_metrica: 5,
            rotulo: "Recomendaria?",
            agrupador: null,
            eh_nps: true,
            nr_respostas: 3,
            media: 7.33,
            promotores: 2,
            neutros: 0,
            detratores: 1,
            nps: 33.33,
          },
        ],
        error: null,
      },
    });

    const resultado = await buscarAvaliacaoNps(client, 6);

    expect(resultado).toEqual([
      {
        idFormulario: 11,
        idProjetoGrupo: 24,
        idMetrica: 5,
        rotulo: "Recomendaria?",
        agrupador: null,
        ehNps: true,
        nrRespostas: 3,
        media: 7.33,
        promotores: 2,
        neutros: 0,
        detratores: 1,
        nps: 33.33,
      },
    ]);
  });

  // Done-when / design.md (Components -- buscarAvaliacaoNps): "a função
  // propaga o erro mapeado, não devolve lista vazia, para não confundir
  // 'sem dado' com 'sem permissão'" (FRM-23) -- Mentor/Assessor batendo em
  // mv_avaliacao_nps recebem 42501 (T11); a função NUNCA engole isso num [].
  it("propaga o erro de permissão (42501) em vez de devolver lista vazia (FRM-23)", async () => {
    const { client } = criarClienteMock({
      ref_etapa: { data: [{ id_etapa: 3 }], error: null },
      ref_formulario: { data: [{ id_formulario: 11 }], error: null },
      mv_avaliacao_nps: { data: null, error: { message: "permission denied for materialized view mv_avaliacao_nps", code: "42501" } },
    });

    await expect(buscarAvaliacaoNps(client, 6)).rejects.toEqual({
      message: "permission denied for materialized view mv_avaliacao_nps",
      code: "42501",
    });
  });
});
