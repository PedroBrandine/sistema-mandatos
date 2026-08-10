import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: FND-USR-02 (.specs/roadmap.md §1.5 / Trilha E; migration
// 20260810181508_fix_with_check_p_usuario.sql) --
//  - Sem WITH CHECK explícito, p_usuario reaproveitava a USING como critério
//    de escrita, que só testa o papel de QUEM escreve, nunca o papel_global
//    da linha escrita -- uma Gestora conseguia INSERT com papel_global
//    'gestora' OU 'admin' (escalonamento de privilégio via RLS).
//  - Este teste prova o fechamento: Gestora não escreve 'gestora'/'admin',
//    mas continua escrevendo 'mentor'/'assessor' (nenhuma regressão na
//    UsuarioForm); Admin continua livre para qualquer papel_global.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "FND-USR-02-test-P4ssword!";

const GESTORA_EMAIL = "fnd-usr-02-gestora@legislabrasil.test";
const ADMIN_EMAIL = "fnd-usr-02-admin@legislabrasil.test";

const admin = createClient(URL, SERVICE_ROLE_KEY);
const authUserIds: string[] = [];
const criadosNoTeste: string[] = []; // e-mails de dim_usuario criados pelas próprias assertions

async function signInAs(email: string) {
  const client = createClient(URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

describe("FND-USR-02 -- WITH CHECK de p_usuario impede escalonamento de privilégio", () => {
  beforeAll(async () => {
    const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of existing?.users ?? []) {
      if (user.email && [GESTORA_EMAIL, ADMIN_EMAIL].includes(user.email)) {
        await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      }
    }
    for (const email of [GESTORA_EMAIL, ADMIN_EMAIL]) {
      const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
      if (error) throw error;
      authUserIds.push(data.user.id);
    }
    await runSql(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo) VALUES
        ('${GESTORA_EMAIL}', 'FND-USR-02 Gestora', 'gestora', true),
        ('${ADMIN_EMAIL}', 'FND-USR-02 Admin', 'admin', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);
  });

  afterAll(async () => {
    if (criadosNoTeste.length > 0) {
      await runSql(`DELETE FROM dim_usuario WHERE email IN (${criadosNoTeste.map((e) => `'${e}'`).join(",")});`);
    }
    await runSql(`DELETE FROM dim_usuario WHERE email IN ('${GESTORA_EMAIL}', '${ADMIN_EMAIL}');`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  });

  it("gestora NÃO consegue criar outra linha com papel_global 'gestora' (42501)", async () => {
    const client = await signInAs(GESTORA_EMAIL);
    const email = "fnd-usr-02-escalada-gestora@legislabrasil.test";
    const { error } = await client
      .from("dim_usuario")
      .insert({ email, nome: "Tentativa Escalada", papel_global: "gestora" });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("gestora NÃO consegue criar linha com papel_global 'admin' (42501)", async () => {
    const client = await signInAs(GESTORA_EMAIL);
    const email = "fnd-usr-02-escalada-admin@legislabrasil.test";
    const { error } = await client
      .from("dim_usuario")
      .insert({ email, nome: "Tentativa Escalada Admin", papel_global: "admin" });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("gestora continua conseguindo criar 'assessor' normalmente (sem regressão)", async () => {
    const client = await signInAs(GESTORA_EMAIL);
    const email = "fnd-usr-02-assessor-ok@legislabrasil.test";
    const { error } = await client
      .from("dim_usuario")
      .insert({ email, nome: "Assessor Legítimo", papel_global: "assessor" });
    expect(error).toBeNull();
    criadosNoTeste.push(email);
  });

  it("admin consegue criar 'gestora' normalmente (caminho legítimo continua livre)", async () => {
    const client = await signInAs(ADMIN_EMAIL);
    const email = "fnd-usr-02-gestora-via-admin@legislabrasil.test";
    const { error } = await client
      .from("dim_usuario")
      .insert({ email, nome: "Gestora Legítima", papel_global: "gestora" });
    expect(error).toBeNull();
    criadosNoTeste.push(email);
  });
});
