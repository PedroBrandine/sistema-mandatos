import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: formularios-produto T11 Done-when (.specs/features/formularios-produto/tasks.md),
// migrations 20260815131900_formularios_produto_nps_estrutura.sql (T10) /
// 20260815132800_formularios_produto_nps_refresh.sql (T11) -- merge-forward: só agora
// MV+grants+refresh da Fase 3 existem juntos para testar de ponta a ponta (nota "Test
// Co-location Validation" de tasks.md).
//
// spec.md P3 AC1/AC2/AC3, FRM-20/FRM-21/FRM-23.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "FRM-T11-nps-P4ssword!";

const GESTORA_EMAIL = "frm-t11-gestora@legislabrasil.test";
const MENTOR_EMAIL = "frm-t11-mentor@legislabrasil.test";
const ASSESSOR_EMAIL = "frm-t11-assessor@legislabrasil.test";
const RESPONDENTE_EXTRA_EMAIL = "frm-t11-respondente-extra@legislabrasil.test";

// id_projeto real (ref_projeto), não NULL/0 -- evita que este fixture agregue
// junto com qualquer outra submissão de avaliacao_imersao que já exista no
// banco de dev com id_projeto NULL (mv_avaliacao_nps agrega por
// formulário × projeto, não por contrato -- COALESCE(id_projeto, 0) é o
// bucket "sem projeto" compartilhado por todo mundo que não seta a coluna,
// inclusive o fixture de T4). Confirmado por introspecção antes de escrever
// este teste: 0 linhas de fat_resposta_metrica para (id_metrica=5,
// id_projeto=24) no início da sessão.
const ID_PROJETO_FIXTURE = 24; // "Imagina 1"

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
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'FRM T11 ${label}')
    RETURNING id_contratante;
  `);
  const [{ id_contrato: idContrato }] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, id_projeto, dt_inicio, status)
    VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), ${ID_PROJETO_FIXTURE}, CURRENT_DATE, 'ativo')
    RETURNING id_contrato;
  `);
  return { idContratante, idContrato };
}

let fixture: Fixture;
let idFormAvaliacaoImersao: number;
let versaoAvaliacaoImersao: number;
let idMetricaNps: number;
let idUsuarioMentor: number;
let idUsuarioAssessor: number;
let idUsuarioRespondenteExtra: number;
let gestoraClient: SupabaseClient;
let mentorClient: SupabaseClient;
let assessorClient: SupabaseClient;

describe("formularios-produto T11 -- mv_avaliacao_nps / app.atualiza_avaliacao_nps()", () => {
  beforeAll(async () => {
    const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of existing?.users ?? []) {
      if (user.email && [GESTORA_EMAIL, MENTOR_EMAIL, ASSESSOR_EMAIL].includes(user.email)) {
        await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      }
    }
    for (const email of [GESTORA_EMAIL, MENTOR_EMAIL, ASSESSOR_EMAIL]) {
      const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
      if (error) throw error;
      authUserIds.push(data.user.id);
    }
    await runSql(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo) VALUES
        ('${GESTORA_EMAIL}', 'FRM T11 Gestora', 'gestora', true),
        ('${MENTOR_EMAIL}', 'FRM T11 Mentor', 'mentor', true),
        ('${ASSESSOR_EMAIL}', 'FRM T11 Assessor', 'assessor', true),
        ('${RESPONDENTE_EXTRA_EMAIL}', 'FRM T11 Respondente Extra', 'assessor', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);

    fixture = await makeFixture("NPS");

    const [formAv] = await runSql<{ id_formulario: number; versao: number }>(
      `SELECT id_formulario, versao FROM ref_formulario WHERE codigo = 'avaliacao_imersao';`
    );
    idFormAvaliacaoImersao = formAv.id_formulario;
    versaoAvaliacaoImersao = formAv.versao;

    const [metrica] = await runSql<{ id_metrica: number }>(
      `SELECT id_metrica FROM ref_metrica_formulario WHERE id_formulario = ${idFormAvaliacaoImersao} AND codigo_campo = 'nps_recomendacao';`
    );
    idMetricaNps = metrica.id_metrica;

    idUsuarioMentor = (
      await runSql<{ id_usuario: number }>(`SELECT id_usuario FROM dim_usuario WHERE email = '${MENTOR_EMAIL}';`)
    )[0].id_usuario;
    idUsuarioAssessor = (
      await runSql<{ id_usuario: number }>(`SELECT id_usuario FROM dim_usuario WHERE email = '${ASSESSOR_EMAIL}';`)
    )[0].id_usuario;
    idUsuarioRespondenteExtra = (
      await runSql<{ id_usuario: number }>(`SELECT id_usuario FROM dim_usuario WHERE email = '${RESPONDENTE_EXTRA_EMAIL}';`)
    )[0].id_usuario;

    // 3 submissões conhecidas de NPS (trigger app.trg_extrai_metricas(), já
    // testado em T4, popula fat_resposta_metrica automaticamente) --
    // 2 promotores (9, 9) + 1 detrator (4), 0 neutros. Escrita direta via
    // runSql (bypassa RLS -- RLS de fat_submissao já é escopo de T4, não
    // desta task): nr_respostas=3, promotores=2, neutros=0, detratores=1,
    // nps = (2-1)*100.0/3 = 33.33.
    await runSql(`
      INSERT INTO fat_submissao (id_contrato, id_formulario, versao_formulario, id_usuario_respondente, respostas) VALUES
        (${fixture.idContrato}, ${idFormAvaliacaoImersao}, ${versaoAvaliacaoImersao}, ${idUsuarioMentor}, '{"nps_recomendacao": 9}'::jsonb),
        (${fixture.idContrato}, ${idFormAvaliacaoImersao}, ${versaoAvaliacaoImersao}, ${idUsuarioAssessor}, '{"nps_recomendacao": 9}'::jsonb),
        (${fixture.idContrato}, ${idFormAvaliacaoImersao}, ${versaoAvaliacaoImersao}, ${idUsuarioRespondenteExtra}, '{"nps_recomendacao": 4}'::jsonb);
    `);

    gestoraClient = await signInAs(GESTORA_EMAIL);
    mentorClient = await signInAs(MENTOR_EMAIL);
    assessorClient = await signInAs(ASSESSOR_EMAIL);
  }, 120000);

  afterAll(async () => {
    await runSql(`DELETE FROM fat_submissao WHERE id_contrato = ${fixture.idContrato};`);
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato = ${fixture.idContrato};
      DELETE FROM rel_formulario_contrato WHERE id_contrato = ${fixture.idContrato};
      DELETE FROM dim_planejamento WHERE id_contrato = ${fixture.idContrato};
    `);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${fixture.idContrato};`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${fixture.idContratante};`);
    await runSql(`
      DELETE FROM log_auditoria WHERE id_usuario IN (
        SELECT id_usuario FROM dim_usuario WHERE email IN ('${GESTORA_EMAIL}', '${MENTOR_EMAIL}', '${ASSESSOR_EMAIL}', '${RESPONDENTE_EXTRA_EMAIL}')
      );
    `);
    await runSql(
      `DELETE FROM dim_usuario WHERE email IN ('${GESTORA_EMAIL}', '${MENTOR_EMAIL}', '${ASSESSOR_EMAIL}', '${RESPONDENTE_EXTRA_EMAIL}');`
    );
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
    // Refresh final para que a MV não fique com a linha deste fixture
    // (id_formulario=avaliacao_imersao, id_projeto=24) presa depois que os
    // dados de origem já foram apagados -- idempotente, não é uma asserção.
    await runSql(`SELECT app.atualiza_avaliacao_nps();`);
  }, 120000);

  it("mv_avaliacao_nps ainda não reflete o fixture antes do refresh (prova que REFRESH é quem populou, não outra coisa)", async () => {
    const rows = await runSql<{ nr_respostas: number }>(`
      SELECT nr_respostas FROM mv_avaliacao_nps
       WHERE id_formulario = ${idFormAvaliacaoImersao} AND id_projeto_grupo = ${ID_PROJETO_FIXTURE} AND id_metrica = ${idMetricaNps};
    `);
    expect(rows).toHaveLength(0);
  });

  it("app.atualiza_avaliacao_nps() chamado por legisla_gestora executa REFRESH CONCURRENTLY sem erro", async () => {
    const { error } = await gestoraClient.schema("app").rpc("atualiza_avaliacao_nps");
    expect(error).toBeNull();
  });

  it("após refresh, mv_avaliacao_nps agrega promotores/neutros/detratores e o score NPS corretos por formulário × projeto (FRM-20)", async () => {
    const rows = await runSql<{
      nr_respostas: number;
      promotores: number;
      neutros: number;
      detratores: number;
      nps: string;
    }>(`
      SELECT nr_respostas, promotores, neutros, detratores, nps FROM mv_avaliacao_nps
       WHERE id_formulario = ${idFormAvaliacaoImersao} AND id_projeto_grupo = ${ID_PROJETO_FIXTURE} AND id_metrica = ${idMetricaNps};
    `);
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row.nr_respostas).toBe(3);
    expect(row.promotores).toBe(2);
    expect(row.neutros).toBe(0);
    expect(row.detratores).toBe(1);
    expect(Number(row.nps)).toBeCloseTo(33.33, 2);
  });

  it("Mentor: consegue CHAMAR app.atualiza_avaliacao_nps() (GRANT EXECUTE cobre todos os papéis) mas é negado (42501) lendo mv_avaliacao_nps diretamente (FRM-23)", async () => {
    const rpcResult = await mentorClient.schema("app").rpc("atualiza_avaliacao_nps");
    expect(rpcResult.error).toBeNull();

    const readResult = await mentorClient.from("mv_avaliacao_nps").select("*").limit(1);
    expect(readResult.error).not.toBeNull();
    expect(readResult.error?.code).toBe("42501");
  });

  it("Assessor: consegue CHAMAR app.atualiza_avaliacao_nps() mas é negado (42501) lendo mv_avaliacao_nps diretamente (FRM-23)", async () => {
    const rpcResult = await assessorClient.schema("app").rpc("atualiza_avaliacao_nps");
    expect(rpcResult.error).toBeNull();

    const readResult = await assessorClient.from("mv_avaliacao_nps").select("*").limit(1);
    expect(readResult.error).not.toBeNull();
    expect(readResult.error?.code).toBe("42501");
  });

  it("Gestora: consegue LER mv_avaliacao_nps diretamente (GRANT SELECT concedido, T10)", async () => {
    const { data, error } = await gestoraClient
      .from("mv_avaliacao_nps")
      .select("nr_respostas")
      .eq("id_formulario", idFormAvaliacaoImersao)
      .eq("id_projeto_grupo", ID_PROJETO_FIXTURE)
      .eq("id_metrica", idMetricaNps)
      .single();
    expect(error).toBeNull();
    expect(data?.nr_respostas).toBe(3);
  });
});
