import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { PermissaoNegadaError, ViolacaoConstraintError } from "./errors";
import {
  atualizarSucessosEmLote,
  criarSucessosEmLote,
  moverItemHierarquia,
  recalcularAtingimento,
  substituirPreditoresPlanejamento,
} from "./planejamento";
import { ErroBancoNaoMapeadoError } from "./errors";

// Spec anchor: PLM-02, PLM-03, PLM-07, PLM-16 (.specs/features/planejamento-planilha-monitoramento/spec.md) --
//  - recalcularAtingimento chama rpc("recalcula_atingimento", { p_id_planejamento })
//  - atualizarSucessosEmLote chama rpc("atualiza_sucessos_mensais_lote", { p_valores }) serializado em snake_case
//  - substituirPreditoresPlanejamento chama rpc("substitui_preditores_planejamento", { p_id_planejamento, p_preditores }) serializado em snake_case
//  - 42501 -> PermissaoNegadaError; 23514 em ck_sucesso_pct -> ViolacaoConstraintError com a mensagem certa
//  - código não mapeado chega como Error, com código e mensagem preservados

type Chamada = { fn: string; params: unknown };

function criarClienteMock(resultado: { data: unknown; error: Partial<PostgrestError> | null }) {
  const chamadas: Chamada[] = [];
  const client = {
    schema: (_nome: string) => ({
      rpc: (fn: string, params: unknown) => {
        chamadas.push({ fn, params });
        return Promise.resolve(resultado);
      },
    }),
  };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

describe("recalcularAtingimento", () => {
  it("sucesso: chama recalcula_atingimento com o id do planejamento", async () => {
    const { client, chamadas } = criarClienteMock({ data: null, error: null });

    await recalcularAtingimento(client, 42);

    expect(chamadas[0]).toEqual({ fn: "recalcula_atingimento", params: { p_id_planejamento: 42 } });
  });

  it("42501: lança PermissaoNegadaError", async () => {
    const { client } = criarClienteMock({ data: null, error: { code: "42501", message: "permission denied" } });

    await expect(recalcularAtingimento(client, 42)).rejects.toThrow(PermissaoNegadaError);
  });
});

describe("atualizarSucessosEmLote", () => {
  it("sucesso: chama atualiza_sucessos_mensais_lote com o array serializado em snake_case", async () => {
    const { client, chamadas } = criarClienteMock({ data: null, error: null });

    await atualizarSucessosEmLote(client, [
      { idSucesso: 1, pctAtingimento: 80 },
      { idSucesso: 2, pctAtingimento: 100 },
    ]);

    expect(chamadas[0]).toEqual({
      fn: "atualiza_sucessos_mensais_lote",
      params: {
        p_valores: [
          { id_sucesso: 1, pct_atingimento: 80 },
          { id_sucesso: 2, pct_atingimento: 100 },
        ],
      },
    });
  });

  // ck_sucesso_pct (0 <= pct_atingimento <= 100) -- valor fora de faixa no meio
  // da faixa colada reverte o UPDATE inteiro (T6); o erro chega como 23514.
  it("23514 em ck_sucesso_pct: lança ViolacaoConstraintError com a mensagem de faixa", async () => {
    const { client } = criarClienteMock({
      data: null,
      error: { code: "23514", message: 'new row for relation "fat_sucesso_mensal" violates check constraint "ck_sucesso_pct"' },
    });

    await expect(atualizarSucessosEmLote(client, [{ idSucesso: 1, pctAtingimento: 150 }])).rejects.toThrow(
      ViolacaoConstraintError
    );
    try {
      await atualizarSucessosEmLote(client, [{ idSucesso: 1, pctAtingimento: 150 }]);
    } catch (erro) {
      expect((erro as ViolacaoConstraintError).message).toBe("Valor deve estar entre 0 e 100.");
    }
  });

  it("código não mapeado chega como Error, com código e mensagem preservados", async () => {
    const erroOriginal = { code: "P0001", message: "erro inesperado" };
    const { client } = criarClienteMock({ data: null, error: erroOriginal });

    const capturado = await (atualizarSucessosEmLote(client, [{ idSucesso: 1, pctAtingimento: 50 }])).catch((e: unknown) => e);

    // T24 (redesenho-estrategia-tela-first): esta asserção era
    // `toEqual(erroOriginal)` e passava porque `mapeiaErroRpc` devolvia o
    // objeto cru do PostgREST. Só que esse objeto NAO e um Error em runtime,
    // e todo `catch (e)` da UI na forma
    // `e instanceof Error ? e.message : "<generico>"` descartava a mensagem
    // do banco. O contrato agora e mais forte: chega como Error de verdade,
    // com codigo e mensagem preservados.
    expect(capturado).toBeInstanceOf(ErroBancoNaoMapeadoError);
    expect((capturado as ErroBancoNaoMapeadoError).codigo).toBe(erroOriginal.code);
    expect((capturado as Error).message).toContain(erroOriginal.code);
    expect((capturado as Error).message).toContain(erroOriginal.message);
  });
});

describe("substituirPreditoresPlanejamento", () => {
  it("sucesso: chama substitui_preditores_planejamento com o array serializado em snake_case", async () => {
    const { client, chamadas } = criarClienteMock({ data: null, error: null });

    await substituirPreditoresPlanejamento(client, 7, [
      { idPreditor: 10, ordem: 1 },
      { idPreditor: 20, ordem: 2 },
    ]);

    expect(chamadas[0]).toEqual({
      fn: "substitui_preditores_planejamento",
      params: {
        p_id_planejamento: 7,
        p_preditores: [
          { id_preditor: 10, ordem: 1 },
          { id_preditor: 20, ordem: 2 },
        ],
      },
    });
  });

  it("42501: lança PermissaoNegadaError (Mentor/Assessor sem GRANT em rel_planejamento_preditor)", async () => {
    const { client } = criarClienteMock({ data: null, error: { code: "42501", message: "permission denied" } });

    await expect(substituirPreditoresPlanejamento(client, 7, [{ idPreditor: 10, ordem: 1 }])).rejects.toThrow(
      PermissaoNegadaError
    );
  });

  it("array vazio: chama a RPC com p_preditores: [] (limpa os preditores prioritários)", async () => {
    const { client, chamadas } = criarClienteMock({ data: null, error: null });

    await substituirPreditoresPlanejamento(client, 7, []);

    expect(chamadas[0]).toEqual({
      fn: "substitui_preditores_planejamento",
      params: { p_id_planejamento: 7, p_preditores: [] },
    });
  });
});

// Spec anchor: PLV-06 (.specs/features/planejamento-estrategico-v2/spec.md) --
// criarSucessosEmLote chama rpc("cria_sucessos_mensais_lote", { p_id_meta,
// p_base, p_meses }), com p_base serializado em snake_case.
//
// L-004: cada parâmetro é asserido explicitamente, não só os pré-existentes --
// um pass-through novo que se perdesse no caminho passaria despercebido num
// teste que só olha os antigos.
describe("criarSucessosEmLote (PLV-06)", () => {
  const base = {
    descricao: "Reunião mensal",
    peso: 25,
    status: "pendente" as const,
    dtLimite: "2026-09-30",
    pctAtingimento: 10,
    idUsuarioResponsavel: 7,
  };

  it("sucesso: envia os 3 parâmetros, com p_base em snake_case", async () => {
    const { client, chamadas } = criarClienteMock({ data: null, error: null });

    await criarSucessosEmLote(client, 5, base, ["2026-07-01", "2026-08-01"]);

    expect(chamadas[0]).toEqual({
      fn: "cria_sucessos_mensais_lote",
      params: {
        p_id_meta: 5,
        p_base: {
          descricao: "Reunião mensal",
          peso: 25,
          status: "pendente",
          dt_limite: "2026-09-30",
          pct_atingimento: 10,
          id_usuario_responsavel: 7,
        },
        p_meses: ["2026-07-01", "2026-08-01"],
      },
    });
  });

  it("opcionais ausentes viram null explícito, nunca undefined (AD-005)", async () => {
    const { client, chamadas } = criarClienteMock({ data: null, error: null });

    await criarSucessosEmLote(client, 5, { descricao: "X", peso: 10, status: "pendente" }, ["2026-07-01"]);

    const params = chamadas[0].params as { p_base: Record<string, unknown> };
    expect(params.p_base.dt_limite).toBeNull();
    expect(params.p_base.pct_atingimento).toBeNull();
    expect(params.p_base.id_usuario_responsavel).toBeNull();
  });

  it("preserva a ordem e a quantidade dos meses enviados", async () => {
    const { client, chamadas } = criarClienteMock({ data: null, error: null });
    const meses = ["2026-07-01", "2026-08-01", "2026-09-01"];

    await criarSucessosEmLote(client, 5, base, meses);

    expect((chamadas[0].params as { p_meses: string[] }).p_meses).toEqual(meses);
  });

  it("42501: lança PermissaoNegadaError", async () => {
    const { client } = criarClienteMock({ data: null, error: { code: "42501", message: "permission denied" } });
    await expect(criarSucessosEmLote(client, 5, base, ["2026-07-01"])).rejects.toThrow(PermissaoNegadaError);
  });
});

// Spec anchor: PLV-09.
describe("moverItemHierarquia (PLV-09)", () => {
  it("meta: envia tipo, id e novo pai", async () => {
    const { client, chamadas } = criarClienteMock({ data: null, error: null });

    await moverItemHierarquia(client, "meta", 11, 22);

    expect(chamadas[0]).toEqual({
      fn: "move_item_hierarquia",
      params: { p_tipo: "meta", p_id: 11, p_novo_pai: 22 },
    });
  });

  // A RPC atende dois tipos; o wrapper precisa repassar o discriminador certo,
  // não assumir "meta".
  it("sucesso mensal: repassa o tipo 'sucesso', não 'meta'", async () => {
    const { client, chamadas } = criarClienteMock({ data: null, error: null });

    await moverItemHierarquia(client, "sucesso", 33, 44);

    expect((chamadas[0].params as { p_tipo: string }).p_tipo).toBe("sucesso");
  });

  it("42501: lança PermissaoNegadaError", async () => {
    const { client } = criarClienteMock({ data: null, error: { code: "42501", message: "permission denied" } });
    await expect(moverItemHierarquia(client, "meta", 11, 22)).rejects.toThrow(PermissaoNegadaError);
  });
});
