import { describe, expect, it } from "vitest";

import { isPublicRoute } from "./proxy";

// Achado do Verifier independente (rodada 2, validation.md): sem este
// teste, remover qualquer entrada da allowlist (inclusive o /convite do
// Fix 1, Blocker) passa a suíte inteira sem nenhum sinal -- é o único ponto
// do sistema onde "rota pré-sessão nova" pode ser esquecida em silêncio
// (AD-002/AD-033, lição L-009).
describe("isPublicRoute", () => {
  it("libera /login, /auth, /admin/acesso e /convite (e suas sub-rotas)", () => {
    for (const pathname of [
      "/login",
      "/auth/confirm",
      "/admin/acesso",
      "/admin/acesso/entrar",
      "/convite/abc123",
      "/convite/abc123/consumir",
    ]) {
      expect(isPublicRoute(pathname)).toBe(true);
    }
  });

  it("nega qualquer outra rota (AD-002 -- nenhum acesso anônimo por padrão)", () => {
    for (const pathname of ["/", "/mandatos", "/contratos/1", "/usuarios", "/visao-gerencial"]) {
      expect(isPublicRoute(pathname)).toBe(false);
    }
  });
});
