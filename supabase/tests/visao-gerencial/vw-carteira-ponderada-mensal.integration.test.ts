import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/visao-gerencial-g3-g6/spec.md GER-12 +
// tasks.md T4 Done-when -- migração:
// 20260814211638_visao_gerencial_vw_carteira_ponderada_mensal.sql.
// EXPLAIN ANALYZE rodado ao vivo antes desta task (Execution Time: 1.201ms,
// ~194 linhas em fat_etapa_contrato hoje -- registrado no commit).
//
//  - Etapa "current" num mês do meio da série tem peso != em meses vizinhos
//    (contrato concluiu a etapa antes do mês seguinte começar -- deixa de
//    contar nos meses seguintes, tasks.md T4 Done-when)

let idContratante: number;
let idContrato: number;
let idUsuario: number;
let mesAlvo: string;

beforeAll(async () => {
  const [ctx] = await runSql<{ mes_alvo: string; peso_pontape: number; id_etapa_pontape: number }>(`
    SELECT
      (date_trunc('month', CURRENT_DATE) - INTERVAL '2 months')::date AS mes_alvo,
      pe.peso AS peso_pontape,
      e.id_etapa AS id_etapa_pontape
    FROM ref_etapa e
    JOIN ref_peso_etapa pe ON pe.id_etapa = e.id_etapa
    WHERE e.id_produto = (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia') AND e.codigo = 'pontape';
  `);
  mesAlvo = ctx.mes_alvo;

  const [entidades] = await runSql<{ id_contratante: number; id_contrato: number; id_usuario: number }>(`
    WITH u AS (
      INSERT INTO dim_usuario (email, nome, papel_global, ativo)
      VALUES ('gg3-t4-vw-carteira-mensal@legislabrasil.test', 'GG3 T4 Gestora Fixture', 'gestora', true)
      ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome
      RETURNING id_usuario
    ), ct AS (
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'GG3 T4 Contratante Fixture')
      RETURNING id_contratante
    ), c AS (
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      SELECT id_contratante, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), '${mesAlvo}'::date, 'ativo'
      FROM ct
      RETURNING id_contrato
    ), ruc AS (
      INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato, dt_inicio)
      SELECT (SELECT id_contrato FROM c), (SELECT id_usuario FROM u), 'gestora', '${mesAlvo}'::date
    )
    SELECT ct.id_contratante, c.id_contrato, u.id_usuario FROM ct, c, u;
  `);
  idContratante = entidades.id_contratante;
  idContrato = entidades.id_contrato;
  idUsuario = entidades.id_usuario;

  // Etapa "pontape" ativa só durante mesAlvo: começou no 1º dia de mesAlvo,
  // concluiu no 1º dia do mês seguinte -- não conta no mês anterior (ainda
  // não tinha começado) nem no mês seguinte (já tinha concluído antes do fim
  // dele).
  await runSql(`
    UPDATE fat_etapa_contrato SET dt_inicio = '${mesAlvo}'::date,
           dt_conclusao = ('${mesAlvo}'::date + INTERVAL '1 month')::date
     WHERE id_contrato = ${idContrato} AND id_etapa = ${ctx.id_etapa_pontape};
  `);
}, 60000);

afterAll(async () => {
  await runSql(`
    DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};
    DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};
    DELETE FROM dim_planejamento WHERE id_contrato = ${idContrato};
    DELETE FROM rel_usuario_contrato WHERE id_contrato = ${idContrato};
    DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};
    DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};
    DELETE FROM dim_usuario WHERE id_usuario = ${idUsuario};
  `);
}, 60000);

describe("visao-gerencial-g3-g6 T4 -- vw_carteira_ponderada_mensal (GER-12)", () => {
  it("mesAlvo tem 1 linha com o peso da etapa; mês anterior e mês seguinte não têm nenhuma", async () => {
    const rows = await runSql<{ mes_referencia: string; peso: number; qtd: number }>(`
      SELECT mes_referencia::text, peso, COUNT(*) OVER () AS qtd
        FROM vw_carteira_ponderada_mensal
       WHERE id_contrato = ${idContrato};
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].peso).not.toBeNull();

    const antesDepois = await runSql<{ tem_linha: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM vw_carteira_ponderada_mensal
         WHERE id_contrato = ${idContrato}
           AND mes_referencia IN (('${mesAlvo}'::date - INTERVAL '1 month')::date, ('${mesAlvo}'::date + INTERVAL '1 month')::date)
      ) AS tem_linha;
    `);
    expect(antesDepois[0].tem_linha).toBe(false);
  });

  it("id_usuario_gestora resolve o vínculo ativo naquele mês", async () => {
    const rows = await runSql<{ id_usuario_gestora: number }>(`
      SELECT id_usuario_gestora FROM vw_carteira_ponderada_mensal WHERE id_contrato = ${idContrato};
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].id_usuario_gestora).toBe(idUsuario);
  });
});
