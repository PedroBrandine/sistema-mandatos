import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/visao-gerencial-g3-g6/spec.md GER-07 +
// tasks.md T5 Done-when -- migração:
// 20260814213130_visao_gerencial_fix_grao_fino_evolucao_mensal.sql
// (substitui a definição original de 20260814211954 -- achado real ao
// implementar T9: grão fino por contrato, não pré-agregado por mês, pra
// permitir filtrar pela barra de recorte antes de agregar em TS).
//
//  - contrato com registro há 40 dias do fim do mês -> tem_registro = true
//  - contrato com registro há 50 dias do fim do mês (fora da janela de 45)
//    -> tem_registro = false
//  - contrato só existe na linha do mês em que estava ativo (não antes de
//    dt_inicio)

let idContratante: number;
let idContratoCoberto: number;
let idContratoDescoberto: number;
let idUsuario: number;
let mesAlvo: string;

beforeAll(async () => {
  const [{ mes_alvo }] = await runSql<{ mes_alvo: string }>(`
    SELECT (date_trunc('month', CURRENT_DATE) - INTERVAL '2 months')::date AS mes_alvo;
  `);
  mesAlvo = mes_alvo;

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

describe("visao-gerencial-g3-g6 T5 -- vw_cobertura_registro_mensal (GER-07, grão fino)", () => {
  it("contrato coberto (registro a 40 dias do fim do mês) -> tem_registro = true; descoberto (50 dias) -> false", async () => {
    const rows = await runSql<{ id_contrato: number; tem_registro: boolean }>(`
      SELECT id_contrato, tem_registro FROM vw_cobertura_registro_mensal
       WHERE mes_referencia = '${mesAlvo}'::date AND id_contrato IN (${idContratoCoberto}, ${idContratoDescoberto})
       ORDER BY id_contrato;
    `);
    expect(rows).toHaveLength(2);
    const porContrato = Object.fromEntries(rows.map((r) => [r.id_contrato, r.tem_registro]));
    expect(porContrato[idContratoCoberto]).toBe(true);
    expect(porContrato[idContratoDescoberto]).toBe(false);
  });

  it("id_produto vem preenchido -- necessário pra filtrar por FiltroRecorte na camada TS", async () => {
    const rows = await runSql<{ id_produto: number }>(`
      SELECT DISTINCT id_produto FROM vw_cobertura_registro_mensal
       WHERE mes_referencia = '${mesAlvo}'::date AND id_contrato = ${idContratoCoberto};
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].id_produto).not.toBeNull();
  });

  it("contrato não aparece em mês anterior a dt_inicio", async () => {
    const rows = await runSql<{ id_contrato: number }>(`
      SELECT id_contrato FROM vw_cobertura_registro_mensal
       WHERE mes_referencia = ('${mesAlvo}'::date - INTERVAL '1 month')::date AND id_contrato = ${idContratoCoberto};
    `);
    expect(rows).toHaveLength(0);
  });
});
