import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/spec.md, EST-13
// AC4 ("WHEN a usuaria marca presenca THEN o sistema SHALL gravar
// status = 'realizado' e dt_realizada, registrando autor e timestamp
// (AD-006)") e AC5 ("WHEN a usuaria marca presenca em encontro ja realizado
// THEN o sistema SHALL nao duplicar a transicao"). tasks.md T29 "Done when":
//  - SECURITY INVOKER (AD-024); grava status='realizado' e dt_realizada
//  - Autor e timestamp registrados em log_auditoria (AD-006)
//  - Chamada em encontro ja realizado e idempotente
//
// A auditoria vem do app.trg_auditoria() ja ligado a fat_encontro em
// 20260813192032 -- reusar um gatilho provado nao e evidencia de que ele esta
// ligado NESTA tabela, entao a linha resultante em log_auditoria e asserida
// aqui (licao L-013).
//
// Migracao: 20260912023810_estrategia_fn_marcar_presenca.sql.

let idProduto: number;
let idContratante: number;
let idContrato: number;
const encontros: Record<string, number> = {};

// Um encontro por cenario: cada chamada bem-sucedida muda o status, entao
// reusar o mesmo encontro entre casos acoplaria a ordem dos testes.
const CENARIOS = ["feliz", "idempotente", "auditoria"] as const;

async function criarEncontro(chave: string, status = "planejado"): Promise<void> {
  const dtRealizada = status === "realizado" ? "now()" : "NULL";
  const [{ id_encontro }] = await runSql<{ id_encontro: number }>(`
    INSERT INTO fat_encontro (id_contrato, titulo, status, dt_prevista_inicio, dt_realizada)
    VALUES (${idContrato}, 'EST T29 ${chave}', '${status}', now() - INTERVAL '2 days', ${dtRealizada})
    RETURNING id_encontro;
  `);
  encontros[chave] = id_encontro;
}

async function marcarPresenca(idEncontro: number): Promise<void> {
  await runSql(`SELECT app.marcar_presenca(${idEncontro});`);
}

async function lerEncontro(idEncontro: number) {
  const [linha] = await runSql<{ status: string; dt_realizada: string | null }>(
    `SELECT status, dt_realizada FROM fat_encontro WHERE id_encontro = ${idEncontro};`
  );
  return linha;
}

async function contarAuditoria(idEncontro: number): Promise<number> {
  const [{ total }] = await runSql<{ total: number }>(`
    SELECT COUNT(*)::int AS total FROM log_auditoria
     WHERE tabela = 'fat_encontro' AND id_registro_alvo = ${idEncontro} AND acao = 'update';
  `);
  return total;
}

describe("app.marcar_presenca -- fechamento do encontro (EST-13 AC4/AC5, AD-024)", () => {
  beforeAll(async () => {
    const [{ id_produto }] = await runSql<{ id_produto: number }>(
      `SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia';`
    );
    idProduto = id_produto;

    const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome)
      VALUES ('mandato', 'EST T29 Marcar Presenca')
      RETURNING id_contratante;
    `);
    idContratante = id_contratante;

    const [{ id_contrato }] = await runSql<{ id_contrato: number }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      VALUES (${idContratante}, ${idProduto}, CURRENT_DATE, 'ativo')
      RETURNING id_contrato;
    `);
    idContrato = id_contrato;

    for (const chave of CENARIOS) {
      await criarEncontro(chave, chave === "idempotente" ? "realizado" : "planejado");
    }
  }, 300000);

  afterAll(async () => {
    const ids = Object.values(encontros).join(",");
    if (ids.length > 0) {
      await runSql(
        `DELETE FROM log_auditoria WHERE tabela = 'fat_encontro' AND id_registro_alvo IN (${ids});`
      );
      await runSql(`DELETE FROM rel_encontro_participante WHERE id_encontro IN (${ids});`);
      await runSql(`DELETE FROM fat_registro WHERE id_encontro IN (${ids});`);
      await runSql(`DELETE FROM fat_encontro WHERE id_encontro IN (${ids});`);
    }
    if (idContrato) {
      await runSql(`
        DELETE FROM log_auditoria WHERE tabela = 'fat_contrato' AND id_registro_alvo = ${idContrato};
        DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};
        DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};
        DELETE FROM dim_planejamento WHERE id_contrato = ${idContrato};
      `);
      await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};`);
    }
    if (idContratante) {
      await runSql(
        `DELETE FROM log_auditoria WHERE tabela = 'dim_contratante' AND id_registro_alvo = ${idContratante};`
      );
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
    }
  }, 300000);

  it("AD-024: app.marcar_presenca e SECURITY INVOKER (prosecdef = false), com search_path fixo", async () => {
    const rows = await runSql<{ prosecdef: boolean; proconfig: string[] | null }>(`
      SELECT prosecdef, proconfig FROM pg_proc
       WHERE pronamespace = 'app'::regnamespace AND proname = 'marcar_presenca';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].prosecdef).toBe(false);
    expect(rows[0].proconfig).toContain("search_path=public, pg_temp");
  });

  it("EST-13 AC4: marcar presenca grava status='realizado' e preenche dt_realizada", async () => {
    const antes = await lerEncontro(encontros.feliz);
    expect(antes.status).toBe("planejado");
    expect(antes.dt_realizada).toBeNull();

    await marcarPresenca(encontros.feliz);

    const depois = await lerEncontro(encontros.feliz);
    expect(depois.status).toBe("realizado");
    expect(depois.dt_realizada).not.toBeNull();
  });

  it("EST-13 AC4 / AD-006: a transicao grava autor e timestamp em log_auditoria", async () => {
    await marcarPresenca(encontros.auditoria);

    // Filtra acao='update': a transicao e o que AC4 exige auditar. A linha
    // 'insert' que tambem existe e da criacao do encontro pela fixture deste
    // teste, nao de marcar_presenca -- conta-la aqui mediria o setup.
    const rows = await runSql<{
      acao: string;
      id_usuario: number | null;
      ocorrido_em: string | null;
      valor_novo: { status?: string } | null;
    }>(`
      SELECT acao, id_usuario, ocorrido_em, valor_novo FROM log_auditoria
       WHERE tabela = 'fat_encontro' AND id_registro_alvo = ${encontros.auditoria}
         AND acao = 'update'
       ORDER BY ocorrido_em;
    `);

    expect(rows).toHaveLength(1);
    expect(rows[0].acao).toBe("update");
    expect(rows[0].id_usuario).not.toBeNull();
    expect(rows[0].ocorrido_em).not.toBeNull();
    expect(rows[0].valor_novo?.status).toBe("realizado");
  });

  it("EST-13 AC5: segunda chamada e idempotente -- nao reescreve dt_realizada", async () => {
    const antes = await lerEncontro(encontros.idempotente);
    expect(antes.status).toBe("realizado");

    await marcarPresenca(encontros.idempotente);

    const depois = await lerEncontro(encontros.idempotente);
    expect(depois.status).toBe("realizado");
    expect(depois.dt_realizada).toBe(antes.dt_realizada);
  });

  it("EST-13 AC5: encontro ja realizado nao gera segunda linha de auditoria", async () => {
    const antes = await contarAuditoria(encontros.feliz);

    await marcarPresenca(encontros.feliz);

    expect(await contarAuditoria(encontros.feliz)).toBe(antes);
  });

  it("encontro inexistente falha com 42501, sem revelar se e ausencia ou RLS", async () => {
    try {
      await runSql(`SELECT app.marcar_presenca(-1);`);
      throw new Error("expected query to fail but it succeeded");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain("Encontro não encontrado ou sem permissão.");
    }
  });
});
