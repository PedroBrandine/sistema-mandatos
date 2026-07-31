import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: T22 Done-when --
//  - SECURITY INVOKER
//  - Cria as 2 linhas na mesma transação
//  - Duplicata segue a mesma regra de T20 (mesma função auxiliar
//    app.contratante_similar, não reimplementada)
//  - Teste cobre: criação simples, duplicata bloqueada/ignorada
//  - Gate check passa: npm run test:integration
//
// spec.md FND-COL-01 (P2 AC1).

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "T22-criar-coalizao-P4ssword!";
const GESTORA_EMAIL = "t22-criar-coalizao-gestora@legislabrasil.test";

const admin = createClient(URL, SERVICE_ROLE_KEY);
const authUserIds: string[] = [];
let gestoraClient: SupabaseClient;
let idProjeto: number;

const contratanteIds: number[] = [];
const coalizaoIds: number[] = [];

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

describe("T22 -- app.criar_coalizao", () => {
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
      VALUES ('${GESTORA_EMAIL}', 'T22 Gestora', 'gestora', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);

    const [{ id_projeto }] = await runSql<{ id_projeto: number }>(`
      INSERT INTO ref_projeto (nome) VALUES ('T22 Projeto Teste') RETURNING id_projeto;
    `);
    idProjeto = id_projeto;

    gestoraClient = await signInAs(GESTORA_EMAIL);
  }, 60000);

  afterAll(async () => {
    if (coalizaoIds.length) {
      await runSql(`DELETE FROM dim_coalizao WHERE id_coalizao IN (${coalizaoIds.join(",")});`);
    }
    if (contratanteIds.length) {
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante IN (${contratanteIds.join(",")});`);
    }
    await runSql(`DELETE FROM ref_projeto WHERE id_projeto = ${idProjeto};`);
    const [{ id_usuario: idUsuarioGestora }] = await runSql<{ id_usuario: number }>(
      `SELECT id_usuario FROM dim_usuario WHERE email = '${GESTORA_EMAIL}';`
    );
    await runSql(`DELETE FROM log_auditoria WHERE id_usuario = ${idUsuarioGestora} OR id_usuario_impersonado = ${idUsuarioGestora};`);
    await runSql(`DELETE FROM dim_usuario WHERE email = '${GESTORA_EMAIL}';`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 60000);

  it("app.criar_coalizao is SECURITY INVOKER (prosecdef = false)", async () => {
    const rows = await runSql<{ prosecdef: boolean }>(`
      SELECT prosecdef FROM pg_proc
       WHERE pronamespace = 'app'::regnamespace AND proname = 'criar_coalizao';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].prosecdef).toBe(false);
  });

  it("creates dim_contratante (tipo_contratante='coalizao') + dim_coalizao in the same transaction", async () => {
    const { data, error } = await gestoraClient.schema("app").rpc("criar_coalizao", {
      p_contratante: { nome: "T22 Coalizao Simples" },
      p_coalizao: { id_projeto_origem: idProjeto, possui_planejamento_proprio: true },
    });
    expect(error).toBeNull();
    contratanteIds.push(data.id_contratante);
    coalizaoIds.push(data.id_coalizao);

    const [row] = await runSql<{
      tipo_contratante: string;
      nome: string;
      id_projeto_origem: number;
      possui_planejamento_proprio: boolean;
    }>(`
      SELECT c.tipo_contratante, c.nome, co.id_projeto_origem, co.possui_planejamento_proprio
        FROM dim_contratante c JOIN dim_coalizao co ON co.id_contratante = c.id_contratante
       WHERE c.id_contratante = ${data.id_contratante};
    `);
    expect(row.tipo_contratante).toBe("coalizao");
    expect(row.nome).toBe("T22 Coalizao Simples");
    expect(row.id_projeto_origem).toBe(idProjeto);
    expect(row.possui_planejamento_proprio).toBe(true);
  });

  it("blocks creation with MDU01 when a duplicate contratante exists (same rule as app.criar_mandato)", async () => {
    const first = await gestoraClient.schema("app").rpc("criar_coalizao", {
      p_contratante: { nome: "T22 Coalizao Duplicada", sg_uf: "SP" },
      p_coalizao: { possui_planejamento_proprio: false },
    });
    expect(first.error).toBeNull();
    contratanteIds.push(first.data.id_contratante);
    coalizaoIds.push(first.data.id_coalizao);

    const second = await gestoraClient.schema("app").rpc("criar_coalizao", {
      p_contratante: { nome: "T22 COALIZAO DUPLICADA", sg_uf: "SP" },
      p_coalizao: { possui_planejamento_proprio: false },
    });
    expect(second.data).toBeNull();
    expect(second.error).not.toBeNull();
    expect(second.error?.code).toBe("MDU01");
    const similares = JSON.parse(second.error!.details);
    expect(similares).toEqual([
      expect.objectContaining({ idContratante: first.data.id_contratante, nome: "T22 Coalizao Duplicada" }),
    ]);

    const count = await runSql<{ count: string }>(
      `SELECT count(*)::int AS count FROM dim_contratante WHERE nome = 'T22 COALIZAO DUPLICADA';`
    );
    expect(Number(count[0].count)).toBe(0);
  });

  it("proceeds and creates a second coalizao when p_ignorar_duplicata = true", async () => {
    const first = await gestoraClient.schema("app").rpc("criar_coalizao", {
      p_contratante: { nome: "T22 Coalizao Duplicada Ignorada" },
      p_coalizao: { possui_planejamento_proprio: false },
    });
    expect(first.error).toBeNull();
    contratanteIds.push(first.data.id_contratante);
    coalizaoIds.push(first.data.id_coalizao);

    const second = await gestoraClient.schema("app").rpc("criar_coalizao", {
      p_contratante: { nome: "T22 Coalizao Duplicada Ignorada" },
      p_coalizao: { possui_planejamento_proprio: false },
      p_ignorar_duplicata: true,
    });
    expect(second.error).toBeNull();
    contratanteIds.push(second.data.id_contratante);
    coalizaoIds.push(second.data.id_coalizao);
    expect(second.data.id_contratante).not.toBe(first.data.id_contratante);

    const count = await runSql<{ count: string }>(
      `SELECT count(*)::int AS count FROM dim_contratante WHERE nome = 'T22 Coalizao Duplicada Ignorada';`
    );
    expect(Number(count[0].count)).toBe(2);
  });
});
