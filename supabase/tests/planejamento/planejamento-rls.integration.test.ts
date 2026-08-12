import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: PLM-05/PLM-06 (.specs/features/planejamento-planilha-monitoramento/spec.md,
// migrations 20260812145720_planejamento_planilha_rls.sql /
// 20260812145817_planejamento_planilha_grants.sql) --
//  - p_heranca (cadeia EXISTS de 4 níveis) com USING e WITH CHECK explícitos e idênticos
//    nas 4 tabelas novas -- mesma convenção deliberada de operacao-regua-instanciacao;
//  - leitura filtrada por carteira sobe a cadeia até dim_planejamento (Mentor só vê a
//    hierarquia do contrato onde tem vínculo);
//  - Assessor grava TODAS as colunas de fat_sucesso_mensal do contrato vinculado
//    (decisão revisada de Pedro, 2026-08-12 -- GRANT de tabela inteira, não coluna) mas
//    é rejeitado com 42501 em fat_meta/fat_objetivo_especifico/dim_planejamento (só
//    SELECT, rejeição por GRANT) e, silenciosamente (0 linhas afetadas, sem erro --
//    RLS por USING filtra visibilidade, não levanta 42501), em fat_sucesso_mensal de
//    um contrato ao qual não está vinculado;
//  - Mentor consegue INSERT em fat_sucesso_mensal (prova o fix de GRANT USAGE em
//    ALL SEQUENCES de T3 -- primeira feature a dar INSERT real ao Mentor desde o bootstrap);
//  - Gestora (papel global) escreve em fat_meta de um contrato sem vínculo pessoal.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "PLM-rls-test-P4ssword!";

const GESTORA_EMAIL = "plm-rls-gestora@legislabrasil.test";
const MENTOR_EMAIL = "plm-rls-mentor@legislabrasil.test";
const ASSESSOR_EMAIL = "plm-rls-assessor@legislabrasil.test";

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
  idPlanejamento: number;
  idObjetivo: number;
  idMeta: number;
  idSucesso: number;
}

let a: Fixture;
let b: Fixture;

async function makeFixture(label: string): Promise<Fixture> {
  const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'PLM RLS ${label}')
    RETURNING id_contratante;
  `);
  const [{ id_contrato: idContrato }] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
    VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
    RETURNING id_contrato;
  `);
  // dim_planejamento nasce sozinha via trigger de operacao-regua-instanciacao.
  const [{ id_planejamento: idPlanejamento }] = await runSql<{ id_planejamento: number }>(`
    SELECT id_planejamento FROM dim_planejamento WHERE id_contrato = ${idContrato};
  `);
  const [{ id_objetivo: idObjetivo }] = await runSql<{ id_objetivo: number }>(`
    INSERT INTO fat_objetivo_especifico (id_planejamento, descricao)
    VALUES (${idPlanejamento}, 'PLM RLS objetivo ${label}')
    RETURNING id_objetivo;
  `);
  const [{ id_meta: idMeta }] = await runSql<{ id_meta: number }>(`
    INSERT INTO fat_meta (id_objetivo, descricao)
    VALUES (${idObjetivo}, 'PLM RLS meta ${label}')
    RETURNING id_meta;
  `);
  const [{ id_sucesso: idSucesso }] = await runSql<{ id_sucesso: number }>(`
    INSERT INTO fat_sucesso_mensal (id_meta, descricao, mes_referencia, peso)
    VALUES (${idMeta}, 'PLM RLS sucesso ${label}', '2026-08-01', 100)
    RETURNING id_sucesso;
  `);
  return { idContratante, idContrato, idPlanejamento, idObjetivo, idMeta, idSucesso };
}

describe("planejamento-planilha-monitoramento -- RLS p_heranca (PLM-05/PLM-06)", () => {
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
        ('${GESTORA_EMAIL}', 'PLM RLS Gestora', 'gestora', true),
        ('${MENTOR_EMAIL}', 'PLM RLS Mentor', 'mentor', true),
        ('${ASSESSOR_EMAIL}', 'PLM RLS Assessor', 'assessor', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);

    a = await makeFixture("A (carteira do mentor/assessor)");
    b = await makeFixture("B (fora da carteira)");

    // Mentor e Assessor vinculados só ao contrato A.
    await runSql(`
      INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
      SELECT ${a.idContrato}, id_usuario, 'mentor' FROM dim_usuario WHERE email = '${MENTOR_EMAIL}'
      ON CONFLICT (id_contrato, id_usuario, papel_no_contrato) DO NOTHING;

      INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
      SELECT ${a.idContrato}, id_usuario, 'assessor' FROM dim_usuario WHERE email = '${ASSESSOR_EMAIL}'
      ON CONFLICT (id_contrato, id_usuario, papel_no_contrato) DO NOTHING;
    `);
  }, 120000);

  afterAll(async () => {
    await runSql(`DELETE FROM rel_usuario_contrato WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});`);
    // dim_planejamento em CASCADE apaga fat_objetivo_especifico/fat_meta/
    // fat_sucesso_mensal/rel_planejamento_preditor; fat_etapa_contrato e
    // rel_formulario_contrato (régua) são RESTRICT, precisam de DELETE próprio.
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});
      DELETE FROM rel_formulario_contrato WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});
      DELETE FROM dim_planejamento WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});
    `);
    for (const f of [a, b]) {
      await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${f.idContrato};`);
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${f.idContratante};`);
    }
    // As escritas de Gestora/Mentor/Assessor nos testes acima acionam
    // trg_audit_* (T5, conectado nesta feature), gravando log_auditoria.id_usuario
    // -- sem apagar essas linhas primeiro, o DELETE de dim_usuario abaixo falha
    // com 23503 (log_auditoria_id_usuario_fkey). Mesma categoria de achado do FK
    // RESTRICT já documentada em operacao-regua-instanciacao.
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

  it("as 4 tabelas novas têm p_heranca com USING e WITH CHECK explícitos", async () => {
    const rows = await runSql<{ tablename: string; qual: string | null; with_check: string | null }>(`
      SELECT tablename, qual, with_check FROM pg_policies
       WHERE schemaname = 'public' AND policyname = 'p_heranca'
         AND tablename IN ('fat_objetivo_especifico','rel_planejamento_preditor','fat_meta','fat_sucesso_mensal');
    `);
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.qual).not.toBeNull();
      expect(row.with_check).not.toBeNull();
    }
  });

  it("FORCE ROW LEVEL SECURITY ativo nas 4 tabelas novas", async () => {
    const rows = await runSql<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
      SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname IN ('fat_objetivo_especifico','rel_planejamento_preditor','fat_meta','fat_sucesso_mensal')
         AND relnamespace = 'public'::regnamespace;
    `);
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(true);
    }
  });

  it("Mentor lê fat_objetivo_especifico/fat_meta/fat_sucesso_mensal só da própria carteira (cadeia EXISTS)", async () => {
    const client = await signInAs(MENTOR_EMAIL);

    const { data: objetivos, error: e1 } = await client
      .from("fat_objetivo_especifico")
      .select("id_objetivo")
      .in("id_objetivo", [a.idObjetivo, b.idObjetivo]);
    expect(e1).toBeNull();
    expect((objetivos ?? []).map((r: { id_objetivo: number }) => r.id_objetivo)).toEqual([a.idObjetivo]);

    const { data: metas, error: e2 } = await client
      .from("fat_meta")
      .select("id_meta")
      .in("id_meta", [a.idMeta, b.idMeta]);
    expect(e2).toBeNull();
    expect((metas ?? []).map((r: { id_meta: number }) => r.id_meta)).toEqual([a.idMeta]);

    const { data: sucessos, error: e3 } = await client
      .from("fat_sucesso_mensal")
      .select("id_sucesso")
      .in("id_sucesso", [a.idSucesso, b.idSucesso]);
    expect(e3).toBeNull();
    expect((sucessos ?? []).map((r: { id_sucesso: number }) => r.id_sucesso)).toEqual([a.idSucesso]);
  });

  it("PLM-05: Assessor com vínculo grava TODAS as colunas de fat_sucesso_mensal do contrato vinculado", async () => {
    const client = await signInAs(ASSESSOR_EMAIL);
    const { error } = await client
      .from("fat_sucesso_mensal")
      .update({
        pct_atingimento: 75,
        status: "realizado",
        peso: 100,
        descricao: "PLM RLS sucesso A (editado pelo Assessor)",
        mes_referencia: "2026-08-01",
        dt_limite: "2026-08-31",
      })
      .eq("id_sucesso", a.idSucesso);
    expect(error).toBeNull();

    const [row] = await runSql<{ pct_atingimento: string; status: string }>(`
      SELECT pct_atingimento, status FROM fat_sucesso_mensal WHERE id_sucesso = ${a.idSucesso};
    `);
    expect(row.status).toBe("realizado");
    expect(Number(row.pct_atingimento)).toBe(75);
  });

  it("PLM-06: Assessor é rejeitado (42501) ao escrever em fat_meta/fat_objetivo_especifico/dim_planejamento", async () => {
    const client = await signInAs(ASSESSOR_EMAIL);

    const { error: e1 } = await client.from("fat_meta").update({ descricao: "hackeado" }).eq("id_meta", a.idMeta);
    expect(e1?.code).toBe("42501");

    const { error: e2 } = await client
      .from("fat_objetivo_especifico")
      .update({ descricao: "hackeado" })
      .eq("id_objetivo", a.idObjetivo);
    expect(e2?.code).toBe("42501");

    const { error: e3 } = await client
      .from("dim_planejamento")
      .update({ objetivo_ano: "hackeado" })
      .eq("id_planejamento", a.idPlanejamento);
    expect(e3?.code).toBe("42501");
  });

  // SPEC_DEVIATION (achado ao rodar): diferente da rejeição por GRANT (que
  // levanta 42501, como nas 3 tabelas do teste acima), a rejeição por RLS via
  // USING é silenciosa -- a linha fica invisível pro UPDATE, 0 linhas afetadas,
  // error null. O GRANT do Assessor é de TABELA inteira (fat_sucesso_mensal),
  // não por linha; quem barra a linha de fora da carteira é só a cadeia EXISTS
  // (USING), então a asserção certa é "o valor não mudou", não um código de erro.
  it("PLM-06: Assessor NÃO consegue alterar fat_sucesso_mensal de um contrato ao qual não está vinculado (RLS silenciosa)", async () => {
    const client = await signInAs(ASSESSOR_EMAIL);
    const { error } = await client.from("fat_sucesso_mensal").update({ pct_atingimento: 10 }).eq("id_sucesso", b.idSucesso);
    expect(error).toBeNull();

    const [row] = await runSql<{ pct_atingimento: string | null }>(`
      SELECT pct_atingimento FROM fat_sucesso_mensal WHERE id_sucesso = ${b.idSucesso};
    `);
    expect(row.pct_atingimento).toBeNull();
  });

  it("Mentor consegue INSERT em fat_sucesso_mensal (prova o fix de GRANT USAGE na sequence)", async () => {
    const client = await signInAs(MENTOR_EMAIL);
    const { data, error } = await client
      .from("fat_sucesso_mensal")
      .insert({ id_meta: a.idMeta, descricao: "PLM RLS sucesso novo (Mentor)", mes_referencia: "2026-09-01", peso: 50 })
      .select("id_sucesso")
      .single();
    expect(error).toBeNull();
    expect(data?.id_sucesso).toBeGreaterThan(0);
  });

  it("Gestora (papel global) escreve em fat_meta de um contrato sem vínculo pessoal (B)", async () => {
    const client = await signInAs(GESTORA_EMAIL);
    const { error } = await client
      .from("fat_meta")
      .update({ descricao: "PLM RLS meta B (editado pela Gestora)" })
      .eq("id_meta", b.idMeta);
    expect(error).toBeNull();
  });
});
