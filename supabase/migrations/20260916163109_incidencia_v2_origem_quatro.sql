-- =============================================================================
-- fatos-geradores-ciclo-vida: T3 -- rel_fato_origem ganha as 4 origens
-- (Pré-Insight/Registro além de Meta/Insight já existentes), FGC-15.
--
-- id_pre_insight/id_registro nullable, mesmo padrão de id_meta/id_insight
-- (ON DELETE CASCADE -- apagar a origem remove só a linha de vínculo, nunca o
-- Fato Gerador em si; spec.md P2 "Registro e Pré-Insight como origem" AC4).
--
-- ck_fato_origem reescrita: era "id_meta OR id_insight", passa a "ao menos
-- uma das quatro" -- base é o CHECK existente
-- (20260813191715_incidencia_encontros_estrutura.sql:171), só a lista de
-- colunas cresce.
--
-- Nenhum índice UNIQUE novo para id_pre_insight/id_registro: tasks.md T3
-- Done-when pede só as 2 colunas + o CHECK reescrito -- os 2 UNIQUE parciais
-- existentes (uq_fato_origem_meta/uq_fato_origem_insight) não fazem parte do
-- escopo desta task.
-- =============================================================================

ALTER TABLE rel_fato_origem
  ADD COLUMN IF NOT EXISTS id_pre_insight BIGINT REFERENCES fat_pre_insight(id_pre_insight) ON DELETE CASCADE;

ALTER TABLE rel_fato_origem
  ADD COLUMN IF NOT EXISTS id_registro BIGINT REFERENCES fat_registro(id_registro) ON DELETE CASCADE;

ALTER TABLE rel_fato_origem
  DROP CONSTRAINT IF EXISTS ck_fato_origem;

ALTER TABLE rel_fato_origem
  ADD CONSTRAINT ck_fato_origem CHECK (
    id_meta IS NOT NULL OR id_insight IS NOT NULL OR
    id_pre_insight IS NOT NULL OR id_registro IS NOT NULL);

COMMENT ON TABLE rel_fato_origem IS
'Vínculo em tabela, não colunas no fato: a jornada permite Meta, Insight, Pré-Insight e/ou Registro como origem, e permite fato sem origem -- que é simplesmente a ausência de linha aqui (FGC-15). ck_fato_origem exige ao menos uma das quatro quando existe linha.';
