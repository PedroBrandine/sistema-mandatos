import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: ficha-mandato-contrato T20 Done-when
// (.specs/features/ficha-mandato-contrato/tasks.md), migration
// 20260917194328_ficha_fn_criar_registro.sql -- design.md "Components" >
// RPCs > app.criar_registro:
//  - nr_sequencia = MAX+1 por (contrato, tipo), sob FOR UPDATE -- duas
//    chamadas concorrentes produzem sequências distintas (FMC-15 AC3).
//  - Chaves de p_conteudo validadas contra schema_campos do tipo (T13);
//    chave estranha (ausente ou de tipo não-texto) -> exceção.
//  - Artefatos gravados em fat_artefato (escopo='registro',
//    id_referencia=registro criado); falha em qualquer artefato desfaz o
//    registro inteiro (FMC-21).
//  - Presentes gravados em rel_registro_participante;
//    rel_encontro_participante NUNCA é tocada (A-21).
//  - id_usuario_autor via app.id_usuario(), nunca parâmetro (AD-006).
//
// spec.md P1 "Registro de encontro com camada dinâmica" AC2/AC3/AC4/AC6/AC7/
// AC8/AC9/AC10/AC13 (FMC-15, FMC-16, FMC-17, FMC-18, FMC-21).

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "FMC-T20-criar-registro-P4ssword!";
const GESTORA_EMAIL = "fmc-t20-gestora@legislabrasil.test";

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
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'FMC T20 ${label}')
    RETURNING id_contratante;
  `);
  const [{ id_contrato: idContrato }] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
    VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
    RETURNING id_contrato;
  `);
  return { idContratante, idContrato };
}

let a: Fixture;
let idTipoOrganograma: number; // "Diagnóstico de Organograma" -- campos: adequacoes (texto_longo), organograma (link)
let idTipoMonitoramento: number; // "Monitoramento" -- campos: [] (sem campo extra)
let idTipoLegislaAliada: number; // "Legisla Aliada" -- campos: [] -- tipo do registro retroativo (A-08)
let idEtapaMonitoramento: number;
let idUsuarioGestora: number;
let gestoraClient: SupabaseClient;

const idsRegistroCriados: number[] = [];
const idsEncontroCriados: number[] = [];

describe("ficha-mandato-contrato T20 -- app.criar_registro", () => {
  beforeAll(async () => {
    const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of existing?.users ?? []) {
      if (user.email === GESTORA_EMAIL) {
        await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      }
    }
    const { data, error } = await admin.auth.admin.createUser({ email: GESTORA_EMAIL, password: PASSWORD, email_confirm: true });
    if (error) throw error;
    authUserIds.push(data.user.id);

    await runSql(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo)
      VALUES ('${GESTORA_EMAIL}', 'FMC T20 Gestora', 'gestora', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);
    idUsuarioGestora = (
      await runSql<{ id_usuario: number }>(`SELECT id_usuario FROM dim_usuario WHERE email = '${GESTORA_EMAIL}';`)
    )[0].id_usuario;

    idTipoOrganograma = (
      await runSql<{ id_tipo_registro: number }>(`
      SELECT tr.id_tipo_registro FROM ref_tipo_registro tr
        JOIN ref_etapa e ON e.id_etapa = tr.id_etapa
        JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE p.nome = 'Estratégia' AND tr.codigo = 'diagnostico_organograma';
    `)
    )[0].id_tipo_registro;

    const monitoramento = (
      await runSql<{ id_tipo_registro: number; id_etapa: number }>(`
      SELECT tr.id_tipo_registro, tr.id_etapa FROM ref_tipo_registro tr
        JOIN ref_etapa e ON e.id_etapa = tr.id_etapa
        JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE p.nome = 'Estratégia' AND tr.codigo = 'monitoramento';
    `)
    )[0];
    idTipoMonitoramento = monitoramento.id_tipo_registro;
    idEtapaMonitoramento = monitoramento.id_etapa;

    idTipoLegislaAliada = (
      await runSql<{ id_tipo_registro: number }>(`
      SELECT tr.id_tipo_registro FROM ref_tipo_registro tr
        JOIN ref_etapa e ON e.id_etapa = tr.id_etapa
        JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE p.nome = 'Estratégia' AND tr.codigo = 'legisla_aliada';
    `)
    )[0].id_tipo_registro;

    a = await makeFixture("A");

    gestoraClient = await signInAs(GESTORA_EMAIL);
  }, 120000);

  afterAll(async () => {
    if (idsRegistroCriados.length > 0) {
      await runSql(`
        DELETE FROM rel_registro_participante WHERE id_registro IN (${idsRegistroCriados.join(",")});
        DELETE FROM fat_artefato WHERE escopo = 'registro' AND id_referencia IN (${idsRegistroCriados.join(",")});
        DELETE FROM fat_registro WHERE id_registro IN (${idsRegistroCriados.join(",")});
      `);
    }
    if (idsEncontroCriados.length > 0) {
      await runSql(`
        DELETE FROM rel_encontro_participante WHERE id_encontro IN (${idsEncontroCriados.join(",")});
        DELETE FROM fat_encontro WHERE id_encontro IN (${idsEncontroCriados.join(",")});
      `);
    }
    await runSql(`
      DELETE FROM rel_registro_participante WHERE id_registro IN (SELECT id_registro FROM fat_registro WHERE id_contrato = ${a.idContrato});
      DELETE FROM fat_artefato WHERE id_contrato = ${a.idContrato};
      DELETE FROM fat_registro WHERE id_contrato = ${a.idContrato};
      DELETE FROM rel_encontro_participante WHERE id_encontro IN (SELECT id_encontro FROM fat_encontro WHERE id_contrato = ${a.idContrato});
      DELETE FROM fat_encontro WHERE id_contrato = ${a.idContrato};
    `);
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato = ${a.idContrato};
      DELETE FROM rel_formulario_contrato WHERE id_contrato = ${a.idContrato};
      DELETE FROM dim_planejamento WHERE id_contrato = ${a.idContrato};
    `);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${a.idContrato};`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${a.idContratante};`);
    await runSql(`DELETE FROM log_auditoria WHERE id_usuario = ${idUsuarioGestora};`);
    await runSql(`DELETE FROM dim_usuario WHERE email = '${GESTORA_EMAIL}';`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 120000);

  it("caminho feliz: grava conteudo (texto), artefato (link) e presentes numa transação, com autor via app.id_usuario()", async () => {
    const { data, error } = await gestoraClient.schema("app").rpc("criar_registro", {
      p_id_contrato: a.idContrato,
      p_id_tipo_registro: idTipoOrganograma,
      p_ocorrido_em: "2026-10-01T10:00:00Z",
      p_resumo: "FMC T20 caminho feliz",
      p_conteudo: { adequacoes: "Redesenhar o organograma da coordenação" },
      p_artefatos: [{ tipo: "organograma", url: "https://drive.google.com/fmc-t20-organograma", descricao: null }],
      p_presentes: [
        { id_usuario: idUsuarioGestora, nome_livre: null, origem: "legisla" },
        { id_usuario: null, nome_livre: "Fulano Externo", origem: "externo" },
      ],
    });
    expect(error).toBeNull();
    expect(data).toBeGreaterThan(0);
    idsRegistroCriados.push(data as number);

    const [registro] = await runSql<{
      id_contrato: number;
      id_tipo_registro: number;
      nr_sequencia: number;
      resumo: string;
      conteudo: Record<string, unknown>;
      id_usuario_autor: number;
    }>(`
      SELECT id_contrato, id_tipo_registro, nr_sequencia, resumo, conteudo, id_usuario_autor
        FROM fat_registro WHERE id_registro = ${data};
    `);
    expect(registro.id_contrato).toBe(a.idContrato);
    expect(registro.nr_sequencia).toBe(1);
    expect(registro.resumo).toBe("FMC T20 caminho feliz");
    expect(registro.conteudo).toEqual({ adequacoes: "Redesenhar o organograma da coordenação" });
    expect(registro.id_usuario_autor).toBe(idUsuarioGestora);

    const artefatos = await runSql<{ escopo: string; id_referencia: number; tipo: string; url: string }>(`
      SELECT escopo, id_referencia, tipo, url FROM fat_artefato WHERE id_referencia = ${data} AND escopo = 'registro';
    `);
    expect(artefatos).toHaveLength(1);
    expect(artefatos[0].id_referencia).toBe(data);
    expect(artefatos[0].tipo).toBe("organograma");
    expect(artefatos[0].url).toBe("https://drive.google.com/fmc-t20-organograma");

    const presentes = await runSql<{ id_usuario: number | null; nome_livre: string | null }>(`
      SELECT id_usuario, nome_livre FROM rel_registro_participante WHERE id_registro = ${data} ORDER BY id_participacao;
    `);
    expect(presentes).toHaveLength(2);
    expect(presentes[0].id_usuario).toBe(idUsuarioGestora);
    expect(presentes[1].nome_livre).toBe("Fulano Externo");
  });

  it("nr_sequencia: o próximo registro do MESMO contrato+tipo recebe o sucessor do maior valor existente", async () => {
    const { data, error } = await gestoraClient.schema("app").rpc("criar_registro", {
      p_id_contrato: a.idContrato,
      p_id_tipo_registro: idTipoOrganograma,
      p_ocorrido_em: "2026-10-02T10:00:00Z",
      p_conteudo: {},
      p_artefatos: [],
      p_presentes: [],
    });
    expect(error).toBeNull();
    idsRegistroCriados.push(data as number);

    const [{ nr_sequencia }] = await runSql<{ nr_sequencia: number }>(
      `SELECT nr_sequencia FROM fat_registro WHERE id_registro = ${data};`
    );
    expect(nr_sequencia).toBe(2);
  });

  it("rejeita chave de p_conteudo ausente de schema_campos", async () => {
    const { data, error } = await gestoraClient.schema("app").rpc("criar_registro", {
      p_id_contrato: a.idContrato,
      p_id_tipo_registro: idTipoOrganograma,
      p_ocorrido_em: "2026-10-03T10:00:00Z",
      p_conteudo: { chave_inexistente: "valor" },
      p_artefatos: [],
      p_presentes: [],
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toContain("não é um campo de texto declarado");
  });

  it("rejeita chave de p_conteudo que existe em schema_campos mas não é campo de texto (ex.: 'organograma' é tipo link)", async () => {
    const { data, error } = await gestoraClient.schema("app").rpc("criar_registro", {
      p_id_contrato: a.idContrato,
      p_id_tipo_registro: idTipoOrganograma,
      p_ocorrido_em: "2026-10-04T10:00:00Z",
      p_conteudo: { organograma: "isto deveria ser um artefato, não texto" },
      p_artefatos: [],
      p_presentes: [],
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toContain("não é um campo de texto declarado");
  });

  it("A-08: registro retroativo (tipo Legisla Aliada, sem encontro) grava id_encontro NULL e ainda registra presentes", async () => {
    const { data, error } = await gestoraClient.schema("app").rpc("criar_registro", {
      p_id_contrato: a.idContrato,
      p_id_tipo_registro: idTipoLegislaAliada,
      p_ocorrido_em: "2026-10-04T12:00:00Z",
      p_conteudo: {},
      p_artefatos: [],
      p_presentes: [{ id_usuario: null, nome_livre: "Aliado retroativo", origem: "mandato" }],
    });
    expect(error).toBeNull();
    expect(data).toBeGreaterThan(0);
    idsRegistroCriados.push(data as number);

    const [registro] = await runSql<{ id_encontro: number | null }>(
      `SELECT id_encontro FROM fat_registro WHERE id_registro = ${data};`
    );
    expect(registro.id_encontro).toBeNull();

    const presentes = await runSql<{ nome_livre: string }>(
      `SELECT nome_livre FROM rel_registro_participante WHERE id_registro = ${data};`
    );
    expect(presentes).toHaveLength(1);
    expect(presentes[0].nome_livre).toBe("Aliado retroativo");
  });

  it("rollback: artefato com tipo fora do enum desfaz o registro inteiro (FMC-21)", async () => {
    const antes = await runSql<{ count: number }>(`
      SELECT count(*)::int AS count FROM fat_registro WHERE id_contrato = ${a.idContrato} AND id_tipo_registro = ${idTipoOrganograma};
    `);

    const { data, error } = await gestoraClient.schema("app").rpc("criar_registro", {
      p_id_contrato: a.idContrato,
      p_id_tipo_registro: idTipoOrganograma,
      p_ocorrido_em: "2026-10-05T10:00:00Z",
      p_conteudo: {},
      p_artefatos: [{ tipo: "tipo_fora_do_enum", url: "https://drive.google.com/fmc-t20-rollback", descricao: null }],
      p_presentes: [],
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();

    const depois = await runSql<{ count: number }>(`
      SELECT count(*)::int AS count FROM fat_registro WHERE id_contrato = ${a.idContrato} AND id_tipo_registro = ${idTipoOrganograma};
    `);
    expect(depois[0].count).toBe(antes[0].count);

    const artefatoOrfao = await runSql<{ count: number }>(`
      SELECT count(*)::int AS count FROM fat_artefato WHERE url = 'https://drive.google.com/fmc-t20-rollback';
    `);
    expect(artefatoOrfao[0].count).toBe(0);
  });

  it("rejeita presente com id_usuario e nome_livre ao mesmo tempo", async () => {
    const { data, error } = await gestoraClient.schema("app").rpc("criar_registro", {
      p_id_contrato: a.idContrato,
      p_id_tipo_registro: idTipoOrganograma,
      p_ocorrido_em: "2026-10-06T10:00:00Z",
      p_conteudo: {},
      p_artefatos: [],
      p_presentes: [{ id_usuario: idUsuarioGestora, nome_livre: "Nome e id juntos", origem: "legisla" }],
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toContain("não pode ter id_usuario e nome_livre");
  });

  it("rejeita id_tipo_registro inexistente", async () => {
    const { data, error } = await gestoraClient.schema("app").rpc("criar_registro", {
      p_id_contrato: a.idContrato,
      p_id_tipo_registro: 999999999,
      p_ocorrido_em: "2026-10-07T10:00:00Z",
      p_conteudo: {},
      p_artefatos: [],
      p_presentes: [],
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toContain("não encontrado");
  });

  it("A-21/FMC-18 AC10: presentes gravados em rel_registro_participante não tocam rel_encontro_participante do encontro de origem", async () => {
    const { data: idEncontro, error: erroEncontro } = await gestoraClient.schema("app").rpc("criar_encontro", {
      p_id_contrato: a.idContrato,
      p_titulo: "FMC T20 encontro de origem",
      p_id_etapa: idEtapaMonitoramento,
      p_id_tipo_registro: idTipoMonitoramento,
      p_dt_inicio: "2026-10-08T10:00:00Z",
      p_participantes: [{ id_usuario: idUsuarioGestora, nome_livre: null, origem: "legisla" }],
    });
    expect(erroEncontro).toBeNull();
    idsEncontroCriados.push(idEncontro as number);

    const antesEncontro = await runSql<{ count: number }>(`
      SELECT count(*)::int AS count FROM rel_encontro_participante WHERE id_encontro = ${idEncontro};
    `);
    expect(antesEncontro[0].count).toBe(1);

    const { data: idRegistro, error: erroRegistro } = await gestoraClient.schema("app").rpc("criar_registro", {
      p_id_contrato: a.idContrato,
      p_id_encontro: idEncontro,
      p_id_tipo_registro: idTipoMonitoramento,
      p_ocorrido_em: "2026-10-08T11:00:00Z",
      p_conteudo: {},
      p_artefatos: [],
      p_presentes: [{ id_usuario: null, nome_livre: "Presente só do registro", origem: "externo" }],
    });
    expect(erroRegistro).toBeNull();
    idsRegistroCriados.push(idRegistro as number);

    const presentesRegistro = await runSql<{ nome_livre: string }>(`
      SELECT nome_livre FROM rel_registro_participante WHERE id_registro = ${idRegistro};
    `);
    expect(presentesRegistro).toHaveLength(1);
    expect(presentesRegistro[0].nome_livre).toBe("Presente só do registro");

    const depoisEncontro = await runSql<{ count: number; nomes: string[] }>(`
      SELECT count(*)::int AS count, array_agg(nome_livre) FILTER (WHERE nome_livre IS NOT NULL) AS nomes
        FROM rel_encontro_participante WHERE id_encontro = ${idEncontro};
    `);
    expect(depoisEncontro[0].count).toBe(1);
    expect(depoisEncontro[0].nomes ?? null).toBeNull();
  });

  it("concorrência: duas chamadas simultâneas do mesmo contrato+tipo produzem nr_sequencia distintos (FMC-15 AC3)", async () => {
    const resultados = await Promise.all([
      gestoraClient.schema("app").rpc("criar_registro", {
        p_id_contrato: a.idContrato,
        p_id_tipo_registro: idTipoMonitoramento,
        p_ocorrido_em: "2026-10-09T10:00:00Z",
        p_conteudo: {},
        p_artefatos: [],
        p_presentes: [],
      }),
      gestoraClient.schema("app").rpc("criar_registro", {
        p_id_contrato: a.idContrato,
        p_id_tipo_registro: idTipoMonitoramento,
        p_ocorrido_em: "2026-10-09T10:00:01Z",
        p_conteudo: {},
        p_artefatos: [],
        p_presentes: [],
      }),
    ]);

    for (const { error } of resultados) expect(error).toBeNull();
    const ids = resultados.map((r) => r.data as number);
    idsRegistroCriados.push(...ids);
    expect(ids[0]).not.toBe(ids[1]);

    const sequencias = await runSql<{ nr_sequencia: number }>(`
      SELECT nr_sequencia FROM fat_registro WHERE id_registro IN (${ids.join(",")}) ORDER BY nr_sequencia;
    `);
    expect(sequencias).toHaveLength(2);
    expect(sequencias[0].nr_sequencia).not.toBe(sequencias[1].nr_sequencia);
  });
});
