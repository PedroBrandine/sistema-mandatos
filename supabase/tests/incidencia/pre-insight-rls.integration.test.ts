import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: fatos-geradores-ciclo-vida T1 Done-when
// (.specs/features/fatos-geradores-ciclo-vida/tasks.md), migration
// 20260916153343_incidencia_v2_pre_insight.sql --
//  - fat_pre_insight com autor NOT NULL + criado_em, escopada por id_contrato
//  - RLS habilitada + forçada + p_por_contrato no mesmo arquivo
//  - GRANTs concedidos (mesmos papéis de fat_insight)
//  - INSERT com usuário fora da carteira do contrato é negado pela RLS
//
// spec.md P1 "Pré-Insight como entidade" AC1 ("RLS no mesmo DDL, autor +
// timestamp") e Independent Test ("criar Pré-Insight com um usuário sem
// vínculo no contrato; a RLS recusa").

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "FGC-T1-pre-insight-P4ssword!";

const MENTOR_EMAIL = "fgc-t1-mentor@legislabrasil.test";
const FORA_EMAIL = "fgc-t1-fora@legislabrasil.test";

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

async function makeFixture(label: string): Promise<Fixture> {
  const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'FGC T1 ${label}')
    RETURNING id_contratante;
  `);
  const [{ id_contrato: idContrato }] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
    VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
    RETURNING id_contrato;
  `);
  return { idContratante, idContrato };
}

let a: Fixture; // carteira do mentor
let b: Fixture; // fora da carteira
let idUsuarioMentor: number;
const idsPreInsightCriados: number[] = [];

describe("fatos-geradores-ciclo-vida T1 -- fat_pre_insight (estrutura + RLS + GRANTs)", () => {
  beforeAll(async () => {
    const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of existing?.users ?? []) {
      if (user.email && [MENTOR_EMAIL, FORA_EMAIL].includes(user.email)) {
        await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      }
    }
    for (const email of [MENTOR_EMAIL, FORA_EMAIL]) {
      const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
      if (error) throw error;
      authUserIds.push(data.user.id);
    }
    await runSql(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo) VALUES
        ('${MENTOR_EMAIL}', 'FGC T1 Mentor', 'mentor', true),
        ('${FORA_EMAIL}', 'FGC T1 Fora', 'mentor', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);

    a = await makeFixture("A (carteira)");
    b = await makeFixture("B (fora da carteira)");

    await runSql(`
      INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
      SELECT ${a.idContrato}, id_usuario, 'mentor' FROM dim_usuario WHERE email = '${MENTOR_EMAIL}'
      ON CONFLICT (id_contrato, id_usuario, papel_no_contrato) DO NOTHING;
    `);

    idUsuarioMentor = (
      await runSql<{ id_usuario: number }>(`SELECT id_usuario FROM dim_usuario WHERE email = '${MENTOR_EMAIL}';`)
    )[0].id_usuario;
  }, 120000);

  afterAll(async () => {
    if (idsPreInsightCriados.length > 0) {
      await runSql(`DELETE FROM fat_pre_insight WHERE id_pre_insight IN (${idsPreInsightCriados.join(",")});`);
    }
    for (const f of [a, b]) {
      await runSql(`DELETE FROM fat_pre_insight WHERE id_contrato = ${f.idContrato};`);
    }
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
    await runSql(`
      DELETE FROM log_auditoria WHERE id_usuario IN (
        SELECT id_usuario FROM dim_usuario WHERE email IN ('${MENTOR_EMAIL}', '${FORA_EMAIL}')
      );
    `);
    await runSql(`DELETE FROM dim_usuario WHERE email IN ('${MENTOR_EMAIL}', '${FORA_EMAIL}');`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 120000);

  it("fat_pre_insight existe com id_usuario_autor NOT NULL, criado_em NOT NULL DEFAULT now(), id_contrato NOT NULL", async () => {
    const rows = await runSql<{ column_name: string; is_nullable: string; column_default: string | null }>(`
      SELECT column_name, is_nullable, column_default FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'fat_pre_insight'
         AND column_name IN ('id_contrato', 'id_usuario_autor', 'criado_em', 'conteudo');
    `);
    const porColuna = new Map(rows.map((r) => [r.column_name, r]));
    expect(porColuna.get("id_contrato")?.is_nullable).toBe("NO");
    expect(porColuna.get("id_usuario_autor")?.is_nullable).toBe("NO");
    expect(porColuna.get("conteudo")?.is_nullable).toBe("NO");
    expect(porColuna.get("criado_em")?.is_nullable).toBe("NO");
    expect(porColuna.get("criado_em")?.column_default).toContain("now()");
  });

  it("RLS habilitada + forçada, com política p_por_contrato com USING e WITH CHECK não nulos", async () => {
    const [classe] = await runSql<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
      SELECT relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relnamespace = 'public'::regnamespace AND relname = 'fat_pre_insight';
    `);
    expect(classe.relrowsecurity).toBe(true);
    expect(classe.relforcerowsecurity).toBe(true);

    const [policy] = await runSql<{ policyname: string; qual: string | null; with_check: string | null }>(`
      SELECT policyname, qual, with_check FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'fat_pre_insight';
    `);
    expect(policy.policyname).toBe("p_por_contrato");
    expect(policy.qual).not.toBeNull();
    expect(policy.with_check).not.toBeNull();
  });

  it("GRANT: legisla_mentor tem SELECT+INSERT+UPDATE e legisla_assessor tem SELECT+INSERT em fat_pre_insight (mesmos papéis de fat_insight)", async () => {
    const rows = await runSql<{ role: string; can_select: boolean; can_insert: boolean; can_update: boolean }>(`
      SELECT r.role,
             has_table_privilege(r.role, 'fat_pre_insight', 'SELECT') AS can_select,
             has_table_privilege(r.role, 'fat_pre_insight', 'INSERT') AS can_insert,
             has_table_privilege(r.role, 'fat_pre_insight', 'UPDATE') AS can_update
        FROM unnest(ARRAY['legisla_mentor','legisla_assessor']) AS r(role);
    `);
    const porRole = new Map(rows.map((r) => [r.role, r]));
    expect(porRole.get("legisla_mentor")?.can_select).toBe(true);
    expect(porRole.get("legisla_mentor")?.can_insert).toBe(true);
    expect(porRole.get("legisla_mentor")?.can_update).toBe(true);
    expect(porRole.get("legisla_assessor")?.can_select).toBe(true);
    expect(porRole.get("legisla_assessor")?.can_insert).toBe(true);
  });

  it("Mentor com vínculo no contrato (A) consegue INSERT (WITH CHECK positivo)", async () => {
    const client = await signInAs(MENTOR_EMAIL);
    const { data, error } = await client
      .from("fat_pre_insight")
      .insert({ id_contrato: a.idContrato, conteudo: "FGC T1 pre-insight A", id_usuario_autor: idUsuarioMentor })
      .select("id_pre_insight")
      .single();
    expect(error).toBeNull();
    expect(data?.id_pre_insight).toBeGreaterThan(0);
    if (data?.id_pre_insight) idsPreInsightCriados.push(data.id_pre_insight);
  });

  it("Mentor SEM vínculo no contrato (B) é negado (42501) ao tentar INSERT -- RLS recusa fora da carteira", async () => {
    const client = await signInAs(MENTOR_EMAIL);
    const { error } = await client
      .from("fat_pre_insight")
      .insert({ id_contrato: b.idContrato, conteudo: "FGC T1 pre-insight B", id_usuario_autor: idUsuarioMentor });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");

    const [{ count }] = await runSql<{ count: number }>(
      `SELECT count(*)::int AS count FROM fat_pre_insight WHERE id_contrato = ${b.idContrato};`
    );
    expect(count).toBe(0);
  });

  it("Mentor sem NENHUM vínculo (usuário 'fora') é negado (42501) tanto em A quanto em B -- RLS recusa quem não tem carteira alguma", async () => {
    const client = await signInAs(FORA_EMAIL);
    const idUsuarioFora = (
      await runSql<{ id_usuario: number }>(`SELECT id_usuario FROM dim_usuario WHERE email = '${FORA_EMAIL}';`)
    )[0].id_usuario;

    const resultadoA = await client
      .from("fat_pre_insight")
      .insert({ id_contrato: a.idContrato, conteudo: "FGC T1 pre-insight A (fora)", id_usuario_autor: idUsuarioFora });
    expect(resultadoA.error?.code).toBe("42501");

    const resultadoB = await client
      .from("fat_pre_insight")
      .insert({ id_contrato: b.idContrato, conteudo: "FGC T1 pre-insight B (fora)", id_usuario_autor: idUsuarioFora });
    expect(resultadoB.error?.code).toBe("42501");
  });
});
