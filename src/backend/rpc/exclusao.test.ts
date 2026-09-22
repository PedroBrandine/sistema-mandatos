import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { PermissaoNegadaError } from "./errors";
import {
  excluirContrato,
  excluirIncidencia,
  resumoExclusaoContrato,
  resumoExclusaoIncidencia,
} from "./exclusao";

// Spec anchor: exclusão definitiva de mandato e de itens da Incidência (pedido
// de Pedro, 2026-09-21). Os wrappers só fazem três coisas, e são elas que
// ficam provadas aqui: chamam a função certa com os parâmetros certos, traduzem
// snake_case -> camelCase, e transformam 42501 em PermissaoNegadaError. O efeito
// no banco (ordem de FKs, papel, atomicidade) é provado nos testes de
// integração em supabase/tests/fundacao/fn-excluir-*.

type Chamada = { fn: string; params: unknown };

function criarClienteMock(resultado: { data: unknown; error: Partial<PostgrestError> | null }) {
  const chamadas: Chamada[] = [];
  const client = {
    schema: (nome: string) => ({
      rpc: (fn: string, params: unknown) => {
        chamadas.push({ fn: `${nome}.${fn}`, params });
        return Promise.resolve(resultado);
      },
    }),
  };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

const RETORNO_CONTRATO = {
  id_contrato: 42,
  nome_contratante: "Dep. Ana Ribeiro",
  tipo_contratante: "mandato",
  apaga_contratante: true,
  contagens: { registros: 3, fatos_geradores: 1 },
};

describe("exclusão de mandato", () => {
  it("resumo: chama app.resumo_exclusao_contrato e devolve camelCase", async () => {
    const { client, chamadas } = criarClienteMock({ data: RETORNO_CONTRATO, error: null });

    const resumo = await resumoExclusaoContrato(client, 42);

    expect(chamadas[0]).toEqual({ fn: "app.resumo_exclusao_contrato", params: { p_id_contrato: 42 } });
    expect(resumo).toEqual({
      idContrato: 42,
      nomeContratante: "Dep. Ana Ribeiro",
      tipoContratante: "mandato",
      apagaContratante: true,
      contagens: { registros: 3, fatos_geradores: 1 },
    });
  });

  it("exclusão: chama app.excluir_contrato e devolve o resumo do que saiu", async () => {
    const { client, chamadas } = criarClienteMock({ data: RETORNO_CONTRATO, error: null });

    const resumo = await excluirContrato(client, 42);

    expect(chamadas[0]).toEqual({ fn: "app.excluir_contrato", params: { p_id_contrato: 42 } });
    expect(resumo.apagaContratante).toBe(true);
  });

  it("42501 (papel sem permissão ou contrato invisível) vira PermissaoNegadaError", async () => {
    const { client } = criarClienteMock({ data: null, error: { code: "42501", message: "sem permissão" } });

    await expect(excluirContrato(client, 42)).rejects.toBeInstanceOf(PermissaoNegadaError);
    await expect(resumoExclusaoContrato(client, 42)).rejects.toBeInstanceOf(PermissaoNegadaError);
  });
});

describe("exclusão de item da Incidência", () => {
  it("resumo: manda tipo e id, e Fato Gerador traz a situação", async () => {
    const { client, chamadas } = criarClienteMock({
      data: { tipo: "fato_gerador", id: 9, situacao: "realizado", contagens: { vinculos_origem: 1 } },
      error: null,
    });

    const resumo = await resumoExclusaoIncidencia(client, "fato_gerador", 9);

    expect(chamadas[0]).toEqual({ fn: "app.resumo_exclusao_incidencia", params: { p_tipo: "fato_gerador", p_id: 9 } });
    expect(resumo).toEqual({ tipo: "fato_gerador", id: 9, situacao: "realizado", contagens: { vinculos_origem: 1 } });
  });

  it("os outros tipos não têm situação: vem null, nunca undefined", async () => {
    const { client } = criarClienteMock({
      data: { tipo: "registro", id: 5, contagens: { insights_desvinculados: 2 } },
      error: null,
    });

    const resumo = await excluirIncidencia(client, "registro", 5);

    expect(resumo.situacao).toBeNull();
    expect(resumo.contagens).toEqual({ insights_desvinculados: 2 });
  });

  it("42501 vira PermissaoNegadaError", async () => {
    const { client } = criarClienteMock({ data: null, error: { code: "42501", message: "x" } });

    await expect(excluirIncidencia(client, "insight", 1)).rejects.toBeInstanceOf(PermissaoNegadaError);
  });
});
