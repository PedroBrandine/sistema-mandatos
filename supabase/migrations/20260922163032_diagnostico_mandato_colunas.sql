-- diagnostico-mandato-estrategia: colunas novas em dim_mandato (spec.md,
-- P1 "Campos de texto livre do Diagnóstico" e P1 "Análise SWOT do mandato").
-- Todas anuláveis -- ausência é NULL, nunca array/string vazia (AD-005,
-- mesma convenção de minibiografia/principais_pautas).

ALTER TABLE dim_mandato
  ADD COLUMN IF NOT EXISTS principais_destaques  TEXT[],
  ADD COLUMN IF NOT EXISTS cargos_legislatura     TEXT[],
  ADD COLUMN IF NOT EXISTS principais_pls         TEXT[],
  ADD COLUMN IF NOT EXISTS principais_noticias    JSONB,
  ADD COLUMN IF NOT EXISTS swot_forcas            TEXT[],
  ADD COLUMN IF NOT EXISTS swot_fraquezas         TEXT[],
  ADD COLUMN IF NOT EXISTS swot_oportunidades     TEXT[],
  ADD COLUMN IF NOT EXISTS swot_ameacas           TEXT[];

ALTER TABLE dim_mandato
  ADD CONSTRAINT ck_mandato_principais_noticias
  CHECK (principais_noticias IS NULL OR jsonb_typeof(principais_noticias) = 'array');

COMMENT ON COLUMN dim_mandato.principais_destaques IS
'Texto livre da aba Diagnóstico, um elemento por destaque. Ausente = NULL, nunca array vazio.';

COMMENT ON COLUMN dim_mandato.cargos_legislatura IS
'Texto livre da aba Diagnóstico, um elemento por cargo/função na legislatura. Ausente = NULL, nunca array vazio.';

COMMENT ON COLUMN dim_mandato.principais_pls IS
'Texto livre da aba Diagnóstico, um elemento por projeto de lei em destaque. Ausente = NULL, nunca array vazio.';

COMMENT ON COLUMN dim_mandato.principais_noticias IS
'Lista de notícias da aba Diagnóstico: array JSONB de objetos {titulo, url}. Ausente = NULL, nunca array vazio.';

COMMENT ON COLUMN dim_mandato.swot_forcas IS
'Análise SWOT do mandato (aba Diagnóstico) -- conceito distinto do SWOT de cad_participante_pll (PLL) e do antigo oportunidade/ameaça de fat_objetivo_especifico (removido, AD-049). Ausente = NULL, nunca array vazio.';

COMMENT ON COLUMN dim_mandato.swot_fraquezas IS
'Análise SWOT do mandato (aba Diagnóstico). Ver comentário de swot_forcas. Ausente = NULL, nunca array vazio.';

COMMENT ON COLUMN dim_mandato.swot_oportunidades IS
'Análise SWOT do mandato (aba Diagnóstico). Ver comentário de swot_forcas. Ausente = NULL, nunca array vazio.';

COMMENT ON COLUMN dim_mandato.swot_ameacas IS
'Análise SWOT do mandato (aba Diagnóstico). Ver comentário de swot_forcas. Ausente = NULL, nunca array vazio.';
