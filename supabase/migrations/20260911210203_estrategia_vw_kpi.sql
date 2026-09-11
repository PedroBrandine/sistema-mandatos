-- =============================================================================
-- redesenho-estrategia-tela-first: T31 -- vw_estrategia_kpi, os 6 números do
-- topo do Dashboard do produto (EST-08, AD-003).
--
-- AD-003 ("nenhum número de gestão sai de tabela transacional... impede que
-- cada tela invente sua própria agregação") é o que dita o GRÃO desta view.
-- A alternativa óbvia -- view no grão de contrato, agregada no TypeScript --
-- foi descartada justamente por isso: a média de IIP e a de atingimento
-- passariam a existir dentro de um componente React, que é exatamente a
-- "agregação inventada pela tela" que a AD proíbe. Aqui a view devolve os 6
-- números JÁ AGREGADOS, e a camada de query só escolhe qual linha ler.
--
-- Como o recorte de EST-08 AC3 (filtros de gestora/projeto) convive com isso:
-- cada contrato é projetado em 4 combinações de escopo por dois CROSS JOIN
-- LATERAL, e o GROUP BY final produz uma linha por combinação --
--
--   escopo_projeto=false, escopo_gestora=false  -> total do produto
--   escopo_projeto=true , escopo_gestora=false  -> recorte por projeto
--   escopo_projeto=false, escopo_gestora=true   -> recorte por gestora
--   escopo_projeto=true , escopo_gestora=true   -> recorte pelos dois
--
-- Cada célula é agregada do zero a partir dos contratos que pertencem a ela,
-- nunca somada a partir de outra célula. É por isso que os escopos são
-- colunas BOOLEANAS explícitas em vez do NULL de um ROLLUP/CUBE: em
-- `id_projeto`, NULL já significa "contrato sem projeto" (a coluna é
-- nullable em fat_contrato), e reaproveitar o mesmo NULL para "todos os
-- projetos" tornaria os dois casos indistinguíveis do lado do PostgREST. O
-- consumidor seleciona uma linha por igualdade booleana, sem ambiguidade.
--
-- Dentro de um mesmo grupo cada contrato aparece EXATAMENTE uma vez, o que é
-- o que mantém AVG e SUM corretos: o LATERAL de gestora emite 1 linha de
-- "todas as gestoras" mais 1 linha por gestora ativa, e essas linhas caem em
-- grupos diferentes (id_usuario_gestora distinto). A multiplicação por
-- contrato com 2 gestoras ativas -- risco real, documentado no COMMENT de
-- vw_pendencias, já que uq_vinculo permite o caso -- portanto não infla
-- nenhuma célula. COUNT(DISTINCT id_contrato) é defesa em profundidade sobre
-- a mesma garantia, para que um JOIN futuro que multiplique linhas não
-- transforme silenciosamente uma contagem de mandatos em contagem de linhas.
--
-- AD-014/AD-015 (só lê e agrega, não recalcula métrica): o IIP entra pronto
-- por mv_iip_contrato.iip_provisorio e o NPS pronto por mv_avaliacao_nps.nps.
-- Nenhum peso (peso_iip), nível (nivel_d1/d2/d3) ou fórmula de NPS
-- (promotores - detratores) é reimplementado aqui -- refazer a conta seria a
-- segunda implementação da métrica que a AD-014 existe para impedir. Pelo
-- mesmo motivo nr_fatos_geradores lê mv_iip_contrato.nr_fatos (que já é o
-- COUNT(*) de fat_fato_gerador por contrato) em vez de varrer
-- fat_fato_gerador: AD-003 é explícita em que número de gestão não sai de
-- tabela transacional, e a MV é a camada de Saída desse número.
--
-- AD-005 (ausência é NULL, nunca sentinela) vale para os três KPIs de MÉDIA,
-- e sai de graça do próprio AVG, que ignora NULL e devolve NULL quando não
-- há nenhuma amostra: produto sem nenhum IIP calculado devolve iip_medio
-- NULL, não 0. A distinção que esta view faz questão de preservar é entre
-- média indefinida e contagem legítima: `mandatos_ativos`,
-- `mandatos_em_atraso` e `nr_fatos_geradores` são contagens sobre um conjunto
-- de contratos CONHECIDO, e para elas zero é um fato verdadeiro ("nenhum
-- mandato está atrasado"), não um número inventado -- devolver NULL ali
-- esconderia informação real. Já `iip_medio`, `nps_medio` e
-- `pct_atingimento_medio` sobre zero amostras são indefinidos, e é sobre eles
-- que o "—" da tela (EST-08 AC2) incide. Produto sem NENHUM contrato visível
-- não gera linha alguma, e a ausência da linha é a própria ausência de dado.
--
-- Limitação estrutural do NPS, registrada e não contornada: mv_avaliacao_nps
-- agrega por (formulário × projeto × métrica) e NÃO carrega id_contrato --
-- a gestora não sobrevive a essa agregação, porque o vínculo de gestora é
-- por contrato. Logo o NPS não é recortável por gestora. Em vez de repetir o
-- número do produto inteiro dentro do recorte de uma gestora -- que seria um
-- número ERRADO exibido como se fosse dela -- as linhas de escopo_gestora
-- devolvem nps_medio NULL, que a tela renderiza como "—" (AD-005: ausência
-- explícita em vez de valor enganoso). Recortar NPS por gestora exigiria
-- id_contrato em mv_avaliacao_nps, mudança na Incidência/Formulários que
-- está fora do escopo de EST-08.
--
-- security_invoker = true (padrão de toda view da camada Saída, AD-011/
-- AD-015): a RLS por carteira de fat_contrato continua valendo, então cada
-- usuária agrega apenas os contratos que já enxerga -- a restrição fica na
-- RLS, nunca num filtro desta view (AD-001).
-- =============================================================================

CREATE VIEW vw_estrategia_kpi WITH (security_invoker = true) AS
WITH contrato_escopo AS (
  SELECT
    c.id_contrato,
    c.id_produto,
    c.status,
    prj.escopo_projeto,
    prj.id_projeto,
    gst.escopo_gestora,
    gst.id_usuario_gestora
  FROM fat_contrato c
  -- Linha "todos os projetos" sempre; a linha de recorte só existe quando o
  -- contrato tem projeto -- contrato sem projeto não inventa um grupo.
  CROSS JOIN LATERAL (
    SELECT false AS escopo_projeto, NULL::bigint AS id_projeto
    UNION ALL
    SELECT true, c.id_projeto WHERE c.id_projeto IS NOT NULL
  ) prj
  -- Mesma convenção de "vínculo ativo" de vw_pendencias e vw_carteira
  -- (dt_fim aberta ou futura), para que o recorte por gestora do Dashboard
  -- concorde com a coluna de gestora das Pendências na mesma tela.
  CROSS JOIN LATERAL (
    SELECT false AS escopo_gestora, NULL::bigint AS id_usuario_gestora
    UNION ALL
    SELECT true, v.id_usuario
      FROM rel_usuario_contrato v
     WHERE v.id_contrato = c.id_contrato
       AND v.papel_no_contrato = 'gestora'
       AND (v.dt_fim IS NULL OR v.dt_fim >= CURRENT_DATE)
  ) gst
),
-- Reuso de vw_pendencias (T3/AD-041) em vez de reproduzir a regra de etapa
-- atrasada: o limiar mora em ref_limiar_pendencia e mudá-lo tem de mudar
-- este KPI junto, sem deploy (AD-004). DISTINCT porque um contrato pode ter
-- mais de uma etapa vencida e o KPI conta MANDATOS, não etapas.
etapa_atrasada AS (
  SELECT DISTINCT p.id_contrato
    FROM vw_pendencias p
   WHERE p.categoria = 'etapa_atrasada'
),
-- NPS chega ao produto pelo único caminho disponível a partir da MV:
-- formulário -> etapa -> produto. id_projeto_grupo é COALESCE(id_projeto, 0)
-- na origem, então 0 significa "contrato sem projeto" e nunca vira recorte.
nps_escopo AS (
  SELECT
    re.id_produto,
    prj.escopo_projeto,
    prj.id_projeto,
    ROUND(AVG(a.nps), 2) AS nps_medio
  FROM mv_avaliacao_nps a
  JOIN ref_formulario rf ON rf.id_formulario = a.id_formulario
  JOIN ref_etapa re      ON re.id_etapa = rf.id_etapa
  CROSS JOIN LATERAL (
    SELECT false AS escopo_projeto, NULL::bigint AS id_projeto
    UNION ALL
    SELECT true, a.id_projeto_grupo WHERE a.id_projeto_grupo <> 0
  ) prj
  WHERE a.eh_nps AND a.nps IS NOT NULL
  GROUP BY re.id_produto, prj.escopo_projeto, prj.id_projeto
)
SELECT
  ce.id_produto,
  ce.escopo_projeto,
  ce.id_projeto,
  ce.escopo_gestora,
  ce.id_usuario_gestora,
  COUNT(DISTINCT ce.id_contrato) FILTER (WHERE ce.status = 'ativo')         AS mandatos_ativos,
  ROUND(AVG(iip.iip_provisorio), 2)                                         AS iip_medio,
  COUNT(DISTINCT ce.id_contrato) FILTER (WHERE ea.id_contrato IS NOT NULL)  AS mandatos_em_atraso,
  CASE WHEN ce.escopo_gestora THEN NULL ELSE MAX(nps.nps_medio) END         AS nps_medio,
  ROUND(AVG(pl.pct_atingimento), 2)                                         AS pct_atingimento_medio,
  COALESCE(SUM(iip.nr_fatos), 0)                                            AS nr_fatos_geradores
FROM contrato_escopo ce
LEFT JOIN mv_iip_contrato iip ON iip.id_contrato = ce.id_contrato
LEFT JOIN etapa_atrasada ea   ON ea.id_contrato = ce.id_contrato
LEFT JOIN dim_planejamento pl ON pl.id_contrato = ce.id_contrato
-- nps_escopo é 1 linha por (produto, escopo de projeto), constante dentro de
-- cada grupo do GROUP BY -- MAX() é só a forma de carregá-la através da
-- agregação, não uma escolha entre valores. IS NOT DISTINCT FROM porque o
-- lado "todos os projetos" casa NULL com NULL.
LEFT JOIN nps_escopo nps ON nps.id_produto      = ce.id_produto
                        AND nps.escopo_projeto  = ce.escopo_projeto
                        AND nps.id_projeto IS NOT DISTINCT FROM ce.id_projeto
GROUP BY ce.id_produto, ce.escopo_projeto, ce.id_projeto, ce.escopo_gestora, ce.id_usuario_gestora;

COMMENT ON VIEW vw_estrategia_kpi IS
'EST-08. Os 6 KPIs do topo do Dashboard do produto, agregados na camada Saída (AD-003): mandatos_ativos, iip_medio, mandatos_em_atraso, nps_medio, pct_atingimento_medio, nr_fatos_geradores. Uma linha por (produto × escopo de projeto × escopo de gestora); escopo_projeto/escopo_gestora dizem se a linha é recorte ou total, e o consumidor lê UMA linha em vez de somar várias. Só lê e agrega: IIP vem pronto de mv_iip_contrato e NPS de mv_avaliacao_nps, nenhuma métrica é recalculada (AD-014). Médias devolvem NULL sem amostra (AD-005, renderizado "—"); contagens devolvem 0, que ali é fato e não sentinela. nps_medio é NULL em toda linha de escopo_gestora: mv_avaliacao_nps não carrega id_contrato, logo NPS não é recortável por gestora -- ausência explícita em vez de repetir o número do produto como se fosse o dela.';

-- Espelha exatamente a ACL de vw_pendencias, que esta view lê: legisla_mentor
-- e legisla_assessor ficam de fora de propósito. Não é preferência -- eles já
-- não têm SELECT em vw_pendencias nem em mv_avaliacao_nps, então com
-- security_invoker a leitura falharia em 42501 no meio da agregação; conceder
-- a view sem conceder as fontes só trocaria "card não aparece" por erro de
-- permissão na tela. Re-GRANT explícito porque "ALL TABLES IN SCHEMA public"
-- só alcança relations que já existiam quando aquele GRANT rodou (AD-025).
GRANT SELECT ON vw_estrategia_kpi TO legisla_app, legisla_admin, legisla_gestora;

-- Fecha, na view nova, o gap de `ALTER DEFAULT PRIVILEGES` do baseline
-- Supabase documentado em .specs/STATE.md (achado de T2): toda relation nova
-- de public nasce com CRUD completo para anon e authenticated, sem nenhum
-- GRANT desta migration. anon é sessão não autenticada e não tem o que fazer
-- com KPI de carteira. authenticated MANTÉM SELECT de propósito -- é a role
-- efetiva da usuária logada no PostgREST, e sem ela o Dashboard não lê a
-- própria view; o que sobra para a RLS de fat_contrato limitar, por
-- security_invoker, é qual carteira essa usuária agrega (AD-001). As escritas
-- caem porque view agregada não é destino de escrita em hipótese nenhuma.
REVOKE ALL ON public.vw_estrategia_kpi FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON public.vw_estrategia_kpi FROM authenticated;
