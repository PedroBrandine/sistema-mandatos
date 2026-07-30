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
const nextConfig: NextConfig = {};

export default nextConfig;
