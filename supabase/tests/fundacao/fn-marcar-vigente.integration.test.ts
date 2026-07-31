import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: T21 Done-when --
//  - SECURITY INVOKER
//  - Nunca deixa duas linhas eh_mandato_vigente=true para o mesmo mandato
//    (checado após a chamada)
//  - Teste cobre: mandato sem vigente anterior, mandato com vigente anterior
//    (troca), candidatura de outro mandato (não afetada)
//  - Gate check passa: npm run test:integration
//
// spec.md FND-TSE-04 (P1 AC4).

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "T21-marcar-vigente-P4ssword!";
const GESTORA_EMAIL = "t21-marcar-vigente-gestora@legislabrasil.test";

const admin = createClient(URL, SERVICE_ROLE_KEY);
const authUserIds: string[] = [];
let gestoraClient: SupabaseClient;

const contratanteIds: number[] = [];
const mandatoIds: number[] = [];
const candidaturaIds: number[] = [];

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

interface MandatoFixture {
  idContratante: number;
  idMandato: number;
}

async function makeMandato(nome: string): Promise<MandatoFixture> {
  const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', '${nome}')
    RETURNING id_contratante;
  `);
  contratanteIds.push(idContratante);
  const [{ id_mandato: idMandato }] = await runSql<{ id_mandato: number }>(`
    INSERT INTO dim_mandato (id_contratante) VALUES (${idContratante}) RETURNING id_mandato;
  `);
  mandatoIds.push(idMandato);
  return { idContratante, idMandato };
}

async function makeCandidatura(idMandato: number, sqCandidato: number, vigente: boolean): Promise<number> {
  const [{ id_vinculo_tse: id }] = await runSql<{ id_vinculo_tse: number }>(`
    INSERT INTO rel_mandato_candidatura
      (id_mandato, ano_eleicao, sq_candidato, nr_turno, metodo_match, confianca, status, eh_mandato_vigente, validado_em)
    VALUES (${idMandato}, 2022, ${sqCandidato}, 1, 'manual', 'alta', 'confirmado', ${vigente}, now())
    RETURNING id_vinculo_tse;
  `);
  candidaturaIds.push(id);
  return id;
}

async function vigenteFlags(idMandato: number): Promise<{ id_vinculo_tse: number; eh_mandato_vigente: boolean }[]> {
  return runSql<{ id_vinculo_tse: number; eh_mandato_vigente: boolean }>(`
    SELECT id_vinculo_tse, eh_mandato_vigente FROM rel_mandato_candidatura
     WHERE id_mandato = ${idMandato} ORDER BY id_vinculo_tse;
  `);
}

describe("T21 -- app.marcar_candidatura_vigente", () => {
  beforeAll(async () => {
    const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of existing?.users ?? []) {
      if (user.email === GESTORA_EMAIL) {
        await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      }
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: GESTORA_EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    authUserIds.push(data.user.id);

    await runSql(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo)
      VALUES ('${GESTORA_EMAIL}', 'T21 Gestora', 'gestora', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);

    gestoraClient = await signInAs(GESTORA_EMAIL);
  }, 60000);

  afterAll(async () => {
    if (candidaturaIds.length) {
      await runSql(`DELETE FROM rel_mandato_candidatura WHERE id_vinculo_tse IN (${candidaturaIds.join(",")});`);
    }
    if (mandatoIds.length) {
      await runSql(`DELETE FROM dim_mandato WHERE id_mandato IN (${mandatoIds.join(",")});`);
    }
    if (contratanteIds.length) {
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante IN (${contratanteIds.join(",")});`);
    }
    const [{ id_usuario: idUsuarioGestora }] = await runSql<{ id_usuario: number }>(
      `SELECT id_usuario FROM dim_usuario WHERE email = '${GESTORA_EMAIL}';`
    );
    await runSql(`DELETE FROM log_auditoria WHERE id_usuario = ${idUsuarioGestora} OR id_usuario_impersonado = ${idUsuarioGestora};`);
    await runSql(`DELETE FROM dim_usuario WHERE email = '${GESTORA_EMAIL}';`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 60000);

  it("app.marcar_candidatura_vigente is SECURITY INVOKER (prosecdef = false)", async () => {
    const rows = await runSql<{ prosecdef: boolean }>(`
      SELECT prosecdef FROM pg_proc
       WHERE pronamespace = 'app'::regnamespace AND proname = 'marcar_candidatura_vigente';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].prosecdef).toBe(false);
  });

  it("marks vigente when the mandato has no previous vigente candidatura", async () => {
    const { idMandato } = await makeMandato("T21 Mandato Sem Vigente");
    const idCand = await makeCandidatura(idMandato, 921001, false);

    const { error } = await gestoraClient.schema("app").rpc("marcar_candidatura_vigente", { p_id_vinculo_tse: idCand });
    expect(error).toBeNull();

    const flags = await vigenteFlags(idMandato);
    expect(flags).toEqual([{ id_vinculo_tse: idCand, eh_mandato_vigente: true }]);
  });

  it("swaps vigente to the new candidatura and unmarks the previous one of the same mandato", async () => {
    const { idMandato } = await makeMandato("T21 Mandato Com Vigente");
    const idCandAntiga = await makeCandidatura(idMandato, 921002, true);
    const idCandNova = await makeCandidatura(idMandato, 921003, false);

    const { error } = await gestoraClient.schema("app").rpc("marcar_candidatura_vigente", { p_id_vinculo_tse: idCandNova });
    expect(error).toBeNull();

    const flags = await vigenteFlags(idMandato);
    expect(flags).toEqual(
      expect.arrayContaining([
        { id_vinculo_tse: idCandAntiga, eh_mandato_vigente: false },
        { id_vinculo_tse: idCandNova, eh_mandato_vigente: true },
      ])
    );
    // Never two vigente rows for the same mandato.
    expect(flags.filter((f) => f.eh_mandato_vigente)).toHaveLength(1);
  });

  // This fixture makes 6 sequential runSql round trips (2 mandatos x 2
  // makeMandato/makeCandidatura calls each + 2 vigenteFlags) plus the RPC
  // call -- past the file's default 30s testTimeout under this session's
  // Management API latency (same failure class already fixed for beforeAll/
  // afterAll hooks in T13/T14/T16: a correct, deterministic test needs a
  // timeout matched to its real round-trip count, not the global default).
  it("does not affect a vigente candidatura belonging to a different mandato", async () => {
    const { idMandato: idMandatoA } = await makeMandato("T21 Mandato A");
    const idCandA = await makeCandidatura(idMandatoA, 921004, false);

    const { idMandato: idMandatoB } = await makeMandato("T21 Mandato B");
    const idCandB = await makeCandidatura(idMandatoB, 921005, true);

    const { error } = await gestoraClient.schema("app").rpc("marcar_candidatura_vigente", { p_id_vinculo_tse: idCandA });
    expect(error).toBeNull();

    const flagsA = await vigenteFlags(idMandatoA);
    expect(flagsA).toEqual([{ id_vinculo_tse: idCandA, eh_mandato_vigente: true }]);

    const flagsB = await vigenteFlags(idMandatoB);
    expect(flagsB).toEqual([{ id_vinculo_tse: idCandB, eh_mandato_vigente: true }]);
  }, 60000);
});
