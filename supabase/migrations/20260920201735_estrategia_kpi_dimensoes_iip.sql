-- =============================================================================
-- vw_estrategia_kpi ganha a média de componente_d1/d2/d3 (mesmo grão/fonte do
-- iip_medio já existente -- mv_iip_contrato, AD-064), pra o card "IIP — Índ.
-- de impacto" do Dashboard do produto poder mostrar quais dimensões os Fatos
-- Geradores do recorte mais atingiram, não só a média total (pedido de
-- Pedro, mesma necessidade que motivou vw_iip_contrato.componente_dN em
-- 20260920200358_incidencia_vw_iip_contrato_componentes.sql).
--
-- CREATE OR REPLACE VIEW (não precisa de DROP CASCADE): só ACRESCENTA 3
-- colunas no fim do SELECT final, nada mais muda -- aceito sem quebrar
-- dependentes nem GRANTs.
-- =============================================================================

CREATE OR REPLACE VIEW vw_estrategia_kpi WITH (security_invoker = true) AS
 WITH contrato_escopo AS (
         SELECT c.id_contrato,
            c.id_produto,
            c.status,
            prj.escopo_projeto,
            prj.id_projeto,
            gst.escopo_gestora,
            gst.id_usuario_gestora
           FROM fat_contrato c
             CROSS JOIN LATERAL ( SELECT false AS escopo_projeto,
                    NULL::bigint AS id_projeto
                UNION ALL
                 SELECT true,
                    c.id_projeto
                  WHERE c.id_projeto IS NOT NULL) prj
             CROSS JOIN LATERAL ( SELECT false AS escopo_gestora,
                    NULL::bigint AS id_usuario_gestora
                UNION ALL
                 SELECT true,
                    v.id_usuario
                   FROM rel_usuario_contrato v
                  WHERE v.id_contrato = c.id_contrato AND v.papel_no_contrato = 'gestora'::text AND (v.dt_fim IS NULL OR v.dt_fim >= CURRENT_DATE)) gst
        ), etapa_atrasada AS (
         SELECT DISTINCT p.id_contrato
           FROM vw_pendencias p
          WHERE p.categoria = 'etapa_atrasada'::text
        ), nps_escopo AS (
         SELECT re.id_produto,
            prj.escopo_projeto,
            prj.id_projeto,
            round(avg(a.nps), 2) AS nps_medio
           FROM mv_avaliacao_nps a
             JOIN ref_formulario rf ON rf.id_formulario = a.id_formulario
             JOIN ref_etapa re ON re.id_etapa = rf.id_etapa
             CROSS JOIN LATERAL ( SELECT false AS escopo_projeto,
                    NULL::bigint AS id_projeto
                UNION ALL
                 SELECT true,
                    a.id_projeto_grupo
                  WHERE a.id_projeto_grupo <> 0) prj
          WHERE a.eh_nps AND a.nps IS NOT NULL
          GROUP BY re.id_produto, prj.escopo_projeto, prj.id_projeto
        ), limiar_etapa AS (
         SELECT ( SELECT ref_limiar_pendencia.pct_duracao_etapa
                   FROM ref_limiar_pendencia
                  WHERE ref_limiar_pendencia.codigo = 'etapa_atrasado'::text AND ref_limiar_pendencia.ativo) AS atrasado_pct_ativo,
            ( SELECT ref_limiar_pendencia.pct_duracao_etapa
                   FROM ref_limiar_pendencia
                  WHERE ref_limiar_pendencia.codigo = 'etapa_atencao'::text AND ref_limiar_pendencia.ativo) AS atencao_pct_ativo
        ), etapa_referencia AS (
         SELECT c.id_contrato,
            COALESCE(e_atual.duracao_prevista_dias, e_ordem1.duracao_prevista_dias) AS duracao_ref,
            COALESCE(fec.dt_inicio, c.dt_inicio) AS dt_ancora
           FROM fat_contrato c
             LEFT JOIN ref_etapa e_atual ON e_atual.id_etapa = c.id_etapa_atual
             LEFT JOIN LATERAL ( SELECT e.duracao_prevista_dias
                   FROM ref_etapa e
                  WHERE e.id_produto = c.id_produto
                  ORDER BY e.ordem
                 LIMIT 1) e_ordem1 ON c.id_etapa_atual IS NULL
             LEFT JOIN fat_etapa_contrato fec ON fec.id_contrato = c.id_contrato AND fec.id_etapa = c.id_etapa_atual
          WHERE c.status = 'ativo'::text
        ), etapa_classificacao AS (
         SELECT er.id_contrato,
                CASE
                    WHEN le_1.atrasado_pct_ativo IS NOT NULL AND ((CURRENT_DATE - er.dt_ancora)::numeric / er.duracao_ref::numeric * 100::numeric) >= le_1.atrasado_pct_ativo::numeric THEN 'atrasado'::text
                    WHEN le_1.atencao_pct_ativo IS NOT NULL AND ((CURRENT_DATE - er.dt_ancora)::numeric / er.duracao_ref::numeric * 100::numeric) >= le_1.atencao_pct_ativo::numeric THEN 'atencao'::text
                    ELSE 'normal'::text
                END AS estado
           FROM etapa_referencia er
             CROSS JOIN limiar_etapa le_1
          WHERE er.duracao_ref IS NOT NULL AND er.duracao_ref > 0
        )
 SELECT ce.id_produto,
    ce.escopo_projeto,
    ce.id_projeto,
    ce.escopo_gestora,
    ce.id_usuario_gestora,
    count(DISTINCT ce.id_contrato) FILTER (WHERE ce.status = 'ativo'::text) AS mandatos_ativos,
    round(avg(iip.iip_provisorio), 2) AS iip_medio,
    count(DISTINCT ce.id_contrato) FILTER (WHERE ea.id_contrato IS NOT NULL) AS mandatos_em_atraso,
        CASE
            WHEN ce.escopo_gestora THEN NULL::numeric
            ELSE max(nps.nps_medio)
        END AS nps_medio,
    round(avg(pl.pct_atingimento), 2) AS pct_atingimento_medio,
    COALESCE(sum(iip.nr_fatos), 0::numeric) AS nr_fatos_geradores,
        CASE
            WHEN max(le.atrasado_pct_ativo) IS NULL THEN NULL::bigint
            ELSE count(DISTINCT ce.id_contrato) FILTER (WHERE ecl.estado = 'atrasado'::text)
        END AS mandatos_atraso_atrasados,
        CASE
            WHEN max(le.atencao_pct_ativo) IS NULL THEN NULL::bigint
            ELSE count(DISTINCT ce.id_contrato) FILTER (WHERE ecl.estado = 'atencao'::text)
        END AS mandatos_atraso_atencao,
    count(DISTINCT ce.id_contrato) FILTER (WHERE ecl.estado = 'normal'::text) AS mandatos_atraso_normal,
    round(avg(iip.componente_d1), 2) AS componente_d1_medio,
    round(avg(iip.componente_d2), 2) AS componente_d2_medio,
    round(avg(iip.componente_d3), 2) AS componente_d3_medio
   FROM contrato_escopo ce
     LEFT JOIN mv_iip_contrato iip ON iip.id_contrato = ce.id_contrato
     LEFT JOIN etapa_atrasada ea ON ea.id_contrato = ce.id_contrato
     LEFT JOIN dim_planejamento pl ON pl.id_contrato = ce.id_contrato
     LEFT JOIN nps_escopo nps ON nps.id_produto = ce.id_produto AND nps.escopo_projeto = ce.escopo_projeto AND NOT nps.id_projeto IS DISTINCT FROM ce.id_projeto
     LEFT JOIN etapa_classificacao ecl ON ecl.id_contrato = ce.id_contrato
     CROSS JOIN limiar_etapa le
  GROUP BY ce.id_produto, ce.escopo_projeto, ce.id_projeto, ce.escopo_gestora, ce.id_usuario_gestora;

COMMENT ON VIEW vw_estrategia_kpi IS
'EST-08 + AD-050/AD-051. Os KPIs do topo do Dashboard do produto, agregados na camada Saída (AD-003): mandatos_ativos, iip_medio, nps_medio, pct_atingimento_medio, nr_fatos_geradores, mais a quebra por status do card "Mandatos ativos" (mandatos_atraso_atrasados, mandatos_atraso_atencao, mandatos_atraso_normal) e, desde 20260920, componente_d1/d2/d3_medio (AD-064) -- média das 3 dimensões do IIP no mesmo recorte de iip_medio, null nas mesmas condições (sem contrato no recorte ou nenhum com Fato Gerador realizado). As 3 colunas de quebra PARTICIONAM mandatos_ativos: somam exatamente o total em toda linha, e essa igualdade é o contrato desta view com a tela (AD-050) -- a única exceção é o contrato cuja etapa de referência não tem duracao_prevista_dias, que fica fora das 3 e nunca é forçado em "normal" (AD-005). Classificação = réplica em SQL de classificarLimiar (src/frontend/lib/limiar.ts, AD-045) sobre a ETAPA DE REFERÊNCIA: a etapa atual do contrato, ou a etapa de menor ordem do produto quando não há transição registrada, ancorada em fat_etapa_contrato.dt_inicio ou, na falta dela, em fat_contrato.dt_inicio -- mesma regra que queries/kanban.ts usa para posicionar o card e contar dias (AD-051), de modo que KPI e Kanban contem a mesma coisa. ATENÇÃO: mandatos_em_atraso está ÓRFÃ -- nenhuma tela a consome desde AD-050, que removeu o card "Mandatos em atraso". Ela mede outra coisa (existe alguma etapa, inclusive nunca iniciada, cujo prazo PLANEJADO ORIGINAL já venceu) e foi justamente a convivência das duas definições na mesma faixa que produziu o card contraditório corrigido aqui. Permanece na view só porque CREATE OR REPLACE não remove coluna e DROP derrubaria a ACL; não a reintroduza numa tela. Uma linha por (produto × escopo de projeto × escopo de gestora); escopo_projeto/escopo_gestora dizem se a linha é recorte ou total, e o consumidor lê UMA linha em vez de somar várias. Só lê e agrega: IIP vem pronto de mv_iip_contrato e NPS de mv_avaliacao_nps (AD-014). Médias devolvem NULL sem amostra (AD-005, renderizado "—"); contagens devolvem 0, que ali é fato e não sentinela -- exceto as colunas de quebra, que devolvem NULL quando o limiar de ref_limiar_pendencia correspondente está inativo. nps_medio é NULL em toda linha de escopo_gestora: mv_avaliacao_nps não carrega id_contrato, logo NPS não é recortável por gestora.';
