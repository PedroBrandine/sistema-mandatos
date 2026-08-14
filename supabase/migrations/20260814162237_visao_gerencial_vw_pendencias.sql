-- =============================================================================
-- visao-gerencial-g3-g6 (.specs/features/visao-gerencial-g3-g6/): T1 --
-- vw_pendencias (Bloco 3 "Gargalos", GER-19). As 6 categorias e a regra de
-- negócio de cada uma são VERBATIM docs/schema_sistema.sql:1381-1428 (AD-008)
-- -- nenhuma condição de disparo foi alterada. O que muda em relação ao texto
-- aprovado é só o conjunto de colunas: o aprovado tinha só
-- (id_contrato, categoria, detalhe, referencia_em); tasks.md T1 pede quatro
-- colunas a mais para a tabela única do Bloco 3 (spec.md P3 AC1 -- "mandato/
-- categoria/detalhe/data de referência/dias em aberto/Gestora responsável"):
-- nome_contratante, dt_referencia (sempre populado, mesmo onde o aprovado
-- deixava referencia_em NULL), dias_em_aberto, id_usuario_gestora/nome_gestora.
--
-- CTE contrato_base resolve nome_contratante e a Gestora com vínculo ativo
-- (dt_fim IS NULL OR dt_fim >= CURRENT_DATE) uma única vez -- mesmo padrão de
-- LEFT JOIN rel_usuario_contrato + dim_usuario já usado em vw_ciclo_etapa
-- (20260812180419_visao_gerencial_vw_ciclo_etapa.sql). Se um contrato tiver
-- mais de uma Gestora com vínculo ativo simultâneo (schema permite -- UNIQUE é
-- (id_contrato, id_usuario, papel_no_contrato), não (id_contrato,
-- papel_no_contrato)), a linha se multiplica -- mesmo comportamento já aceito
-- em vw_ciclo_etapa, não uma regra nova desta migration.
--
-- dt_referencia/dias_em_aberto por categoria (nenhum dos dois existia no
-- texto aprovado -- decisão desta migration, ver commit message):
--   1. cadastro:                 dt_inicio do contrato (o campo está vazio
--                                 desde que o contrato existe)
--   2. formulario_aberto:        dt_abertura (verbatim, já era a única data)
--   3. etapa_atrasada:           dt_prevista_conclusao (verbatim)
--   4. encontro_vencido:         dt_prevista_inicio (verbatim)
--   5. sem_registro_recente:     COALESCE(MAX(ocorrido_em), dt_inicio) --
--                                mesma expressão já usada no WHERE aprovado,
--                                também exposta como referência
--   6. sucesso_mensal_atrasado:  dt_limite (verbatim)
--
-- etapa_atrasada reusa vw_etapa_contrato (já existe, já junta ref_etapa e já
-- calcula dias_atraso) só pelas colunas prontas -- NÃO reusa o flag
-- esta_atrasada da view, porque esse flag não exclui status = 'dispensada'
-- (vw_etapa_contrato: "(ec.status <> 'concluida' AND ec.dt_prevista_conclusao
-- < CURRENT_DATE)"), enquanto o vw_pendencias aprovado exclui os dois
-- ('concluida' e 'dispensada'). A condição aqui reproduz o texto aprovado.
--
-- Limiares 30/45 dias escritos na própria view (AD-004, exceção v1 -- mesmo
-- texto já presente no schema aprovado, nenhuma tabela ref_* de limiar existe
-- ainda). TODO(limiares): mover pra tabela de referência quando existir.
--
-- GRANT: legisla_app/admin/gestora apenas -- NÃO legisla_mentor/assessor.
-- Diferente de vw_carteira/vw_carteira_ponderada/vw_ciclo_etapa (G1/G2, onde
-- mentor/assessor viam sua própria carteira na mesma tela), esta feature
-- bloqueia a tela /visao-gerencial inteira para mentor/assessor com 403
-- (spec.md P1 AC1, GER-01) -- não há requisito de produto para esses dois
-- papéis lerem este rollup entre carteiras no banco.
-- =============================================================================

CREATE VIEW vw_pendencias WITH (security_invoker = true) AS
WITH contrato_base AS (
  SELECT c.id_contrato, c.id_contratante, c.dt_inicio, c.status,
         ct.nome AS nome_contratante,
         v.id_usuario AS id_usuario_gestora,
         u.nome AS nome_gestora
  FROM fat_contrato c
  JOIN dim_contratante ct ON ct.id_contratante = c.id_contratante
  LEFT JOIN rel_usuario_contrato v ON v.id_contrato = c.id_contrato AND v.papel_no_contrato = 'gestora'
                                    AND (v.dt_fim IS NULL OR v.dt_fim >= CURRENT_DATE)
  LEFT JOIN dim_usuario u ON u.id_usuario = v.id_usuario
)
-- 1. Campos de cadastro em branco (docs/schema_sistema.sql:1384-1394).
SELECT cb.id_contrato, cb.nome_contratante, 'cadastro'::text AS categoria, x.campo AS detalhe,
       cb.dt_inicio AS dt_referencia,
       (CURRENT_DATE - cb.dt_inicio) AS dias_em_aberto,
       cb.id_usuario_gestora, cb.nome_gestora
FROM contrato_base cb
JOIN dim_mandato m ON m.id_contratante = cb.id_contratante
CROSS JOIN LATERAL (VALUES
    ('ds_genero',        m.ds_genero IS NULL),
    ('ds_raca',          m.ds_raca IS NULL),
    ('fl_pcd',           m.fl_pcd IS NULL),
    ('confianca',        m.confianca IS NULL),
    ('titulo_eleitoral', m.nr_titulo_eleitoral IS NULL)
  ) AS x(campo, vazio)
WHERE x.vazio AND cb.status = 'ativo'

UNION ALL
-- 2. Formulário aberto há mais de 30 dias (docs/schema_sistema.sql:1396-1400).
SELECT cb.id_contrato, cb.nome_contratante, 'formulario_aberto', rf.codigo,
       f.dt_abertura::date AS dt_referencia,
       (CURRENT_DATE - f.dt_abertura::date) AS dias_em_aberto,
       cb.id_usuario_gestora, cb.nome_gestora
FROM rel_formulario_contrato f
JOIN contrato_base cb ON cb.id_contrato = f.id_contrato
JOIN ref_formulario rf ON rf.id_formulario = f.id_formulario
WHERE f.estado = 'aberto' AND f.dt_abertura < now() - INTERVAL '30 days'

UNION ALL
-- 3. Etapa atrasada (docs/schema_sistema.sql:1402-1407) -- via vw_etapa_contrato
--    só pelas colunas já resolvidas; condição reproduzida, não o flag esta_atrasada.
SELECT cb.id_contrato, cb.nome_contratante, 'etapa_atrasada', vec.codigo_etapa,
       vec.dt_prevista_conclusao AS dt_referencia,
       vec.dias_atraso AS dias_em_aberto,
       cb.id_usuario_gestora, cb.nome_gestora
FROM vw_etapa_contrato vec
JOIN contrato_base cb ON cb.id_contrato = vec.id_contrato
WHERE vec.status NOT IN ('concluida', 'dispensada') AND vec.dt_prevista_conclusao < CURRENT_DATE

UNION ALL
-- 4. Encontro planejado que já venceu (docs/schema_sistema.sql:1409-1412).
SELECT cb.id_contrato, cb.nome_contratante, 'encontro_vencido', en.titulo,
       en.dt_prevista_inicio::date AS dt_referencia,
       (CURRENT_DATE - en.dt_prevista_inicio::date) AS dias_em_aberto,
       cb.id_usuario_gestora, cb.nome_gestora
FROM fat_encontro en
JOIN contrato_base cb ON cb.id_contrato = en.id_contrato
WHERE en.status = 'planejado' AND en.dt_prevista_inicio < now()

UNION ALL
-- 5. Contrato ativo sem registro nos últimos 45 dias (docs/schema_sistema.sql:1414-1420).
SELECT cb.id_contrato, cb.nome_contratante, 'sem_registro_recente', NULL::text AS detalhe,
       COALESCE(reg.ultimo_registro::date, cb.dt_inicio) AS dt_referencia,
       (CURRENT_DATE - COALESCE(reg.ultimo_registro::date, cb.dt_inicio)) AS dias_em_aberto,
       cb.id_usuario_gestora, cb.nome_gestora
FROM contrato_base cb
CROSS JOIN LATERAL (
  SELECT MAX(r.ocorrido_em) AS ultimo_registro FROM fat_registro r WHERE r.id_contrato = cb.id_contrato
) reg
WHERE cb.status = 'ativo'
  AND COALESCE(reg.ultimo_registro, cb.dt_inicio::timestamptz) < now() - INTERVAL '45 days'

UNION ALL
-- 6. Sucesso mensal vencido e não atualizado (docs/schema_sistema.sql:1422-1428).
SELECT cb.id_contrato, cb.nome_contratante, 'sucesso_mensal_atrasado', sm.descricao,
       sm.dt_limite AS dt_referencia,
       (CURRENT_DATE - sm.dt_limite) AS dias_em_aberto,
       cb.id_usuario_gestora, cb.nome_gestora
FROM fat_sucesso_mensal sm
JOIN fat_meta mt               ON mt.id_meta = sm.id_meta
JOIN fat_objetivo_especifico o ON o.id_objetivo = mt.id_objetivo
JOIN dim_planejamento pl       ON pl.id_planejamento = o.id_planejamento
JOIN contrato_base cb          ON cb.id_contrato = pl.id_contrato
WHERE sm.status = 'pendente' AND sm.dt_limite < CURRENT_DATE;

COMMENT ON VIEW vw_pendencias IS
'Bloco 3 (Gargalos). 6 categorias fechadas via UNION ALL, regra de negócio verbatim docs/schema_sistema.sql:1381-1428 (AD-008) -- só as colunas de exibição (nome_contratante, dt_referencia sempre populado, dias_em_aberto, id_usuario_gestora/nome_gestora) são acréscimo desta feature. Contrato de Coalizão (sem dim_mandato) nunca gera linha de categoria cadastro -- comportamento correto por construção (JOIN dim_mandato não casa), não um bug. TODO(limiares): mover 30/45 dias pra tabela de referência quando existir (AD-004).';

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
