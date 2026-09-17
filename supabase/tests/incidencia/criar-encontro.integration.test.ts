import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: ficha-mandato-contrato T18 Done-when
// (.specs/features/ficha-mandato-contrato/tasks.md), migration
// 20260917194257_ficha_fn_criar_encontro.sql -- design.md "Components" >
// RPCs > app.criar_encontro:
//  - SECURITY INVOKER (sem cláusula), encontro + N participantes numa
//    transação única.
//  - Valida que id_etapa pertence ao PRODUTO do contrato.
//  - Valida que id_tipo_registro pertence à etapa informada.
//  - Participante com id_usuario E nome_livre -> RAISE EXCEPTION.
//  - Falha no meio não deixa encontro sem participantes (rollback).
//
// spec.md P2 "Agenda na ficha e Novo Agendamento" AC2/AC3/AC4/AC6 (FMC-30,
// FMC-31, FMC-32).

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "FMC-T18-criar-encontro-P4ssword!";
const GESTORA_EMAIL = "fmc-t18-gestora@legislabrasil.test";

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

async function makeFixture(label: string, produto = "Estratégia"): Promise<Fixture> {
  const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'FMC T18 ${label}')
    RETURNING id_contratante;
  `);
  const [{ id_contrato: idContrato }] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
    VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = '${produto}'), CURRENT_DATE, 'ativo')
    RETURNING id_contrato;
  `);
  return { idContratante, idContrato };
}

let a: Fixture; // contrato de Estratégia -- alvo dos testes
let idEtapaPontape: number; // etapa "Pontapé" (Estratégia)
let idTipoPontape: number; // tipo "Pontapé" (etapa Pontapé)
let idTipoSprint: number; // tipo "Reunião Semanal" (etapa Governança) -- não pertence a idEtapaPontape
let idEtapaPll: number; // etapa de outro produto (PLL) -- não pertence ao produto de `a`
let idUsuarioGestora: number;
let gestoraClient: SupabaseClient;

const idsEncontroCriados: number[] = [];

describe("ficha-mandato-contrato T18 -- app.criar_encontro", () => {
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
      VALUES ('${GESTORA_EMAIL}', 'FMC T18 Gestora', 'gestora', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);
    idUsuarioGestora = (
      await runSql<{ id_usuario: number }>(`SELECT id_usuario FROM dim_usuario WHERE email = '${GESTORA_EMAIL}';`)
    )[0].id_usuario;

    const pontape = (
      await runSql<{ id_tipo_registro: number; id_etapa: number }>(`
      SELECT tr.id_tipo_registro, tr.id_etapa FROM ref_tipo_registro tr
        JOIN ref_etapa e ON e.id_etapa = tr.id_etapa
        JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE p.nome = 'Estratégia' AND tr.codigo = 'pontape';
    `)
    )[0];
    idEtapaPontape = pontape.id_etapa;
    idTipoPontape = pontape.id_tipo_registro;

    idTipoSprint = (
      await runSql<{ id_tipo_registro: number }>(`
      SELECT tr.id_tipo_registro FROM ref_tipo_registro tr
        JOIN ref_etapa e ON e.id_etapa = tr.id_etapa
        JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE p.nome = 'Estratégia' AND tr.codigo = 'sprint';
    `)
    )[0].id_tipo_registro;

    idEtapaPll = (
      await runSql<{ id_etapa: number }>(`
      SELECT e.id_etapa FROM ref_etapa e
        JOIN ref_produto p ON p.id_produto = e.id_produto
       WHERE p.nome = 'PLL' ORDER BY e.ordem LIMIT 1;
    `)
    )[0].id_etapa;

    a = await makeFixture("A");

    gestoraClient = await signInAs(GESTORA_EMAIL);
  }, 120000);

  afterAll(async () => {
    if (idsEncontroCriados.length > 0) {
      await runSql(`
        DELETE FROM rel_encontro_participante WHERE id_encontro IN (${idsEncontroCriados.join(",")});
        DELETE FROM fat_encontro WHERE id_encontro IN (${idsEncontroCriados.join(",")});
      `);
    }
    await runSql(`
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

  it("caminho feliz: cria fat_encontro + N participantes (1 usuário + 1 externo) numa transação", async () => {
    const { data, error } = await gestoraClient.schema("app").rpc("criar_encontro", {
      p_id_contrato: a.idContrato,
      p_titulo: "FMC T18 Pontapé",
      p_id_etapa: idEtapaPontape,
      p_id_tipo_registro: idTipoPontape,
      p_dt_inicio: "2026-10-01T10:00:00Z",
      p_dt_fim: "2026-10-01T11:00:00Z",
      p_modalidade: "presencial",
      p_local: "Sede",
      p_tema: "Abertura",
      p_participantes: [
        { id_usuario: idUsuarioGestora, nome_livre: null, origem: "legisla" },
        { id_usuario: null, nome_livre: "Fulano Externo", origem: "externo" },
      ],
    });
    expect(error).toBeNull();
    expect(data).toBeGreaterThan(0);
    idsEncontroCriados.push(data as number);

    const [row] = await runSql<{
      id_contrato: number;
      id_etapa: number;
      id_tipo_registro: number;
      titulo: string;
      modalidade: string;
      local: string;
      tema_prioritario: string;
    }>(`
      SELECT id_contrato, id_etapa, id_tipo_registro, titulo, modalidade, local, tema_prioritario
        FROM fat_encontro WHERE id_encontro = ${data};
    `);
    expect(row.id_contrato).toBe(a.idContrato);
    expect(row.id_etapa).toBe(idEtapaPontape);
    expect(row.id_tipo_registro).toBe(idTipoPontape);
    expect(row.titulo).toBe("FMC T18 Pontapé");
    expect(row.modalidade).toBe("presencial");
    expect(row.local).toBe("Sede");
    expect(row.tema_prioritario).toBe("Abertura");

    const participantes = await runSql<{ id_usuario: number | null; nome_livre: string | null; origem: string }>(`
      SELECT id_usuario, nome_livre, origem FROM rel_encontro_participante
       WHERE id_encontro = ${data} ORDER BY id_participacao;
    `);
    expect(participantes).toHaveLength(2);
    expect(participantes[0].id_usuario).toBe(idUsuarioGestora);
    expect(participantes[0].origem).toBe("legisla");
    expect(participantes[1].nome_livre).toBe("Fulano Externo");
    expect(participantes[1].origem).toBe("externo");
  });

  it("caminho feliz: array de participantes vazio cria encontro sem nenhuma linha em rel_encontro_participante", async () => {
    const { data, error } = await gestoraClient.schema("app").rpc("criar_encontro", {
      p_id_contrato: a.idContrato,
      p_titulo: "FMC T18 sem participantes",
      p_id_etapa: idEtapaPontape,
      p_id_tipo_registro: idTipoPontape,
      p_dt_inicio: "2026-10-02T10:00:00Z",
      p_participantes: [],
    });
    expect(error).toBeNull();
    idsEncontroCriados.push(data as number);

    const count = await runSql<{ count: number }>(`
      SELECT count(*)::int AS count FROM rel_encontro_participante WHERE id_encontro = ${data};
    `);
    expect(count[0].count).toBe(0);
  });

  it("rejeita id_etapa que não pertence ao produto do contrato", async () => {
    const { data, error } = await gestoraClient.schema("app").rpc("criar_encontro", {
      p_id_contrato: a.idContrato,
      p_titulo: "FMC T18 etapa de outro produto",
      p_id_etapa: idEtapaPll,
      p_id_tipo_registro: idTipoPontape,
      p_dt_inicio: "2026-10-03T10:00:00Z",
      p_participantes: [],
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toContain("não pertence ao produto do contrato");
  });

  it("rejeita id_tipo_registro que não pertence à etapa informada", async () => {
    const { data, error } = await gestoraClient.schema("app").rpc("criar_encontro", {
      p_id_contrato: a.idContrato,
      p_titulo: "FMC T18 tipo de outra etapa",
      p_id_etapa: idEtapaPontape,
      p_id_tipo_registro: idTipoSprint,
      p_dt_inicio: "2026-10-04T10:00:00Z",
      p_participantes: [],
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toContain("não pertence à etapa");
  });

  it("rejeita participante com id_usuario e nome_livre ao mesmo tempo", async () => {
    const { data, error } = await gestoraClient.schema("app").rpc("criar_encontro", {
      p_id_contrato: a.idContrato,
      p_titulo: "FMC T18 participante ambíguo",
      p_id_etapa: idEtapaPontape,
      p_id_tipo_registro: idTipoPontape,
      p_dt_inicio: "2026-10-05T10:00:00Z",
      p_participantes: [{ id_usuario: idUsuarioGestora, nome_livre: "Nome e id juntos", origem: "legisla" }],
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toContain("não pode ter id_usuario e nome_livre");
  });

  it("rollback: falha no meio do loop de participantes não deixa encontro nem participante gravado", async () => {
    const antesEncontros = await runSql<{ count: number }>(`
      SELECT count(*)::int AS count FROM fat_encontro WHERE id_contrato = ${a.idContrato};
    `);

    const { data, error } = await gestoraClient.schema("app").rpc("criar_encontro", {
      p_id_contrato: a.idContrato,
      p_titulo: "FMC T18 rollback",
      p_id_etapa: idEtapaPontape,
      p_id_tipo_registro: idTipoPontape,
      p_dt_inicio: "2026-10-06T10:00:00Z",
      p_participantes: [
        { id_usuario: null, nome_livre: "Participante válido", origem: "externo" },
        { id_usuario: idUsuarioGestora, nome_livre: "Participante inválido", origem: "legisla" },
      ],
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();

    const depoisEncontros = await runSql<{ count: number }>(`
      SELECT count(*)::int AS count FROM fat_encontro WHERE id_contrato = ${a.idContrato};
    `);
    expect(depoisEncontros[0].count).toBe(antesEncontros[0].count);

    const orfaos = await runSql<{ count: number }>(`
      SELECT count(*)::int AS count FROM rel_encontro_participante
       WHERE nome_livre = 'Participante válido';
    `);
    expect(orfaos[0].count).toBe(0);
  });
});
