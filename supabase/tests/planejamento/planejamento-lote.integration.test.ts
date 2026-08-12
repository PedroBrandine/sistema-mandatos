import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: PLM-03 (.specs/features/planejamento-planilha-monitoramento/spec.md,
// migration 20260812150151_planejamento_planilha_fn_lote.sql) --
//  - app.atualiza_sucessos_mensais_lote escreve uma faixa colada de pct_atingimento
//    num único UPDATE atômico: 1 valor fora de 0-100 no meio da faixa reverte a
//    faixa INTEIRA, nenhuma célula salva parcialmente;
//  - SECURITY INVOKER: a RLS (p_heranca) e o GRANT do chamador continuam valendo
//    linha a linha dentro da função -- uma linha fora da carteira do chamador
//    simplesmente não é tocada (RLS por USING, silenciosa), sem abortar a faixa
//    inteira nem estourar erro pras linhas que o chamador pode escrever.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "PLM-lote-test-P4ssword!";

const GESTORA_EMAIL = "plm-lote-gestora@legislabrasil.test";
const ASSESSOR_EMAIL = "plm-lote-assessor@legislabrasil.test";

const admin = createClient(URL, SERVICE_ROLE_KEY);
const authUserIds: string[] = [];

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

interface ContratoFixture {
  idContratante: number;
  idContrato: number;
  idSucesso1: number;
  idSucesso2: number;
}

let a: ContratoFixture; // carteira do Assessor
let b: ContratoFixture; // fora da carteira

async function makeFixture(label: string): Promise<ContratoFixture> {
  const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'PLM Lote ${label}')
    RETURNING id_contratante;
  `);
  const [{ id_contrato: idContrato }] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
    VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
    RETURNING id_contrato;
  `);
  const [{ id_planejamento: idPlanejamento }] = await runSql<{ id_planejamento: number }>(`
    SELECT id_planejamento FROM dim_planejamento WHERE id_contrato = ${idContrato};
  `);
  const [{ id_objetivo: idObjetivo }] = await runSql<{ id_objetivo: number }>(`
    INSERT INTO fat_objetivo_especifico (id_planejamento, descricao) VALUES (${idPlanejamento}, 'Objetivo ${label}')
    RETURNING id_objetivo;
  `);
  const [{ id_meta: idMeta }] = await runSql<{ id_meta: number }>(`
    INSERT INTO fat_meta (id_objetivo, descricao) VALUES (${idObjetivo}, 'Meta ${label}')
    RETURNING id_meta;
  `);
  const [{ id_sucesso: idSucesso1 }] = await runSql<{ id_sucesso: number }>(`
    INSERT INTO fat_sucesso_mensal (id_meta, descricao, mes_referencia, peso)
    VALUES (${idMeta}, 'Sucesso 1 ${label}', '2026-08-01', 50) RETURNING id_sucesso;
  `);
  const [{ id_sucesso: idSucesso2 }] = await runSql<{ id_sucesso: number }>(`
    INSERT INTO fat_sucesso_mensal (id_meta, descricao, mes_referencia, peso)
    VALUES (${idMeta}, 'Sucesso 2 ${label}', '2026-08-01', 50) RETURNING id_sucesso;
  `);
  return { idContratante, idContrato, idSucesso1, idSucesso2 };
}

async function lerPct(idSucesso: number): Promise<number | null> {
  const [row] = await runSql<{ pct_atingimento: string | null }>(
    `SELECT pct_atingimento FROM fat_sucesso_mensal WHERE id_sucesso = ${idSucesso};`
  );
  return row.pct_atingimento == null ? null : Number(row.pct_atingimento);
}

describe("planejamento-planilha-monitoramento -- RPC de lote (PLM-03)", () => {
  beforeAll(async () => {
    const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of existing?.users ?? []) {
      if (user.email && [GESTORA_EMAIL, ASSESSOR_EMAIL].includes(user.email)) {
        await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      }
    }
    for (const email of [GESTORA_EMAIL, ASSESSOR_EMAIL]) {
      const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
      if (error) throw error;
      authUserIds.push(data.user.id);
    }
    await runSql(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo) VALUES
        ('${GESTORA_EMAIL}', 'PLM Lote Gestora', 'gestora', true),
        ('${ASSESSOR_EMAIL}', 'PLM Lote Assessor', 'assessor', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);

    a = await makeFixture("A (carteira do assessor)");
    b = await makeFixture("B (fora da carteira)");

    await runSql(`
      INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
      SELECT ${a.idContrato}, id_usuario, 'assessor' FROM dim_usuario WHERE email = '${ASSESSOR_EMAIL}'
      ON CONFLICT (id_contrato, id_usuario, papel_no_contrato) DO NOTHING;
    `);
  }, 120000);

  afterAll(async () => {
    await runSql(`DELETE FROM rel_usuario_contrato WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});`);
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});
      DELETE FROM rel_formulario_contrato WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});
      DELETE FROM dim_planejamento WHERE id_contrato IN (${a.idContrato}, ${b.idContrato});
    `);
    for (const f of [a, b]) {
      await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${f.idContrato};`);
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${f.idContratante};`);
    }
    await runSql(`
      DELETE FROM log_auditoria WHERE id_usuario IN (
        SELECT id_usuario FROM dim_usuario WHERE email IN ('${GESTORA_EMAIL}', '${ASSESSOR_EMAIL}')
      );
    `);
    await runSql(`DELETE FROM dim_usuario WHERE email IN ('${GESTORA_EMAIL}', '${ASSESSOR_EMAIL}');`);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 120000);

  it(
    "faixa válida atualiza todas as linhas do contrato vinculado (Assessor)",
    async () => {
      const client = await signInAs(ASSESSOR_EMAIL);
      const { error } = await client.schema("app").rpc("atualiza_sucessos_mensais_lote", {
        p_valores: [
          { id_sucesso: a.idSucesso1, pct_atingimento: 80 },
          { id_sucesso: a.idSucesso2, pct_atingimento: 90 },
        ],
      });
      expect(error).toBeNull();
      expect(await lerPct(a.idSucesso1)).toBe(80);
      expect(await lerPct(a.idSucesso2)).toBe(90);
    },
    60000
  );

  it(
    "atomicidade: 1 valor fora de 0-100 no meio da faixa não salva NENHUMA linha",
    async () => {
      const client = await signInAs(GESTORA_EMAIL);
      const antes1 = await lerPct(a.idSucesso1);

      const { error } = await client.schema("app").rpc("atualiza_sucessos_mensais_lote", {
        p_valores: [
          { id_sucesso: a.idSucesso1, pct_atingimento: 50 },
          { id_sucesso: a.idSucesso2, pct_atingimento: 999 },
        ],
      });
      expect(error).not.toBeNull();
      expect(error?.code).toBe("23514");

      // Rollback atômico: a.idSucesso1 (valor válido, mesma faixa) NÃO mudou pra 50.
      expect(await lerPct(a.idSucesso1)).toBe(antes1);
    },
    60000
  );

  it(
    "RLS ainda vale dentro da função SECURITY INVOKER: Assessor não altera linha de contrato não vinculado, mesmo na mesma faixa",
    async () => {
      const client = await signInAs(ASSESSOR_EMAIL);
      const antesB = await lerPct(b.idSucesso1);

      const { error } = await client.schema("app").rpc("atualiza_sucessos_mensais_lote", {
        p_valores: [
          { id_sucesso: a.idSucesso1, pct_atingimento: 100 }, // vinculado -- deve atualizar
          { id_sucesso: b.idSucesso1, pct_atingimento: 100 }, // não vinculado -- RLS filtra, não atualiza
        ],
      });
      expect(error).toBeNull();
      expect(await lerPct(a.idSucesso1)).toBe(100);
      expect(await lerPct(b.idSucesso1)).toBe(antesB);
    },
    60000
  );
});
