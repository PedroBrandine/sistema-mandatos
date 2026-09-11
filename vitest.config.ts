import path from "node:path";

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
// resolve.alias replica verbatim os `paths` de src/frontend/tsconfig.json --
// achado real de redesenho-estrategia-tela-first/T10 (Batch 3): o smoke test
// de T1 (AD-042) só exercitava estado-vazio.tsx, que não importa nada por
// alias, então o gap ficou invisível até o 1º teste de componente que
// importa "@/lib/utils" (topbar.tsx). Sem isso, Vite não resolve os aliases
// que Next.js resolve em build via tsconfig -- todo `.test.tsx` que importe
// um componente com "@/..." ou "@backend/..." falhava na collect, não no
// assert.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/frontend"),
      "@backend": path.resolve(__dirname, "src/backend"),
    },
  },
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
