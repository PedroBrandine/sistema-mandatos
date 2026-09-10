import { describe, it, expect } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/spec.md, EST-06
// (AD-041) + AD-030/AD-002. Migração: 20260910145926_estrategia_ref_limiar_pendencia.sql.
//
// Mesmo mecanismo de supabase/tests/catalogos/catalogos-referencia-grants.integration.test.ts:
// has_table_privilege() via SQL direto, sem sessão JWT por papel -- correto aqui
// porque o controle de acesso desta tabela é GRANT, não RLS (AD-030: catálogo
// ref_* sem id_contrato/carteira pra filtrar por linha, logo não há policy a
// exercitar via login real).

const TABELA = "ref_limiar_pendencia";
const ROLES_LEITURA = [
  "authenticated",
  "legisla_app",
  "legisla_admin",
  "legisla_gestora",
  "legisla_mentor",
  "legisla_assessor",
];
const ROLES_ESCRITA = ["legisla_app", "legisla_admin", "legisla_gestora"];
const ROLES_SO_LEITURA = ["authenticated", "legisla_mentor", "legisla_assessor"];

async function expectSqlError(sql: string, errcode: string): Promise<void> {
  try {
    await runSql(sql);
    throw new Error("expected query to fail but it succeeded");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain(errcode);
  }
}

describe("ref_limiar_pendencia -- estrutura, seed e GRANT-only (EST-06, AD-041, AD-030)", () => {
  it("estrutura: colunas do design.md com tipo, nulabilidade e default corretos", async () => {
    const rows = await runSql<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(`
      SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = '${TABELA}'
       ORDER BY ordinal_position;
    `);

    expect(rows.map((r) => r.column_name)).toEqual([
      "id_limiar",
      "codigo",
      "nome",
      "dias",
      "ativo",
      "pct_duracao_etapa",
    ]);

    const porNome = Object.fromEntries(rows.map((r) => [r.column_name, r]));
    expect(porNome.id_limiar.data_type).toBe("bigint");
    expect(porNome.codigo.data_type).toBe("text");
    expect(porNome.codigo.is_nullable).toBe("NO");
    expect(porNome.nome.data_type).toBe("text");
    expect(porNome.nome.is_nullable).toBe("NO");
    expect(porNome.dias.data_type).toBe("smallint");
    // `dias` era NOT NULL quando os 4 limiares eram absolutos. Com AD-045 as
    // linhas de etapa passam a se expressar em pct_duracao_etapa, e a
    // obrigatoriedade migra para ck_limiar_base (exatamente uma das duas
    // preenchida) -- restrição mais forte, não mais fraca. Asserida em
    // limiar-etapa-percentual.integration.test.ts.
    expect(porNome.dias.is_nullable).toBe("YES");
    expect(porNome.pct_duracao_etapa.data_type).toBe("smallint");
    expect(porNome.pct_duracao_etapa.is_nullable).toBe("YES");
    expect(porNome.ativo.data_type).toBe("boolean");
    expect(porNome.ativo.is_nullable).toBe("NO");
    expect(porNome.ativo.column_default).toBe("true");
  });

  it("CHECK ck_limiar_dias recusa dias = 0 (23514)", async () => {
    await expectSqlError(
      `INSERT INTO ${TABELA} (codigo, nome, dias) VALUES ('ck_zero_teste', 'CHECK dias = 0', 0);`,
      "23514",
    );
  });

  it("CHECK ck_limiar_dias recusa dias negativo (23514)", async () => {
    await expectSqlError(
      `INSERT INTO ${TABELA} (codigo, nome, dias) VALUES ('ck_negativo_teste', 'CHECK dias < 0', -1);`,
      "23514",
    );
  });

  it("CHECK ck_limiar_dias aceita dias = 1 (menor valor válido)", async () => {
    // INSERT e DELETE em CTEs do MESMO statement enxergam o mesmo snapshot --
    // o DELETE não veria a linha recém-inserida e o fixture vazaria para o
    // teste de contagem abaixo. Duas chamadas, com limpeza em `finally`.
    try {
      const [linha] = await runSql<{ dias: number }>(`
        INSERT INTO ${TABELA} (codigo, nome, dias)
        VALUES ('ck_um_teste', 'CHECK dias = 1', 1)
        RETURNING dias;
      `);
      expect(linha.dias).toBe(1);
    } finally {
      await runSql(`DELETE FROM ${TABELA} WHERE codigo = 'ck_um_teste';`);
    }
  });

  it("codigo é UNIQUE -- segundo INSERT do mesmo codigo falha (23505)", async () => {
    await expectSqlError(
      `INSERT INTO ${TABELA} (codigo, nome, dias) VALUES ('formulario_aberto', 'Duplicata', 99);`,
      "23505",
    );
  });

  it("seed: formulario_aberto = 30 dias e sem_registro_recente = 45 dias (valores de vw_pendencias preservados)", async () => {
    const rows = await runSql<{ codigo: string; dias: number; ativo: boolean }>(`
      SELECT codigo, dias, ativo FROM ${TABELA}
       WHERE codigo IN ('formulario_aberto', 'sem_registro_recente')
       ORDER BY codigo;
    `);
    expect(rows).toEqual([
      { codigo: "formulario_aberto", dias: 30, ativo: true },
      { codigo: "sem_registro_recente", dias: 45, ativo: true },
    ]);
  });

  it("seed: etapa_atencao e etapa_atrasado existem, ativos, com etapa_atencao < etapa_atrasado (progressão Normal -> Atenção -> Atrasado, EST-07 AC3)", async () => {
    // A base destes dois limiares passou de dias absolutos para percentual da
    // duração prevista da etapa (AD-045) -- a invariante de ordenação é a
    // mesma, agora sobre pct_duracao_etapa. Os valores exatos (70 e 100) são
    // asseridos em limiar-etapa-percentual.integration.test.ts, que é a task
    // dona da decisão.
    const rows = await runSql<{
      codigo: string;
      dias: number | null;
      pct_duracao_etapa: number;
      ativo: boolean;
      nome: string;
    }>(`
      SELECT codigo, nome, dias, pct_duracao_etapa, ativo FROM ${TABELA}
       WHERE codigo IN ('etapa_atencao', 'etapa_atrasado')
       ORDER BY codigo;
    `);
    expect(rows.map((r) => r.codigo)).toEqual(["etapa_atencao", "etapa_atrasado"]);

    const porCodigo = Object.fromEntries(rows.map((r) => [r.codigo, r]));
    expect(porCodigo.etapa_atencao.ativo).toBe(true);
    expect(porCodigo.etapa_atrasado.ativo).toBe(true);
    expect(porCodigo.etapa_atencao.nome.length).toBeGreaterThan(0);
    expect(porCodigo.etapa_atrasado.nome.length).toBeGreaterThan(0);
    expect(porCodigo.etapa_atencao.dias).toBeNull();
    expect(porCodigo.etapa_atrasado.dias).toBeNull();
    expect(porCodigo.etapa_atencao.pct_duracao_etapa).toBeGreaterThan(0);
    expect(porCodigo.etapa_atencao.pct_duracao_etapa).toBeLessThan(
      porCodigo.etapa_atrasado.pct_duracao_etapa,
    );
  });

  it("seed: os 4 limiares são exatamente os previstos, sem linha extra", async () => {
    const rows = await runSql<{ codigo: string }>(
      `SELECT codigo FROM ${TABELA} ORDER BY codigo;`,
    );
    expect(rows.map((r) => r.codigo)).toEqual([
      "etapa_atencao",
      "etapa_atrasado",
      "formulario_aberto",
      "sem_registro_recente",
    ]);
  });

  it("GRANT: authenticated + as 5 roles legisla_* têm SELECT", async () => {
    const rows = await runSql<{ role: string; can_select: boolean }>(`
      SELECT r.role, has_table_privilege(r.role, '${TABELA}', 'SELECT') AS can_select
        FROM unnest(ARRAY[${ROLES_LEITURA.map((r) => `'${r}'`).join(",")}]) AS r(role);
    `);
    expect(rows).toHaveLength(ROLES_LEITURA.length);
    for (const row of rows) {
      expect(row.can_select, `${row.role} deveria ter SELECT em ${TABELA}`).toBe(true);
    }
  });

  it("AD-002: anon NÃO tem SELECT/INSERT/UPDATE/DELETE", async () => {
    const [row] = await runSql<{
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>(`
      SELECT has_table_privilege('anon', '${TABELA}', 'SELECT') AS can_select,
             has_table_privilege('anon', '${TABELA}', 'INSERT') AS can_insert,
             has_table_privilege('anon', '${TABELA}', 'UPDATE') AS can_update,
             has_table_privilege('anon', '${TABELA}', 'DELETE') AS can_delete;
    `);
    expect(row.can_select).toBe(false);
    expect(row.can_insert).toBe(false);
    expect(row.can_update).toBe(false);
    expect(row.can_delete).toBe(false);
  });

  it("escrita: só legisla_app/admin/gestora têm INSERT/UPDATE/DELETE", async () => {
    const rows = await runSql<{
      role: string;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>(`
      SELECT r.role,
             has_table_privilege(r.role, '${TABELA}', 'INSERT') AS can_insert,
             has_table_privilege(r.role, '${TABELA}', 'UPDATE') AS can_update,
             has_table_privilege(r.role, '${TABELA}', 'DELETE') AS can_delete
        FROM unnest(ARRAY[${ROLES_ESCRITA.map((r) => `'${r}'`).join(",")}]) AS r(role);
    `);
    expect(rows).toHaveLength(ROLES_ESCRITA.length);
    for (const row of rows) {
      expect(row.can_insert, `${row.role} deveria ter INSERT`).toBe(true);
      expect(row.can_update, `${row.role} deveria ter UPDATE`).toBe(true);
      expect(row.can_delete, `${row.role} deveria ter DELETE`).toBe(true);
    }
  });

  it("escrita: authenticated, legisla_mentor e legisla_assessor NÃO têm INSERT/UPDATE/DELETE", async () => {
    const rows = await runSql<{
      role: string;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>(`
      SELECT r.role,
             has_table_privilege(r.role, '${TABELA}', 'INSERT') AS can_insert,
             has_table_privilege(r.role, '${TABELA}', 'UPDATE') AS can_update,
             has_table_privilege(r.role, '${TABELA}', 'DELETE') AS can_delete
        FROM unnest(ARRAY[${ROLES_SO_LEITURA.map((r) => `'${r}'`).join(",")}]) AS r(role);
    `);
    expect(rows).toHaveLength(ROLES_SO_LEITURA.length);
    for (const row of rows) {
      expect(row.can_insert, `${row.role} não deveria ter INSERT`).toBe(false);
      expect(row.can_update, `${row.role} não deveria ter UPDATE`).toBe(false);
      expect(row.can_delete, `${row.role} não deveria ter DELETE`).toBe(false);
    }
  });

  it("AD-030: RLS desabilitada (não ENABLE, não FORCE) -- controle é só por GRANT", async () => {
    const [row] = await runSql<{
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(`
      SELECT relrowsecurity, relforcerowsecurity
        FROM pg_class
       WHERE relkind = 'r' AND relname = '${TABELA}';
    `);
    expect(row.relrowsecurity).toBe(false);
    expect(row.relforcerowsecurity).toBe(false);
  });
});
