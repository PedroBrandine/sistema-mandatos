import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: incidencia-encontros T10 Done-when
// (.specs/features/incidencia-encontros/tasks.md), migrations
// 20260813192341_incidencia_encontros_rls.sql /
// 20260813192816_incidencia_encontros_grants.sql --
//  - p_por_contrato (fat_encontro/fat_registro/fat_insight/fat_fato_gerador) e
//    p_heranca (rel_encontro_participante/rel_insight_origem/rel_fato_origem)
//    com USING e WITH CHECK explícitos e não nulos nas 7 tabelas;
//  - Mentor lê só a própria carteira (USING, direção de leitura);
//  - Assessor consegue INSERT no próprio contrato (WITH CHECK positivo) e é
//    rejeitado (42501) em contrato de outro (WITH CHECK negativo) nas 4
//    tabelas-pai;
//  - fat_registro: cláusula extra de autoria (id_usuario_autor = app.id_usuario())
//    rejeita spoofing e aceita autoria própria;
//  - GRANT scoped por papel (mentor/assessor) nas 7 tabelas + GRANT USAGE/SELECT
//    em ALL SEQUENCES pro Assessor (fix de sequence, achado do design.md).
//
// spec.md P1 "Fato Gerador validado por Tipologia" AC1, P1 "Registro por
// etapa" AC1, P2 "Insight" AC1/AC3, P2 "Encontros" AC1 (todos: "usuário com
// vínculo ativo no contrato").

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "INC-T10-rls-grants-P4ssword!";

const GESTORA_EMAIL = "inc-t10-gestora@legislabrasil.test";
const MENTOR_EMAIL = "inc-t10-mentor@legislabrasil.test";
const ASSESSOR_EMAIL = "inc-t10-assessor@legislabrasil.test";

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
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'INC T10 ${label}')
    RETURNING id_contratante;
  `);
  const [{ id_contrato: idContrato }] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
    VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
    RETURNING id_contrato;
  `);
  return { idContratante, idContrato };
}

let a: Fixture; // carteira do mentor/assessor
let b: Fixture; // fora da carteira
let idTipoRegistro: number;
let idTipologia: number;
let idUsuarioMentor: number;
let idUsuarioAssessor: number;

describe("incidencia-encontros T10 -- RLS (p_por_contrato/p_heranca) + GRANTs das 7 tabelas", () => {
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
        ('${GESTORA_EMAIL}', 'INC T10 Gestora', 'gestora', true),
        ('${MENTOR_EMAIL}', 'INC T10 Mentor', 'mentor', true),
        ('${ASSESSOR_EMAIL}', 'INC T10 Assessor', 'assessor', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);

    a = await makeFixture("A (carteira)");
    b = await makeFixture("B (fora da carteira)");

    await runSql(`
      INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
      SELECT ${a.idContrato}, id_usuario, 'mentor' FROM dim_usuario WHERE email = '${MENTOR_EMAIL}'
      ON CONFLICT (id_contrato, id_usuario, papel_no_contrato) DO NOTHING;

      INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
      SELECT ${a.idContrato}, id_usuario, 'assessor' FROM dim_usuario WHERE email = '${ASSESSOR_EMAIL}'
      ON CONFLICT (id_contrato, id_usuario, papel_no_contrato) DO NOTHING;
    `);

    idTipoRegistro = (
      await runSql<{ id_tipo_registro: number }>(`
      SELECT tr.id_tipo_registro FROM ref_tipo_registro tr
        JOIN ref_etapa e ON e.id_etapa = tr.id_etapa
        JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE p.nome = 'Estratégia' AND tr.codigo = 'monitoramento';
    `)
    )[0].id_tipo_registro;

    idTipologia = (await runSql<{ id_tipologia: number }>(`SELECT id_tipologia FROM ref_tipologia ORDER BY id_tipologia LIMIT 1;`))[0]
      .id_tipologia;

    idUsuarioMentor = (
      await runSql<{ id_usuario: number }>(`SELECT id_usuario FROM dim_usuario WHERE email = '${MENTOR_EMAIL}';`)
    )[0].id_usuario;
    idUsuarioAssessor = (
      await runSql<{ id_usuario: number }>(`SELECT id_usuario FROM dim_usuario WHERE email = '${ASSESSOR_EMAIL}';`)
    )[0].id_usuario;
  }, 120000);

  afterAll(async () => {
    for (const f of [a, b]) {
      await runSql(`
        DELETE FROM fat_registro WHERE id_contrato = ${f.idContrato};
        DELETE FROM fat_insight WHERE id_contrato = ${f.idContrato};
        DELETE FROM fat_fato_gerador WHERE id_contrato = ${f.idContrato};
        DELETE FROM fat_encontro WHERE id_contrato = ${f.idContrato};
      `);
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

  it("as 7 tabelas têm USING e WITH CHECK explícitos (p_por_contrato x4, p_heranca x3), não nulos", async () => {
    const rows = await runSql<{ tablename: string; policyname: string; qual: string | null; with_check: string | null }>(`
      SELECT tablename, policyname, qual, with_check FROM pg_policies
       WHERE schemaname = 'public' AND tablename IN
             ('fat_encontro','fat_registro','fat_insight','fat_fato_gerador',
              'rel_encontro_participante','rel_insight_origem','rel_fato_origem');
    `);
    expect(rows).toHaveLength(7);
    for (const row of rows) {
      expect(row.qual, `${row.tablename}.qual`).not.toBeNull();
      expect(row.with_check, `${row.tablename}.with_check`).not.toBeNull();
    }
    const porTabela = new Map(rows.map((r) => [r.tablename, r.policyname]));
    for (const t of ["fat_encontro", "fat_registro", "fat_insight", "fat_fato_gerador"]) {
      expect(porTabela.get(t)).toBe("p_por_contrato");
    }
    for (const t of ["rel_encontro_participante", "rel_insight_origem", "rel_fato_origem"]) {
      expect(porTabela.get(t)).toBe("p_heranca");
    }
  });

  it("FORCE ROW LEVEL SECURITY ativo nas 7 tabelas", async () => {
    const rows = await runSql<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
      SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relnamespace = 'public'::regnamespace AND relname IN
             ('fat_encontro','fat_registro','fat_insight','fat_fato_gerador',
              'rel_encontro_participante','rel_insight_origem','rel_fato_origem');
    `);
    expect(rows).toHaveLength(7);
    for (const row of rows) {
      expect(row.relrowsecurity, row.relname).toBe(true);
      expect(row.relforcerowsecurity, row.relname).toBe(true);
    }
  });

  it("Mentor lê fat_encontro/fat_registro/fat_insight/fat_fato_gerador só da própria carteira (USING)", async () => {
    // linhas plantadas via runSql (bypassa RLS) nos 2 contratos, uma por tabela.
    await runSql(`
      INSERT INTO fat_encontro (id_contrato, titulo, dt_prevista_inicio) VALUES
        (${a.idContrato}, 'INC T10 Encontro A', now()), (${b.idContrato}, 'INC T10 Encontro B', now());
      INSERT INTO fat_registro (id_contrato, id_tipo_registro, ocorrido_em, id_usuario_autor) VALUES
        (${a.idContrato}, ${idTipoRegistro}, now(), ${idUsuarioMentor}),
        (${b.idContrato}, ${idTipoRegistro}, now(), ${idUsuarioMentor});
      INSERT INTO fat_insight (id_contrato, conteudo) VALUES
        (${a.idContrato}, 'INC T10 Insight A'), (${b.idContrato}, 'INC T10 Insight B');
      INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, nivel_d1, dt_ocorrencia) VALUES
        (${a.idContrato}, ${idTipologia}, 'baixo', CURRENT_DATE),
        (${b.idContrato}, ${idTipologia}, 'baixo', CURRENT_DATE);
    `);

    const client = await signInAs(MENTOR_EMAIL);
    for (const tabela of ["fat_encontro", "fat_registro", "fat_insight", "fat_fato_gerador"]) {
      const { data, error } = await client.from(tabela).select("id_contrato").in("id_contrato", [a.idContrato, b.idContrato]);
      expect(error, tabela).toBeNull();
      const vistos = new Set((data ?? []).map((r: { id_contrato: number }) => r.id_contrato));
      expect(vistos.has(a.idContrato), `${tabela}: deveria ver A`).toBe(true);
      expect(vistos.has(b.idContrato), `${tabela}: NÃO deveria ver B`).toBe(false);
    }
  });

  it("Gestora (papel global, sem vínculo pessoal) lê fat_fato_gerador dos 2 contratos", async () => {
    const client = await signInAs(GESTORA_EMAIL);
    const { data, error } = await client.from("fat_fato_gerador").select("id_contrato").in("id_contrato", [a.idContrato, b.idContrato]);
    expect(error).toBeNull();
    const vistos = new Set((data ?? []).map((r: { id_contrato: number }) => r.id_contrato));
    expect(vistos.has(a.idContrato)).toBe(true);
    expect(vistos.has(b.idContrato)).toBe(true);
  });

  it("Assessor consegue INSERT no próprio contrato (A) nas 4 tabelas-pai (WITH CHECK positivo + GRANT + sequence)", async () => {
    const client = await signInAs(ASSESSOR_EMAIL);

    const registro = await client
      .from("fat_registro")
      .insert({ id_contrato: a.idContrato, id_tipo_registro: idTipoRegistro, ocorrido_em: new Date().toISOString(), id_usuario_autor: idUsuarioAssessor })
      .select("id_registro")
      .single();
    expect(registro.error).toBeNull();
    expect(registro.data?.id_registro).toBeGreaterThan(0);

    const insight = await client
      .from("fat_insight")
      .insert({ id_contrato: a.idContrato, conteudo: "INC T10 insight assessor A" })
      .select("id_insight")
      .single();
    expect(insight.error).toBeNull();
    expect(insight.data?.id_insight).toBeGreaterThan(0);

    const fato = await client
      .from("fat_fato_gerador")
      .insert({ id_contrato: a.idContrato, id_tipologia: idTipologia, nivel_d1: "baixo", dt_ocorrencia: "2026-08-01" })
      .select("id_fato_gerador")
      .single();
    expect(fato.error).toBeNull();
    expect(fato.data?.id_fato_gerador).toBeGreaterThan(0);

    const encontro = await client
      .from("fat_encontro")
      .insert({ id_contrato: a.idContrato, titulo: "INC T10 encontro assessor A", dt_prevista_inicio: new Date().toISOString() })
      .select("id_encontro")
      .single();
    expect(encontro.error).toBeNull();
    expect(encontro.data?.id_encontro).toBeGreaterThan(0);
  });

  it("Assessor é rejeitado (42501) ao tentar INSERT em contrato de outro (B) em fat_insight/fat_fato_gerador/fat_encontro (WITH CHECK negativo)", async () => {
    const client = await signInAs(ASSESSOR_EMAIL);

    const insight = await client.from("fat_insight").insert({ id_contrato: b.idContrato, conteudo: "INC T10 insight assessor B" });
    expect(insight.error?.code).toBe("42501");

    const fato = await client
      .from("fat_fato_gerador")
      .insert({ id_contrato: b.idContrato, id_tipologia: idTipologia, nivel_d1: "baixo", dt_ocorrencia: "2026-08-01" });
    expect(fato.error?.code).toBe("42501");

    const encontro = await client
      .from("fat_encontro")
      .insert({ id_contrato: b.idContrato, titulo: "INC T10 encontro assessor B", dt_prevista_inicio: new Date().toISOString() });
    expect(encontro.error?.code).toBe("42501");
  });

  // Achado ao rodar (não é bug de migration -- AD-008 exige trg_valida_registro_produto
  // verbatim, e a extração é fiel ao aprovado): a função é SECURITY INVOKER (default,
  // sem SECURITY DEFINER) e faz JOIN fat_contrato c ON c.id_contrato = NEW.id_contrato --
  // esse JOIN corre com o RLS do próprio chamador. Pro Assessor, fat_contrato do
  // contrato B é invisível (p_por_carteira, 0011_fundacao_rls.sql), então a EXISTS do
  // trigger dá falso e ele dispara ANTES da WITH CHECK de p_por_contrato chegar a ser
  // avaliada -- P0001 (RAISE EXCEPTION sem ERRCODE), não 42501. O resultado protegido
  // (nenhuma linha escrita em contrato fora da carteira) é o mesmo; só o código/mensagem
  // do erro mudam porque o bloqueio acontece uma camada antes (trigger, não RLS pura).
  // Mesmo padrão de achado documentado em operacao-regua-instanciacao/regua-rls (comentário
  // "SPEC_DEVIATION"): a asserção segue o mecanismo real, não a suposição inicial.
  it("fat_registro: Assessor é rejeitado ao tentar INSERT em contrato de outro (B) -- bloqueado por trg_valida_registro_produto (P0001) antes da RLS", async () => {
    const client = await signInAs(ASSESSOR_EMAIL);
    const { error } = await client
      .from("fat_registro")
      .insert({ id_contrato: b.idContrato, id_tipo_registro: idTipoRegistro, ocorrido_em: new Date().toISOString(), id_usuario_autor: idUsuarioAssessor });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("P0001");
    expect(error?.message).toContain("não pertence à régua do produto");

    const [{ count }] = await runSql<{ count: number }>(
      `SELECT count(*)::int AS count FROM fat_registro WHERE id_contrato = ${b.idContrato} AND id_usuario_autor = ${idUsuarioAssessor};`
    );
    expect(count).toBe(0);
  });

  it("fat_registro: WITH CHECK extra rejeita id_usuario_autor de outra pessoa (spoofing de autoria)", async () => {
    const client = await signInAs(ASSESSOR_EMAIL);
    const { error } = await client.from("fat_registro").insert({
      id_contrato: a.idContrato,
      id_tipo_registro: idTipoRegistro,
      ocorrido_em: new Date().toISOString(),
      id_usuario_autor: idUsuarioMentor, // não é quem está autenticado
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("fat_registro: WITH CHECK aceita id_usuario_autor igual a app.id_usuario() (autoria própria)", async () => {
    const client = await signInAs(ASSESSOR_EMAIL);
    const { data, error } = await client
      .from("fat_registro")
      .insert({
        id_contrato: a.idContrato,
        id_tipo_registro: idTipoRegistro,
        ocorrido_em: new Date().toISOString(),
        id_usuario_autor: idUsuarioAssessor,
      })
      .select("id_usuario_autor")
      .single();
    expect(error).toBeNull();
    expect(data?.id_usuario_autor).toBe(idUsuarioAssessor);
  });

  it("p_heranca: Mentor lê rel_encontro_participante só via encontro da própria carteira; Assessor grava só no encontro do próprio contrato", async () => {
    // mesmo predicado EXISTS replicado verbatim em rel_insight_origem/rel_fato_origem
    // (já provado estruturalmente pelo teste de pg_policies acima) -- demonstração
    // comportamental num representante evita repetir 3x a mesma asserção de RLS.
    const [encontroA] = await runSql<{ id_encontro: number }>(`
      INSERT INTO fat_encontro (id_contrato, titulo, dt_prevista_inicio) VALUES (${a.idContrato}, 'INC T10 p_heranca A', now())
      RETURNING id_encontro;
    `);
    const [encontroB] = await runSql<{ id_encontro: number }>(`
      INSERT INTO fat_encontro (id_contrato, titulo, dt_prevista_inicio) VALUES (${b.idContrato}, 'INC T10 p_heranca B', now())
      RETURNING id_encontro;
    `);
    await runSql(`
      INSERT INTO rel_encontro_participante (id_encontro, nome_livre, origem) VALUES
        (${encontroA.id_encontro}, 'INC T10 Participante A', 'externo'),
        (${encontroB.id_encontro}, 'INC T10 Participante B', 'externo');
    `);

    const mentorClient = await signInAs(MENTOR_EMAIL);
    const { data, error } = await mentorClient
      .from("rel_encontro_participante")
      .select("id_encontro")
      .in("id_encontro", [encontroA.id_encontro, encontroB.id_encontro]);
    expect(error).toBeNull();
    const vistos = new Set((data ?? []).map((r: { id_encontro: number }) => r.id_encontro));
    expect(vistos.has(encontroA.id_encontro)).toBe(true);
    expect(vistos.has(encontroB.id_encontro)).toBe(false);

    const assessorClient = await signInAs(ASSESSOR_EMAIL);
    const ok = await assessorClient
      .from("rel_encontro_participante")
      .insert({ id_encontro: encontroA.id_encontro, nome_livre: "INC T10 Participante A (assessor)", origem: "externo" });
    expect(ok.error).toBeNull();

    const blocked = await assessorClient
      .from("rel_encontro_participante")
      .insert({ id_encontro: encontroB.id_encontro, nome_livre: "INC T10 Participante B (assessor)", origem: "externo" });
    expect(blocked.error?.code).toBe("42501");
  });

  it("GRANT scoped: legisla_mentor/legisla_assessor têm SELECT+INSERT nas 7 tabelas (mentor também UPDATE)", async () => {
    const TABELAS = [
      "fat_encontro",
      "rel_encontro_participante",
      "fat_registro",
      "fat_insight",
      "rel_insight_origem",
      "fat_fato_gerador",
      "rel_fato_origem",
    ];
    const rows = await runSql<{ tabela: string; role: string; can_select: boolean; can_insert: boolean }>(`
      SELECT t.tabela, r.role,
             has_table_privilege(r.role, t.tabela, 'SELECT') AS can_select,
             has_table_privilege(r.role, t.tabela, 'INSERT') AS can_insert
        FROM unnest(ARRAY[${TABELAS.map((t) => `'${t}'`).join(",")}]) AS t(tabela)
        CROSS JOIN unnest(ARRAY['legisla_mentor','legisla_assessor']) AS r(role);
    `);
    expect(rows).toHaveLength(TABELAS.length * 2);
    for (const row of rows) {
      expect(row.can_select, `${row.role} SELECT em ${row.tabela}`).toBe(true);
      expect(row.can_insert, `${row.role} INSERT em ${row.tabela}`).toBe(true);
    }

    const updateRows = await runSql<{ can_update: boolean }>(`
      SELECT has_table_privilege('legisla_mentor', 'fat_encontro', 'UPDATE') AS can_update;
    `);
    expect(updateRows[0].can_update).toBe(true);
  });

  it("GRANT: legisla_assessor tem USAGE+SELECT nas sequences das 4 tabelas-pai (fix do achado de design.md)", async () => {
    const SEQUENCES = [
      "fat_encontro_id_encontro_seq",
      "fat_registro_id_registro_seq",
      "fat_insight_id_insight_seq",
      "fat_fato_gerador_id_fato_gerador_seq",
    ];
    const rows = await runSql<{ can_usage: boolean; can_select: boolean }>(`
      SELECT has_sequence_privilege('legisla_assessor', s.seq, 'USAGE') AS can_usage,
             has_sequence_privilege('legisla_assessor', s.seq, 'SELECT') AS can_select
        FROM unnest(ARRAY[${SEQUENCES.map((s) => `'${s}'`).join(",")}]) AS s(seq);
    `);
    expect(rows).toHaveLength(SEQUENCES.length);
    for (const row of rows) {
      expect(row.can_usage).toBe(true);
      expect(row.can_select).toBe(true);
    }
  });
});
