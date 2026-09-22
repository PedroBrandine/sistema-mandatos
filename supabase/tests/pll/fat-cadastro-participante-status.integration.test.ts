import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/pll-cadastro-participantes/spec.md D-3 +
// validation.md ("status_cadastro nunca sai do DEFAULT 'incompleto'", gap
// Major do Verifier independente, 2026-09-22).
//
// Cobre os 3 estados de status_cadastro calculados por
// trg_calcular_status_cadastro_participante (migration
// 20260922152934_pll_cadastro_participante_status_trigger.sql):
//   - "pendente_revisao": campos obrigatórios (papel/nome_completo/email --
//     T3, os únicos sem `.nullable().optional()` no Zod) preenchidos, sem
//     vínculo TSE (id_contrato IS NULL)
//   - "completo": campos obrigatórios preenchidos + vínculo TSE (id_contrato
//     IS NOT NULL)
//   - "incompleto": falta algum campo obrigatório -- ESTRUTURALMENTE
//     inalcançável via INSERT/UPDATE normal em fat_cadastro_participante,
//     porque papel/nome_completo/email já são NOT NULL na própria tabela (T2)
//     e papel/nome_completo usam o domínio texto_limpo (que também recusa
//     string vazia) -- qualquer tentativa de gravar um desses campos vazio já
//     falha por violação de constraint antes mesmo do trigger poder persistir
//     a linha. Testado aqui isolando a FUNÇÃO do trigger numa tabela
//     temporária de sessão (sem essas constraints), não na tabela real --
//     evita tocar fat_cadastro_participante para provar o branch "incompleto"
//     e não deixa nenhum resíduo (TEMP TABLE morre com a sessão/conexão).

let idProduto: number;
const idsCadastroCriados: number[] = [];

describe("fat_cadastro_participante.status_cadastro -- trigger de recômputo (D-3, fix pós-Verifier)", () => {
  beforeAll(async () => {
    const [{ id_produto }] = await runSql<{ id_produto: number }>(
      `SELECT id_produto FROM ref_produto WHERE nome = 'PLL';`
    );
    idProduto = id_produto;
  }, 60000);

  afterAll(async () => {
    if (idsCadastroCriados.length > 0) {
      await runSql(
        `DELETE FROM fat_cadastro_participante WHERE id_cadastro_participante IN (${idsCadastroCriados.join(",")});`
      );
    }
  }, 60000);

  it("INSERT com campos obrigatórios preenchidos e SEM vínculo TSE calcula 'pendente_revisao', mesmo com todos os 22 campos opcionais NULL", async () => {
    const email = `pll-cp-status-pendente-${Date.now()}@teste.com`;
    const [row] = await runSql<{ id_cadastro_participante: number; status_cadastro: string }>(`
      INSERT INTO fat_cadastro_participante (id_produto, papel, nome_completo, email)
      VALUES (${idProduto}, 'mentorado', 'PLL Status Pendente Revisao', '${email}')
      RETURNING id_cadastro_participante, status_cadastro;
    `);
    idsCadastroCriados.push(row.id_cadastro_participante);
    expect(row.status_cadastro).toBe("pendente_revisao");
  });

  it("INSERT com campos obrigatórios preenchidos E vínculo TSE (id_contrato) calcula 'completo'", async () => {
    // Reaproveita um fat_contrato já existente na base (não é o alvo do
    // teste, só precisa satisfazer a FK id_contrato) -- qualquer contrato
    // existente serve, a trigger só olha `IS NOT NULL`.
    const [{ id_contrato }] = await runSql<{ id_contrato: number }>(
      `SELECT id_contrato FROM fat_contrato LIMIT 1;`
    );
    const email = `pll-cp-status-completo-${Date.now()}@teste.com`;
    const [row] = await runSql<{ id_cadastro_participante: number; status_cadastro: string }>(`
      INSERT INTO fat_cadastro_participante (id_produto, id_contrato, papel, nome_completo, email)
      VALUES (${idProduto}, ${id_contrato}, 'mentorado', 'PLL Status Completo', '${email}')
      RETURNING id_cadastro_participante, status_cadastro;
    `);
    idsCadastroCriados.push(row.id_cadastro_participante);
    expect(row.status_cadastro).toBe("completo");
  });

  it("UPDATE que grava id_contrato (vincula ao TSE) transiciona 'pendente_revisao' -> 'completo'", async () => {
    const [{ id_contrato }] = await runSql<{ id_contrato: number }>(
      `SELECT id_contrato FROM fat_contrato LIMIT 1;`
    );
    const email = `pll-cp-status-transicao-${Date.now()}@teste.com`;
    const [inserida] = await runSql<{ id_cadastro_participante: number; status_cadastro: string }>(`
      INSERT INTO fat_cadastro_participante (id_produto, papel, nome_completo, email)
      VALUES (${idProduto}, 'mentor', 'PLL Status Transicao', '${email}')
      RETURNING id_cadastro_participante, status_cadastro;
    `);
    idsCadastroCriados.push(inserida.id_cadastro_participante);
    expect(inserida.status_cadastro).toBe("pendente_revisao");

    const [depoisDoVinculo] = await runSql<{ status_cadastro: string }>(`
      UPDATE fat_cadastro_participante
         SET id_contrato = ${id_contrato}
       WHERE id_cadastro_participante = ${inserida.id_cadastro_participante}
      RETURNING status_cadastro;
    `);
    expect(depoisDoVinculo.status_cadastro).toBe("completo");

    // E o inverso: desfazer o vínculo (id_contrato -> NULL) volta para
    // "pendente_revisao" -- a trigger recalcula em TODO UPDATE, não só na
    // primeira gravação.
    const [depoisDeDesvincular] = await runSql<{ status_cadastro: string }>(`
      UPDATE fat_cadastro_participante
         SET id_contrato = NULL
       WHERE id_cadastro_participante = ${inserida.id_cadastro_participante}
      RETURNING status_cadastro;
    `);
    expect(depoisDeDesvincular.status_cadastro).toBe("pendente_revisao");
  });

  it("função do trigger calcula 'incompleto' quando falta campo obrigatório -- isolado numa TEMP TABLE de sessão, sem tocar fat_cadastro_participante", async () => {
    // papel NULL -- campo obrigatório ausente.
    const [semPapel] = await runSql<{ status_cadastro: string }>(`
      CREATE TEMP TABLE teste_status_cadastro_sem_papel (
        papel TEXT, nome_completo TEXT, email TEXT, id_contrato BIGINT, status_cadastro TEXT
      );
      CREATE TRIGGER trg_teste
        BEFORE INSERT ON teste_status_cadastro_sem_papel
        FOR EACH ROW EXECUTE FUNCTION calcular_status_cadastro_participante();
      INSERT INTO teste_status_cadastro_sem_papel (papel, nome_completo, email, id_contrato)
      VALUES (NULL, 'Fulano', 'fulano@teste.com', NULL);
      SELECT status_cadastro FROM teste_status_cadastro_sem_papel;
    `);
    expect(semPapel.status_cadastro).toBe("incompleto");

    // nome_completo em branco (só espaço) -- btrim(...) = '' também conta
    // como ausente, mesma regra do domínio texto_limpo na tabela real.
    const [semNome] = await runSql<{ status_cadastro: string }>(`
      CREATE TEMP TABLE teste_status_cadastro_sem_nome (
        papel TEXT, nome_completo TEXT, email TEXT, id_contrato BIGINT, status_cadastro TEXT
      );
      CREATE TRIGGER trg_teste
        BEFORE INSERT ON teste_status_cadastro_sem_nome
        FOR EACH ROW EXECUTE FUNCTION calcular_status_cadastro_participante();
      INSERT INTO teste_status_cadastro_sem_nome (papel, nome_completo, email, id_contrato)
      VALUES ('mentorado', '   ', 'fulano@teste.com', NULL);
      SELECT status_cadastro FROM teste_status_cadastro_sem_nome;
    `);
    expect(semNome.status_cadastro).toBe("incompleto");

    // email NULL, mesmo com id_contrato preenchido -- vínculo TSE não supre
    // campo obrigatório faltando ("incompleto" tem prioridade sobre "completo").
    const [semEmailComVinculo] = await runSql<{ status_cadastro: string }>(`
      CREATE TEMP TABLE teste_status_cadastro_sem_email (
        papel TEXT, nome_completo TEXT, email TEXT, id_contrato BIGINT, status_cadastro TEXT
      );
      CREATE TRIGGER trg_teste
        BEFORE INSERT ON teste_status_cadastro_sem_email
        FOR EACH ROW EXECUTE FUNCTION calcular_status_cadastro_participante();
      INSERT INTO teste_status_cadastro_sem_email (papel, nome_completo, email, id_contrato)
      VALUES ('mentorado', 'Fulano', NULL, 999);
      SELECT status_cadastro FROM teste_status_cadastro_sem_email;
    `);
    expect(semEmailComVinculo.status_cadastro).toBe("incompleto");
  });
});
