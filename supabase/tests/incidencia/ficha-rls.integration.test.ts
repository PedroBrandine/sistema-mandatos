import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: ficha-mandato-contrato T7 Done-when
// (.specs/features/ficha-mandato-contrato/tasks.md), migration
// 20260916150213_ficha_rls.sql -- design.md "Code Reuse Analysis" > "Padrões
// a replicar verbatim":
//  - fat_artefato: p_por_contrato (id_contrato próprio), mesmo padrão de
//    fat_encontro/fat_insight/fat_fato_gerador
//    (20260813192341_incidencia_encontros_rls.sql).
//  - rel_registro_participante: p_heranca via EXISTS contra fat_registro
//    (que já tem p_por_contrato + FORCE RLS desde a mesma migration de
//    incidencia).
//  - rel_mandato_agenda_tematica: p_heranca pela cadeia
//    mandato -> contratante -> contrato, mesmo predicado de dim_mandato em
//    0011_fundacao_rls.sql.
//  - USING e WITH CHECK explícitos nas 3 (nunca FOR ALL reaproveitando só o
//    USING -- lição FND-USR-02).
//
// spec.md, Sweep de dimensões implícitas: "FMC-35 -- RLS em fat_artefato,
// rel_mandato_agenda_tematica e ref_nivel_dimensao_gip, no padrão AD-030/
// AD-001".
//
// Achado confirmado ANTES de escrever este arquivo (consulta direta via
// `supabase db query --linked`, ver Post-Gate Review do commit): nenhuma role
// legisla_* (nem admin/gestora) tem GRANT de nenhum verbo nas 3 tabelas ainda
// -- "ALL TABLES IN SCHEMA public" só cobre o que existia no momento do
// último GRANT em bloco, e nenhuma migration de T2/T3/T4 (que criaram estas
// tabelas) reemitiu esse GRANT. Reemitir é o escopo de T8 (AD-025), que a
// própria tasks.md instrui a testar "no arquivo de T7" -- por isso este
// arquivo cobre só a ESTRUTURA da RLS (pg_policies/pg_class, via service_role
// que não passa pelo GRANT de role) e T8 adiciona os testes de
// comportamento (usuário com/sem vínculo, admin/gestora) que só fazem
// sentido depois que o GRANT existir. Sem isso, um teste de comportamento pré-
// T8 falharia com "permission denied for table" para QUALQUER role, inclusive
// admin/gestora -- confundindo ausência de GRANT com falha de RLS.

interface PolicyRow {
  tablename: string;
  policyname: string;
  qual: string | null;
  with_check: string | null;
}

describe("ficha-mandato-contrato T7 -- RLS de fat_artefato/rel_registro_participante/rel_mandato_agenda_tematica", () => {
  it("fat_artefato: ENABLE + FORCE ROW LEVEL SECURITY ativos", async () => {
    const [row] = await runSql<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
      SELECT relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relnamespace = 'public'::regnamespace AND relname = 'fat_artefato';
    `);
    expect(row.relrowsecurity).toBe(true);
    expect(row.relforcerowsecurity).toBe(true);
  });

  it("rel_registro_participante: ENABLE + FORCE ROW LEVEL SECURITY ativos", async () => {
    const [row] = await runSql<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
      SELECT relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relnamespace = 'public'::regnamespace AND relname = 'rel_registro_participante';
    `);
    expect(row.relrowsecurity).toBe(true);
    expect(row.relforcerowsecurity).toBe(true);
  });

  it("rel_mandato_agenda_tematica: ENABLE + FORCE ROW LEVEL SECURITY ativos", async () => {
    const [row] = await runSql<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
      SELECT relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relnamespace = 'public'::regnamespace AND relname = 'rel_mandato_agenda_tematica';
    `);
    expect(row.relrowsecurity).toBe(true);
    expect(row.relforcerowsecurity).toBe(true);
  });

  it("fat_artefato: policy p_por_contrato com USING e WITH CHECK explícitos, filtrando por id_contrato/carteira", async () => {
    const [row] = await runSql<PolicyRow>(`
      SELECT tablename, policyname, qual, with_check FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'fat_artefato';
    `);
    expect(row.policyname).toBe("p_por_contrato");
    expect(row.qual).not.toBeNull();
    expect(row.with_check).not.toBeNull();
    expect(row.qual).toContain("contratos_do_usuario");
    expect(row.with_check).toContain("contratos_do_usuario");
  });

  it("rel_registro_participante: policy p_heranca com USING e WITH CHECK explícitos, herdando de fat_registro", async () => {
    const [row] = await runSql<PolicyRow>(`
      SELECT tablename, policyname, qual, with_check FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'rel_registro_participante';
    `);
    expect(row.policyname).toBe("p_heranca");
    expect(row.qual).not.toBeNull();
    expect(row.with_check).not.toBeNull();
    expect(row.qual).toContain("fat_registro");
    expect(row.with_check).toContain("fat_registro");
  });

  it("rel_mandato_agenda_tematica: policy p_heranca com USING e WITH CHECK explícitos, herdando pela cadeia mandato->contratante->contrato", async () => {
    const [row] = await runSql<PolicyRow>(`
      SELECT tablename, policyname, qual, with_check FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'rel_mandato_agenda_tematica';
    `);
    expect(row.policyname).toBe("p_heranca");
    expect(row.qual).not.toBeNull();
    expect(row.with_check).not.toBeNull();
    expect(row.qual).toContain("dim_mandato");
    expect(row.qual).toContain("fat_contrato");
    expect(row.with_check).toContain("dim_mandato");
    expect(row.with_check).toContain("fat_contrato");
  });

  it("fat_artefato: predicado permite bypass de admin/gestora nos dois lados (USING e WITH CHECK)", async () => {
    const [row] = await runSql<PolicyRow>(`
      SELECT qual, with_check FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'fat_artefato';
    `);
    expect(row.qual).toContain("papel_atual");
    expect(row.with_check).toContain("papel_atual");
  });

  it("rel_mandato_agenda_tematica: predicado permite bypass de admin/gestora nos dois lados (USING e WITH CHECK)", async () => {
    const [row] = await runSql<PolicyRow>(`
      SELECT qual, with_check FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'rel_mandato_agenda_tematica';
    `);
    expect(row.qual).toContain("papel_atual");
    expect(row.with_check).toContain("papel_atual");
  });

  it("rel_registro_participante: USING e WITH CHECK usam o mesmo predicado de herança (p_heranca não distingue leitura de escrita)", async () => {
    const [row] = await runSql<PolicyRow>(`
      SELECT qual, with_check FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'rel_registro_participante';
    `);
    expect(row.qual).toBe(row.with_check);
  });
});

// Spec anchor: ficha-mandato-contrato T8 Done-when
// (.specs/features/ficha-mandato-contrato/tasks.md), migration
// 20260916151020_ficha_grants.sql -- design.md "Risks & Concerns":
//  - re-GRANT em bloco (AD-025) das 4 tabelas novas do lote 1 para
//    app/admin/gestora, com GRANT USAGE/SELECT em ALL SEQUENCES explícito
//    (achado conhecido -- sem isso o 1º INSERT do Assessor falha em
//    nextval() com 42501).
//  - Mentor/Assessor: SELECT+INSERT escopado em fat_artefato e
//    rel_registro_participante (design.md, "Registro de encontro com camada
//    dinâmica" -- lançam Registro e artefatos no próprio contrato).
//  - ref_nivel_dimensao_gip: SELECT para todos os papéis autenticados, sem
//    RLS (AD-030).
//
// Estas tabelas não tinham NENHUM grant antes desta migration (confirmado
// por consulta direta, ver commit de T7) -- por isso os testes de
// comportamento (usuário com/sem vínculo, admin/gestora atravessando) só
// entram aqui, depois que o GRANT existe. T7 já provou a ESTRUTURA da RLS
// (pg_policies); este bloco prova que ela também funciona fim-a-fim, através
// de sessão autenticada real (signInWithPassword -> custom_access_token_hook
// -> role legisla_*), como no precedente combinado
// incidencia-rls-grants.integration.test.ts.
//
// Escopo resolvido, não gap: rel_mandato_agenda_tematica NÃO recebe grant de
// Mentor/Assessor nesta migration (ver comentário da migration) -- a User
// Story de FMC-05..13 nomeia a gestora como atriz ("Como gestora, quero ver e
// editar a identidade do mandato..."), nunca mentor/assessor. Por isso o
// ramo de herança (EXISTS mandato->contratante->contrato) da p_heranca desta
// tabela é hoje inatingível por qualquer role real além de admin/gestora --
// e essas duas já atravessam pelo ramo esquerdo do OR (papel_atual()), sem
// nunca avaliar o EXISTS. T7 provou o texto exato do predicado; não há papel
// concedido hoje para exercitar seu ramo direito em comportamento real. Se
// uma feature futura conceder Mentor/Assessor nesta tabela, o teste
// comportamental correspondente entra junto.
describe("ficha-mandato-contrato T8 -- GRANTs das tabelas novas (AD-025/AD-030)", () => {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  const PASSWORD = "FMC-T8-grants-P4ssword!";

  const GESTORA_EMAIL = "fmc-t8-gestora@legislabrasil.test";
  const ASSESSOR_EMAIL = "fmc-t8-assessor@legislabrasil.test";

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
    idMandato: number;
  }

  async function makeFixture(label: string): Promise<Fixture> {
    const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'FMC T8 ${label}')
      RETURNING id_contratante;
    `);
    const [{ id_contrato: idContrato }] = await runSql<{ id_contrato: number }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
      RETURNING id_contrato;
    `);
    const [{ id_mandato: idMandato }] = await runSql<{ id_mandato: number }>(`
      INSERT INTO dim_mandato (id_contratante) VALUES (${idContratante}) RETURNING id_mandato;
    `);
    return { idContratante, idContrato, idMandato };
  }

  let a: Fixture; // carteira do assessor
  let b: Fixture; // fora da carteira
  let idTipoRegistro: number;
  let idUsuarioAssessor: number;
  let idRegistroA: number;
  let idRegistroB: number;
  let idAgenda1: number;

  beforeAll(async () => {
    const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of existing?.users ?? []) {
      if (user.email && [GESTORA_EMAIL, ASSESSOR_EMAIL].includes(user.email)) {
        await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      }
    }
    for (const email of [GESTORA_EMAIL, ASSESSOR_EMAIL]) {
      const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
      if (error) throw error;
      authUserIds.push(data.user.id);
    }
    await runSql(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo) VALUES
        ('${GESTORA_EMAIL}', 'FMC T8 Gestora', 'gestora', true),
        ('${ASSESSOR_EMAIL}', 'FMC T8 Assessor', 'assessor', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);

    a = await makeFixture("A (carteira)");
    b = await makeFixture("B (fora da carteira)");

    idUsuarioAssessor = (
      await runSql<{ id_usuario: number }>(`SELECT id_usuario FROM dim_usuario WHERE email = '${ASSESSOR_EMAIL}';`)
    )[0].id_usuario;

    await runSql(`
      INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
      VALUES (${a.idContrato}, ${idUsuarioAssessor}, 'assessor')
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

    const [{ id_registro: regA }] = await runSql<{ id_registro: number }>(`
      INSERT INTO fat_registro (id_contrato, id_tipo_registro, ocorrido_em, id_usuario_autor)
      VALUES (${a.idContrato}, ${idTipoRegistro}, now(), ${idUsuarioAssessor})
      RETURNING id_registro;
    `);
    idRegistroA = regA;
    const [{ id_registro: regB }] = await runSql<{ id_registro: number }>(`
      INSERT INTO fat_registro (id_contrato, id_tipo_registro, ocorrido_em, id_usuario_autor)
      VALUES (${b.idContrato}, ${idTipoRegistro}, now(), ${idUsuarioAssessor})
      RETURNING id_registro;
    `);
    idRegistroB = regB;

    const agendas = await runSql<{ id_agenda: number }>(`
      INSERT INTO ref_agenda_tematica (nome, ordem) VALUES ('FMC T8 Tema', 9101)
      RETURNING id_agenda;
    `);
    idAgenda1 = agendas[0].id_agenda;
  }, 120000);

  afterAll(async () => {
    await runSql(`DELETE FROM rel_mandato_agenda_tematica WHERE id_mandato IN (${a.idMandato}, ${b.idMandato});`);
    await runSql(`DELETE FROM ref_agenda_tematica WHERE nome = 'FMC T8 Tema';`);
    await runSql(`DELETE FROM fat_artefato WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});`);
    await runSql(`DELETE FROM rel_registro_participante WHERE id_registro IN (${idRegistroA}, ${idRegistroB});`);
    await runSql(`DELETE FROM fat_registro WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});`);
    await runSql(`DELETE FROM rel_usuario_contrato WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});`);
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});
      DELETE FROM rel_formulario_contrato WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});
      DELETE FROM dim_planejamento WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});
    `);
    await runSql(`DELETE FROM dim_mandato WHERE id_mandato IN (${a.idMandato}, ${b.idMandato});`);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante IN (${a.idContratante}, ${b.idContratante});`);
    await runSql(`
      DELETE FROM log_auditoria WHERE id_usuario IN (
        SELECT id_usuario FROM dim_usuario WHERE email IN ('${GESTORA_EMAIL}', '${ASSESSOR_EMAIL}')
      );
    `);
    await runSql(`DELETE FROM dim_usuario WHERE email IN ('${GESTORA_EMAIL}', '${ASSESSOR_EMAIL}');`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 120000);

  it("GRANT: legisla_mentor/legisla_assessor têm SELECT+INSERT em fat_artefato e rel_registro_participante", async () => {
    const rows = await runSql<{ tabela: string; role: string; can_select: boolean; can_insert: boolean }>(`
      SELECT t.tabela, r.role,
             has_table_privilege(r.role, t.tabela, 'SELECT') AS can_select,
             has_table_privilege(r.role, t.tabela, 'INSERT') AS can_insert
        FROM unnest(ARRAY['fat_artefato','rel_registro_participante']) AS t(tabela)
        CROSS JOIN unnest(ARRAY['legisla_mentor','legisla_assessor']) AS r(role);
    `);
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.can_select, `${row.role} SELECT em ${row.tabela}`).toBe(true);
      expect(row.can_insert, `${row.role} INSERT em ${row.tabela}`).toBe(true);
    }
  });

  it("GRANT: legisla_mentor/legisla_assessor têm USAGE+SELECT na sequence de fat_artefato", async () => {
    const rows = await runSql<{ can_usage: boolean; can_select: boolean }>(`
      SELECT has_sequence_privilege('legisla_assessor', 'fat_artefato_id_artefato_seq', 'USAGE') AS can_usage,
             has_sequence_privilege('legisla_assessor', 'fat_artefato_id_artefato_seq', 'SELECT') AS can_select;
    `);
    expect(rows[0].can_usage).toBe(true);
    expect(rows[0].can_select).toBe(true);
  });

  it("ref_nivel_dimensao_gip: SELECT liberado para authenticated/mentor/assessor, sem RLS (AD-030)", async () => {
    const rows = await runSql<{ role: string; can_select: boolean }>(`
      SELECT r.role, has_table_privilege(r.role, 'ref_nivel_dimensao_gip', 'SELECT') AS can_select
        FROM unnest(ARRAY['authenticated','legisla_mentor','legisla_assessor']) AS r(role);
    `);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.can_select, row.role).toBe(true);
    }
    const [rls] = await runSql<{ relrowsecurity: boolean }>(`
      SELECT relrowsecurity FROM pg_class
       WHERE relnamespace = 'public'::regnamespace AND relname = 'ref_nivel_dimensao_gip';
    `);
    expect(rls.relrowsecurity).toBe(false);
  });

  it("fat_artefato: Assessor com vínculo lê e grava no próprio contrato (A); é rejeitado (42501) no contrato de outro (B)", async () => {
    const client = await signInAs(ASSESSOR_EMAIL);

    const inserted = await client
      .from("fat_artefato")
      .insert({ id_contrato: a.idContrato, escopo: "contrato", tipo: "pasta_drive", url: "https://drive.google.com/fmc-t8-a" })
      .select("id_artefato")
      .single();
    expect(inserted.error).toBeNull();
    expect(inserted.data?.id_artefato).toBeGreaterThan(0);

    const read = await client.from("fat_artefato").select("id_contrato").in("id_contrato", [a.idContrato, b.idContrato]);
    expect(read.error).toBeNull();
    const vistos = new Set((read.data ?? []).map((r: { id_contrato: number }) => r.id_contrato));
    expect(vistos.has(a.idContrato), "deveria ver A").toBe(true);
    expect(vistos.has(b.idContrato), "NÃO deveria ver B").toBe(false);

    const blocked = await client
      .from("fat_artefato")
      .insert({ id_contrato: b.idContrato, escopo: "contrato", tipo: "pasta_drive", url: "https://drive.google.com/fmc-t8-b" });
    expect(blocked.error?.code).toBe("42501");
  });

  it("rel_registro_participante: Assessor com vínculo lê e grava no registro do próprio contrato (A); é rejeitado (42501) no registro de outro contrato (B)", async () => {
    const client = await signInAs(ASSESSOR_EMAIL);

    const inserted = await client
      .from("rel_registro_participante")
      .insert({ id_registro: idRegistroA, nome_livre: "FMC T8 Participante A", origem: "externo" })
      .select("id_participacao")
      .single();
    expect(inserted.error).toBeNull();
    expect(inserted.data?.id_participacao).toBeGreaterThan(0);

    const read = await client.from("rel_registro_participante").select("id_registro").in("id_registro", [idRegistroA, idRegistroB]);
    expect(read.error).toBeNull();
    const vistos = new Set((read.data ?? []).map((r: { id_registro: number }) => r.id_registro));
    expect(vistos.has(idRegistroA), "deveria ver o registro de A").toBe(true);
    expect(vistos.has(idRegistroB), "NÃO deveria ver o registro de B").toBe(false);

    const blocked = await client
      .from("rel_registro_participante")
      .insert({ id_registro: idRegistroB, nome_livre: "FMC T8 Participante B", origem: "externo" });
    expect(blocked.error?.code).toBe("42501");
  });

  it("fat_artefato e rel_registro_participante: Gestora (papel global, sem vínculo pessoal) lê e grava nos dois contratos (A e B)", async () => {
    const client = await signInAs(GESTORA_EMAIL);

    for (const contrato of [a.idContrato, b.idContrato]) {
      const inserted = await client
        .from("fat_artefato")
        .insert({ id_contrato: contrato, escopo: "contrato", tipo: "pasta_drive", url: `https://drive.google.com/fmc-t8-gestora-${contrato}` });
      expect(inserted.error, `fat_artefato contrato ${contrato}`).toBeNull();
    }
    const lidos = await client.from("fat_artefato").select("id_contrato").in("id_contrato", [a.idContrato, b.idContrato]);
    expect(lidos.error).toBeNull();
    const vistos = new Set((lidos.data ?? []).map((r: { id_contrato: number }) => r.id_contrato));
    expect(vistos.has(a.idContrato)).toBe(true);
    expect(vistos.has(b.idContrato)).toBe(true);

    for (const registro of [idRegistroA, idRegistroB]) {
      const inserted = await client
        .from("rel_registro_participante")
        .insert({ id_registro: registro, nome_livre: `FMC T8 Gestora ${registro}`, origem: "externo" });
      expect(inserted.error, `rel_registro_participante registro ${registro}`).toBeNull();
    }
  });

  it("rel_mandato_agenda_tematica: Gestora (bypass) lê e grava nos dois mandatos (A e B), mesmo sem vínculo pessoal", async () => {
    const client = await signInAs(GESTORA_EMAIL);

    for (const mandato of [a.idMandato, b.idMandato]) {
      const inserted = await client.from("rel_mandato_agenda_tematica").insert({ id_mandato: mandato, id_agenda: idAgenda1 });
      expect(inserted.error, `mandato ${mandato}`).toBeNull();
    }
    const lidos = await client
      .from("rel_mandato_agenda_tematica")
      .select("id_mandato")
      .in("id_mandato", [a.idMandato, b.idMandato]);
    expect(lidos.error).toBeNull();
    const vistos = new Set((lidos.data ?? []).map((r: { id_mandato: number }) => r.id_mandato));
    expect(vistos.has(a.idMandato)).toBe(true);
    expect(vistos.has(b.idMandato)).toBe(true);
  });
});
