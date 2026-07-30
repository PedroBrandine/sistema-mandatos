import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: T5 Done-when --
//  - 4 usuários de teste criados (um por papel_global)
//  - Para cada um: app.papel_atual() retorna o papel esperado após autenticar
//  - Assessor não consegue SELECT em tabela negada por GRANT
//    (dim_usuario, no lugar do exemplo log_auditoria do task -- log_auditoria
//    é Fase 2/T13, fora do escopo deste batch; dim_usuario já não tem GRANT
//    nenhum para legisla_assessor no schema aprovado -- ver T3)
//
// This validates Phase 0 as a whole: the auth hook (T1) sets the `role`
// claim, PostgREST switches role accordingly (T3's GRANTs to authenticator),
// and the pre-request hook (T2/T4 wiring) sets app.id_usuario so
// app.papel_atual()/RLS resolve correctly for the rest of the request.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "T5-session-test-P4ssword!";

const USERS = [
  { papel: "gestora", email: "t5-session-gestora@legislabrasil.test" },
  { papel: "mentor", email: "t5-session-mentor@legislabrasil.test" },
  { papel: "assessor", email: "t5-session-assessor@legislabrasil.test" },
  { papel: "admin", email: "t5-session-admin@legislabrasil.test" },
] as const;

const admin = createClient(URL, SERVICE_ROLE_KEY);
const authUserIds: string[] = [];

async function signInAs(email: string) {
  const client = createClient(URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

describe("Fase 0 -- sessão fim-a-fim (4 papéis)", () => {
  beforeAll(async () => {
    // Best-effort cleanup of leftover auth users from a previous run that
    // didn't reach afterAll (e.g. a transient Management API failure mid-run,
    // observed against this project's Cloudflare-fronted API) -- otherwise
    // createUser below fails with "already registered" and the whole suite
    // can never recover on its own. Listing + deleting by email first makes
    // the suite idempotent across interrupted runs.
    const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const testEmails = new Set(USERS.map((u) => u.email));
    for (const user of existing?.users ?? []) {
      if (user.email && testEmails.has(user.email)) {
        await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      }
    }

    for (const u of USERS) {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: PASSWORD,
        email_confirm: true,
      });
      if (error) throw error;
      authUserIds.push(data.user.id);
    }

    await runSql(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo) VALUES
        ('${USERS[0].email}', 'Teste Gestora Sessao', 'gestora', true),
        ('${USERS[1].email}', 'Teste Mentor Sessao', 'mentor', true),
        ('${USERS[2].email}', 'Teste Assessor Sessao', 'assessor', true),
        ('${USERS[3].email}', 'Teste Admin Sessao', 'admin', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);
  });

  afterAll(async () => {
    await runSql(`DELETE FROM dim_usuario WHERE email IN (${USERS.map((u) => `'${u.email}'`).join(",")});`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  });

  it.each(USERS)("papel_atual() resolves to '$papel' after signing in as $email", async ({ papel, email }) => {
    const client = await signInAs(email);
    const { data, error } = await client.schema("app").rpc("papel_atual");
    expect(error).toBeNull();
    expect(data).toBe(papel);
  });

  it("assessor cannot SELECT dim_usuario -- denied by GRANT, not by RLS", async () => {
    const client = await signInAs(USERS.find((u) => u.papel === "assessor")!.email);
    const { data, error } = await client.from("dim_usuario").select("*");
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("gestora sees every dim_usuario row (RLS: papel_atual() IN admin/gestora)", async () => {
    const client = await signInAs(USERS.find((u) => u.papel === "gestora")!.email);
    const { data, error } = await client.from("dim_usuario").select("email");
    expect(error).toBeNull();
    const emails = (data ?? []).map((r: { email: string }) => r.email);
    for (const u of USERS) {
      expect(emails).toContain(u.email);
    }
  });

  it("mentor sees only their own dim_usuario row (RLS: id_usuario = app.id_usuario())", async () => {
    const mentorEmail = USERS.find((u) => u.papel === "mentor")!.email;
    const client = await signInAs(mentorEmail);
    const { data, error } = await client.from("dim_usuario").select("email");
    expect(error).toBeNull();
    expect((data ?? []).map((r: { email: string }) => r.email)).toEqual([mentorEmail]);
  });
});
