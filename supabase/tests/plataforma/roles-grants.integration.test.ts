import { describe, it, expect } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: T3 Done-when --
//  - Os 5 ROLES existem (CREATE ROLE ... NOLOGIN idempotente)
//  - GRANTs aplicados exatamente como especificado no schema aprovado
//    (escopado ao que já existe -- ver SPEC_DEVIATION em
//    0004_plataforma_roles_grants.sql)
//  - authenticator tem membership nos 5 papéis

const ROLES = ["legisla_app", "legisla_admin", "legisla_gestora", "legisla_mentor", "legisla_assessor"];

describe("Plataforma roles and grants", () => {
  it("creates all 5 legisla_* roles as NOLOGIN", async () => {
    const rows = await runSql<{ rolname: string; rolcanlogin: boolean }>(`
      SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname = ANY(ARRAY[${ROLES.map((r) => `'${r}'`).join(",")}]);
    `);
    expect(rows.map((r) => r.rolname).sort()).toEqual([...ROLES].sort());
    for (const row of rows) {
      expect(row.rolcanlogin).toBe(false);
    }
  });

  it("grants authenticator membership in all 5 roles", async () => {
    const rows = await runSql<{ rolname: string; is_member: boolean }>(`
      SELECT r.rolname, pg_has_role('authenticator', r.rolname, 'member') AS is_member
        FROM pg_roles r
       WHERE r.rolname = ANY(ARRAY[${ROLES.map((r) => `'${r}'`).join(",")}]);
    `);
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row.is_member).toBe(true);
    }
  });

  it("grants legisla_app/admin/gestora full read-write on dim_usuario (ALL TABLES IN SCHEMA public)", async () => {
    const rows = await runSql<{ role: string; can_select: boolean; can_insert: boolean }>(`
      SELECT role, has_table_privilege(role, 'dim_usuario', 'SELECT') AS can_select,
             has_table_privilege(role, 'dim_usuario', 'INSERT') AS can_insert
        FROM unnest(ARRAY['legisla_app', 'legisla_admin', 'legisla_gestora']) AS role;
    `);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.can_select).toBe(true);
      expect(row.can_insert).toBe(true);
    }
  });

  it("grants legisla_mentor SELECT (but not INSERT) on dim_usuario", async () => {
    const rows = await runSql<{ can_select: boolean; can_insert: boolean }>(`
      SELECT has_table_privilege('legisla_mentor', 'dim_usuario', 'SELECT') AS can_select,
             has_table_privilege('legisla_mentor', 'dim_usuario', 'INSERT') AS can_insert;
    `);
    expect(rows[0].can_select).toBe(true);
    expect(rows[0].can_insert).toBe(false);
  });

  it("does not grant legisla_assessor any privilege on dim_usuario", async () => {
    const rows = await runSql<{ can_select: boolean }>(`
      SELECT has_table_privilege('legisla_assessor', 'dim_usuario', 'SELECT') AS can_select;
    `);
    expect(rows[0].can_select).toBe(false);
  });

  it("grants all 5 roles their own explicit EXECUTE ACL entry on app.papel_atual()", async () => {
    // has_function_privilege() would also return true from the default PUBLIC
    // grant Postgres adds on function creation (unrelated to T3's GRANT
    // statement), so it can't discriminate whether T3 actually ran. Reading
    // the ACL text directly proves a *role-specific* grant entry exists.
    const rows = await runSql<{ proacl: string }>(`
      SELECT proacl::text AS proacl FROM pg_proc
       WHERE proname = 'papel_atual' AND pronamespace = 'app'::regnamespace;
    `);
    expect(rows).toHaveLength(1);
    for (const role of ROLES) {
      expect(rows[0].proacl).toContain(`${role}=X/`);
    }
  });
});
