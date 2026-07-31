import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: T23 Done-when --
//  - SECURITY INVOKER
//  - Linha antiga fica com dt_fim = CURRENT_DATE, nunca é apagada
//  - Linha nova criada com o mesmo id_contrato/papel_no_contrato
//  - Teste cobre: substituição simples, tentativa de substituir vínculo já
//    fechado (erro claro)
//  - Gate check passa: npm run test:integration
//
// spec.md FND-USR-05 (P1 AC5).

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "T23-substituir-vinculo-P4ssword!";
const GESTORA_EMAIL = "t23-substituir-vinculo-gestora@legislabrasil.test";

const admin = createClient(URL, SERVICE_ROLE_KEY);
const authUserIds: string[] = [];
let gestoraClient: SupabaseClient;

let idContratante: number;
let idMandato: number;
let idContrato: number;
let idUsuarioAntigo: number;
let idUsuarioNovo: number;
const vinculoIds: number[] = [];

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

describe("T23 -- app.substituir_vinculo", () => {
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
      INSERT INTO dim_usuario (email, nome, papel_global, ativo) VALUES
        ('${GESTORA_EMAIL}', 'T23 Gestora', 'gestora', true),
        ('t23-assessor-antigo@legislabrasil.test', 'T23 Assessor Antigo', 'assessor', true),
        ('t23-assessor-novo@legislabrasil.test', 'T23 Assessor Novo', 'assessor', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);
    const [{ id_usuario: idAntigo }] = await runSql<{ id_usuario: number }>(
      `SELECT id_usuario FROM dim_usuario WHERE email = 't23-assessor-antigo@legislabrasil.test';`
    );
    idUsuarioAntigo = idAntigo;
    const [{ id_usuario: idNovo }] = await runSql<{ id_usuario: number }>(
      `SELECT id_usuario FROM dim_usuario WHERE email = 't23-assessor-novo@legislabrasil.test';`
    );
    idUsuarioNovo = idNovo;

    const [{ id_contratante: idCont }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'T23 Mandato Fixture')
      RETURNING id_contratante;
    `);
    idContratante = idCont;
    const [{ id_mandato: idMan }] = await runSql<{ id_mandato: number }>(`
      INSERT INTO dim_mandato (id_contratante) VALUES (${idContratante}) RETURNING id_mandato;
    `);
    idMandato = idMan;
    const [{ id_contrato: idContr }] = await runSql<{ id_contrato: number }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
      RETURNING id_contrato;
    `);
    idContrato = idContr;

    gestoraClient = await signInAs(GESTORA_EMAIL);
  }, 60000);

  afterAll(async () => {
    if (vinculoIds.length) {
      await runSql(`DELETE FROM rel_usuario_contrato WHERE id_vinculo IN (${vinculoIds.join(",")});`);
    }
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};`);
    await runSql(`DELETE FROM dim_mandato WHERE id_mandato = ${idMandato};`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
    const usuarioEmails = [
      GESTORA_EMAIL,
      "t23-assessor-antigo@legislabrasil.test",
      "t23-assessor-novo@legislabrasil.test",
    ];
    const idsUsuarios = await runSql<{ id_usuario: number }>(
      `SELECT id_usuario FROM dim_usuario WHERE email IN (${usuarioEmails.map((e) => `'${e}'`).join(",")});`
    );
    const idList = idsUsuarios.map((r) => r.id_usuario).join(",");
    await runSql(`DELETE FROM log_auditoria WHERE id_usuario IN (${idList}) OR id_usuario_impersonado IN (${idList});`);
    await runSql(`DELETE FROM dim_usuario WHERE email IN (${usuarioEmails.map((e) => `'${e}'`).join(",")});`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 60000);

  it("app.substituir_vinculo is SECURITY INVOKER (prosecdef = false)", async () => {
    const rows = await runSql<{ prosecdef: boolean }>(`
      SELECT prosecdef FROM pg_proc
       WHERE pronamespace = 'app'::regnamespace AND proname = 'substituir_vinculo';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].prosecdef).toBe(false);
  });

  it("closes the old vinculo (dt_fim = today, row kept) and creates a new one with the same id_contrato/papel_no_contrato", async () => {
    const [{ id_vinculo: idVinculoAntigo }] = await runSql<{ id_vinculo: number }>(`
      INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato, cargo)
      VALUES (${idContrato}, ${idUsuarioAntigo}, 'assessor', 'assessor')
      RETURNING id_vinculo;
    `);
    vinculoIds.push(idVinculoAntigo);

    const { data: idVinculoNovo, error } = await gestoraClient.schema("app").rpc("substituir_vinculo", {
      p_id_vinculo_antigo: idVinculoAntigo,
      p_id_usuario_novo: idUsuarioNovo,
      p_cargo: "secretaria_executiva",
      p_grau_responsabilidade: "titular",
      p_areas: ["saude", "educacao"],
    });
    expect(error).toBeNull();
    expect(idVinculoNovo).not.toBe(idVinculoAntigo);
    vinculoIds.push(idVinculoNovo);

    const [antigo] = await runSql<{ id_usuario: number; dt_fim: string | null }>(
      `SELECT id_usuario, dt_fim FROM rel_usuario_contrato WHERE id_vinculo = ${idVinculoAntigo};`
    );
    expect(antigo).toBeDefined();
    expect(antigo.id_usuario).toBe(idUsuarioAntigo);
    expect(antigo.dt_fim).not.toBeNull();

    const [novo] = await runSql<{
      id_contrato: number;
      id_usuario: number;
      papel_no_contrato: string;
      cargo: string;
      grau_responsabilidade: string;
      areas: string[];
      dt_fim: string | null;
    }>(`
      SELECT id_contrato, id_usuario, papel_no_contrato, cargo, grau_responsabilidade, areas, dt_fim
        FROM rel_usuario_contrato WHERE id_vinculo = ${idVinculoNovo};
    `);
    expect(novo.id_contrato).toBe(idContrato);
    expect(novo.id_usuario).toBe(idUsuarioNovo);
    expect(novo.papel_no_contrato).toBe("assessor");
    expect(novo.cargo).toBe("secretaria_executiva");
    expect(novo.grau_responsabilidade).toBe("titular");
    expect(novo.areas).toEqual(["saude", "educacao"]);
    expect(novo.dt_fim).toBeNull();
  });

  it("rejects with a clear error when the old vinculo is already closed, without changing anything", async () => {
    const [{ id_vinculo: idVinculoFechado }] = await runSql<{ id_vinculo: number }>(`
      INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato, dt_inicio, dt_fim)
      VALUES (${idContrato}, ${idUsuarioAntigo}, 'mentor', CURRENT_DATE - 30, CURRENT_DATE - 1)
      RETURNING id_vinculo;
    `);
    vinculoIds.push(idVinculoFechado);

    const { data, error } = await gestoraClient.schema("app").rpc("substituir_vinculo", {
      p_id_vinculo_antigo: idVinculoFechado,
      p_id_usuario_novo: idUsuarioNovo,
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/já está encerrado/);

    const rows = await runSql<{ count: string }>(
      `SELECT count(*)::int AS count FROM rel_usuario_contrato WHERE id_contrato = ${idContrato} AND id_usuario = ${idUsuarioNovo} AND papel_no_contrato = 'mentor';`
    );
    expect(Number(rows[0].count)).toBe(0);
  });
});
