import { defineConfig } from "vitest/config";

// Integration tests: hit the live Supabase dev project (PostgREST + Auth).
// No local Docker stack — see supabase/tests/README.md for environment setup.
export default defineConfig({
  test: {
    include: ["supabase/tests/**/*.integration.test.ts"],
    environment: "node",
    setupFiles: ["./supabase/tests/setup-env.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    passWithNoTests: true,
  },
});
