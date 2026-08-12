-- =============================================================================
-- visao-gerencial-g1-g2: T6 -- vw_ciclo_etapa (G2, GG-03). design.md, Data
-- Models -- view-on-view sobre vw_etapa_contrato (já existe,
-- 20260812001130_regua_instanciacao_estrutura.sql), evita duplicar o JOIN
-- ref_etapa que aquela view já faz.
--
-- 1 linha por etapa CONCLUÍDA (WHERE vec.status = 'concluida'), com produto e
-- Gestora atual denormalizados; dias_ciclo = dt_conclusao - dt_inicio.
--
-- CREATE OR REPLACE VIEW -- mesmo padrão de vw_carteira/vw_carteira_ponderada.
-- =============================================================================

CREATE OR REPLACE VIEW vw_ciclo_etapa WITH (security_invoker = true) AS
SELECT vec.id_contrato, vec.id_etapa, vec.nome_etapa, vec.ordem,
       c.id_produto, p.nome AS nome_produto,
       v.id_usuario AS id_usuario_gestora, u.nome AS nome_gestora,
       (vec.dt_conclusao - vec.dt_inicio) AS dias_ciclo
FROM vw_etapa_contrato vec
JOIN fat_contrato c               ON c.id_contrato = vec.id_contrato
JOIN ref_produto p                 ON p.id_produto = c.id_produto
LEFT JOIN rel_usuario_contrato v   ON v.id_contrato = c.id_contrato AND v.papel_no_contrato = 'gestora'
                                     AND (v.dt_fim IS NULL OR v.dt_fim >= CURRENT_DATE)
LEFT JOIN dim_usuario u            ON u.id_usuario = v.id_usuario
WHERE vec.status = 'concluida';

COMMENT ON VIEW vw_ciclo_etapa IS
'Alimenta G2 (tempo de ciclo). Grão fino -- 1 linha por etapa concluída; a mediana por etapa/produto/Gestora é calculada em TS (buscarCicloEtapa), não aqui, pelo mesmo motivo de vw_carteira_ponderada.';
