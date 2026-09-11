import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarCardsHub } from "./hub";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/tasks.md, T11
// "Done when" (EST-02 / AD-001) --
//  - Ordem fixa: Estratégia, PLL, Coalizão, Visão Gerencial, Números de
//    Impacto, Gestão de Usuários (AC6)
//  - Consulta negada por permissão -> card omitido; erro de outra natureza
//    -> propaga (AC2, AC7)
//  - tipo: 'produto' | 'ferramenta' correto por card
//  - Contagens de mandatos ativos e fatos geradores vêm da consulta, nunca
//    fixas (AC3, AC4)
//
// Mock roteado por nome de tabela, mesmo padrão de queries/kanban.test.ts e
// queries/prospeccao.test.ts, estendido com `.limit()`/`.maybeSingle()` e
// `client.auth.getUser()`.

type Chamada = { tabela: string; metodo: string; args: unknown[] };
type RespostaTabela = { data: unknown; error: { code?: string; message?: string } | null; count?: number | null };

function criarClienteMock(
  respostasPorTabela: Record<string, RespostaTabela>,
  emailAutenticado: string | null = "gestora@legislabrasil.org"
) {
  const chamadas: Chamada[] = [];

  function criarBuilder(tabela: string) {
    const resposta = respostasPorTabela[tabela] ?? { data: null, error: null };
    const builder: Record<string, unknown> = {
      select: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "select", args });
        return builder;
      },
      eq: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "eq", args });
        return builder;
      },
      limit: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "limit", args });
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
    auth: {
      getUser: () => Promise.resolve({ data: { user: emailAutenticado ? { email: emailAutenticado } : null } }),
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

const REF_PRODUTO_ESTRATEGIA = { id_produto: 1 };
const ADMIN = { papel_global: "admin" };
const GESTORA = { papel_global: "gestora" };

// Respostas de "tudo permitido, Admin" -- ponto de partida de quase todo teste.
function respostasTudoPermitido(overrides: Record<string, RespostaTabela> = {}): Record<string, RespostaTabela> {
  return {
    ref_produto: { data: [REF_PRODUTO_ESTRATEGIA], error: null },
    fat_contrato: { data: null, error: null, count: 4 },
    dim_usuario: { data: ADMIN, error: null },
    mv_avaliacao_nps: { data: [], error: null },
    mv_numeros_impacto: { data: [], error: null },
    fat_fato_gerador: { data: null, error: null, count: 7 },
    ...overrides,
  };
}

describe("buscarCardsHub", () => {
  // Done-when: "Ordem fixa: Estratégia, PLL, Coalizão, Visão Gerencial,
  // Números de Impacto, Gestão de Usuários (AC6)"
  it("devolve os 6 cards na ordem fixa quando nada é negado (Admin)", async () => {
    const { client } = criarClienteMock(respostasTudoPermitido());

    const resultado = await buscarCardsHub(client);

    expect(resultado.map((c) => c.titulo)).toEqual([
      "Estratégia",
      "PLL",
      "Coalizão",
      "Visão Gerencial",
      "Números de Impacto",
      "Gestão de Usuários",
    ]);
  });

  // Done-when: "tipo: 'produto' | 'ferramenta' correto por card"
  it("marca tipo 'produto' para os 3 produtos e 'ferramenta' para as 3 ferramentas", async () => {
    const { client } = criarClienteMock(respostasTudoPermitido());

    const resultado = await buscarCardsHub(client);

    const tipos = Object.fromEntries(resultado.map((c) => [c.titulo, c.tipo]));
    expect(tipos["Estratégia"]).toBe("produto");
    expect(tipos["PLL"]).toBe("produto");
    expect(tipos["Coalizão"]).toBe("produto");
    expect(tipos["Visão Gerencial"]).toBe("ferramenta");
    expect(tipos["Números de Impacto"]).toBe("ferramenta");
    expect(tipos["Gestão de Usuários"]).toBe("ferramenta");
  });

  // Done-when: "Contagens de mandatos ativos e fatos geradores vêm da
  // consulta, nunca fixas (AC3, AC4)"
  it("badge de Estratégia e de Números de Impacto refletem a contagem da consulta", async () => {
    const { client } = criarClienteMock(respostasTudoPermitido({ fat_contrato: { data: null, error: null, count: 4 }, fat_fato_gerador: { data: null, error: null, count: 7 } }));

    const resultado = await buscarCardsHub(client);

    expect(resultado.find((c) => c.titulo === "Estratégia")?.badge).toBe("4");
    expect(resultado.find((c) => c.titulo === "Números de Impacto")?.badge).toBe("7");
  });

  it("badge muda quando a contagem retornada pela consulta muda (nunca fixa)", async () => {
    const { client } = criarClienteMock(respostasTudoPermitido({ fat_contrato: { data: null, error: null, count: 99 }, fat_fato_gerador: { data: null, error: null, count: 0 } }));

    const resultado = await buscarCardsHub(client);

    expect(resultado.find((c) => c.titulo === "Estratégia")?.badge).toBe("99");
    expect(resultado.find((c) => c.titulo === "Números de Impacto")?.badge).toBe("0");
  });

  // Done-when: "Consulta negada por permissão -> card omitido (AC2)" --
  // mv_avaliacao_nps 42501 (Mentor/Assessor, AD-036) omite Visão Gerencial,
  // sem afetar os demais.
  it("mv_avaliacao_nps negada (42501) omite só o card Visão Gerencial", async () => {
    const { client } = criarClienteMock(
      respostasTudoPermitido({
        mv_avaliacao_nps: { data: null, error: { code: "42501", message: "permission denied for materialized view mv_avaliacao_nps" } },
      })
    );

    const resultado = await buscarCardsHub(client);

    expect(resultado.map((c) => c.titulo)).toEqual(["Estratégia", "PLL", "Coalizão", "Números de Impacto", "Gestão de Usuários"]);
  });

  // Done-when: "Consulta negada por permissão -> card omitido (AC2)" --
  // mv_numeros_impacto 42501 omite Números de Impacto.
  it("mv_numeros_impacto negada (42501) omite só o card Números de Impacto", async () => {
    const { client } = criarClienteMock(
      respostasTudoPermitido({
        mv_numeros_impacto: { data: null, error: { code: "42501", message: "permission denied for materialized view mv_numeros_impacto" } },
      })
    );

    const resultado = await buscarCardsHub(client);

    expect(resultado.map((c) => c.titulo)).toEqual(["Estratégia", "PLL", "Coalizão", "Visão Gerencial", "Gestão de Usuários"]);
  });

  // Done-when: "Consulta negada por permissão -> card omitido (AC7)" --
  // usuária não-Admin não vê "Gestão de Usuários".
  it("usuária Gestora (não-Admin) não vê o card Gestão de Usuários", async () => {
    const { client } = criarClienteMock(respostasTudoPermitido({ dim_usuario: { data: GESTORA, error: null } }));

    const resultado = await buscarCardsHub(client);

    expect(resultado.map((c) => c.titulo)).toEqual(["Estratégia", "PLL", "Coalizão", "Visão Gerencial", "Números de Impacto"]);
  });

  // Done-when: "erro de outra natureza -> propaga (AC2, AC7)"
  it("erro que não é 42501 propaga como throw, em vez de omitir o card", async () => {
    const { client } = criarClienteMock(
      respostasTudoPermitido({
        mv_avaliacao_nps: { data: null, error: { message: "connection reset" } },
      })
    );

    await expect(buscarCardsHub(client)).rejects.toEqual({ message: "connection reset" });
  });
});
