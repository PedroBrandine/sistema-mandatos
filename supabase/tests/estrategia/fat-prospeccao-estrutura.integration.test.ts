import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/spec.md, EST-04
// (AD-040) + AD-006. tasks.md T5 "Done when":
//  - Tabela criada SEM id_contrato, com os 3 CHECKs do design
//    (ck_prospeccao_status / ck_prospeccao_convertida / ck_prospeccao_desfecho)
//  - uq_prospeccao_aberta_contratante recusa a 2a prospeccao aberta do mesmo
//    contratante + produto (edge case "Conversao simultanea" do design.md)
//  - trg_audit_fat_prospeccao grava em log_auditoria no INSERT e no UPDATE
//    (EST-04 AC2 / AD-006)
//
// EST-04 AC1 ("persistir sem id_contrato e sem exigir data de vigencia") tem
// os dois lados: a coluna nao existe (asserido na lista de colunas) e a linha
// minima entra sem nenhuma data alem do default de dt_abertura.
//
// Migracao: 20260911023609_estrategia_fat_prospeccao_estrutura.sql.

const TABELA = "fat_prospeccao";
const NOME_CONTRATANTE_A = "EST T5 Prospeccao Contratante A";
const NOME_CONTRATANTE_B = "EST T5 Prospeccao Contratante B";

let idContratanteA: number;
let idContratanteB: number;
let idProdutoEstrategia: number;
let idProdutoCoalizao: number;
let idContrato: number;

async function expectSqlError(sql: string, errcode: string): Promise<void> {
  try {
    await runSql(sql);
    throw new Error("expected query to fail but it succeeded");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain(errcode);
  }
}

// INSERT e DELETE em CTEs do MESMO statement enxergam o mesmo snapshot -- o
// DELETE nao veria a linha recem-inserida e o fixture vazaria para as
// asercoes de contagem. Statements separados, limpeza em `finally`.
async function limparProspeccoes(): Promise<void> {
  await runSql(
    `DELETE FROM ${TABELA} WHERE id_contratante IN (${idContratanteA}, ${idContratanteB});`
  );
}

describe("fat_prospeccao -- estrutura, indice parcial e auditoria (EST-04, AD-040, AD-006)", () => {
  beforeAll(async () => {
    const produtos = await runSql<{ nome: string; id_produto: number }>(`
      SELECT nome, id_produto FROM ref_produto WHERE nome IN ('Estratégia', 'Coalizão') ORDER BY nome;
    `);
    const porNome = Object.fromEntries(produtos.map((p) => [p.nome, p.id_produto]));
    idProdutoEstrategia = porNome["Estratégia"];
    idProdutoCoalizao = porNome["Coalizão"];

    const [{ id_contratante: a }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', '${NOME_CONTRATANTE_A}')
      RETURNING id_contratante;
    `);
    idContratanteA = a;
    const [{ id_contratante: b }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', '${NOME_CONTRATANTE_B}')
      RETURNING id_contratante;
    `);
    idContratanteB = b;

    const [{ id_contrato }] = await runSql<{ id_contrato: number }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      VALUES (${idContratanteB}, ${idProdutoEstrategia}, CURRENT_DATE, 'ativo')
      RETURNING id_contrato;
    `);
    idContrato = id_contrato;
  }, 120000);

  afterAll(async () => {
    await limparProspeccoes();
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};
      DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};
      DELETE FROM dim_planejamento WHERE id_contrato = ${idContrato};
    `);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};`);
    await runSql(
      `DELETE FROM dim_contratante WHERE id_contratante IN (${idContratanteA}, ${idContratanteB});`
    );
  }, 120000);

  it("estrutura: colunas do design.md, na ordem, com tipo e nulabilidade corretos -- e SEM id_contrato (EST-04 AC1)", async () => {
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
      "id_prospeccao",
      "id_contratante",
      "id_produto",
      "id_projeto",
      "id_usuario_resp",
      "status",
      "dt_abertura",
      "dt_desfecho",
      "id_contrato_gerado",
      "observacao",
      "criado_em",
      "criado_por",
      "atualizado_em",
    ]);
    // AD-040: unica tabela de operacao sem id_contrato -- a excecao deliberada.
    expect(rows.map((r) => r.column_name)).not.toContain("id_contrato");

    const porNome = Object.fromEntries(rows.map((r) => [r.column_name, r]));
    expect(porNome.id_prospeccao.data_type).toBe("bigint");
    expect(porNome.id_contratante.data_type).toBe("bigint");
    expect(porNome.id_contratante.is_nullable).toBe("NO");
    expect(porNome.id_produto.data_type).toBe("bigint");
    expect(porNome.id_produto.is_nullable).toBe("NO");
    expect(porNome.id_projeto.is_nullable).toBe("YES");
    expect(porNome.id_usuario_resp.is_nullable).toBe("YES");
    expect(porNome.status.data_type).toBe("text");
    expect(porNome.status.is_nullable).toBe("NO");
    expect(porNome.status.column_default).toBe("'aberta'::text");
    expect(porNome.dt_abertura.data_type).toBe("date");
    expect(porNome.dt_abertura.is_nullable).toBe("NO");
    expect(porNome.dt_abertura.column_default).toBe("CURRENT_DATE");
    expect(porNome.dt_desfecho.data_type).toBe("date");
    expect(porNome.dt_desfecho.is_nullable).toBe("YES");
    expect(porNome.id_contrato_gerado.data_type).toBe("bigint");
    expect(porNome.id_contrato_gerado.is_nullable).toBe("YES");
    expect(porNome.observacao.data_type).toBe("text");
    expect(porNome.criado_em.is_nullable).toBe("NO");
    expect(porNome.criado_por.is_nullable).toBe("YES");
    expect(porNome.atualizado_em.is_nullable).toBe("NO");
  });

  it("FKs: contratante/produto/projeto/usuario e o ponteiro de desfecho id_contrato_gerado -> fat_contrato", async () => {
    const rows = await runSql<{ coluna: string; tabela_alvo: string }>(`
      SELECT a.attname AS coluna, cl.relname AS tabela_alvo
        FROM pg_constraint c
        JOIN pg_class t   ON t.oid = c.conrelid
        JOIN pg_class cl  ON cl.oid = c.confrelid
        JOIN unnest(c.conkey) AS k(attnum) ON true
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
       WHERE c.contype = 'f' AND t.relname = '${TABELA}'
       ORDER BY a.attname;
    `);
    expect(rows).toEqual([
      { coluna: "criado_por", tabela_alvo: "dim_usuario" },
      { coluna: "id_contratante", tabela_alvo: "dim_contratante" },
      { coluna: "id_contrato_gerado", tabela_alvo: "fat_contrato" },
      { coluna: "id_produto", tabela_alvo: "ref_produto" },
      { coluna: "id_projeto", tabela_alvo: "ref_projeto" },
      { coluna: "id_usuario_resp", tabela_alvo: "dim_usuario" },
    ]);
  });

  it("EST-04 AC1: prospeccao minima entra sem contrato e sem data de vigencia, com status='aberta' por default", async () => {
    try {
      const [linha] = await runSql<{
        status: string;
        dt_abertura: string;
        dt_desfecho: string | null;
        id_contrato_gerado: number | null;
      }>(`
        INSERT INTO ${TABELA} (id_contratante, id_produto)
        VALUES (${idContratanteA}, ${idProdutoEstrategia})
        RETURNING status, dt_abertura, dt_desfecho, id_contrato_gerado;
      `);
      expect(linha.status).toBe("aberta");
      expect(linha.dt_desfecho).toBeNull();
      expect(linha.id_contrato_gerado).toBeNull();
      expect(linha.dt_abertura).not.toBeNull();
    } finally {
      await limparProspeccoes();
    }
  });

  it("ck_prospeccao_status: recusa status fora de aberta/convertida/descartada (23514)", async () => {
    await expectSqlError(
      `INSERT INTO ${TABELA} (id_contratante, id_produto, status, dt_desfecho)
       VALUES (${idContratanteA}, ${idProdutoEstrategia}, 'prospeccao', CURRENT_DATE);`,
      "23514"
    );
  });

  it("ck_prospeccao_status: aceita 'descartada' (com dt_desfecho), o terceiro valor do dominio", async () => {
    try {
      const [linha] = await runSql<{ status: string }>(`
        INSERT INTO ${TABELA} (id_contratante, id_produto, status, dt_desfecho)
        VALUES (${idContratanteA}, ${idProdutoEstrategia}, 'descartada', CURRENT_DATE)
        RETURNING status;
      `);
      expect(linha.status).toBe("descartada");
    } finally {
      await limparProspeccoes();
    }
  });

  it("ck_prospeccao_convertida: status='convertida' sem id_contrato_gerado e recusado (23514)", async () => {
    await expectSqlError(
      `INSERT INTO ${TABELA} (id_contratante, id_produto, status, dt_desfecho)
       VALUES (${idContratanteA}, ${idProdutoEstrategia}, 'convertida', CURRENT_DATE);`,
      "23514"
    );
  });

  it("ck_prospeccao_convertida: status='convertida' com id_contrato_gerado e aceito", async () => {
    try {
      const [linha] = await runSql<{ status: string; id_contrato_gerado: number }>(`
        INSERT INTO ${TABELA} (id_contratante, id_produto, status, dt_desfecho, id_contrato_gerado)
        VALUES (${idContratanteA}, ${idProdutoEstrategia}, 'convertida', CURRENT_DATE, ${idContrato})
        RETURNING status, id_contrato_gerado;
      `);
      expect(linha.status).toBe("convertida");
      expect(linha.id_contrato_gerado).toBe(idContrato);
    } finally {
      await limparProspeccoes();
    }
  });

  it("ck_prospeccao_desfecho: status <> 'aberta' sem dt_desfecho e recusado (23514)", async () => {
    await expectSqlError(
      `INSERT INTO ${TABELA} (id_contratante, id_produto, status)
       VALUES (${idContratanteA}, ${idProdutoEstrategia}, 'descartada');`,
      "23514"
    );
  });

  it("ck_prospeccao_desfecho: status='aberta' com dt_desfecho NULL e aceito (o outro lado do CHECK)", async () => {
    try {
      const [linha] = await runSql<{ status: string; dt_desfecho: string | null }>(`
        INSERT INTO ${TABELA} (id_contratante, id_produto, status)
        VALUES (${idContratanteA}, ${idProdutoEstrategia}, 'aberta')
        RETURNING status, dt_desfecho;
      `);
      expect(linha.status).toBe("aberta");
      expect(linha.dt_desfecho).toBeNull();
    } finally {
      await limparProspeccoes();
    }
  });

  it("os 3 CHECKs do design.md existem com exatamente esses nomes", async () => {
    const rows = await runSql<{ conname: string }>(`
      SELECT c.conname
        FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
       WHERE c.contype = 'c' AND t.relname = '${TABELA}'
         AND c.conname LIKE 'ck_prospeccao%'
       ORDER BY c.conname;
    `);
    expect(rows.map((r) => r.conname)).toEqual([
      "ck_prospeccao_convertida",
      "ck_prospeccao_desfecho",
      "ck_prospeccao_status",
    ]);
  });

  it("uq_prospeccao_aberta_contratante: 2a prospeccao ABERTA do mesmo contratante+produto e recusada (23505)", async () => {
    try {
      await runSql(`
        INSERT INTO ${TABELA} (id_contratante, id_produto)
        VALUES (${idContratanteA}, ${idProdutoEstrategia});
      `);
      await expectSqlError(
        `INSERT INTO ${TABELA} (id_contratante, id_produto)
         VALUES (${idContratanteA}, ${idProdutoEstrategia});`,
        "23505"
      );
    } finally {
      await limparProspeccoes();
    }
  });

  it("uq_prospeccao_aberta_contratante: mesmo contratante em OUTRO produto e aceito (o indice e por contratante+produto)", async () => {
    try {
      await runSql(`
        INSERT INTO ${TABELA} (id_contratante, id_produto)
        VALUES (${idContratanteA}, ${idProdutoEstrategia});
      `);
      const [linha] = await runSql<{ id_produto: number }>(`
        INSERT INTO ${TABELA} (id_contratante, id_produto)
        VALUES (${idContratanteA}, ${idProdutoCoalizao})
        RETURNING id_produto;
      `);
      expect(linha.id_produto).toBe(idProdutoCoalizao);
    } finally {
      await limparProspeccoes();
    }
  });

  it("uq_prospeccao_aberta_contratante e PARCIAL: com a 1a ja convertida, uma nova aberta do mesmo contratante+produto e aceita", async () => {
    try {
      await runSql(`
        INSERT INTO ${TABELA} (id_contratante, id_produto, status, dt_desfecho, id_contrato_gerado)
        VALUES (${idContratanteA}, ${idProdutoEstrategia}, 'convertida', CURRENT_DATE, ${idContrato});
      `);
      const [linha] = await runSql<{ status: string }>(`
        INSERT INTO ${TABELA} (id_contratante, id_produto)
        VALUES (${idContratanteA}, ${idProdutoEstrategia})
        RETURNING status;
      `);
      expect(linha.status).toBe("aberta");

      const [{ total }] = await runSql<{ total: number }>(`
        SELECT COUNT(*)::int AS total FROM ${TABELA}
         WHERE id_contratante = ${idContratanteA} AND id_produto = ${idProdutoEstrategia};
      `);
      expect(total).toBe(2);
    } finally {
      await limparProspeccoes();
    }
  });

  it("o indice uq_prospeccao_aberta_contratante e UNIQUE, parcial em status='aberta', sobre (id_contratante, id_produto)", async () => {
    const [row] = await runSql<{ indexdef: string }>(`
      SELECT indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = 'uq_prospeccao_aberta_contratante';
    `);
    expect(row.indexdef).toContain("CREATE UNIQUE INDEX");
    expect(row.indexdef).toContain("(id_contratante, id_produto)");
    expect(row.indexdef).toContain("WHERE (status = 'aberta'::text)");
  });

  it("AD-006: trg_audit_fat_prospeccao existe com o argumento de PK correto", async () => {
    const rows = await runSql<{ tgname: string; def: string }>(`
      SELECT t.tgname, pg_get_triggerdef(t.oid) AS def
        FROM pg_trigger t
       WHERE t.tgname = 'trg_audit_fat_prospeccao';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].def).toContain("'id_prospeccao'");
    expect(rows[0].def).toContain("AFTER INSERT OR DELETE OR UPDATE");
    expect(rows[0].def).toContain("app.trg_auditoria");
  });

  it("EST-04 AC2: INSERT e UPDATE em fat_prospeccao geram linha de auditoria com autor e timestamp", async () => {
    let idProspeccao: number | undefined;
    try {
      const [{ id_prospeccao }] = await runSql<{ id_prospeccao: number }>(`
        INSERT INTO ${TABELA} (id_contratante, id_produto)
        VALUES (${idContratanteA}, ${idProdutoEstrategia})
        RETURNING id_prospeccao;
      `);
      idProspeccao = id_prospeccao;

      await runSql(`
        UPDATE ${TABELA} SET status = 'descartada', dt_desfecho = CURRENT_DATE
         WHERE id_prospeccao = ${idProspeccao};
      `);

      const logs = await runSql<{
        acao: string;
        id_usuario: number | null;
        ocorrido_em: string;
        valor_novo_status: string | null;
      }>(`
        SELECT acao, id_usuario, ocorrido_em, valor_novo ->> 'status' AS valor_novo_status
          FROM log_auditoria
         WHERE tabela = '${TABELA}' AND id_registro_alvo = ${idProspeccao}
         ORDER BY ocorrido_em, acao;
      `);

      expect(logs.map((l) => l.acao).sort()).toEqual(["insert", "update"]);
      const porAcao = Object.fromEntries(logs.map((l) => [l.acao, l]));
      expect(porAcao.insert.valor_novo_status).toBe("aberta");
      expect(porAcao.update.valor_novo_status).toBe("descartada");
      for (const log of logs) {
        expect(log.id_usuario).not.toBeNull();
        expect(log.ocorrido_em).not.toBeNull();
      }
    } finally {
      await limparProspeccoes();
    }
  });

  it("AD-002: anon nao tem SELECT/INSERT/UPDATE/DELETE em fat_prospeccao", async () => {
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
});
