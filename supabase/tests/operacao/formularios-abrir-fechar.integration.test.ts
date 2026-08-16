import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: achados do Verifier na Validação Final de formularios-produto
// (.specs/features/formularios-produto/validation.md, Fix 1/2/3) --
// spec.md FRM-01/FRM-02/FRM-03 (abrir/fechar, sem teste automatizado antes
// desta task), FRM-11 (RLS nunca impedia reenvio de formulário fechado,
// só a UI), FRM-13 (metade "impedir abrir formulário novo" nunca
// implementada). Migrations:
// 20260816003235_formularios_produto_rls_edicao_fechada.sql /
// 20260816003324_formularios_produto_rls_contrato_encerrado.sql.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "FRM-fix-abrir-fechar-P4ssword!";

const GESTORA_EMAIL = "frm-fix-gestora@legislabrasil.test";
const MENTOR_EMAIL = "frm-fix-mentor@legislabrasil.test";

const admin = createClient(URL, SERVICE_ROLE_KEY);
const authUserIds: string[] = [];

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

let idContratanteAtivo: number;
let idContratoAtivo: number;
let idContratanteEncerrado: number;
let idContratoEncerrado: number;
let idFormAvaliacaoImersao: number; // real, permite_edicao_aberta=true (default do catálogo)
let idEtapaFixture: number;
let idFormFechadoFixture: number; // fixture próprio, permite_edicao_aberta=false
let versaoFormFechado: number;
let idUsuarioGestora: number;
let idUsuarioMentor: number;

describe("formularios-produto -- fix Verifier: abrir/fechar RLS+GRANT, RLS de edição fechada, contrato encerrado", () => {
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
        ('${GESTORA_EMAIL}', 'FRM Fix Gestora', 'gestora', true),
        ('${MENTOR_EMAIL}', 'FRM Fix Mentor', 'mentor', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);
    idUsuarioGestora = (
      await runSql<{ id_usuario: number }>(`SELECT id_usuario FROM dim_usuario WHERE email = '${GESTORA_EMAIL}';`)
    )[0].id_usuario;
    idUsuarioMentor = (
      await runSql<{ id_usuario: number }>(`SELECT id_usuario FROM dim_usuario WHERE email = '${MENTOR_EMAIL}';`)
    )[0].id_usuario;

    const [{ id_contratante: idContrAtivo }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'FRM Fix Ativo')
      RETURNING id_contratante;
    `);
    idContratanteAtivo = idContrAtivo;
    const [{ id_contrato: idContrato1 }] = await runSql<{ id_contrato: number }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      VALUES (${idContratanteAtivo}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
      RETURNING id_contrato;
    `);
    idContratoAtivo = idContrato1;

    const [{ id_contratante: idContrEncerrado }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'FRM Fix Encerrado')
      RETURNING id_contratante;
    `);
    idContratanteEncerrado = idContrEncerrado;
    const [{ id_contrato: idContrato2 }] = await runSql<{ id_contrato: number }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      VALUES (${idContratanteEncerrado}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'concluido')
      RETURNING id_contrato;
    `);
    idContratoEncerrado = idContrato2;

    await runSql(`
      INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
      SELECT ${idContratoAtivo}, id_usuario, 'mentor' FROM dim_usuario WHERE email = '${MENTOR_EMAIL}'
      ON CONFLICT (id_contrato, id_usuario, papel_no_contrato) DO NOTHING;
    `);

    const [formAv] = await runSql<{ id_formulario: number }>(
      `SELECT id_formulario FROM ref_formulario WHERE codigo = 'avaliacao_imersao';`
    );
    idFormAvaliacaoImersao = formAv.id_formulario;

    // Fixture próprio (nenhum dos 16 formulários reais tem
    // permite_edicao_aberta=false hoje -- conteúdo real é débito conhecido,
    // spec.md Out of Scope). Mesmo padrão de fixture isolado de
    // catalogos-referencia (prefixo próprio, limpo no afterAll).
    const [{ id_etapa, id_formulario, versao }] = await runSql<{
      id_etapa: number;
      id_formulario: number;
      versao: number;
    }>(`
      WITH e AS (
        INSERT INTO ref_etapa (id_produto, codigo, nome, ordem)
        SELECT id_produto, 'fixture_frm_fix_etapa', 'Fixture FRM Fix -- etapa', 31000
          FROM ref_produto WHERE nome = 'Estratégia'
        RETURNING id_etapa, id_produto
      ), f AS (
        INSERT INTO ref_formulario (id_etapa, codigo, nome, permite_edicao_aberta)
        SELECT id_etapa, 'fixture_frm_fix_formulario', 'Fixture FRM Fix -- fechado', false FROM e
        RETURNING id_formulario, id_etapa, versao
      )
      SELECT e.id_etapa, f.id_formulario, f.versao FROM e, f;
    `);
    idEtapaFixture = id_etapa;
    idFormFechadoFixture = id_formulario;
    versaoFormFechado = versao;

    await runSql(`
      INSERT INTO rel_formulario_contrato (id_contrato, id_formulario, estado, dt_abertura)
      VALUES (${idContratoAtivo}, ${idFormFechadoFixture}, 'aberto', now())
      ON CONFLICT (id_contrato, id_formulario) DO UPDATE SET estado = 'aberto', dt_abertura = now();
    `);
  }, 120000);

  afterAll(async () => {
    await runSql(`DELETE FROM fat_submissao WHERE id_contrato IN (${idContratoAtivo}, ${idContratoEncerrado});`);
    await runSql(`
      DELETE FROM rel_formulario_contrato WHERE id_contrato IN (${idContratoAtivo}, ${idContratoEncerrado});
    `);
    await runSql(`DELETE FROM ref_formulario WHERE id_formulario = ${idFormFechadoFixture};`);
    await runSql(`DELETE FROM ref_etapa WHERE id_etapa = ${idEtapaFixture};`);
    await runSql(`
      DELETE FROM rel_usuario_contrato WHERE id_contrato IN (${idContratoAtivo}, ${idContratoEncerrado});
      DELETE FROM fat_etapa_contrato WHERE id_contrato IN (${idContratoAtivo}, ${idContratoEncerrado});
      DELETE FROM dim_planejamento WHERE id_contrato IN (${idContratoAtivo}, ${idContratoEncerrado});
    `);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato IN (${idContratoAtivo}, ${idContratoEncerrado});`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante IN (${idContratanteAtivo}, ${idContratanteEncerrado});`);
    await runSql(`
      DELETE FROM log_auditoria WHERE id_usuario IN (
        SELECT id_usuario FROM dim_usuario WHERE email IN ('${GESTORA_EMAIL}', '${MENTOR_EMAIL}')
      );
    `);
    await runSql(`DELETE FROM dim_usuario WHERE email IN ('${GESTORA_EMAIL}', '${MENTOR_EMAIL}');`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 120000);

  // Fix 1 -- FRM-01/FRM-02/FRM-03: abrir/fechar rel_formulario_contrato nunca
  // tinha teste de integração (comportamento real, não só verificado por
  // has_table_privilege manual).
  it("Gestora abre e fecha um formulário do contrato (FRM-01/FRM-02)", async () => {
    const client = await signInAs(GESTORA_EMAIL);

    const { error: erroAbrir } = await client
      .from("rel_formulario_contrato")
      .update({ estado: "aberto", dt_abertura: new Date().toISOString(), id_usuario_abriu: idUsuarioGestora })
      .eq("id_contrato", idContratoAtivo)
      .eq("id_formulario", idFormAvaliacaoImersao);
    expect(erroAbrir).toBeNull();

    const [aberto] = await runSql<{ estado: string }>(
      `SELECT estado FROM rel_formulario_contrato WHERE id_contrato = ${idContratoAtivo} AND id_formulario = ${idFormAvaliacaoImersao};`
    );
    expect(aberto.estado).toBe("aberto");

    const { error: erroFechar } = await client
      .from("rel_formulario_contrato")
      .update({ estado: "fechado", dt_fechamento: new Date().toISOString() })
      .eq("id_contrato", idContratoAtivo)
      .eq("id_formulario", idFormAvaliacaoImersao);
    expect(erroFechar).toBeNull();

    const [fechado] = await runSql<{ estado: string }>(
      `SELECT estado FROM rel_formulario_contrato WHERE id_contrato = ${idContratoAtivo} AND id_formulario = ${idFormAvaliacaoImersao};`
    );
    expect(fechado.estado).toBe("fechado");
  });

  it("Mentor tenta abrir um formulário e é negado (FRM-03, sem GRANT)", async () => {
    const client = await signInAs(MENTOR_EMAIL);
    const { error } = await client
      .from("rel_formulario_contrato")
      .update({ estado: "aberto", dt_abertura: new Date().toISOString() })
      .eq("id_contrato", idContratoAtivo)
      .eq("id_formulario", idFormAvaliacaoImersao);
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  // Fix 3 -- FRM-13: contrato encerrado bloqueia abrir formulário novo (não
  // só nova submissão, já coberto em T4). Bloqueia até Gestora/Admin de
  // propósito -- não existe engajamento em andamento pra coletar respostas
  // num contrato já encerrado (ver comentário da migration).
  it("Gestora tenta abrir formulário em contrato encerrado e é negada (FRM-13)", async () => {
    await runSql(`
      INSERT INTO rel_formulario_contrato (id_contrato, id_formulario, estado)
      VALUES (${idContratoEncerrado}, ${idFormAvaliacaoImersao}, 'fechado')
      ON CONFLICT (id_contrato, id_formulario) DO UPDATE SET estado = 'fechado', dt_abertura = NULL;
    `);
    const client = await signInAs(GESTORA_EMAIL);
    const { error } = await client
      .from("rel_formulario_contrato")
      .update({ estado: "aberto", dt_abertura: new Date().toISOString() })
      .eq("id_contrato", idContratoEncerrado)
      .eq("id_formulario", idFormAvaliacaoImersao);
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");

    const [linha] = await runSql<{ estado: string }>(
      `SELECT estado FROM rel_formulario_contrato WHERE id_contrato = ${idContratoEncerrado} AND id_formulario = ${idFormAvaliacaoImersao};`
    );
    expect(linha.estado).toBe("fechado");
  });

  // Fix 2 -- FRM-11: permite_edicao_aberta=false já respondido bloqueia
  // reenvio do respondente comum na RLS, não só no botão desabilitado da UI.
  it("Mentor tenta reenviar um formulário fechado à edição (permite_edicao_aberta=false) e é negado pela RLS (FRM-11)", async () => {
    const client = await signInAs(MENTOR_EMAIL);

    const { data: submissao, error: erroInsert } = await client
      .from("fat_submissao")
      .insert({
        id_contrato: idContratoAtivo,
        id_formulario: idFormFechadoFixture,
        versao_formulario: versaoFormFechado,
        id_usuario_respondente: idUsuarioMentor,
        respostas: { qualquer: "valor" },
      })
      .select("id_submissao")
      .single();
    expect(erroInsert).toBeNull();
    expect(submissao?.id_submissao).toBeGreaterThan(0);

    // Fix 4 -- FRM-22: fat_submissao entra na auditoria padrão
    // (trg_audit_fat_submissao, app.trg_auditoria) -- a mesma escrita acima
    // já deve ter gerado 1 linha em log_auditoria.
    const [auditoria] = await runSql<{ acao: string }>(`
      SELECT acao FROM log_auditoria
       WHERE tabela = 'fat_submissao' AND id_registro_alvo = ${submissao!.id_submissao} AND acao = 'insert';
    `);
    expect(auditoria).toBeDefined();
    expect(auditoria.acao).toBe("insert");

    // Reenvio -- deve ser negado mesmo sendo o próprio autor, mesmo com o
    // formulário ainda 'aberto' (T4 já cobre "formulário fechado"; este é o
    // caso "formulário aberto, mas não permite reeditar depois de enviado").
    const { error: erroUpdate } = await client
      .from("fat_submissao")
      .update({ respostas: { qualquer: "outro valor" } })
      .eq("id_submissao", submissao!.id_submissao);
    expect(erroUpdate).not.toBeNull();
    expect(erroUpdate?.code).toBe("42501");

    const [linha] = await runSql<{ respostas: { qualquer: string } }>(
      `SELECT respostas FROM fat_submissao WHERE id_submissao = ${submissao!.id_submissao};`
    );
    expect(linha.respostas.qualquer).toBe("valor");

    // Gestora/Admin continuam podendo reabrir (bypass já testado em T4 com
    // outro formulário -- aqui só confirma que o bypass também vale quando
    // permite_edicao_aberta=false).
    const gestora = await signInAs(GESTORA_EMAIL);
    const { error: erroGestora } = await gestora
      .from("fat_submissao")
      .update({ respostas: { qualquer: "reaberto pela gestora" } })
      .eq("id_submissao", submissao!.id_submissao);
    expect(erroGestora).toBeNull();
  });
});
