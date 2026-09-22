-- =============================================================================
-- fn_estrategia_kpi: os KPIs do Dashboard do produto para um CONJUNTO de
-- projetos / gestoras / contratos (filtro de seleção múltipla).
--
-- Por que existe: vw_estrategia_kpi emite uma linha por (produto x UM projeto
-- x UMA gestora). Com seleção múltipla a tela precisaria somar essas linhas,
-- e isso não fecha: contrato com mais de uma gestora entra em duas linhas, e
-- média de médias não preserva o peso de cada linha (AD-003 proíbe cada tela
-- inventar a própria agregação). Esta função agrega a MESMA fonte no grão de
-- contrato, uma vez, sobre o conjunto pedido.
--
-- Semântica dos parâmetros (NULL ou array vazio = sem filtro naquele eixo):
--   * DENTRO de um eixo é união (contrato de qualquer um dos projetos marcados);
--   * ENTRE eixos é interseção (projeto E gestora E contrato).
-- Recorte que não pega nenhum contrato devolve ZERO linhas, como a view
-- (a ausência da linha É a ausência de dado, AD-005).
--
-- Deve devolver, para um único projeto e/ou uma única gestora, exatamente a
-- linha correspondente de vw_estrategia_kpi. As fórmulas abaixo são cópia das
-- da view (20260920201735) -- se uma mudar, a outra tem de mudar junto; o
-- teste de integração estrategia-kpi-conjunto.integration.test.ts compara as
-- duas.
--
-- nps_medio: mv_avaliacao_nps não carrega id_contrato, então só é recortável
-- por projeto (média das respostas dos projetos marcados). Com filtro de
-- gestora ou de contrato vira NULL, mesma regra de escopo_gestora na view.
--
-- Fora daqui de propósito: mandatos_em_atraso, coluna órfã da view (AD-050).
--
-- SECURITY INVOKER (padrão): a RLS de fat_contrato/rel_usuario_contrato vale
-- para quem chama, como na view (security_invoker = true).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_estrategia_kpi(
    p_id_produto   bigint,
    p_ids_projeto  bigint[] DEFAULT NULL,
    p_ids_gestora  bigint[] DEFAULT NULL,
    p_ids_contrato bigint[] DEFAULT NULL
)
RETURNS TABLE (
    mandatos_ativos           bigint,
    iip_medio                 numeric,
    nps_medio                 numeric,
    pct_atingimento_medio     numeric,
    nr_fatos_geradores        numeric,
    mandatos_atraso_atrasados bigint,
    mandatos_atraso_atencao   bigint,
    mandatos_atraso_normal    bigint,
    componente_d1_medio       numeric,
    componente_d2_medio       numeric,
    componente_d3_medio       numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
 WITH contrato_escopo AS (
         SELECT c.id_contrato,
            c.id_produto,
            c.status
           FROM fat_contrato c
          WHERE c.id_produto = p_id_produto
            AND (COALESCE(cardinality(p_ids_projeto), 0) = 0 OR c.id_projeto = ANY (p_ids_projeto))
            AND (COALESCE(cardinality(p_ids_contrato), 0) = 0 OR c.id_contrato = ANY (p_ids_contrato))
            AND (COALESCE(cardinality(p_ids_gestora), 0) = 0 OR EXISTS (
                   SELECT 1
                     FROM rel_usuario_contrato v
                    WHERE v.id_contrato = c.id_contrato
                      AND v.papel_no_contrato = 'gestora'::text
                      AND (v.dt_fim IS NULL OR v.dt_fim >= CURRENT_DATE)
                      AND v.id_usuario = ANY (p_ids_gestora)))
        ), nps_escopo AS (
         SELECT round(avg(a.nps), 2) AS nps_medio
           FROM mv_avaliacao_nps a
             JOIN ref_formulario rf ON rf.id_formulario = a.id_formulario
             JOIN ref_etapa re ON re.id_etapa = rf.id_etapa
          WHERE a.eh_nps AND a.nps IS NOT NULL
            AND re.id_produto = p_id_produto
            AND (COALESCE(cardinality(p_ids_projeto), 0) = 0
                 OR (a.id_projeto_grupo <> 0 AND a.id_projeto_grupo = ANY (p_ids_projeto)))
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
 SELECT count(DISTINCT ce.id_contrato) FILTER (WHERE ce.status = 'ativo'::text) AS mandatos_ativos,
    round(avg(iip.iip_provisorio), 2) AS iip_medio,
        CASE
            WHEN COALESCE(cardinality(p_ids_gestora), 0) > 0 OR COALESCE(cardinality(p_ids_contrato), 0) > 0 THEN NULL::numeric
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
     LEFT JOIN dim_planejamento pl ON pl.id_contrato = ce.id_contrato
     LEFT JOIN nps_escopo nps ON true
     LEFT JOIN etapa_classificacao ecl ON ecl.id_contrato = ce.id_contrato
     CROSS JOIN limiar_etapa le
  HAVING count(ce.id_contrato) > 0;
$$;

COMMENT ON FUNCTION public.fn_estrategia_kpi(bigint, bigint[], bigint[], bigint[]) IS
'KPIs do Dashboard do produto para um CONJUNTO de projetos/gestoras/contratos (filtro de seleção múltipla). Mesmas fórmulas e mesmas colunas de vw_estrategia_kpi (sem a órfã mandatos_em_atraso), agregadas uma vez no grão de contrato: para 1 projeto e/ou 1 gestora devolve a linha equivalente da view. NULL/array vazio = sem filtro no eixo; união dentro do eixo, interseção entre eixos. Recorte sem contrato = zero linhas. nps_medio só recorta por projeto (NULL com filtro de gestora ou contrato). SECURITY INVOKER: RLS de quem chama.';

-- ACL: mesma da vw_estrategia_kpi (20260911210203), que lê as mesmas fontes.
-- legisla_mentor/legisla_assessor ficam de fora de propósito -- não têm SELECT
-- em mv_avaliacao_nps, e a função falharia em 42501 no meio da agregação.
-- REVOKE de PUBLIC/anon porque toda função nova nasce executável por PUBLIC.
REVOKE ALL ON FUNCTION public.fn_estrategia_kpi(bigint, bigint[], bigint[], bigint[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_estrategia_kpi(bigint, bigint[], bigint[], bigint[]) TO authenticated, legisla_app, legisla_admin, legisla_gestora;
