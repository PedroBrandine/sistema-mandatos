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
// file sporadically fail with no useful stderr). A couple of short retries
// makes the suite reliable without masking a real, persistent SQL error
// (which fails identically on every attempt and still surfaces after retries
// are exhausted).
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

export async function runSql<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const file = join(tmpdir(), `sistema-mandatos-test-${randomUUID()}.sql`);
  await writeFile(file, sql, "utf8");
  try {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const { stdout } = await execFileAsync(
          SUPABASE_BIN,
          ["db", "query", "--linked", "--file", file],
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
        lastError = error;
        if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
      }
    }
    throw lastError;
  } finally {
    await unlink(file).catch(() => undefined);
  }
}
