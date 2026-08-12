import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: T20 Done-when --
//  - SECURITY INVOKER (padrão -- não declara SECURITY DEFINER)
//  - Cria as 3 linhas (ou 2, sem candidatura) na mesma transação
//  - Levanta MDU01 com similares quando há duplicata e p_ignorar_duplicata=false
//  - Prossegue normalmente quando p_ignorar_duplicata=true
//  - Teste cobre: criação sem candidatura (manual), com candidatura, duplicata
//    bloqueada, duplicata ignorada
//  - Gate check passa: npm run test:integration
//
// spec.md FND-TSE-01/02/05/06 (P1 AC2, AC5, AC6).

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "T20-criar-mandato-P4ssword!";
const GESTORA_EMAIL = "t20-criar-mandato-gestora@legislabrasil.test";

const admin = createClient(URL, SERVICE_ROLE_KEY);
const authUserIds: string[] = [];
let gestoraClient: SupabaseClient;
let idUsuarioGestora: number;

const contratanteIds: number[] = [];
const mandatoIds: number[] = [];
const candidaturaIds: number[] = [];

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

describe("T20 -- app.criar_mandato", () => {
  beforeAll(async () => {
    const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of existing?.users ?? []) {
      if (user.email === GESTORA_EMAIL) {
        await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      }
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: GESTORA_EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    authUserIds.push(data.user.id);

    await runSql(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo)
      VALUES ('${GESTORA_EMAIL}', 'T20 Gestora', 'gestora', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);
    const [{ id_usuario }] = await runSql<{ id_usuario: number }>(
      `SELECT id_usuario FROM dim_usuario WHERE email = '${GESTORA_EMAIL}';`
    );
    idUsuarioGestora = id_usuario;

    gestoraClient = await signInAs(GESTORA_EMAIL);
  }, 60000);

  afterAll(async () => {
    if (candidaturaIds.length) {
      await runSql(`DELETE FROM rel_mandato_candidatura WHERE id_vinculo_tse IN (${candidaturaIds.join(",")});`);
    }
    if (mandatoIds.length) {
      await runSql(`DELETE FROM dim_mandato WHERE id_mandato IN (${mandatoIds.join(",")});`);
    }
    if (contratanteIds.length) {
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante IN (${contratanteIds.join(",")});`);
    }
    // The RPC calls in this file write as the authenticated gestora, so
    // app.trg_auditoria() logs her as id_usuario on every audited insert --
    // log_auditoria has no FK cascade, so it must be cleared before the
    // dim_usuario row itself can be deleted.
    await runSql(`DELETE FROM log_auditoria WHERE id_usuario = ${idUsuarioGestora} OR id_usuario_impersonado = ${idUsuarioGestora};`);
    await runSql(`DELETE FROM dim_usuario WHERE email = '${GESTORA_EMAIL}';`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 60000);

  it("app.criar_mandato and app.contratante_similar are SECURITY INVOKER (prosecdef = false)", async () => {
    const rows = await runSql<{ proname: string; prosecdef: boolean }>(`
      SELECT proname, prosecdef FROM pg_proc
       WHERE pronamespace = 'app'::regnamespace AND proname IN ('criar_mandato', 'contratante_similar');
    `);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.prosecdef).toBe(false);
    }
  });

  it("creates dim_contratante + dim_mandato without a candidatura (manual registration)", async () => {
    const { data, error } = await gestoraClient.schema("app").rpc("criar_mandato", {
      p_contratante: { nome: "T20 Mandato Manual", sg_uf: "SP", nm_municipio: "Campinas" },
      p_mandato: { nm_urna: "Fulano Manual" },
    });
    expect(error).toBeNull();
    contratanteIds.push(data.id_contratante);
    mandatoIds.push(data.id_mandato);

    expect(data.id_vinculo_tse).toBeNull();

    const [row] = await runSql<{ tipo_contratante: string; nome: string; origem_partido_cargo: string; nm_urna: string }>(`
      SELECT c.tipo_contratante, c.nome, m.origem_partido_cargo, m.nm_urna
        FROM dim_contratante c JOIN dim_mandato m ON m.id_contratante = c.id_contratante
       WHERE c.id_contratante = ${data.id_contratante};
    `);
    expect(row.tipo_contratante).toBe("mandato");
    expect(row.nome).toBe("T20 Mandato Manual");
    expect(row.origem_partido_cargo).toBe("manual");
    expect(row.nm_urna).toBe("Fulano Manual");

    const candidaturas = await runSql(`SELECT 1 FROM rel_mandato_candidatura WHERE id_mandato = ${data.id_mandato};`);
    expect(candidaturas).toHaveLength(0);
  });

  it("creates dim_contratante + dim_mandato + rel_mandato_candidatura when a candidatura is confirmed", async () => {
    const { data, error } = await gestoraClient.schema("app").rpc("criar_mandato", {
      p_contratante: { nome: "T20 Mandato Com Candidatura", sg_uf: "RJ" },
      p_mandato: { nm_urna: "Fulano TSE" },
      p_candidatura: { ano_eleicao: 2022, sq_candidato: 920001, nr_turno: 1, metodo_match: "nome_uf_cargo", confianca: "alta" },
    });
    expect(error).toBeNull();
    contratanteIds.push(data.id_contratante);
    mandatoIds.push(data.id_mandato);
    expect(data.id_vinculo_tse).not.toBeNull();
    candidaturaIds.push(data.id_vinculo_tse);

    const [mandatoRow] = await runSql<{ origem_partido_cargo: string }>(
      `SELECT origem_partido_cargo FROM dim_mandato WHERE id_mandato = ${data.id_mandato};`
    );
    expect(mandatoRow.origem_partido_cargo).toBe("tse");

    const [candRow] = await runSql<{
      status: string;
      eh_mandato_vigente: boolean;
      id_usuario_validou: number;
      validado_em: string | null;
      metodo_match: string;
      confianca: string;
    }>(`
      SELECT status, eh_mandato_vigente, id_usuario_validou, validado_em, metodo_match, confianca
        FROM rel_mandato_candidatura WHERE id_vinculo_tse = ${data.id_vinculo_tse};
    `);
    expect(candRow.status).toBe("confirmado");
    expect(candRow.eh_mandato_vigente).toBe(false);
    expect(candRow.id_usuario_validou).toBe(idUsuarioGestora);
    expect(candRow.validado_em).not.toBeNull();
    expect(candRow.metodo_match).toBe("nome_uf_cargo");
    expect(candRow.confianca).toBe("alta");
  });

  it("blocks creation with MDU01 and the list of similares when a duplicate contratante exists", async () => {
    const first = await gestoraClient.schema("app").rpc("criar_mandato", {
      p_contratante: { nome: "T20 Mandato Duplicado", sg_uf: "MG", nm_municipio: "Belo Horizonte" },
      p_mandato: {},
    });
    expect(first.error).toBeNull();
    contratanteIds.push(first.data.id_contratante);
    mandatoIds.push(first.data.id_mandato);

    const second = await gestoraClient.schema("app").rpc("criar_mandato", {
      p_contratante: { nome: "T20 MANDATO DUPLICADO", sg_uf: "MG", nm_municipio: "Belo Horizonte" },
      p_mandato: {},
    });
    expect(second.data).toBeNull();
    expect(second.error).not.toBeNull();
    expect(second.error?.code).toBe("MDU01");
    const similares = JSON.parse(second.error!.details);
    expect(similares).toEqual([
      expect.objectContaining({ idContratante: first.data.id_contratante, nome: "T20 Mandato Duplicado" }),
    ]);

    const count = await runSql<{ count: string }>(
      `SELECT count(*)::int AS count FROM dim_contratante WHERE nome = 'T20 MANDATO DUPLICADO';`
    );
    expect(Number(count[0].count)).toBe(0);
  });

  it("proceeds and creates a second contratante when p_ignorar_duplicata = true", async () => {
    const first = await gestoraClient.schema("app").rpc("criar_mandato", {
      p_contratante: { nome: "T20 Mandato Duplicado Ignorado", sg_uf: "PR" },
      p_mandato: {},
    });
    expect(first.error).toBeNull();
    contratanteIds.push(first.data.id_contratante);
    mandatoIds.push(first.data.id_mandato);

    const second = await gestoraClient.schema("app").rpc("criar_mandato", {
      p_contratante: { nome: "T20 Mandato Duplicado Ignorado", sg_uf: "PR" },
      p_mandato: {},
      p_ignorar_duplicata: true,
    });
    expect(second.error).toBeNull();
    contratanteIds.push(second.data.id_contratante);
    mandatoIds.push(second.data.id_mandato);
    expect(second.data.id_contratante).not.toBe(first.data.id_contratante);

    const count = await runSql<{ count: string }>(
      `SELECT count(*)::int AS count FROM dim_contratante WHERE nome = 'T20 Mandato Duplicado Ignorado';`
    );
    expect(Number(count[0].count)).toBe(2);
  });

  // CMU-01 AC3, CMU-02, CMU-05 AC3/AC5, CMU-06, CMU-07 (0022_cadastro_mandato_contrato_unificado.sql):
  // p_contrato, p_coalizao e p_id_contratante_existente -- o path novo que a migration 0022
  // acrescentou a esta mesma função e que, até esta rodada de Validate, não tinha nenhum teste
  // automatizado (unit nem integration) exercitando-o (validation.md, Gap #1).
  describe("p_contrato / p_coalizao / p_id_contratante_existente (CMU-01/02/05/06/07)", () => {
    let idProdutoEstrategia: number;
    let idContratanteCoalizao: number;
    let idCoalizao: number;
    const contratosIds: number[] = [];
    const membrosCoalizaoIds: number[] = [];

    beforeAll(async () => {
      const [{ id_produto }] = await runSql<{ id_produto: number }>(
        `SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia';`
      );
      idProdutoEstrategia = id_produto;

      const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
        INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('coalizao', 'T20 CMU Coalizao Fixture')
        RETURNING id_contratante;
      `);
      idContratanteCoalizao = id_contratante;
      const [{ id_coalizao }] = await runSql<{ id_coalizao: number }>(
        `INSERT INTO dim_coalizao (id_contratante) VALUES (${idContratanteCoalizao}) RETURNING id_coalizao;`
      );
      idCoalizao = id_coalizao;
    }, 60000);

    afterAll(async () => {
      if (membrosCoalizaoIds.length) {
        await runSql(`DELETE FROM rel_coalizao_membro WHERE id_membro IN (${membrosCoalizaoIds.join(",")});`);
      }
      if (contratosIds.length) {
        // operacao-regua-instanciacao: trigger AFTER INSERT em fat_contrato
        // agora popula fat_etapa_contrato/rel_formulario_contrato/dim_planejamento
        // (ON DELETE RESTRICT) -- precisam sair antes de fat_contrato. 1
        // round-trip para os 3, não 3, pra caber no hookTimeout.
        await runSql(`
          DELETE FROM fat_etapa_contrato WHERE id_contrato IN (${contratosIds.join(",")});
          DELETE FROM rel_formulario_contrato WHERE id_contrato IN (${contratosIds.join(",")});
          DELETE FROM dim_planejamento WHERE id_contrato IN (${contratosIds.join(",")});
        `);
        await runSql(`DELETE FROM fat_contrato WHERE id_contrato IN (${contratosIds.join(",")});`);
      }
      await runSql(`DELETE FROM dim_coalizao WHERE id_coalizao = ${idCoalizao};`);
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratanteCoalizao};`);
    }, 60000);

    it("CMU-05/06: creates fat_contrato together with a new mandato in the same call (p_contrato)", async () => {
      const { data, error } = await gestoraClient.schema("app").rpc("criar_mandato", {
        p_contratante: { nome: "T20 CMU Mandato Com Contrato", sg_uf: "SP" },
        p_mandato: {},
        p_contrato: { id_produto: idProdutoEstrategia, dt_inicio: "2026-01-01" },
      });
      expect(error).toBeNull();
      contratanteIds.push(data.id_contratante);
      mandatoIds.push(data.id_mandato);
      expect(data.id_contrato).not.toBeNull();
      contratosIds.push(data.id_contrato);

      const [row] = await runSql<{ id_contratante: number; id_produto: number; status: string }>(`
        SELECT id_contratante, id_produto, status FROM fat_contrato WHERE id_contrato = ${data.id_contrato};
      `);
      expect(row.id_contratante).toBe(data.id_contratante);
      expect(row.id_produto).toBe(idProdutoEstrategia);
      expect(row.status).toBe("ativo");
    });

    it("CMU-01/02: opens a second fat_contrato for an existing mandato via p_id_contratante_existente, without a new dim_contratante/dim_mandato row", async () => {
      const primeiro = await gestoraClient.schema("app").rpc("criar_mandato", {
        p_contratante: { nome: "T20 CMU Mandato Existente", sg_uf: "RS" },
        p_mandato: {},
      });
      expect(primeiro.error).toBeNull();
      contratanteIds.push(primeiro.data.id_contratante);
      mandatoIds.push(primeiro.data.id_mandato);

      const segundo = await gestoraClient.schema("app").rpc("criar_mandato", {
        p_id_contratante_existente: primeiro.data.id_contratante,
        p_contrato: { id_produto: idProdutoEstrategia, dt_inicio: "2026-02-01" },
      });
      expect(segundo.error).toBeNull();
      expect(segundo.data.id_contratante).toBe(primeiro.data.id_contratante);
      expect(segundo.data.id_mandato).toBe(primeiro.data.id_mandato);
      expect(segundo.data.id_contrato).not.toBeNull();
      contratosIds.push(segundo.data.id_contrato);

      const countMandato = await runSql<{ count: string }>(
        `SELECT count(*)::int AS count FROM dim_mandato WHERE id_contratante = ${primeiro.data.id_contratante};`
      );
      expect(Number(countMandato[0].count)).toBe(1);

      const contratosDoMandato = await runSql<{ id_contrato: number }>(
        `SELECT id_contrato FROM fat_contrato WHERE id_contratante = ${primeiro.data.id_contratante} ORDER BY id_contrato;`
      );
      expect(contratosDoMandato).toHaveLength(1);
      expect(contratosDoMandato[0].id_contrato).toBe(segundo.data.id_contrato);
    });

    it("CMU-05: creates rel_coalizao_membro together with fat_contrato when p_coalizao is given", async () => {
      const { data, error } = await gestoraClient.schema("app").rpc("criar_mandato", {
        p_contratante: { nome: "T20 CMU Mandato Com Coalizao", sg_uf: "BA" },
        p_mandato: {},
        p_contrato: { id_produto: idProdutoEstrategia, dt_inicio: "2026-03-01" },
        p_coalizao: { id_coalizao: idCoalizao, papel: "membro" },
      });
      expect(error).toBeNull();
      contratanteIds.push(data.id_contratante);
      mandatoIds.push(data.id_mandato);
      contratosIds.push(data.id_contrato);

      const [row] = await runSql<{ id_coalizao: number; id_membro: number; papel: string }>(`
        SELECT id_coalizao, id_membro, papel FROM rel_coalizao_membro WHERE id_contrato = ${data.id_contrato};
      `);
      expect(row.id_coalizao).toBe(idCoalizao);
      expect(row.papel).toBe("membro");
      membrosCoalizaoIds.push(row.id_membro);
    });

    it("CMU-05/06 AC5: rolls back the whole call (no dim_contratante left) when p_coalizao references a non-existent id_coalizao", async () => {
      const nomeTentativa = "T20 CMU Mandato Rollback Coalizao Invalida";
      const { data, error } = await gestoraClient.schema("app").rpc("criar_mandato", {
        p_contratante: { nome: nomeTentativa, sg_uf: "PE" },
        p_mandato: {},
        p_contrato: { id_produto: idProdutoEstrategia, dt_inicio: "2026-04-01" },
        p_coalizao: { id_coalizao: 999999999, papel: "membro" },
      });
      expect(data).toBeNull();
      expect(error).not.toBeNull();

      const count = await runSql<{ count: string }>(
        `SELECT count(*)::int AS count FROM dim_contratante WHERE nome = '${nomeTentativa}';`
      );
      expect(Number(count[0].count)).toBe(0);
    });
  });
});
