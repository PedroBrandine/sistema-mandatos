import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";

// Spec anchor: saida-numeros-impacto T3 Done-when (.specs/features/saida-numeros-impacto/tasks.md),
// migration 20260831022722_saida_visao_mandato.sql --
//  - legisla_gestora lê vw_visao_mandato filtrada por id_contratante, linhas ordenadas
//    por ordem_contrato, id_contrato_anterior presente quando existir
//  - legisla_mentor/legisla_assessor recebem 42501 ao tentar SELECT
//
// spec.md P2 AC1/AC2/AC3.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "SAI-T3-visao-mandato-P4ssword!";

const PAPEIS = ["gestora", "mentor", "assessor"] as const;
type Papel = (typeof PAPEIS)[number];

function emailDoPapel(papel: Papel): string {
  return `sai-t3-${papel}@legislabrasil.test`;
}

const admin = createClient(URL, SERVICE_ROLE_KEY);
const authUserIds: string[] = [];
const clientesPorPapel = new Map<Papel, SupabaseClient>();

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

let idContratante: number;
let idContratoAntigo: number;
let idContratoRenovacao: number;

describe("saida-numeros-impacto T3 -- vw_visao_mandato DDL + GRANT", () => {
  beforeAll(async () => {
    const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of existing?.users ?? []) {
      if (user.email && PAPEIS.map(emailDoPapel).includes(user.email)) {
        await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      }
    }
    for (const papel of PAPEIS) {
      const email = emailDoPapel(papel);
      const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
      if (error) throw error;
      authUserIds.push(data.user.id);

      await runSql(`
        INSERT INTO dim_usuario (email, nome, papel_global, ativo) VALUES
          ('${email}', 'SAI T3 ${papel}', '${papel}', true)
        ON CONFLICT (email) DO UPDATE SET papel_global = EXCLUDED.papel_global, ativo = true;
      `);
      clientesPorPapel.set(papel, await signInAs(email));
    }

    const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'SAI T3 Contratante Timeline')
      RETURNING id_contratante;
    `);
    idContratante = id_contratante;

    const [{ id_contrato: idAntigo }] = await runSql<{ id_contrato: number }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), '2024-01-15', 'concluido')
      RETURNING id_contrato;
    `);
    idContratoAntigo = idAntigo;

    // Renovação: dt_inicio posterior + id_contrato_anterior apontando pro
    // contrato antigo (continuidade, spec.md P2 AC2).
    const [{ id_contrato: idRenovacao }] = await runSql<{ id_contrato: number }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status, id_contrato_anterior)
      VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), '2025-02-01', 'ativo', ${idContratoAntigo})
      RETURNING id_contrato;
    `);
    idContratoRenovacao = idRenovacao;
  }, 120000);

  afterAll(async () => {
    const idsContrato = `${idContratoAntigo}, ${idContratoRenovacao}`;
    // id_contrato_anterior é FK -- precisa zerar antes de apagar o contrato
    // referenciado (idContratoAntigo).
    await runSql(`UPDATE fat_contrato SET id_contrato_anterior = NULL WHERE id_contrato = ${idContratoRenovacao};`);
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato IN (${idsContrato});
      DELETE FROM rel_formulario_contrato WHERE id_contrato IN (${idsContrato});
      DELETE FROM dim_planejamento WHERE id_contrato IN (${idsContrato});
    `);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato IN (${idsContrato});`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
    await runSql(`
      DELETE FROM dim_usuario WHERE email IN (${PAPEIS.map((p) => `'${emailDoPapel(p)}'`).join(", ")});
    `);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 120000);

  it("legisla_gestora lê vw_visao_mandato filtrada por id_contratante, ordenada por ordem_contrato, com id_contrato_anterior presente na renovação", async () => {
    const gestora = clientesPorPapel.get("gestora")!;
    const { data, error } = await gestora
      .from("vw_visao_mandato")
      .select("id_contrato, ordem_contrato, id_contrato_anterior, dt_inicio")
      .eq("id_contratante", idContratante)
      .order("ordem_contrato");

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(data![0].id_contrato).toBe(idContratoAntigo);
    expect(data![0].ordem_contrato).toBe(1);
    expect(data![0].id_contrato_anterior).toBeNull();
    expect(data![1].id_contrato).toBe(idContratoRenovacao);
    expect(data![1].ordem_contrato).toBe(2);
    expect(data![1].id_contrato_anterior).toBe(idContratoAntigo);
  });

  it.each(["mentor", "assessor"] as const)(
    "legisla_%s recebe 42501 ao tentar SELECT em vw_visao_mandato",
    async (papel) => {
      const client = clientesPorPapel.get(papel)!;
      const { error } = await client.from("vw_visao_mandato").select("id_contrato").limit(1);
      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
    }
  );
});
