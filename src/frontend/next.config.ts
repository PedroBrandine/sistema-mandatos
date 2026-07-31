import type { NextConfig } from "next";

// This app lives at src/frontend as an npm workspace member of the
// sistema-mandatos monorepo (see root package.json's `workspaces` field --
// T8 needs src/backend/** importable from here, which requires a single
// hoisted node_modules shared by both). With one root-level lockfile,
// Next's automatic workspace-root inference resolves correctly on its own;
// no turbopack.root override needed (an earlier one, pinned to this
// directory, was removed here -- it predates the workspace conversion and
// broke resolution once next itself moved to the hoisted root
// node_modules).
const nextConfig: NextConfig = {
  // Dev-only: Next.js 16 blocks cross-origin requests to dev assets by
  // default (hostname the server was started with -- "localhost" -- is the
  // only one allowed otherwise). Testing the magic-link login from another
  // device on the LAN hits the server via its network IP, which is a
  // different origin and silently breaks hydration (the page still renders,
  // but the JS bundle 403s, so the login form falls back to a native HTML
  // GET submit instead of calling signInWithOtp). No effect on production
  // builds/`next start`.
  allowedDevOrigins: ["192.168.15.9"],
};

export default nextConfig;
