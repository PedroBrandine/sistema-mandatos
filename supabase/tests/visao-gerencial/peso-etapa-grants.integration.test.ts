import { describe, it, expect } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/visao-gerencial-g1-g2/tasks.md T2 Done-when
// (GG-02, AD-030) -- migração:
// 20260812174955_visao_gerencial_peso_etapa_grants.sql.
//
// Mesmo mecanismo de supabase/tests/catalogos/catalogos-referencia-grants.integration.test.ts:
// has_table_privilege() via SQL direto, sem sessão JWT por papel -- correto
// aqui porque o controle de acesso é GRANT, não RLS (não há policy pra testar
// via login real).

const ROLES_LEITURA = ["authenticated", "legisla_app", "legisla_admin", "legisla_gestora", "legisla_mentor", "legisla_assessor"];
const ROLES_ESCRITA = ["legisla_app", "legisla_admin", "legisla_gestora"];
const ROLES_SO_LEITURA = ["legisla_mentor", "legisla_assessor"];

describe("visao-gerencial-g1-g2 T2 -- GRANT/RLS-disable em ref_peso_etapa (GG-02, AD-030)", () => {
  it("authenticated + as 5 roles legisla_* têm SELECT", async () => {
    const rows = await runSql<{ role: string; can_select: boolean }>(`
      SELECT role, has_table_privilege(role, 'ref_peso_etapa', 'SELECT') AS can_select
        FROM unnest(ARRAY[${ROLES_LEITURA.map((r) => `'${r}'`).join(",")}]) AS role;
    `);
    expect(rows).toHaveLength(ROLES_LEITURA.length);
    for (const row of rows) {
      expect(row.can_select, `${row.role} deveria ter SELECT em ref_peso_etapa`).toBe(true);
    }
  });

  it("anon NÃO tem SELECT/INSERT/UPDATE/DELETE (nenhum acesso anônimo, AD-002)", async () => {
    const rows = await runSql<{
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>(`
      SELECT has_table_privilege('anon', 'ref_peso_etapa', 'SELECT') AS can_select,
             has_table_privilege('anon', 'ref_peso_etapa', 'INSERT') AS can_insert,
             has_table_privilege('anon', 'ref_peso_etapa', 'UPDATE') AS can_update,
             has_table_privilege('anon', 'ref_peso_etapa', 'DELETE') AS can_delete;
    `);
    expect(rows[0].can_select).toBe(false);
    expect(rows[0].can_insert).toBe(false);
    expect(rows[0].can_update).toBe(false);
    expect(rows[0].can_delete).toBe(false);
  });

  it("authenticated NÃO tem INSERT/UPDATE/DELETE (defesa em profundidade)", async () => {
    const rows = await runSql<{
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>(`
      SELECT has_table_privilege('authenticated', 'ref_peso_etapa', 'INSERT') AS can_insert,
             has_table_privilege('authenticated', 'ref_peso_etapa', 'UPDATE') AS can_update,
             has_table_privilege('authenticated', 'ref_peso_etapa', 'DELETE') AS can_delete;
    `);
    expect(rows[0].can_insert).toBe(false);
    expect(rows[0].can_update).toBe(false);
    expect(rows[0].can_delete).toBe(false);
  });

  it("legisla_mentor e legisla_assessor NÃO têm INSERT/UPDATE/DELETE", async () => {
    const rows = await runSql<{
      role: string;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>(`
      SELECT role,
             has_table_privilege(role, 'ref_peso_etapa', 'INSERT') AS can_insert,
             has_table_privilege(role, 'ref_peso_etapa', 'UPDATE') AS can_update,
             has_table_privilege(role, 'ref_peso_etapa', 'DELETE') AS can_delete
        FROM unnest(ARRAY[${ROLES_SO_LEITURA.map((r) => `'${r}'`).join(",")}]) AS role;
    `);
    expect(rows).toHaveLength(ROLES_SO_LEITURA.length);
    for (const row of rows) {
      expect(row.can_insert, `${row.role} não deveria ter INSERT`).toBe(false);
      expect(row.can_update, `${row.role} não deveria ter UPDATE`).toBe(false);
      expect(row.can_delete, `${row.role} não deveria ter DELETE`).toBe(false);
    }
  });

  it("legisla_app/legisla_admin/legisla_gestora têm INSERT/UPDATE/DELETE (re-GRANT AD-025)", async () => {
    const rows = await runSql<{
      role: string;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>(`
      SELECT role,
             has_table_privilege(role, 'ref_peso_etapa', 'INSERT') AS can_insert,
             has_table_privilege(role, 'ref_peso_etapa', 'UPDATE') AS can_update,
             has_table_privilege(role, 'ref_peso_etapa', 'DELETE') AS can_delete
        FROM unnest(ARRAY[${ROLES_ESCRITA.map((r) => `'${r}'`).join(",")}]) AS role;
    `);
    expect(rows).toHaveLength(ROLES_ESCRITA.length);
    for (const row of rows) {
      expect(row.can_insert, `${row.role} deveria ter INSERT`).toBe(true);
      expect(row.can_update, `${row.role} deveria ter UPDATE`).toBe(true);
      expect(row.can_delete, `${row.role} deveria ter DELETE`).toBe(true);
    }
  });

  it("RLS está desabilitada (não FORCE, não ENABLE) -- exceção AD-030", async () => {
    const rows = await runSql<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
      SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'ref_peso_etapa';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].relrowsecurity).toBe(false);
    expect(rows[0].relforcerowsecurity).toBe(false);
  });
});
