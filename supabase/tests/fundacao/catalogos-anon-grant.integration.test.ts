import { describe, it, expect } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: achado da Trilha C (.specs/features/catalogos-referencia/) --
// migration 20260810183759_revoke_anon_grant_ref_tables.sql revoga o SELECT a
// `anon` que 0024_ref_tables_rls_fix.sql concedeu nos 4 catálogos ref_*
// existentes, contradizendo AD-002 e a Regra Inegociável nº4 da Constituição
// ("nenhum acesso é anônimo"). `authenticated` continua podendo ler --
// catálogo é dado de referência, não RLS -- só o acesso sem sessão é negado.

const TABELAS = ["ref_cargo", "ref_partido", "ref_produto", "ref_projeto"];

describe("Catálogos ref_* -- GRANT (AD-002 / AD-030)", () => {
  it.each(TABELAS)("anon NÃO tem SELECT em %s", async (tabela) => {
    const rows = await runSql<{ can_select: boolean }>(`
      SELECT has_table_privilege('anon', '${tabela}', 'SELECT') AS can_select;
    `);
    expect(rows[0].can_select).toBe(false);
  });

  it.each(TABELAS)("authenticated continua com SELECT em %s (sem regressão)", async (tabela) => {
    const rows = await runSql<{ can_select: boolean }>(`
      SELECT has_table_privilege('authenticated', '${tabela}', 'SELECT') AS can_select;
    `);
    expect(rows[0].can_select).toBe(true);
  });
});
