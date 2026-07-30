import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import path from "node:path";

// This app lives at src/frontend inside the sistema-mandatos monorepo, which
// has its own root-level package-lock.json (for the Vitest/Supabase test
// suite -- see T9). Next.js's root inference picks that outer lockfile up
// and warns; pinning `turbopack.root` to this app's own directory silences
// the warning and keeps file tracing/workspace resolution scoped correctly.
const nextConfig: NextConfig = {
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
};

export default nextConfig;
