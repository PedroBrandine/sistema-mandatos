-- =============================================================================
-- visao-gerencial-g3-g6: corrige vw_cobertura_registro_mensal (T5) e
-- vw_resposta_formulario_mensal (T6) -- achado real ao implementar T9
-- (buscarSaudeCobertura): as duas views pré-agregavam por mes_referencia em
-- SQL, perdendo id_contrato/id_produto -- impossível filtrar a evolução
-- pela barra de recorte (produto/projeto/gestora/mentor) depois, e contradiz
-- o próprio padrão já estabelecido em src/backend/queries/visao-gerencial.ts
-- ("agregação feita em TS, não em SQL, pra não cair na armadilha de
-- recompor soma/mediana de sub-grupos já agregados ao combinar filtros
-- parciais" -- comentário literal de buscarCicloEtapa, T6 de
-- visao-gerencial-g1-g2). Mesmo padrão de vw_carteira_ponderada_mensal (T4),
-- que já preservava id_contrato/id_produto por linha.
--
-- Forward-only -- não edita as migrations 20260814211954/20260814212443 já
-- aplicadas, só substitui a definição das duas views. DROP + CREATE (não
-- CREATE OR REPLACE): o shape de colunas mudou por completo (de agregado
-- por mês pra grão fino por contrato/formulário), e Postgres recusa
-- CREATE OR REPLACE VIEW quando renomeia/remove coluna existente (42P16).
-- =============================================================================

DROP VIEW IF EXISTS vw_cobertura_registro_mensal;
DROP VIEW IF EXISTS vw_resposta_formulario_mensal;

CREATE VIEW vw_cobertura_registro_mensal WITH (security_invoker = true) AS
WITH meses AS (
  SELECT generate_series(
    date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
    date_trunc('month', CURRENT_DATE),
    INTERVAL '1 month'
  )::date AS mes_referencia
), fim_mes AS (
  SELECT mes_referencia, (mes_referencia + INTERVAL '1 month' - INTERVAL '1 day')::date AS fim_do_mes
  FROM meses
)
SELECT fm.mes_referencia, c.id_contrato, c.id_produto,
       EXISTS (
         SELECT 1 FROM fat_registro r
          WHERE r.id_contrato = c.id_contrato
            AND r.ocorrido_em BETWEEN (fm.fim_do_mes - INTERVAL '45 days') AND fm.fim_do_mes
       ) AS tem_registro
FROM fim_mes fm
JOIN fat_contrato c
  ON c.dt_inicio <= fm.fim_do_mes
 AND (c.dt_fim IS NULL OR c.dt_fim > fm.fim_do_mes);

COMMENT ON VIEW vw_cobertura_registro_mensal IS
'Evolução mensal de G3 (visao-gerencial-g3-g6, T5, corrigida). 1 linha por (mês, contrato ativo naquele mês) nos últimos 12 meses -- grão fino, não pré-agregado, pra permitir filtrar por FiltroRecorte antes de agregar em TS (buscarSaudeCobertura, T9). tem_registro = existe fat_registro nos 45 dias anteriores ao fim daquele mês. TODO(limiares): janela de 45 dias hoje escrita na view (AD-004).';

CREATE VIEW vw_resposta_formulario_mensal WITH (security_invoker = true) AS
WITH meses AS (
  SELECT generate_series(
    date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
    date_trunc('month', CURRENT_DATE),
    INTERVAL '1 month'
  )::date AS mes_referencia
), fim_mes AS (
  SELECT mes_referencia, (mes_referencia + INTERVAL '1 month' - INTERVAL '1 day')::date AS fim_do_mes
  FROM meses
)
SELECT fm.mes_referencia, rfc.id_contrato, rfc.id_formulario, c.id_produto,
       EXISTS (
         SELECT 1 FROM fat_submissao fs
          WHERE fs.id_contrato = rfc.id_contrato AND fs.id_formulario = rfc.id_formulario
            AND fs.enviada_em <= fm.fim_do_mes
       ) AS tem_resposta
FROM fim_mes fm
JOIN rel_formulario_contrato rfc ON rfc.dt_abertura <= fm.fim_do_mes
JOIN fat_contrato c ON c.id_contrato = rfc.id_contrato;

COMMENT ON VIEW vw_resposta_formulario_mensal IS
'Evolução mensal de G4 (visao-gerencial-g3-g6, T6, corrigida). 1 linha por (mês, contrato, formulário) já aberto até o fim daquele mês -- grão fino, não pré-agregado, mesmo motivo de T5. tem_resposta = existe fat_submissao com enviada_em até o fim daquele mês.';

-- Re-GRANT obrigatório (AD-025) -- mesmo padrão de todas as migrations desta feature.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
