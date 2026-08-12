import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: PLM-07/PLM-08/PLM-09 (.specs/features/planejamento-planilha-monitoramento/spec.md,
// migration 20260812145917_planejamento_planilha_cascata.sql) --
//  - AC1: editar um Sucesso Mensal marca dim_planejamento.atingimento_desatualizado=true,
//    sem recalcular a cascata inteira na mesma transação (trigger de statement);
//  - AC2: app.recalcula_atingimento atualiza fat_meta (média PONDERADA por peso dos
//    Sucessos), fat_objetivo_especifico (média SIMPLES das Metas ativas) e
//    dim_planejamento (média SIMPLES dos Objetivos), nessa ordem, e limpa o flag;
//  - AC3: Meta 'pausada'/'descartada' é excluída do cálculo do Objetivo -- só
//    Metas 'ativa' contam (mas a própria Meta pausada ainda tem seu pct_atingimento
//    calculado, só não entra na média do nível acima).
//
// Fixture: 1 planejamento, 2 Objetivos.
//   Objetivo 1: Meta A (ativa, 2 sucessos peso 25/75 -> ponderada 50.00)
//               Meta B (pausada, 1 sucesso peso 100 pct 90 -> própria pct=90.00,
//                       EXCLUÍDA da média do Objetivo 1)
//   Objetivo 2: Meta C (ativa, 1 sucesso peso 100 pct 70 -> ponderada 70.00)
// Esperado: Objetivo1.pct = 50.00 (só Meta A); Objetivo2.pct = 70.00 (só Meta C);
//           Planejamento.pct = ROUND(AVG(50.00, 70.00)) = 60.00.

interface Fixture {
  idContratante: number;
  idContrato: number;
  idPlanejamento: number;
  idObjetivo1: number;
  idObjetivo2: number;
  idMetaA: number;
  idMetaB: number;
  idMetaC: number;
  idSucessoA1: number;
  idSucessoA2: number;
  idSucessoB: number;
  idSucessoC: number;
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

describe("planejamento-planilha-monitoramento -- cascata de atingimento (PLM-07/08/09)", () => {
  beforeAll(async () => {
    const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'PLM Cascata')
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

    const [{ id_objetivo: idObjetivo1 }] = await runSql<{ id_objetivo: number }>(`
      INSERT INTO fat_objetivo_especifico (id_planejamento, descricao) VALUES (${idPlanejamento}, 'Objetivo 1')
      RETURNING id_objetivo;
    `);
    const [{ id_objetivo: idObjetivo2 }] = await runSql<{ id_objetivo: number }>(`
      INSERT INTO fat_objetivo_especifico (id_planejamento, descricao) VALUES (${idPlanejamento}, 'Objetivo 2')
      RETURNING id_objetivo;
    `);

    const [{ id_meta: idMetaA }] = await runSql<{ id_meta: number }>(`
      INSERT INTO fat_meta (id_objetivo, descricao, status) VALUES (${idObjetivo1}, 'Meta A (ativa)', 'ativa')
      RETURNING id_meta;
    `);
    const [{ id_meta: idMetaB }] = await runSql<{ id_meta: number }>(`
      INSERT INTO fat_meta (id_objetivo, descricao, status) VALUES (${idObjetivo1}, 'Meta B (pausada)', 'pausada')
      RETURNING id_meta;
    `);
    const [{ id_meta: idMetaC }] = await runSql<{ id_meta: number }>(`
      INSERT INTO fat_meta (id_objetivo, descricao, status) VALUES (${idObjetivo2}, 'Meta C (ativa)', 'ativa')
      RETURNING id_meta;
    `);

    const [{ id_sucesso: idSucessoA1 }] = await runSql<{ id_sucesso: number }>(`
      INSERT INTO fat_sucesso_mensal (id_meta, descricao, mes_referencia, peso, pct_atingimento)
      VALUES (${idMetaA}, 'A1', '2026-08-01', 25, 80) RETURNING id_sucesso;
    `);
    const [{ id_sucesso: idSucessoA2 }] = await runSql<{ id_sucesso: number }>(`
      INSERT INTO fat_sucesso_mensal (id_meta, descricao, mes_referencia, peso, pct_atingimento)
      VALUES (${idMetaA}, 'A2', '2026-08-01', 75, 40) RETURNING id_sucesso;
    `);
    const [{ id_sucesso: idSucessoB }] = await runSql<{ id_sucesso: number }>(`
      INSERT INTO fat_sucesso_mensal (id_meta, descricao, mes_referencia, peso, pct_atingimento)
      VALUES (${idMetaB}, 'B1', '2026-08-01', 100, 90) RETURNING id_sucesso;
    `);
    const [{ id_sucesso: idSucessoC }] = await runSql<{ id_sucesso: number }>(`
      INSERT INTO fat_sucesso_mensal (id_meta, descricao, mes_referencia, peso, pct_atingimento)
      VALUES (${idMetaC}, 'C1', '2026-08-01', 100, 70) RETURNING id_sucesso;
    `);

    f = {
      idContratante,
      idContrato,
      idPlanejamento,
      idObjetivo1,
      idObjetivo2,
      idMetaA,
      idMetaB,
      idMetaC,
      idSucessoA1,
      idSucessoA2,
      idSucessoB,
      idSucessoC,
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
  }, 120000);

  it("AC1: os INSERTs da fixture já marcaram atingimento_desatualizado=true (trigger de statement, sem recalcular)", async () => {
    const row = await lerPlanejamento(f.idPlanejamento);
    expect(row.atingimento_desatualizado).toBe(true);
    // AC2 ainda não rodou -- pct_atingimento continua NULL (nunca recalculado na mesma transação).
    expect(row.pct_atingimento).toBeNull();
  });

  // Timeout explícito + round-trips combinados (lição de operacao-regua-instanciacao,
  // T5 fix2): cada runSql paga o custo fixo do `supabase db query --linked` via
  // Management API (~4-10s); 7 chamadas sequenciais estouravam os 30s padrão do Vitest.
  it(
    "AC2/AC3: recalcula_atingimento calcula os 3 níveis certos, exclui Meta pausada da média do Objetivo, e limpa o flag",
    async () => {
      await recalcula(f.idPlanejamento);

      const metas = await runSql<{ id_meta: number; pct_atingimento: string }>(`
      SELECT id_meta, pct_atingimento FROM fat_meta WHERE id_meta IN (${f.idMetaA}, ${f.idMetaB}, ${f.idMetaC});
    `);
      const pctPorMeta = new Map(metas.map((m) => [m.id_meta, Number(m.pct_atingimento)]));
      // Meta A (ativa): média ponderada por peso -- (25*80 + 75*40)/100 = 50.
      expect(pctPorMeta.get(f.idMetaA)).toBe(50);
      // Meta B (pausada): tem seu próprio pct calculado (100*90/100 = 90)...
      expect(pctPorMeta.get(f.idMetaB)).toBe(90);
      expect(pctPorMeta.get(f.idMetaC)).toBe(70);

      const objetivos = await runSql<{ id_objetivo: number; pct_atingimento: string }>(`
      SELECT id_objetivo, pct_atingimento FROM fat_objetivo_especifico WHERE id_objetivo IN (${f.idObjetivo1}, ${f.idObjetivo2});
    `);
      const pctPorObjetivo = new Map(objetivos.map((o) => [o.id_objetivo, Number(o.pct_atingimento)]));
      // AC3: Objetivo1 = só Meta A (50) -- Meta B (pausada, 90) fica de fora.
      expect(pctPorObjetivo.get(f.idObjetivo1)).toBe(50);
      expect(pctPorObjetivo.get(f.idObjetivo2)).toBe(70);

      const planejamento = await lerPlanejamento(f.idPlanejamento);
      expect(Number(planejamento.pct_atingimento)).toBe(60); // AVG(50, 70)
      expect(planejamento.atingimento_desatualizado).toBe(false);
    },
    60000
  );

  it(
    "AC1: UPDATE de pct_atingimento marca atingimento_desatualizado de novo",
    async () => {
      await recalcula(f.idPlanejamento); // baseline limpa
      expect((await lerPlanejamento(f.idPlanejamento)).atingimento_desatualizado).toBe(false);

      await runSql(`UPDATE fat_sucesso_mensal SET pct_atingimento = 100 WHERE id_sucesso = ${f.idSucessoA1};`);

      expect((await lerPlanejamento(f.idPlanejamento)).atingimento_desatualizado).toBe(true);
    },
    60000
  );

  it(
    "AC1/AC2: DELETE de um Sucesso Mensal marca desatualizado, e o recálculo reflete a exclusão",
    async () => {
      // A1 já foi atualizado pra 100 no teste anterior -- Meta A agora: (25*100 + 75*40)/100 = 55.
      await recalcula(f.idPlanejamento); // baseline limpa
      expect((await lerPlanejamento(f.idPlanejamento)).atingimento_desatualizado).toBe(false);

      await runSql(`DELETE FROM fat_sucesso_mensal WHERE id_sucesso = ${f.idSucessoA2};`);
      expect((await lerPlanejamento(f.idPlanejamento)).atingimento_desatualizado).toBe(true);

      await recalcula(f.idPlanejamento);
      // Só A1 restante (peso 25, pct 100) -- Meta A vira 100 (a soma de peso não fecha 100
      // depois do DELETE, mas a fórmula não valida isso -- é só alerta de UI, spec.md Edge Cases).
      const [metaA] = await runSql<{ pct_atingimento: string }>(`SELECT pct_atingimento FROM fat_meta WHERE id_meta = ${f.idMetaA};`);
      expect(Number(metaA.pct_atingimento)).toBe(100);
    },
    60000
  );

  it(
    "AC3: reativar a Meta pausada marca desatualizado, e o recálculo passa a incluí-la na média do Objetivo",
    async () => {
      await recalcula(f.idPlanejamento); // baseline limpa
      expect((await lerPlanejamento(f.idPlanejamento)).atingimento_desatualizado).toBe(false);

      await runSql(`UPDATE fat_meta SET status = 'ativa' WHERE id_meta = ${f.idMetaB};`);
      expect((await lerPlanejamento(f.idPlanejamento)).atingimento_desatualizado).toBe(true);

      await recalcula(f.idPlanejamento);
      // Objetivo1 agora = AVG(Meta A=100, Meta B=90) = 95.
      const [objetivo1] = await runSql<{ pct_atingimento: string }>(
        `SELECT pct_atingimento FROM fat_objetivo_especifico WHERE id_objetivo = ${f.idObjetivo1};`
      );
      expect(Number(objetivo1.pct_atingimento)).toBe(95);
    },
    60000
  );
});
