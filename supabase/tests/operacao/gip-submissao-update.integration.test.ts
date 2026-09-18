import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/pente-fino-2026-09/tasks.md T5 (PF-01) Done-when --
//  - papel autorizado consegue UPDATE na própria submissão de fat_submissao
//  - uq_gip_contrato_momento (fat_gip) continua bloqueando duplicidade: reaplicar
//    o mesmo momento nunca gera uma 2ª linha em fat_gip
//
// Investigação (T5): NÃO existe gap de RLS a fechar. app.p_por_contrato (fat_submissao,
// 20260814032052_formularios_produto_rls.sql) já vale para ALL commands (sem `FOR`), o
// GRANT já inclui UPDATE pra legisla_gestora/mentor/assessor/admin
// (20260814032214_formularios_produto_grants.sql) e a política RESTRICTIVE
// p_bloqueia_reenvio_fechado (FOR UPDATE, 20260816003945_..._fix.sql) já libera quando
// ref_formulario.permite_edicao_aberta = true -- valor DEFAULT da coluna
// (20260810191659_catalogos_referencia_estrutura.sql:137) nunca sobrescrito pro
// formulário 'gip' no seed. app.trg_deriva_gip (20260814174120_..._gip_trigger.sql)
// já dispara em AFTER INSERT OR UPDATE OF respostas e faz
// `ON CONFLICT (id_contrato, momento) DO UPDATE` em fat_gip, preservando
// uq_gip_contrato_momento intocada. Nenhuma migration nova foi necessária -- este
// teste é a evidência dedicada da feature pente-fino para esse caminho já existente
// (a suíte antiga formularios-gip.integration.test.ts cobre o mesmo caminho, mas está
// hoje quebrada por deriva de dado de seed não relacionada a PF-01: valor_min/valor_max
// de ref_dimensao_gip mudaram desde que aquele teste foi escrito e os valores fixos
// que ele usa (1..4) não são mais válidos pra todas as dimensões -- por isso este teste
// lê valor_min/valor_max de cada dimensão em vez de assumir uma faixa fixa).
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "PF-01-gip-update-P4ssword!";
const GESTORA_EMAIL = "pf01-gestora-gip-update@legislabrasil.test";

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
let dimensoes: { codigo: string; id_dimensao: number; valor_min: number; valor_max: number }[];

function respostas(dimensoesValores: Record<string, number>): Record<string, unknown> {
  return {
    posicao_lideranca: true,
    rotina_trabalho: "Rotina PF-01",
    comunicacao_interna: "Comunicação PF-01",
    rotinas_feedback: "Feedback PF-01",
    gip_estrutura_organizada: true,
    gip_entregas_acontecendo: true,
    dimensoes: dimensoesValores,
  };
}

// Usa valor_min pra "antes" e valor_max pra "depois" (edição de verdade, não
// um no-op) -- lido do banco em vez de fixo, pra não repetir a fragilidade
// que quebrou formularios-gip.integration.test.ts.
function valores(campo: "valor_min" | "valor_max"): Record<string, number> {
  return Object.fromEntries(dimensoes.map((d) => [d.codigo, d[campo]]));
}

describe("PF-01 -- UPDATE em fat_submissao para GIP já aplicado (T5)", () => {
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
        ('${GESTORA_EMAIL}', 'PF-01 Gestora', 'gestora', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);

    const [{ id_contratante: idContr }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'PF-01 GIP Update Fixture')
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

    dimensoes = await runSql<{ codigo: string; id_dimensao: number; valor_min: number; valor_max: number }>(
      `SELECT codigo, id_dimensao, valor_min, valor_max FROM ref_dimensao_gip WHERE ativo ORDER BY ordem;`
    );

    await runSql(`
      UPDATE rel_formulario_contrato SET estado = 'aberto', dt_abertura = now()
       WHERE id_contrato = ${idContrato} AND id_formulario = ${idFormularioGip};
    `);

    idUsuarioGestora = (
      await runSql<{ id_usuario: number }>(`SELECT id_usuario FROM dim_usuario WHERE email = '${GESTORA_EMAIL}';`)
    )[0].id_usuario;
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

  it("papel autorizado (gestora) consegue UPDATE na própria submissão já aplicada", async () => {
    const client = await signInAsGestora();

    const { error: erroInsert } = await client.from("fat_submissao").insert({
      id_contrato: idContrato,
      id_formulario: idFormularioGip,
      versao_formulario: versaoGip,
      id_usuario_respondente: idUsuarioGestora,
      momento: "inicio",
      respostas: respostas(valores("valor_min")),
    });
    expect(erroInsert).toBeNull();

    const [submissao] = await runSql<{ id_submissao: number }>(
      `SELECT id_submissao FROM fat_submissao WHERE id_contrato = ${idContrato} AND momento = 'inicio';`
    );

    const { error: erroUpdate } = await client
      .from("fat_submissao")
      .update({ respostas: respostas(valores("valor_max")) })
      .eq("id_submissao", submissao.id_submissao);
    expect(erroUpdate).toBeNull();

    const [linha] = await runSql<{ respostas: { dimensoes: Record<string, number> } }>(
      `SELECT respostas FROM fat_submissao WHERE id_submissao = ${submissao.id_submissao};`
    );
    expect(linha.respostas.dimensoes).toEqual(valores("valor_max"));
  });

  it("uq_gip_contrato_momento continua bloqueando um 2º INSERT (unicidade intocada)", async () => {
    const client = await signInAsGestora();

    const [{ n: antes }] = await runSql<{ n: string }>(
      `SELECT count(*)::text AS n FROM fat_gip WHERE id_contrato = ${idContrato} AND momento = 'inicio';`
    );
    expect(Number(antes)).toBe(1); // derivado pelo trigger a partir do teste anterior

    const { error: erroSegundoInsert } = await client.from("fat_submissao").insert({
      id_contrato: idContrato,
      id_formulario: idFormularioGip,
      versao_formulario: versaoGip,
      id_usuario_respondente: idUsuarioGestora,
      momento: "inicio",
      respostas: respostas(valores("valor_min")),
    });
    expect(erroSegundoInsert).not.toBeNull();
    expect(erroSegundoInsert?.code).toBe("23505");

    const [{ n: depois }] = await runSql<{ n: string }>(
      `SELECT count(*)::text AS n FROM fat_gip WHERE id_contrato = ${idContrato} AND momento = 'inicio';`
    );
    expect(Number(depois)).toBe(1);
  });
});
