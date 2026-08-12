import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: kanban-etapas T1 Done-when (.specs/features/kanban-etapas/tasks.md) --
//  - pg_policies.with_check de p_por_carteira/fat_contrato não é mais NULL
//  - Mentor com vínculo ativo consegue UPDATE status direto em fat_etapa_contrato
//    do seu contrato (antes falhava com 42501 por falta de GRANT); mentor sem
//    vínculo continua bloqueado
//  - Mentor consegue UPDATE id_etapa_atual direto em fat_contrato do seu
//    contrato; não consegue em outras colunas (status, por ex.)
//
// spec.md KAN-08 (P1 AC1).

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "KAN-T1-rls-grants-P4ssword!";
const MENTOR_EMAIL = "kan-t1-mentor@legislabrasil.test";

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
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'KAN T1 ${label}')
    RETURNING id_contratante;
  `);
  const [{ id_contrato: idContrato }] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
    VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
    RETURNING id_contrato;
  `);
  return { idContratante, idContrato };
}

let a: Fixture; // contrato com vínculo ativo do mentor
let b: Fixture; // contrato fora da carteira do mentor
let idEtapaPontape: number;

describe("kanban-etapas T1 -- WITH CHECK explícito em fat_contrato + GRANT UPDATE column-scoped (KAN-08)", () => {
  beforeAll(async () => {
    const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of existing?.users ?? []) {
      if (user.email === MENTOR_EMAIL) {
        await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      }
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: MENTOR_EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    authUserIds.push(data.user.id);

    await runSql(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo) VALUES
        ('${MENTOR_EMAIL}', 'KAN T1 Mentor', 'mentor', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);

    a = await makeFixture("A (carteira do mentor)");
    b = await makeFixture("B (fora da carteira)");

    await runSql(`
      INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
      SELECT ${a.idContrato}, id_usuario, 'mentor' FROM dim_usuario WHERE email = '${MENTOR_EMAIL}'
      ON CONFLICT (id_contrato, id_usuario, papel_no_contrato) DO NOTHING;
    `);

    idEtapaPontape = (
      await runSql<{ id_etapa: number }>(`
      SELECT id_etapa FROM ref_etapa
       WHERE id_produto = (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia') AND codigo = 'pontape';
    `)
    )[0].id_etapa;
  }, 120000);

  afterAll(async () => {
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
    // fat_contrato já tem trg_audit_fat_contrato ligado (0012) -- os UPDATEs do
    // mentor nesta suíte geraram linhas em log_auditoria referenciando seu
    // id_usuario; precisam sair antes do DELETE de dim_usuario (FK), mesmo
    // padrão de fn-substituir-vinculo.integration.test.ts.
    const idsUsuario = await runSql<{ id_usuario: number }>(
      `SELECT id_usuario FROM dim_usuario WHERE email = '${MENTOR_EMAIL}';`
    );
    if (idsUsuario.length > 0) {
      const idUsuario = idsUsuario[0].id_usuario;
      await runSql(`DELETE FROM log_auditoria WHERE id_usuario = ${idUsuario} OR id_usuario_impersonado = ${idUsuario};`);
    }
    await runSql(`DELETE FROM dim_usuario WHERE email = '${MENTOR_EMAIL}';`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 120000);

  it("p_por_carteira/fat_contrato tem WITH CHECK explícito, não NULL", async () => {
    const rows = await runSql<{ with_check: string | null }>(`
      SELECT with_check FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'fat_contrato' AND policyname = 'p_por_carteira';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].with_check).not.toBeNull();
  });

  it("mentor com vínculo ativo consegue UPDATE status em fat_etapa_contrato do próprio contrato", async () => {
    const client = await signInAs(MENTOR_EMAIL);
    const hoje = new Date().toISOString().slice(0, 10);

    const { error } = await client
      .from("fat_etapa_contrato")
      .update({ status: "em_andamento", dt_inicio: hoje })
      .eq("id_contrato", a.idContrato)
      .eq("id_etapa", idEtapaPontape);
    expect(error).toBeNull();

    const rows = await runSql<{ status: string; dt_inicio: string }>(`
      SELECT status, dt_inicio FROM fat_etapa_contrato WHERE id_contrato = ${a.idContrato} AND id_etapa = ${idEtapaPontape};
    `);
    expect(rows[0].status).toBe("em_andamento");
    expect(rows[0].dt_inicio).toBe(hoje);
  });

  it("mentor sem vínculo continua bloqueado em fat_etapa_contrato (RLS filtra a linha, nenhuma alteração ocorre)", async () => {
    const client = await signInAs(MENTOR_EMAIL);

    await client
      .from("fat_etapa_contrato")
      .update({ status: "em_andamento" })
      .eq("id_contrato", b.idContrato)
      .eq("id_etapa", idEtapaPontape);

    const rows = await runSql<{ status: string }>(`
      SELECT status FROM fat_etapa_contrato WHERE id_contrato = ${b.idContrato} AND id_etapa = ${idEtapaPontape};
    `);
    expect(rows[0].status).toBe("nao_iniciada");
  });

  it("mentor consegue UPDATE id_etapa_atual em fat_contrato do próprio contrato, mas não outra coluna (status)", async () => {
    const client = await signInAs(MENTOR_EMAIL);

    const { error: erroEtapaAtual } = await client
      .from("fat_contrato")
      .update({ id_etapa_atual: idEtapaPontape })
      .eq("id_contrato", a.idContrato);
    expect(erroEtapaAtual).toBeNull();

    const rows = await runSql<{ id_etapa_atual: number }>(`
      SELECT id_etapa_atual FROM fat_contrato WHERE id_contrato = ${a.idContrato};
    `);
    expect(rows[0].id_etapa_atual).toBe(idEtapaPontape);

    const { error: erroStatus } = await client.from("fat_contrato").update({ status: "ativo" }).eq("id_contrato", a.idContrato);
    expect(erroStatus).not.toBeNull();
    expect(erroStatus?.code).toBe("42501");
  });
});
