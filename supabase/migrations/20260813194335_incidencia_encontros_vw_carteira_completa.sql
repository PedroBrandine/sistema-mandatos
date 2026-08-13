-- =============================================================================
-- incidencia-encontros: T9 -- vw_carteira completa, resolve AD-032
-- (.specs/STATE.md). Tarefa obrigatória desta trilha (spec.md AC8).
--
-- Substitui a versão reduzida de
-- 20260812175507_visao_gerencial_vw_carteira.sql (que omitia
-- iip_provisorio/nr_fatos/dt_ultimo_registro porque mv_iip_contrato/
-- fat_registro ainda não existiam) pela versão completa aprovada,
-- verbatim docs/schema_sistema.sql:1327-1352. CREATE OR REPLACE VIEW --
-- as 3 colunas novas só são ACRESCENTADAS ao final da lista de SELECT, sem
-- remover nem retipar nenhuma das 10 colunas já existentes -- Postgres aceita
-- CREATE OR REPLACE VIEW nesse caso (mesmo padrão idempotente de
-- vw_etapa_contrato).
--
-- NOTA: a entrada AD-032 em .specs/STATE.md (marcar como resolvida) fica
-- fora desta migration -- STATE.md está sendo editado por outra sessão em
-- paralelo nesta mesma branch (fora do escopo deste lote de tasks, que é
-- só Phase 1: Schema).
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
       pl.atingimento_desatualizado,
       iip.iip_provisorio,
       iip.nr_fatos,
       (SELECT MAX(r.ocorrido_em) FROM fat_registro r WHERE r.id_contrato = c.id_contrato) AS dt_ultimo_registro
FROM rel_usuario_contrato v
JOIN fat_contrato c            ON c.id_contrato = v.id_contrato
JOIN dim_contratante ct        ON ct.id_contratante = c.id_contratante
JOIN ref_produto p             ON p.id_produto = c.id_produto
LEFT JOIN ref_projeto pj       ON pj.id_projeto = c.id_projeto
LEFT JOIN ref_etapa e          ON e.id_etapa = c.id_etapa_atual
LEFT JOIN dim_planejamento pl  ON pl.id_contrato = c.id_contrato
LEFT JOIN mv_iip_contrato iip  ON iip.id_contrato = c.id_contrato
WHERE v.dt_fim IS NULL OR v.dt_fim >= CURRENT_DATE;

COMMENT ON VIEW vw_carteira IS
'O JOIN com mv_iip_contrato (que não tem RLS) é seguro porque as linhas já vêm restritas por rel_usuario_contrato e fat_contrato: a materialized view só acrescenta colunas ao conjunto autorizado.';
