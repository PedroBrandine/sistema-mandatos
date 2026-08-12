import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: kanban-etapas T3 Done-when (.specs/features/kanban-etapas/tasks.md) --
//  - SECURITY INVOKER (prosecdef = false)
//  - Avanço (etapa 1, id_etapa_atual IS NULL -> etapa 2): etapa 1 concluida/
//    dt_conclusao = hoje, etapa 2 em_andamento/dt_inicio = hoje,
//    fat_contrato.id_etapa_atual atualizado
//  - Avanço encadeado (etapa 2 -> etapa 3) funciona a partir de id_etapa_atual
//    não-nulo
//  - Avanço não-adjacente (etapa 1 -> etapa 3) rejeitado com KAN01, nenhuma
//    linha alterada
//  - Retrocesso (etapa 2 -> etapa 1) por Admin/Gestora: etapa 1 reabre
//    (em_andamento, dt_conclusao = NULL), etapa 2 zera (nao_iniciada,
//    dt_inicio = NULL, dt_conclusao = NULL)
//  - Retrocesso tentado por Mentor/Assessor com vínculo: rejeitado com 42501,
//    nenhuma linha alterada
//  - Avanço por Mentor com vínculo ativo: permitido (prova que T1 desbloqueou)
//  - Avanço tentado num contrato sem vínculo do usuário: rejeitado (mensagem
//    genérica, sem revelar existência)
//  - Cada avanço/retrocesso bem-sucedido gera linhas em log_auditoria (via
//    trigger de T2, sem INSERT explícito no código da função)
//
// spec.md KAN-04, KAN-05, KAN-06, KAN-07, KAN-08, KAN-09.
// Produto usado: Estratégia -- 7 etapas seedadas (cadastro=1, pontape=2,
// raio_x=3, ...), mesmo produto de operacao-regua-instanciacao.integration.test.ts.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "KAN-T3-mover-etapa-P4ssword!";
const GESTORA_EMAIL = "kan-t3-gestora@legislabrasil.test";
const MENTOR_EMAIL = "kan-t3-mentor@legislabrasil.test";

const admin = createClient(URL, SERVICE_ROLE_KEY);
const authUserIds: string[] = [];
let gestoraClient: SupabaseClient;
let mentorClient: SupabaseClient;

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
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'KAN T3 ${label}')
    RETURNING id_contratante;
  `);
  const [{ id_contrato: idContrato }] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
    VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
    RETURNING id_contrato;
  `);
  return { idContratante, idContrato };
}

async function vincula(idContrato: number, papel: "mentor"): Promise<void> {
  await runSql(`
    INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
    SELECT ${idContrato}, id_usuario, '${papel}' FROM dim_usuario WHERE email = '${MENTOR_EMAIL}'
    ON CONFLICT (id_contrato, id_usuario, papel_no_contrato) DO NOTHING;
  `);
}

interface LinhaEtapa {
  status: string;
  dt_inicio: string | null;
  dt_conclusao: string | null;
}

async function leEtapa(idContrato: number, idEtapa: number): Promise<LinhaEtapa> {
  const rows = await runSql<LinhaEtapa>(`
    SELECT status, dt_inicio, dt_conclusao FROM fat_etapa_contrato
     WHERE id_contrato = ${idContrato} AND id_etapa = ${idEtapa};
  `);
  return rows[0];
}

async function leEtapaAtual(idContrato: number): Promise<number | null> {
  const rows = await runSql<{ id_etapa_atual: number | null }>(
    `SELECT id_etapa_atual FROM fat_contrato WHERE id_contrato = ${idContrato};`
  );
  return rows[0].id_etapa_atual;
}

let idEtapa1: number;
let idEtapa2: number;
let idEtapa3: number;

const fixtures: Fixture[] = [];
let fAvancoEncadeado: Fixture;
let fRetrocessoGestora: Fixture;
let fMentorAvanco: Fixture;

describe("kanban-etapas T3 -- app.mover_etapa_kanban (KAN-04 a KAN-09)", () => {
  beforeAll(async () => {
    const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of existing?.users ?? []) {
      if (user.email && [GESTORA_EMAIL, MENTOR_EMAIL].includes(user.email)) {
        await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      }
    }
    for (const email of [GESTORA_EMAIL, MENTOR_EMAIL]) {
      const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
      if (error) throw error;
      authUserIds.push(data.user.id);
    }
    await runSql(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo) VALUES
        ('${GESTORA_EMAIL}', 'KAN T3 Gestora', 'gestora', true),
        ('${MENTOR_EMAIL}', 'KAN T3 Mentor', 'mentor', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);

    const idProdutoRows = await runSql<{ id_etapa: number; ordem: number }>(`
      SELECT id_etapa, ordem FROM ref_etapa
       WHERE id_produto = (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia') AND ordem IN (1, 2, 3)
       ORDER BY ordem;
    `);
    idEtapa1 = idProdutoRows[0].id_etapa;
    idEtapa2 = idProdutoRows[1].id_etapa;
    idEtapa3 = idProdutoRows[2].id_etapa;

    gestoraClient = await signInAs(GESTORA_EMAIL);
    mentorClient = await signInAs(MENTOR_EMAIL);
  }, 120000);

  afterAll(async () => {
    const idsContrato = fixtures.map((f) => f.idContrato);
    if (idsContrato.length > 0) {
      await runSql(`DELETE FROM rel_usuario_contrato WHERE id_contrato IN (${idsContrato.join(",")});`);
      await runSql(`
        DELETE FROM fat_etapa_contrato WHERE id_contrato IN (${idsContrato.join(",")});
        DELETE FROM rel_formulario_contrato WHERE id_contrato IN (${idsContrato.join(",")});
        DELETE FROM dim_planejamento WHERE id_contrato IN (${idsContrato.join(",")});
      `);
      for (const f of fixtures) {
        await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${f.idContrato};`);
        await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${f.idContratante};`);
      }
    }
    // fat_contrato/fat_etapa_contrato já auditados (0012/T2) -- as escritas
    // desta suíte geraram linhas em log_auditoria referenciando os 2
    // usuários de fixture; precisam sair antes do DELETE de dim_usuario (FK),
    // mesmo padrão de fn-substituir-vinculo.integration.test.ts.
    const idsUsuario = await runSql<{ id_usuario: number }>(
      `SELECT id_usuario FROM dim_usuario WHERE email IN ('${GESTORA_EMAIL}', '${MENTOR_EMAIL}');`
    );
    const idList = idsUsuario.map((r) => r.id_usuario).join(",");
    if (idList) {
      await runSql(`DELETE FROM log_auditoria WHERE id_usuario IN (${idList}) OR id_usuario_impersonado IN (${idList});`);
    }
    await runSql(`DELETE FROM dim_usuario WHERE email IN ('${GESTORA_EMAIL}', '${MENTOR_EMAIL}');`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 120000);

  it("app.mover_etapa_kanban is SECURITY INVOKER (prosecdef = false)", async () => {
    const rows = await runSql<{ prosecdef: boolean }>(`
      SELECT prosecdef FROM pg_proc
       WHERE pronamespace = 'app'::regnamespace AND proname = 'mover_etapa_kanban';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].prosecdef).toBe(false);
  });

  it("KAN-04/05: avanço da etapa 1 (id_etapa_atual IS NULL) para a etapa 2", async () => {
    const f = await makeFixture("Avanço encadeado");
    fixtures.push(f);
    fAvancoEncadeado = f;
    const hoje = new Date().toISOString().slice(0, 10);

    const { error } = await gestoraClient
      .schema("app")
      .rpc("mover_etapa_kanban", { p_id_contrato: f.idContrato, p_id_etapa_destino: idEtapa2 });
    expect(error).toBeNull();

    const etapa1 = await leEtapa(f.idContrato, idEtapa1);
    expect(etapa1.status).toBe("concluida");
    expect(etapa1.dt_conclusao).toBe(hoje);

    const etapa2 = await leEtapa(f.idContrato, idEtapa2);
    expect(etapa2.status).toBe("em_andamento");
    expect(etapa2.dt_inicio).toBe(hoje);

    expect(await leEtapaAtual(f.idContrato)).toBe(idEtapa2);
  });

  it("KAN-04/05: avanço encadeado da etapa 2 para a etapa 3, a partir de id_etapa_atual não-nulo", async () => {
    const f = fAvancoEncadeado; // continua o contrato do teste anterior, já em etapa 2
    const hoje = new Date().toISOString().slice(0, 10);

    const { error } = await gestoraClient
      .schema("app")
      .rpc("mover_etapa_kanban", { p_id_contrato: f.idContrato, p_id_etapa_destino: idEtapa3 });
    expect(error).toBeNull();

    const etapa2 = await leEtapa(f.idContrato, idEtapa2);
    expect(etapa2.status).toBe("concluida");
    expect(etapa2.dt_conclusao).toBe(hoje);

    const etapa3 = await leEtapa(f.idContrato, idEtapa3);
    expect(etapa3.status).toBe("em_andamento");
    expect(etapa3.dt_inicio).toBe(hoje);

    expect(await leEtapaAtual(f.idContrato)).toBe(idEtapa3);
  });

  it("KAN-07: avanço não-adjacente (etapa 1 -> etapa 3) rejeitado com KAN01, nenhuma linha alterada", async () => {
    const f = await makeFixture("Salto inválido");
    fixtures.push(f);

    const { error } = await gestoraClient
      .schema("app")
      .rpc("mover_etapa_kanban", { p_id_contrato: f.idContrato, p_id_etapa_destino: idEtapa3 });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("KAN01");

    const etapa1 = await leEtapa(f.idContrato, idEtapa1);
    expect(etapa1.status).toBe("nao_iniciada");
    const etapa3 = await leEtapa(f.idContrato, idEtapa3);
    expect(etapa3.status).toBe("nao_iniciada");
    expect(await leEtapaAtual(f.idContrato)).toBeNull();
  });

  it("KAN-09: retrocesso (etapa 2 -> etapa 1) por Gestora reabre a etapa 1 e zera a etapa 2", async () => {
    const f = await makeFixture("Retrocesso Gestora");
    fixtures.push(f);
    fRetrocessoGestora = f;

    const { error: erroAvanco } = await gestoraClient
      .schema("app")
      .rpc("mover_etapa_kanban", { p_id_contrato: f.idContrato, p_id_etapa_destino: idEtapa2 });
    expect(erroAvanco).toBeNull();

    const { error } = await gestoraClient
      .schema("app")
      .rpc("mover_etapa_kanban", { p_id_contrato: f.idContrato, p_id_etapa_destino: idEtapa1 });
    expect(error).toBeNull();

    const etapa1 = await leEtapa(f.idContrato, idEtapa1);
    expect(etapa1.status).toBe("em_andamento");
    expect(etapa1.dt_conclusao).toBeNull();

    const etapa2 = await leEtapa(f.idContrato, idEtapa2);
    expect(etapa2.status).toBe("nao_iniciada");
    expect(etapa2.dt_inicio).toBeNull();
    expect(etapa2.dt_conclusao).toBeNull();

    expect(await leEtapaAtual(f.idContrato)).toBe(idEtapa1);
  });

  it("KAN-08/09: Mentor com vínculo ativo consegue avançar (etapa 1 -> etapa 2), provando que T1 desbloqueou a GRANT", async () => {
    const f = await makeFixture("Mentor Avanço");
    fixtures.push(f);
    fMentorAvanco = f;
    await vincula(f.idContrato, "mentor");

    const { error } = await mentorClient
      .schema("app")
      .rpc("mover_etapa_kanban", { p_id_contrato: f.idContrato, p_id_etapa_destino: idEtapa2 });
    expect(error).toBeNull();

    const etapa2 = await leEtapa(f.idContrato, idEtapa2);
    expect(etapa2.status).toBe("em_andamento");
    expect(await leEtapaAtual(f.idContrato)).toBe(idEtapa2);
  });

  it("KAN-09: Mentor com vínculo tenta retrocesso (etapa 2 -> etapa 1) e é rejeitado com 42501, nenhuma linha alterada", async () => {
    const f = fMentorAvanco; // contrato "Mentor Avanço", já em etapa 2

    const { error } = await mentorClient
      .schema("app")
      .rpc("mover_etapa_kanban", { p_id_contrato: f.idContrato, p_id_etapa_destino: idEtapa1 });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");

    const etapa1 = await leEtapa(f.idContrato, idEtapa1);
    expect(etapa1.status).toBe("concluida"); // inalterado desde o avanço anterior
    const etapa2 = await leEtapa(f.idContrato, idEtapa2);
    expect(etapa2.status).toBe("em_andamento"); // inalterado
    expect(await leEtapaAtual(f.idContrato)).toBe(idEtapa2);
  });

  it("KAN-08: avanço tentado num contrato sem vínculo do usuário é rejeitado, sem revelar existência", async () => {
    const f = await makeFixture("Sem vínculo do Mentor");
    fixtures.push(f);
    // Sem INSERT em rel_usuario_contrato: mentor não tem vínculo com este contrato.

    const { error } = await mentorClient
      .schema("app")
      .rpc("mover_etapa_kanban", { p_id_contrato: f.idContrato, p_id_etapa_destino: idEtapa2 });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");

    const etapa1 = await leEtapa(f.idContrato, idEtapa1);
    expect(etapa1.status).toBe("nao_iniciada");
  });

  it("KAN-06: avanço e retrocesso bem-sucedidos geram linhas em log_auditoria via trigger (T2), sem INSERT explícito", async () => {
    const rowsAvanco = await runSql<{ acao: string }>(`
      SELECT ec.id_etapa_contrato, l.acao
        FROM fat_etapa_contrato ec
        JOIN log_auditoria l ON l.tabela = 'fat_etapa_contrato' AND l.id_registro_alvo = ec.id_etapa_contrato
       WHERE ec.id_contrato = ${fAvancoEncadeado.idContrato} AND l.acao = 'update';
    `);
    expect(rowsAvanco.length).toBeGreaterThan(0);

    const rowsRetrocesso = await runSql<{ acao: string }>(`
      SELECT ec.id_etapa_contrato, l.acao
        FROM fat_etapa_contrato ec
        JOIN log_auditoria l ON l.tabela = 'fat_etapa_contrato' AND l.id_registro_alvo = ec.id_etapa_contrato
       WHERE ec.id_contrato = ${fRetrocessoGestora.idContrato} AND l.acao = 'update';
    `);
    expect(rowsRetrocesso.length).toBeGreaterThan(0);
  });
});
