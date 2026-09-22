-- =============================================================================
-- pll-dashboard-agenda: T1 -- fat_contrato.origem_encerramento (D-1)
--
-- O banco distingue hoje só ativo/concluido/nao_concluido. O PLL precisa
-- diferenciar, dentro de nao_concluido, Desistente (o mentorado saiu) de
-- Desligado (o programa o desligou) -- jornada B1.4. Coluna nova, nullable,
-- sem DEFAULT; obrigatória apenas quando status = 'nao_concluido', mesmo
-- padrão de ck_contrato_motivo (docs/schema_sistema.sql:513).
--
-- Verificação prévia em dev (2026-09-22): SELECT count(*) FROM fat_contrato
-- WHERE status = 'nao_concluido' = 0. Sem linha existente que quebre o
-- segundo CHECK -- entra direto validado, sem NOT VALID/backfill.
-- =============================================================================

ALTER TABLE fat_contrato
  ADD COLUMN IF NOT EXISTS origem_encerramento TEXT;

ALTER TABLE fat_contrato
  ADD CONSTRAINT ck_contrato_origem_encerramento
  CHECK (origem_encerramento IS NULL OR origem_encerramento IN ('desistencia', 'desligamento'));

ALTER TABLE fat_contrato
  ADD CONSTRAINT ck_contrato_origem_obrigatoria
  CHECK (status <> 'nao_concluido' OR origem_encerramento IS NOT NULL);

COMMENT ON COLUMN fat_contrato.origem_encerramento IS
'Só para status = nao_concluido: desistencia (o participante saiu) ou desligamento (o programa o desligou). NULL para ativo/concluido -- ausência é NULL, nunca sentinela (AD-005). Nasceu para o PLL (D-1), mas a coluna é da tabela compartilhada (AD-012); Estratégia/Coalizão continuam sem preenchê-la.';
