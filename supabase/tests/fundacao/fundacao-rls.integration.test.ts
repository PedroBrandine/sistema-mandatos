import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: T16 Done-when --
//  - ENABLE ROW LEVEL SECURITY + FORCE ROW LEVEL SECURITY em todas as
//    tabelas de Fundação
//  - Cada política aplicada exatamente como no schema aprovado (p_por_carteira
//    sobre dim_contratante/dim_mandato/dim_coalizao/rel_mandato_candidatura/
//    fat_contrato; p_por_contrato sobre rel_coalizao_membro)
//  - Gate check passa: npm run test:integration (usando a sessão de T5)

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "T16-rls-test-P4ssword!";

const GESTORA_EMAIL = "t16-rls-gestora@legislabrasil.test";
const MENTOR_EMAIL = "t16-rls-mentor@legislabrasil.test";

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
  idMandato: number;
  idContrato: number;
}

let a: Fixture;
let b: Fixture;
let idCoalizaoContratante: number;
let idCoalizao: number;
let idMembroA: number;
let idMembroB: number;
let idCandidaturaA: number;
let idCandidaturaB: number;

async function makeFixture(label: string): Promise<Fixture> {
  const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'T16 RLS ${label}')
    RETURNING id_contratante;
  `);
  const [{ id_mandato: idMandato }] = await runSql<{ id_mandato: number }>(`
    INSERT INTO dim_mandato (id_contratante) VALUES (${idContratante}) RETURNING id_mandato;
  `);
  const [{ id_contrato: idContrato }] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
    VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
    RETURNING id_contrato;
  `);
  return { idContratante, idMandato, idContrato };
}

describe("T16 -- RLS de Fundação (p_por_carteira / p_por_contrato)", () => {
  // SPEC_DEVIATION (test fix, this session): this fixture makes ~14 sequential
  // runSql round trips (2 makeFixture() calls x3 each, rel_usuario_contrato,
  // 2x rel_mandato_candidatura, dim_contratante/dim_coalizao, 2x
  // rel_coalizao_membro) plus several Supabase Auth Admin API calls -- well
  // past the global 30s hookTimeout (vitest.integration.config.ts), which was
  // silently truncating beforeAll mid-fixture and leaving afterAll to clean up
  // undefined variables (same failure class already fixed in T13's
  // uq_vinculo test and T14's rel_coalizao_membro fixture). Raised to a
  // timeout matched to this fixture's real round-trip count, not the file's
  // default.
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
        ('${GESTORA_EMAIL}', 'T16 RLS Gestora', 'gestora', true),
        ('${MENTOR_EMAIL}', 'T16 RLS Mentor', 'mentor', true)
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

    // rel_mandato_candidatura: uma para cada mandato.
    const [{ id_vinculo_tse: candA }] = await runSql<{ id_vinculo_tse: number }>(`
      INSERT INTO rel_mandato_candidatura (id_mandato, ano_eleicao, sq_candidato, nr_turno, metodo_match, confianca, status, validado_em)
      VALUES (${a.idMandato}, 2022, 916001, 1, 'manual', 'alta', 'confirmado', now())
      RETURNING id_vinculo_tse;
    `);
    idCandidaturaA = candA;
    const [{ id_vinculo_tse: candB }] = await runSql<{ id_vinculo_tse: number }>(`
      INSERT INTO rel_mandato_candidatura (id_mandato, ano_eleicao, sq_candidato, nr_turno, metodo_match, confianca, status, validado_em)
      VALUES (${b.idMandato}, 2022, 916002, 1, 'manual', 'alta', 'confirmado', now())
      RETURNING id_vinculo_tse;
    `);
    idCandidaturaB = candB;

    // Coalizão com um membro por contrato (A e B).
    const [{ id_contratante: idColContratante }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('coalizao', 'T16 RLS Coalizao')
      RETURNING id_contratante;
    `);
    idCoalizaoContratante = idColContratante;
    const [{ id_coalizao: idCol }] = await runSql<{ id_coalizao: number }>(`
      INSERT INTO dim_coalizao (id_contratante) VALUES (${idColContratante}) RETURNING id_coalizao;
    `);
    idCoalizao = idCol;
    const [{ id_membro: mA }] = await runSql<{ id_membro: number }>(`
      INSERT INTO rel_coalizao_membro (id_coalizao, id_contrato, papel) VALUES (${idCoalizao}, ${a.idContrato}, 'membro')
      RETURNING id_membro;
    `);
    idMembroA = mA;
    const [{ id_membro: mB }] = await runSql<{ id_membro: number }>(`
      INSERT INTO rel_coalizao_membro (id_coalizao, id_contrato, papel) VALUES (${idCoalizao}, ${b.idContrato}, 'membro')
      RETURNING id_membro;
    `);
    idMembroB = mB;
  }, 180000);

  afterAll(async () => {
    await runSql(`DELETE FROM rel_coalizao_membro WHERE id_coalizao = ${idCoalizao};`);
    await runSql(`DELETE FROM dim_coalizao WHERE id_coalizao = ${idCoalizao};`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idCoalizaoContratante};`);
    await runSql(`DELETE FROM rel_mandato_candidatura WHERE id_vinculo_tse IN (${idCandidaturaA}, ${idCandidaturaB});`);
    await runSql(`DELETE FROM rel_usuario_contrato WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});`);
    // operacao-regua-instanciacao: trigger AFTER INSERT em fat_contrato agora
    // popula fat_etapa_contrato/rel_formulario_contrato/dim_planejamento
    // (ON DELETE RESTRICT) -- precisam sair antes de fat_contrato. 1
    // round-trip para os 3, não 3, pra caber no hookTimeout.
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});
      DELETE FROM rel_formulario_contrato WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});
      DELETE FROM dim_planejamento WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});
    `);
    for (const f of [a, b]) {
      await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${f.idContrato};`);
      await runSql(`DELETE FROM dim_mandato WHERE id_mandato = ${f.idMandato};`);
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${f.idContratante};`);
    }
    await runSql(`DELETE FROM dim_usuario WHERE email IN ('${GESTORA_EMAIL}', '${MENTOR_EMAIL}');`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 180000);

  it("enables FORCE ROW LEVEL SECURITY on all 6 Fundação tables", async () => {
    const rows = await runSql<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
      SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname IN ('dim_contratante','dim_mandato','dim_coalizao','fat_contrato','rel_mandato_candidatura','rel_coalizao_membro')
         AND relnamespace = 'public'::regnamespace;
    `);
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(true);
    }
  });

  it("mentor sees fat_contrato only for the contract in their carteira", async () => {
    const client = await signInAs(MENTOR_EMAIL);
    const { data, error } = await client.from("fat_contrato").select("id_contrato").in("id_contrato", [a.idContrato, b.idContrato]);
    expect(error).toBeNull();
    expect((data ?? []).map((r: { id_contrato: number }) => r.id_contrato)).toEqual([a.idContrato]);
  });

  it("mentor sees dim_contratante/dim_mandato only for their carteira, not the other contratante", async () => {
    const client = await signInAs(MENTOR_EMAIL);
    const { data: contratantes, error: e1 } = await client
      .from("dim_contratante")
      .select("id_contratante")
      .in("id_contratante", [a.idContratante, b.idContratante]);
    expect(e1).toBeNull();
    expect((contratantes ?? []).map((r: { id_contratante: number }) => r.id_contratante)).toEqual([a.idContratante]);

    const { data: mandatos, error: e2 } = await client
      .from("dim_mandato")
      .select("id_mandato")
      .in("id_mandato", [a.idMandato, b.idMandato]);
    expect(e2).toBeNull();
    expect((mandatos ?? []).map((r: { id_mandato: number }) => r.id_mandato)).toEqual([a.idMandato]);
  });

  it("mentor sees rel_mandato_candidatura only for the mandato in their carteira", async () => {
    const client = await signInAs(MENTOR_EMAIL);
    const { data, error } = await client
      .from("rel_mandato_candidatura")
      .select("id_vinculo_tse")
      .in("id_vinculo_tse", [idCandidaturaA, idCandidaturaB]);
    expect(error).toBeNull();
    expect((data ?? []).map((r: { id_vinculo_tse: number }) => r.id_vinculo_tse)).toEqual([idCandidaturaA]);
  });

  it("mentor sees rel_coalizao_membro only for the contract in their carteira (p_por_contrato)", async () => {
    const client = await signInAs(MENTOR_EMAIL);
    const { data, error } = await client
      .from("rel_coalizao_membro")
      .select("id_membro")
      .in("id_membro", [idMembroA, idMembroB]);
    expect(error).toBeNull();
    expect((data ?? []).map((r: { id_membro: number }) => r.id_membro)).toEqual([idMembroA]);
  });

  it("gestora sees both contratos regardless of carteira (papel_atual() IN admin/gestora)", async () => {
    const client = await signInAs(GESTORA_EMAIL);
    const { data, error } = await client.from("fat_contrato").select("id_contrato").in("id_contrato", [a.idContrato, b.idContrato]);
    expect(error).toBeNull();
    expect((data ?? []).map((r: { id_contrato: number }) => r.id_contrato).sort()).toEqual([a.idContrato, b.idContrato].sort());
  });
});
