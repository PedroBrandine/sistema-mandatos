import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: exclusão definitiva de UM item da Incidência (pedido de Pedro,
// 2026-09-21), migration 20260921230313_fundacao_fn_excluir_incidencia.sql --
//  - só admin/gestora exclui (42501 para o resto), tipo inválido -> 22023
//  - apagar uma ORIGEM (registro/insight/pré-insight) não apaga os fatos
//    geradores que nasceram dela: ficam sem origem (estado válido)
//  - apagar um registro deixa o insight ligado a ele, com id_registro NULL
//  - o resumo (antes) descreve o efeito, e a exclusão devolve o mesmo resumo

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "Excluir-incidencia-P4ssword!";
const GESTORA_EMAIL = "excluir-incidencia-gestora@legislabrasil.test";
const MENTOR_EMAIL = "excluir-incidencia-mentor@legislabrasil.test";

const admin = createClient(URL, SERVICE_ROLE_KEY);
const authUserIds: string[] = [];
let gestora: SupabaseClient;
let mentor: SupabaseClient;
let idContrato: number;
let idContratante: number;
let idUsuario: number;
let idTipoRegistro: number;
let idTipologia: number;

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

async function criarUsuario(email: string, nome: string, papel: "gestora" | "mentor") {
  const { data: existentes } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of existentes?.users ?? []) {
    if (u.email === email) await admin.auth.admin.deleteUser(u.id).catch(() => undefined);
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  authUserIds.push(data.user.id);
  // dim_usuario nunca é apagado: log_auditoria o referencia (FK).
  await runSql(`
    INSERT INTO dim_usuario (email, nome, papel_global, ativo) VALUES ('${email}', '${nome}', '${papel}', true)
    ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
  `);
}

async function um<T>(sql: string): Promise<T> {
  return (await runSql<T>(sql))[0];
}

async function contar(tabela: string, coluna: string, id: number): Promise<number> {
  return (await um<{ n: number }>(`SELECT count(*)::int AS n FROM ${tabela} WHERE ${coluna} = ${id};`)).n;
}

async function criarRegistro(): Promise<number> {
  return (
    await um<{ id_registro: number }>(`
      INSERT INTO fat_registro (id_contrato, id_tipo_registro, ocorrido_em, resumo, id_usuario_autor)
      VALUES (${idContrato}, ${idTipoRegistro}, now(), 'EXI registro', ${idUsuario}) RETURNING id_registro;`)
  ).id_registro;
}
async function criarInsight(idRegistro?: number): Promise<number> {
  return (
    await um<{ id_insight: number }>(`
      INSERT INTO fat_insight (id_contrato, conteudo, id_usuario_autor, id_registro)
      VALUES (${idContrato}, 'EXI insight', ${idUsuario}, ${idRegistro ?? "NULL"}) RETURNING id_insight;`)
  ).id_insight;
}
async function criarPreInsight(): Promise<number> {
  return (
    await um<{ id_pre_insight: number }>(`
      INSERT INTO fat_pre_insight (id_contrato, conteudo, id_usuario_autor)
      VALUES (${idContrato}, 'EXI pre-insight', ${idUsuario}) RETURNING id_pre_insight;`)
  ).id_pre_insight;
}
// Fato com uma origem (uma das 4) ligada em rel_fato_origem.
async function criarFato(origem?: { coluna: string; id: number }): Promise<number> {
  const id = (
    await um<{ id_fato_gerador: number }>(`
      INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, nivel_d1, dt_ocorrencia, id_usuario_autor, titulo)
      VALUES (${idContrato}, ${idTipologia}, 'baixo', CURRENT_DATE, ${idUsuario}, 'EXI fato') RETURNING id_fato_gerador;`)
  ).id_fato_gerador;
  if (origem) {
    await runSql(`INSERT INTO rel_fato_origem (id_fato_gerador, ${origem.coluna}) VALUES (${id}, ${origem.id});`);
  }
  return id;
}

describe("app.excluir_incidencia / app.resumo_exclusao_incidencia", () => {
  beforeAll(async () => {
    await criarUsuario(GESTORA_EMAIL, "EXI Gestora", "gestora");
    await criarUsuario(MENTOR_EMAIL, "EXI Mentor", "mentor");
    gestora = await signInAs(GESTORA_EMAIL);
    mentor = await signInAs(MENTOR_EMAIL);

    idContratante = (
      await um<{ id_contratante: number }>(
        `INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'EXI Contratante') RETURNING id_contratante;`
      )
    ).id_contratante;
    await runSql(`INSERT INTO dim_mandato (id_contratante) VALUES (${idContratante});`);
    idContrato = (
      await um<{ id_contrato: number }>(`
        INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
        VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
        RETURNING id_contrato;`)
    ).id_contrato;
    idUsuario = (await um<{ id_usuario: number }>(`SELECT id_usuario FROM dim_usuario ORDER BY id_usuario LIMIT 1;`)).id_usuario;
    idTipoRegistro = (
      await um<{ id_tipo_registro: number }>(`SELECT id_tipo_registro FROM ref_tipo_registro ORDER BY id_tipo_registro LIMIT 1;`)
    ).id_tipo_registro;
    idTipologia = (await um<{ id_tipologia: number }>(`SELECT id_tipologia FROM ref_tipologia ORDER BY id_tipologia LIMIT 1;`))
      .id_tipologia;
  }, 120000);

  afterAll(async () => {
    // Limpa pela própria função de exclusão de mandato (também a exercita).
    await gestora?.schema("app").rpc("excluir_contrato", { p_id_contrato: idContrato });
    await runSql(`UPDATE dim_usuario SET ativo = false WHERE email IN ('${GESTORA_EMAIL}', '${MENTOR_EMAIL}');`);
    for (const id of authUserIds) await admin.auth.admin.deleteUser(id).catch(() => undefined);
  }, 120000);

  it("Mentor não exclui nem consulta o resumo (42501) e o item permanece", async () => {
    const idRegistro = await criarRegistro();

    const resumo = await mentor.schema("app").rpc("resumo_exclusao_incidencia", { p_tipo: "registro", p_id: idRegistro });
    const exclusao = await mentor.schema("app").rpc("excluir_incidencia", { p_tipo: "registro", p_id: idRegistro });

    expect(resumo.error?.code).toBe("42501");
    expect(exclusao.error?.code).toBe("42501");
    expect(await contar("fat_registro", "id_registro", idRegistro)).toBe(1);
  }, 90000);

  it("Registro: some; o Insight ligado fica (sem o registro) e o Fato de origem-registro fica sem origem", async () => {
    const idRegistro = await criarRegistro();
    const idInsight = await criarInsight(idRegistro);
    const idFato = await criarFato({ coluna: "id_registro", id: idRegistro });

    const resumo = await gestora.schema("app").rpc("resumo_exclusao_incidencia", { p_tipo: "registro", p_id: idRegistro });
    expect(resumo.data).toMatchObject({ contagens: { insights_desvinculados: 1, fatos_origem_desfeita: 1 } });

    const r = await gestora.schema("app").rpc("excluir_incidencia", { p_tipo: "registro", p_id: idRegistro });
    expect(r.error).toBeNull();
    expect(r.data).toEqual(resumo.data);

    expect(await contar("fat_registro", "id_registro", idRegistro)).toBe(0);
    expect(await contar("fat_insight", "id_insight", idInsight)).toBe(1);
    expect((await um<{ id_registro: number | null }>(`SELECT id_registro FROM fat_insight WHERE id_insight = ${idInsight};`)).id_registro).toBeNull();
    expect(await contar("fat_fato_gerador", "id_fato_gerador", idFato)).toBe(1);
    expect(await contar("rel_fato_origem", "id_fato_gerador", idFato)).toBe(0);
  }, 150000);

  it("Insight: some; o Fato que nasceu dele fica, sem origem", async () => {
    const idInsight = await criarInsight();
    const idFato = await criarFato({ coluna: "id_insight", id: idInsight });

    const r = await gestora.schema("app").rpc("excluir_incidencia", { p_tipo: "insight", p_id: idInsight });
    expect(r.error).toBeNull();
    expect(r.data).toMatchObject({ contagens: { fatos_origem_desfeita: 1 } });

    expect(await contar("fat_insight", "id_insight", idInsight)).toBe(0);
    expect(await contar("fat_fato_gerador", "id_fato_gerador", idFato)).toBe(1);
    expect(await contar("rel_fato_origem", "id_fato_gerador", idFato)).toBe(0);
  }, 150000);

  it("Pré-Insight: some; o Fato que nasceu dele fica, sem origem", async () => {
    const idPre = await criarPreInsight();
    const idFato = await criarFato({ coluna: "id_pre_insight", id: idPre });

    const r = await gestora.schema("app").rpc("excluir_incidencia", { p_tipo: "pre_insight", p_id: idPre });
    expect(r.error).toBeNull();

    expect(await contar("fat_pre_insight", "id_pre_insight", idPre)).toBe(0);
    expect(await contar("fat_fato_gerador", "id_fato_gerador", idFato)).toBe(1);
    expect(await contar("rel_fato_origem", "id_fato_gerador", idFato)).toBe(0);
  }, 150000);

  it("Fato Gerador: some junto do vínculo de origem, e o resumo informa a situação", async () => {
    const idInsight = await criarInsight();
    const idFato = await criarFato({ coluna: "id_insight", id: idInsight });

    const resumo = await gestora.schema("app").rpc("resumo_exclusao_incidencia", { p_tipo: "fato_gerador", p_id: idFato });
    expect(resumo.data).toMatchObject({ situacao: "realizado", contagens: { vinculos_origem: 1 } });

    const r = await gestora.schema("app").rpc("excluir_incidencia", { p_tipo: "fato_gerador", p_id: idFato });
    expect(r.error).toBeNull();

    expect(await contar("fat_fato_gerador", "id_fato_gerador", idFato)).toBe(0);
    expect(await contar("rel_fato_origem", "id_fato_gerador", idFato)).toBe(0);
    // A origem (insight) não é tocada.
    expect(await contar("fat_insight", "id_insight", idInsight)).toBe(1);
  }, 150000);

  it("tipo inválido -> 22023; item inexistente -> 42501", async () => {
    const invalido = await gestora.schema("app").rpc("excluir_incidencia", { p_tipo: "encontro", p_id: 1 });
    expect(invalido.error?.code).toBe("22023");

    const inexistente = await gestora.schema("app").rpc("excluir_incidencia", { p_tipo: "registro", p_id: 999999999 });
    expect(inexistente.error?.code).toBe("42501");
  }, 60000);
});
