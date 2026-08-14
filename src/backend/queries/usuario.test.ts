import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarPapelGlobalAtual } from "./usuario";

// Spec anchor: .specs/features/visao-gerencial-g3-g6/spec.md GER-01 +
// tasks.md T8 Done-when.
//  - usuário sem dim_usuario correspondente retorna null
//  - papel correto é devolvido pros 4 valores possíveis

function criarClienteMock(emailAutenticado: string | null, papelGlobal: string | null) {
  const client = {
    auth: {
      getUser: () => Promise.resolve({ data: { user: emailAutenticado ? { email: emailAutenticado } : null } }),
    },
    from: (_tabela: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: papelGlobal ? { papel_global: papelGlobal } : null,
              error: null,
            }),
        }),
      }),
    }),
  };
  return client as unknown as SupabaseClient<Database>;
}

describe("buscarPapelGlobalAtual", () => {
  it("usuário sem sessão (auth.getUser sem email) retorna null", async () => {
    const client = criarClienteMock(null, null);
    expect(await buscarPapelGlobalAtual(client)).toBeNull();
  });

  it("usuário autenticado sem linha correspondente em dim_usuario retorna null", async () => {
    const client = criarClienteMock("sem-cadastro@legislabrasil.org", null);
    expect(await buscarPapelGlobalAtual(client)).toBeNull();
  });

  it.each(["admin", "gestora", "mentor", "assessor"] as const)(
    "devolve papel_global = %s quando dim_usuario tem a linha",
    async (papel) => {
      const client = criarClienteMock("usuario@legislabrasil.org", papel);
      expect(await buscarPapelGlobalAtual(client)).toBe(papel);
    }
  );
});
