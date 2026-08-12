-- =============================================================================
-- visao-gerencial-g1-g2: T5 -- vw_carteira_ponderada (G1, GG-05/GG-06).
-- design.md, Data Models -- 1 linha por vínculo ativo × contrato ativo, com o
-- peso já resolvido (id_etapa_atual, ou a 1ª etapa do produto quando NULL --
-- mesma leitura do Kanban, spec.md P1 G1 AC4).
--
-- LEFT JOIN ref_peso_etapa (nunca INNER JOIN): preserva a lacuna de seed como
-- peso IS NULL em vez de fazer a linha desaparecer -- spec.md Edge Cases
-- ("nunca assumir peso 1 silenciosamente, isso esconderia a lacuna de seed").
--
-- CREATE OR REPLACE VIEW -- mesmo padrão de vw_carteira/vw_etapa_contrato.
-- =============================================================================

CREATE OR REPLACE VIEW vw_carteira_ponderada WITH (security_invoker = true) AS
SELECT v.id_usuario, u.nome AS nome_usuario, v.papel_no_contrato,
       c.id_contrato, c.id_produto, p.nome AS nome_produto,
       rpe.peso, pl.pct_atingimento
FROM rel_usuario_contrato v
JOIN fat_contrato c           ON c.id_contrato = v.id_contrato
JOIN dim_usuario u             ON u.id_usuario = v.id_usuario
JOIN ref_produto p             ON p.id_produto = c.id_produto
LEFT JOIN ref_peso_etapa rpe   ON rpe.id_etapa = COALESCE(
                                    c.id_etapa_atual,
                                    (SELECT e1.id_etapa FROM ref_etapa e1
                                     WHERE e1.id_produto = c.id_produto AND e1.ordem = 1))
LEFT JOIN dim_planejamento pl  ON pl.id_contrato = c.id_contrato
WHERE c.status = 'ativo' AND (v.dt_fim IS NULL OR v.dt_fim >= CURRENT_DATE);

COMMENT ON VIEW vw_carteira_ponderada IS
'Alimenta G1 (carteira ponderada). Grão fino -- 1 linha por vínculo × contrato; a soma por Gestora/Mentor é agregada em TS (buscarCarteiraPonderada), não aqui, pra não cair na armadilha de recompor soma/mediana de sub-grupos já agregados ao combinar filtros parciais.';
