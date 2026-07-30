import { defineConfig } from "vitest/config";

// Unit tests: no network, no Supabase — pure functions, Zod schemas, mocked clients.
export default defineConfig({
  test: {
    include: ["src/backend/**/*.test.ts"],
    environment: "node",
    passWithNoTests: true,
  },
});
