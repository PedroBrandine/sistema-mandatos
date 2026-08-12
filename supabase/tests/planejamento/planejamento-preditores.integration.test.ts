import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: PLM-16 (.specs/features/planejamento-planilha-monitoramento/spec.md,
// migration 20260812180622_planejamento_planilha_fn_preditores.sql) --
//  - app.substitui_preditores_planejamento troca o conjunto inteiro de preditores
//    prioritários (até 3, rel_planejamento_preditor) num único DELETE+INSERT atômico;
//  - SECURITY INVOKER: só quem já tem GRANT completo na tabela (Gestora/Admin) consegue
//    -- Mentor/Assessor têm só SELECT (docs/schema_sistema.sql:2080-2098, nenhuma linha
//    de rel_planejamento_preditor pros dois papéis), então 42501;
//  - atomicidade: um conjunto inválido (ordem duplicada, viola uq_planejamento_preditor_ordem)
//    não deixa a tabela vazia -- o conjunto anterior permanece intacto.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "PLM-preditores-test-P4ssword!";

const GESTORA_EMAIL = "plm-preditores-gestora@legislabrasil.test";
const MENTOR_EMAIL = "plm-preditores-mentor@legislabrasil.test";

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
  idPlanejamento: number;
  idPreditor1: number;
  idPreditor2: number;
  idPreditor3: number;
}

let f: Fixture;

async function lerPreditores(idPlanejamento: number) {
  return runSql<{ id_preditor: number; ordem: number }>(`
    SELECT id_preditor, ordem FROM rel_planejamento_preditor
     WHERE id_planejamento = ${idPlanejamento} ORDER BY ordem;
  `);
}

describe("planejamento-planilha-monitoramento -- RPC de preditores prioritários (PLM-16)", () => {
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
        ('${GESTORA_EMAIL}', 'PLM Preditores Gestora', 'gestora', true),
        ('${MENTOR_EMAIL}', 'PLM Preditores Mentor', 'mentor', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
    `);

    const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'PLM Preditores')
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
    const preditores = await runSql<{ id_preditor: number }>(`
      SELECT id_preditor FROM ref_preditor WHERE ativo = true ORDER BY id_preditor LIMIT 3;
    `);

    await runSql(`
      INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
      SELECT ${idContrato}, id_usuario, 'mentor' FROM dim_usuario WHERE email = '${MENTOR_EMAIL}'
      ON CONFLICT (id_contrato, id_usuario, papel_no_contrato) DO NOTHING;
    `);

    f = {
      idContratante,
      idContrato,
      idPlanejamento,
      idPreditor1: preditores[0].id_preditor,
      idPreditor2: preditores[1].id_preditor,
      idPreditor3: preditores[2].id_preditor,
    };
  }, 120000);

  afterAll(async () => {
    await runSql(`DELETE FROM rel_usuario_contrato WHERE id_contrato = ${f.idContrato};`);
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato = ${f.idContrato};
      DELETE FROM rel_formulario_contrato WHERE id_contrato = ${f.idContrato};
      DELETE FROM dim_planejamento WHERE id_contrato = ${f.idContrato};
    `);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${f.idContrato};`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${f.idContratante};`);
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

  it(
    "Gestora substitui o conjunto de preditores prioritários (DELETE+INSERT atômico)",
    async () => {
      const client = await signInAs(GESTORA_EMAIL);
      const { error } = await client.schema("app").rpc("substitui_preditores_planejamento", {
        p_id_planejamento: f.idPlanejamento,
        p_preditores: [
          { id_preditor: f.idPreditor1, ordem: 1 },
          { id_preditor: f.idPreditor2, ordem: 2 },
        ],
      });
      expect(error).toBeNull();

      const linhas = await lerPreditores(f.idPlanejamento);
      expect(linhas).toEqual([
        { id_preditor: f.idPreditor1, ordem: 1 },
        { id_preditor: f.idPreditor2, ordem: 2 },
      ]);
    },
    60000
  );

  it(
    "Gestora troca o conjunto por um novo (o antigo é substituído, não acumulado)",
    async () => {
      const client = await signInAs(GESTORA_EMAIL);
      const { error } = await client.schema("app").rpc("substitui_preditores_planejamento", {
        p_id_planejamento: f.idPlanejamento,
        p_preditores: [{ id_preditor: f.idPreditor3, ordem: 1 }],
      });
      expect(error).toBeNull();

      const linhas = await lerPreditores(f.idPlanejamento);
      expect(linhas).toEqual([{ id_preditor: f.idPreditor3, ordem: 1 }]);
    },
    60000
  );

  it(
    "atomicidade: conjunto com ordem duplicada não salva -- o conjunto anterior permanece intacto",
    async () => {
      const client = await signInAs(GESTORA_EMAIL);
      const antes = await lerPreditores(f.idPlanejamento);

      const { error } = await client.schema("app").rpc("substitui_preditores_planejamento", {
        p_id_planejamento: f.idPlanejamento,
        p_preditores: [
          { id_preditor: f.idPreditor1, ordem: 1 },
          { id_preditor: f.idPreditor2, ordem: 1 }, // ordem duplicada -- viola uq_planejamento_preditor_ordem
        ],
      });
      expect(error).not.toBeNull();
      expect(error?.code).toBe("23505");

      const depois = await lerPreditores(f.idPlanejamento);
      expect(depois).toEqual(antes); // nem o DELETE nem o INSERT parcial ficaram -- rollback da transação inteira
    },
    60000
  );

  it(
    "Mentor é rejeitado (42501) -- só SELECT em rel_planejamento_preditor, sem GRANT de escrita",
    async () => {
      const client = await signInAs(MENTOR_EMAIL);
      const { error } = await client.schema("app").rpc("substitui_preditores_planejamento", {
        p_id_planejamento: f.idPlanejamento,
        p_preditores: [{ id_preditor: f.idPreditor1, ordem: 1 }],
      });
      expect(error?.code).toBe("42501");
    },
    60000
  );
});
