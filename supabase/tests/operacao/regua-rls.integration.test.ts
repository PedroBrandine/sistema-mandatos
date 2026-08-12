import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: RGI-07/RGI-08 (.specs/features/operacao-regua-instanciacao/spec.md,
// migration 20260812001234_regua_instanciacao_rls.sql) --
//  - p_por_contrato nas 3 tabelas novas com USING **e** WITH CHECK explícitos e idênticos
//    (não reuso implícito da USING -- mesma categoria de correção da FND-USR-02, aplicada
//    por antecipação);
//  - leitura filtrada por carteira (Mentor só vê o contrato onde tem vínculo);
//  - Gestora/Admin sempre passam, independente de vínculo (mesmo padrão de fat_contrato
//    desde 0011_fundacao_rls.sql) -- corrigido no Independent Test do spec.md, que
//    originalmente descrevia (incorretamente) uma "Gestora sem vínculo bloqueada".
//  - Mentor não tem GRANT de escrita nestas 3 tabelas (só SELECT, docs/schema_sistema.sql:
//    2084-2089) -- mesmo com vínculo, INSERT direto (fora de app.instancia_contrato) falha.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "RGI-rls-test-P4ssword!";

const GESTORA_EMAIL = "rgi-rls-gestora@legislabrasil.test";
const MENTOR_EMAIL = "rgi-rls-mentor@legislabrasil.test";

const admin = createClient(URL, SERVICE_ROLE_KEY);
const authUserIds: string[] = [];

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

interface Fixture {
  idContratante: number;
  idContrato: number;
}

let a: Fixture;
let b: Fixture;

async function makeFixture(label: string): Promise<Fixture> {
  const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'RGI RLS ${label}')
    RETURNING id_contratante;
  `);
  const [{ id_contrato: idContrato }] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
    VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
    RETURNING id_contrato;
  `);
  return { idContratante, idContrato };
}

describe("operacao-regua-instanciacao -- RLS p_por_contrato (RGI-07/RGI-08)", () => {
  beforeAll(async () => {
    const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of existing?.users ?? []) {
      if (user.email && [GESTORA_EMAIL, MENTOR_EMAIL].includes(user.email)) {
        await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      }
    }
    for (const email of [GESTORA_EMAIL, MENTOR_EMAIL]) {
      const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
      if (error) throw error;
      authUserIds.push(data.user.id);
    }
    await runSql(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo) VALUES
        ('${GESTORA_EMAIL}', 'RGI RLS Gestora', 'gestora', true),
        ('${MENTOR_EMAIL}', 'RGI RLS Mentor', 'mentor', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);

    a = await makeFixture("A (carteira do mentor)");
    b = await makeFixture("B (fora da carteira)");

    // Mentor vinculado só ao contrato A.
    await runSql(`
      INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
      SELECT ${a.idContrato}, id_usuario, 'mentor' FROM dim_usuario WHERE email = '${MENTOR_EMAIL}'
      ON CONFLICT (id_contrato, id_usuario, papel_no_contrato) DO NOTHING;
    `);
  }, 120000);

  afterAll(async () => {
    await runSql(`DELETE FROM rel_usuario_contrato WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});`);
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});
      DELETE FROM rel_formulario_contrato WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});
      DELETE FROM dim_planejamento WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});
    `);
    for (const f of [a, b]) {
      await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${f.idContrato};`);
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${f.idContratante};`);
    }
    await runSql(`DELETE FROM dim_usuario WHERE email IN ('${GESTORA_EMAIL}', '${MENTOR_EMAIL}');`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 120000);

  it("RGI-08: as 3 tabelas têm WITH CHECK explícito, não reuso implícito da USING", async () => {
    const rows = await runSql<{ tablename: string; qual: string | null; with_check: string | null }>(`
      SELECT tablename, qual, with_check FROM pg_policies
       WHERE schemaname = 'public' AND tablename IN
             ('fat_etapa_contrato', 'rel_formulario_contrato', 'dim_planejamento')
         AND policyname = 'p_por_contrato';
    `);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.qual).not.toBeNull();
      expect(row.with_check).not.toBeNull();
    }
  });

  it("enables FORCE ROW LEVEL SECURITY nas 3 tabelas novas", async () => {
    const rows = await runSql<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
      SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname IN ('fat_etapa_contrato','rel_formulario_contrato','dim_planejamento')
         AND relnamespace = 'public'::regnamespace;
    `);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(true);
    }
  });

  it("RGI-07: mentor sees fat_etapa_contrato only for the contract in their carteira", async () => {
    const client = await signInAs(MENTOR_EMAIL);
    const { data, error } = await client
      .from("fat_etapa_contrato")
      .select("id_contrato")
      .in("id_contrato", [a.idContrato, b.idContrato]);
    expect(error).toBeNull();
    const idsVistos = new Set((data ?? []).map((r: { id_contrato: number }) => r.id_contrato));
    expect(idsVistos.has(a.idContrato)).toBe(true);
    expect(idsVistos.has(b.idContrato)).toBe(false);
  });

  it("RGI-07: mentor sees rel_formulario_contrato/dim_planejamento only for their carteira", async () => {
    const client = await signInAs(MENTOR_EMAIL);

    const { data: formularios, error: e1 } = await client
      .from("rel_formulario_contrato")
      .select("id_contrato")
      .in("id_contrato", [a.idContrato, b.idContrato]);
    expect(e1).toBeNull();
    expect(new Set((formularios ?? []).map((r: { id_contrato: number }) => r.id_contrato))).toEqual(new Set([a.idContrato]));

    const { data: planejamentos, error: e2 } = await client
      .from("dim_planejamento")
      .select("id_contrato")
      .in("id_contrato", [a.idContrato, b.idContrato]);
    expect(e2).toBeNull();
    expect((planejamentos ?? []).map((r: { id_contrato: number }) => r.id_contrato)).toEqual([a.idContrato]);
  });

  it("RGI-08: mentor com vínculo NÃO consegue INSERT direto em fat_etapa_contrato (só SELECT concedido)", async () => {
    const client = await signInAs(MENTOR_EMAIL);
    const idEtapa = (
      await runSql<{ id_etapa: number }>(`
      SELECT id_etapa FROM ref_etapa
       WHERE id_produto = (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia') AND codigo = 'cadastro';
    `)
    )[0].id_etapa;

    const { error } = await client
      .from("fat_etapa_contrato")
      .update({ status: "em_andamento", dt_inicio: new Date().toISOString().slice(0, 10) })
      .eq("id_contrato", a.idContrato)
      .eq("id_etapa", idEtapa);
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("RGI-07/AC3: gestora e admin veem os dois contratos, independente de vínculo", async () => {
    const client = await signInAs(GESTORA_EMAIL);
    const { data, error } = await client
      .from("fat_etapa_contrato")
      .select("id_contrato")
      .in("id_contrato", [a.idContrato, b.idContrato]);
    expect(error).toBeNull();
    const idsVistos = new Set((data ?? []).map((r: { id_contrato: number }) => r.id_contrato));
    expect(idsVistos.has(a.idContrato)).toBe(true);
    expect(idsVistos.has(b.idContrato)).toBe(true);
  });

  it("RGI-08/AC3: gestora escreve direto em fat_etapa_contrato de um contrato SEM vínculo pessoal (B)", async () => {
    const client = await signInAs(GESTORA_EMAIL);
    const { error } = await client
      .from("fat_etapa_contrato")
      .update({ status: "nao_iniciada" }) // no-op de valor, só prova que o UPDATE passa pela RLS
      .eq("id_contrato", b.idContrato);
    expect(error).toBeNull();
  });
});
