import { defineConfig } from "vitest/config";

// Unit tests: no network, no Supabase — pure functions, Zod schemas, mocked clients.
// `src/frontend/**/*.test.ts` (não `.test.tsx`) entrou junto com
// planejamento-estrategico-redesenho/T1-T2: utilitários puros colocados ao lado do
// consumidor de frontend (permissoes.ts, planejamento-formato.ts), sem React/harness de
// componente.
//
// `.test.tsx` entrou com redesenho-estrategia-tela-first/T1 (AD-042): testes de
// componente React rodam em `jsdom` via `environmentMatchGlobs` (API do Vitest 2.x),
// enquanto todo `.test.ts` permanece em `node` — o ambiente é escolhido por arquivo,
// não globalmente.
export default defineConfig({
  test: {
    include: [
      "src/backend/**/*.test.ts",
      "src/frontend/**/*.test.ts",
      "src/frontend/**/*.test.tsx",
    ],
    environment: "node",
    environmentMatchGlobs: [["src/frontend/**/*.test.tsx", "jsdom"]],
    passWithNoTests: true,
  },
});
