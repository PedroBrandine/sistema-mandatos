import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const execFileAsync = promisify(execFile);

// On Windows, the globally-installed `supabase` CLI resolves to a `.cmd`
// shim; Node can spawn it directly (no shell) once the extension is explicit.
const SUPABASE_BIN = process.platform === "win32" ? "supabase.cmd" : "supabase";

// Alvo do `db query`: por padrão o projeto cloud linkado (é o único caminho
// disponível na máquina de desenvolvimento, que não tem Docker). Em CI, onde
// o runner sobe um stack local efêmero via `supabase start`, defina
// SUPABASE_TEST_TARGET=local para que os testes rodem contra esse banco --
// muito mais rápido e sem PRs concorrentes disputando o mesmo projeto.
const TARGET_FLAG = process.env.SUPABASE_TEST_TARGET === "local" ? "--local" : "--linked";

/**
 * Runs raw SQL against the linked remote Supabase project via
 * `supabase db query --linked --file <tmp>` (Management API), returning the
 * result rows.
 *
 * Why a temp file instead of passing SQL inline: there is no local Docker
 * stack (no `supabase start`) and no raw Postgres password available to this
 * environment, so a direct `pg` client connection isn't possible -- `db
 * query --linked` is the only channel available for asserting on Postgres
 * function/RLS/GRANT behavior directly. Passing multi-line, quote-heavy SQL
 * as a CLI argument is unreliable cross-shell (quoting differs completely
 * between POSIX shells and cmd.exe); writing it to a temp file and using
 * `--file` sidesteps all argument-quoting entirely.
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The Management API backing `db query --linked` occasionally rejects a
// request transiently (observed: back-to-back calls within the same test
// file sporadically fail with no useful stderr, and -- during this batch's
// combined Phase 0 run -- an outright Cloudflare 502 from api.supabase.com
// with "retryable": true). A few retries with exponential backoff makes the
// suite reliable without masking a real, persistent SQL error (which fails
// identically on every attempt and still surfaces after retries are
// exhausted).
// Contra o banco LOCAL não existe rede, Management API nem Cloudflare no
// caminho -- não há falha transitória a absorver, e todo erro é
// determinístico. Repetir ali é puro desperdício: cada teste que *espera* um
// erro de SQL (todos os de CHECK/UNIQUE, dezenas deles) pagaria 14s de sleep
// e estouraria o testTimeout de 30s. Foi exatamente o que aconteceu na
// primeira execução do CI em 06/08/2026: a suíte passou de 22 min (cloud)
// para 37+ min sem terminar. Local roda sem retry.
const MAX_ATTEMPTS = TARGET_FLAG === "--local" ? 1 : 4;
const RETRY_BASE_DELAY_MS = 2000;

export async function runSql<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const file = join(tmpdir(), `sistema-mandatos-test-${randomUUID()}.sql`);
  await writeFile(file, sql, "utf8");
  try {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const { stdout } = await execFileAsync(
          SUPABASE_BIN,
          ["db", "query", TARGET_FLAG, "--file", file],
          // shell is required to spawn the `.cmd` shim on Windows; safe here
          // because the only interpolated argument is a temp-file path (no
          // SQL text reaches the shell command line at all).
          { maxBuffer: 10 * 1024 * 1024, shell: true }
        );
        const parsed = JSON.parse(stdout);
        if (parsed.rows === undefined) {
          throw new Error(`Unexpected supabase db query output: ${stdout}`);
        }
        return parsed.rows as T[];
      } catch (error) {
        // execFile's rejection carries the actual Postgres error (ERRCODE
        // included) in `.stdout` -- Node's default `.message` is just the
        // generic "Command failed: <cmd>" (stderr-derived), which never
        // contains the SQL error text. Callers that assert on error content
        // (e.g. `error.message.toContain('23514')`, used across every
        // CHECK/UNIQUE constraint test in this feature) need `.stdout`
        // folded into `.message`, or every such assertion silently fails
        // regardless of whether the constraint actually fired.
        const stdout = (error as { stdout?: unknown }).stdout;
        const stdoutStr = typeof stdout === "string" ? stdout : "";
        lastError = stdoutStr
          ? new Error(`${error instanceof Error ? error.message : String(error)}\n${stdoutStr}`)
          : error;

        // "unexpected status 400" means the Management API reached Postgres
        // and Postgres itself rejected the SQL (e.g. a CHECK/UNIQUE
        // violation) -- deterministic, not transient. Retrying it 4x with
        // exponential backoff (~14s of sleep alone, on top of ~4 real round
        // trips) only wastes time and risks tripping the 30s test timeout
        // for tests that assert a query is *expected* to fail (every
        // CHECK/UNIQUE constraint test in this feature does this). Only
        // genuinely transient failures (Cloudflare 502s, connection resets,
        // CLI/process errors -- none of which carry "status 400") should be
        // retried.
        const isDeterministicSqlError = stdoutStr.includes("unexpected status 400");
        if (isDeterministicSqlError) {
          throw lastError;
        }
        if (attempt < MAX_ATTEMPTS) await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }
    throw lastError;
  } finally {
    await unlink(file).catch(() => undefined);
  }
}
