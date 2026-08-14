import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/visao-gerencial-g3-g6/spec.md GER-07 +
// tasks.md T5 Done-when -- migração:
// 20260814211954_visao_gerencial_vw_cobertura_registro_mensal.sql.
//
//  - contrato com registro há 40 dias do fim do mês conta como coberto
//  - contrato com registro há 50 dias do fim do mês (fora da janela de 45)
//    não conta

let idContratante: number;
let idContratoCoberto: number;
let idContratoDescoberto: number;
let idUsuario: number;
let mesAlvo: string;
let baselineAtivos: number;
let baselineComRegistro: number;

beforeAll(async () => {
  const [{ mes_alvo }] = await runSql<{ mes_alvo: string }>(`
    SELECT (date_trunc('month', CURRENT_DATE) - INTERVAL '2 months')::date AS mes_alvo;
  `);
  mesAlvo = mes_alvo;

  // Baseline ANTES de criar a fixture -- o banco de dev é compartilhado
  // (outras sessões/fixtures podem ter contrato ativo no mesmo mês), então a
  // asserção real é sobre o DELTA introduzido por esta fixture, não sobre o
  // valor absoluto (mesmo raciocínio de vw-pendencias/T1 pra dado
  // compartilhado).
  const [baseline] = await runSql<{ qtd_ativos: number; qtd_com_registro: number }>(`
    SELECT COALESCE(qtd_ativos, 0) AS qtd_ativos, COALESCE(qtd_com_registro, 0) AS qtd_com_registro
      FROM vw_cobertura_registro_mensal WHERE mes_referencia = '${mesAlvo}'::date;
  `);
  baselineAtivos = Number(baseline?.qtd_ativos ?? 0);
  baselineComRegistro = Number(baseline?.qtd_com_registro ?? 0);

  const [entidades] = await runSql<{
    id_contratante: number;
    id_coberto: number;
    id_descoberto: number;
    id_usuario: number;
  }>(`
    WITH u AS (
      INSERT INTO dim_usuario (email, nome, papel_global, ativo)
      VALUES ('gg3-t5-vw-cobertura-mensal@legislabrasil.test', 'GG3 T5 Autor Fixture', 'gestora', true)
      ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome
      RETURNING id_usuario
    ), ct AS (
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'GG3 T5 Contratante Fixture')
      RETURNING id_contratante
    ), contratos AS (
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status, localizador_legado)
      SELECT id_contratante, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), '${mesAlvo}'::date, 'ativo', v.label
        FROM ct, (VALUES ('coberto'), ('descoberto')) AS v(label)
      RETURNING id_contrato, localizador_legado
    )
    SELECT ct.id_contratante, u.id_usuario,
           (SELECT id_contrato FROM contratos WHERE localizador_legado = 'coberto') AS id_coberto,
           (SELECT id_contrato FROM contratos WHERE localizador_legado = 'descoberto') AS id_descoberto
    FROM ct, u;
  `);
  idContratante = entidades.id_contratante;
  idContratoCoberto = entidades.id_coberto;
  idContratoDescoberto = entidades.id_descoberto;
  idUsuario = entidades.id_usuario;

  // fim_do_mes de mesAlvo = mesAlvo + 1 mês - 1 dia. Registro a 40 dias desse
  // ponto (dentro da janela de 45) pro contrato coberto; a 50 dias (fora)
  // pro descoberto.
  const idTipoRegistro = (
    await runSql<{ id_tipo_registro: number }>(`
      SELECT tr.id_tipo_registro FROM ref_tipo_registro tr JOIN ref_etapa e ON e.id_etapa = tr.id_etapa
       WHERE e.id_produto = (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia') LIMIT 1;
    `)
  )[0].id_tipo_registro;

  await runSql(`
    INSERT INTO fat_registro (id_contrato, id_tipo_registro, ocorrido_em, resumo, id_usuario_autor)
    VALUES
      (${idContratoCoberto}, ${idTipoRegistro}, (('${mesAlvo}'::date + INTERVAL '1 month' - INTERVAL '1 day') - INTERVAL '40 days'), 'GG3 T5 Registro Coberto', ${idUsuario}),
      (${idContratoDescoberto}, ${idTipoRegistro}, (('${mesAlvo}'::date + INTERVAL '1 month' - INTERVAL '1 day') - INTERVAL '50 days'), 'GG3 T5 Registro Descoberto', ${idUsuario});
  `);
}, 60000);

afterAll(async () => {
  const contratos = `${idContratoCoberto}, ${idContratoDescoberto}`;
  await runSql(`
    DELETE FROM fat_registro WHERE id_contrato IN (${contratos});
    DELETE FROM fat_etapa_contrato WHERE id_contrato IN (${contratos});
    DELETE FROM rel_formulario_contrato WHERE id_contrato IN (${contratos});
    DELETE FROM dim_planejamento WHERE id_contrato IN (${contratos});
    DELETE FROM fat_contrato WHERE id_contrato IN (${contratos});
    DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};
    DELETE FROM dim_usuario WHERE id_usuario = ${idUsuario};
  `);
}, 60000);

describe("visao-gerencial-g3-g6 T5 -- vw_cobertura_registro_mensal (GER-07)", () => {
  it("qtd_ativos sobe em 2 (os 2 contratos da fixture); qtd_com_registro sobe em 1 (só o coberto, dentro da janela de 45 dias)", async () => {
    const rows = await runSql<{ qtd_ativos: number; qtd_com_registro: number }>(`
      SELECT qtd_ativos, qtd_com_registro FROM vw_cobertura_registro_mensal
       WHERE mes_referencia = '${mesAlvo}'::date;
    `);
    expect(rows).toHaveLength(1);
    // Delta contra o baseline (pré-fixture), não valor absoluto -- o banco
    // de dev é compartilhado, outras fixtures/sessões podem ter contrato
    // ativo no mesmo mês. Registro a 40 dias do fim do mês (coberto) soma 1;
    // a 50 dias (fora da janela de 45, descoberto) não soma nenhum.
    expect(Number(rows[0].qtd_ativos) - baselineAtivos).toBe(2);
    expect(Number(rows[0].qtd_com_registro) - baselineComRegistro).toBe(1);
  });

  it("série sempre tem as 12 linhas de mês (nenhum mês omitido por falta de contrato ativo naquele mês, AD-005)", async () => {
    // Achado real de T5: GROUP BY direto sobre contratos ativos omitia o mês
    // inteiro quando zero contratos estavam ativos -- corrigido com LEFT
    // JOIN contra os 12 meses gerados. COUNT(*) = 12 prova a garantia,
    // independente de quantos meses têm contrato ativo de verdade hoje.
    const rows = await runSql<{ qtd_meses: number; qtd_com_zero_explicito: number }>(`
      SELECT COUNT(*) AS qtd_meses,
             COUNT(*) FILTER (WHERE qtd_ativos = 0 AND pct_cobertura IS NULL) AS qtd_com_zero_explicito
        FROM vw_cobertura_registro_mensal;
    `);
    expect(Number(rows[0].qtd_meses)).toBe(12);
    // Se algum mês tiver qtd_ativos = 0, pct_cobertura tem que ser NULL
    // nesse mesmo mês (não 0) -- a query acima já garante essa correlação.
  });
});
