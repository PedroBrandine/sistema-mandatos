import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/planejamento-estrategico-v2/spec.md
//   PLV-13 (Evolução mensal): AC1 séries acumuladas Esperado/Atingido por mês;
//     AC4 SM de Meta não-ativa fora das DUAS séries; AC5 filtro por responsável
//     com P recalculado sobre o subconjunto; AC6 pct nulo conta 0;
//     AC7 P=0 devolve estado vazio, nunca linha em 0%; AC8 Esperado vai até o
//     último mês com SM e Atingido para no mês corrente.
//     Independent Test: "2 SMs de peso 50 (ago e set), ago a 100% e set a 0% --
//     Esperado(ago)=50, Atingido(ago)=50, Esperado(set)=100, Atingido(set)=50".
//   PLV-11 (KPIs): AC2 vêm de view; AC4 plano sem nenhuma Meta exibe '—', não 0.
//     "METAS PRIORITÁRIAS N de M": M = Metas ativas, N = ativas com prioridade alta.
//   PLV-12 (Atraso): a T4 NÃO cria coluna nova. vw_sucesso_mensal já expõe o par
//     dias_atraso + esta_atrasado, e esta_atrasado já é a regra da AC1. O que
//     esta suíte guarda aqui é que o par continua INTACTO (há consumidor vivo em
//     buscarGradeSucessosMensais) e como cada um se comporta nos 5 casos -- é o
//     contrato de entrada da derivação que a T9 faz em TypeScript.
//   PLV-03 AC2: a grade precisa poder exibir o responsável do próprio SM.
//
// Os meses são relativos a CURRENT_DATE (M-1 / M0 / M+1) de propósito: o
// Independent Test da spec cita ago/set 2026, mas datas fixas transformariam
// AC8 ("Atingido para no mês corrente") num teste que expira.

const ROTULO = "PLV-T4";
const EMAIL_U1 = "plv-t4-u1@legislabrasil.test";
const EMAIL_U2 = "plv-t4-u2@legislabrasil.test";

const PLANOS = [
  "serie",
  "futuro",
  "metaInativa",
  "pctNulo",
  "pesoZero",
  "semSm",
  "responsavel",
  "atraso",
  "kpiCheio",
  "kpiVazio",
] as const;
type Plano = (typeof PLANOS)[number];

interface Fixture {
  idContratante: number;
  idsContrato: number[];
  plano: Record<Plano, number>;
  idU1: number;
  idU2: number;
  mesAnterior: string;
  mesCorrente: string;
  mesProximo: string;
}

let f: Fixture;

async function serie(idPlanejamento: number, idResponsavel: number | null = null) {
  const escopo =
    idResponsavel === null
      ? "escopo_responsavel = false"
      : `escopo_responsavel = true AND id_usuario_responsavel = ${idResponsavel}`;
  return runSql<{ mes: string; pct_esperado: string | null; pct_atingido: string | null }>(`
    SELECT mes, pct_esperado, pct_atingido
      FROM vw_planejamento_evolucao_mensal
     WHERE id_planejamento = ${idPlanejamento} AND ${escopo}
     ORDER BY mes;
  `);
}

function num(valor: string | null): number | null {
  return valor === null ? null : Number(valor);
}

describe("planejamento-estrategico-v2 -- views de KPI, evolução mensal e atraso (PLV-11/12/13)", () => {
  beforeAll(async () => {
    const [meses] = await runSql<{ m_anterior: string; m_corrente: string; m_proximo: string }>(`
      SELECT (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date AS m_anterior,
              date_trunc('month', CURRENT_DATE)::date                       AS m_corrente,
             (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date AS m_proximo;
    `);

    const usuarios = await runSql<{ id_usuario: number; email: string }>(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo)
      VALUES ('${EMAIL_U1}', 'PLV T4 Assessor 1', 'assessor', true),
             ('${EMAIL_U2}', 'PLV T4 Assessor 2', 'assessor', true)
      ON CONFLICT (email) DO UPDATE SET ativo = EXCLUDED.ativo
      RETURNING id_usuario, email;
    `);
    const idU1 = usuarios.find((u) => u.email === EMAIL_U1)!.id_usuario;
    const idU2 = usuarios.find((u) => u.email === EMAIL_U2)!.id_usuario;

    const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'PLV T4 Views')
      RETURNING id_contratante;
    `);

    // localizador_legado carrega o rótulo do plano -- é coluna livre da tabela
    // e o RETURNING do INSERT só devolve colunas da própria tabela.
    const contratos = await runSql<{ id_contrato: number; localizador_legado: string }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status, localizador_legado)
      SELECT ${idContratante},
             (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'),
             CURRENT_DATE, 'ativo', v.rotulo
        FROM (VALUES ${PLANOS.map((p) => `('${ROTULO}-${p}')`).join(", ")}) AS v(rotulo)
      RETURNING id_contrato, localizador_legado;
    `);
    const idsContrato = contratos.map((c) => c.id_contrato);

    const planejamentos = await runSql<{ localizador_legado: string; id_planejamento: number }>(`
      SELECT c.localizador_legado, p.id_planejamento
        FROM dim_planejamento p JOIN fat_contrato c ON c.id_contrato = p.id_contrato
       WHERE c.id_contrato IN (${idsContrato.join(", ")});
    `);
    const plano = Object.fromEntries(
      planejamentos.map((p) => [p.localizador_legado.replace(`${ROTULO}-`, ""), p.id_planejamento])
    ) as Record<Plano, number>;

    const objetivos = await runSql<{ id_objetivo: number; descricao: string }>(`
      INSERT INTO fat_objetivo_especifico (id_planejamento, descricao)
      VALUES ${PLANOS.map((p) => `(${plano[p]}, 'O-${p}')`).join(", ")}
      RETURNING id_objetivo, descricao;
    `);
    const obj = Object.fromEntries(objetivos.map((o) => [o.descricao, o.id_objetivo]));

    const metas = await runSql<{ id_meta: number; descricao: string }>(`
      INSERT INTO fat_meta (id_objetivo, descricao, status, prioridade)
      VALUES (${obj["O-serie"]},       'M-serie',               'ativa',   NULL),
             (${obj["O-futuro"]},      'M-futuro',              'ativa',   NULL),
             (${obj["O-metaInativa"]}, 'M-mi-ativa',            'ativa',   NULL),
             (${obj["O-metaInativa"]}, 'M-mi-pausada',          'pausada', NULL),
             (${obj["O-pctNulo"]},     'M-pctNulo',             'ativa',   NULL),
             (${obj["O-pesoZero"]},    'M-pesoZero',            'ativa',   NULL),
             (${obj["O-semSm"]},       'M-semSm',               'ativa',   NULL),
             (${obj["O-responsavel"]}, 'M-responsavel',         'ativa',   NULL),
             (${obj["O-atraso"]},      'M-atraso',              'ativa',   NULL),
             (${obj["O-kpiCheio"]},    'M-kpi-alta-1',          'ativa',   'alta'),
             (${obj["O-kpiCheio"]},    'M-kpi-alta-2',          'ativa',   'alta'),
             (${obj["O-kpiCheio"]},    'M-kpi-media',           'ativa',   'media'),
             (${obj["O-kpiCheio"]},    'M-kpi-pausada-alta',    'pausada', 'alta')
      RETURNING id_meta, descricao;
    `);
    const m = Object.fromEntries(metas.map((x) => [x.descricao, x.id_meta]));

    await runSql(`
      INSERT INTO fat_sucesso_mensal (id_meta, descricao, mes_referencia, peso, pct_atingimento, status, dt_limite, id_usuario_responsavel)
      VALUES
        (${m["M-serie"]},       'SM-serie-1',              '${meses.m_anterior}', 50, 100,  'pendente', NULL, NULL),
        (${m["M-serie"]},       'SM-serie-2',              '${meses.m_corrente}', 50, 0,    'pendente', NULL, NULL),
        (${m["M-futuro"]},      'SM-fut-1',                '${meses.m_corrente}', 50, 100,  'pendente', NULL, NULL),
        (${m["M-futuro"]},      'SM-fut-2',                '${meses.m_proximo}',  50, 0,    'pendente', NULL, NULL),
        (${m["M-mi-ativa"]},    'SM-mi-ativa',             '${meses.m_corrente}', 50, 100,  'pendente', NULL, NULL),
        (${m["M-mi-pausada"]},  'SM-mi-pausada',           '${meses.m_corrente}', 50, 0,    'pendente', NULL, NULL),
        (${m["M-pctNulo"]},     'SM-pn-1',                 '${meses.m_anterior}', 50, 100,  'pendente', NULL, NULL),
        (${m["M-pctNulo"]},     'SM-pn-2',                 '${meses.m_corrente}', 50, NULL, 'pendente', NULL, NULL),
        (${m["M-pesoZero"]},    'SM-pz',                   '${meses.m_corrente}',  0, 40,   'pendente', NULL, NULL),
        (${m["M-responsavel"]}, 'SM-r-u1',                 '${meses.m_anterior}', 30, 100,  'pendente', NULL, ${idU1}),
        (${m["M-responsavel"]}, 'SM-r-u2',                 '${meses.m_anterior}', 70, 0,    'pendente', NULL, ${idU2}),
        (${m["M-atraso"]},      'SM-at-pendente-vencido',  '${meses.m_corrente}', 10, NULL, 'pendente',  CURRENT_DATE - 5, NULL),
        (${m["M-atraso"]},      'SM-at-realizado-vencido', '${meses.m_corrente}', 10, NULL, 'realizado', CURRENT_DATE - 5, NULL),
        (${m["M-atraso"]},      'SM-at-sem-prazo',         '${meses.m_corrente}', 10, NULL, 'pendente',  NULL, NULL),
        (${m["M-atraso"]},      'SM-at-no-prazo',          '${meses.m_corrente}', 10, NULL, 'pendente',  CURRENT_DATE + 5, NULL),
        (${m["M-atraso"]},      'SM-at-vence-hoje',        '${meses.m_corrente}', 10, NULL, 'pendente',  CURRENT_DATE, NULL),
        (${m["M-kpi-alta-1"]},  'SM-kpi-1',                '${meses.m_corrente}', 50, 100,  'pendente', NULL, NULL),
        (${m["M-kpi-alta-1"]},  'SM-kpi-2',                '${meses.m_corrente}', 50, 0,    'pendente', NULL, NULL);
    `);

    // Os KPIs leem pct_atingimento de dim_planejamento (AD-003: o número vem da
    // cascata, a view não recalcula nada) -- sem recalcular, os dois planos de
    // KPI ficariam com pct nulo por nunca terem sido calculados, e o teste de
    // AC4 não distinguiria "sem Meta" de "nunca recalculado".
    await runSql(`
      SELECT app.recalcula_atingimento(${plano.kpiCheio});
      SELECT app.recalcula_atingimento(${plano.kpiVazio});
    `);

    f = {
      idContratante,
      idsContrato,
      plano,
      idU1,
      idU2,
      mesAnterior: meses.m_anterior,
      mesCorrente: meses.m_corrente,
      mesProximo: meses.m_proximo,
    };
  }, 300000);

  afterAll(async () => {
    const ids = f.idsContrato.join(", ");
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato IN (${ids});
      DELETE FROM rel_formulario_contrato WHERE id_contrato IN (${ids});
      DELETE FROM dim_planejamento WHERE id_contrato IN (${ids});
    `);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato IN (${ids});`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${f.idContratante};`);
    await runSql(`DELETE FROM dim_usuario WHERE email IN ('${EMAIL_U1}', '${EMAIL_U2}');`);
  }, 300000);

  // --- PLV-13 -----------------------------------------------------------------

  it(
    "PLV-13 AC1 (Independent Test): 2 SMs de peso 50, o anterior a 100% e o corrente a 0% -- Esperado 50/100, Atingido 50/50",
    async () => {
      const linhas = await serie(f.plano.serie);

      expect(linhas.map((l) => l.mes)).toEqual([f.mesAnterior, f.mesCorrente]);
      expect(num(linhas[0].pct_esperado)).toBe(50);
      expect(num(linhas[0].pct_atingido)).toBe(50);
      expect(num(linhas[1].pct_esperado)).toBe(100);
      expect(num(linhas[1].pct_atingido)).toBe(50);
    },
    90000
  );

  it(
    "PLV-13 AC8: Esperado alcança o último mês com SM; Atingido para no mês corrente (mês futuro fica NULL)",
    async () => {
      const linhas = await serie(f.plano.futuro);

      expect(linhas.map((l) => l.mes)).toEqual([f.mesCorrente, f.mesProximo]);
      expect(num(linhas[0].pct_atingido)).toBe(50);
      expect(num(linhas[1].pct_esperado)).toBe(100);
      expect(linhas[1].pct_atingido).toBeNull();
    },
    90000
  );

  it(
    "PLV-13 AC4: SM de Meta não-ativa fica fora das DUAS séries -- P é só o peso da Meta ativa",
    async () => {
      const linhas = await serie(f.plano.metaInativa);

      expect(linhas).toHaveLength(1);
      // Se o SM da Meta pausada entrasse, P seria 100 e o Atingido cairia para 50.
      expect(num(linhas[0].pct_esperado)).toBe(100);
      expect(num(linhas[0].pct_atingido)).toBe(100);
    },
    90000
  );

  it(
    "PLV-13 AC6: SM sem pct_atingimento conta como 0 no Atingido (mesmo COALESCE da cascata), sem sair do Esperado",
    async () => {
      const linhas = await serie(f.plano.pctNulo);

      expect(linhas.map((l) => l.mes)).toEqual([f.mesAnterior, f.mesCorrente]);
      expect(num(linhas[1].pct_esperado)).toBe(100);
      expect(num(linhas[1].pct_atingido)).toBe(50);
    },
    90000
  );

  it(
    "PLV-13 AC7: P=0 (todos os pesos zerados) devolve NULL nas duas séries, nunca uma linha em 0%",
    async () => {
      const linhas = await serie(f.plano.pesoZero);

      expect(linhas).toHaveLength(1);
      expect(linhas[0].pct_esperado).toBeNull();
      expect(linhas[0].pct_atingido).toBeNull();
    },
    90000
  );

  it(
    "PLV-13 AC7: plano sem nenhum Sucesso Mensal não produz linha alguma",
    async () => {
      expect(await serie(f.plano.semSm)).toHaveLength(0);
    },
    90000
  );

  it(
    "PLV-13 AC5: o filtro por responsável recalcula P sobre o subconjunto -- não reaproveita o P do plano",
    async () => {
      const total = await serie(f.plano.responsavel);
      expect(total).toHaveLength(1);
      expect(num(total[0].pct_esperado)).toBe(100);
      expect(num(total[0].pct_atingido)).toBe(30); // (30*100)/100

      // P de U1 é 30, não 100: o SM dele está 100% atingido, então a série dele
      // marca 100. Se o P do plano fosse reaproveitado, daria 30.
      const u1 = await serie(f.plano.responsavel, f.idU1);
      expect(u1).toHaveLength(1);
      expect(num(u1[0].pct_esperado)).toBe(100);
      expect(num(u1[0].pct_atingido)).toBe(100);

      // P de U2 é 70, e o SM dele está a 0%.
      const u2 = await serie(f.plano.responsavel, f.idU2);
      expect(u2).toHaveLength(1);
      expect(num(u2[0].pct_esperado)).toBe(100);
      expect(num(u2[0].pct_atingido)).toBe(0);
    },
    120000
  );

  // --- PLV-12 -----------------------------------------------------------------

  it(
    "T4: a view da grade segue com dias_atraso e esta_atrasado INALTERADOS -- nenhuma coluna de atraso nova (a derivação é da T9)",
    async () => {
      const colunas = await runSql<{ column_name: string }>(`
        SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'vw_sucesso_mensal'
           AND column_name IN ('dias_atraso', 'esta_atrasado', 'atraso_dias')
         ORDER BY column_name;
      `);
      expect(colunas.map((c) => c.column_name)).toEqual(["dias_atraso", "esta_atrasado"]);

      // O par existente já carrega a regra de PLV-12 AC1: esta_atrasado é
      // verdadeiro só com status pendente E dt_limite vencido. dias_atraso
      // continua devolvendo 0 sem dt_limite (GREATEST ignora NULL) -- é
      // exatamente por isso que a T9 combina os dois em vez de ler um só.
      const linhas = await runSql<{ descricao: string; dias_atraso: number; esta_atrasado: boolean }>(`
        SELECT descricao, dias_atraso, esta_atrasado FROM vw_sucesso_mensal
         WHERE descricao LIKE 'SM-at-%' AND id_meta IN (
           SELECT m.id_meta FROM fat_meta m
             JOIN fat_objetivo_especifico o ON o.id_objetivo = m.id_objetivo
            WHERE o.id_planejamento = ${f.plano.atraso})
         ORDER BY descricao;
      `);
      const por = new Map(linhas.map((l) => [l.descricao, l]));

      expect(por.get("SM-at-pendente-vencido")).toMatchObject({ dias_atraso: 5, esta_atrasado: true });
      expect(por.get("SM-at-realizado-vencido")).toMatchObject({ dias_atraso: 5, esta_atrasado: false });
      expect(por.get("SM-at-no-prazo")).toMatchObject({ dias_atraso: 0, esta_atrasado: false });
      expect(por.get("SM-at-vence-hoje")).toMatchObject({ dias_atraso: 0, esta_atrasado: false });
      // Sem dt_limite os DOIS lados mentem de um jeito próprio: dias_atraso dá 0
      // (GREATEST ignora NULL) e esta_atrasado dá NULL, não false (comparação
      // com NULL é NULL). A T9 tem de tratar o nulo como "não atrasado" --
      // `esta_atrasado ? dias_atraso : null` faz isso, porque null é falsy.
      expect(por.get("SM-at-sem-prazo")).toMatchObject({ dias_atraso: 0, esta_atrasado: null });
    },
    90000
  );

  it(
    "PLV-03 AC2: a view da grade expõe o responsável próprio do Sucesso Mensal",
    async () => {
      const linhas = await runSql<{ descricao: string; id_usuario_responsavel: number | null }>(`
        SELECT descricao, id_usuario_responsavel FROM vw_sucesso_mensal
         WHERE descricao IN ('SM-r-u1', 'SM-r-u2', 'SM-at-sem-prazo')
           AND id_meta IN (
             SELECT m.id_meta FROM fat_meta m
               JOIN fat_objetivo_especifico o ON o.id_objetivo = m.id_objetivo
              WHERE o.id_planejamento IN (${f.plano.responsavel}, ${f.plano.atraso}))
         ORDER BY descricao;
      `);
      const resp = new Map(linhas.map((l) => [l.descricao, l.id_usuario_responsavel]));

      expect(resp.get("SM-r-u1")).toBe(f.idU1);
      expect(resp.get("SM-r-u2")).toBe(f.idU2);
      expect(resp.get("SM-at-sem-prazo")).toBeNull();
    },
    90000
  );

  // --- PLV-11 -----------------------------------------------------------------

  it(
    "PLV-11: os KPIs saem da view -- 3 Metas ativas, 2 delas de prioridade alta (a pausada de prioridade alta não conta em nenhum dos dois), 2 Sucessos Mensais",
    async () => {
      const [kpi] = await runSql<{
        pct_atingimento: string | null;
        metas_ativas: number;
        metas_prioritarias: number;
        sucessos_mensais: number;
      }>(`
        SELECT pct_atingimento, metas_ativas, metas_prioritarias, sucessos_mensais
          FROM vw_planejamento_kpi WHERE id_planejamento = ${f.plano.kpiCheio};
      `);

      expect(kpi.metas_ativas).toBe(3);
      expect(kpi.metas_prioritarias).toBe(2);
      expect(kpi.sucessos_mensais).toBe(2);
      // Cascata: Meta alta-1 = (50*100 + 50*0)/100 = 50; alta-2 e media sem SM = NULL
      // -> Objetivo = AVG(50, 0, 0) = 16.67 -> plano = 16.67.
      expect(num(kpi.pct_atingimento)).toBe(16.67);
    },
    90000
  );

  it(
    "PLV-11 AC4: plano sem nenhuma Meta devolve NULL em todos os KPIs -- inclusive no atingimento, que na tabela está 0",
    async () => {
      const [kpi] = await runSql<{
        pct_atingimento: string | null;
        metas_ativas: number | null;
        metas_prioritarias: number | null;
        sucessos_mensais: number | null;
        pct_na_tabela: string | null;
      }>(`
        SELECT v.pct_atingimento, v.metas_ativas, v.metas_prioritarias, v.sucessos_mensais,
               p.pct_atingimento AS pct_na_tabela
          FROM vw_planejamento_kpi v
          JOIN dim_planejamento p ON p.id_planejamento = v.id_planejamento
         WHERE v.id_planejamento = ${f.plano.kpiVazio};
      `);

      expect(kpi.metas_ativas).toBeNull();
      expect(kpi.metas_prioritarias).toBeNull();
      expect(kpi.sucessos_mensais).toBeNull();
      // A cascata gravou 0 na tabela (AVG sobre um Objetivo ativo de pct nulo);
      // a view é que recusa exibir 0 onde não há Meta para medir (AD-005).
      expect(num(kpi.pct_na_tabela)).toBe(0);
      expect(kpi.pct_atingimento).toBeNull();
    },
    90000
  );
});
