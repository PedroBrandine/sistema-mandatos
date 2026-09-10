-- =============================================================================
-- redesenho-estrategia-tela-first: T3 -- vw_pendencias passa a ler os limiares
-- de ref_limiar_pendencia (EST-06, AD-041), fechando a violação de AD-004
-- deixada em aberto por 20260814162237_visao_gerencial_vw_pendencias.sql
-- ("TODO(limiares): mover pra tabela de referência quando existir").
--
-- REFACTOR PURO. O corpo da view é o de 20260814162237 VERBATIM, com uma
-- única mudança mecânica: os dois literais
--   categoria 2: now() - INTERVAL '30 days'   (formulario_aberto)
--   categoria 5: now() - INTERVAL '45 days'   (sem_registro_recente)
-- viram now() - make_interval(days => lim.dias), lendo a CTE `limiar`. Com o
-- seed padrão (30 e 45, idênticos aos literais removidos) as 6 categorias
-- retornam exatamente as mesmas linhas de antes -- é o que o teste de
-- não-regressão desta task e o vw-pendencias.integration.test.ts existente
-- (14 casos, par positivo/negativo por categoria) provam.
--
-- CREATE OR REPLACE, não DROP + CREATE: preserva a ACL da view -- que NÃO é
-- a do GRANT em bloco. vw_pendencias é deliberadamente invisível a
-- legisla_mentor/legisla_assessor (a tela /visao-gerencial é 403-gated pra
-- esses dois papéis, GER-01); um DROP + CREATE perderia essa exclusão e ela
-- seria reintroduzida silenciosamente pelo próximo GRANT em bloco. Nenhuma
-- outra view depende de vw_pendencias (conferido em supabase/migrations/ e
-- em src/backend/queries/), então o REPLACE não cascateia.
--
-- security_invoker = true repetido explicitamente: a leitura continua
-- acontecendo com as permissões de quem consulta, agora incluindo
-- ref_limiar_pendencia -- as 3 roles que enxergam a view (app/admin/gestora)
-- já têm SELECT nela pelo GRANT em bloco de 20260910145926.
--
-- CROSS JOIN (não LEFT JOIN) contra a CTE de propósito: limiar inativo ou
-- ausente faz a categoria deixar de disparar, em vez de cair num número de
-- fallback. Fallback só reintroduziria o literal que esta migration existe
-- para remover; "desligar o limiar desliga a regra" é a semântica que
-- `ativo` promete.
--
-- make_interval(days => ...) em vez de concatenar texto com INTERVAL: recebe
-- o inteiro direto, sem cast de string, e não é substituível por um literal.
-- =============================================================================

CREATE OR REPLACE VIEW vw_pendencias WITH (security_invoker = true) AS
WITH limiar AS (
  SELECT codigo, dias::int AS dias FROM ref_limiar_pendencia WHERE ativo
),
contrato_base AS (
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
-- 2. Formulário aberto além do limiar 'formulario_aberto' (AD-041 -- era
--    INTERVAL '30 days' cravado aqui).
SELECT cb.id_contrato, cb.nome_contratante, 'formulario_aberto', rf.codigo,
       f.dt_abertura::date AS dt_referencia,
       (CURRENT_DATE - f.dt_abertura::date) AS dias_em_aberto,
       cb.id_usuario_gestora, cb.nome_gestora
FROM rel_formulario_contrato f
JOIN contrato_base cb ON cb.id_contrato = f.id_contrato
JOIN ref_formulario rf ON rf.id_formulario = f.id_formulario
CROSS JOIN limiar lim
WHERE lim.codigo = 'formulario_aberto'
  AND f.estado = 'aberto' AND f.dt_abertura < now() - make_interval(days => lim.dias)

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
-- 5. Contrato ativo sem registro além do limiar 'sem_registro_recente'
--    (AD-041 -- era INTERVAL '45 days' cravado aqui).
SELECT cb.id_contrato, cb.nome_contratante, 'sem_registro_recente', NULL::text AS detalhe,
       COALESCE(reg.ultimo_registro::date, cb.dt_inicio) AS dt_referencia,
       (CURRENT_DATE - COALESCE(reg.ultimo_registro::date, cb.dt_inicio)) AS dias_em_aberto,
       cb.id_usuario_gestora, cb.nome_gestora
FROM contrato_base cb
CROSS JOIN LATERAL (
  SELECT MAX(r.ocorrido_em) AS ultimo_registro FROM fat_registro r WHERE r.id_contrato = cb.id_contrato
) reg
CROSS JOIN limiar lim
WHERE lim.codigo = 'sem_registro_recente'
  AND cb.status = 'ativo'
  AND COALESCE(reg.ultimo_registro, cb.dt_inicio::timestamptz) < now() - make_interval(days => lim.dias)

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
'Bloco 3 (Gargalos). 6 categorias fechadas via UNION ALL, regra de negócio verbatim docs/schema_sistema.sql:1381-1428 (AD-008) -- só as colunas de exibição (nome_contratante, dt_referencia sempre populado, dias_em_aberto, id_usuario_gestora/nome_gestora) são acréscimo da feature visao-gerencial. Contrato de Coalizão (sem dim_mandato) nunca gera linha de categoria cadastro -- comportamento correto por construção (JOIN dim_mandato não casa), não um bug. Limiares de formulario_aberto e sem_registro_recente vêm de ref_limiar_pendencia (AD-041, correção da violação de AD-004): nenhum INTERVAL fica cravado no corpo, e mudar o número é UPDATE na tabela, não deploy. Limiar inativo desliga a categoria correspondente, de propósito.';
