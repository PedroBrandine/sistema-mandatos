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

/**
 * Caminho LOCAL: conexão direta via `pg`.
 *
 * Não é otimização -- é necessidade. Os testes de constraint asseveram sobre o
 * SQLSTATE (`23514`, `23505`, `MDU01`…), e esse código só aparece na saída do
 * `db query --linked` porque a Management API devolve o erro estruturado. O
 * CLI local imprime apenas o texto do Postgres ("violates check constraint
 * ..."), sem o código -- então toda asserção de constraint falhava em CI.
 * O driver `pg` expõe o SQLSTATE em `err.code`.
 *
 * De quebra, elimina o spawn de um processo por consulta, que era o que fazia
 * a suíte demorar dezenas de minutos.
 *
 * SUPABASE_DB_URL é gerada no workflow a partir de `supabase status -o env`.
 */
async function runSqlLocal<T>(sql: string): Promise<T[]> {
  const { default: pg } = await import("pg");

  // A Management API serializa todo número como string no JSON de resposta, e
  // é sobre esse formato que as asserções foram escritas (`toEqual(['11'])`).
  // O driver `pg` converte int2/int4 para Number por padrão -- int8 e numeric
  // ele já devolve como string. Alinhar os dois evita reescrever os testes e
  // mantém um único conjunto de asserções válido nos dois alvos.
  pg.types.setTypeParser(pg.types.builtins.INT2, (v) => v);
  pg.types.setTypeParser(pg.types.builtins.INT4, (v) => v);

  const client = new pg.Client({
    connectionString:
      process.env.SUPABASE_DB_URL ??
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  });
  await client.connect();
  try {
    const resultado = await client.query(sql);
    // Múltiplos statements devolvem um array de resultados; as chamadas deste
    // helper esperam as linhas do último comando que produziu linhas.
    const resultados = Array.isArray(resultado) ? resultado : [resultado];
    const comLinhas = [...resultados].reverse().find((r) => r?.rows?.length);
    return ((comLinhas ?? resultados[resultados.length - 1])?.rows ?? []) as T[];
  } catch (error) {
    // Dobra o SQLSTATE na mensagem, no mesmo formato que os testes esperam
    // encontrar quando rodam contra o projeto remoto.
    const codigo = (error as { code?: string }).code;
    const mensagem = error instanceof Error ? error.message : String(error);
    throw new Error(codigo ? `${codigo}: ${mensagem}` : mensagem);
  } finally {
    await client.end();
  }
}

export async function runSql<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  if (TARGET_FLAG === "--local") return runSqlLocal<T>(sql);

  const file = join(tmpdir(), `sistema-mandatos-test-${randomUUID()}.sql`);
  await writeFile(file, sql, "utf8");
  try {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const { stdout } = await execFileAsync(
          SUPABASE_BIN,
          // `--output-format json` é obrigatório: com `--linked` o CLI já
          // devolve JSON por padrão, mas com `--local` ele imprime uma tabela
          // ASCII e o JSON.parse abaixo estoura com
          // `Unexpected token '┌'`. Explicitar deixa os dois alvos iguais.
          ["db", "query", TARGET_FLAG, "--output-format", "json", "--file", file],
          // shell is required to spawn the `.cmd` shim on Windows; safe here
          // because the only interpolated argument is a temp-file path (no
          // SQL text reaches the shell command line at all).
          { maxBuffer: 10 * 1024 * 1024, shell: true }
        );
        // Os dois alvos devolvem JSON, mas com formatos diferentes:
        //   --linked : {"boundary": ..., "rows": [...], "warning": ...}
        //   --local  : [...]  (array puro)
        const parsed = JSON.parse(stdout);
        const rows = Array.isArray(parsed) ? parsed : parsed.rows;
        if (rows === undefined) {
          throw new Error(`Unexpected supabase db query output: ${stdout}`);
        }
        return rows as T[];
      } catch (error) {
        // execFile's rejection carries the actual Postgres error (ERRCODE
        // included) in `.stdout` -- Node's default `.message` is just the
        // generic "Command failed: <cmd>", which never contains the SQL error
        // text. Callers that assert on error content (e.g.
        // `error.message.toContain('23514')`, usado em todo teste de
        // CHECK/UNIQUE) precisam desse texto dobrado no `.message`, senão a
        // asserção falha independentemente de a constraint ter disparado.
        //
        // Onde o texto aparece depende do alvo: com `--linked` o erro do
        // Postgres volta no stdout (é o corpo da resposta da Management API);
        // com `--local` o CLI o escreve no stderr. Ler os dois deixa o
        // comportamento igual nos dois ambientes -- ler só stdout fazia todos
        // os testes de constraint falharem em CI com "expected '...' to
        // contain '23505'".
        const { stdout, stderr } = error as { stdout?: unknown; stderr?: unknown };
        const stdoutStr = [stdout, stderr]
          .filter((s): s is string => typeof s === "string" && s.length > 0)
          .join("\n");
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
