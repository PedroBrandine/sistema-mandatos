import { describe, it, expect } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/catalogos-referencia/spec.md, CAT-13/CAT-18 +
// AC14/AC15/AC16 -- GRANT/RLS-disable nas 12 tabelas novas (AD-030 em
// .specs/STATE.md). Migração: 20260810192209_catalogos_referencia_grants.sql.
//
// Mesmo mecanismo de supabase/tests/plataforma/roles-grants.integration.test.ts
// e supabase/tests/fundacao/catalogos-anon-grant.integration.test.ts:
// has_table_privilege() via SQL direto, sem sessão JWT por papel -- correto
// aqui porque o controle de acesso é GRANT, não RLS (não há policy pra testar
// via login real).

const TABELAS_NOVAS = [
  "ref_etapa",
  "ref_tipo_registro",
  "ref_formulario",
  "ref_metrica_formulario",
  "ref_preditor",
  "ref_agenda_tematica",
  "ref_perfil_atuacao",
  "ref_pilar_insight",
  "ref_indicador",
  "ref_nivel_iip",
  "ref_tipologia",
  "ref_dimensao_gip",
];

const ROLES_LEISTURA = ["authenticated", "legisla_app", "legisla_admin", "legisla_gestora", "legisla_mentor", "legisla_assessor"];
const ROLES_ESCRITA = ["legisla_app", "legisla_admin", "legisla_gestora"];
const ROLES_SO_LEITURA = ["legisla_mentor", "legisla_assessor"];

describe("Catálogos de Referência -- GRANT/RLS-disable nas 12 tabelas novas (CAT-13, CAT-18, AD-030)", () => {
  it("AC14: authenticated + as 5 roles legisla_* têm SELECT em todas as 12 tabelas", async () => {
    const rows = await runSql<{ tabela: string; role: string; can_select: boolean }>(`
      SELECT t.tabela, r.role, has_table_privilege(r.role, t.tabela, 'SELECT') AS can_select
        FROM unnest(ARRAY[${TABELAS_NOVAS.map((t) => `'${t}'`).join(",")}]) AS t(tabela)
        CROSS JOIN unnest(ARRAY[${ROLES_LEISTURA.map((r) => `'${r}'`).join(",")}]) AS r(role);
    `);
    expect(rows).toHaveLength(TABELAS_NOVAS.length * ROLES_LEISTURA.length);
    for (const row of rows) {
      expect(row.can_select, `${row.role} deveria ter SELECT em ${row.tabela}`).toBe(true);
    }
  });

  it("AC15: anon NÃO tem SELECT/INSERT/UPDATE/DELETE em nenhuma das 12 tabelas (nenhum acesso anônimo, AD-002)", async () => {
    // Cobre também INSERT/UPDATE/DELETE, não só SELECT: o ALTER DEFAULT
    // PRIVILEGES de baseline do projeto Supabase concede CRUD completo a
    // `anon` em toda tabela nova de `public` -- achado real durante T2 (ver
    // 20260810193545_catalogos_referencia_revoke_default_privileges.sql),
    // mais amplo do que o precedente de 0024/20260810183759 (que só
    // revogava SELECT).
    const rows = await runSql<{
      tabela: string;
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>(`
      SELECT tabela,
             has_table_privilege('anon', tabela, 'SELECT') AS can_select,
             has_table_privilege('anon', tabela, 'INSERT') AS can_insert,
             has_table_privilege('anon', tabela, 'UPDATE') AS can_update,
             has_table_privilege('anon', tabela, 'DELETE') AS can_delete
        FROM unnest(ARRAY[${TABELAS_NOVAS.map((t) => `'${t}'`).join(",")}]) AS tabela;
    `);
    expect(rows).toHaveLength(TABELAS_NOVAS.length);
    for (const row of rows) {
      expect(row.can_select, `anon não deveria ter SELECT em ${row.tabela}`).toBe(false);
      expect(row.can_insert, `anon não deveria ter INSERT em ${row.tabela}`).toBe(false);
      expect(row.can_update, `anon não deveria ter UPDATE em ${row.tabela}`).toBe(false);
      expect(row.can_delete, `anon não deveria ter DELETE em ${row.tabela}`).toBe(false);
    }
  });

  it("authenticated tem SELECT mas NÃO tem INSERT/UPDATE/DELETE em nenhuma das 12 tabelas (defesa em profundidade)", async () => {
    // O papel Postgres literal `authenticated` nunca é o SET ROLE efetivo de
    // um login real (0002_plataforma_auth_hook.sql reescreve a claim `role`
    // para um dos 5 legisla_* sempre) -- mas o ALTER DEFAULT PRIVILEGES de
    // baseline concedia INSERT/UPDATE/DELETE mesmo assim. Revogado por
    // defesa em profundidade; SELECT continua concedido de propósito
    // (leitura ampla decidida em context.md).
    const rows = await runSql<{
      tabela: string;
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>(`
      SELECT tabela,
             has_table_privilege('authenticated', tabela, 'SELECT') AS can_select,
             has_table_privilege('authenticated', tabela, 'INSERT') AS can_insert,
             has_table_privilege('authenticated', tabela, 'UPDATE') AS can_update,
             has_table_privilege('authenticated', tabela, 'DELETE') AS can_delete
        FROM unnest(ARRAY[${TABELAS_NOVAS.map((t) => `'${t}'`).join(",")}]) AS tabela;
    `);
    expect(rows).toHaveLength(TABELAS_NOVAS.length);
    for (const row of rows) {
      expect(row.can_select, `authenticated deveria ter SELECT em ${row.tabela}`).toBe(true);
      expect(row.can_insert, `authenticated não deveria ter INSERT em ${row.tabela}`).toBe(false);
      expect(row.can_update, `authenticated não deveria ter UPDATE em ${row.tabela}`).toBe(false);
      expect(row.can_delete, `authenticated não deveria ter DELETE em ${row.tabela}`).toBe(false);
    }
  });

  it("AC16: legisla_mentor e legisla_assessor NÃO têm INSERT/UPDATE/DELETE em nenhuma das 12 tabelas", async () => {
    const rows = await runSql<{
      tabela: string;
      role: string;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>(`
      SELECT t.tabela, r.role,
             has_table_privilege(r.role, t.tabela, 'INSERT') AS can_insert,
             has_table_privilege(r.role, t.tabela, 'UPDATE') AS can_update,
             has_table_privilege(r.role, t.tabela, 'DELETE') AS can_delete
        FROM unnest(ARRAY[${TABELAS_NOVAS.map((t) => `'${t}'`).join(",")}]) AS t(tabela)
        CROSS JOIN unnest(ARRAY[${ROLES_SO_LEITURA.map((r) => `'${r}'`).join(",")}]) AS r(role);
    `);
    expect(rows).toHaveLength(TABELAS_NOVAS.length * ROLES_SO_LEITURA.length);
    for (const row of rows) {
      expect(row.can_insert, `${row.role} não deveria ter INSERT em ${row.tabela}`).toBe(false);
      expect(row.can_update, `${row.role} não deveria ter UPDATE em ${row.tabela}`).toBe(false);
      expect(row.can_delete, `${row.role} não deveria ter DELETE em ${row.tabela}`).toBe(false);
    }
  });

  it("legisla_app/legisla_admin/legisla_gestora têm INSERT/UPDATE/DELETE em todas as 12 tabelas (re-GRANT AD-025)", async () => {
    const rows = await runSql<{
      tabela: string;
      role: string;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>(`
      SELECT t.tabela, r.role,
             has_table_privilege(r.role, t.tabela, 'INSERT') AS can_insert,
             has_table_privilege(r.role, t.tabela, 'UPDATE') AS can_update,
             has_table_privilege(r.role, t.tabela, 'DELETE') AS can_delete
        FROM unnest(ARRAY[${TABELAS_NOVAS.map((t) => `'${t}'`).join(",")}]) AS t(tabela)
        CROSS JOIN unnest(ARRAY[${ROLES_ESCRITA.map((r) => `'${r}'`).join(",")}]) AS r(role);
    `);
    expect(rows).toHaveLength(TABELAS_NOVAS.length * ROLES_ESCRITA.length);
    for (const row of rows) {
      expect(row.can_insert, `${row.role} deveria ter INSERT em ${row.tabela}`).toBe(true);
      expect(row.can_update, `${row.role} deveria ter UPDATE em ${row.tabela}`).toBe(true);
      expect(row.can_delete, `${row.role} deveria ter DELETE em ${row.tabela}`).toBe(true);
    }
  });

  it("CAT-13: RLS está desabilitada (não FORCE, não ENABLE) em todas as 12 tabelas -- exceção AD-030", async () => {
    const rows = await runSql<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
      SELECT relname, relrowsecurity, relforcerowsecurity
        FROM pg_class
       WHERE relkind = 'r' AND relname = ANY(ARRAY[${TABELAS_NOVAS.map((t) => `'${t}'`).join(",")}]);
    `);
    expect(rows).toHaveLength(TABELAS_NOVAS.length);
    for (const row of rows) {
      expect(row.relrowsecurity, `${row.relname} não deveria ter RLS habilitada`).toBe(false);
      expect(row.relforcerowsecurity, `${row.relname} não deveria ter FORCE RLS`).toBe(false);
    }
  });
});
