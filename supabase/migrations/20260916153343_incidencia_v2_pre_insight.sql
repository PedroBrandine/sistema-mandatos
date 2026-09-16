-- =============================================================================
-- fatos-geradores-ciclo-vida: T1 -- fat_pre_insight (tabela nova, AD-055) +
-- RLS no mesmo DDL (AD-001) + GRANTs.
--
-- Colunas mínimas por decisão de Pedro (context.md D-5): conteúdo, data,
-- autor + timestamp (AD-006). Estrutura espelha fat_insight
-- (20260813191715_incidencia_encontros_estrutura.sql:100-111), sem os campos
-- de classificação (id_pilar, desdobramentos, comprovacao_dados) -- Pré-Insight
-- é o sinal bruto ainda não qualificado, antes de virar Insight (AD-058: sem
-- vínculo entre os dois, promover não apaga o original).
-- =============================================================================

CREATE TABLE IF NOT EXISTS fat_pre_insight (
  id_pre_insight    BIGSERIAL PRIMARY KEY,
  id_contrato       BIGINT NOT NULL REFERENCES fat_contrato(id_contrato) ON DELETE RESTRICT,
  conteudo          TEXT   NOT NULL,
  ocorrido_em       DATE,
  id_usuario_autor  BIGINT NOT NULL REFERENCES dim_usuario(id_usuario),
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE fat_pre_insight IS
'Entidade nova (AD-055): o sinal bruto captado pela assessoria antes de amadurecer em Insight. Coexiste com fat_insight -- promover não apaga o original (AD-058 fecha a relação entre os dois: nenhuma FK).';

-- RLS no mesmo DDL (AD-001) -- p_por_contrato espelha verbatim o predicado de
-- fat_insight (20260813192341_incidencia_encontros_rls.sql:31-38).
ALTER TABLE fat_pre_insight ENABLE ROW LEVEL SECURITY;
ALTER TABLE fat_pre_insight FORCE ROW LEVEL SECURITY;

CREATE POLICY p_por_contrato ON fat_pre_insight
  USING (app.papel_atual() IN ('admin','gestora')
         OR id_contrato = ANY(app.contratos_do_usuario()))
  WITH CHECK (app.papel_atual() IN ('admin','gestora')
         OR id_contrato = ANY(app.contratos_do_usuario()));

-- GRANTs: mesmos papéis/verbos de fat_insight
-- (20260813192816_incidencia_encontros_grants.sql) -- Mentor SELECT+INSERT+
-- UPDATE, Assessor SELECT+INSERT. Re-GRANT em bloco (AD-025): "ALL TABLES/
-- SEQUENCES IN SCHEMA public" só cobre o que já existia no momento do GRANT
-- anterior -- mesmo padrão de toda migration que já criou tabela nova em
-- public.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;

GRANT SELECT, INSERT, UPDATE ON fat_pre_insight TO legisla_mentor;
GRANT SELECT, INSERT ON fat_pre_insight TO legisla_assessor;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO legisla_mentor, legisla_assessor;
