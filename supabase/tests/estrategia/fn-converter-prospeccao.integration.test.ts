import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/spec.md, EST-04
// AC3 ("WHEN uma prospeccao e convertida THEN o sistema SHALL criar o
// fat_contrato e marcar a prospeccao como convertida, na mesma transacao") e
// AC4 ("WHEN uma prospeccao ja convertida recebe nova tentativa de conversao
// THEN o sistema SHALL recusar e informar, sem criar contrato duplicado") +
// AD-024. tasks.md T7 "Done when":
//  - SECURITY INVOKER explicito; SECURITY DEFINER ausente
//  - Caminho feliz: cria contrato, seta status='convertida',
//    id_contrato_gerado e dt_desfecho
//  - Segunda conversao da mesma prospeccao falha com erro tipado, sem criar
//    contrato
//  - Falha no meio nao deixa contrato orfao -- asserido com rollback forcado
//
// Migracao: 20260911025405_estrategia_fn_converter_prospeccao.sql.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "EST-t7-converter-prospeccao-P4ssword!";
const MENTOR_EMAIL = "est-t7-converter-mentor@legislabrasil.test";

const admin = createClient(URL, SERVICE_ROLE_KEY);
const authUserIds: string[] = [];

let idProduto: number;
let idProjeto: number;
const contratantes: Record<string, number> = {};
const prospeccoes: Record<string, number> = {};

// Cenarios: um contratante + uma prospeccao por caso, porque cada conversao
// bem-sucedida cria um fat_contrato e uq_prospeccao_aberta_contratante (T5)
// proibe duas prospeccoes abertas do mesmo contratante no mesmo produto.
const CENARIOS = ["feliz", "segunda", "descartada", "rollback", "invoker", "concorrente"] as const;

async function criarCenario(chave: string, statusInicial = "aberta"): Promise<void> {
  const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
    INSERT INTO dim_contratante (tipo_contratante, nome)
    VALUES ('mandato', 'EST T7 Converter ${chave}')
    RETURNING id_contratante;
  `);
  contratantes[chave] = id_contratante;

  const desfecho = statusInicial === "aberta" ? "NULL" : "CURRENT_DATE";
  const [{ id_prospeccao }] = await runSql<{ id_prospeccao: number }>(`
    INSERT INTO fat_prospeccao (id_contratante, id_produto, id_projeto, status, dt_desfecho)
    VALUES (${id_contratante}, ${idProduto}, ${idProjeto}, '${statusInicial}', ${desfecho})
    RETURNING id_prospeccao;
  `);
  prospeccoes[chave] = id_prospeccao;
}

async function converter(idProspeccao: number, dtInicio = "CURRENT_DATE"): Promise<number> {
  const [linha] = await runSql<{ id_contrato: number }>(
    `SELECT app.converter_prospeccao(${idProspeccao}, ${dtInicio}) AS id_contrato;`
  );
  return linha.id_contrato;
}

async function expectSqlError(sql: string, trecho: string): Promise<void> {
  try {
    await runSql(sql);
    throw new Error("expected query to fail but it succeeded");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain(trecho);
  }
}

async function contarContratos(chave: string): Promise<number> {
  const [{ total }] = await runSql<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM fat_contrato WHERE id_contratante = ${contratantes[chave]};`
  );
  return total;
}

describe("app.converter_prospeccao -- conversao transacional (EST-04 AC3/AC4, AD-024)", () => {
  beforeAll(async () => {
    const [{ id_produto }] = await runSql<{ id_produto: number }>(
      `SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia';`
    );
    idProduto = id_produto;
    const [{ id_projeto }] = await runSql<{ id_projeto: number }>(
      `SELECT id_projeto FROM ref_projeto ORDER BY id_projeto LIMIT 1;`
    );
    idProjeto = id_projeto;

    for (const chave of CENARIOS) {
      await criarCenario(chave, chave === "descartada" ? "descartada" : "aberta");
    }

    const { data: existentes } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of existentes?.users ?? []) {
      if (user.email === MENTOR_EMAIL) {
        await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      }
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: MENTOR_EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    authUserIds.push(data.user.id);
    await runSql(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo)
      VALUES ('${MENTOR_EMAIL}', 'EST T7 Mentor Sem Vinculo', 'mentor', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);
  }, 300000);

  afterAll(async () => {
    const ids = Object.values(contratantes).join(",");
    if (ids.length > 0) {
      // fat_prospeccao antes de fat_contrato: id_contrato_gerado e FK.
      await runSql(`DELETE FROM fat_prospeccao WHERE id_contratante IN (${ids});`);
      await runSql(`
        DELETE FROM fat_etapa_contrato
         WHERE id_contrato IN (SELECT id_contrato FROM fat_contrato WHERE id_contratante IN (${ids}));
        DELETE FROM rel_formulario_contrato
         WHERE id_contrato IN (SELECT id_contrato FROM fat_contrato WHERE id_contratante IN (${ids}));
        DELETE FROM dim_planejamento
         WHERE id_contrato IN (SELECT id_contrato FROM fat_contrato WHERE id_contratante IN (${ids}));
      `);
      await runSql(`DELETE FROM fat_contrato WHERE id_contratante IN (${ids});`);
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante IN (${ids});`);
    }

    const idsUsuarios = await runSql<{ id_usuario: number }>(
      `SELECT id_usuario FROM dim_usuario WHERE email = '${MENTOR_EMAIL}';`
    );
    const idList = idsUsuarios.map((r) => r.id_usuario).join(",");
    if (idList.length > 0) {
      await runSql(
        `DELETE FROM log_auditoria WHERE id_usuario IN (${idList}) OR id_usuario_impersonado IN (${idList});`
      );
    }
    await runSql(`DELETE FROM dim_usuario WHERE email = '${MENTOR_EMAIL}';`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 300000);

  it("AD-024: app.converter_prospeccao e SECURITY INVOKER (prosecdef = false), com search_path fixo", async () => {
    const rows = await runSql<{ prosecdef: boolean; proconfig: string[] | null }>(`
      SELECT prosecdef, proconfig FROM pg_proc
       WHERE pronamespace = 'app'::regnamespace AND proname = 'converter_prospeccao';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].prosecdef).toBe(false);
    expect(rows[0].proconfig).toContain("search_path=public, pg_temp");
  });

  it("EST-04 AC3: conversao cria o contrato herdando contratante/produto/projeto, com a data pedida e status ativo", async () => {
    const idContrato = await converter(prospeccoes.feliz);
    expect(idContrato).toBeGreaterThan(0);

    const [contrato] = await runSql<{
      id_contratante: number;
      id_produto: number;
      id_projeto: number;
      status: string;
      dt_inicio: string;
    }>(`
      SELECT id_contratante, id_produto, id_projeto, status, dt_inicio
        FROM fat_contrato WHERE id_contrato = ${idContrato};
    `);
    expect(contrato.id_contratante).toBe(contratantes.feliz);
    expect(contrato.id_produto).toBe(idProduto);
    expect(contrato.id_projeto).toBe(idProjeto);
    expect(contrato.status).toBe("ativo");

    const [{ igual_hoje }] = await runSql<{ igual_hoje: boolean }>(
      `SELECT (dt_inicio = CURRENT_DATE) AS igual_hoje FROM fat_contrato WHERE id_contrato = ${idContrato};`
    );
    expect(igual_hoje).toBe(true);
  }, 120000);

  it("EST-04 AC3: na mesma transacao a prospeccao fica convertida, com id_contrato_gerado e dt_desfecho preenchidos", async () => {
    const [linha] = await runSql<{
      status: string;
      id_contrato_gerado: number;
      desfecho_hoje: boolean;
    }>(`
      SELECT p.status, p.id_contrato_gerado, (p.dt_desfecho = CURRENT_DATE) AS desfecho_hoje
        FROM fat_prospeccao p WHERE p.id_prospeccao = ${prospeccoes.feliz};
    `);
    expect(linha.status).toBe("convertida");
    expect(linha.desfecho_hoje).toBe(true);

    const [{ id_contrato }] = await runSql<{ id_contrato: number }>(
      `SELECT id_contrato FROM fat_contrato WHERE id_contratante = ${contratantes.feliz};`
    );
    expect(linha.id_contrato_gerado).toBe(id_contrato);
  }, 120000);

  it("EST-04 AC4: segunda conversao da mesma prospeccao falha com PRO01 e NAO cria um segundo contrato", async () => {
    const idContrato = await converter(prospeccoes.segunda);
    expect(await contarContratos("segunda")).toBe(1);

    await expectSqlError(`SELECT app.converter_prospeccao(${prospeccoes.segunda}, CURRENT_DATE);`, "PRO01");

    expect(await contarContratos("segunda")).toBe(1);

    // A prospeccao segue apontando para o MESMO contrato da primeira conversao.
    const [linha] = await runSql<{ status: string; id_contrato_gerado: number }>(
      `SELECT status, id_contrato_gerado FROM fat_prospeccao WHERE id_prospeccao = ${prospeccoes.segunda};`
    );
    expect(linha.status).toBe("convertida");
    expect(linha.id_contrato_gerado).toBe(idContrato);
  }, 180000);

  it("mao unica: prospeccao descartada tambem nao converte (PRO01), sem criar contrato", async () => {
    await expectSqlError(`SELECT app.converter_prospeccao(${prospeccoes.descartada}, CURRENT_DATE);`, "PRO01");
    expect(await contarContratos("descartada")).toBe(0);

    const [linha] = await runSql<{ status: string; id_contrato_gerado: number | null }>(
      `SELECT status, id_contrato_gerado FROM fat_prospeccao WHERE id_prospeccao = ${prospeccoes.descartada};`
    );
    expect(linha.status).toBe("descartada");
    expect(linha.id_contrato_gerado).toBeNull();
  }, 120000);

  it("prospeccao inexistente: 42501, mensagem que nao distingue ausencia de falta de permissao", async () => {
    await expectSqlError("SELECT app.converter_prospeccao(-1, CURRENT_DATE);", "42501");
  });

  it("falha no meio da conversao NAO deixa contrato orfao nem prospeccao meio-convertida (rollback forcado)", async () => {
    const idProspeccao = prospeccoes.rollback;
    try {
      // Trigger de falha restrito a ESTA linha (clausula WHEN) -- o banco de
      // dev e compartilhado, nenhuma outra escrita pode ser afetada. Dispara
      // DEPOIS do INSERT em fat_contrato, que e o unico ponto em que "falha no
      // meio" e observavel.
      await runSql(`
        CREATE OR REPLACE FUNCTION app.teste_t7_falha_conversao() RETURNS trigger
        LANGUAGE plpgsql AS $fn$
        BEGIN
          RAISE EXCEPTION 'falha forcada no meio da conversao' USING ERRCODE = 'P0001';
        END $fn$;
      `);
      await runSql(`
        DROP TRIGGER IF EXISTS trg_teste_t7_falha_conversao ON fat_prospeccao;
        CREATE TRIGGER trg_teste_t7_falha_conversao
          BEFORE UPDATE ON fat_prospeccao FOR EACH ROW
          WHEN (NEW.id_prospeccao = ${idProspeccao})
          EXECUTE FUNCTION app.teste_t7_falha_conversao();
      `);

      await expectSqlError(
        `SELECT app.converter_prospeccao(${idProspeccao}, CURRENT_DATE);`,
        "falha forcada no meio da conversao"
      );
    } finally {
      await runSql(`DROP TRIGGER IF EXISTS trg_teste_t7_falha_conversao ON fat_prospeccao;`);
      await runSql(`DROP FUNCTION IF EXISTS app.teste_t7_falha_conversao();`);
    }

    // O INSERT em fat_contrato aconteceu antes do UPDATE que falhou: se a
    // funcao nao fosse atomica, o contrato teria sobrado aqui.
    expect(await contarContratos("rollback")).toBe(0);

    const [linha] = await runSql<{
      status: string;
      id_contrato_gerado: number | null;
      dt_desfecho: string | null;
    }>(`
      SELECT status, id_contrato_gerado, dt_desfecho
        FROM fat_prospeccao WHERE id_prospeccao = ${idProspeccao};
    `);
    expect(linha.status).toBe("aberta");
    expect(linha.id_contrato_gerado).toBeNull();
    expect(linha.dt_desfecho).toBeNull();
  }, 240000);

  it("Edge case (spec.md): duas conversoes simultaneas da MESMA prospeccao -- so uma cria contrato, a outra falha com PRO01", async () => {
    // Duas chamadas de runSql sao dois processos/conexoes distintos (cada
    // runSql spawna sua propria `supabase db query` ou conexao pg), entao
    // Promise.all aqui e concorrencia real no Postgres, nao so no event loop
    // do Node -- e o FOR UPDATE de app.converter_prospeccao que serializa as
    // duas, nao o JavaScript.
    const idProspeccao = prospeccoes.concorrente;
    const resultados = await Promise.allSettled([
      converter(idProspeccao),
      converter(idProspeccao),
    ]);

    const sucesso = resultados.filter((r) => r.status === "fulfilled");
    const falha = resultados.filter((r) => r.status === "rejected");
    expect(sucesso).toHaveLength(1);
    expect(falha).toHaveLength(1);

    const erroFalha = (falha[0] as PromiseRejectedResult).reason;
    const mensagemFalha = erroFalha instanceof Error ? erroFalha.message : String(erroFalha);
    expect(mensagemFalha).toContain("PRO01");

    // Exatamente um contrato nasceu -- nenhuma duplicata.
    expect(await contarContratos("concorrente")).toBe(1);

    const [linha] = await runSql<{ status: string; id_contrato_gerado: number }>(
      `SELECT status, id_contrato_gerado FROM fat_prospeccao WHERE id_prospeccao = ${idProspeccao};`
    );
    expect(linha.status).toBe("convertida");
    const idContratoVencedor = (sucesso[0] as PromiseFulfilledResult<number>).value;
    expect(linha.id_contrato_gerado).toBe(idContratoVencedor);
  }, 180000);

  it("AD-024 na pratica: mentor sem acesso a linha recebe 42501 e nenhum contrato nasce (prova que e INVOKER, nao DEFINER)", async () => {
    const client: SupabaseClient = createClient(URL, ANON_KEY);
    const { error: erroLogin } = await client.auth.signInWithPassword({
      email: MENTOR_EMAIL,
      password: PASSWORD,
    });
    expect(erroLogin).toBeNull();

    const { error } = await client.schema("app").rpc("converter_prospeccao", {
      p_id_prospeccao: prospeccoes.invoker,
      p_dt_inicio: new Date().toISOString().slice(0, 10),
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");

    expect(await contarContratos("invoker")).toBe(0);
    const [linha] = await runSql<{ status: string }>(
      `SELECT status FROM fat_prospeccao WHERE id_prospeccao = ${prospeccoes.invoker};`
    );
    expect(linha.status).toBe("aberta");
  }, 120000);
});
