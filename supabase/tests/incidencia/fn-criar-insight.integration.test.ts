import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: incidencia-encontros T13 Done-when
// (.specs/features/incidencia-encontros/tasks.md), migration
// 20260813193529_incidencia_encontros_fn_criar_insight.sql --
//  - Caminho feliz sem origem, com Registro, com Meta, com Sucesso (e Meta+Sucesso
//    simultâneos, "What" da task -- 1 linha em rel_insight_origem com as 2 colunas)
//  - Rejeição cross-contrato nos 3 vínculos (Registro, Meta, Sucesso)
//  - >=5 casos, npm run test:integration verde
//
// spec.md P2 "Insight vinculado ao Registro/Meta/Sucesso Mensal" AC1/AC2/AC3/AC4.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "INC-T13-criar-insight-P4ssword!";
const ASSESSOR_EMAIL = "inc-t13-assessor@legislabrasil.test";

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
  idRegistro: number;
}

let idTipoRegistro: number;
let idUsuarioAssessor: number;

async function makeFixture(label: string): Promise<Fixture> {
  const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'INC T13 ${label}')
    RETURNING id_contratante;
  `);
  const [{ id_contrato: idContrato }] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
    VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
    RETURNING id_contrato;
  `);
  const [{ id_planejamento: idPlanejamento }] = await runSql<{ id_planejamento: number }>(`
    SELECT id_planejamento FROM dim_planejamento WHERE id_contrato = ${idContrato};
  `);
  const [{ id_objetivo: idObjetivo }] = await runSql<{ id_objetivo: number }>(`
    INSERT INTO fat_objetivo_especifico (id_planejamento, descricao)
    VALUES (${idPlanejamento}, 'INC T13 objetivo ${label}')
    RETURNING id_objetivo;
  `);
  const [{ id_meta: idMeta }] = await runSql<{ id_meta: number }>(`
    INSERT INTO fat_meta (id_objetivo, descricao)
    VALUES (${idObjetivo}, 'INC T13 meta ${label}')
    RETURNING id_meta;
  `);
  const [{ id_sucesso: idSucesso }] = await runSql<{ id_sucesso: number }>(`
    INSERT INTO fat_sucesso_mensal (id_meta, descricao, mes_referencia, peso)
    VALUES (${idMeta}, 'INC T13 sucesso ${label}', '2026-08-01', 100)
    RETURNING id_sucesso;
  `);
  const [{ id_registro: idRegistro }] = await runSql<{ id_registro: number }>(`
    INSERT INTO fat_registro (id_contrato, id_tipo_registro, ocorrido_em, id_usuario_autor)
    VALUES (${idContrato}, ${idTipoRegistro}, now(), ${idUsuarioAssessor})
    RETURNING id_registro;
  `);
  return { idContratante, idContrato, idPlanejamento, idObjetivo, idMeta, idSucesso, idRegistro };
}

let a: Fixture; // carteira do assessor
let b: Fixture; // fora da carteira
let assessorClient: SupabaseClient;
const idsInsightCriados: number[] = [];

describe("incidencia-encontros T13 -- app.criar_insight", () => {
  beforeAll(async () => {
    const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of existing?.users ?? []) {
      if (user.email === ASSESSOR_EMAIL) {
        await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      }
    }
    const { data, error } = await admin.auth.admin.createUser({ email: ASSESSOR_EMAIL, password: PASSWORD, email_confirm: true });
    if (error) throw error;
    authUserIds.push(data.user.id);

    await runSql(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo)
      VALUES ('${ASSESSOR_EMAIL}', 'INC T13 Assessor', 'assessor', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);
    idUsuarioAssessor = (
      await runSql<{ id_usuario: number }>(`SELECT id_usuario FROM dim_usuario WHERE email = '${ASSESSOR_EMAIL}';`)
    )[0].id_usuario;

    idTipoRegistro = (
      await runSql<{ id_tipo_registro: number }>(`
      SELECT tr.id_tipo_registro FROM ref_tipo_registro tr
        JOIN ref_etapa e ON e.id_etapa = tr.id_etapa
        JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE p.nome = 'Estratégia' AND tr.codigo = 'monitoramento';
    `)
    )[0].id_tipo_registro;

    a = await makeFixture("A (carteira)");
    b = await makeFixture("B (fora da carteira)");

    await runSql(`
      INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
      SELECT ${a.idContrato}, id_usuario, 'assessor' FROM dim_usuario WHERE email = '${ASSESSOR_EMAIL}'
      ON CONFLICT (id_contrato, id_usuario, papel_no_contrato) DO NOTHING;
    `);

    assessorClient = await signInAs(ASSESSOR_EMAIL);
  }, 120000);

  afterAll(async () => {
    if (idsInsightCriados.length > 0) {
      await runSql(`DELETE FROM fat_insight WHERE id_insight IN (${idsInsightCriados.join(",")});`);
    }
    for (const f of [a, b]) {
      await runSql(`
        DELETE FROM fat_insight WHERE id_contrato = ${f.idContrato};
        DELETE FROM fat_registro WHERE id_contrato = ${f.idContrato};
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
    await runSql(`DELETE FROM log_auditoria WHERE id_usuario = ${idUsuarioAssessor} OR id_usuario_impersonado = ${idUsuarioAssessor};`);
    await runSql(`DELETE FROM dim_usuario WHERE email = '${ASSESSOR_EMAIL}';`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 120000);

  it("caminho feliz sem origem: cria fat_insight sem id_registro e sem rel_insight_origem", async () => {
    const { data, error } = await assessorClient.schema("app").rpc("criar_insight", {
      p_id_contrato: a.idContrato,
      p_conteudo: "INC T13 insight sem origem",
    });
    expect(error).toBeNull();
    expect(data).toBeGreaterThan(0);
    idsInsightCriados.push(data as number);

    const [row] = await runSql<{ id_contrato: number; id_registro: number | null; conteudo: string; id_usuario_autor: number }>(`
      SELECT id_contrato, id_registro, conteudo, id_usuario_autor FROM fat_insight WHERE id_insight = ${data};
    `);
    expect(row.id_contrato).toBe(a.idContrato);
    expect(row.id_registro).toBeNull();
    expect(row.conteudo).toBe("INC T13 insight sem origem");
    expect(row.id_usuario_autor).toBeGreaterThan(0);

    const vinculos = await runSql<{ count: number }>(`SELECT count(*)::int AS count FROM rel_insight_origem WHERE id_insight = ${data};`);
    expect(vinculos[0].count).toBe(0);
  });

  it("caminho feliz com Registro de origem (mesmo contrato): grava fat_insight.id_registro", async () => {
    const { data, error } = await assessorClient.schema("app").rpc("criar_insight", {
      p_id_contrato: a.idContrato,
      p_conteudo: "INC T13 insight com registro",
      p_id_registro: a.idRegistro,
    });
    expect(error).toBeNull();
    expect(data).toBeGreaterThan(0);
    idsInsightCriados.push(data as number);

    const [row] = await runSql<{ id_registro: number }>(`SELECT id_registro FROM fat_insight WHERE id_insight = ${data};`);
    expect(row.id_registro).toBe(a.idRegistro);
  });

  it("caminho feliz com Meta de origem (mesmo contrato): grava rel_insight_origem.id_meta", async () => {
    const { data, error } = await assessorClient.schema("app").rpc("criar_insight", {
      p_id_contrato: a.idContrato,
      p_conteudo: "INC T13 insight com meta",
      p_id_meta_origem: a.idMeta,
    });
    expect(error).toBeNull();
    idsInsightCriados.push(data as number);

    const [vinculo] = await runSql<{ id_meta: number; id_sucesso: number | null }>(`
      SELECT id_meta, id_sucesso FROM rel_insight_origem WHERE id_insight = ${data};
    `);
    expect(vinculo.id_meta).toBe(a.idMeta);
    expect(vinculo.id_sucesso).toBeNull();
  });

  it("caminho feliz com Sucesso Mensal de origem (mesmo contrato): grava rel_insight_origem.id_sucesso", async () => {
    const { data, error } = await assessorClient.schema("app").rpc("criar_insight", {
      p_id_contrato: a.idContrato,
      p_conteudo: "INC T13 insight com sucesso",
      p_id_sucesso_origem: a.idSucesso,
    });
    expect(error).toBeNull();
    idsInsightCriados.push(data as number);

    const [vinculo] = await runSql<{ id_meta: number | null; id_sucesso: number }>(`
      SELECT id_meta, id_sucesso FROM rel_insight_origem WHERE id_insight = ${data};
    `);
    expect(vinculo.id_sucesso).toBe(a.idSucesso);
    expect(vinculo.id_meta).toBeNull();
  });

  it("caminho feliz com Meta + Sucesso simultâneos: grava 1 única linha em rel_insight_origem com as 2 colunas", async () => {
    const { data, error } = await assessorClient.schema("app").rpc("criar_insight", {
      p_id_contrato: a.idContrato,
      p_conteudo: "INC T13 insight com meta e sucesso",
      p_id_meta_origem: a.idMeta,
      p_id_sucesso_origem: a.idSucesso,
    });
    expect(error).toBeNull();
    idsInsightCriados.push(data as number);

    const vinculos = await runSql<{ id_meta: number; id_sucesso: number }>(
      `SELECT id_meta, id_sucesso FROM rel_insight_origem WHERE id_insight = ${data};`
    );
    expect(vinculos).toHaveLength(1);
    expect(vinculos[0].id_meta).toBe(a.idMeta);
    expect(vinculos[0].id_sucesso).toBe(a.idSucesso);
  });

  it("rejeita Registro de origem que pertence a outro contrato (B)", async () => {
    const { data, error } = await assessorClient.schema("app").rpc("criar_insight", {
      p_id_contrato: a.idContrato,
      p_conteudo: "INC T13 insight registro cross-contrato",
      p_id_registro: b.idRegistro,
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toContain("não pertence ao contrato");
  });

  it("rejeita Meta de origem que pertence a outro contrato (B)", async () => {
    const { data, error } = await assessorClient.schema("app").rpc("criar_insight", {
      p_id_contrato: a.idContrato,
      p_conteudo: "INC T13 insight meta cross-contrato",
      p_id_meta_origem: b.idMeta,
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toContain("não pertence ao contrato");
  });

  it("rejeita Sucesso Mensal de origem que pertence a outro contrato (B)", async () => {
    const antes = await runSql<{ count: number }>(`SELECT count(*)::int AS count FROM fat_insight WHERE id_contrato = ${a.idContrato};`);

    const { data, error } = await assessorClient.schema("app").rpc("criar_insight", {
      p_id_contrato: a.idContrato,
      p_conteudo: "INC T13 insight sucesso cross-contrato",
      p_id_sucesso_origem: b.idSucesso,
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toContain("não pertence ao contrato");

    const depois = await runSql<{ count: number }>(`SELECT count(*)::int AS count FROM fat_insight WHERE id_contrato = ${a.idContrato};`);
    expect(depois[0].count).toBe(antes[0].count);
  });
});
