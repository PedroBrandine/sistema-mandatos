import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: formularios-produto T9 Done-when (.specs/features/formularios-produto/tasks.md),
// migrations 20260814173302_formularios_produto_gip_estrutura.sql /
// 20260814173746_formularios_produto_gip_rls.sql / 20260814173934_formularios_produto_gip_grants.sql /
// 20260814174120_formularios_produto_gip_trigger.sql / 20260814174709_formularios_produto_gip_view.sql
// -- merge-forward: só agora DDL+RLS+GRANT+trigger+view da Fase 2 existem juntos.
//
// spec.md P2 AC1-AC5, FRM-15/FRM-16/FRM-17/FRM-18/FRM-19.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "FRM-T9-gip-P4ssword!";
const GESTORA_EMAIL = "frm-t9-gestora@legislabrasil.test";

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

// Dimensões seedadas (Trilha C): qualidade_planejamento, atingimento_planejamento,
// capacidade_gestao, autonomia_metodologia -- valor_min/max = 1/4.
function respostasGip(dimensoesValores: Record<string, number>): Record<string, unknown> {
  return {
    posicao_lideranca: true,
    rotina_trabalho: "Rotina de teste T9",
    comunicacao_interna: "Comunicação de teste T9",
    rotinas_feedback: "Feedback de teste T9",
    gip_estrutura_organizada: true,
    gip_entregas_acontecendo: true,
    dimensoes: dimensoesValores,
  };
}

function todasDimensoes(valor: number): Record<string, number> {
  return Object.fromEntries(idsDimensao.map((d) => [d.codigo, valor]));
}

describe("formularios-produto T9 -- derivação do GIP (fat_gip/fat_gip_dimensao) + vw_gip_evolucao", () => {
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
        ('${GESTORA_EMAIL}', 'FRM T9 Gestora', 'gestora', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);

    const [{ id_contratante: idContr }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'FRM T9 GIP Fixture')
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

  it("GIP momento='inicio' grava fat_gip + 4 linhas fat_gip_dimensao (eixo='regua_sonhos')", async () => {
    const client = await signInAsGestora();
    const { error } = await client.from("fat_submissao").insert({
      id_contrato: idContrato,
      id_formulario: idFormularioGip,
      versao_formulario: versaoGip,
      id_usuario_respondente: idUsuarioGestora,
      momento: "inicio",
      respostas: respostasGip(todasDimensoes(2)),
    });
    expect(error).toBeNull();

    const [gip] = await runSql<{ id_gip: number; momento: string; quadrante: string }>(
      `SELECT id_gip, momento, quadrante FROM fat_gip WHERE id_contrato = ${idContrato} AND momento = 'inicio';`
    );
    expect(gip).toBeDefined();
    expect(gip.quadrante).toBe("Q1 - Estrutura e entrega");

    const dims = await runSql<{ eixo: string; valor: number }>(
      `SELECT eixo, valor FROM fat_gip_dimensao WHERE id_gip = ${gip.id_gip};`
    );
    expect(dims).toHaveLength(4);
    for (const d of dims) {
      expect(d.eixo).toBe("regua_sonhos");
      expect(d.valor).toBe(2);
    }
  });

  it("GIP momento='meio' grava fat_gip_dimensao (eixo='onde_chegamos') + copia regua_sonhos do início na mesma linha", async () => {
    const client = await signInAsGestora();
    const { error } = await client.from("fat_submissao").insert({
      id_contrato: idContrato,
      id_formulario: idFormularioGip,
      versao_formulario: versaoGip,
      id_usuario_respondente: idUsuarioGestora,
      momento: "meio",
      respostas: respostasGip(todasDimensoes(3)),
    });
    expect(error).toBeNull();

    const [gip] = await runSql<{ id_gip: number }>(
      `SELECT id_gip FROM fat_gip WHERE id_contrato = ${idContrato} AND momento = 'meio';`
    );
    const dims = await runSql<{ eixo: string; valor: number }>(
      `SELECT eixo, valor FROM fat_gip_dimensao WHERE id_gip = ${gip.id_gip} ORDER BY eixo;`
    );
    expect(dims).toHaveLength(8); // 4 dimensões x 2 eixos (onde_chegamos novo + regua_sonhos copiado)
    const porEixo = new Map<string, number[]>();
    for (const d of dims) {
      porEixo.set(d.eixo, [...(porEixo.get(d.eixo) ?? []), d.valor]);
    }
    expect(porEixo.get("onde_chegamos")).toEqual([3, 3, 3, 3]);
    expect(porEixo.get("regua_sonhos")).toEqual([2, 2, 2, 2]);
  });

  it("Reaplicar o mesmo momento não cria 2ª linha em fat_gip (ON CONFLICT atualiza a existente)", async () => {
    const client = await signInAsGestora();
    const [{ n: antes }] = await runSql<{ n: string }>(
      `SELECT count(*)::text AS n FROM fat_gip WHERE id_contrato = ${idContrato};`
    );

    // Um 2º INSERT bruto (mesmo contrato+formulário+respondente+momento) viola
    // a chave única de negócio de fat_submissao (uq_submissao_respondente) --
    // o caminho real de reenvio é UPDATE na mesma linha (permite_edicao_aberta),
    // testado logo abaixo.
    const { error: erroDuplicado } = await client.from("fat_submissao").insert({
      id_contrato: idContrato,
      id_formulario: idFormularioGip,
      versao_formulario: versaoGip,
      id_usuario_respondente: idUsuarioGestora,
      momento: "inicio",
      respostas: respostasGip(todasDimensoes(4)),
    });
    expect(erroDuplicado).not.toBeNull();
    expect(erroDuplicado?.code).toBe("23505");

    // Reenvio de verdade é via UPDATE na mesma submissão -- confirma que o
    // trigger, ao reprocessar (AFTER UPDATE OF respostas), não duplica fat_gip.
    const [submissaoInicio] = await runSql<{ id_submissao: number }>(
      `SELECT id_submissao FROM fat_submissao WHERE id_contrato = ${idContrato} AND id_formulario = ${idFormularioGip} AND momento = 'inicio' LIMIT 1;`
    );
    const { error: erroUpdate } = await client
      .from("fat_submissao")
      .update({ respostas: respostasGip(todasDimensoes(4)) })
      .eq("id_submissao", submissaoInicio.id_submissao);
    expect(erroUpdate).toBeNull();

    const [{ n: depois }] = await runSql<{ n: string }>(
      `SELECT count(*)::text AS n FROM fat_gip WHERE id_contrato = ${idContrato};`
    );
    expect(Number(depois)).toBe(Number(antes));

    const dims = await runSql<{ valor: number }>(
      `SELECT valor FROM fat_gip_dimensao WHERE id_gip = (SELECT id_gip FROM fat_gip WHERE id_contrato = ${idContrato} AND momento = 'inicio') AND eixo = 'regua_sonhos';`
    );
    for (const d of dims) expect(d.valor).toBe(4);
  });

  it("Valor de dimensão fora da faixa (1-4) é rejeitado por app.trg_valida_gip_dimensao", async () => {
    const client = await signInAsGestora();
    const { error } = await client.from("fat_submissao").insert({
      id_contrato: idContrato,
      id_formulario: idFormularioGip,
      versao_formulario: versaoGip,
      id_usuario_respondente: idUsuarioGestora,
      momento: "fim",
      respostas: respostasGip({ ...todasDimensoes(2), [idsDimensao[0].codigo]: 9 }),
    });
    expect(error).not.toBeNull();

    const [{ n }] = await runSql<{ n: string }>(
      `SELECT count(*)::text AS n FROM fat_gip WHERE id_contrato = ${idContrato} AND momento = 'fim';`
    );
    expect(Number(n)).toBe(0);
  });

  it("vw_gip_evolucao expõe regua_sonhos/onde_chegamos/gap corretos após inicio+meio aplicados", async () => {
    const rows = await runSql<{
      dimensao: string;
      regua_sonhos: number | null;
      onde_chegamos: number | null;
      gap: number | null;
      situacao: string | null;
    }>(`
      SELECT dimensao, regua_sonhos, onde_chegamos, gap, situacao
        FROM vw_gip_evolucao
       WHERE id_contrato = ${idContrato} AND momento = 'meio'
       ORDER BY ordem;
    `);
    expect(rows).toHaveLength(4);
    for (const r of rows) {
      expect(r.regua_sonhos).toBe(4); // atualizado pelo teste de reaplicação acima
      expect(r.onde_chegamos).toBe(3);
      expect(r.gap).toBe(-1);
      expect(r.situacao).toBe("proximo"); // onde_chegamos (3) >= regua_sonhos-1 (3)
    }
  });
});
