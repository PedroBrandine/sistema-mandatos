import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/planejamento-estrategico-v2/spec.md
//   PLV-06 (criação em lote): AC2 N meses -> N registros com a mesma descrição,
//     o mesmo peso e o mesmo responsável; AC3 cada um independente; AC5
//     nenhum mês marcado -> salvamento recusado; AC6 a cascata roda UMA vez.
//     Edge Case: "criação em lote interrompida no meio não deixa registros
//     parciais -- a operação é atômica".
//   PLV-09 (mover na hierarquia): AC1 mudar a Vinculação da Meta atualiza
//     id_objetivo e marca origem E destino; AC2 idem para o Sucesso Mensal com
//     id_meta; AC4 destino de outro contrato é recusado.
//     Independent Test: "mover uma Meta de 100% do Objetivo A para o B; os dois
//     objetivos ficam marcados como desatualizados e recalculam corretamente".
//   AD-024: as duas funções são SECURITY INVOKER.
//   Design: o limite de 12 meses mora na própria função.

const EMAIL_U1 = "plv-t5-responsavel@legislabrasil.test";
const DOZE_MESES = Array.from({ length: 12 }, (_, i) => `2027-${String(i + 1).padStart(2, "0")}-01`);

interface Fixture {
  idContratante: number;
  idContratoLote: number;
  idContratoMover: number;
  idContratoOutro: number;
  idPlanejamentoLote: number;
  idPlanejamentoMover: number;
  idU1: number;
  idMetaLote1: number;
  idMetaLote2: number;
  idMetaLote3: number;
  idObjetivoA: number;
  idObjetivoB: number;
  idObjetivoZ: number;
  idMetaA: number;
  idMetaX: number;
  idMetaB: number;
  idMeta1: number;
  idMeta2: number;
  idSucessoB: number;
}

let f: Fixture;

function baseJson(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    descricao: "SM do lote",
    peso: 10,
    pct_atingimento: 50,
    ...extra,
  });
}

async function lerMetas(ids: number[]) {
  const linhas = await runSql<{ id_meta: number; pct_atingimento: string | null; id_objetivo: number }>(`
    SELECT id_meta, pct_atingimento, id_objetivo FROM fat_meta WHERE id_meta IN (${ids.join(", ")});
  `);
  return new Map(linhas.map((l) => [l.id_meta, l]));
}

describe("planejamento-estrategico-v2 -- RPCs de lote e de mover (PLV-06/PLV-09, AD-024)", () => {
  beforeAll(async () => {
    const [{ id_usuario: idU1 }] = await runSql<{ id_usuario: number }>(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo)
      VALUES ('${EMAIL_U1}', 'PLV T5 Responsável', 'assessor', true)
      ON CONFLICT (email) DO UPDATE SET ativo = EXCLUDED.ativo
      RETURNING id_usuario;
    `);

    const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'PLV T5 RPCs')
      RETURNING id_contratante;
    `);

    const contratos = await runSql<{ id_contrato: number; localizador_legado: string }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status, localizador_legado)
      SELECT ${idContratante},
             (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'),
             CURRENT_DATE, 'ativo', v.rotulo
        FROM (VALUES ('PLV-T5-lote'), ('PLV-T5-mover'), ('PLV-T5-outro')) AS v(rotulo)
      RETURNING id_contrato, localizador_legado;
    `);
    const idContrato = (rotulo: string) =>
      contratos.find((c) => c.localizador_legado === `PLV-T5-${rotulo}`)!.id_contrato;

    const planejamentos = await runSql<{ localizador_legado: string; id_planejamento: number }>(`
      SELECT c.localizador_legado, p.id_planejamento
        FROM dim_planejamento p JOIN fat_contrato c ON c.id_contrato = p.id_contrato
       WHERE c.id_contrato IN (${contratos.map((c) => c.id_contrato).join(", ")});
    `);
    const idPlan = (rotulo: string) =>
      planejamentos.find((p) => p.localizador_legado === `PLV-T5-${rotulo}`)!.id_planejamento;

    const objetivos = await runSql<{ id_objetivo: number; descricao: string }>(`
      INSERT INTO fat_objetivo_especifico (id_planejamento, descricao)
      VALUES (${idPlan("lote")},  'O-lote-1'),
             (${idPlan("lote")},  'O-lote-2'),
             (${idPlan("lote")},  'O-lote-3'),
             (${idPlan("mover")}, 'O-A'),
             (${idPlan("mover")}, 'O-B'),
             (${idPlan("mover")}, 'O-C'),
             (${idPlan("outro")}, 'O-Z')
      RETURNING id_objetivo, descricao;
    `);
    const obj = Object.fromEntries(objetivos.map((o) => [o.descricao, o.id_objetivo]));

    const metas = await runSql<{ id_meta: number; descricao: string }>(`
      INSERT INTO fat_meta (id_objetivo, descricao, status)
      VALUES (${obj["O-lote-1"]}, 'M-lote-1', 'ativa'),
             (${obj["O-lote-2"]}, 'M-lote-2', 'ativa'),
             (${obj["O-lote-3"]}, 'M-lote-3', 'ativa'),
             (${obj["O-A"]},      'M-A',      'ativa'),
             (${obj["O-A"]},      'M-X',      'ativa'),
             (${obj["O-B"]},      'M-B',      'ativa'),
             (${obj["O-C"]},      'M-1',      'ativa'),
             (${obj["O-C"]},      'M-2',      'ativa'),
             (${obj["O-Z"]},      'M-Z',      'ativa')
      RETURNING id_meta, descricao;
    `);
    const m = Object.fromEntries(metas.map((x) => [x.descricao, x.id_meta]));

    const sucessos = await runSql<{ id_sucesso: number; descricao: string }>(`
      INSERT INTO fat_sucesso_mensal (id_meta, descricao, mes_referencia, peso, pct_atingimento)
      VALUES (${m["M-A"]}, 'SM-A',  '2026-08-01', 100, 100),
             (${m["M-X"]}, 'SM-X',  '2026-08-01', 100, 0),
             (${m["M-B"]}, 'SM-B0', '2026-08-01', 100, 50),
             (${m["M-1"]}, 'SM-a',  '2026-08-01', 100, 100),
             (${m["M-1"]}, 'SM-b',  '2026-08-01', 100, 0),
             (${m["M-2"]}, 'SM-c',  '2026-08-01', 100, 100)
      RETURNING id_sucesso, descricao;
    `);
    const sm = Object.fromEntries(sucessos.map((x) => [x.descricao, x.id_sucesso]));

    f = {
      idContratante,
      idContratoLote: idContrato("lote"),
      idContratoMover: idContrato("mover"),
      idContratoOutro: idContrato("outro"),
      idPlanejamentoLote: idPlan("lote"),
      idPlanejamentoMover: idPlan("mover"),
      idU1,
      idMetaLote1: m["M-lote-1"],
      idMetaLote2: m["M-lote-2"],
      idMetaLote3: m["M-lote-3"],
      idObjetivoA: obj["O-A"],
      idObjetivoB: obj["O-B"],
      idObjetivoZ: obj["O-Z"],
      idMetaA: m["M-A"],
      idMetaX: m["M-X"],
      idMetaB: m["M-B"],
      idMeta1: m["M-1"],
      idMeta2: m["M-2"],
      idSucessoB: sm["SM-b"],
    };
  }, 300000);

  afterAll(async () => {
    const ids = [f.idContratoLote, f.idContratoMover, f.idContratoOutro].join(", ");
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato IN (${ids});
      DELETE FROM rel_formulario_contrato WHERE id_contrato IN (${ids});
      DELETE FROM dim_planejamento WHERE id_contrato IN (${ids});
    `);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato IN (${ids});`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${f.idContratante};`);
    await runSql(`DELETE FROM dim_usuario WHERE email = '${EMAIL_U1}';`);
  }, 300000);

  it(
    "AD-024: as duas RPCs são SECURITY INVOKER -- a RLS do chamador continua valendo",
    async () => {
      const linhas = await runSql<{ proname: string; prosecdef: boolean }>(`
        SELECT p.proname, p.prosecdef
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'app'
           AND p.proname IN ('cria_sucessos_mensais_lote', 'move_item_hierarquia')
         ORDER BY p.proname;
      `);
      expect(linhas.map((l) => l.proname)).toEqual(["cria_sucessos_mensais_lote", "move_item_hierarquia"]);
      expect(linhas.every((l) => l.prosecdef === false)).toBe(true);
    },
    60000
  );

  // --- PLV-06 ------------------------------------------------------------------

  it(
    "PLV-06 AC2/AC6: 3 meses marcados criam 3 registros irmãos (mesma descrição, peso e responsável, meses distintos) e a cascata fecha o número",
    async () => {
      await runSql(`
        SELECT app.cria_sucessos_mensais_lote(
          ${f.idMetaLote1},
          '${baseJson({ id_usuario_responsavel: f.idU1 })}'::jsonb,
          ARRAY['2027-07-01','2027-08-01','2027-09-01']::date[]);
      `);

      const linhas = await runSql<{
        descricao: string;
        peso: string;
        id_usuario_responsavel: number;
        mes_referencia: string;
      }>(`
        SELECT descricao, peso, id_usuario_responsavel, mes_referencia
          FROM fat_sucesso_mensal WHERE id_meta = ${f.idMetaLote1} ORDER BY mes_referencia;
      `);

      expect(linhas).toHaveLength(3);
      expect(linhas.map((l) => l.mes_referencia)).toEqual(["2027-07-01", "2027-08-01", "2027-09-01"]);
      expect(linhas.every((l) => l.descricao === "SM do lote")).toBe(true);
      expect(linhas.every((l) => Number(l.peso) === 10)).toBe(true);
      expect(linhas.every((l) => l.id_usuario_responsavel === f.idU1)).toBe(true);

      // AC6: a cascata rodou e FECHOU (flag limpo, número gravado) dentro da
      // própria chamada -- não ficou pendente de um recálculo posterior.
      const [meta] = await runSql<{ pct_atingimento: string }>(
        `SELECT pct_atingimento FROM fat_meta WHERE id_meta = ${f.idMetaLote1};`
      );
      expect(Number(meta.pct_atingimento)).toBe(50);
      const [plano] = await runSql<{ atingimento_desatualizado: boolean }>(
        `SELECT atingimento_desatualizado FROM dim_planejamento WHERE id_planejamento = ${f.idPlanejamentoLote};`
      );
      expect(plano.atingimento_desatualizado).toBe(false);
    },
    180000
  );

  it(
    "PLV-06 AC6: a cascata é disparada UMA vez para o lote inteiro, não uma por mês",
    async () => {
      // O estado final de N recálculos é idêntico ao de um só (a cascata é
      // idempotente na mesma transação), então nenhuma asserção sobre dados
      // distingue os dois casos. O que distingue é a forma da função: um único
      // INSERT de conjunto e uma única chamada à cascata, depois dele.
      const [{ def }] = await runSql<{ def: string }>(`
        SELECT pg_get_functiondef(p.oid) AS def
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'app' AND p.proname = 'cria_sucessos_mensais_lote';
      `);

      expect(def.match(/recalcula_atingimento/g) ?? []).toHaveLength(1);
      expect(def.match(/INSERT INTO fat_sucesso_mensal/gi) ?? []).toHaveLength(1);
      expect(def).not.toMatch(/\bLOOP\b/i);
    },
    60000
  );

  it(
    "PLV-06 AC3: os registros criados são independentes -- editar um não altera os demais",
    async () => {
      const antes = await runSql<{ id_sucesso: number }>(
        `SELECT id_sucesso FROM fat_sucesso_mensal WHERE id_meta = ${f.idMetaLote1} ORDER BY mes_referencia;`
      );
      expect(antes).toHaveLength(3);

      await runSql(
        `UPDATE fat_sucesso_mensal SET pct_atingimento = 90 WHERE id_sucesso = ${antes[0].id_sucesso};`
      );

      const depois = await runSql<{ id_sucesso: number; pct_atingimento: string }>(
        `SELECT id_sucesso, pct_atingimento FROM fat_sucesso_mensal WHERE id_meta = ${f.idMetaLote1} ORDER BY mes_referencia;`
      );
      expect(Number(depois[0].pct_atingimento)).toBe(90);
      expect(Number(depois[1].pct_atingimento)).toBe(50);
      expect(Number(depois[2].pct_atingimento)).toBe(50);
    },
    120000
  );

  it(
    "PLV-06 (Edge Case): lote que falha no meio não deixa registro parcial",
    async () => {
      // O 2º mês não é dia 1 -- viola ck_sucesso_mes. Como o INSERT é um só
      // statement, os 3 caem juntos.
      await expect(
        runSql(`
          SELECT app.cria_sucessos_mensais_lote(
            ${f.idMetaLote2},
            '${baseJson()}'::jsonb,
            ARRAY['2027-07-01','2027-08-15','2027-09-01']::date[]);
        `)
      ).rejects.toThrow(/23514|ck_sucesso_mes/);

      const [{ total }] = await runSql<{ total: number }>(
        `SELECT count(*)::int AS total FROM fat_sucesso_mensal WHERE id_meta = ${f.idMetaLote2};`
      );
      expect(total).toBe(0);
    },
    120000
  );

  it(
    "PLV-06 AC5: lista de meses vazia é recusada (PLN01), e nada é criado",
    async () => {
      await expect(
        runSql(`
          SELECT app.cria_sucessos_mensais_lote(
            ${f.idMetaLote2}, '${baseJson()}'::jsonb, ARRAY[]::date[]);
        `)
      ).rejects.toThrow(/PLN01/);

      const [{ total }] = await runSql<{ total: number }>(
        `SELECT count(*)::int AS total FROM fat_sucesso_mensal WHERE id_meta = ${f.idMetaLote2};`
      );
      expect(total).toBe(0);
    },
    120000
  );

  it(
    "PLV-06: 13 meses é recusado (PLN02) e 12 passa -- o limite é o que a grade do modal oferece",
    async () => {
      await expect(
        runSql(`
          SELECT app.cria_sucessos_mensais_lote(
            ${f.idMetaLote3}, '${baseJson()}'::jsonb,
            ARRAY[${[...DOZE_MESES, "2028-01-01"].map((d) => `'${d}'`).join(", ")}]::date[]);
        `)
      ).rejects.toThrow(/PLN02/);

      await runSql(`
        SELECT app.cria_sucessos_mensais_lote(
          ${f.idMetaLote3}, '${baseJson()}'::jsonb,
          ARRAY[${DOZE_MESES.map((d) => `'${d}'`).join(", ")}]::date[]);
      `);

      const [{ total }] = await runSql<{ total: number }>(
        `SELECT count(*)::int AS total FROM fat_sucesso_mensal WHERE id_meta = ${f.idMetaLote3};`
      );
      expect(total).toBe(12);
    },
    180000
  );

  // --- PLV-09 ------------------------------------------------------------------

  it(
    "PLV-09 AC1 (Independent Test): mover a Meta de 100% do Objetivo A para o B troca id_objetivo, marca o plano e recalcula os DOIS objetivos",
    async () => {
      await runSql(`SELECT app.recalcula_atingimento(${f.idPlanejamentoMover});`);
      const antes = await runSql<{ id_objetivo: number; pct_atingimento: string }>(`
        SELECT id_objetivo, pct_atingimento FROM fat_objetivo_especifico
         WHERE id_objetivo IN (${f.idObjetivoA}, ${f.idObjetivoB});
      `);
      const pctAntes = new Map(antes.map((o) => [o.id_objetivo, Number(o.pct_atingimento)]));
      expect(pctAntes.get(f.idObjetivoA)).toBe(50); // AVG(M-A 100, M-X 0)
      expect(pctAntes.get(f.idObjetivoB)).toBe(50); // AVG(M-B 50)

      await runSql(`SELECT app.move_item_hierarquia('meta', ${f.idMetaA}, ${f.idObjetivoB});`);

      const metas = await lerMetas([f.idMetaA]);
      expect(metas.get(f.idMetaA)!.id_objetivo).toBe(f.idObjetivoB);

      const [plano] = await runSql<{ atingimento_desatualizado: boolean }>(
        `SELECT atingimento_desatualizado FROM dim_planejamento WHERE id_planejamento = ${f.idPlanejamentoMover};`
      );
      expect(plano.atingimento_desatualizado).toBe(true);

      await runSql(`SELECT app.recalcula_atingimento(${f.idPlanejamentoMover});`);
      const depois = await runSql<{ id_objetivo: number; pct_atingimento: string }>(`
        SELECT id_objetivo, pct_atingimento FROM fat_objetivo_especifico
         WHERE id_objetivo IN (${f.idObjetivoA}, ${f.idObjetivoB});
      `);
      const pctDepois = new Map(depois.map((o) => [o.id_objetivo, Number(o.pct_atingimento)]));
      expect(pctDepois.get(f.idObjetivoA)).toBe(0); // só M-X (0) sobrou na origem
      expect(pctDepois.get(f.idObjetivoB)).toBe(75); // AVG(M-B 50, M-A 100) no destino
    },
    240000
  );

  it(
    "PLV-09 AC2: mover um Sucesso Mensal troca id_meta, marca o plano e recalcula as DUAS metas envolvidas",
    async () => {
      await runSql(`SELECT app.recalcula_atingimento(${f.idPlanejamentoMover});`);
      const antes = await lerMetas([f.idMeta1, f.idMeta2]);
      expect(Number(antes.get(f.idMeta1)!.pct_atingimento)).toBe(50); // SM-a 100 + SM-b 0
      expect(Number(antes.get(f.idMeta2)!.pct_atingimento)).toBe(100); // SM-c 100

      await runSql(`SELECT app.move_item_hierarquia('sucesso', ${f.idSucessoB}, ${f.idMeta2});`);

      const [sucesso] = await runSql<{ id_meta: number }>(
        `SELECT id_meta FROM fat_sucesso_mensal WHERE id_sucesso = ${f.idSucessoB};`
      );
      expect(sucesso.id_meta).toBe(f.idMeta2);

      const [plano] = await runSql<{ atingimento_desatualizado: boolean }>(
        `SELECT atingimento_desatualizado FROM dim_planejamento WHERE id_planejamento = ${f.idPlanejamentoMover};`
      );
      expect(plano.atingimento_desatualizado).toBe(true);

      await runSql(`SELECT app.recalcula_atingimento(${f.idPlanejamentoMover});`);
      const depois = await lerMetas([f.idMeta1, f.idMeta2]);
      expect(Number(depois.get(f.idMeta1)!.pct_atingimento)).toBe(100); // só SM-a
      expect(Number(depois.get(f.idMeta2)!.pct_atingimento)).toBe(50); // SM-c 100 + SM-b 0
    },
    240000
  );

  it(
    "PLV-09 AC4: destino de outro contrato é recusado (PLN03), e nada é movido",
    async () => {
      await expect(
        runSql(`SELECT app.move_item_hierarquia('meta', ${f.idMetaX}, ${f.idObjetivoZ});`)
      ).rejects.toThrow(/PLN03/);

      const metas = await lerMetas([f.idMetaX]);
      expect(metas.get(f.idMetaX)!.id_objetivo).toBe(f.idObjetivoA);
    },
    120000
  );

  it(
    "PLV-09: tipo de item fora de meta|sucesso é recusado (PLN04) -- a RPC atende dois tipos, não três",
    async () => {
      await expect(
        runSql(`SELECT app.move_item_hierarquia('objetivo', ${f.idMetaX}, ${f.idObjetivoB});`)
      ).rejects.toThrow(/PLN04/);
    },
    60000
  );
});
