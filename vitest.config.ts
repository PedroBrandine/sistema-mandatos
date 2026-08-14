import { defineConfig } from "vitest/config";

// Unit tests: no network, no Supabase — pure functions, Zod schemas, mocked clients.
// `src/frontend/**/*.test.ts` (não `.test.tsx`) entrou junto com
// planejamento-estrategico-redesenho/T1-T2: utilitários puros colocados ao lado do
// consumidor de frontend (permissoes.ts, planejamento-formato.ts), sem React/harness de
// componente (débito L-006/L-007 permanece — `.test.tsx` continua fora deste include).
export default defineConfig({
  test: {
    include: ["src/backend/**/*.test.ts", "src/frontend/**/*.test.ts"],
    environment: "node",
    passWithNoTests: true,
  },
});
