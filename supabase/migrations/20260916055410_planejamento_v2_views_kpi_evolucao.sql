-- =============================================================================
-- planejamento-estrategico-v2: T4 -- as três leituras derivadas da tela nova
-- (PLV-11 KPIs, PLV-13 evolução mensal, PLV-12 atraso).
--
-- AD-003 organiza tudo aqui: nenhum número de gestão é somado no cliente. O
-- que a tela faz é formatar o que estas views devolvem.
--
-- AD-005 organiza o resto: ausência de dado é NULL, nunca 0 e nunca sentinela.
-- É por isso que plano sem Meta devolve NULL em todos os KPIs, que P=0 devolve
-- NULL nas duas séries em vez de uma linha em 0%, e que Sucesso Mensal sem
-- atraso devolve NULL em vez de zero dias.
-- =============================================================================

-- --- PLV-11: KPIs do topo da tela --------------------------------------------
-- METAS PRIORITÁRIAS lê-se "N de M": M = metas_ativas (denominador), N =
-- metas_prioritarias (ativas com prioridade='alta'). Meta pausada/descartada
-- não entra em nenhum dos dois -- nem como prioritária, nem no denominador --
-- pelo mesmo princípio que já exclui essas Metas da média do Objetivo.
--
-- PLV-11 AC4: "plano sem nenhuma Meta exibe '—', não 0". O LEFT JOIN deixa as
-- contagens NULL nesse caso, e o CASE estende a mesma regra a pct_atingimento
-- e sucessos_mensais -- sem isso, um plano vazio com um Objetivo ativo exibiria
-- 0% de atingimento, afirmando desempenho zero onde não há o que medir.
--
-- Fatos Geradores FICA DE FORA de propósito: design.md o define como
-- placeholder na tela até `fatos-geradores-ciclo-vida` concluir. Coluna aqui
-- seria número sem dono.
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
       CASE WHEN mt.metas_total > 0 THEN COALESCE(s.sucessos_mensais, 0) END AS sucessos_mensais
  FROM dim_planejamento p
  LEFT JOIN metas    mt ON mt.id_planejamento = p.id_planejamento
  LEFT JOIN sucessos s  ON s.id_planejamento = p.id_planejamento;

COMMENT ON VIEW vw_planejamento_kpi IS
'PLV-11. Plano sem nenhuma Meta devolve NULL em todas as colunas — a tela exibe "—" (AD-005), nunca 0. Fatos Geradores não está aqui: é placeholder de tela até fatos-geradores-ciclo-vida concluir.';

-- --- PLV-13: Evolução mensal (Esperado x Atingido) ---------------------------
-- P = soma dos pesos dos Sucessos Mensais de Metas ATIVAS do plano.
--   Esperado(M) = Σ peso            dos SM com mes_referencia <= M  / P * 100
--   Atingido(M) = Σ peso*pct/100    dos SM com mes_referencia <= M  / P * 100
-- O delta do mês (Avanço) NÃO sai daqui: é a subtração de dois pontos já
-- devolvidos, feita no cliente por calculaAvancoMensal (design.md).
--
-- AC4 -- Meta não-ativa fica fora das DUAS séries, coerente com o nível 2 da
--        cascata (mm.status = 'ativa'). Filtro no sm_ativo, antes de tudo.
-- AC6 -- pct nulo conta 0: o mesmo COALESCE(...,0) que a cascata aprovada já
--        usa. Não é regra nova.
-- AC7 -- P=0 (nenhum SM com peso) devolve NULL nas duas séries, espelhando o
--        CASE WHEN SUM(peso) > 0 de app.recalcula_atingimento. Plano sem
--        nenhum SM não produz linha alguma. Nos dois casos a tela mostra
--        estado vazio, nunca uma linha em 0%.
-- AC8 -- Esperado se estende até o último mês com SM (o generate_series vai
--        até mes_final); Atingido para no mês corrente (NULL adiante), porque
--        afirmar atingimento de um mês que não chegou seria inventar dado.
-- AC5 -- Filtro por responsável com P RECALCULADO sobre o subconjunto: o
--        CROSS JOIN LATERAL emite cada SM duas vezes -- uma na linha de
--        escopo total (escopo_responsavel = false) e outra na linha do seu
--        responsável (escopo_responsavel = true), quando tem um. Como o P é
--        agregado DEPOIS, por escopo, cada recorte tem o seu. Mesmo padrão de
--        recorte já usado por vw_estrategia_kpi. Consultar o total é
--        escopo_responsavel = false; consultar uma pessoa é
--        escopo_responsavel = true AND id_usuario_responsavel = <id>.
CREATE OR REPLACE VIEW vw_planejamento_evolucao_mensal WITH (security_invoker = true) AS
WITH sm_ativo AS (
  SELECT o.id_planejamento,
         sm.mes_referencia,
         sm.peso,
         COALESCE(sm.pct_atingimento, 0) AS pct,
         sm.id_usuario_responsavel
    FROM fat_sucesso_mensal sm
    JOIN fat_meta m                ON m.id_meta = sm.id_meta
    JOIN fat_objetivo_especifico o ON o.id_objetivo = m.id_objetivo
   WHERE m.status = 'ativa'
), sm_escopo AS (
  SELECT s.id_planejamento,
         e.escopo_responsavel,
         e.id_usuario_responsavel,
         s.mes_referencia,
         s.peso,
         s.pct
    FROM sm_ativo s
    CROSS JOIN LATERAL (
      SELECT false AS escopo_responsavel, NULL::bigint AS id_usuario_responsavel
      UNION ALL
      SELECT true, s.id_usuario_responsavel WHERE s.id_usuario_responsavel IS NOT NULL
    ) e
), escopo AS (
  SELECT id_planejamento,
         escopo_responsavel,
         id_usuario_responsavel,
         SUM(peso)           AS peso_total,
         MIN(mes_referencia) AS mes_inicial,
         MAX(mes_referencia) AS mes_final
    FROM sm_escopo
   GROUP BY 1, 2, 3
)
SELECT e.id_planejamento,
       e.escopo_responsavel,
       e.id_usuario_responsavel,
       g.mes::date AS mes,
       CASE WHEN e.peso_total > 0
            THEN ROUND(acum.peso_acumulado / e.peso_total * 100, 2) END AS pct_esperado,
       CASE WHEN e.peso_total > 0
             AND g.mes::date <= date_trunc('month', CURRENT_DATE)::date
            THEN ROUND(acum.atingido_acumulado / e.peso_total * 100, 2) END AS pct_atingido
  FROM escopo e
  CROSS JOIN LATERAL generate_series(e.mes_inicial, e.mes_final, INTERVAL '1 month') AS g(mes)
  CROSS JOIN LATERAL (
    SELECT COALESCE(SUM(s.peso), 0)               AS peso_acumulado,
           COALESCE(SUM(s.peso * s.pct / 100), 0) AS atingido_acumulado
      FROM sm_escopo s
     WHERE s.id_planejamento        = e.id_planejamento
       AND s.escopo_responsavel     = e.escopo_responsavel
       AND s.id_usuario_responsavel IS NOT DISTINCT FROM e.id_usuario_responsavel
       AND s.mes_referencia        <= g.mes::date
  ) acum;

COMMENT ON VIEW vw_planejamento_evolucao_mensal IS
'PLV-13/AD-056. Série DERIVADA, não fotografada: editar o % de um mês passado altera retroativamente o ponto daquele mês. Escopo total = escopo_responsavel false; recorte por pessoa = escopo_responsavel true + id_usuario_responsavel, com P recalculado sobre o subconjunto.';

-- --- PLV-03: responsável na view da grade -------------------------------------
-- CREATE OR REPLACE (não DROP + CREATE) preserva a ACL de vw_sucesso_mensal --
-- mentor e assessor têm GRANT SELECT nela desde 20260812145817. REPLACE exige
-- que as colunas já existentes venham na MESMA ordem e com o MESMO tipo, então
-- as 13 originais estão reproduzidas verbatim (o `sm.*` original expandia
-- exatamente estas 11 colunas da tabela) e a nova vai no fim.
--
-- A ÚNICA coluna nova é id_usuario_responsavel, que a grade precisa para exibir
-- o responsável do próprio Sucesso Mensal (PLV-03 AC2). Ela não entra sozinha
-- pelo `sm.*` original: aquela expansão foi congelada na criação da view, antes
-- de a coluna existir.
--
-- NENHUMA COLUNA DE ATRASO NOVA, de propósito (decisão de 2026-09-16). O par
-- que já existe resolve PLV-12 sem gêmeo: `esta_atrasado` é exatamente
-- `status = 'pendente' AND dt_limite < CURRENT_DATE`, a regra da AC1 --
-- inclusive o caso do Sucesso já realizado e vencido, que dá false. O defeito
-- está só em `dias_atraso`, que devolve 0 (não NULL) sem dt_limite, porque
-- GREATEST ignora NULL. Corrigir a expressão mudaria em silêncio o que
-- buscarGradeSucessosMensais já lê; criar `atraso_dias` ao lado deixaria dois
-- nomes quase idênticos para sempre. Então os dois ficam INTACTOS e a T9
-- combina os dois em TypeScript: atrasoDias = esta_atrasado ? dias_atraso : null.
CREATE OR REPLACE VIEW vw_sucesso_mensal WITH (security_invoker = true) AS
SELECT sm.id_sucesso,
       sm.id_meta,
       sm.descricao,
       sm.mes_referencia,
       sm.dt_limite,
       sm.peso,
       sm.pct_atingimento,
       sm.status,
       sm.atualizado_por,
       sm.atualizado_em,
       sm.criado_em,
       GREATEST(0, CURRENT_DATE - sm.dt_limite)                 AS dias_atraso,
       (sm.status = 'pendente' AND sm.dt_limite < CURRENT_DATE) AS esta_atrasado,
       sm.id_usuario_responsavel
  FROM fat_sucesso_mensal sm;

-- Re-GRANT explícito (AD-025): "ALL TABLES IN SCHEMA public" só alcança as
-- relations que já existiam quando aquele GRANT rodou. Mesma lista de papéis
-- que já lê vw_sucesso_mensal -- as views novas não abrem nada que esses
-- papéis já não pudessem ler, e security_invoker mantém a RLS valendo.
GRANT SELECT ON vw_planejamento_kpi, vw_planejamento_evolucao_mensal
  TO legisla_app, legisla_admin, legisla_gestora, legisla_mentor, legisla_assessor;
