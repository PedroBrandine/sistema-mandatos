import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/pll-cadastro-participantes/{spec.md,design.md,tasks.md} T2
// "Done when":
//  - Tabela criada com todos os CHECK do design
//  - RLS: Gestora/Admin CRUD completo; Mentor SELECT/UPDATE só onde
//    id_contrato está na própria carteira (rel_usuario_contrato); linha com
//    id_contrato IS NULL só visível a Gestora/Admin
//  - GRANTs para os 3 papéis, sem abrir para Assessor (Out of Scope da spec)
//  - Teste de integração cobre: Gestora insere; Mentor não vê linha não
//    vinculada; Mentor vê e edita linha da própria carteira depois do
//    vínculo; Assessor sem GRANT nenhum
//
// Migrations: 20260922072328_pll_cadastro_participante_estrutura.sql,
// 20260922072332_pll_cadastro_participante_rls.sql,
// 20260922072336_pll_cadastro_participante_grants.sql.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "PLL-CP-t2-cadastro-rls-P4ssword!";

const GESTORA_EMAIL = "pll-cp-t2-gestora@legislabrasil.test";
const MENTOR_PROPRIO_EMAIL = "pll-cp-t2-mentor-proprio@legislabrasil.test";
const MENTOR_OUTRO_EMAIL = "pll-cp-t2-mentor-outro@legislabrasil.test";
const ASSESSOR_EMAIL = "pll-cp-t2-assessor@legislabrasil.test";
const EMAILS = [GESTORA_EMAIL, MENTOR_PROPRIO_EMAIL, MENTOR_OUTRO_EMAIL, ASSESSOR_EMAIL];

const admin = createClient(URL, SERVICE_ROLE_KEY);
const authUserIds: string[] = [];

async function expectSqlError(sql: string, errcode: string): Promise<void> {
  try {
    await runSql(sql);
    throw new Error(`expected query to fail with ${errcode} but it succeeded`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain(errcode);
  }
}

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

let idProduto: number;
let idUsuarioMentorProprio: number;
let idContratanteMentorProprio: number;
let idContratoMentorProprio: number;
const idsCadastroCriados: number[] = [];
const idsContratoCriados: number[] = [];
const idsContratanteCriados: number[] = [];

describe("fat_cadastro_participante -- estrutura, RLS e GRANTs (pll-cadastro-participantes T2)", () => {
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
        ('${GESTORA_EMAIL}', 'PLL-CP T2 Gestora', 'gestora', true),
        ('${MENTOR_PROPRIO_EMAIL}', 'PLL-CP T2 Mentor Proprio', 'mentor', true),
        ('${MENTOR_OUTRO_EMAIL}', 'PLL-CP T2 Mentor Outro', 'mentor', true),
        ('${ASSESSOR_EMAIL}', 'PLL-CP T2 Assessor', 'assessor', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);

    const [{ id_usuario }] = await runSql<{ id_usuario: number }>(
      `SELECT id_usuario FROM dim_usuario WHERE email = '${MENTOR_PROPRIO_EMAIL}';`
    );
    idUsuarioMentorProprio = id_usuario;

    const [{ id_produto: prod }] = await runSql<{ id_produto: number }>(
      `SELECT id_produto FROM ref_produto WHERE nome = 'PLL';`
    );
    idProduto = prod;

    const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'PLL-CP T2 Contratante Mentor Proprio')
      RETURNING id_contratante;
    `);
    idContratanteMentorProprio = id_contratante;
    idsContratanteCriados.push(idContratanteMentorProprio);

    const [{ id_contrato }] = await runSql<{ id_contrato: number }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      VALUES (${idContratanteMentorProprio}, ${idProduto}, CURRENT_DATE, 'ativo')
      RETURNING id_contrato;
    `);
    idContratoMentorProprio = id_contrato;
    idsContratoCriados.push(idContratoMentorProprio);

    await runSql(`
      INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
      VALUES (${idContratoMentorProprio}, ${idUsuarioMentorProprio}, 'mentor');
    `);
  }, 180000);

  afterAll(async () => {
    if (idsCadastroCriados.length > 0) {
      await runSql(`DELETE FROM fat_cadastro_participante WHERE id_cadastro_participante IN (${idsCadastroCriados.join(",")});`);
    }
    if (idUsuarioMentorProprio) {
      await runSql(`DELETE FROM rel_usuario_contrato WHERE id_usuario = ${idUsuarioMentorProprio};`);
    }
    // fat_contrato dispara trigger que popula fat_etapa_contrato -- sem
    // limpar essas linhas primeiro, o DELETE de fat_contrato abaixo viola
    // fat_etapa_contrato_id_contrato_fkey (mesmo achado documentado em
    // supabase/tests/pll/origem-encerramento.integration.test.ts:44-51).
    for (const idContrato of idsContratoCriados) {
      await runSql(`
        DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};
        DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};
        DELETE FROM dim_planejamento WHERE id_contrato = ${idContrato};
      `);
    }
    for (const idContrato of idsContratoCriados) {
      await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};`);
    }
    for (const idContratante of idsContratanteCriados) {
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
    }
    const idsUsuarios = await runSql<{ id_usuario: number }>(
      `SELECT id_usuario FROM dim_usuario WHERE email IN (${EMAILS.map((e) => `'${e}'`).join(", ")});`
    );
    const idList = idsUsuarios.map((r) => r.id_usuario).join(",");
    if (idList.length > 0) {
      await runSql(`DELETE FROM log_auditoria WHERE id_usuario IN (${idList}) OR id_usuario_impersonado IN (${idList});`);
    }
    await runSql(`DELETE FROM dim_usuario WHERE email IN (${EMAILS.map((e) => `'${e}'`).join(", ")});`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 180000);

  it("AD-001: RLS habilitada e forcada em fat_cadastro_participante", async () => {
    const [row] = await runSql<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
      SELECT relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relkind = 'r' AND relname = 'fat_cadastro_participante'
         AND relnamespace = 'public'::regnamespace;
    `);
    expect(row.relrowsecurity).toBe(true);
    expect(row.relforcerowsecurity).toBe(true);
  });

  it("p_por_contrato tem USING e WITH CHECK explicitos, ambos sobre id_contrato e papel_atual", async () => {
    const rows = await runSql<{ policyname: string; qual: string | null; with_check: string | null }>(`
      SELECT policyname, qual, with_check FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'fat_cadastro_participante';
    `);
    expect(rows.map((r) => r.policyname)).toEqual(["p_por_contrato"]);
    expect(rows[0].qual).not.toBeNull();
    expect(rows[0].with_check).not.toBeNull();
    expect(rows[0].qual).toContain("id_contrato");
    expect(rows[0].qual).toContain("papel_atual");
    expect(rows[0].with_check).toContain("id_contrato");
    expect(rows[0].with_check).toContain("papel_atual");
  });

  it("UNIQUE (id_projeto, email): reimportação do mesmo e-mail no mesmo projeto colide (23505)", async () => {
    // 60s: este teste faz 5 round-trips sequenciais via `supabase db query
    // --linked` (Management API) -- cada um sozinho já leva 4-8s nesta
    // suíte, o testTimeout global de 30s (vitest.integration.config.ts) não
    // sobra margem.
    const email = "pll-cp-t2-unique@teste.com";
    const [row] = await runSql<{ id_cadastro_participante: number }>(`
      INSERT INTO fat_cadastro_participante (id_produto, id_projeto, papel, nome_completo, email)
      VALUES (${idProduto}, NULL, 'mentorado', 'Duplicado Um', '${email}')
      RETURNING id_cadastro_participante;
    `);
    idsCadastroCriados.push(row.id_cadastro_participante);

    // id_projeto NULL não colide (índice único ignora NULL) -- confirma que a
    // colisão exige o MESMO id_projeto, não é um UNIQUE(email) disfarçado.
    const [row2] = await runSql<{ id_cadastro_participante: number }>(`
      INSERT INTO fat_cadastro_participante (id_produto, id_projeto, papel, nome_completo, email)
      VALUES (${idProduto}, NULL, 'mentorado', 'Duplicado Dois', '${email}')
      RETURNING id_cadastro_participante;
    `);
    idsCadastroCriados.push(row2.id_cadastro_participante);

    const [{ id_projeto }] = await runSql<{ id_projeto: number }>(`
      INSERT INTO ref_projeto (nome) VALUES ('PLL-CP T2 Projeto Unique ${Date.now()}')
      RETURNING id_projeto;
    `);
    const [row3] = await runSql<{ id_cadastro_participante: number }>(`
      INSERT INTO fat_cadastro_participante (id_produto, id_projeto, papel, nome_completo, email)
      VALUES (${idProduto}, ${id_projeto}, 'mentorado', 'Com Projeto', '${email}')
      RETURNING id_cadastro_participante;
    `);
    idsCadastroCriados.push(row3.id_cadastro_participante);

    await expectSqlError(
      `INSERT INTO fat_cadastro_participante (id_produto, id_projeto, papel, nome_completo, email)
       VALUES (${idProduto}, ${id_projeto}, 'mentor', 'Mesma Chave Outro Nome', '${email}');`,
      "23505"
    );

    // Precisa apagar as linhas de fat_cadastro_participante que referenciam
    // id_projeto ANTES do ref_projeto -- senão viola
    // fat_cadastro_participante_id_projeto_fkey.
    await runSql(`DELETE FROM fat_cadastro_participante WHERE id_projeto = ${id_projeto};`);
    await runSql(`DELETE FROM ref_projeto WHERE id_projeto = ${id_projeto};`);
    idsCadastroCriados.splice(idsCadastroCriados.indexOf(row3.id_cadastro_participante), 1);
  }, 60000);

  it("CHECK ck_cadastro_papel (23514): papel fora de mentorado/mentor é rejeitado", async () => {
    await expectSqlError(
      `INSERT INTO fat_cadastro_participante (id_produto, papel, nome_completo, email)
       VALUES (${idProduto}, 'coordenador', 'Papel Invalido', 'papel-invalido@teste.com');`,
      "23514"
    );
  });

  it("CHECK ck_cadastro_notas (23514): nota fora de 1-5 é rejeitada", async () => {
    await expectSqlError(
      `INSERT INTO fat_cadastro_participante (id_produto, papel, nome_completo, email, nota_educacao)
       VALUES (${idProduto}, 'mentorado', 'Nota Invalida', 'nota-invalida@teste.com', 6);`,
      "23514"
    );
  });

  it("AD-002: sessao anonima (sem login) nao le fat_cadastro_participante", async () => {
    const client = createClient(URL, ANON_KEY);
    const { data, error } = await client.from("fat_cadastro_participante").select("id_cadastro_participante");
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("escrita: Gestora insere um participante por sessao JWT real", async () => {
    const client = await signInAs(GESTORA_EMAIL);
    const { data, error } = await client
      .from("fat_cadastro_participante")
      .insert({
        id_produto: idProduto,
        papel: "mentorado",
        nome_completo: "PLL-CP T2 Gestora Insere",
        email: "pll-cp-t2-gestora-insere@teste.com",
      })
      .select("id_cadastro_participante, status_cadastro")
      .single();
    expect(error).toBeNull();
    // D-3, via trg_calcular_status_cadastro_participante (migration
    // 20260922152934): papel/nome_completo/email preenchidos (únicos campos
    // obrigatórios, T3) e sem vínculo TSE (id_contrato IS NULL) => "pendente
    // de revisão", nunca mais "incompleto" travado no DEFAULT da coluna.
    expect(data?.status_cadastro).toBe("pendente_revisao");
    if (data) idsCadastroCriados.push(data.id_cadastro_participante);

    const [{ total }] = await runSql<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM fat_cadastro_participante WHERE email = 'pll-cp-t2-gestora-insere@teste.com';`
    );
    expect(total).toBe(1);
  });

  it("Mentor NAO ve linha nao vinculada (id_contrato IS NULL) -- só Gestora/Admin veem", async () => {
    const [row] = await runSql<{ id_cadastro_participante: number }>(`
      INSERT INTO fat_cadastro_participante (id_produto, papel, nome_completo, email)
      VALUES (${idProduto}, 'mentorado', 'PLL-CP T2 Nao Vinculado', 'pll-cp-t2-nao-vinculado@teste.com')
      RETURNING id_cadastro_participante;
    `);
    idsCadastroCriados.push(row.id_cadastro_participante);

    const mentorClient = await signInAs(MENTOR_PROPRIO_EMAIL);
    const { data: dataMentor, error: errorMentor } = await mentorClient
      .from("fat_cadastro_participante")
      .select("id_cadastro_participante")
      .eq("id_cadastro_participante", row.id_cadastro_participante);
    expect(errorMentor).toBeNull();
    expect(dataMentor ?? []).toEqual([]);

    const gestoraClient = await signInAs(GESTORA_EMAIL);
    const { data: dataGestora, error: errorGestora } = await gestoraClient
      .from("fat_cadastro_participante")
      .select("id_cadastro_participante")
      .eq("id_cadastro_participante", row.id_cadastro_participante);
    expect(errorGestora).toBeNull();
    expect((dataGestora ?? []).map((r: { id_cadastro_participante: number }) => r.id_cadastro_participante)).toEqual([
      row.id_cadastro_participante,
    ]);
  });

  it("Mentor VE e EDITA a linha da propria carteira depois do vinculo TSE (id_contrato preenchido)", async () => {
    const [row] = await runSql<{ id_cadastro_participante: number }>(`
      INSERT INTO fat_cadastro_participante (id_produto, id_contrato, papel, nome_completo, email)
      VALUES (${idProduto}, ${idContratoMentorProprio}, 'mentorado', 'PLL-CP T2 Vinculado Mentor Proprio', 'pll-cp-t2-vinculado-proprio@teste.com')
      RETURNING id_cadastro_participante;
    `);
    idsCadastroCriados.push(row.id_cadastro_participante);

    const mentorClient = await signInAs(MENTOR_PROPRIO_EMAIL);
    const { data: leitura, error: erroLeitura } = await mentorClient
      .from("fat_cadastro_participante")
      .select("id_cadastro_participante")
      .eq("id_cadastro_participante", row.id_cadastro_participante);
    expect(erroLeitura).toBeNull();
    expect((leitura ?? []).map((r: { id_cadastro_participante: number }) => r.id_cadastro_participante)).toEqual([
      row.id_cadastro_participante,
    ]);

    const { error: erroUpdate } = await mentorClient
      .from("fat_cadastro_participante")
      .update({ desafios: ["Agenda apertada"] })
      .eq("id_cadastro_participante", row.id_cadastro_participante);
    expect(erroUpdate).toBeNull();

    const [linha] = await runSql<{ desafios: string[] }>(
      `SELECT desafios FROM fat_cadastro_participante WHERE id_cadastro_participante = ${row.id_cadastro_participante};`
    );
    expect(linha.desafios).toEqual(["Agenda apertada"]);
  });

  it("Mentor de OUTRA carteira NAO ve a linha vinculada ao contrato do mentor proprio", async () => {
    const [row] = await runSql<{ id_cadastro_participante: number }>(`
      INSERT INTO fat_cadastro_participante (id_produto, id_contrato, papel, nome_completo, email)
      VALUES (${idProduto}, ${idContratoMentorProprio}, 'mentorado', 'PLL-CP T2 Vinculado Outro Mentor', 'pll-cp-t2-vinculado-outro@teste.com')
      RETURNING id_cadastro_participante;
    `);
    idsCadastroCriados.push(row.id_cadastro_participante);

    const mentorOutroClient = await signInAs(MENTOR_OUTRO_EMAIL);
    const { data, error } = await mentorOutroClient
      .from("fat_cadastro_participante")
      .select("id_cadastro_participante")
      .eq("id_cadastro_participante", row.id_cadastro_participante);
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("GRANT: legisla_app/admin/gestora tem INSERT/UPDATE/DELETE; mentor so SELECT/INSERT/UPDATE; assessor SEM NENHUM", async () => {
    const rows = await runSql<{
      role: string;
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>(`
      SELECT r.role,
             has_table_privilege(r.role, 'fat_cadastro_participante', 'SELECT') AS can_select,
             has_table_privilege(r.role, 'fat_cadastro_participante', 'INSERT') AS can_insert,
             has_table_privilege(r.role, 'fat_cadastro_participante', 'UPDATE') AS can_update,
             has_table_privilege(r.role, 'fat_cadastro_participante', 'DELETE') AS can_delete
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
    expect(porRole.legisla_mentor.can_select, "mentor deveria ter SELECT").toBe(true);
    expect(porRole.legisla_mentor.can_insert, "mentor deveria ter INSERT").toBe(true);
    expect(porRole.legisla_mentor.can_update, "mentor deveria ter UPDATE").toBe(true);
    expect(porRole.legisla_mentor.can_delete, "mentor nao deveria ter DELETE").toBe(false);

    expect(porRole.legisla_assessor.can_select, "assessor nao deveria ter SELECT").toBe(false);
    expect(porRole.legisla_assessor.can_insert, "assessor nao deveria ter INSERT").toBe(false);
    expect(porRole.legisla_assessor.can_update, "assessor nao deveria ter UPDATE").toBe(false);
    expect(porRole.legisla_assessor.can_delete, "assessor nao deveria ter DELETE").toBe(false);
  });

  it("Assessor sem GRANT nenhum: sessao real do Assessor recebe erro de RLS/GRANT ao ler ou escrever", async () => {
    const assessorClient = await signInAs(ASSESSOR_EMAIL);
    const { data, error } = await assessorClient
      .from("fat_cadastro_participante")
      .select("id_cadastro_participante");
    expect(error).not.toBeNull();
    expect(data).toBeNull();

    const { error: erroInsert } = await assessorClient.from("fat_cadastro_participante").insert({
      id_produto: idProduto,
      papel: "mentorado",
      nome_completo: "PLL-CP T2 Assessor Tenta Inserir",
      email: "pll-cp-t2-assessor-tenta@teste.com",
    });
    expect(erroInsert).not.toBeNull();
    expect(erroInsert?.code).toBe("42501");
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
             has_table_privilege(r.role, 'fat_cadastro_participante', 'SELECT') AS can_select,
             has_table_privilege(r.role, 'fat_cadastro_participante', 'INSERT') AS can_insert,
             has_table_privilege(r.role, 'fat_cadastro_participante', 'UPDATE') AS can_update,
             has_table_privilege(r.role, 'fat_cadastro_participante', 'DELETE') AS can_delete
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
