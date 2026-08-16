import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: formularios-produto T4 Done-when (.specs/features/formularios-produto/tasks.md),
// migrations 20260814031909_formularios_produto_estrutura.sql /
// 20260814032052_formularios_produto_rls.sql / 20260814032214_formularios_produto_grants.sql /
// 20260814032705_formularios_produto_trigger_metricas.sql -- merge-forward: só agora
// RLS+GRANT+trigger da Fase 1 existem juntos para testar de ponta a ponta (nota
// "Test Co-location Validation" de tasks.md).
//
// spec.md P1 AC1-AC13, FRM-03/FRM-08/FRM-09/FRM-10/FRM-11/FRM-12/FRM-13.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "FRM-T4-submissao-P4ssword!";

const GESTORA_EMAIL = "frm-t4-gestora@legislabrasil.test";
const MENTOR_EMAIL = "frm-t4-mentor@legislabrasil.test";
const ASSESSOR_EMAIL = "frm-t4-assessor@legislabrasil.test";

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

async function makeFixture(label: string, status: "ativo" | "concluido" = "ativo"): Promise<Fixture> {
  const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'FRM T4 ${label}')
    RETURNING id_contratante;
  `);
  const [{ id_contrato: idContrato }] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
    VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, '${status}')
    RETURNING id_contrato;
  `);
  return { idContratante, idContrato };
}

let a: Fixture; // contrato ativo, carteira do mentor/assessor -- fluxo principal
let b: Fixture; // contrato encerrado (status='concluido'), mesma carteira -- FRM-13
let idFormAvaliacaoImersao: number;
let versaoAvaliacaoImersao: number;
let idMetricaNps: number;
let idFormOrganograma: number;
let versaoOrganograma: number;
let idUsuarioMentor: number;
let idUsuarioAssessor: number;

describe("formularios-produto T4 -- RLS+GRANT (fat_submissao/fat_resposta_metrica) + trg_extrai_metricas", () => {
  beforeAll(async () => {
    const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of existing?.users ?? []) {
      if (user.email && [GESTORA_EMAIL, MENTOR_EMAIL, ASSESSOR_EMAIL].includes(user.email)) {
        await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      }
    }
    for (const email of [GESTORA_EMAIL, MENTOR_EMAIL, ASSESSOR_EMAIL]) {
      const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
      if (error) throw error;
      authUserIds.push(data.user.id);
    }
    await runSql(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo) VALUES
        ('${GESTORA_EMAIL}', 'FRM T4 Gestora', 'gestora', true),
        ('${MENTOR_EMAIL}', 'FRM T4 Mentor', 'mentor', true),
        ('${ASSESSOR_EMAIL}', 'FRM T4 Assessor', 'assessor', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);

    a = await makeFixture("A (ativo)", "ativo");
    b = await makeFixture("B (encerrado)", "concluido");

    await runSql(`
      INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
      SELECT ${a.idContrato}, id_usuario, 'mentor' FROM dim_usuario WHERE email = '${MENTOR_EMAIL}'
      ON CONFLICT (id_contrato, id_usuario, papel_no_contrato) DO NOTHING;
      INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
      SELECT ${a.idContrato}, id_usuario, 'assessor' FROM dim_usuario WHERE email = '${ASSESSOR_EMAIL}'
      ON CONFLICT (id_contrato, id_usuario, papel_no_contrato) DO NOTHING;
      INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
      SELECT ${b.idContrato}, id_usuario, 'assessor' FROM dim_usuario WHERE email = '${ASSESSOR_EMAIL}'
      ON CONFLICT (id_contrato, id_usuario, papel_no_contrato) DO NOTHING;
    `);

    const [formAv] = await runSql<{ id_formulario: number; versao: number }>(
      `SELECT id_formulario, versao FROM ref_formulario WHERE codigo = 'avaliacao_imersao';`
    );
    idFormAvaliacaoImersao = formAv.id_formulario;
    versaoAvaliacaoImersao = formAv.versao;

    const [metrica] = await runSql<{ id_metrica: number }>(
      `SELECT id_metrica FROM ref_metrica_formulario WHERE id_formulario = ${idFormAvaliacaoImersao} AND codigo_campo = 'nps_recomendacao';`
    );
    idMetricaNps = metrica.id_metrica;

    const [formOrg] = await runSql<{ id_formulario: number; versao: number }>(
      `SELECT id_formulario, versao FROM ref_formulario WHERE codigo = 'organograma';`
    );
    idFormOrganograma = formOrg.id_formulario;
    versaoOrganograma = formOrg.versao;

    // Fixture A: abre avaliacao_imersao (fluxo principal). organograma
    // permanece 'fechado' (default da régua de instanciação) de propósito --
    // é o cenário negativo "formulário fechado bloqueia INSERT".
    // Fixture B: abre avaliacao_imersao também -- o único bloqueio ali deve
    // ser o contrato encerrado, não o formulário fechado.
    await runSql(`
      UPDATE rel_formulario_contrato SET estado = 'aberto', dt_abertura = now()
       WHERE id_contrato = ${a.idContrato} AND id_formulario = ${idFormAvaliacaoImersao};
      UPDATE rel_formulario_contrato SET estado = 'aberto', dt_abertura = now()
       WHERE id_contrato = ${b.idContrato} AND id_formulario = ${idFormAvaliacaoImersao};
    `);

    idUsuarioMentor = (
      await runSql<{ id_usuario: number }>(`SELECT id_usuario FROM dim_usuario WHERE email = '${MENTOR_EMAIL}';`)
    )[0].id_usuario;
    idUsuarioAssessor = (
      await runSql<{ id_usuario: number }>(`SELECT id_usuario FROM dim_usuario WHERE email = '${ASSESSOR_EMAIL}';`)
    )[0].id_usuario;
  }, 120000);

  afterAll(async () => {
    for (const f of [a, b]) {
      await runSql(`DELETE FROM fat_submissao WHERE id_contrato = ${f.idContrato};`);
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
        SELECT id_usuario FROM dim_usuario WHERE email IN ('${GESTORA_EMAIL}', '${MENTOR_EMAIL}', '${ASSESSOR_EMAIL}')
      );
    `);
    await runSql(`DELETE FROM dim_usuario WHERE email IN ('${GESTORA_EMAIL}', '${MENTOR_EMAIL}', '${ASSESSOR_EMAIL}');`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 120000);

  it("fat_submissao/fat_resposta_metrica têm FORCE ROW LEVEL SECURITY + policies não nulas (p_por_contrato/p_heranca/p_bloqueia_reenvio_fechado)", async () => {
    const rows = await runSql<{ tablename: string; policyname: string; qual: string | null; with_check: string | null }>(`
      SELECT tablename, policyname, qual, with_check FROM pg_policies
       WHERE schemaname = 'public' AND tablename IN ('fat_submissao','fat_resposta_metrica');
    `);
    // fat_submissao ganhou uma 2ª policy (achado do Verifier, FRM-11 --
    // p_bloqueia_reenvio_fechado, RESTRICTIVE FOR UPDATE) além da
    // p_por_contrato original; fat_resposta_metrica continua com só p_heranca.
    expect(rows).toHaveLength(3);
    const porTabela = new Map<string, string[]>();
    for (const r of rows) {
      porTabela.set(r.tablename, [...(porTabela.get(r.tablename) ?? []), r.policyname]);
    }
    expect(porTabela.get("fat_submissao")?.sort()).toEqual(["p_bloqueia_reenvio_fechado", "p_por_contrato"]);
    expect(porTabela.get("fat_resposta_metrica")).toEqual(["p_heranca"]);
    for (const row of rows) {
      expect(row.qual, `${row.tablename}.${row.policyname}.qual`).not.toBeNull();
      expect(row.with_check, `${row.tablename}.${row.policyname}.with_check`).not.toBeNull();
    }

    const forceRows = await runSql<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
      SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relnamespace = 'public'::regnamespace AND relname IN ('fat_submissao','fat_resposta_metrica');
    `);
    expect(forceRows).toHaveLength(2);
    for (const row of forceRows) {
      expect(row.relrowsecurity, row.relname).toBe(true);
      expect(row.relforcerowsecurity, row.relname).toBe(true);
    }
  });

  it("GRANT: legisla_mentor/legisla_assessor têm SELECT+INSERT+UPDATE em fat_submissao e NENHUM grant em fat_resposta_metrica", async () => {
    const rows = await runSql<{ role: string; can_select: boolean; can_insert: boolean; can_update: boolean }>(`
      SELECT r.role,
             has_table_privilege(r.role, 'fat_submissao', 'SELECT') AS can_select,
             has_table_privilege(r.role, 'fat_submissao', 'INSERT') AS can_insert,
             has_table_privilege(r.role, 'fat_submissao', 'UPDATE') AS can_update
        FROM unnest(ARRAY['legisla_mentor','legisla_assessor']) AS r(role);
    `);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.can_select, `${row.role} SELECT fat_submissao`).toBe(true);
      expect(row.can_insert, `${row.role} INSERT fat_submissao`).toBe(true);
      expect(row.can_update, `${row.role} UPDATE fat_submissao`).toBe(true);
    }

    const negRows = await runSql<{ role: string; can_select: boolean; can_insert: boolean }>(`
      SELECT r.role,
             has_table_privilege(r.role, 'fat_resposta_metrica', 'SELECT') AS can_select,
             has_table_privilege(r.role, 'fat_resposta_metrica', 'INSERT') AS can_insert
        FROM unnest(ARRAY['legisla_mentor','legisla_assessor']) AS r(role);
    `);
    expect(negRows).toHaveLength(2);
    for (const row of negRows) {
      expect(row.can_select, `${row.role} SELECT fat_resposta_metrica`).toBe(false);
      expect(row.can_insert, `${row.role} INSERT fat_resposta_metrica`).toBe(false);
    }
  });

  it("Assessor e Mentor conseguem INSERT em fat_submissao do próprio formulário (aberto) sem 42501", async () => {
    for (const [email, idUsuario] of [
      [ASSESSOR_EMAIL, idUsuarioAssessor] as const,
      [MENTOR_EMAIL, idUsuarioMentor] as const,
    ]) {
      const client = await signInAs(email);
      const { data, error } = await client
        .from("fat_submissao")
        .insert({
          id_contrato: a.idContrato,
          id_formulario: idFormAvaliacaoImersao,
          versao_formulario: versaoAvaliacaoImersao,
          id_usuario_respondente: idUsuario,
          respostas: { nps_recomendacao: 9 },
        })
        .select("id_submissao")
        .single();
      expect(error, email).toBeNull();
      expect(data?.id_submissao).toBeGreaterThan(0);
      await runSql(`DELETE FROM fat_submissao WHERE id_contrato = ${a.idContrato} AND id_usuario_respondente = ${idUsuario};`);
    }
  });

  it("trigger popula fat_resposta_metrica a partir de ref_metrica_formulario (caso NPS)", async () => {
    const client = await signInAs(ASSESSOR_EMAIL);
    const { data, error } = await client
      .from("fat_submissao")
      .insert({
        id_contrato: a.idContrato,
        id_formulario: idFormAvaliacaoImersao,
        versao_formulario: versaoAvaliacaoImersao,
        id_usuario_respondente: idUsuarioAssessor,
        respostas: { nps_recomendacao: 9 },
      })
      .select("id_submissao")
      .single();
    expect(error).toBeNull();
    const idSubmissao = data?.id_submissao as number;

    const metricaRows = await runSql<{ valor_num: string; valor_bool: boolean | null }>(
      `SELECT valor_num, valor_bool FROM fat_resposta_metrica WHERE id_submissao = ${idSubmissao} AND id_metrica = ${idMetricaNps};`
    );
    expect(metricaRows).toHaveLength(1);
    expect(Number(metricaRows[0].valor_num)).toBe(9);
    expect(metricaRows[0].valor_bool).toBeNull();

    // Reenvio (UPDATE de respostas) repovoa fat_resposta_metrica (delete+reinsert),
    // nunca duplica a linha.
    const updated = await client
      .from("fat_submissao")
      .update({ respostas: { nps_recomendacao: 3 } })
      .eq("id_submissao", idSubmissao)
      .select("id_submissao")
      .single();
    expect(updated.error).toBeNull();

    const metricaAposReenvio = await runSql<{ valor_num: string }>(
      `SELECT valor_num FROM fat_resposta_metrica WHERE id_submissao = ${idSubmissao} AND id_metrica = ${idMetricaNps};`
    );
    expect(metricaAposReenvio).toHaveLength(1);
    expect(Number(metricaAposReenvio[0].valor_num)).toBe(3);

    await runSql(`DELETE FROM fat_submissao WHERE id_submissao = ${idSubmissao};`);
  });

  it("Mentor/Assessor são negados (42501) tentando gravar id_usuario_respondente diferente do próprio (spoofing de autoria)", async () => {
    const client = await signInAs(ASSESSOR_EMAIL);
    const { error } = await client.from("fat_submissao").insert({
      id_contrato: a.idContrato,
      id_formulario: idFormAvaliacaoImersao,
      versao_formulario: versaoAvaliacaoImersao,
      id_usuario_respondente: idUsuarioMentor, // não é quem está autenticado
      respostas: { nps_recomendacao: 8 },
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");

    const [{ count }] = await runSql<{ count: number }>(
      `SELECT count(*)::int AS count FROM fat_submissao WHERE id_contrato = ${a.idContrato} AND id_usuario_respondente = ${idUsuarioMentor};`
    );
    expect(count).toBe(0);
  });

  it("Admin/Gestora conseguem UPDATE numa linha de outro respondente (reabertura, FRM-11)", async () => {
    const [{ id_submissao: idSubmissao }] = await runSql<{ id_submissao: number }>(`
      INSERT INTO fat_submissao (id_contrato, id_formulario, versao_formulario, id_usuario_respondente, respostas)
      VALUES (${a.idContrato}, ${idFormAvaliacaoImersao}, ${versaoAvaliacaoImersao}, ${idUsuarioAssessor}, '{"nps_recomendacao": 5}'::jsonb)
      RETURNING id_submissao;
    `);

    const gestoraClient = await signInAs(GESTORA_EMAIL);
    const { data, error } = await gestoraClient
      .from("fat_submissao")
      .update({ respostas: { nps_recomendacao: 10 } })
      .eq("id_submissao", idSubmissao)
      .select("id_usuario_respondente, respostas")
      .single();
    expect(error).toBeNull();
    // Gestora reabre e edita a resposta de OUTRA pessoa: autoria original preservada,
    // só o conteúdo muda -- é exatamente o caso que a disjunção do WITH CHECK existe para permitir.
    expect(data?.id_usuario_respondente).toBe(idUsuarioAssessor);
    expect(data?.respostas).toEqual({ nps_recomendacao: 10 });

    await runSql(`DELETE FROM fat_submissao WHERE id_submissao = ${idSubmissao};`);
  });

  it("Formulário fechado (organograma, estado='fechado' por default) bloqueia INSERT do Assessor", async () => {
    const client = await signInAs(ASSESSOR_EMAIL);
    const { error } = await client.from("fat_submissao").insert({
      id_contrato: a.idContrato,
      id_formulario: idFormOrganograma,
      versao_formulario: versaoOrganograma,
      id_usuario_respondente: idUsuarioAssessor,
      respostas: { qualquer_campo: "x" },
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");

    const [{ count }] = await runSql<{ count: number }>(
      `SELECT count(*)::int AS count FROM fat_submissao WHERE id_contrato = ${a.idContrato} AND id_formulario = ${idFormOrganograma};`
    );
    expect(count).toBe(0);
  });

  it("Contrato encerrado (fat_contrato.status='concluido') bloqueia INSERT novo mesmo com formulário aberto", async () => {
    const client = await signInAs(ASSESSOR_EMAIL);
    const { error } = await client.from("fat_submissao").insert({
      id_contrato: b.idContrato,
      id_formulario: idFormAvaliacaoImersao,
      versao_formulario: versaoAvaliacaoImersao,
      id_usuario_respondente: idUsuarioAssessor,
      respostas: { nps_recomendacao: 7 },
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");

    const [{ count }] = await runSql<{ count: number }>(
      `SELECT count(*)::int AS count FROM fat_submissao WHERE id_contrato = ${b.idContrato};`
    );
    expect(count).toBe(0);
  });
});
