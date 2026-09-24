import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: exclusão definitiva de mandato pela aba Mandatos do produto
// (pedido de Pedro, 2026-09-21), migration
// 20260921224737_fundacao_fn_excluir_contrato.sql --
//  - só admin/gestora exclui; mentor recebe 42501 e nada é apagado
//  - apaga o contrato e TODOS os dependentes (inclusive 2º nível) numa
//    transação, e o cadastro da pessoa (contratante+mandato) quando ela fica
//    órfã
//  - preserva o cadastro quando a pessoa tem outro contrato ou prospecção
//    aberta; quebra o elo de renovação sem apagar o contrato posterior
//  - a mesma resposta de app.resumo_exclusao_contrato descreve o que saiu

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "Excluir-contrato-P4ssword!";
const GESTORA_EMAIL = "excluir-contrato-gestora@legislabrasil.test";
const MENTOR_EMAIL = "excluir-contrato-mentor@legislabrasil.test";

const admin = createClient(URL, SERVICE_ROLE_KEY);
const authUserIds: string[] = [];
let gestora: SupabaseClient;
let mentor: SupabaseClient;

const contratantesCriados: number[] = [];

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
  // dim_usuario NÃO é apagado nem entre execuções: log_auditoria referencia
  // quem fez cada escrita (FK), então o usuário de uma execução anterior não
  // pode sair. Reaproveita a linha e só reafirma papel e ativo.
  await runSql(`
    INSERT INTO dim_usuario (email, nome, papel_global, ativo) VALUES ('${email}', '${nome}', '${papel}', true)
    ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
  `);
}

interface Mandato {
  idContratante: number;
  idMandato: number;
  idContrato: number;
}

async function criarMandato(nome: string): Promise<Mandato> {
  const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', '${nome}') RETURNING id_contratante;
  `);
  contratantesCriados.push(idContratante);
  const [{ id_mandato: idMandato }] = await runSql<{ id_mandato: number }>(`
    INSERT INTO dim_mandato (id_contratante) VALUES (${idContratante}) RETURNING id_mandato;
  `);
  const idContrato = await criarContrato(idContratante);
  return { idContratante, idMandato, idContrato };
}

async function criarContrato(idContratante: number, idAnterior?: number): Promise<number> {
  const [{ id_contrato: id }] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status, id_contrato_anterior)
    VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'),
            CURRENT_DATE, 'ativo', ${idAnterior ?? "NULL"})
    RETURNING id_contrato;
  `);
  return id;
}

// Enche o contrato com dados de TODOS os tipos que dependem dele, inclusive os
// de 2º nível, para a exclusão ter o que apagar em cada tabela.
async function popular(idContrato: number): Promise<void> {
  await runSql(`
    WITH usr AS (SELECT id_usuario FROM dim_usuario ORDER BY id_usuario LIMIT 1),
         tip AS (SELECT id_tipo_registro FROM ref_tipo_registro ORDER BY id_tipo_registro LIMIT 1),
         tpl AS (SELECT id_tipologia FROM ref_tipologia ORDER BY id_tipologia LIMIT 1),
         enc AS (
           INSERT INTO fat_encontro (id_contrato, titulo, status, dt_prevista_inicio)
           VALUES (${idContrato}, 'EXC encontro', 'planejado', now()) RETURNING id_encontro),
         reg AS (
           INSERT INTO fat_registro (id_contrato, id_tipo_registro, ocorrido_em, resumo, id_usuario_autor, id_encontro)
           SELECT ${idContrato}, tip.id_tipo_registro, now(), 'EXC registro', usr.id_usuario, enc.id_encontro
             FROM usr, tip, enc RETURNING id_registro),
         ins AS (
           INSERT INTO fat_insight (id_contrato, conteudo, id_usuario_autor, id_registro)
           SELECT ${idContrato}, 'EXC insight', usr.id_usuario, reg.id_registro FROM usr, reg RETURNING id_insight),
         pre AS (
           INSERT INTO fat_pre_insight (id_contrato, conteudo, id_usuario_autor)
           SELECT ${idContrato}, 'EXC pre-insight', usr.id_usuario FROM usr RETURNING id_pre_insight),
         fat AS (
           INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, nivel_d1, dt_ocorrencia, id_usuario_autor, titulo)
           SELECT ${idContrato}, tpl.id_tipologia, 'baixo', CURRENT_DATE, usr.id_usuario, 'EXC fato' FROM usr, tpl
           RETURNING id_fato_gerador)
    INSERT INTO rel_fato_origem (id_fato_gerador, id_insight)
    SELECT fat.id_fato_gerador, ins.id_insight FROM fat, ins;
  `);

  // Árvore de planejamento (2º nível): objetivo -> meta -> sucesso mensal.
  await runSql(`
    INSERT INTO dim_planejamento (id_contrato) SELECT ${idContrato}
     WHERE NOT EXISTS (SELECT 1 FROM dim_planejamento WHERE id_contrato = ${idContrato});
  `);
  await runSql(`
    WITH pl AS (SELECT id_planejamento FROM dim_planejamento WHERE id_contrato = ${idContrato}),
         ob AS (INSERT INTO fat_objetivo_especifico (id_planejamento, descricao)
                SELECT id_planejamento, 'EXC objetivo' FROM pl RETURNING id_objetivo),
         me AS (INSERT INTO fat_meta (id_objetivo, descricao)
                SELECT id_objetivo, 'EXC meta' FROM ob RETURNING id_meta)
    INSERT INTO fat_sucesso_mensal (id_meta, descricao, mes_referencia, peso)
    SELECT id_meta, 'EXC sucesso', date_trunc('month', CURRENT_DATE)::date, 10 FROM me;
  `);

  // Formulário respondido + GIP ligado à submissão (fat_gip.id_submissao é NO
  // ACTION: prova a ordem gip -> submissão).
  await runSql(`
    WITH frm AS (SELECT id_formulario FROM ref_formulario ORDER BY id_formulario LIMIT 1),
         sub AS (INSERT INTO fat_submissao (id_contrato, id_formulario, versao_formulario, respostas)
                 SELECT ${idContrato}, id_formulario, 1, '{}'::jsonb FROM frm RETURNING id_submissao)
    INSERT INTO fat_gip (id_contrato, momento, aplicado_em, id_submissao)
    SELECT ${idContrato}, 'inicio', CURRENT_DATE, id_submissao FROM sub;
  `);
}

const TABELAS_POR_CONTRATO = [
  "fat_encontro", "fat_registro", "fat_insight", "fat_pre_insight", "fat_fato_gerador", "fat_submissao",
  "fat_gip", "dim_planejamento", "fat_etapa_contrato", "rel_formulario_contrato",
];

async function restantes(idContrato: number): Promise<Record<string, number>> {
  const partes = TABELAS_POR_CONTRATO.map(
    (t) => `SELECT '${t}' AS tabela, count(*)::int AS n FROM ${t} WHERE id_contrato = ${idContrato}`
  );
  const linhas = await runSql<{ tabela: string; n: number }>(partes.join(" UNION ALL "));
  return Object.fromEntries(linhas.map((l) => [l.tabela, l.n]));
}

async function existe(tabela: string, coluna: string, id: number): Promise<boolean> {
  const [{ n }] = await runSql<{ n: number }>(`SELECT count(*)::int AS n FROM ${tabela} WHERE ${coluna} = ${id};`);
  return n > 0;
}

describe("app.excluir_contrato / app.resumo_exclusao_contrato", () => {
  beforeAll(async () => {
    await criarUsuario(GESTORA_EMAIL, "EXC Gestora", "gestora");
    await criarUsuario(MENTOR_EMAIL, "EXC Mentor", "mentor");
    gestora = await signInAs(GESTORA_EMAIL);
    mentor = await signInAs(MENTOR_EMAIL);
  }, 90000);

  afterAll(async () => {
    // Rede de segurança: o que os testes não apagaram pela própria função.
    for (const id of contratantesCriados) {
      await runSql(`
        DELETE FROM fat_prospeccao WHERE id_contratante = ${id};
        DELETE FROM fat_contrato WHERE id_contratante = ${id} AND id_contrato_anterior IS NOT NULL;
      `).catch(() => undefined);
    }
    // Desativa em vez de apagar (ver criarUsuario): a auditoria os referencia.
    await runSql(`UPDATE dim_usuario SET ativo = false WHERE email IN ('${GESTORA_EMAIL}', '${MENTOR_EMAIL}');`);
    for (const id of authUserIds) await admin.auth.admin.deleteUser(id).catch(() => undefined);
  }, 60000);

  it("Mentor não exclui (42501) e nada é apagado -- nem o resumo ele consegue ver", async () => {
    const m = await criarMandato("EXC Mentor Barrado");
    await popular(m.idContrato);

    const resumo = await mentor.schema("app").rpc("resumo_exclusao_contrato", { p_id_contrato: m.idContrato });
    expect(resumo.error?.code).toBe("42501");

    const exclusao = await mentor.schema("app").rpc("excluir_contrato", { p_id_contrato: m.idContrato });
    expect(exclusao.error?.code).toBe("42501");

    expect(await existe("fat_contrato", "id_contrato", m.idContrato)).toBe(true);
    expect((await restantes(m.idContrato)).fat_registro).toBe(1);

    // limpeza: quem pode apagar é a gestora
    await gestora.schema("app").rpc("excluir_contrato", { p_id_contrato: m.idContrato });
  }, 120000);

  it("Gestora exclui: contrato, todos os dependentes (2º nível) e o cadastro órfão da pessoa saem", async () => {
    const m = await criarMandato("EXC Gestora Apaga Tudo");
    await popular(m.idContrato);

    const [nivel2] = await runSql<{ idObjetivo: number; idMeta: number; idSucesso: number }>(`
      SELECT o.id_objetivo AS "idObjetivo", m.id_meta AS "idMeta", s.id_sucesso AS "idSucesso"
        FROM dim_planejamento p
        JOIN fat_objetivo_especifico o ON o.id_planejamento = p.id_planejamento
        JOIN fat_meta m ON m.id_objetivo = o.id_objetivo
        JOIN fat_sucesso_mensal s ON s.id_meta = m.id_meta
       WHERE p.id_contrato = ${m.idContrato};
    `);
    const antes = await restantes(m.idContrato);
    for (const t of TABELAS_POR_CONTRATO) expect(antes[t], `${t} antes`).toBeGreaterThan(0);

    const resumo = await gestora.schema("app").rpc("resumo_exclusao_contrato", { p_id_contrato: m.idContrato });
    expect(resumo.error).toBeNull();
    const r = resumo.data as { apaga_contratante: boolean; nome_contratante: string; contagens: Record<string, number> };
    expect(r.nome_contratante).toBe("EXC Gestora Apaga Tudo");
    expect(r.apaga_contratante).toBe(true);
    // 2º nível aparece no resumo: é o que o usuário vê antes de confirmar.
    expect(r.contagens).toMatchObject({ objetivos: 1, metas: 1, sucessos_mensais: 1, registros: 1, fatos_geradores: 1, gips: 1 });

    const exclusao = await gestora.schema("app").rpc("excluir_contrato", { p_id_contrato: m.idContrato });
    expect(exclusao.error).toBeNull();
    expect(exclusao.data).toMatchObject({ apaga_contratante: true });

    expect(await existe("fat_contrato", "id_contrato", m.idContrato)).toBe(false);
    const depois = await restantes(m.idContrato);
    for (const t of TABELAS_POR_CONTRATO) expect(depois[t], `${t} depois`).toBe(0);
    // 2º nível saiu por CASCADE junto do planejamento (conferido por id).
    const [{ n: orfaos }] = await runSql<{ n: number }>(`
      SELECT (SELECT count(*) FROM fat_objetivo_especifico WHERE id_objetivo = ${nivel2.idObjetivo})
           + (SELECT count(*) FROM fat_meta WHERE id_meta = ${nivel2.idMeta})
           + (SELECT count(*) FROM fat_sucesso_mensal WHERE id_sucesso = ${nivel2.idSucesso}) AS n;
    `);
    expect(Number(orfaos)).toBe(0);
    // Pessoa órfã: contratante e mandato também saíram.
    expect(await existe("dim_mandato", "id_mandato", m.idMandato)).toBe(false);
    expect(await existe("dim_contratante", "id_contratante", m.idContratante)).toBe(false);

    // Auditoria: o DELETE ficou registrado por trigger.
    const [{ n: audit }] = await runSql<{ n: number }>(
      `SELECT count(*)::int AS n FROM log_auditoria WHERE tabela = 'fat_contrato' AND acao = 'delete' AND id_registro_alvo = ${m.idContrato};`
    );
    expect(audit).toBeGreaterThan(0);
  }, 180000);

  it("Pessoa com outro contrato: só o contrato sai, o cadastro fica e o elo de renovação é quebrado", async () => {
    const m = await criarMandato("EXC Pessoa Com Dois Contratos");
    const idPosterior = await criarContrato(m.idContratante, m.idContrato);

    const exclusao = await gestora.schema("app").rpc("excluir_contrato", { p_id_contrato: m.idContrato });
    expect(exclusao.error).toBeNull();
    expect(exclusao.data).toMatchObject({ apaga_contratante: false });

    expect(await existe("fat_contrato", "id_contrato", m.idContrato)).toBe(false);
    expect(await existe("fat_contrato", "id_contrato", idPosterior)).toBe(true);
    expect(await existe("dim_contratante", "id_contratante", m.idContratante)).toBe(true);
    expect(await existe("dim_mandato", "id_mandato", m.idMandato)).toBe(true);
    const [{ anterior }] = await runSql<{ anterior: number | null }>(
      `SELECT id_contrato_anterior AS anterior FROM fat_contrato WHERE id_contrato = ${idPosterior};`
    );
    expect(anterior).toBeNull();

    await gestora.schema("app").rpc("excluir_contrato", { p_id_contrato: idPosterior });
    expect(await existe("dim_contratante", "id_contratante", m.idContratante)).toBe(false);
  }, 180000);

  // 24/09: contrato criado pelo vínculo TSE do PLL -- a linha da planilha
  // (fat_cadastro_participante) travava a exclusão por FK. Agora ela fica e
  // só perde o vínculo.
  it("PLL: linha do cadastro de participantes não trava a exclusão, fica e volta a 'pendente de revisão'", async () => {
    const m = await criarMandato("EXC Pessoa Vinculada Pelo PLL");
    const [{ id_vinculo_tse: idVinculo }] = await runSql<{ id_vinculo_tse: number }>(`
      INSERT INTO rel_mandato_candidatura (id_mandato, ano_eleicao, sq_candidato, nr_turno, metodo_match, confianca)
      VALUES (${m.idMandato}, 2022, 930001, 1, 'manual', 'baixa') RETURNING id_vinculo_tse;
    `);
    const [{ id_cadastro_participante: idLinha }] = await runSql<{ id_cadastro_participante: number }>(`
      INSERT INTO fat_cadastro_participante (id_produto, papel, nome_completo, email, id_contrato, id_vinculo_tse)
      VALUES ((SELECT id_produto FROM fat_contrato WHERE id_contrato = ${m.idContrato}), 'mentorado',
              'EXC Assessora PLL', 'exc-pll-${m.idContrato}@legislabrasil.test', ${m.idContrato}, ${idVinculo})
      RETURNING id_cadastro_participante;
    `);

    try {
      const exclusao = await gestora.schema("app").rpc("excluir_contrato", { p_id_contrato: m.idContrato });
      expect(exclusao.error).toBeNull();
      expect(exclusao.data).toMatchObject({ apaga_contratante: true });

      expect(await existe("fat_contrato", "id_contrato", m.idContrato)).toBe(false);
      expect(await existe("rel_mandato_candidatura", "id_vinculo_tse", idVinculo)).toBe(false);
      const [linha] = await runSql<{ id_contrato: number | null; id_vinculo_tse: number | null; status_cadastro: string }>(
        `SELECT id_contrato, id_vinculo_tse, status_cadastro FROM fat_cadastro_participante WHERE id_cadastro_participante = ${idLinha};`
      );
      expect(linha).toEqual({ id_contrato: null, id_vinculo_tse: null, status_cadastro: "pendente_revisao" });
    } finally {
      await runSql(`DELETE FROM fat_cadastro_participante WHERE id_cadastro_participante = ${idLinha};`);
    }
  }, 180000);

  it("Prospecção que gerou o contrato sai junto; outra prospecção aberta da pessoa segura o cadastro", async () => {
    const m = await criarMandato("EXC Pessoa Com Prospeccao");
    const [{ id_prospeccao: idGerou }] = await runSql<{ id_prospeccao: number }>(`
      INSERT INTO fat_prospeccao (id_contratante, id_produto, status, dt_desfecho, id_contrato_gerado)
      VALUES (${m.idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), 'convertida', CURRENT_DATE, ${m.idContrato})
      RETURNING id_prospeccao;
    `);
    const [{ id_prospeccao: idAberta }] = await runSql<{ id_prospeccao: number }>(`
      INSERT INTO fat_prospeccao (id_contratante, id_produto, status)
      VALUES (${m.idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), 'aberta')
      RETURNING id_prospeccao;
    `);

    const exclusao = await gestora.schema("app").rpc("excluir_contrato", { p_id_contrato: m.idContrato });
    expect(exclusao.error).toBeNull();
    expect(exclusao.data).toMatchObject({ apaga_contratante: false });

    expect(await existe("fat_prospeccao", "id_prospeccao", idGerou)).toBe(false);
    expect(await existe("fat_prospeccao", "id_prospeccao", idAberta)).toBe(true);
    expect(await existe("dim_contratante", "id_contratante", m.idContratante)).toBe(true);

    await runSql(`
      DELETE FROM fat_prospeccao WHERE id_prospeccao = ${idAberta};
      DELETE FROM dim_mandato WHERE id_mandato = ${m.idMandato};
      DELETE FROM dim_contratante WHERE id_contratante = ${m.idContratante};
    `);
  }, 180000);

  it("contrato inexistente: 42501, sem revelar se existe", async () => {
    const r = await gestora.schema("app").rpc("excluir_contrato", { p_id_contrato: 999999999 });
    expect(r.error?.code).toBe("42501");
  }, 60000);
});
