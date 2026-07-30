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
    // Integration tests shell out to `supabase db query --linked`, which
    // spawns a nested native binary per call. Running test *files* in
    // parallel (Vitest's default) was observed to overwhelm process
    // spawning / the Management API under concurrent load -- transient
    // command failures, and once an outright CLI process crash. Serializing
    // files trades speed for reliability, appropriate for tests hitting a
    // shared live external resource.
    fileParallelism: false,
  },
});
