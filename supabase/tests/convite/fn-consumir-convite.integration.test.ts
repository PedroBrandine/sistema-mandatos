import { createHash } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: tasks.md T3 Done-when --
//  - app.consumir_convite é SECURITY INVOKER
//  - Convite válido: cria dim_usuario novo (conta_nova=true), insere
//    rel_usuario_contrato com dados do convite, marca dt_uso
//  - dt_uso IS NOT NULL: rejeita sem alterar nada ("já utilizado")
//  - dt_expiracao < now(): rejeita sem alterar nada ("expirado")
//  - E-mail já existente com outro papel_global: não sobrescreve
//    papel_global, conta_nova=false, insere só o novo vínculo
//  - Reconsumo do mesmo convite: rejeita, sem duplicar vínculo
//  - Gate check passa: npm run test:unit && npm run test:integration
//
// spec.md CVT-06/07/08/09.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const PASSWORD = "T3-consumir-convite-P4ssword!";

const admin: SupabaseClient = createClient(URL, SERVICE_ROLE_KEY);
const authUserIds: string[] = [];

let idContratante: number;
let idMandato: number;
let idContrato: number;
const idsConvite: number[] = [];
const emailsUsuario: string[] = [];

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function criarConvite(overrides: {
  email: string;
  papel?: string;
  // Expressão SQL crua (não literal) -- ex.: "now() - interval '1 day'".
  dtExpiracaoSql?: string;
  dtUso?: string | null;
  token: string;
}): Promise<number> {
  const [{ id_usuario: idConvidante }] = await runSql<{ id_usuario: number }>(
    `SELECT id_usuario FROM dim_usuario WHERE papel_global = 'gestora' LIMIT 1;`
  );
  const dtExpiracaoSql = overrides.dtExpiracaoSql ?? "now() + interval '7 days'";
  const dtUsoSql = overrides.dtUso ? `'${overrides.dtUso}'::timestamptz` : "NULL";
  const [{ id_convite: idConvite }] = await runSql<{ id_convite: number }>(`
    INSERT INTO convite_contrato (
      id_contrato, email, papel_no_contrato, cargo, grau_responsabilidade, areas,
      token_hash, id_usuario_convidou, dt_expiracao, dt_uso
    ) VALUES (
      ${idContrato}, '${overrides.email}', '${overrides.papel ?? "assessor"}', 'assessor', 'titular',
      ARRAY['saude','educacao'], '${hashToken(overrides.token)}', ${idConvidante},
      ${dtExpiracaoSql}, ${dtUsoSql}
    ) RETURNING id_convite;
  `);
  idsConvite.push(idConvite);
  return idConvite;
}

describe("T3 -- app.consumir_convite", () => {
  beforeAll(async () => {
    const GESTORA_EMAIL = "t3-consumir-convite-gestora@legislabrasil.test";
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
        ('${GESTORA_EMAIL}', 'T3 Gestora', 'gestora', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);
    emailsUsuario.push(GESTORA_EMAIL);

    const [{ id_contratante: idCont }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'T3 Mandato Fixture')
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
  }, 60000);

  afterAll(async () => {
    if (idsConvite.length) {
      await runSql(`DELETE FROM convite_contrato WHERE id_convite IN (${idsConvite.join(",")});`);
    }
    await runSql(`DELETE FROM rel_usuario_contrato WHERE id_contrato = ${idContrato};`);
    await runSql(`DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};`);
    await runSql(`DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};`);
    await runSql(`DELETE FROM dim_planejamento WHERE id_contrato = ${idContrato};`);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};`);
    await runSql(`DELETE FROM dim_mandato WHERE id_mandato = ${idMandato};`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);

    const todosEmails = [
      ...emailsUsuario,
      "t3-convidado-novo@legislabrasil.test",
      "t3-convidado-preexistente@legislabrasil.test",
      "t3-convidado-usado@legislabrasil.test",
      "t3-convidado-expirado@legislabrasil.test",
      "t3-convidado-reconsumo@legislabrasil.test",
    ];
    const idsUsuarios = await runSql<{ id_usuario: number }>(
      `SELECT id_usuario FROM dim_usuario WHERE email IN (${todosEmails.map((e) => `'${e}'`).join(",")});`
    );
    const idList = idsUsuarios.map((r) => r.id_usuario).join(",") || "-1";
    await runSql(
      `DELETE FROM log_auditoria WHERE id_usuario IN (${idList}) OR id_usuario_impersonado IN (${idList});`
    );
    await runSql(`DELETE FROM dim_usuario WHERE email IN (${todosEmails.map((e) => `'${e}'`).join(",")});`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 60000);

  it("app.consumir_convite is SECURITY INVOKER (prosecdef = false)", async () => {
    const rows = await runSql<{ prosecdef: boolean }>(`
      SELECT prosecdef FROM pg_proc
       WHERE pronamespace = 'app'::regnamespace AND proname = 'consumir_convite';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].prosecdef).toBe(false);
  });

  it("EXECUTE é negado a anon/authenticated (só service_role pode chamar)", async () => {
    const anonClient = createClient(URL, ANON_KEY);
    const { data, error } = await anonClient
      .schema("app")
      .rpc("consumir_convite", { p_token_hash: hashToken("qualquer"), p_nome: "x" });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("convite válido: cria dim_usuario novo (conta_nova=true), insere rel_usuario_contrato, marca dt_uso", async () => {
    const token = "t3-token-novo";
    const idConvite = await criarConvite({ email: "t3-convidado-novo@legislabrasil.test", token });

    const { data, error } = await admin
      .schema("app")
      .rpc("consumir_convite", { p_token_hash: hashToken(token), p_nome: "Convidado Novo" });
    expect(error).toBeNull();
    expect(data).toMatchObject({ conta_nova: true });

    const [usuario] = await runSql<{ id_usuario: number; papel_global: string }>(
      `SELECT id_usuario, papel_global FROM dim_usuario WHERE email = 't3-convidado-novo@legislabrasil.test';`
    );
    expect(usuario).toBeDefined();
    expect(usuario.papel_global).toBe("assessor");
    expect(usuario.id_usuario).toBe((data as { id_usuario: number }).id_usuario);

    const [vinculo] = await runSql<{
      papel_no_contrato: string;
      cargo: string;
      grau_responsabilidade: string;
      areas: string[];
    }>(`
      SELECT papel_no_contrato, cargo, grau_responsabilidade, areas
        FROM rel_usuario_contrato
       WHERE id_contrato = ${idContrato} AND id_usuario = ${usuario.id_usuario};
    `);
    expect(vinculo.papel_no_contrato).toBe("assessor");
    expect(vinculo.cargo).toBe("assessor");
    expect(vinculo.grau_responsabilidade).toBe("titular");
    expect(vinculo.areas).toEqual(["saude", "educacao"]);

    const [convite] = await runSql<{ dt_uso: string | null }>(
      `SELECT dt_uso FROM convite_contrato WHERE id_convite = ${idConvite};`
    );
    expect(convite.dt_uso).not.toBeNull();
  });

  it("e-mail já existente com outro papel_global: não sobrescreve papel_global, conta_nova=false, só insere o vínculo novo", async () => {
    await runSql(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo) VALUES
        ('t3-convidado-preexistente@legislabrasil.test', 'Convidado Preexistente', 'mentor', true);
    `);
    const token = "t3-token-preexistente";
    await criarConvite({ email: "t3-convidado-preexistente@legislabrasil.test", papel: "assessor", token });

    const { data, error } = await admin
      .schema("app")
      .rpc("consumir_convite", { p_token_hash: hashToken(token), p_nome: "Nome Ignorado" });
    expect(error).toBeNull();
    expect(data).toMatchObject({ conta_nova: false });

    const [usuario] = await runSql<{ papel_global: string; nome: string }>(
      `SELECT papel_global, nome FROM dim_usuario WHERE email = 't3-convidado-preexistente@legislabrasil.test';`
    );
    expect(usuario.papel_global).toBe("mentor"); // nunca sobrescrito pra 'assessor'
    expect(usuario.nome).toBe("Convidado Preexistente"); // nome submetido no consumo é ignorado

    const rows = await runSql<{ count: string }>(`
      SELECT count(*)::int AS count FROM rel_usuario_contrato v
        JOIN dim_usuario u ON u.id_usuario = v.id_usuario
       WHERE u.email = 't3-convidado-preexistente@legislabrasil.test' AND v.id_contrato = ${idContrato};
    `);
    expect(Number(rows[0].count)).toBe(1);
  });

  it("convite já usado (dt_uso preenchido) é rejeitado sem alterar nada", async () => {
    const token = "t3-token-usado";
    await criarConvite({
      email: "t3-convidado-usado@legislabrasil.test",
      token,
      dtUso: new Date().toISOString(),
    });

    const { data, error } = await admin
      .schema("app")
      .rpc("consumir_convite", { p_token_hash: hashToken(token), p_nome: "Não Deveria Criar" });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("CNV02");

    const rows = await runSql<{ count: string }>(
      `SELECT count(*)::int AS count FROM dim_usuario WHERE email = 't3-convidado-usado@legislabrasil.test';`
    );
    expect(Number(rows[0].count)).toBe(0);
  });

  it("convite expirado (dt_expiracao no passado) é rejeitado sem alterar nada", async () => {
    const token = "t3-token-expirado";
    await criarConvite({
      email: "t3-convidado-expirado@legislabrasil.test",
      token,
      dtExpiracaoSql: "now() - interval '1 day'",
    });

    const { data, error } = await admin
      .schema("app")
      .rpc("consumir_convite", { p_token_hash: hashToken(token), p_nome: "Não Deveria Criar" });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("CNV03");

    const rows = await runSql<{ count: string }>(
      `SELECT count(*)::int AS count FROM dim_usuario WHERE email = 't3-convidado-expirado@legislabrasil.test';`
    );
    expect(Number(rows[0].count)).toBe(0);
  });

  it("token que não corresponde a nenhum hash é rejeitado (convite inválido)", async () => {
    const { data, error } = await admin
      .schema("app")
      .rpc("consumir_convite", { p_token_hash: hashToken("t3-token-inexistente"), p_nome: "x" });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("CNV01");
  });

  it("reconsumo do mesmo convite (2ª chamada) é rejeitado, sem duplicar vínculo", async () => {
    const token = "t3-token-reconsumo";
    await criarConvite({ email: "t3-convidado-reconsumo@legislabrasil.test", token });

    const primeira = await admin
      .schema("app")
      .rpc("consumir_convite", { p_token_hash: hashToken(token), p_nome: "Convidado Reconsumo" });
    expect(primeira.error).toBeNull();

    const segunda = await admin
      .schema("app")
      .rpc("consumir_convite", { p_token_hash: hashToken(token), p_nome: "Convidado Reconsumo" });
    expect(segunda.data).toBeNull();
    expect(segunda.error?.code).toBe("CNV02");

    const rows = await runSql<{ count: string }>(`
      SELECT count(*)::int AS count FROM rel_usuario_contrato v
        JOIN dim_usuario u ON u.id_usuario = v.id_usuario
       WHERE u.email = 't3-convidado-reconsumo@legislabrasil.test' AND v.id_contrato = ${idContrato};
    `);
    expect(Number(rows[0].count)).toBe(1);
  });
});
