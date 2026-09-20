-- =============================================================================
-- Resolve CAT-16 (parcialmente) e a decisão D2 ("aritmética final do IIP"):
-- mv_iip_contrato para de depender de ref_indicador.peso_iip.
--
-- CONTEXTO DA MUDANÇA (decisão de Pedro, 20/09/2026, revisitando Assumption
-- #1b de incidencia-encontros/spec.md e o achado de catalogos-referencia/
-- context.md:30-34): o desenho original tratava nível (D1/D2/D3, por fato) e
-- peso (peso_iip, por tipo de indicador) como duas dimensões independentes
-- que se multiplicam -- e como o CSV aprovado (docs/DB_Fatos_Geradores -
-- Ref_Tipologias.csv) nunca trouxe peso, ref_indicador ficou vazia e
-- iip_provisorio sempre NULL.
--
-- Releitura: os 3 níveis já carregam a "importância" do fato, porque o
-- ESTADO de cada tipologia -- que já é dado aprovado, veio no CSV -- sobe de
-- nível junto com o avanço do fato. Ex.: em "Projeto de lei / proposição",
-- Apresentado=(baixo,baixo,baixo) [soma 3] até Sancionado/promulgado=
-- (alto,alto,maximo) [soma 10]. Não existe uma segunda variável de "quanto
-- esse tipo pesa" faltando -- ela já está codificada em qual combinação de
-- D1/D2/D3 o estado daquele fato assume. peso_iip teria sido uma segunda
-- calibração sobre uma calibração que já existe, não um insumo que falta.
--
-- NOVA FÓRMULA (decisão de Pedro): iip_provisorio = SOMA, sobre todo fato
-- realizado do contrato, de (nivel_d1 + nivel_d2 + nivel_d3) -- nível ausente
-- em alguma dimensão conta como 0 (COALESCE), nunca quebra a soma. Cresce com
-- volume E com intensidade dos fatos -- decisão deliberada (vs. média, que
-- normalizaria por quantidade): mais fatos de mais impacto é mais IIP.
-- ref_indicador/peso_iip deixam de ser lidas por esta MV; a tabela continua
-- existindo (não foi dropada) para uso futuro caso o modelo mude de novo.
--
-- Mesmo mecanismo de DROP CASCADE + recria já usado em
-- 20260916163414_incidencia_v2_iip_so_realizados.sql: Postgres não tem ALTER
-- MATERIALIZED VIEW ... AS, e 3 views dependem de mv_iip_contrato
-- (vw_iip_contrato, vw_carteira, vw_estrategia_kpi). Nenhuma delas muda
-- coluna ou predicado próprio -- só a mudança de fórmula dentro da MV.
-- =============================================================================

DROP MATERIALIZED VIEW mv_iip_contrato CASCADE;

CREATE MATERIALIZED VIEW mv_iip_contrato AS
SELECT f.id_contrato,
       COUNT(*)                                                    AS nr_fatos,
       SUM(COALESCE(n1.valor, 0))                                   AS componente_d1,
       SUM(COALESCE(n2.valor, 0))                                   AS componente_d2,
       SUM(COALESCE(n3.valor, 0))                                   AS componente_d3,
       SUM(COALESCE(n1.valor, 0) + COALESCE(n2.valor, 0) + COALESCE(n3.valor, 0))
                                                                     AS iip_provisorio,
       MAX(f.dt_ocorrencia)                                         AS dt_ultimo_fato
FROM fat_fato_gerador f
LEFT JOIN ref_nivel_iip n1   ON n1.codigo = f.nivel_d1
LEFT JOIN ref_nivel_iip n2   ON n2.codigo = f.nivel_d2
LEFT JOIN ref_nivel_iip n3   ON n3.codigo = f.nivel_d3
WHERE f.situacao = 'realizado'
GROUP BY f.id_contrato
WITH NO DATA;

COMMENT ON MATERIALIZED VIEW mv_iip_contrato IS
'iip_provisorio = SOMA de (nivel_d1+nivel_d2+nivel_d3) de todo fato gerador situacao=''realizado'' do contrato (20260920, decisão de Pedro que resolve CAT-16/D2 -- ver comentário no topo da migration 20260920193843). Não depende mais de ref_indicador.peso_iip: os 3 níveis por fato já carregam a intensidade, e o estado de cada tipologia (dado aprovado do CSV) já embute o "peso" ao escolher a combinação de níveis. Cresce com volume e com intensidade -- não é média. AD-054 (herdado): considera somente situacao=''realizado''. REFRESH MATERIALIZED VIEW CONCURRENTLY exige o índice único abaixo e a MV já populada ao menos uma vez sem CONCURRENTLY (feito logo abaixo nesta mesma migration).';

CREATE UNIQUE INDEX uq_mv_iip_contrato ON mv_iip_contrato (id_contrato);

REFRESH MATERIALIZED VIEW mv_iip_contrato;

-- Recria as 3 views dependentes, texto idêntico ao que existia antes do
-- CASCADE (nenhuma coluna/predicado próprio muda -- só a MV de baixo mudou
-- de fórmula, mantendo os mesmos nomes/tipos de coluna).
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

-- GRANTs: restaura o estado anterior ao CASCADE (mesmo padrão de
-- 20260916163414_incidencia_v2_iip_so_realizados.sql -- ver comentário lá
-- sobre por que não usar o boilerplate "ALL TABLES IN SCHEMA public" direto
-- em views agregadas).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;

REVOKE INSERT, UPDATE, DELETE ON
  mv_iip_contrato, vw_iip_contrato, vw_carteira, vw_estrategia_kpi
FROM legisla_app, legisla_admin, legisla_gestora;

GRANT SELECT ON mv_iip_contrato, vw_iip_contrato, vw_carteira TO legisla_mentor, legisla_assessor;

REVOKE ALL ON public.vw_estrategia_kpi FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON public.vw_estrategia_kpi FROM authenticated;
