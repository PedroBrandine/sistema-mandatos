import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/spec.md, EST-04
// AC6 ("WHEN a usuaria nao tem permissao de leitura sobre a prospeccao THEN a
// RLS SHALL impedir a leitura no banco") + AD-001/AD-002. tasks.md T6
// "Done when":
//  - RLS habilitada; leitura permitida a Gestora/Admin e ao id_usuario_resp;
//    negada as demais
//  - Escrita restrita as roles que podem criar contrato; anon sem nenhum
//    privilegio
//  - Teste com sessao JWT real por papel, nao so has_table_privilege
//
// has_table_privilege prova GRANT, nao politica de linha -- por isso o corte
// por pessoa e exercitado com login de verdade (mesmo mecanismo de
// supabase/tests/operacao/regua-rls.integration.test.ts), e has_table_privilege
// aparece apenas onde a pergunta e mesmo de GRANT (a matriz de escrita).
//
// Migracao: 20260911024602_estrategia_fat_prospeccao_rls.sql.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "EST-t6-prospeccao-rls-P4ssword!";

const GESTORA_EMAIL = "est-t6-prospeccao-gestora@legislabrasil.test";
const MENTOR_RESP_EMAIL = "est-t6-prospeccao-mentor-resp@legislabrasil.test";
const MENTOR_OUTRO_EMAIL = "est-t6-prospeccao-mentor-outro@legislabrasil.test";
const EMAILS = [GESTORA_EMAIL, MENTOR_RESP_EMAIL, MENTOR_OUTRO_EMAIL];

const admin = createClient(URL, SERVICE_ROLE_KEY);
const authUserIds: string[] = [];

let idProduto: number;
let idUsuarioMentorResp: number;
let idUsuarioMentorOutro: number;
let idContratanteA: number;
let idContratanteB: number;
let idContratanteC: number;
let idContratanteD: number;
let idProspeccaoA: number;
let idProspeccaoB: number;

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

async function criarContratante(nome: string): Promise<number> {
  const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', '${nome}')
    RETURNING id_contratante;
  `);
  return id_contratante;
}

describe("fat_prospeccao -- RLS por id_usuario_resp e GRANTs (EST-04 AC6, AD-001, AD-002)", () => {
  beforeAll(async () => {
    const { data: existentes } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of existentes?.users ?? []) {
      if (user.email && EMAILS.includes(user.email)) {
        await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      }
    }
    for (const email of EMAILS) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
      });
      if (error) throw error;
      authUserIds.push(data.user.id);
    }

    await runSql(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo) VALUES
        ('${GESTORA_EMAIL}', 'EST T6 Gestora', 'gestora', true),
        ('${MENTOR_RESP_EMAIL}', 'EST T6 Mentor Responsavel', 'mentor', true),
        ('${MENTOR_OUTRO_EMAIL}', 'EST T6 Mentor Outro', 'mentor', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);

    const usuarios = await runSql<{ email: string; id_usuario: number }>(`
      SELECT email, id_usuario FROM dim_usuario
       WHERE email IN ('${MENTOR_RESP_EMAIL}', '${MENTOR_OUTRO_EMAIL}');
    `);
    const porEmail = Object.fromEntries(usuarios.map((u) => [u.email, u.id_usuario]));
    idUsuarioMentorResp = porEmail[MENTOR_RESP_EMAIL];
    idUsuarioMentorOutro = porEmail[MENTOR_OUTRO_EMAIL];

    const [{ id_produto }] = await runSql<{ id_produto: number }>(
      `SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia';`
    );
    idProduto = id_produto;

    // Contratantes distintos: uq_prospeccao_aberta_contratante (T5) proibe
    // duas prospeccoes abertas do mesmo contratante no mesmo produto.
    idContratanteA = await criarContratante("EST T6 RLS Contratante A");
    idContratanteB = await criarContratante("EST T6 RLS Contratante B");
    idContratanteC = await criarContratante("EST T6 RLS Contratante C");
    idContratanteD = await criarContratante("EST T6 RLS Contratante D");

    const [{ id_prospeccao: a }] = await runSql<{ id_prospeccao: number }>(`
      INSERT INTO fat_prospeccao (id_contratante, id_produto, id_usuario_resp)
      VALUES (${idContratanteA}, ${idProduto}, ${idUsuarioMentorResp})
      RETURNING id_prospeccao;
    `);
    idProspeccaoA = a;
    const [{ id_prospeccao: b }] = await runSql<{ id_prospeccao: number }>(`
      INSERT INTO fat_prospeccao (id_contratante, id_produto, id_usuario_resp)
      VALUES (${idContratanteB}, ${idProduto}, ${idUsuarioMentorOutro})
      RETURNING id_prospeccao;
    `);
    idProspeccaoB = b;
  }, 180000);

  afterAll(async () => {
    await runSql(`
      DELETE FROM fat_prospeccao
       WHERE id_contratante IN (${idContratanteA}, ${idContratanteB}, ${idContratanteC}, ${idContratanteD});
    `);
    await runSql(`
      DELETE FROM dim_contratante
       WHERE id_contratante IN (${idContratanteA}, ${idContratanteB}, ${idContratanteC}, ${idContratanteD});
    `);
    // A escrita feita pela sessao real da gestora e auditada por
    // app.trg_auditoria (AD-006), e log_auditoria.id_usuario tem FK para
    // dim_usuario -- apagar o usuario de fixture antes do log falha com
    // 23503. Mesmo cleanup de supabase/tests/fundacao/fn-substituir-vinculo.integration.test.ts:115.
    const idsUsuarios = await runSql<{ id_usuario: number }>(
      `SELECT id_usuario FROM dim_usuario WHERE email IN (${EMAILS.map((e) => `'${e}'`).join(", ")});`
    );
    const idList = idsUsuarios.map((r) => r.id_usuario).join(",");
    if (idList.length > 0) {
      await runSql(
        `DELETE FROM log_auditoria WHERE id_usuario IN (${idList}) OR id_usuario_impersonado IN (${idList});`
      );
    }
    await runSql(`DELETE FROM dim_usuario WHERE email IN (${EMAILS.map((e) => `'${e}'`).join(", ")});`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 180000);

  it("AD-001: RLS habilitada e forcada em fat_prospeccao", async () => {
    const [row] = await runSql<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
      SELECT relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relkind = 'r' AND relname = 'fat_prospeccao'
         AND relnamespace = 'public'::regnamespace;
    `);
    expect(row.relrowsecurity).toBe(true);
    expect(row.relforcerowsecurity).toBe(true);
  });

  it("p_prospeccao_propria tem USING e WITH CHECK explicitos, ambos sobre id_usuario_resp e papel global", async () => {
    const rows = await runSql<{ policyname: string; qual: string | null; with_check: string | null }>(`
      SELECT policyname, qual, with_check FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'fat_prospeccao';
    `);
    expect(rows.map((r) => r.policyname)).toEqual(["p_prospeccao_propria"]);
    expect(rows[0].qual).not.toBeNull();
    expect(rows[0].with_check).not.toBeNull();
    expect(rows[0].qual).toContain("id_usuario_resp");
    expect(rows[0].qual).toContain("papel_atual");
    expect(rows[0].with_check).toContain("id_usuario_resp");
    expect(rows[0].with_check).toContain("papel_atual");
  });

  it("EST-04 AC6: mentor responsavel LE a propria prospeccao e NAO le a do outro mentor", async () => {
    const client = await signInAs(MENTOR_RESP_EMAIL);
    const { data, error } = await client
      .from("fat_prospeccao")
      .select("id_prospeccao")
      .in("id_prospeccao", [idProspeccaoA, idProspeccaoB]);
    expect(error).toBeNull();
    const vistos = (data ?? []).map((r: { id_prospeccao: number }) => r.id_prospeccao);
    expect(vistos).toEqual([idProspeccaoA]);
  });

  it("EST-04 AC6: o outro mentor le apenas a prospeccao de que e responsavel (o lado simetrico)", async () => {
    const client = await signInAs(MENTOR_OUTRO_EMAIL);
    const { data, error } = await client
      .from("fat_prospeccao")
      .select("id_prospeccao")
      .in("id_prospeccao", [idProspeccaoA, idProspeccaoB]);
    expect(error).toBeNull();
    const vistos = (data ?? []).map((r: { id_prospeccao: number }) => r.id_prospeccao);
    expect(vistos).toEqual([idProspeccaoB]);
  });

  it("EST-04 AC6: gestora le as duas prospeccoes, sem ser responsavel por nenhuma", async () => {
    const client = await signInAs(GESTORA_EMAIL);
    const { data, error } = await client
      .from("fat_prospeccao")
      .select("id_prospeccao, id_usuario_resp")
      .in("id_prospeccao", [idProspeccaoA, idProspeccaoB]);
    expect(error).toBeNull();
    const vistos = new Set((data ?? []).map((r: { id_prospeccao: number }) => r.id_prospeccao));
    expect(vistos).toEqual(new Set([idProspeccaoA, idProspeccaoB]));
    // Nenhuma das duas e da gestora -- o acesso vem do papel global, nao do dono.
    for (const linha of (data ?? []) as { id_usuario_resp: number }[]) {
      expect([idUsuarioMentorResp, idUsuarioMentorOutro]).toContain(linha.id_usuario_resp);
    }
  });

  it("AD-002: sessao anonima (sem login) nao le fat_prospeccao", async () => {
    const client = createClient(URL, ANON_KEY);
    const { data, error } = await client.from("fat_prospeccao").select("id_prospeccao");
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("escrita: gestora cria prospeccao por sessao JWT real", async () => {
    const client = await signInAs(GESTORA_EMAIL);
    const { data, error } = await client
      .from("fat_prospeccao")
      .insert({ id_contratante: idContratanteC, id_produto: idProduto })
      .select("id_prospeccao, status")
      .single();
    expect(error).toBeNull();
    expect(data?.status).toBe("aberta");

    const [{ total }] = await runSql<{ total: number }>(`
      SELECT COUNT(*)::int AS total FROM fat_prospeccao WHERE id_contratante = ${idContratanteC};
    `);
    expect(total).toBe(1);
  });

  it("escrita: mentor responsavel NAO cria prospeccao (42501 -- sem GRANT de INSERT)", async () => {
    const client = await signInAs(MENTOR_RESP_EMAIL);
    const { error } = await client
      .from("fat_prospeccao")
      .insert({ id_contratante: idContratanteD, id_produto: idProduto, id_usuario_resp: idUsuarioMentorResp });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("escrita: mentor responsavel NAO altera nem a propria prospeccao (42501 -- sem GRANT de UPDATE)", async () => {
    const client = await signInAs(MENTOR_RESP_EMAIL);
    const { error } = await client
      .from("fat_prospeccao")
      .update({ observacao: "tentativa de escrita do mentor" })
      .eq("id_prospeccao", idProspeccaoA);
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");

    const [linha] = await runSql<{ observacao: string | null }>(
      `SELECT observacao FROM fat_prospeccao WHERE id_prospeccao = ${idProspeccaoA};`
    );
    expect(linha.observacao).toBeNull();
  });

  it("GRANT: legisla_app/admin/gestora tem INSERT/UPDATE/DELETE; mentor e assessor nao", async () => {
    const rows = await runSql<{
      role: string;
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>(`
      SELECT r.role,
             has_table_privilege(r.role, 'fat_prospeccao', 'SELECT') AS can_select,
             has_table_privilege(r.role, 'fat_prospeccao', 'INSERT') AS can_insert,
             has_table_privilege(r.role, 'fat_prospeccao', 'UPDATE') AS can_update,
             has_table_privilege(r.role, 'fat_prospeccao', 'DELETE') AS can_delete
        FROM unnest(ARRAY['legisla_app','legisla_admin','legisla_gestora',
                          'legisla_mentor','legisla_assessor']) AS r(role);
    `);
    const porRole = Object.fromEntries(rows.map((r) => [r.role, r]));
    for (const role of ["legisla_app", "legisla_admin", "legisla_gestora"]) {
      expect(porRole[role].can_select, `${role} deveria ter SELECT`).toBe(true);
      expect(porRole[role].can_insert, `${role} deveria ter INSERT`).toBe(true);
      expect(porRole[role].can_update, `${role} deveria ter UPDATE`).toBe(true);
      expect(porRole[role].can_delete, `${role} deveria ter DELETE`).toBe(true);
    }
    for (const role of ["legisla_mentor", "legisla_assessor"]) {
      expect(porRole[role].can_select, `${role} deveria ter SELECT`).toBe(true);
      expect(porRole[role].can_insert, `${role} nao deveria ter INSERT`).toBe(false);
      expect(porRole[role].can_update, `${role} nao deveria ter UPDATE`).toBe(false);
      expect(porRole[role].can_delete, `${role} nao deveria ter DELETE`).toBe(false);
    }
  });

  it("AD-002: anon e authenticated seguem sem SELECT/INSERT/UPDATE/DELETE depois do re-GRANT em bloco", async () => {
    const rows = await runSql<{
      role: string;
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>(`
      SELECT r.role,
             has_table_privilege(r.role, 'fat_prospeccao', 'SELECT') AS can_select,
             has_table_privilege(r.role, 'fat_prospeccao', 'INSERT') AS can_insert,
             has_table_privilege(r.role, 'fat_prospeccao', 'UPDATE') AS can_update,
             has_table_privilege(r.role, 'fat_prospeccao', 'DELETE') AS can_delete
        FROM unnest(ARRAY['anon','authenticated']) AS r(role);
    `);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.can_select, `${row.role} nao deveria ter SELECT`).toBe(false);
      expect(row.can_insert, `${row.role} nao deveria ter INSERT`).toBe(false);
      expect(row.can_update, `${row.role} nao deveria ter UPDATE`).toBe(false);
      expect(row.can_delete, `${row.role} nao deveria ter DELETE`).toBe(false);
    }
  });
});
