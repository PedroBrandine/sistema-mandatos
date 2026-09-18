import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: PF-03 (.specs/features/pente-fino-2026-09/spec.md, "P1: Prazo
// do Sucesso Mensal relativo ao mês atribuído"):
//   AC1: lote com atribuição em mais de um mês e um prazo informado -> cada
//     mês do lote recebe o MESMO DIA do prazo, aplicado àquele mês (ex.:
//     prazo "dia 10" -> vencimento dia 10 em cada mês atribuído).
//   AC2: atribuição de um único mês -> comportamento de prazo permanece
//     igual ao já existente hoje (sem regressão).
//   Independent Test: lote de 3 meses consecutivos com prazo "dia 10";
//     confirmar vencimento dia 10 em cada mês, não uma única data fixa.
// Migration: 20260918193822_planejamento_prazo_relativo_ao_mes.sql
// (app.cria_sucessos_mensais_lote, T9 de tasks.md).

const EMAIL_U1 = "pf03-responsavel@legislabrasil.test";

interface Fixture {
  idContratante: number;
  idContrato: number;
  idPlanejamento: number;
  idObjetivo: number;
  idMetaTresMeses: number;
  idMetaUmMes: number;
}

let f: Fixture;

function baseJson(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    descricao: "SM prazo relativo",
    peso: 10,
    pct_atingimento: null,
    ...extra,
  });
}

describe("pente-fino-2026-09 -- prazo relativo ao mês em cria_sucessos_mensais_lote (PF-03)", () => {
  beforeAll(async () => {
    await runSql(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo)
      VALUES ('${EMAIL_U1}', 'PF-03 Responsável', 'assessor', true)
      ON CONFLICT (email) DO UPDATE SET ativo = EXCLUDED.ativo;
    `);

    const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'PF-03 Prazo Relativo')
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
      INSERT INTO fat_objetivo_especifico (id_planejamento, descricao) VALUES (${idPlanejamento}, 'Objetivo PF-03')
      RETURNING id_objetivo;
    `);
    const metas = await runSql<{ id_meta: number; descricao: string }>(`
      INSERT INTO fat_meta (id_objetivo, descricao, status)
      VALUES (${idObjetivo}, 'Meta 3 meses', 'ativa'),
             (${idObjetivo}, 'Meta 1 mês',   'ativa')
      RETURNING id_meta, descricao;
    `);
    const m = Object.fromEntries(metas.map((x) => [x.descricao, x.id_meta]));

    f = {
      idContratante,
      idContrato,
      idPlanejamento,
      idObjetivo,
      idMetaTresMeses: m["Meta 3 meses"],
      idMetaUmMes: m["Meta 1 mês"],
    };
  }, 120000);

  afterAll(async () => {
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato = ${f.idContrato};
      DELETE FROM rel_formulario_contrato WHERE id_contrato = ${f.idContrato};
      DELETE FROM dim_planejamento WHERE id_contrato = ${f.idContrato};
    `);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${f.idContrato};`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${f.idContratante};`);
    await runSql(`DELETE FROM dim_usuario WHERE email = '${EMAIL_U1}';`);
  }, 120000);

  it(
    "AC1/Independent Test: lote de 3 meses consecutivos com prazo dia 10 gera vencimento dia 10 em CADA mês",
    async () => {
      await runSql(`
        SELECT app.cria_sucessos_mensais_lote(
          ${f.idMetaTresMeses},
          '${baseJson({ dt_limite: "2026-07-10" })}'::jsonb,
          ARRAY['2026-07-01','2026-08-01','2026-09-01']::date[]);
      `);

      const linhas = await runSql<{ mes_referencia: string; dt_limite: string }>(`
        SELECT mes_referencia, dt_limite FROM fat_sucesso_mensal
         WHERE id_meta = ${f.idMetaTresMeses} ORDER BY mes_referencia;
      `);

      expect(linhas).toHaveLength(3);
      expect(linhas.map((l) => l.dt_limite)).toEqual(["2026-07-10", "2026-08-10", "2026-09-10"]);
    },
    120000
  );

  it(
    "AC2: lote de 1 mês mantém o comportamento atual, sem regressão (prazo do próprio mês preservado)",
    async () => {
      await runSql(`
        SELECT app.cria_sucessos_mensais_lote(
          ${f.idMetaUmMes},
          '${baseJson({ dt_limite: "2026-11-20" })}'::jsonb,
          ARRAY['2026-11-01']::date[]);
      `);

      const [linha] = await runSql<{ mes_referencia: string; dt_limite: string }>(`
        SELECT mes_referencia, dt_limite FROM fat_sucesso_mensal WHERE id_meta = ${f.idMetaUmMes};
      `);

      expect(linha.mes_referencia).toBe("2026-11-01");
      expect(linha.dt_limite).toBe("2026-11-20");
    },
    120000
  );
});
