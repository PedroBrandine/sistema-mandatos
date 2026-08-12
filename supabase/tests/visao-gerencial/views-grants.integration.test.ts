import { describe, it, expect } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/visao-gerencial-g1-g2/tasks.md T7 Done-when
// (GG-01, GG-03, GG-05) -- migração:
// 20260812181238_visao_gerencial_views_grants.sql.
//
//  - legisla_app/admin/gestora têm SELECT nas 3 views (via re-GRANT em bloco)
//  - legisla_mentor/assessor têm SELECT explícito nas 3 views
//  - Teste de integração cobre os 5 papéis × 3 views (has_table_privilege)

const VIEWS = ["vw_carteira", "vw_carteira_ponderada", "vw_ciclo_etapa"];
const ROLES = ["legisla_app", "legisla_admin", "legisla_gestora", "legisla_mentor", "legisla_assessor"];

describe("visao-gerencial-g1-g2 T7 -- grants das 3 views novas (GG-01, GG-03, GG-05)", () => {
  it("os 5 papéis legisla_* têm SELECT nas 3 views novas", async () => {
    const rows = await runSql<{ view: string; role: string; can_select: boolean }>(`
      SELECT v.view, r.role, has_table_privilege(r.role, v.view, 'SELECT') AS can_select
        FROM unnest(ARRAY[${VIEWS.map((v) => `'${v}'`).join(",")}]) AS v(view)
        CROSS JOIN unnest(ARRAY[${ROLES.map((r) => `'${r}'`).join(",")}]) AS r(role);
    `);
    expect(rows).toHaveLength(VIEWS.length * ROLES.length);
    for (const row of rows) {
      expect(row.can_select, `${row.role} deveria ter SELECT em ${row.view}`).toBe(true);
    }
  });

  it("legisla_app/legisla_admin/legisla_gestora têm SELECT via re-GRANT em bloco (AD-025)", async () => {
    const rows = await runSql<{ view: string; role: string; can_select: boolean }>(`
      SELECT v.view, r.role, has_table_privilege(r.role, v.view, 'SELECT') AS can_select
        FROM unnest(ARRAY[${VIEWS.map((v) => `'${v}'`).join(",")}]) AS v(view)
        CROSS JOIN unnest(ARRAY['legisla_app','legisla_admin','legisla_gestora']) AS r(role);
    `);
    expect(rows).toHaveLength(VIEWS.length * 3);
    for (const row of rows) {
      expect(row.can_select).toBe(true);
    }
  });

  it("legisla_mentor/legisla_assessor têm SELECT explícito nas 3 views", async () => {
    const rows = await runSql<{ view: string; role: string; can_select: boolean }>(`
      SELECT v.view, r.role, has_table_privilege(r.role, v.view, 'SELECT') AS can_select
        FROM unnest(ARRAY[${VIEWS.map((v) => `'${v}'`).join(",")}]) AS v(view)
        CROSS JOIN unnest(ARRAY['legisla_mentor','legisla_assessor']) AS r(role);
    `);
    expect(rows).toHaveLength(VIEWS.length * 2);
    for (const row of rows) {
      expect(row.can_select).toBe(true);
    }
  });
});
