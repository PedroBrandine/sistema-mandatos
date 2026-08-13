import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: incidencia-encontros T12 Done-when
// (.specs/features/incidencia-encontros/tasks.md), migration
// 20260813193050_incidencia_encontros_fn_criar_fato_gerador.sql --
//  - Caminho feliz sem origem, com Meta, com Insight
//  - Rejeição de Meta/Insight de outro contrato
//  - >=4 casos, npm run test:integration verde
//
// spec.md P1 "Fato Gerador validado por Tipologia" AC1/AC2/AC3/AC4.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "INC-T12-criar-fato-gerador-P4ssword!";
const ASSESSOR_EMAIL = "inc-t12-assessor@legislabrasil.test";

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
  idInsight: number;
}

async function makeFixture(label: string): Promise<Fixture> {
  const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'INC T12 ${label}')
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
    VALUES (${idPlanejamento}, 'INC T12 objetivo ${label}')
    RETURNING id_objetivo;
  `);
  const [{ id_meta: idMeta }] = await runSql<{ id_meta: number }>(`
    INSERT INTO fat_meta (id_objetivo, descricao)
    VALUES (${idObjetivo}, 'INC T12 meta ${label}')
    RETURNING id_meta;
  `);
  const [{ id_insight: idInsight }] = await runSql<{ id_insight: number }>(`
    INSERT INTO fat_insight (id_contrato, conteudo)
    VALUES (${idContrato}, 'INC T12 insight ${label}')
    RETURNING id_insight;
  `);
  return { idContratante, idContrato, idPlanejamento, idObjetivo, idMeta, idInsight };
}

let a: Fixture; // carteira do assessor
let b: Fixture; // fora da carteira
let idTipologia: number;
let assessorClient: SupabaseClient;

const idsFatoGeradorCriados: number[] = [];

describe("incidencia-encontros T12 -- app.criar_fato_gerador", () => {
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
      VALUES ('${ASSESSOR_EMAIL}', 'INC T12 Assessor', 'assessor', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);

    a = await makeFixture("A (carteira)");
    b = await makeFixture("B (fora da carteira)");

    await runSql(`
      INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
      SELECT ${a.idContrato}, id_usuario, 'assessor' FROM dim_usuario WHERE email = '${ASSESSOR_EMAIL}'
      ON CONFLICT (id_contrato, id_usuario, papel_no_contrato) DO NOTHING;
    `);

    idTipologia = (await runSql<{ id_tipologia: number }>(`SELECT id_tipologia FROM ref_tipologia ORDER BY id_tipologia LIMIT 1;`))[0]
      .id_tipologia;

    assessorClient = await signInAs(ASSESSOR_EMAIL);
  }, 120000);

  afterAll(async () => {
    if (idsFatoGeradorCriados.length > 0) {
      await runSql(`DELETE FROM fat_fato_gerador WHERE id_fato_gerador IN (${idsFatoGeradorCriados.join(",")});`);
    }
    for (const f of [a, b]) {
      await runSql(`
        DELETE FROM fat_fato_gerador WHERE id_contrato = ${f.idContrato};
        DELETE FROM fat_insight WHERE id_contrato = ${f.idContrato};
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
    const idsUsuario = await runSql<{ id_usuario: number }>(`SELECT id_usuario FROM dim_usuario WHERE email = '${ASSESSOR_EMAIL}';`);
    if (idsUsuario.length > 0) {
      await runSql(`DELETE FROM log_auditoria WHERE id_usuario = ${idsUsuario[0].id_usuario} OR id_usuario_impersonado = ${idsUsuario[0].id_usuario};`);
    }
    await runSql(`DELETE FROM dim_usuario WHERE email = '${ASSESSOR_EMAIL}';`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 120000);

  it("caminho feliz sem origem: cria fat_fato_gerador e nenhuma linha em rel_fato_origem", async () => {
    const { data, error } = await assessorClient.schema("app").rpc("criar_fato_gerador", {
      p_id_contrato: a.idContrato,
      p_id_tipologia: idTipologia,
      p_nivel_d1: "baixo",
      p_dt_ocorrencia: "2026-08-01",
    });
    expect(error).toBeNull();
    expect(data).toBeGreaterThan(0);
    idsFatoGeradorCriados.push(data as number);

    const [row] = await runSql<{ id_contrato: number; id_tipologia: number; nivel_d1: string; id_usuario_autor: number }>(`
      SELECT id_contrato, id_tipologia, nivel_d1, id_usuario_autor FROM fat_fato_gerador WHERE id_fato_gerador = ${data};
    `);
    expect(row.id_contrato).toBe(a.idContrato);
    expect(row.id_tipologia).toBe(idTipologia);
    expect(row.nivel_d1).toBe("baixo");
    expect(row.id_usuario_autor).toBeGreaterThan(0);

    const vinculos = await runSql<{ count: number }>(`SELECT count(*)::int AS count FROM rel_fato_origem WHERE id_fato_gerador = ${data};`);
    expect(vinculos[0].count).toBe(0);
  });

  it("caminho feliz com Meta de origem (mesmo contrato): grava rel_fato_origem.id_meta", async () => {
    const { data, error } = await assessorClient.schema("app").rpc("criar_fato_gerador", {
      p_id_contrato: a.idContrato,
      p_id_tipologia: idTipologia,
      p_nivel_d1: "baixo",
      p_dt_ocorrencia: "2026-08-01",
      p_id_meta_origem: a.idMeta,
    });
    expect(error).toBeNull();
    expect(data).toBeGreaterThan(0);
    idsFatoGeradorCriados.push(data as number);

    const [vinculo] = await runSql<{ id_meta: number; id_insight: number | null }>(`
      SELECT id_meta, id_insight FROM rel_fato_origem WHERE id_fato_gerador = ${data};
    `);
    expect(vinculo.id_meta).toBe(a.idMeta);
    expect(vinculo.id_insight).toBeNull();
  });

  it("caminho feliz com Insight de origem (mesmo contrato): grava rel_fato_origem.id_insight", async () => {
    const { data, error } = await assessorClient.schema("app").rpc("criar_fato_gerador", {
      p_id_contrato: a.idContrato,
      p_id_tipologia: idTipologia,
      p_nivel_d2: "medio",
      p_dt_ocorrencia: "2026-08-01",
      p_id_insight_origem: a.idInsight,
    });
    expect(error).toBeNull();
    expect(data).toBeGreaterThan(0);
    idsFatoGeradorCriados.push(data as number);

    const [vinculo] = await runSql<{ id_meta: number | null; id_insight: number }>(`
      SELECT id_meta, id_insight FROM rel_fato_origem WHERE id_fato_gerador = ${data};
    `);
    expect(vinculo.id_insight).toBe(a.idInsight);
    expect(vinculo.id_meta).toBeNull();
  });

  it("rejeita (RAISE EXCEPTION) Meta de origem que pertence a outro contrato (B) -- nenhuma linha criada", async () => {
    const { data, error } = await assessorClient.schema("app").rpc("criar_fato_gerador", {
      p_id_contrato: a.idContrato,
      p_id_tipologia: idTipologia,
      p_nivel_d1: "baixo",
      p_dt_ocorrencia: "2026-08-01",
      p_id_meta_origem: b.idMeta,
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toContain("não pertence ao contrato");

    const [{ count }] = await runSql<{ count: number }>(
      `SELECT count(*)::int AS count FROM fat_fato_gerador WHERE id_contrato = ${a.idContrato} AND dt_ocorrencia = '2026-08-01' AND nivel_d1 = 'baixo' AND id_tipologia = ${idTipologia};`
    );
    // as 2 chamadas felizes com nivel_d1='baixo' já contam 2 -- confirma que
    // esta chamada rejeitada NÃO incrementou a contagem (permanece 2, não 3).
    expect(count).toBe(2);
  });

  it("rejeita (RAISE EXCEPTION) Insight de origem que pertence a outro contrato (B) -- nenhuma linha criada", async () => {
    const antesFatos = await runSql<{ count: number }>(`SELECT count(*)::int AS count FROM fat_fato_gerador WHERE id_contrato = ${a.idContrato};`);

    const { data, error } = await assessorClient.schema("app").rpc("criar_fato_gerador", {
      p_id_contrato: a.idContrato,
      p_id_tipologia: idTipologia,
      p_nivel_d3: "alto",
      p_dt_ocorrencia: "2026-08-01",
      p_id_insight_origem: b.idInsight,
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toContain("não pertence ao contrato");

    const depoisFatos = await runSql<{ count: number }>(`SELECT count(*)::int AS count FROM fat_fato_gerador WHERE id_contrato = ${a.idContrato};`);
    expect(depoisFatos[0].count).toBe(antesFatos[0].count);
  });
});
