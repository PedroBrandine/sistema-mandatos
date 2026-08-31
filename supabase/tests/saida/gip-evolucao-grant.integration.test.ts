import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: saida-numeros-impacto T4 Done-when (.specs/features/saida-numeros-impacto/tasks.md),
// migration 20260831022825_saida_gip_evolucao_grant.sql --
//  - legisla_gestora consegue `SELECT * FROM vw_gip_evolucao WHERE id_contrato = X` sem
//    erro (REGRESSÃO: antes desta migration, a mesma consulta falhava com 42501 --
//    vw_gip_evolucao existe desde formularios-produto/T9 mas nunca recebeu GRANT
//    nenhum, achado real de Design desta feature -- não reproduzido aqui porque a
//    migration já foi aplicada; ver design.md "Risks & Concerns")
//  - Dado real de GIP com momento='inicio'+'meio' aplicados: gap/situacao calculados
//
// spec.md P3 AC1. Fixture inspirada em
// supabase/tests/operacao/formularios-gip.integration.test.ts (mesmo trigger
// app.trg_deriva_gip populando fat_gip/fat_gip_dimensao a partir de
// fat_submissao).

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "SAI-T4-gip-evolucao-P4ssword!";
const GESTORA_EMAIL = "sai-t4-gestora@legislabrasil.test";

const admin = createClient(URL, SERVICE_ROLE_KEY);
const authUserIds: string[] = [];

async function signInAsGestora(): Promise<SupabaseClient> {
  const client = createClient(URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email: GESTORA_EMAIL, password: PASSWORD });
  if (error) throw error;
  return client;
}

let idContrato: number;
let idContratante: number;
let idFormularioGip: number;
let versaoGip: number;
let idUsuarioGestora: number;
let idsDimensao: { codigo: string; id_dimensao: number }[];

function respostasGip(dimensoesValores: Record<string, number>): Record<string, unknown> {
  return {
    posicao_lideranca: true,
    rotina_trabalho: "Rotina de teste SAI T4",
    comunicacao_interna: "Comunicação de teste SAI T4",
    rotinas_feedback: "Feedback de teste SAI T4",
    gip_estrutura_organizada: true,
    gip_entregas_acontecendo: true,
    dimensoes: dimensoesValores,
  };
}

function todasDimensoes(valor: number): Record<string, number> {
  return Object.fromEntries(idsDimensao.map((d) => [d.codigo, valor]));
}

describe("saida-numeros-impacto T4 -- GRANT SELECT em vw_gip_evolucao", () => {
  beforeAll(async () => {
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
        ('${GESTORA_EMAIL}', 'SAI T4 Gestora', 'gestora', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);

    const [{ id_contratante: idContr }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'SAI T4 GIP Fixture')
      RETURNING id_contratante;
    `);
    idContratante = idContr;
    const [{ id_contrato: idC }] = await runSql<{ id_contrato: number }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
      RETURNING id_contrato;
    `);
    idContrato = idC;

    const [formGip] = await runSql<{ id_formulario: number; versao: number }>(
      `SELECT id_formulario, versao FROM ref_formulario WHERE codigo = 'gip';`
    );
    idFormularioGip = formGip.id_formulario;
    versaoGip = formGip.versao;

    idsDimensao = await runSql<{ codigo: string; id_dimensao: number }>(
      `SELECT codigo, id_dimensao FROM ref_dimensao_gip WHERE ativo ORDER BY ordem;`
    );

    await runSql(`
      UPDATE rel_formulario_contrato SET estado = 'aberto', dt_abertura = now()
       WHERE id_contrato = ${idContrato} AND id_formulario = ${idFormularioGip};
    `);

    idUsuarioGestora = (
      await runSql<{ id_usuario: number }>(`SELECT id_usuario FROM dim_usuario WHERE email = '${GESTORA_EMAIL}';`)
    )[0].id_usuario;

    const client = await signInAsGestora();

    // momento='inicio' (Régua dos Sonhos = 2 em todas as dimensões).
    const { error: erroInicio } = await client.from("fat_submissao").insert({
      id_contrato: idContrato,
      id_formulario: idFormularioGip,
      versao_formulario: versaoGip,
      id_usuario_respondente: idUsuarioGestora,
      momento: "inicio",
      respostas: respostasGip(todasDimensoes(2)),
    });
    if (erroInicio) throw erroInicio;

    // momento='meio' (Onde Chegamos = 3 em todas as dimensões) -- gap = 1,
    // situacao = 'atingiu' (onde_chegamos >= regua_sonhos).
    const { error: erroMeio } = await client.from("fat_submissao").insert({
      id_contrato: idContrato,
      id_formulario: idFormularioGip,
      versao_formulario: versaoGip,
      id_usuario_respondente: idUsuarioGestora,
      momento: "meio",
      respostas: respostasGip(todasDimensoes(3)),
    });
    if (erroMeio) throw erroMeio;
  }, 120000);

  afterAll(async () => {
    await runSql(`DELETE FROM fat_gip_dimensao WHERE id_gip IN (SELECT id_gip FROM fat_gip WHERE id_contrato = ${idContrato});`);
    await runSql(`DELETE FROM fat_gip WHERE id_contrato = ${idContrato};`);
    await runSql(`DELETE FROM fat_submissao WHERE id_contrato = ${idContrato};`);
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};
      DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};
      DELETE FROM dim_planejamento WHERE id_contrato = ${idContrato};
    `);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
    await runSql(`
      DELETE FROM log_auditoria WHERE id_usuario IN (SELECT id_usuario FROM dim_usuario WHERE email = '${GESTORA_EMAIL}');
    `);
    await runSql(`DELETE FROM dim_usuario WHERE email = '${GESTORA_EMAIL}';`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 120000);

  it("legisla_gestora lê vw_gip_evolucao sem erro (regressão: antes do GRANT desta migration, a mesma consulta falhava com 42501)", async () => {
    const client = await signInAsGestora();
    const { data, error } = await client.from("vw_gip_evolucao").select("*").eq("id_contrato", idContrato);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });

  it("vw_gip_evolucao expõe gap/situacao calculados para momento='meio' (regua_sonhos=2, onde_chegamos=3)", async () => {
    const client = await signInAsGestora();
    const { data, error } = await client
      .from("vw_gip_evolucao")
      .select("dimensao, regua_sonhos, onde_chegamos, gap, situacao")
      .eq("id_contrato", idContrato)
      .eq("momento", "meio");

    expect(error).toBeNull();
    expect(data).toHaveLength(idsDimensao.length);
    for (const row of data!) {
      expect(row.regua_sonhos).toBe(2);
      expect(row.onde_chegamos).toBe(3);
      expect(row.gap).toBe(1);
      expect(row.situacao).toBe("atingiu");
    }
  });
});
