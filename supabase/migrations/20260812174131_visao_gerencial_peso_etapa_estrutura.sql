-- =============================================================================
-- visao-gerencial-g1-g2 (.specs/features/visao-gerencial-g1-g2/): T1 -- DDL de
-- ref_peso_etapa, catálogo GRANT-only (AD-030) que faltava para calcular G1
-- (carteira ponderada, Constituição §2.6) -- achado de Design registrado em
-- spec.md ("Achado novo: G1 exige peso por etapa configurável...").
--
-- 2 colunas apenas (id_etapa, peso): ref_etapa.id_produto já determina o
-- produto de cada etapa, então uma coluna id_produto redundante aqui não
-- ganha nada (Tech Decisions, design.md). Grants/RLS-disable e seed ficam em
-- migrations próprias (T2/T3) -- esta é só DDL, mesmo padrão de
-- 20260810191659_catalogos_referencia_estrutura.sql.
--
-- CREATE TABLE IF NOT EXISTS -- idempotência, mesmo padrão de toda migration
-- de estrutura já provisionada neste projeto.
-- =============================================================================

CREATE TABLE IF NOT EXISTS ref_peso_etapa (
  id_etapa  BIGINT        PRIMARY KEY REFERENCES ref_etapa(id_etapa),
  peso      NUMERIC(5,2)  NOT NULL DEFAULT 1,
  CONSTRAINT ck_peso_etapa_positivo CHECK (peso > 0)
);
