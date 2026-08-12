import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: tasks.md T2 Done-when --
//  - app.emitir_convite é SECURITY INVOKER
//  - Emitir pro mesmo e-mail+contrato+papel 2x invalida o 1º (dt_expiracao <= now())
//  - Usuário sem vínculo/papel_global admin-gestora recebe 42501
//  - Papel fora de mentor/assessor é rejeitado por ck_convite_papel (23514)
//  - Gate check passa: npm run test:unit && npm run test:integration
//
// spec.md CVT-01/02/03/04/05.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "T2-emitir-convite-P4ssword!";
const GESTORA_EMAIL = "t2-emitir-convite-gestora@legislabrasil.test";
const OUTSIDER_EMAIL = "t2-emitir-convite-outsider@legislabrasil.test";
const CONVIDADO_EMAIL = "t2-emitir-convite-convidado@legislabrasil.test";

const admin = createClient(URL, SERVICE_ROLE_KEY);
const authUserIds: string[] = [];
let gestoraClient: SupabaseClient;
let outsiderClient: SupabaseClient;

let idContratante: number;
let idMandato: number;
let idContrato: number;
let idContratanteOutro: number;
let idMandatoOutro: number;
let idContratoOutro: number;
const idsConvite: number[] = [];

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

function hashFalso(sufixo: string): string {
  // Não precisa ser um SHA-256 real -- só precisa ser único por teste
  // (token_hash é UNIQUE) e ter formato de texto qualquer.
  return `hash-fake-${sufixo}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

describe("T2 -- app.emitir_convite", () => {
  beforeAll(async () => {
    const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of existing?.users ?? []) {
      if (user.email === GESTORA_EMAIL || user.email === OUTSIDER_EMAIL) {
        await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      }
    }
    for (const email of [GESTORA_EMAIL, OUTSIDER_EMAIL]) {
      const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
      if (error) throw error;
      authUserIds.push(data.user.id);
    }

    await runSql(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo) VALUES
        ('${GESTORA_EMAIL}', 'T2 Gestora', 'gestora', true),
        ('${OUTSIDER_EMAIL}', 'T2 Outsider Assessor', 'assessor', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);

    const [{ id_contratante: idCont }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'T2 Mandato Fixture')
      RETURNING id_contratante;
    `);
    idContratante = idCont;
    const [{ id_mandato: idMan }] = await runSql<{ id_mandato: number }>(
      `INSERT INTO dim_mandato (id_contratante) VALUES (${idContratante}) RETURNING id_mandato;`
    );
    idMandato = idMan;
    const [{ id_contrato: idContr }] = await runSql<{ id_contrato: number }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
      RETURNING id_contrato;
    `);
    idContrato = idContr;

    // Contrato SEM vínculo do outsider -- prova o caminho negativo do RLS (CVT-05).
    const [{ id_contratante: idContOutro }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'T2 Mandato Fixture Outro')
      RETURNING id_contratante;
    `);
    idContratanteOutro = idContOutro;
    const [{ id_mandato: idManOutro }] = await runSql<{ id_mandato: number }>(
      `INSERT INTO dim_mandato (id_contratante) VALUES (${idContratanteOutro}) RETURNING id_mandato;`
    );
    idMandatoOutro = idManOutro;
    const [{ id_contrato: idContrOutro }] = await runSql<{ id_contrato: number }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      VALUES (${idContratanteOutro}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
      RETURNING id_contrato;
    `);
    idContratoOutro = idContrOutro;

    // Vínculo do outsider é com o OUTRO contrato -- nunca com idContrato.
    const [{ id_vinculo: idVincOutsider }] = await runSql<{ id_vinculo: number }>(`
      INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
      SELECT ${idContratoOutro}, id_usuario, 'assessor' FROM dim_usuario WHERE email = '${OUTSIDER_EMAIL}'
      RETURNING id_vinculo;
    `);
    void idVincOutsider;

    gestoraClient = await signInAs(GESTORA_EMAIL);
    outsiderClient = await signInAs(OUTSIDER_EMAIL);
  }, 60000);

  afterAll(async () => {
    if (idsConvite.length) {
      await runSql(`DELETE FROM convite_contrato WHERE id_convite IN (${idsConvite.join(",")});`);
    }
    await runSql(`DELETE FROM rel_usuario_contrato WHERE id_contrato IN (${idContrato}, ${idContratoOutro});`);
    // trg_fat_contrato_instancia (operacao-regua-instanciacao, sessão paralela
    // neste mesmo banco dev) chama app.instancia_contrato em todo INSERT de
    // fat_contrato agora -- limpa as 3 tabelas que ela povoa antes de apagar
    // o próprio fat_contrato, ou a FK derruba a limpeza.
    await runSql(
      `DELETE FROM fat_etapa_contrato WHERE id_contrato IN (${idContrato}, ${idContratoOutro});`
    );
    await runSql(
      `DELETE FROM rel_formulario_contrato WHERE id_contrato IN (${idContrato}, ${idContratoOutro});`
    );
    await runSql(`DELETE FROM dim_planejamento WHERE id_contrato IN (${idContrato}, ${idContratoOutro});`);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato IN (${idContrato}, ${idContratoOutro});`);
    await runSql(`DELETE FROM dim_mandato WHERE id_mandato IN (${idMandato}, ${idMandatoOutro});`);
    await runSql(
      `DELETE FROM dim_contratante WHERE id_contratante IN (${idContratante}, ${idContratanteOutro});`
    );
    const emails = [GESTORA_EMAIL, OUTSIDER_EMAIL];
    const idsUsuarios = await runSql<{ id_usuario: number }>(
      `SELECT id_usuario FROM dim_usuario WHERE email IN (${emails.map((e) => `'${e}'`).join(",")});`
    );
    const idList = idsUsuarios.map((r) => r.id_usuario).join(",") || "-1";
    await runSql(`DELETE FROM log_auditoria WHERE id_usuario IN (${idList}) OR id_usuario_impersonado IN (${idList});`);
    await runSql(`DELETE FROM dim_usuario WHERE email IN (${emails.map((e) => `'${e}'`).join(",")});`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 60000);

  it("app.emitir_convite is SECURITY INVOKER (prosecdef = false)", async () => {
    const rows = await runSql<{ prosecdef: boolean }>(`
      SELECT prosecdef FROM pg_proc
       WHERE pronamespace = 'app'::regnamespace AND proname = 'emitir_convite';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].prosecdef).toBe(false);
  });

  it("Gestora com vínculo emite convite -- token_hash grava só o hash, dt_expiracao em ~7 dias", async () => {
    const { data: idConvite, error } = await gestoraClient.schema("app").rpc("emitir_convite", {
      p_id_contrato: idContrato,
      p_email: CONVIDADO_EMAIL,
      p_papel: "assessor",
      p_cargo: "assessor",
      p_grau_responsabilidade: "titular",
      p_areas: ["saude"],
      p_token_hash: hashFalso("simples"),
    });
    expect(error).toBeNull();
    expect(typeof idConvite).toBe("number");
    idsConvite.push(idConvite as number);

    const [linha] = await runSql<{
      email: string;
      papel_no_contrato: string;
      dt_uso: string | null;
      dias_para_expirar: string;
    }>(`
      SELECT email, papel_no_contrato, dt_uso,
             ROUND(EXTRACT(EPOCH FROM (dt_expiracao - now())) / 86400)::text AS dias_para_expirar
        FROM convite_contrato WHERE id_convite = ${idConvite};
    `);
    expect(linha.email).toBe(CONVIDADO_EMAIL);
    expect(linha.papel_no_contrato).toBe("assessor");
    expect(linha.dt_uso).toBeNull();
    expect(Number(linha.dias_para_expirar)).toBe(7);
  });

  it("emitir de novo pro mesmo e-mail+contrato+papel invalida o convite anterior (dt_expiracao <= now())", async () => {
    const { data: idPrimeiro, error: erro1 } = await gestoraClient.schema("app").rpc("emitir_convite", {
      p_id_contrato: idContrato,
      p_email: "t2-duplicado@legislabrasil.test",
      p_papel: "mentor",
      p_cargo: null,
      p_grau_responsabilidade: null,
      p_areas: null,
      p_token_hash: hashFalso("dup-1"),
    });
    expect(erro1).toBeNull();
    idsConvite.push(idPrimeiro as number);

    const { data: idSegundo, error: erro2 } = await gestoraClient.schema("app").rpc("emitir_convite", {
      p_id_contrato: idContrato,
      p_email: "t2-duplicado@legislabrasil.test",
      p_papel: "mentor",
      p_cargo: null,
      p_grau_responsabilidade: null,
      p_areas: null,
      p_token_hash: hashFalso("dup-2"),
    });
    expect(erro2).toBeNull();
    idsConvite.push(idSegundo as number);
    expect(idSegundo).not.toBe(idPrimeiro);

    const [primeiro] = await runSql<{ expirado: boolean }>(
      `SELECT (dt_expiracao <= now()) AS expirado FROM convite_contrato WHERE id_convite = ${idPrimeiro};`
    );
    expect(primeiro.expirado).toBe(true);

    const [segundo] = await runSql<{ expirado: boolean }>(
      `SELECT (dt_expiracao <= now()) AS expirado FROM convite_contrato WHERE id_convite = ${idSegundo};`
    );
    expect(segundo.expirado).toBe(false);
  });

  it("usuário sem vínculo ao contrato e sem papel_global admin/gestora recebe 42501", async () => {
    const { data, error } = await outsiderClient.schema("app").rpc("emitir_convite", {
      p_id_contrato: idContrato,
      p_email: "t2-negado@legislabrasil.test",
      p_papel: "assessor",
      p_cargo: null,
      p_grau_responsabilidade: null,
      p_areas: null,
      p_token_hash: hashFalso("negado"),
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");

    const rows = await runSql<{ count: string }>(
      `SELECT count(*)::int AS count FROM convite_contrato WHERE email = 't2-negado@legislabrasil.test';`
    );
    expect(Number(rows[0].count)).toBe(0);
  });

  it("papel fora de mentor/assessor é rejeitado por ck_convite_papel (23514), antes de qualquer escrita", async () => {
    const { data, error } = await gestoraClient.schema("app").rpc("emitir_convite", {
      p_id_contrato: idContrato,
      p_email: "t2-papel-invalido@legislabrasil.test",
      p_papel: "admin",
      p_cargo: null,
      p_grau_responsabilidade: null,
      p_areas: null,
      p_token_hash: hashFalso("papel-invalido"),
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("23514");
    expect(error?.message).toMatch(/ck_convite_papel/);

    const rows = await runSql<{ count: string }>(
      `SELECT count(*)::int AS count FROM convite_contrato WHERE email = 't2-papel-invalido@legislabrasil.test';`
    );
    expect(Number(rows[0].count)).toBe(0);
  });
});
