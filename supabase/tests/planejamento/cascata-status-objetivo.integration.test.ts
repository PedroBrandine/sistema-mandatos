import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: PLV-02 (.specs/features/planejamento-estrategico-v2/spec.md), AD-052.
//   AC2: app.recalcula_atingimento considera SOMENTE Objetivos com status='ativo'
//        na média do Planejamento (nível raiz).
//   AC3: Objetivo que passa a não-ativo marca dim_planejamento.atingimento_desatualizado.
//   AC4: todos os Objetivos não-ativos -> pct_atingimento do Planejamento é NULL
//        (exibido '—'), nunca 0%.
//   Independent Test da story: "plano com 2 objetivos (100% e 0%) marca 50%;
//   pausar o de 0% e recalcular leva o plano a 100%".
//
// A emenda só pode mexer no nível RAIZ. Os níveis 1 (Meta = média dos Sucessos
// ponderada pelo peso) e 2 (Objetivo = média simples das Metas ATIVAS) têm de
// continuar com o resultado anterior -- é o que o contrato "regressão" abaixo
// guarda, com os mesmos valores da suíte aprovada em
// planejamento-cascata.integration.test.ts.
//
// AD-035 é o outro lado desta tarefa. CREATE OR REPLACE FUNCTION zera toda
// propriedade opcional não redeclarada, e app.recalcula_atingimento é
// SECURITY DEFINER SET search_path desde 20260812151909 -- justamente porque,
// como INVOKER, ela estourava 42501 para Assessor e Mentor (que só têm SELECT
// em dim_planejamento/fat_meta/fat_objetivo_especifico). Aquele bug só apareceu
// rodando integração de verdade. Daí os dois testes de AD-035 abaixo: um FIXA o
// atributo no catálogo, o outro exercita o caminho real do Assessor.
//
// Fixture 1 (raiz):      Objetivo A (100%) e Objetivo B (0%)  -> plano 50
// Fixture 2 (regressão): Objetivo C = 50 (Meta ativa 50; pausada 90 e descartada 30 fora)
//                        Objetivo D = 0  (Meta sem Sucesso -> NULL; Meta com peso total 0 -> NULL)
//                        -> plano 25

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const SENHA = "PLV-t2-cascata-P4ssword!";
const ASSESSOR_EMAIL = "plv-t2-assessor@legislabrasil.test";

const admin = createClient(URL, SERVICE_ROLE_KEY);
const idsAuth: string[] = [];

async function entrarComo(email: string): Promise<SupabaseClient> {
  const client = createClient(URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw error;
  return client;
}

interface Fixture {
  idContratante: number;
  idContratoRaiz: number;
  idPlanejamentoRaiz: number;
  idObjetivoA: number;
  idObjetivoB: number;
  idContratoReg: number;
  idPlanejamentoReg: number;
  idObjetivoC: number;
  idObjetivoD: number;
  idMetaC1: number;
  idMetaC2: number;
  idMetaC3: number;
  idMetaD1: number;
  idMetaD2: number;
  idSucessoA1: number;
}

let f: Fixture;

async function recalcula(idPlanejamento: number): Promise<void> {
  await runSql(`SELECT app.recalcula_atingimento(${idPlanejamento});`);
}

async function lerPlanejamento(idPlanejamento: number) {
  const [row] = await runSql<{ pct_atingimento: string | null; atingimento_desatualizado: boolean }>(`
    SELECT pct_atingimento, atingimento_desatualizado FROM dim_planejamento WHERE id_planejamento = ${idPlanejamento};
  `);
  return row;
}

async function criarContrato(idContratante: number) {
  const [{ id_contrato: idContrato }] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
    VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
    RETURNING id_contrato;
  `);
  const [{ id_planejamento: idPlanejamento }] = await runSql<{ id_planejamento: number }>(`
    SELECT id_planejamento FROM dim_planejamento WHERE id_contrato = ${idContrato};
  `);
  return { idContrato, idPlanejamento };
}

describe("planejamento-estrategico-v2 -- cascata exclui Objetivo não-ativo (PLV-02, AD-052)", () => {
  beforeAll(async () => {
    const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'PLV Cascata Objetivo')
      RETURNING id_contratante;
    `);

    const raiz = await criarContrato(idContratante);
    const reg = await criarContrato(idContratante);

    // --- Fixture 1: nível raiz --------------------------------------------
    const objetivosRaiz = await runSql<{ id_objetivo: number; descricao: string }>(`
      INSERT INTO fat_objetivo_especifico (id_planejamento, descricao, status)
      VALUES (${raiz.idPlanejamento}, 'Objetivo A (100%)', 'ativo'),
             (${raiz.idPlanejamento}, 'Objetivo B (0%)', 'ativo')
      RETURNING id_objetivo, descricao;
    `);
    const idObjetivoA = objetivosRaiz.find((o) => o.descricao.startsWith("Objetivo A"))!.id_objetivo;
    const idObjetivoB = objetivosRaiz.find((o) => o.descricao.startsWith("Objetivo B"))!.id_objetivo;

    const [{ id_meta: idMetaA1 }] = await runSql<{ id_meta: number }>(`
      INSERT INTO fat_meta (id_objetivo, descricao, status) VALUES (${idObjetivoA}, 'Meta A1', 'ativa')
      RETURNING id_meta;
    `);
    const [{ id_meta: idMetaB1 }] = await runSql<{ id_meta: number }>(`
      INSERT INTO fat_meta (id_objetivo, descricao, status) VALUES (${idObjetivoB}, 'Meta B1', 'ativa')
      RETURNING id_meta;
    `);
    const sucessosRaiz = await runSql<{ id_sucesso: number; descricao: string }>(`
      INSERT INTO fat_sucesso_mensal (id_meta, descricao, mes_referencia, peso, pct_atingimento)
      VALUES (${idMetaA1}, 'A1-1', '2026-08-01', 100, 100),
             (${idMetaB1}, 'B1-1', '2026-08-01', 100, 0)
      RETURNING id_sucesso, descricao;
    `);
    const idSucessoA1 = sucessosRaiz.find((s) => s.descricao === "A1-1")!.id_sucesso;

    // --- Fixture 2: regressão dos níveis 1 e 2 ----------------------------
    const objetivosReg = await runSql<{ id_objetivo: number; descricao: string }>(`
      INSERT INTO fat_objetivo_especifico (id_planejamento, descricao, status)
      VALUES (${reg.idPlanejamento}, 'Objetivo C', 'ativo'),
             (${reg.idPlanejamento}, 'Objetivo D', 'ativo')
      RETURNING id_objetivo, descricao;
    `);
    const idObjetivoC = objetivosReg.find((o) => o.descricao === "Objetivo C")!.id_objetivo;
    const idObjetivoD = objetivosReg.find((o) => o.descricao === "Objetivo D")!.id_objetivo;

    const metasReg = await runSql<{ id_meta: number; descricao: string }>(`
      INSERT INTO fat_meta (id_objetivo, descricao, status)
      VALUES (${idObjetivoC}, 'Meta C1 (ativa)', 'ativa'),
             (${idObjetivoC}, 'Meta C2 (pausada)', 'pausada'),
             (${idObjetivoC}, 'Meta C3 (descartada)', 'descartada'),
             (${idObjetivoD}, 'Meta D1 (ativa, sem sucesso)', 'ativa'),
             (${idObjetivoD}, 'Meta D2 (ativa, peso total 0)', 'ativa')
      RETURNING id_meta, descricao;
    `);
    const idPorDescricao = new Map(metasReg.map((m) => [m.descricao, m.id_meta]));
    const idMetaC1 = idPorDescricao.get("Meta C1 (ativa)")!;
    const idMetaC2 = idPorDescricao.get("Meta C2 (pausada)")!;
    const idMetaC3 = idPorDescricao.get("Meta C3 (descartada)")!;
    const idMetaD1 = idPorDescricao.get("Meta D1 (ativa, sem sucesso)")!;
    const idMetaD2 = idPorDescricao.get("Meta D2 (ativa, peso total 0)")!;

    await runSql(`
      INSERT INTO fat_sucesso_mensal (id_meta, descricao, mes_referencia, peso, pct_atingimento)
      VALUES (${idMetaC1}, 'C1-1', '2026-08-01', 25, 80),
             (${idMetaC1}, 'C1-2', '2026-08-01', 75, 40),
             (${idMetaC2}, 'C2-1', '2026-08-01', 100, 90),
             (${idMetaC3}, 'C3-1', '2026-08-01', 100, 30),
             (${idMetaD2}, 'D2-1', '2026-08-01', 0, 50);
    `);

    f = {
      idContratante,
      idContratoRaiz: raiz.idContrato,
      idPlanejamentoRaiz: raiz.idPlanejamento,
      idObjetivoA,
      idObjetivoB,
      idContratoReg: reg.idContrato,
      idPlanejamentoReg: reg.idPlanejamento,
      idObjetivoC,
      idObjetivoD,
      idMetaC1,
      idMetaC2,
      idMetaC3,
      idMetaD1,
      idMetaD2,
      idSucessoA1,
    };

    // Assessor real (Auth + dim_usuario + vínculo no contrato raiz), para o
    // teste de AD-035 -- é o papel que o 42501 derrubava.
    const { data: existentes } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of existentes?.users ?? []) {
      if (user.email === ASSESSOR_EMAIL) await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
    }
    const { data: criado, error: erroAuth } = await admin.auth.admin.createUser({
      email: ASSESSOR_EMAIL,
      password: SENHA,
      email_confirm: true,
    });
    if (erroAuth) throw erroAuth;
    idsAuth.push(criado.user.id);

    await runSql(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo)
      VALUES ('${ASSESSOR_EMAIL}', 'PLV T2 Assessor', 'assessor', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;

      INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
      SELECT ${raiz.idContrato}, id_usuario, 'assessor' FROM dim_usuario WHERE email = '${ASSESSOR_EMAIL}'
      ON CONFLICT (id_contrato, id_usuario, papel_no_contrato) DO NOTHING;
    `);
  }, 240000);

  afterAll(async () => {
    await runSql(`DELETE FROM rel_usuario_contrato WHERE id_contrato IN (${f.idContratoRaiz}, ${f.idContratoReg});`);
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato IN (${f.idContratoRaiz}, ${f.idContratoReg});
      DELETE FROM rel_formulario_contrato WHERE id_contrato IN (${f.idContratoRaiz}, ${f.idContratoReg});
      DELETE FROM dim_planejamento WHERE id_contrato IN (${f.idContratoRaiz}, ${f.idContratoReg});
    `);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato IN (${f.idContratoRaiz}, ${f.idContratoReg});`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${f.idContratante};`);
    // A escrita do Assessor aciona trg_audit_* e deixa linha em log_auditoria
    // apontando para ele -- sem apagar antes, o DELETE de dim_usuario estoura
    // 23503 (mesmo achado já documentado em planejamento-rls).
    await runSql(`
      DELETE FROM log_auditoria WHERE id_usuario IN (
        SELECT id_usuario FROM dim_usuario WHERE email = '${ASSESSOR_EMAIL}');
    `);
    await runSql(`DELETE FROM dim_usuario WHERE email = '${ASSESSOR_EMAIL}';`);
    for (const id of idsAuth) await admin.auth.admin.deleteUser(id).catch(() => undefined);
  }, 240000);

  it(
    "AD-035 preservado: a função continua SECURITY DEFINER com search_path fixado (CREATE OR REPLACE zera atributos não declarados)",
    async () => {
      const [row] = await runSql<{ prosecdef: boolean; proconfig: string | null }>(`
        SELECT p.prosecdef, array_to_string(p.proconfig, ',') AS proconfig
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'app' AND p.proname = 'recalcula_atingimento';
      `);
      expect(row.prosecdef).toBe(true);
      expect(row.proconfig).toMatch(/search_path=public,\s*pg_temp/);
    },
    60000
  );

  it(
    "AC2 (Independent Test): 2 Objetivos ativos, 100% e 0%, levam o plano a 50%",
    async () => {
      await recalcula(f.idPlanejamentoRaiz);

      const objetivos = await runSql<{ id_objetivo: number; pct_atingimento: string }>(`
        SELECT id_objetivo, pct_atingimento FROM fat_objetivo_especifico
         WHERE id_objetivo IN (${f.idObjetivoA}, ${f.idObjetivoB});
      `);
      const pct = new Map(objetivos.map((o) => [o.id_objetivo, Number(o.pct_atingimento)]));
      expect(pct.get(f.idObjetivoA)).toBe(100);
      expect(pct.get(f.idObjetivoB)).toBe(0);

      expect(Number((await lerPlanejamento(f.idPlanejamentoRaiz)).pct_atingimento)).toBe(50);
    },
    90000
  );

  it(
    "AC3: pausar um Objetivo marca o planejamento como desatualizado",
    async () => {
      await recalcula(f.idPlanejamentoRaiz); // baseline limpa
      expect((await lerPlanejamento(f.idPlanejamentoRaiz)).atingimento_desatualizado).toBe(false);

      await runSql(`UPDATE fat_objetivo_especifico SET status = 'pausado' WHERE id_objetivo = ${f.idObjetivoB};`);

      expect((await lerPlanejamento(f.idPlanejamentoRaiz)).atingimento_desatualizado).toBe(true);
    },
    90000
  );

  it(
    "AC2 (Independent Test): com o Objetivo de 0% pausado, o plano vai a 100% -- o Objetivo pausado mantém o próprio pct",
    async () => {
      // O teste anterior já pausou o Objetivo B.
      await recalcula(f.idPlanejamentoRaiz);

      expect(Number((await lerPlanejamento(f.idPlanejamentoRaiz)).pct_atingimento)).toBe(100);

      // O Objetivo pausado continua calculando o próprio número (só não entra
      // na média do plano) -- mesmo comportamento que a Meta pausada tem no
      // nível 2 desde a cascata original.
      const [objetivoB] = await runSql<{ pct_atingimento: string }>(
        `SELECT pct_atingimento FROM fat_objetivo_especifico WHERE id_objetivo = ${f.idObjetivoB};`
      );
      expect(Number(objetivoB.pct_atingimento)).toBe(0);
    },
    90000
  );

  it(
    "AC4: com TODOS os Objetivos não-ativos o plano fica NULL, nunca 0%",
    async () => {
      await runSql(`UPDATE fat_objetivo_especifico SET status = 'descartado' WHERE id_objetivo = ${f.idObjetivoA};`);
      await recalcula(f.idPlanejamentoRaiz);

      expect((await lerPlanejamento(f.idPlanejamentoRaiz)).pct_atingimento).toBeNull();
    },
    90000
  );

  it(
    "Regressão: níveis 1 e 2 seguem com o resultado anterior -- média ponderada por peso e exclusão de Meta pausada/descartada",
    async () => {
      await recalcula(f.idPlanejamentoReg);

      const metas = await runSql<{ id_meta: number; pct_atingimento: string | null }>(`
        SELECT id_meta, pct_atingimento FROM fat_meta
         WHERE id_meta IN (${f.idMetaC1}, ${f.idMetaC2}, ${f.idMetaC3}, ${f.idMetaD1}, ${f.idMetaD2});
      `);
      const pctMeta = new Map(metas.map((m) => [m.id_meta, m.pct_atingimento]));
      // Nível 1, média ponderada: (25*80 + 75*40)/100 = 50
      expect(Number(pctMeta.get(f.idMetaC1))).toBe(50);
      // Meta pausada/descartada continuam calculando o próprio pct
      expect(Number(pctMeta.get(f.idMetaC2))).toBe(90);
      expect(Number(pctMeta.get(f.idMetaC3))).toBe(30);
      // Edge Case da spec: Meta sem Sucesso Mensal -> NULL, nunca 0
      expect(pctMeta.get(f.idMetaD1)).toBeNull();
      // Edge Case da spec: soma dos pesos 0 -> NULL (CASE WHEN SUM(peso) > 0)
      expect(pctMeta.get(f.idMetaD2)).toBeNull();

      const objetivos = await runSql<{ id_objetivo: number; pct_atingimento: string }>(`
        SELECT id_objetivo, pct_atingimento FROM fat_objetivo_especifico
         WHERE id_objetivo IN (${f.idObjetivoC}, ${f.idObjetivoD});
      `);
      const pctObjetivo = new Map(objetivos.map((o) => [o.id_objetivo, Number(o.pct_atingimento)]));
      // Nível 2: só Metas ativas -- C2 (90) e C3 (30) ficam de fora, sobra C1 (50)
      expect(pctObjetivo.get(f.idObjetivoC)).toBe(50);
      // Nível 2: Meta ativa com pct NULL entra como 0 (COALESCE aprovado) -> AVG(0, 0)
      expect(pctObjetivo.get(f.idObjetivoD)).toBe(0);

      // Raiz, com os dois Objetivos ativos: AVG(50, 0) = 25
      expect(Number((await lerPlanejamento(f.idPlanejamentoReg)).pct_atingimento)).toBe(25);
    },
    120000
  );

  it(
    "AD-035: Assessor escreve em fat_sucesso_mensal e chama a cascata sem 42501 -- o caminho real que a redeclaração de SECURITY DEFINER protege",
    async () => {
      const cliente = await entrarComo(ASSESSOR_EMAIL);

      // Escrita direta: dispara trg_sm_upd -> app.trg_marca_desatualizado_upd,
      // que faz UPDATE em dim_planejamento -- tabela onde o Assessor só tem
      // SELECT. Era aqui que o 42501 aparecia antes de AD-035.
      const { data: atualizadas, error: erroUpdate } = await cliente
        .from("fat_sucesso_mensal")
        .update({ pct_atingimento: 77 })
        .eq("id_sucesso", f.idSucessoA1)
        .select("id_sucesso, pct_atingimento");

      expect(erroUpdate).toBeNull();
      expect(atualizadas).toHaveLength(1);

      // Chamada direta da função que ESTA migration recriou. É o caso que o
      // comentário de AD-035 descreve como "qualquer papel sem UPDATE amplo
      // chamando app.recalcula_atingimento diretamente".
      const { error: erroRpc } = await cliente
        .schema("app")
        .rpc("recalcula_atingimento", { p_id_planejamento: f.idPlanejamentoRaiz });

      expect(erroRpc).toBeNull();

      // E a cascata de fato escreveu: o flag foi limpo pela função rodando
      // como DEFINER, não ficou pendente.
      expect((await lerPlanejamento(f.idPlanejamentoRaiz)).atingimento_desatualizado).toBe(false);
    },
    120000
  );
});
