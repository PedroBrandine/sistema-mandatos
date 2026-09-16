-- =============================================================================
-- fatos-geradores-ciclo-vida: T4 -- mv_iip_contrato passa a considerar
-- somente fatos situacao='realizado' (AD-054, AD-014, FGC-07).
--
-- Achado real de Execute (não previsto em design.md/tasks.md, que descreviam
-- só "reescreve mv_iip_contrato ... com WHERE situacao='realizado'"):
-- Postgres não tem ALTER MATERIALIZED VIEW ... AS -- mudar a query de uma MV
-- exige DROP + CREATE, e o DROP falha sem CASCADE porque 3 views já
-- dependem de mv_iip_contrato (verificado via pg_depend antes desta
-- migration, nenhuma prevista pelo design desta feature):
--   - vw_iip_contrato       (incidencia-encontros, 20260813194110)
--   - vw_carteira           (visao-gerencial-g1-g2, versão completa em
--                            20260813194335_incidencia_encontros_vw_carteira_completa.sql)
--   - vw_estrategia_kpi     (estrategia, acumulada em 4 migrations desde
--                            20260911210203_estrategia_vw_kpi.sql)
-- Nenhuma tem 2º nível de dependente (conferido: nada depende delas por sua
-- vez). Estratégia: DROP ... CASCADE e recriar as 4, byte-a-byte idênticas
-- às definições vivas em produção/dev (capturadas via pg_get_viewdef antes
-- do DROP) -- a ÚNICA mudança de texto real é o WHERE novo dentro da MV;
-- os 3 SELECTs das views dependentes não mudam nenhuma coluna nem predicado
-- próprio. GRANTs e COMMENTs das 4 relations também são apagados pelo
-- CASCADE -- restaurados ao final, conferidos contra o estado anterior via
-- has_table_privilege/obj_description antes do DROP.
--
-- WHERE f.situacao = 'realizado' entra na CTE de agregação da MV -- fato
-- projetado nunca soma nr_fatos/componente_dN/iip_provisorio enquanto não
-- for marcado realizado (T10, marcarFatoRealizado). dt_ultimo_fato também
-- passa a refletir só realizados, coerente com a mesma regra.
-- =============================================================================

DROP MATERIALIZED VIEW mv_iip_contrato CASCADE;

CREATE MATERIALIZED VIEW mv_iip_contrato AS
SELECT f.id_contrato,
       COUNT(*)                                                    AS nr_fatos,
       SUM(COALESCE(n1.valor, 0) * i.peso_iip / 100.0)              AS componente_d1,
       SUM(COALESCE(n2.valor, 0) * i.peso_iip / 100.0)              AS componente_d2,
       SUM(COALESCE(n3.valor, 0) * i.peso_iip / 100.0)              AS componente_d3,
       SUM((COALESCE(n1.valor, 0) + COALESCE(n2.valor, 0) + COALESCE(n3.valor, 0))
           * i.peso_iip / 100.0)                                    AS iip_provisorio,
       MAX(f.dt_ocorrencia)                                         AS dt_ultimo_fato
FROM fat_fato_gerador f
JOIN ref_tipologia t         ON t.id_tipologia = f.id_tipologia
LEFT JOIN ref_indicador i    ON i.id_indicador = t.id_indicador
LEFT JOIN ref_nivel_iip n1   ON n1.codigo = f.nivel_d1
LEFT JOIN ref_nivel_iip n2   ON n2.codigo = f.nivel_d2
LEFT JOIN ref_nivel_iip n3   ON n3.codigo = f.nivel_d3
WHERE f.situacao = 'realizado'
GROUP BY f.id_contrato
WITH NO DATA;

COMMENT ON MATERIALIZED VIEW mv_iip_contrato IS
'AD-054: considera somente fatos situacao=''realizado'' -- fato projetado não entra no IIP enquanto não for marcado realizado (T10). REFRESH MATERIALIZED VIEW CONCURRENTLY exige o índice único abaixo já existir e a MV já ter sido populada ao menos uma vez sem CONCURRENTLY (feito logo abaixo nesta mesma migration).';

CREATE UNIQUE INDEX uq_mv_iip_contrato ON mv_iip_contrato (id_contrato);

-- Idempotente por natureza (recalcula a partir de fat_fato_gerador, nunca
-- destrói dado) -- primeiro REFRESH sem CONCURRENTLY, mesmo motivo do T2 de
-- incidencia-encontros: popula a MV para que qualquer CONCURRENTLY futuro
-- (app.atualiza_iip_contrato(), inalterada por esta migration) funcione.
REFRESH MATERIALIZED VIEW mv_iip_contrato;

-- Recria as 3 views dependentes, texto idêntico ao que existia antes do
-- CASCADE (nenhuma coluna/predicado próprio mudou -- só a MV de baixo delas
-- passou a filtrar por situacao).
CREATE VIEW vw_iip_contrato WITH (security_invoker = true) AS
SELECT c.id_contrato, iip.nr_fatos, iip.iip_provisorio
FROM fat_contrato c
LEFT JOIN mv_iip_contrato iip ON iip.id_contrato = c.id_contrato;

CREATE VIEW vw_carteira WITH (security_invoker = true) AS
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

CREATE VIEW vw_estrategia_kpi WITH (security_invoker = true) AS
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
    count(DISTINCT ce.id_contrato) FILTER (WHERE ecl.estado = 'normal'::text) AS mandatos_atraso_normal
   FROM contrato_escopo ce
     LEFT JOIN mv_iip_contrato iip ON iip.id_contrato = ce.id_contrato
     LEFT JOIN etapa_atrasada ea ON ea.id_contrato = ce.id_contrato
     LEFT JOIN dim_planejamento pl ON pl.id_contrato = ce.id_contrato
     LEFT JOIN nps_escopo nps ON nps.id_produto = ce.id_produto AND nps.escopo_projeto = ce.escopo_projeto AND NOT nps.id_projeto IS DISTINCT FROM ce.id_projeto
     LEFT JOIN etapa_classificacao ecl ON ecl.id_contrato = ce.id_contrato
     CROSS JOIN limiar_etapa le
  GROUP BY ce.id_produto, ce.escopo_projeto, ce.id_projeto, ce.escopo_gestora, ce.id_usuario_gestora;

COMMENT ON VIEW vw_estrategia_kpi IS
'EST-08 + AD-050/AD-051. Os KPIs do topo do Dashboard do produto, agregados na camada Saída (AD-003): mandatos_ativos, iip_medio, nps_medio, pct_atingimento_medio, nr_fatos_geradores, mais a quebra por status do card "Mandatos ativos" (mandatos_atraso_atrasados, mandatos_atraso_atencao, mandatos_atraso_normal). As 3 colunas de quebra PARTICIONAM mandatos_ativos: somam exatamente o total em toda linha, e essa igualdade é o contrato desta view com a tela (AD-050) -- a única exceção é o contrato cuja etapa de referência não tem duracao_prevista_dias, que fica fora das 3 e nunca é forçado em "normal" (AD-005). Classificação = réplica em SQL de classificarLimiar (src/frontend/lib/limiar.ts, AD-045) sobre a ETAPA DE REFERÊNCIA: a etapa atual do contrato, ou a etapa de menor ordem do produto quando não há transição registrada, ancorada em fat_etapa_contrato.dt_inicio ou, na falta dela, em fat_contrato.dt_inicio -- mesma regra que queries/kanban.ts usa para posicionar o card e contar dias (AD-051), de modo que KPI e Kanban contem a mesma coisa. ATENÇÃO: mandatos_em_atraso está ÓRFÃ -- nenhuma tela a consome desde AD-050, que removeu o card "Mandatos em atraso". Ela mede outra coisa (existe alguma etapa, inclusive nunca iniciada, cujo prazo PLANEJADO ORIGINAL já venceu) e foi justamente a convivência das duas definições na mesma faixa que produziu o card contraditório corrigido aqui. Permanece na view só porque CREATE OR REPLACE não remove coluna e DROP derrubaria a ACL; não a reintroduza numa tela. Uma linha por (produto × escopo de projeto × escopo de gestora); escopo_projeto/escopo_gestora dizem se a linha é recorte ou total, e o consumidor lê UMA linha em vez de somar várias. Só lê e agrega: IIP vem pronto de mv_iip_contrato e NPS de mv_avaliacao_nps (AD-014). Médias devolvem NULL sem amostra (AD-005, renderizado "—"); contagens devolvem 0, que ali é fato e não sentinela -- exceto as colunas de quebra, que devolvem NULL quando o limiar de ref_limiar_pendencia correspondente está inativo. nps_medio é NULL em toda linha de escopo_gestora: mv_avaliacao_nps não carrega id_contrato, logo NPS não é recortável por gestora.';

-- GRANTs: restaura o estado anterior ao CASCADE.
--
-- Achado real de Execute -- a primeira versão desta migration reusava o
-- boilerplate "ALL TABLES IN SCHEMA public" (SELECT+INSERT+UPDATE+DELETE)
-- que o resto do projeto usa para TABELAS novas. "ALL TABLES IN SCHEMA" no
-- Postgres também alcança VIEWS -- as 3 relations recriadas pelo CASCADE
-- (mv_iip_contrato é materialized view, mas vw_iip_contrato/vw_carteira/
-- vw_estrategia_kpi são views de leitura) ganharam INSERT/UPDATE/DELETE que
-- nunca tiveram, quebrando o teste de ACL exata de
-- supabase/tests/estrategia/vw-estrategia-kpi.integration.test.ts. Views
-- agregadas não são destino de escrita -- só SELECT, explícito por relation,
-- nunca o bloco genérico de tabelas.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;

REVOKE INSERT, UPDATE, DELETE ON
  mv_iip_contrato, vw_iip_contrato, vw_carteira, vw_estrategia_kpi
FROM legisla_app, legisla_admin, legisla_gestora;

-- mentor/assessor: SELECT em mv_iip_contrato, vw_iip_contrato, vw_carteira
-- (tinham antes do CASCADE). vw_estrategia_kpi NUNCA teve GRANT a
-- mentor/assessor (bloqueado pra esses papéis desde a criação, sem relação
-- com esta migration) -- não restaurado de propósito.
GRANT SELECT ON mv_iip_contrato, vw_iip_contrato, vw_carteira TO legisla_mentor, legisla_assessor;

-- vw_estrategia_kpi tem hardening próprio, mais estrito que o padrão do
-- projeto (anon SEM NENHUM acesso, authenticated sem escrita) -- verbatim de
-- 20260911210203_estrategia_vw_kpi.sql:186-187, apagado pelo CASCADE e
-- restaurado aqui.
REVOKE ALL ON public.vw_estrategia_kpi FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON public.vw_estrategia_kpi FROM authenticated;
