-- =============================================================================
-- vw_planejamento_kpi ganha nr_fatos_geradores. Era placeholder deliberado
-- ("Fatos Geradores: Em desenvolvimento" em planejamento-kpis.tsx) até a
-- feature fatos-geradores-ciclo-vida concluir -- concluída e validada em
-- 2026-09-18 (.specs/STATE.md, Handoff "Fatos Geradores — Linha do Tempo e
-- Ciclo de Vida"). O gap deixou de existir; a coluna passa a ter dono.
--
-- Só a CONTAGEM (nr_fatos), não o IIP nem componente_d1/d2/d3: o IipCard
-- completo já mora deliberadamente na aba "Fatos Geradores e Registros" >
-- Ciclo de Vida do mesmo contrato (planejamento-header.tsx, decisão de Pedro
-- em 2026-09-18 -- "IIP: Em desenvolvimento duplicava o IipCard real"). Repetir
-- a quebra por dimensão aqui reabriria a duplicação que aquela decisão já
-- cortou; a contagem de fatos é a única peça que ainda faltava nesta tela.
-- =============================================================================

CREATE OR REPLACE VIEW vw_planejamento_kpi WITH (security_invoker = true) AS
WITH metas AS (
  SELECT o.id_planejamento,
         count(*)                                                            AS metas_total,
         count(*) FILTER (WHERE m.status = 'ativa')                          AS metas_ativas,
         count(*) FILTER (WHERE m.status = 'ativa' AND m.prioridade = 'alta') AS metas_prioritarias
    FROM fat_objetivo_especifico o
    JOIN fat_meta m ON m.id_objetivo = o.id_objetivo
   GROUP BY o.id_planejamento
), sucessos AS (
  SELECT o.id_planejamento, count(*) AS sucessos_mensais
    FROM fat_objetivo_especifico o
    JOIN fat_meta m            ON m.id_objetivo = o.id_objetivo
    JOIN fat_sucesso_mensal sm ON sm.id_meta = m.id_meta
   GROUP BY o.id_planejamento
)
SELECT p.id_planejamento,
       p.id_contrato,
       CASE WHEN mt.metas_total > 0 THEN p.pct_atingimento END          AS pct_atingimento,
       mt.metas_ativas,
       mt.metas_prioritarias,
       CASE WHEN mt.metas_total > 0 THEN COALESCE(s.sucessos_mensais, 0) END AS sucessos_mensais,
       iip.nr_fatos AS nr_fatos_geradores
  FROM dim_planejamento p
  LEFT JOIN metas    mt ON mt.id_planejamento = p.id_planejamento
  LEFT JOIN sucessos s  ON s.id_planejamento = p.id_planejamento
  LEFT JOIN mv_iip_contrato iip ON iip.id_contrato = p.id_contrato;

COMMENT ON VIEW vw_planejamento_kpi IS
'PLV-11. Plano sem nenhuma Meta devolve NULL em pct_atingimento/metas_ativas/metas_prioritarias/sucessos_mensais -- a tela exibe "—" (AD-005), nunca 0. nr_fatos_geradores (20260920) vem pronto de mv_iip_contrato -- NULL quando o contrato não tem nenhum Fato Gerador realizado, independente de haver Meta ou não (são duas árvores diferentes: planejamento e incidência). Só a contagem: o IIP e a quebra por dimensão (componente_d1/d2/d3) ficam de fora de propósito, para não duplicar o IipCard que já mora na aba Fatos Geradores e Registros > Ciclo de Vida do mesmo contrato.';
