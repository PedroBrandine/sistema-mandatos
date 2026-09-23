import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { atualizarStatusEncontro, criarEncontro, marcarPresenca } from "./encontro";
import { ErroBancoNaoMapeadoError, PermissaoNegadaError, ViolacaoChaveEstrangeiraError } from "./errors";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/tasks.md, T29
// "Done when" (EST-13 AC4, AC5) --
//  - Wrapper assere cada parâmetro repassado (lição L-004)
//  - 42501 -> PermissaoNegadaError (reuso, sem linha nova em MENSAGENS_*)
//  - Código não mapeado chega como ErroBancoNaoMapeadoError
//
// Mesmo padrão de rpc/kanban.test.ts.

type Chamada = { schema: string; fn: string; params: unknown };

function criarClienteMock(resultado: { data: unknown; error: Partial<PostgrestError> | null }) {
  const chamadas: Chamada[] = [];
  const client = {
    schema: (nome: string) => ({
      rpc: (fn: string, params: unknown) => {
        chamadas.push({ schema: nome, fn, params });
        return Promise.resolve(resultado);
      },
    }),
  };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

describe("marcarPresenca (EST-13 AC4)", () => {
  it("sucesso: chama app.marcar_presenca com p_id_encontro repassado verbatim (L-004)", async () => {
    const { client, chamadas } = criarClienteMock({ data: null, error: null });

    await marcarPresenca(client, { idEncontro: 501 });

    expect(chamadas[0]).toEqual({
      schema: "app",
      fn: "marcar_presenca",
      params: { p_id_encontro: 501 },
    });
  });

  it("não inventa parâmetro nenhum além de p_id_encontro", async () => {
    const { client, chamadas } = criarClienteMock({ data: null, error: null });

    await marcarPresenca(client, { idEncontro: 501 });

    expect(Object.keys(chamadas[0].params as object)).toEqual(["p_id_encontro"]);
  });

  it("sucesso não lança — AC5 trata o encontro já realizado como idempotente, não como erro", async () => {
    const { client } = criarClienteMock({ data: null, error: null });

    await expect(marcarPresenca(client, { idEncontro: 501 })).resolves.toBeUndefined();
  });

  it("42501: lança PermissaoNegadaError", async () => {
    const { client } = criarClienteMock({
      data: null,
      error: { code: "42501", message: "Encontro não encontrado ou sem permissão." },
    });

    await expect(marcarPresenca(client, { idEncontro: 501 })).rejects.toBeInstanceOf(
      PermissaoNegadaError
    );
  });

  it("código não mapeado vira ErroBancoNaoMapeadoError, preservando código e mensagem", async () => {
    const { client } = criarClienteMock({
      data: null,
      error: { code: "XX999", message: "falha interna" },
    });

    await expect(marcarPresenca(client, { idEncontro: 501 })).rejects.toBeInstanceOf(
      ErroBancoNaoMapeadoError
    );
  });
});

// Spec anchor: .specs/features/ficha-mandato-contrato/tasks.md, T19 Done-when
// (FMC-30) --
//  - Todo parâmetro novo é afirmado por nome e valor no teste de caminho feliz (lição L-004)
//  - Cada código de erro mapeado tem asserção própria (lição L-010)
//
// design.md "RPCs": app.criar_encontro(p_id_contrato, p_titulo, p_id_etapa,
// p_id_tipo_registro, p_dt_inicio, p_dt_fim, p_modalidade, p_local, p_tema,
// p_participantes JSONB) -> BIGINT. T18 (a função em si) fica para quando o
// push for liberado -- este wrapper usa a assinatura já fechada em design.md,
// contra um cliente Supabase mockado.
describe("criarEncontro (FMC-30)", () => {
  it("sucesso: chama app.criar_encontro com o payload completo, incluindo participantes, e retorna idEncontro", async () => {
    const { client, chamadas } = criarClienteMock({ data: 77, error: null });

    const resultado = await criarEncontro(client, {
      idContrato: 1,
      titulo: "Reunião de Monitoramento",
      idEtapa: 2,
      idTipoRegistro: 3,
      dtInicio: "2026-09-20T13:00:00Z",
      dtFim: "2026-09-20T14:00:00Z",
      modalidade: "presencial",
      local: "Sede do mandato",
      tema: "Educação",
      participantes: [
        { idUsuario: 10, origem: "legisla" },
        { nomeLivre: "Fulano de Tal", origem: "externo" },
      ],
    });

    expect(chamadas[0]).toEqual({
      schema: "app",
      fn: "criar_encontro",
      params: {
        p_id_contrato: 1,
        p_titulo: "Reunião de Monitoramento",
        p_id_etapa: 2,
        p_id_tipo_registro: 3,
        p_dt_inicio: "2026-09-20T13:00:00Z",
        p_dt_fim: "2026-09-20T14:00:00Z",
        p_modalidade: "presencial",
        p_local: "Sede do mandato",
        p_tema: "Educação",
        p_participantes: [
          { id_usuario: 10, nome_livre: null, origem: "legisla" },
          { id_usuario: null, nome_livre: "Fulano de Tal", origem: "externo" },
        ],
      },
    });
    expect(resultado).toEqual({ idEncontro: 77 });
  });

  it("sucesso: payload mínimo (sem dt_fim/modalidade/local/tema, sem participantes) omite os opcionais como undefined", async () => {
    const { client, chamadas } = criarClienteMock({ data: 5, error: null });

    const resultado = await criarEncontro(client, {
      idContrato: 1,
      titulo: "Diagnóstico de Organograma",
      idEtapa: 2,
      idTipoRegistro: 3,
      dtInicio: "2026-09-20T13:00:00Z",
      participantes: [],
    });

    expect(chamadas[0]).toEqual({
      schema: "app",
      fn: "criar_encontro",
      params: {
        p_id_contrato: 1,
        p_titulo: "Diagnóstico de Organograma",
        p_id_etapa: 2,
        p_id_tipo_registro: 3,
        p_dt_inicio: "2026-09-20T13:00:00Z",
        p_dt_fim: undefined,
        p_modalidade: undefined,
        p_local: undefined,
        p_tema: undefined,
        p_participantes: [],
      },
    });
    expect(resultado).toEqual({ idEncontro: 5 });
  });

  // PF2-06 AC2 (.specs/features/pente-fino-2026-09-23/spec.md, validation.md
  // Fix 3): EncontroForm (T6) sempre envia modalidade: null (o campo foi
  // removido da UI, mas o form ainda manda a chave explicitamente); os
  // testes existentes cobriam separadamente o form isolado e um payload que
  // já OMITE a chave, sem nenhum caso amarrando as duas pontas com o valor
  // real (null) que o form emite. `input.modalidade ?? undefined` (encontro.ts:51)
  // faz `null` chegar como `undefined` no params do RPC -- confirmado lendo
  // o código antes deste teste.
  it("modalidade: null (valor real enviado por EncontroForm) chega como p_modalidade undefined no RPC (PF2-06 AC2)", async () => {
    const { client, chamadas } = criarClienteMock({ data: 8, error: null });

    await criarEncontro(client, {
      idContrato: 1,
      titulo: "Reunião sem modalidade",
      idEtapa: 2,
      idTipoRegistro: 3,
      dtInicio: "2026-09-20T13:00:00Z",
      modalidade: null,
      participantes: [],
    });

    const params = chamadas[0].params as { p_modalidade?: unknown };
    expect(params.p_modalidade).toBeUndefined();
    expect("p_modalidade" in (params as object)).toBe(true);
  });

  it("42501: lança PermissaoNegadaError", async () => {
    const { client } = criarClienteMock({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });

    await expect(
      criarEncontro(client, {
        idContrato: 1,
        titulo: "x",
        idEtapa: 2,
        idTipoRegistro: 3,
        dtInicio: "2026-09-20T13:00:00Z",
        participantes: [],
      })
    ).rejects.toBeInstanceOf(PermissaoNegadaError);
  });

  it("23503 (id_etapa inexistente): lança ViolacaoChaveEstrangeiraError com mensagem de fallback", async () => {
    const { client } = criarClienteMock({
      data: null,
      error: {
        code: "23503",
        message:
          'insert or update on table "fat_encontro" violates foreign key constraint "fat_encontro_id_etapa_fkey"',
      },
    });

    await expect(
      criarEncontro(client, {
        idContrato: 1,
        titulo: "x",
        idEtapa: 999,
        idTipoRegistro: 3,
        dtInicio: "2026-09-20T13:00:00Z",
        participantes: [],
      })
    ).rejects.toBeInstanceOf(ViolacaoChaveEstrangeiraError);
  });

  it("código não mapeado (validação de RPC ainda não implementada, ex.: P0001) chega como ErroBancoNaoMapeadoError, com código e mensagem preservados", async () => {
    const erroOriginal = { code: "P0001", message: "Participante com id_usuario e nome_livre ao mesmo tempo" };
    const { client } = criarClienteMock({ data: null, error: erroOriginal });

    const capturado = await criarEncontro(client, {
      idContrato: 1,
      titulo: "x",
      idEtapa: 2,
      idTipoRegistro: 3,
      dtInicio: "2026-09-20T13:00:00Z",
      participantes: [{ idUsuario: 1, nomeLivre: "Duplo", origem: "legisla" }],
    }).catch((e: unknown) => e);

    expect(capturado).toBeInstanceOf(ErroBancoNaoMapeadoError);
    expect((capturado as ErroBancoNaoMapeadoError).codigo).toBe(erroOriginal.code);
    expect((capturado as Error).message).toContain(erroOriginal.code);
    expect((capturado as Error).message).toContain(erroOriginal.message);
  });

  // diagnostico-participante-pll (Agenda PLL): p_nr_sequencia é o elo entre
  // o encontro criado e o slot fixo de Mentoria N.
  it("nrSequencia é repassado como p_nr_sequencia (Agenda PLL)", async () => {
    const { client, chamadas } = criarClienteMock({ data: 77, error: null });

    await criarEncontro(client, {
      idContrato: 1,
      titulo: "Mentoria 3",
      idEtapa: 2,
      idTipoRegistro: 3,
      dtInicio: "2026-09-20T13:00:00Z",
      participantes: [],
      nrSequencia: 3,
    });

    expect((chamadas[0].params as { p_nr_sequencia?: unknown }).p_nr_sequencia).toBe(3);
  });

  it("sem nrSequencia, p_nr_sequencia chega como undefined (encontros que não são slot fixo)", async () => {
    const { client, chamadas } = criarClienteMock({ data: 77, error: null });

    await criarEncontro(client, {
      idContrato: 1,
      titulo: "x",
      idEtapa: 2,
      idTipoRegistro: 3,
      dtInicio: "2026-09-20T13:00:00Z",
      participantes: [],
    });

    expect((chamadas[0].params as { p_nr_sequencia?: unknown }).p_nr_sequencia).toBeUndefined();
  });
});

// diagnostico-participante-pll (Agenda PLL, ações "Remarcar"/"Cancelar").
// UPDATE direto (sem RPC) -- mesmo padrão de teste de rpc/contrato.ts
// (atualizarStatusContrato): mock de `.from().update().eq()`.
describe("atualizarStatusEncontro (Agenda PLL)", () => {
  function criarClienteUpdateMock(erro: Partial<PostgrestError> | null) {
    const chamadas: { payload: unknown; idEncontro: unknown }[] = [];
    const client = {
      from: () => ({
        update: (payload: unknown) => ({
          eq: (_coluna: string, idEncontro: unknown) => {
            chamadas.push({ payload, idEncontro });
            return Promise.resolve({ error: erro });
          },
        }),
      }),
    };
    return { client: client as unknown as SupabaseClient<Database>, chamadas };
  }

  it("sucesso: envia { status } pro id_encontro certo", async () => {
    const { client, chamadas } = criarClienteUpdateMock(null);

    await atualizarStatusEncontro(client, { idEncontro: 501, status: "cancelado" });

    expect(chamadas[0]).toEqual({ payload: { status: "cancelado" }, idEncontro: 501 });
  });

  it("remarcado: mesmo caminho, só muda o valor de status", async () => {
    const { client, chamadas } = criarClienteUpdateMock(null);

    await atualizarStatusEncontro(client, { idEncontro: 502, status: "remarcado" });

    expect(chamadas[0]).toEqual({ payload: { status: "remarcado" }, idEncontro: 502 });
  });

  it("42501 (RLS negou): lança PermissaoNegadaError", async () => {
    const { client } = criarClienteUpdateMock({ code: "42501", message: "permission denied" });

    await expect(atualizarStatusEncontro(client, { idEncontro: 501, status: "cancelado" })).rejects.toBeInstanceOf(
      PermissaoNegadaError
    );
  });
});
