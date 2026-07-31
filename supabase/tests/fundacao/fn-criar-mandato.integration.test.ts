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
});
