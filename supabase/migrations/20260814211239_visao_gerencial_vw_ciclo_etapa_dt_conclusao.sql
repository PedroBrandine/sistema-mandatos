-- =============================================================================
-- visao-gerencial-g3-g6 (.specs/features/visao-gerencial-g3-g6/): T3 --
-- vw_ciclo_etapa ganha dt_conclusao (GER-13). Forward-only, CREATE OR REPLACE
-- aditivo -- nenhuma coluna existente é removida ou muda de significado, só
-- soma dt_conclusao (necessária pra bucketizar a evolução mensal de G2 por
-- mês em que o ciclo terminou, tasks.md T3 Done-when).
-- =============================================================================

CREATE OR REPLACE VIEW vw_ciclo_etapa WITH (security_invoker = true) AS
SELECT vec.id_contrato, vec.id_etapa, vec.nome_etapa, vec.ordem,
       c.id_produto, p.nome AS nome_produto,
       v.id_usuario AS id_usuario_gestora, u.nome AS nome_gestora,
       (vec.dt_conclusao - vec.dt_inicio) AS dias_ciclo,
       vec.dt_conclusao
FROM vw_etapa_contrato vec
JOIN fat_contrato c               ON c.id_contrato = vec.id_contrato
JOIN ref_produto p                 ON p.id_produto = c.id_produto
LEFT JOIN rel_usuario_contrato v   ON v.id_contrato = c.id_contrato AND v.papel_no_contrato = 'gestora'
                                     AND (v.dt_fim IS NULL OR v.dt_fim >= CURRENT_DATE)
LEFT JOIN dim_usuario u            ON u.id_usuario = v.id_usuario
WHERE vec.status = 'concluida';

COMMENT ON VIEW vw_ciclo_etapa IS
'Alimenta G2 (tempo de ciclo). Grão fino -- 1 linha por etapa concluída; a mediana por etapa/produto/Gestora é calculada em TS (buscarCicloEtapa), não aqui, pelo mesmo motivo de vw_carteira_ponderada. dt_conclusao (visao-gerencial-g3-g6, T3) bucketiza a evolução mensal de G2 (buscarCicloEtapaMensal) pelo mês em que a etapa terminou.';
