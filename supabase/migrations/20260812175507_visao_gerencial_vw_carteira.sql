-- =============================================================================
-- visao-gerencial-g1-g2: T4 -- vw_carteira, versão REDUZIDA (AD-032 +
-- adendo em .specs/STATE.md, 2026-08-12). Pré-requisito técnico de G1.
--
-- A definição aprovada (docs/schema_sistema.sql:1327-1349) tem 2 dependências
-- que fazem CREATE VIEW falhar hoje, nenhuma provisionada ainda (só chegam na
-- onda de Incidência, roadmap §6.2):
--   - LEFT JOIN mv_iip_contrato (colunas iip_provisorio/nr_fatos) -- AD-032
--   - subquery sobre fat_registro (coluna dt_ultimo_registro) -- adendo à
--     AD-032, achado de Design desta feature (fat_registro depende de
--     fat_encontro, que também só existe na Incidência)
--
-- Esta view é a mesma definição aprovada, verbatim, MENOS essas 3 colunas e
-- os 2 objetos de que dependiam. Não é redesenho -- quando a Incidência
-- provisionar mv_iip_contrato/fat_registro, a tarefa de substituição troca
-- esta view pela versão completa (nunca adiciona as colunas por cima).
--
-- CREATE OR REPLACE VIEW -- mesmo padrão de vw_etapa_contrato
-- (20260812001130_regua_instanciacao_estrutura.sql), idempotente.
-- =============================================================================

CREATE OR REPLACE VIEW vw_carteira WITH (security_invoker = true) AS
SELECT v.id_usuario,
       v.papel_no_contrato,
       c.id_contrato,
       ct.nome AS nome_contratante,
       p.nome  AS nome_produto,
       pj.nome AS nome_projeto,
       c.status,
       e.nome  AS etapa_atual,
       pl.pct_atingimento,
       pl.atingimento_desatualizado
FROM rel_usuario_contrato v
JOIN fat_contrato c            ON c.id_contrato = v.id_contrato
JOIN dim_contratante ct        ON ct.id_contratante = c.id_contratante
JOIN ref_produto p             ON p.id_produto = c.id_produto
LEFT JOIN ref_projeto pj       ON pj.id_projeto = c.id_projeto
LEFT JOIN ref_etapa e          ON e.id_etapa = c.id_etapa_atual
LEFT JOIN dim_planejamento pl  ON pl.id_contrato = c.id_contrato
WHERE v.dt_fim IS NULL OR v.dt_fim >= CURRENT_DATE;

COMMENT ON VIEW vw_carteira IS
'Versão reduzida (AD-032 + adendo, .specs/STATE.md): sem iip_provisorio/nr_fatos (mv_iip_contrato) e sem dt_ultimo_registro (fat_registro) -- nenhum dos dois está provisionado ainda. Substituir pela versão completa aprovada (docs/schema_sistema.sql:1327-1349) quando a Incidência (roadmap §6.2) criar esses objetos.';
