import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { LinhaCadastroPll } from "../schemas/cadastro-participante-pll";
import type { Database } from "../supabase/database.types";
import { buscarCadastroParticipantesPll, buscarMetricasCadastroPll, upsertCadastroParticipantes } from "./pll-cadastro";

// Spec anchor: .specs/features/pll-cadastro-participantes/tasks.md T5 "Done when":
//  - Linha nova insere; linha com e-mail já existente no projeto atualiza (nunca duplica)
//  - Reimportação NUNCA limpa id_contrato/id_vinculo_tse já preenchidos (edge case da spec)
// Test Coverage Matrix (AD-042): happy + erro (RLS nega, duplicidade) + AD-005.
//
// Mock roteado por método (select-chain vs. upsert), mesmo racional de
// queries/prospeccao.test.ts (mock por nome de tabela) -- aqui as duas
// operações batem na MESMA tabela, então o mock diferencia por método.

interface RespostaLista {
  data: { email: string }[] | null;
  error: { message: string; code?: string } | null;
}
interface RespostaEscrita {
  error: { message: string; code?: string } | null;
}

function criarClienteMock(opts: { existentes: RespostaLista; upsert?: RespostaEscrita }) {
  const chamadas: { metodo: string; args: unknown[] }[] = [];
  let upsertPayload: unknown = null;

  const client = {
    from: (tabela: string) => {
      chamadas.push({ metodo: "from", args: [tabela] });
      return {
        select: (...args: unknown[]) => {
          chamadas.push({ metodo: "select", args });
          const builder = {
            eq: (...args2: unknown[]) => {
              chamadas.push({ metodo: "eq", args: args2 });
              return builder;
            },
            in: (...args2: unknown[]) => {
              chamadas.push({ metodo: "in", args: args2 });
              return Promise.resolve(opts.existentes);
            },
          };
          return builder;
        },
        upsert: (payload: unknown, options: unknown) => {
          upsertPayload = payload;
          chamadas.push({ metodo: "upsert", args: [payload, options] });
          return Promise.resolve(opts.upsert ?? { error: null });
        },
      };
    },
  };

  return {
    client: client as unknown as SupabaseClient<Database>,
    chamadas,
    getUpsertPayload: () => upsertPayload as Record<string, unknown>[] | null,
  };
}

function linha(email: string): LinhaCadastroPll {
  return { papel: "mentorado", nome_completo: "Fulana de Tal", email } as LinhaCadastroPll;
}

describe("upsertCadastroParticipantes", () => {
  it("lote vazio retorna {inseridos: 0, atualizados: 0} sem chamar o banco", async () => {
    const { client, chamadas } = criarClienteMock({ existentes: { data: [], error: null } });
    const resultado = await upsertCadastroParticipantes(client, { idProduto: 1, idProjeto: 10, linhas: [] });
    expect(resultado).toEqual({ inseridos: 0, atualizados: 0 });
    expect(chamadas).toEqual([]);
  });

  // Done-when: "Linha nova insere"
  it("nenhum e-mail existente no projeto: todas as linhas contam como inseridas", async () => {
    const { client } = criarClienteMock({ existentes: { data: [], error: null } });
    const resultado = await upsertCadastroParticipantes(client, {
      idProduto: 1,
      idProjeto: 10,
      linhas: [linha("a@teste.com"), linha("b@teste.com")],
    });
    expect(resultado).toEqual({ inseridos: 2, atualizados: 0 });
  });

  // Done-when: "linha com e-mail já existente no projeto atualiza (nunca duplica)"
  it("e-mail já existente no projeto conta como atualizado, não inserido", async () => {
    const { client } = criarClienteMock({
      existentes: { data: [{ email: "a@teste.com" }], error: null },
    });
    const resultado = await upsertCadastroParticipantes(client, {
      idProduto: 1,
      idProjeto: 10,
      linhas: [linha("a@teste.com"), linha("b@teste.com")],
    });
    expect(resultado).toEqual({ inseridos: 1, atualizados: 1 });
  });

  it("upsert usa onConflict 'id_projeto,email' (sustenta o upsert por edição, PLL-CP-03)", async () => {
    const { client, chamadas } = criarClienteMock({ existentes: { data: [], error: null } });
    await upsertCadastroParticipantes(client, { idProduto: 1, idProjeto: 10, linhas: [linha("a@teste.com")] });
    const chamadaUpsert = chamadas.find((c) => c.metodo === "upsert");
    expect(chamadaUpsert?.args[1]).toEqual({ onConflict: "id_projeto,email" });
  });

  it("payload envia id_produto/id_projeto/importado_por junto de cada linha", async () => {
    const { client, getUpsertPayload } = criarClienteMock({ existentes: { data: [], error: null } });
    await upsertCadastroParticipantes(client, {
      idProduto: 3,
      idProjeto: 10,
      idUsuarioImportador: 42,
      linhas: [linha("a@teste.com")],
    });
    const payload = getUpsertPayload();
    expect(payload).toHaveLength(1);
    expect(payload?.[0]).toMatchObject({ id_produto: 3, id_projeto: 10, importado_por: 42, email: "a@teste.com" });
  });

  it("idUsuarioImportador ausente vira importado_por: null", async () => {
    const { client, getUpsertPayload } = criarClienteMock({ existentes: { data: [], error: null } });
    await upsertCadastroParticipantes(client, { idProduto: 3, idProjeto: 10, linhas: [linha("a@teste.com")] });
    expect(getUpsertPayload()?.[0].importado_por).toBeNull();
  });

  // Edge case da spec.md: "reimportação nunca desfaz um vínculo confirmado" --
  // id_contrato/id_vinculo_tse (e os campos editáveis no sistema) nunca
  // entram no payload, então o PostgREST não os inclui no SET do ON CONFLICT.
  it("o payload do upsert NUNCA inclui id_contrato/id_vinculo_tse nem os campos editáveis no sistema", async () => {
    const { client, getUpsertPayload } = criarClienteMock({ existentes: { data: [], error: null } });
    await upsertCadastroParticipantes(client, { idProduto: 1, idProjeto: 10, linhas: [linha("a@teste.com")] });
    const linhaPayload = getUpsertPayload()?.[0] ?? {};
    for (const campo of [
      "id_contrato",
      "id_vinculo_tse",
      "desafios",
      "destaques",
      "ambicao_texto",
      "ambicao_tags",
      "swot_forcas",
      "swot_fraquezas",
      "swot_oportunidades",
      "swot_ameacas",
      "status_cadastro",
    ]) {
      expect(linhaPayload).not.toHaveProperty(campo);
    }
  });

  // Erro: RLS nega (42501) no SELECT de verificação de existentes.
  it("erro do PostgREST na consulta de e-mails existentes propaga como throw", async () => {
    const { client } = criarClienteMock({
      existentes: { data: null, error: { message: "permission denied for table fat_cadastro_participante", code: "42501" } },
    });
    await expect(
      upsertCadastroParticipantes(client, { idProduto: 1, idProjeto: 10, linhas: [linha("a@teste.com")] })
    ).rejects.toMatchObject({ code: "42501" });
  });

  // Erro: RLS nega ou duplicidade no próprio upsert.
  it("erro do PostgREST no upsert (RLS nega ou duplicidade) propaga como throw", async () => {
    const { client } = criarClienteMock({
      existentes: { data: [], error: null },
      upsert: { error: { message: "duplicate key value violates unique constraint", code: "23505" } },
    });
    await expect(
      upsertCadastroParticipantes(client, { idProduto: 1, idProjeto: 10, linhas: [linha("a@teste.com")] })
    ).rejects.toMatchObject({ code: "23505" });
  });

  // AD-005: campos autodeclarados ausentes chegam como null/undefined no
  // objeto validado (T3) e são repassados como estão -- upsert não inventa
  // sentinela nenhum.
  it("campos ausentes da linha validada (AD-005) são repassados como estão, sem sentinela", async () => {
    const { client, getUpsertPayload } = criarClienteMock({ existentes: { data: [], error: null } });
    const linhaMinima: LinhaCadastroPll = { papel: "mentor", nome_completo: "Fulano", email: "fulano@teste.com" };
    await upsertCadastroParticipantes(client, { idProduto: 1, idProjeto: 10, linhas: [linhaMinima] });
    const payload = getUpsertPayload()?.[0];
    expect(payload?.telefone).toBeUndefined();
    expect(payload?.email).toBe("fulano@teste.com");
  });
});

// Spec anchor: tasks.md T7 "Done when" (PLL-CP-05…09):
//  - Busca por qualquer um dos 3 campos; filtro combinável; paginação com total
//  - Campo obrigatório vazio chega como null (vira "—" no componente)
// Mock roteado por tabela, builder encadeável resolvido via `.then()` --
// mesmo padrão de visao-gerencial-g3-g6.test.ts (buscarPendencias).
type RespostaTabela = { data: unknown; error: { message: string; code?: string } | null; count?: number };

function criarClienteMockLista(respostasPorTabela: Record<string, RespostaTabela>) {
  const chamadasPorTabela: Record<string, { metodo: string; args: unknown[] }[]> = {};

  function criarBuilder(tabela: string) {
    const resposta = respostasPorTabela[tabela] ?? { data: [], error: null };
    const chamadas = (chamadasPorTabela[tabela] ??= []);
    const builder: Record<string, unknown> = {
      select: (...args: unknown[]) => {
        chamadas.push({ metodo: "select", args });
        return builder;
      },
      eq: (...args: unknown[]) => {
        chamadas.push({ metodo: "eq", args });
        return builder;
      },
      or: (...args: unknown[]) => {
        chamadas.push({ metodo: "or", args });
        return builder;
      },
      in: (...args: unknown[]) => {
        chamadas.push({ metodo: "in", args });
        return builder;
      },
      order: (...args: unknown[]) => {
        chamadas.push({ metodo: "order", args });
        return builder;
      },
      range: (...args: unknown[]) => {
        chamadas.push({ metodo: "range", args });
        return builder;
      },
      then: (resolve: (valor: RespostaTabela) => void, reject: (erro: unknown) => void) =>
        Promise.resolve(resposta).then(resolve, reject),
    };
    return builder;
  }

  const client = { from: (tabela: string) => criarBuilder(tabela) };
  return {
    client: client as unknown as SupabaseClient<Database>,
    chamadasDe: (tabela: string) => chamadasPorTabela[tabela] ?? [],
  };
}

function rowCadastro(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id_cadastro_participante: 1,
    papel: "mentorado",
    nome_completo: "Fulana de Tal",
    partido_parlamentar: "PT",
    estado_eleicao: "SP",
    nome_parlamentar: "Dep. Fulano",
    email: "fulana@teste.com",
    telefone: "11999999999",
    status_cadastro: "incompleto",
    id_contrato: null,
    ...overrides,
  };
}

describe("buscarCadastroParticipantesPll (T7)", () => {
  it("devolve linhas mapeadas e o total real da paginação (não só a página)", async () => {
    const { client } = criarClienteMockLista({
      fat_cadastro_participante: {
        data: [rowCadastro()],
        error: null,
        count: 42,
      },
    });

    const resultado = await buscarCadastroParticipantesPll(client, { idProduto: 1 });

    expect(resultado.total).toBe(42);
    expect(resultado.linhas).toEqual([
      {
        idCadastroParticipante: 1,
        papel: "mentorado",
        nomeCompleto: "Fulana de Tal",
        siglaPartido: "PT",
        siglaUf: "SP",
        nomeParlamentar: "Dep. Fulano",
        email: "fulana@teste.com",
        telefone: "11999999999",
        nomeMentorPareado: null,
        vinculadoTse: false,
        statusCadastro: "incompleto",
        idContrato: null,
      },
    ]);
  });

  // PLL-CP-06: busca por nome, e-mail OU parlamentar -- os 3 campos no MESMO .or().
  it("busca aplica ilike nos 3 campos (nome, e-mail, parlamentar) num único .or()", async () => {
    const { client, chamadasDe } = criarClienteMockLista({
      fat_cadastro_participante: { data: [], error: null, count: 0 },
    });

    await buscarCadastroParticipantesPll(client, { idProduto: 1, busca: "ped" });

    const chamadaOr = chamadasDe("fat_cadastro_participante").find((c) => c.metodo === "or");
    expect(chamadaOr?.args[0]).toBe(
      "nome_completo.ilike.%ped%,email.ilike.%ped%,nome_parlamentar.ilike.%ped%"
    );
  });

  // PLL-CP-07: partido e UF são filtros combináveis -- os dois .eq() coexistem.
  it("filtros de partido e UF são combináveis (os dois aplicados juntos)", async () => {
    const { client, chamadasDe } = criarClienteMockLista({
      fat_cadastro_participante: { data: [], error: null, count: 0 },
    });

    await buscarCadastroParticipantesPll(client, { idProduto: 1, partido: "PT", uf: "SP" });

    const eqs = chamadasDe("fat_cadastro_participante").filter((c) => c.metodo === "eq");
    expect(eqs).toContainEqual({ metodo: "eq", args: ["partido_parlamentar", "PT"] });
    expect(eqs).toContainEqual({ metodo: "eq", args: ["estado_eleicao", "SP"] });
  });

  // PLL-CP-08: paginação real via .range(), nunca a tabela inteira de uma vez.
  it("pagina via .range() com o tamanho de página informado", async () => {
    const { client, chamadasDe } = criarClienteMockLista({
      fat_cadastro_participante: { data: [], error: null, count: 0 },
    });

    await buscarCadastroParticipantesPll(client, { idProduto: 1, pagina: 3, tamanhoPagina: 10 });

    const chamadaRange = chamadasDe("fat_cadastro_participante").find((c) => c.metodo === "range");
    // Página 3, tamanho 10 -> registros 20..29 (0-based, inclusive).
    expect(chamadaRange?.args).toEqual([20, 29]);
  });

  // PLL-CP-09 (AD-005): campo obrigatório vazio chega como null, nunca sentinela.
  it("campo ausente na linha (ex.: telefone) chega como null, não como sentinela", async () => {
    const { client } = criarClienteMockLista({
      fat_cadastro_participante: {
        data: [rowCadastro({ telefone: null, nome_parlamentar: null, partido_parlamentar: null, estado_eleicao: null })],
        error: null,
        count: 1,
      },
    });

    const resultado = await buscarCadastroParticipantesPll(client, { idProduto: 1 });

    expect(resultado.linhas[0].telefone).toBeNull();
    expect(resultado.linhas[0].nomeParlamentar).toBeNull();
    expect(resultado.linhas[0].siglaPartido).toBeNull();
    expect(resultado.linhas[0].siglaUf).toBeNull();
  });

  // PLL-CP-05: linha vinculada ao TSE (id_contrato preenchido) carrega o
  // mentor pareado e vinculadoTse: true.
  it("linha com id_contrato busca o mentor pareado e marca vinculadoTse: true", async () => {
    const { client } = criarClienteMockLista({
      fat_cadastro_participante: {
        data: [rowCadastro({ id_contrato: 99 })],
        error: null,
        count: 1,
      },
      rel_usuario_contrato: {
        data: [{ id_contrato: 99, dim_usuario: { nome: "Carla Mentora" } }],
        error: null,
      },
    });

    const resultado = await buscarCadastroParticipantesPll(client, { idProduto: 1 });

    expect(resultado.linhas[0].vinculadoTse).toBe(true);
    expect(resultado.linhas[0].nomeMentorPareado).toBe("Carla Mentora");
    expect(resultado.linhas[0].idContrato).toBe(99);
  });

  // Lado oposto: sem nenhuma linha vinculada, a consulta de mentor pareado
  // nem é feita (idsContrato vazio) e vinculadoTse é false para todas.
  it("nenhuma linha vinculada: vinculadoTse false em todas, sem consultar mentor pareado", async () => {
    const { client, chamadasDe } = criarClienteMockLista({
      fat_cadastro_participante: {
        data: [rowCadastro({ id_contrato: null }), rowCadastro({ id_cadastro_participante: 2, id_contrato: null })],
        error: null,
        count: 2,
      },
    });

    const resultado = await buscarCadastroParticipantesPll(client, { idProduto: 1 });

    expect(resultado.linhas.every((l) => l.vinculadoTse === false && l.nomeMentorPareado === null)).toBe(true);
    expect(chamadasDe("rel_usuario_contrato")).toEqual([]);
  });

  // Erro: RLS nega (42501) na consulta principal propaga como throw.
  it("erro do PostgREST na consulta principal propaga como throw", async () => {
    const { client } = criarClienteMockLista({
      fat_cadastro_participante: {
        data: null,
        error: { message: "permission denied for table fat_cadastro_participante", code: "42501" },
      },
    });

    await expect(buscarCadastroParticipantesPll(client, { idProduto: 1 })).rejects.toMatchObject({ code: "42501" });
  });
});

// Spec anchor: PLL-CP-04 ("Última importação: DD/MM/AAAA por ‹nome›" + as 3
// métricas) -- fila de respostas por tabela (cada `.from()` consome a
// próxima da fila): 3 contagens (head) seguidas da consulta de última
// importação, todas na mesma tabela com filtros diferentes.
function criarClienteMockMetricas(filaFatCadastro: RespostaTabela[], erroUltima: RespostaTabela["error"] = null) {
  const fila = [...filaFatCadastro];
  const builder = (resposta: RespostaTabela): Record<string, unknown> => {
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
      not: () => b,
      order: () => b,
      limit: () => b,
      then: (resolve: (v: RespostaTabela) => void, reject: (e: unknown) => void) =>
        Promise.resolve(resposta).then(resolve, reject),
    };
    return b;
  };

  const client = {
    from: () => builder(fila.shift() ?? { data: [], error: erroUltima }),
  };
  return client as unknown as SupabaseClient<Database>;
}

describe("buscarMetricasCadastroPll (T9)", () => {
  it("agrega as 3 contagens e a última importação (data + nome de quem importou)", async () => {
    const client = criarClienteMockMetricas([
      { data: null, error: null, count: 42 }, // total
      { data: null, error: null, count: 3 }, // pendente_revisao
      { data: null, error: null, count: 2 }, // incompleto
      {
        data: [{ importado_em: "2026-09-20T10:00:00Z", dim_usuario: { nome: "Ana Gestora" } }],
        error: null,
      }, // última importação
    ]);

    const resultado = await buscarMetricasCadastroPll(client, { idProduto: 1 });

    expect(resultado).toEqual({
      participantesCadastrados: 42,
      pendentesRevisao: 3,
      comDadosIncompletos: 2,
      ultimaImportacao: { data: "2026-09-20T10:00:00Z", nomeUsuario: "Ana Gestora" },
    });
  });

  // Lado oposto: nenhuma linha importada ainda -- ultimaImportacao é null,
  // nunca uma data inventada (AD-005).
  it("sem nenhuma linha importada, ultimaImportacao é null", async () => {
    const client = criarClienteMockMetricas([
      { data: null, error: null, count: 0 },
      { data: null, error: null, count: 0 },
      { data: null, error: null, count: 0 },
      { data: [], error: null },
    ]);

    const resultado = await buscarMetricasCadastroPll(client, { idProduto: 1 });

    expect(resultado.ultimaImportacao).toBeNull();
    expect(resultado.participantesCadastrados).toBe(0);
  });

  it("erro do PostgREST em qualquer contagem propaga como throw", async () => {
    const client = criarClienteMockMetricas([
      { data: null, error: { message: "permission denied", code: "42501" }, count: undefined },
    ]);

    await expect(buscarMetricasCadastroPll(client, { idProduto: 1 })).rejects.toMatchObject({ code: "42501" });
  });
});
