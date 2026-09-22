import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LinhaCadastroPll } from "../schemas/cadastro-participante-pll";
import type { Database } from "../supabase/database.types";

// T10: vincularParticipanteAoTse chama a criarMandato REAL de rpc/mandato.ts
// -- mockada aqui pra isolar a orquestração (chamada + UPDATE de staging) do
// comportamento interno da RPC, que já tem suíte própria.
const criarMandatoMock = vi.fn();
vi.mock("../rpc/mandato", () => ({
  criarMandato: (...args: unknown[]) => criarMandatoMock(...args),
}));

import {
  atualizarCamposEditaveisParticipante,
  buscarCadastroParticipantesPll,
  buscarMetricasCadastroPll,
  upsertCadastroParticipantes,
  vincularParticipanteAoTse,
} from "./pll-cadastro";

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
    const resultado = await upsertCadastroParticipantes(client, { idProduto: 1, idEdicao: 10, linhas: [] });
    expect(resultado).toEqual({ inseridos: 0, atualizados: 0 });
    expect(chamadas).toEqual([]);
  });

  // Done-when: "Linha nova insere"
  it("nenhum e-mail existente no projeto: todas as linhas contam como inseridas", async () => {
    const { client } = criarClienteMock({ existentes: { data: [], error: null } });
    const resultado = await upsertCadastroParticipantes(client, {
      idProduto: 1,
      idEdicao: 10,
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
      idEdicao: 10,
      linhas: [linha("a@teste.com"), linha("b@teste.com")],
    });
    expect(resultado).toEqual({ inseridos: 1, atualizados: 1 });
  });

  it("upsert usa onConflict 'id_edicao,email' (sustenta o upsert por edição, PLL-CP-03)", async () => {
    const { client, chamadas } = criarClienteMock({ existentes: { data: [], error: null } });
    await upsertCadastroParticipantes(client, { idProduto: 1, idEdicao: 10, linhas: [linha("a@teste.com")] });
    const chamadaUpsert = chamadas.find((c) => c.metodo === "upsert");
    expect(chamadaUpsert?.args[1]).toEqual({ onConflict: "id_edicao,email" });
  });

  it("payload envia id_produto/id_edicao/importado_por junto de cada linha", async () => {
    const { client, getUpsertPayload } = criarClienteMock({ existentes: { data: [], error: null } });
    await upsertCadastroParticipantes(client, {
      idProduto: 3,
      idEdicao: 10,
      idUsuarioImportador: 42,
      linhas: [linha("a@teste.com")],
    });
    const payload = getUpsertPayload();
    expect(payload).toHaveLength(1);
    expect(payload?.[0]).toMatchObject({ id_produto: 3, id_edicao: 10, importado_por: 42, email: "a@teste.com" });
  });

  it("idUsuarioImportador ausente vira importado_por: null", async () => {
    const { client, getUpsertPayload } = criarClienteMock({ existentes: { data: [], error: null } });
    await upsertCadastroParticipantes(client, { idProduto: 3, idEdicao: 10, linhas: [linha("a@teste.com")] });
    expect(getUpsertPayload()?.[0].importado_por).toBeNull();
  });

  // Edge case da spec.md: "reimportação nunca desfaz um vínculo confirmado" --
  // id_contrato/id_vinculo_tse (e os campos editáveis no sistema) nunca
  // entram no payload, então o PostgREST não os inclui no SET do ON CONFLICT.
  it("o payload do upsert NUNCA inclui id_contrato/id_vinculo_tse nem os campos editáveis no sistema", async () => {
    const { client, getUpsertPayload } = criarClienteMock({ existentes: { data: [], error: null } });
    await upsertCadastroParticipantes(client, { idProduto: 1, idEdicao: 10, linhas: [linha("a@teste.com")] });
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
      upsertCadastroParticipantes(client, { idProduto: 1, idEdicao: 10, linhas: [linha("a@teste.com")] })
    ).rejects.toMatchObject({ code: "42501" });
  });

  // Erro: RLS nega ou duplicidade no próprio upsert.
  it("erro do PostgREST no upsert (RLS nega ou duplicidade) propaga como throw", async () => {
    const { client } = criarClienteMock({
      existentes: { data: [], error: null },
      upsert: { error: { message: "duplicate key value violates unique constraint", code: "23505" } },
    });
    await expect(
      upsertCadastroParticipantes(client, { idProduto: 1, idEdicao: 10, linhas: [linha("a@teste.com")] })
    ).rejects.toMatchObject({ code: "23505" });
  });

  // AD-005: campos autodeclarados ausentes chegam como null/undefined no
  // objeto validado (T3) e são repassados como estão -- upsert não inventa
  // sentinela nenhum.
  it("campos ausentes da linha validada (AD-005) são repassados como estão, sem sentinela", async () => {
    const { client, getUpsertPayload } = criarClienteMock({ existentes: { data: [], error: null } });
    const linhaMinima: LinhaCadastroPll = { papel: "mentor", nome_completo: "Fulano", email: "fulano@teste.com" };
    await upsertCadastroParticipantes(client, { idProduto: 1, idEdicao: 10, linhas: [linhaMinima] });
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

// Spec anchor: tasks.md T10 "Done when" (PLL-CP-11, PLL-CP-12, PLL-CP-13):
//  - Chama criarMandato com p_candidatura preenchido, depois UPDATE na staging
//  - Troca de vínculo preserva histórico (comportamento da RPC, este teste só
//    confirma que a função não o quebra)
//  - Erro de dim_contratante UNIQUE propaga (mapeado por mapeiaErroRpc já
//    DENTRO de criarMandato -- este teste confirma que não é engolido/reescrito)
function criarClienteMockUpdate(resposta: { error: { message: string; code?: string } | null }) {
  const chamadas: { metodo: string; args: unknown[] }[] = [];
  const client = {
    from: (tabela: string) => {
      chamadas.push({ metodo: "from", args: [tabela] });
      return {
        update: (payload: unknown) => {
          chamadas.push({ metodo: "update", args: [payload] });
          return {
            eq: (...args: unknown[]) => {
              chamadas.push({ metodo: "eq", args });
              return Promise.resolve(resposta);
            },
          };
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

// Sessão 22/09: quando idEdicao é informado, vincularParticipanteAoTse
// primeiro resolve fat_edicao.id_projeto (single) e o pool de
// rel_edicao_mentor (lista), antes do UPDATE de staging -- mock roteado por
// tabela, cada uma com sua própria resposta.
function criarClienteMockVinculo(opts: {
  update: { error: { message: string; code?: string } | null };
  edicao?: { data: { id_projeto: number } | null; error: unknown };
  mentores?: { data: { id_usuario: number }[] | null; error: unknown };
}) {
  const chamadas: { metodo: string; args: unknown[]; tabela: string }[] = [];
  const client = {
    from: (tabela: string) => {
      chamadas.push({ metodo: "from", args: [tabela], tabela });
      if (tabela === "fat_edicao") {
        return {
          select: (...args: unknown[]) => {
            chamadas.push({ metodo: "select", args, tabela });
            return {
              eq: (...args2: unknown[]) => {
                chamadas.push({ metodo: "eq", args: args2, tabela });
                return {
                  single: () => Promise.resolve(opts.edicao ?? { data: null, error: null }),
                };
              },
            };
          },
        };
      }
      if (tabela === "rel_edicao_mentor") {
        return {
          select: (...args: unknown[]) => {
            chamadas.push({ metodo: "select", args, tabela });
            return {
              eq: (...args2: unknown[]) => {
                chamadas.push({ metodo: "eq", args: args2, tabela });
                return Promise.resolve(opts.mentores ?? { data: [], error: null });
              },
            };
          },
        };
      }
      return {
        update: (payload: unknown) => {
          chamadas.push({ metodo: "update", args: [payload], tabela });
          return {
            eq: (...args2: unknown[]) => {
              chamadas.push({ metodo: "eq", args: args2, tabela });
              return Promise.resolve(opts.update);
            },
          };
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

const CANDIDATURA: import("../rpc/mandato").CandidaturaParaConfirmar = {
  ano_eleicao: 2022,
  sq_candidato: 111,
  nr_turno: 1,
  metodo_match: "nome_uf_cargo",
  confianca: "alta",
};

describe("vincularParticipanteAoTse (T10)", () => {
  beforeEach(() => {
    criarMandatoMock.mockReset();
  });

  it("chama criarMandato com p_candidatura preenchido e depois atualiza a linha de staging", async () => {
    criarMandatoMock.mockResolvedValue({
      idContratante: 5,
      idMandato: 9,
      idVinculoTse: 77,
      idContrato: 42,
    });
    const { client, chamadas } = criarClienteMockVinculo({
      update: { error: null },
      edicao: { data: { id_projeto: 10 }, error: null },
      mentores: { data: [{ id_usuario: 55 }, { id_usuario: 56 }], error: null },
    });

    const resultado = await vincularParticipanteAoTse(client, {
      idCadastroParticipante: 1,
      idProduto: 3,
      idEdicao: 20,
      candidatura: CANDIDATURA,
      contratante: { nome: "Dep. Fulano" },
    });

    expect(criarMandatoMock).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        candidatura: CANDIDATURA,
        contratante: { nome: "Dep. Fulano" },
        contrato: expect.objectContaining({ id_produto: 3, id_projeto: 10 }),
        // Pool de mentores da edição (rel_edicao_mentor) repassado a
        // app.criar_mandato(p_mentores_padrao) na mesma chamada.
        mentoresPadrao: [55, 56],
      })
    );
    expect(resultado).toEqual({ idContratante: 5, idMandato: 9, idVinculoTse: 77, idContrato: 42 });

    const chamadaUpdate = chamadas.find((c) => c.metodo === "update");
    expect(chamadaUpdate?.args[0]).toEqual({ id_contrato: 42, id_vinculo_tse: 77 });
    const chamadaEq = chamadas.find((c) => c.metodo === "eq" && c.tabela === "fat_cadastro_participante");
    expect(chamadaEq?.args).toEqual(["id_cadastro_participante", 1]);
  });

  // Lado oposto: sem idEdicao, nenhuma consulta a fat_edicao/rel_edicao_mentor
  // acontece -- mentoresPadrao vai vazio, id_projeto do contrato vai null.
  it("sem idEdicao: não consulta fat_edicao/rel_edicao_mentor, mentoresPadrao vazio", async () => {
    criarMandatoMock.mockResolvedValue({ idContratante: 5, idMandato: 9, idVinculoTse: 77, idContrato: 42 });
    const { client, chamadas } = criarClienteMockVinculo({ update: { error: null } });

    await vincularParticipanteAoTse(client, {
      idCadastroParticipante: 1,
      idProduto: 3,
      candidatura: CANDIDATURA,
      contratante: { nome: "Dep. Fulano" },
    });

    expect(criarMandatoMock).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        contrato: expect.objectContaining({ id_projeto: null }),
        mentoresPadrao: [],
      })
    );
    expect(chamadas.some((c) => c.tabela === "fat_edicao")).toBe(false);
    expect(chamadas.some((c) => c.tabela === "rel_edicao_mentor")).toBe(false);
  });

  // PLL-CP-12: trocar vínculo -- idContratanteExistente presente omite
  // contratante/mandato da chamada (não recria contratante).
  it("troca de vínculo (idContratanteExistente) não envia contratante/mandato novos", async () => {
    criarMandatoMock.mockResolvedValue({ idContratante: 5, idMandato: 9, idVinculoTse: 88, idContrato: 42 });
    const { client } = criarClienteMockUpdate({ error: null });

    await vincularParticipanteAoTse(client, {
      idCadastroParticipante: 1,
      idProduto: 3,
      candidatura: CANDIDATURA,
      contratante: { nome: "Não deveria ir" },
      idContratanteExistente: 5,
    });

    expect(criarMandatoMock).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ contratante: undefined, mandato: undefined, idContratanteExistente: 5 })
    );
  });

  // Lado oposto: sem idContratanteExistente, contratante/mandato são enviados.
  it("primeiro vínculo (sem idContratanteExistente) envia contratante/mandato", async () => {
    criarMandatoMock.mockResolvedValue({ idContratante: 5, idMandato: 9, idVinculoTse: 88, idContrato: 42 });
    const { client } = criarClienteMockUpdate({ error: null });

    await vincularParticipanteAoTse(client, {
      idCadastroParticipante: 1,
      idProduto: 3,
      candidatura: CANDIDATURA,
      contratante: { nome: "Dep. Fulano" },
    });

    expect(criarMandatoMock).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ contratante: { nome: "Dep. Fulano" }, idContratanteExistente: undefined })
    );
  });

  // Erro de dim_contratante UNIQUE (candidatura já vinculada a outro
  // participante do mesmo contrato) -- criarMandato já mapeia via
  // mapeiaErroRpc; esta função nunca reescreve a mensagem por uma genérica.
  it("erro de unicidade propagado por criarMandato chega intacto, sem UPDATE de staging", async () => {
    const erroUnico = new Error("Este contratante já tem um mandato cadastrado.");
    erroUnico.name = "ViolacaoUnicaError";
    criarMandatoMock.mockRejectedValue(erroUnico);
    const { client, chamadas } = criarClienteMockUpdate({ error: null });

    await expect(
      vincularParticipanteAoTse(client, {
        idCadastroParticipante: 1,
        idProduto: 3,
        candidatura: CANDIDATURA,
        contratante: { nome: "Dep. Fulano" },
      })
    ).rejects.toThrow("Este contratante já tem um mandato cadastrado.");

    expect(chamadas.find((c) => c.metodo === "update")).toBeUndefined();
  });

  // Erro na própria escrita de staging (RLS nega o UPDATE) também propaga.
  it("erro do PostgREST no UPDATE da linha de staging propaga como throw", async () => {
    criarMandatoMock.mockResolvedValue({ idContratante: 5, idMandato: 9, idVinculoTse: 77, idContrato: 42 });
    const { client } = criarClienteMockUpdate({
      error: { message: "permission denied for table fat_cadastro_participante", code: "42501" },
    });

    await expect(
      vincularParticipanteAoTse(client, {
        idCadastroParticipante: 1,
        idProduto: 3,
        candidatura: CANDIDATURA,
        contratante: { nome: "Dep. Fulano" },
      })
    ).rejects.toMatchObject({ code: "42501" });
  });
});

describe("atualizarCamposEditaveisParticipante (T16)", () => {
  // Done-when: "Atualiza qualquer subconjunto dos 8 campos TEXT[]/texto sem
  // sobrescrever os demais" -- só as chaves presentes no objeto entram no
  // payload enviado ao PostgREST (nenhuma vira SET coluna = NULL).
  it("envia só as colunas presentes no subconjunto informado (desafios+destaques)", async () => {
    const { client, chamadas } = criarClienteMockUpdate({ error: null });

    await atualizarCamposEditaveisParticipante(client, 1, {
      desafios: ["Agenda apertada"],
      destaques: ["Aprovou projeto X"],
    });

    const chamadaUpdate = chamadas.find((c) => c.metodo === "update");
    expect(chamadaUpdate?.args[0]).toEqual({
      desafios: ["Agenda apertada"],
      destaques: ["Aprovou projeto X"],
    });
  });

  it("envia só ambicao_texto/ambicao_tags quando só a Ambição Política é editada", async () => {
    const { client, chamadas } = criarClienteMockUpdate({ error: null });

    await atualizarCamposEditaveisParticipante(client, 1, {
      ambicaoTexto: "Concorrer a deputado estadual em 2026",
      ambicaoTags: ["reeleição", "estadual"],
    });

    const chamadaUpdate = chamadas.find((c) => c.metodo === "update");
    expect(chamadaUpdate?.args[0]).toEqual({
      ambicao_texto: "Concorrer a deputado estadual em 2026",
      ambicao_tags: ["reeleição", "estadual"],
    });
  });

  it("envia só os 4 quadrantes do SWOT quando só o SWOT é editado", async () => {
    const { client, chamadas } = criarClienteMockUpdate({ error: null });

    await atualizarCamposEditaveisParticipante(client, 1, {
      swotForcas: ["Boa oratória"],
      swotFraquezas: [],
      swotOportunidades: ["Nova legislatura"],
      swotAmeacas: [],
    });

    const chamadaUpdate = chamadas.find((c) => c.metodo === "update");
    expect(chamadaUpdate?.args[0]).toEqual({
      swot_forcas: ["Boa oratória"],
      swot_fraquezas: [],
      swot_oportunidades: ["Nova legislatura"],
      swot_ameacas: [],
    });
  });

  it("filtra pelo id_cadastro_participante certo", async () => {
    const { client, chamadas } = criarClienteMockUpdate({ error: null });

    await atualizarCamposEditaveisParticipante(client, 42, { desafios: ["X"] });

    const chamadaEq = chamadas.find((c) => c.metodo === "eq");
    expect(chamadaEq?.args).toEqual(["id_cadastro_participante", 42]);
  });

  it("nenhum campo informado não chama update", async () => {
    const { client, chamadas } = criarClienteMockUpdate({ error: null });

    await atualizarCamposEditaveisParticipante(client, 1, {});

    expect(chamadas.find((c) => c.metodo === "update")).toBeUndefined();
  });

  // Done-when: "Teste: Assessor tenta escrever e recebe erro de RLS
  // (PLL-CP-23) -- mapeado, não genérico" -- Assessor não tem GRANT (T2),
  // erro chega como 42501 e é mapeado por mapeiaErroRpc pra
  // PermissaoNegadaError (mensagem fixa, nunca a mensagem crua do Postgres).
  it("erro de RLS/GRANT (42501) vira PermissaoNegadaError com mensagem mapeada, não genérica", async () => {
    const { client } = criarClienteMockUpdate({
      error: { message: "permission denied for table fat_cadastro_participante", code: "42501" },
    });

    await expect(
      atualizarCamposEditaveisParticipante(client, 1, { desafios: ["X"] })
    ).rejects.toMatchObject({
      name: "PermissaoNegadaError",
      message: "Você não tem permissão para realizar esta operação.",
    });
  });

  it("lado oposto: erro não mapeado (código desconhecido) vira ErroBancoNaoMapeadoError, não engolido", async () => {
    const { client } = criarClienteMockUpdate({
      error: { message: "conexão perdida", code: "08006" },
    });

    await expect(
      atualizarCamposEditaveisParticipante(client, 1, { desafios: ["X"] })
    ).rejects.toMatchObject({ name: "ErroBancoNaoMapeadoError" });
  });
});
