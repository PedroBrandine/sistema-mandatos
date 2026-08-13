import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: incidencia-encontros T14 Done-when
// (.specs/features/incidencia-encontros/tasks.md), migrations
// 20260813191324_incidencia_encontros_seed_catalogos.sql /
// 20260813191715_incidencia_encontros_estrutura.sql /
// 20260813194110_incidencia_encontros_iip.sql --
//  - Fixture com Fato Gerador real (tipologia do seed T1, sem id_indicador):
//    nr_fatos correto e iip_provisorio = NULL (Assumption #1b)
//  - Contrato sem nenhum Fato Gerador: as 2 colunas NULL (Edge Case, nunca 0 linhas)
//  - app.atualiza_iip_contrato() chamado por legisla_mentor sem erro
//
// spec.md P1 "Fato Gerador validado por Tipologia + cálculo do IIP" AC5/AC6/AC9/AC10.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "INC-T14-iip-P4ssword!";
const MENTOR_EMAIL = "inc-t14-mentor@legislabrasil.test";

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
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'INC T14 ${label}')
    RETURNING id_contratante;
  `);
  const [{ id_contrato: idContrato }] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
    VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
    RETURNING id_contrato;
  `);
  return { idContratante, idContrato };
}

let comFatos: Fixture; // 2 Fatos Geradores reais, tipologia do seed T1 (id_indicador NULL)
let semFatos: Fixture; // nenhum Fato Gerador
let idTipologia: number;
let mentorClient: SupabaseClient;

describe("incidencia-encontros T14 -- mv_iip_contrato / app.atualiza_iip_contrato / vw_iip_contrato", () => {
  beforeAll(async () => {
    const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of existing?.users ?? []) {
      if (user.email === MENTOR_EMAIL) {
        await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      }
    }
    const { data, error } = await admin.auth.admin.createUser({ email: MENTOR_EMAIL, password: PASSWORD, email_confirm: true });
    if (error) throw error;
    authUserIds.push(data.user.id);

    await runSql(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo)
      VALUES ('${MENTOR_EMAIL}', 'INC T14 Mentor', 'mentor', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);

    // id_indicador NULL confirmado pela migration de T1 (Assumption #1b -- nenhuma
    // das 51 tipologias seedadas do CSV ganhou peso ainda, CAT-16 sem data).
    const [{ id_tipologia, id_indicador }] = await runSql<{ id_tipologia: number; id_indicador: number | null }>(`
      SELECT id_tipologia, id_indicador FROM ref_tipologia ORDER BY id_tipologia LIMIT 1;
    `);
    expect(id_indicador).toBeNull();
    idTipologia = id_tipologia;

    comFatos = await makeFixture("com fatos");
    semFatos = await makeFixture("sem fatos");

    await runSql(`
      INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, nivel_d1, nivel_d2, dt_ocorrencia) VALUES
        (${comFatos.idContrato}, ${idTipologia}, 'baixo', 'medio', '2026-08-01'),
        (${comFatos.idContrato}, ${idTipologia}, 'alto', NULL, '2026-08-05');
    `);

    mentorClient = await signInAs(MENTOR_EMAIL);
  }, 120000);

  afterAll(async () => {
    for (const f of [comFatos, semFatos]) {
      await runSql(`DELETE FROM fat_fato_gerador WHERE id_contrato = ${f.idContrato};`);
    }
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato IN (${comFatos.idContrato}, ${semFatos.idContrato});
      DELETE FROM rel_formulario_contrato WHERE id_contrato IN (${comFatos.idContrato}, ${semFatos.idContrato});
      DELETE FROM dim_planejamento WHERE id_contrato IN (${comFatos.idContrato}, ${semFatos.idContrato});
    `);
    for (const f of [comFatos, semFatos]) {
      await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${f.idContrato};`);
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${f.idContratante};`);
    }
    // REFRESH MATERIALIZED VIEW CONCURRENTLY exige remover as linhas dos
    // Fatos Geradores fixture ANTES do próximo refresh (feito acima); os
    // testes abaixo já chamam o refresh via legisla_mentor, então mv_iip_contrato
    // fica limpa por conta própria depois deste afterAll (nenhuma ação extra).
    await runSql(`DELETE FROM dim_usuario WHERE email = '${MENTOR_EMAIL}';`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 120000);

  it("app.atualiza_iip_contrato() chamado por legisla_mentor não dá erro (SECURITY DEFINER, AD-035)", async () => {
    const { error } = await mentorClient.schema("app").rpc("atualiza_iip_contrato");
    expect(error).toBeNull();
  });

  it("contrato com Fatos Geradores reais (tipologia sem id_indicador): nr_fatos correto, iip_provisorio NULL", async () => {
    const [row] = await runSql<{ nr_fatos: number; iip_provisorio: string | null }>(`
      SELECT nr_fatos, iip_provisorio FROM mv_iip_contrato WHERE id_contrato = ${comFatos.idContrato};
    `);
    expect(row.nr_fatos).toBe(2);
    expect(row.iip_provisorio).toBeNull();

    const [viewRow] = await runSql<{ nr_fatos: number; iip_provisorio: string | null }>(`
      SELECT nr_fatos, iip_provisorio FROM vw_iip_contrato WHERE id_contrato = ${comFatos.idContrato};
    `);
    expect(viewRow.nr_fatos).toBe(2);
    expect(viewRow.iip_provisorio).toBeNull();
  });

  it("contrato sem nenhum Fato Gerador: vw_iip_contrato retorna 1 linha com nr_fatos e iip_provisorio NULL (nunca 0 linhas)", async () => {
    const semLinhaNaMv = await runSql<{ count: number }>(
      `SELECT count(*)::int AS count FROM mv_iip_contrato WHERE id_contrato = ${semFatos.idContrato};`
    );
    expect(semLinhaNaMv[0].count).toBe(0);

    const rows = await runSql<{ id_contrato: number; nr_fatos: number | null; iip_provisorio: string | null }>(`
      SELECT id_contrato, nr_fatos, iip_provisorio FROM vw_iip_contrato WHERE id_contrato = ${semFatos.idContrato};
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].nr_fatos).toBeNull();
    expect(rows[0].iip_provisorio).toBeNull();
  });
});
