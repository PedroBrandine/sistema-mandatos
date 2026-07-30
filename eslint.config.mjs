// Root ESLint config -- covers src/backend/** (plain TS, no React/Next),
// supabase/tests/** and other root-level TS (vitest configs, test helpers).
// src/frontend/** has its own eslint.config.mjs (next/core-web-vitals rules,
// irrelevant to backend/Postgres-facing code) and is linted separately via
// `npm run lint --workspace=frontend` -- see the root "lint" script.
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["src/frontend/**", "node_modules/**", "supabase/.temp/**"],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Test helpers/fixtures intentionally use `any` in a few spots
      // (raw SQL query result rows); not worth a stricter rule here.
      "@typescript-eslint/no-explicit-any": "off",
    },
  }
);
