import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

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

// Exportado como função pra poder ligar uma opção SÓ na fase de dev (formato
// documentado em node_modules/next/dist/docs/01-app/03-api-reference/05-config/
// 01-next-config-js/index.md, "Configuration as a Function"). A checagem é por
// **fase**, não por NODE_ENV: `experimental.workerThreads` também é lido pelo
// build (next/dist/build/index.js), e o Preview da Vercel builda com
// NODE_ENV=production mas nem por isso deixa de ser build -- amarrar na fase é
// o que garante que nada disto alcance `next build`.
export default function config(phase: string): NextConfig {
  if (phase !== PHASE_DEVELOPMENT_SERVER) {
    return nextConfig;
  }

  return {
    ...nextConfig,
    experimental: {
      ...nextConfig.experimental,
      // Faz o worker de generateStaticParams rodar em worker_thread em vez de
      // processo filho (next/dist/server/dev/next-dev-server.js:111 ->
      // `enableWorkerThreads`). Duas razões, nesta ordem:
      //
      // 1. Correção de bug. Em dev o Next dá fork() de um processo Node novo a
      //    CADA request de rota dinâmica (base-server.js:1365 -- vale pra toda
      //    rota dinâmica, tenha ela generateStaticParams ou não; este projeto
      //    não tem nenhum). Quando o console do terminal que rodou `npm run
      //    dev` morre -- aba do VS Code fechada, janela recarregada, máquina
      //    suspensa --, todo filho que herda esse console morre no loader do
      //    Windows com 0xC0000142 (STATUS_DLL_INIT_FAILED), antes de o Node
      //    começar e portanto sem escrever nada em stderr. O jest-worker só vê
      //    exit code != 0, tenta uma vez e cospe "Jest worker encountered 2
      //    child process exceptions, exceeding retry limit" -- stack inteiro
      //    dentro de node_modules, zero pista. Resultado: TODA rota dinâmica
      //    vira 500 enquanto as estáticas seguem em 200. Thread não é processo
      //    novo, não herda console e não tem esse modo de falha (medido: no
      //    mesmo processo doente, fork/spawn = 0xC0000142, worker_threads = ok).
      // 2. É trabalho que aqui nunca serviu pra nada -- sem nenhum
      //    generateStaticParams no projeto, o processo subia só pra responder
      //    "não há caminho estático".
      //
      // Investigação completa em .specs/features/dev-server-rotas-dinamicas-500/.
      workerThreads: true,
    },
  };
}
