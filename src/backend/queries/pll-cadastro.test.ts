import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { LinhaCadastroPll } from "../schemas/cadastro-participante-pll";
import type { Database } from "../supabase/database.types";
import { upsertCadastroParticipantes } from "./pll-cadastro";

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
