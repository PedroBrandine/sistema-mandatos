-- ficha-mandato-contrato: T6 -- colunas novas em dim_mandato e fat_contrato
-- (design.md, "Data Models" > "Colunas novas"). As tres nascem anulaveis --
-- ausencia eh NULL, nunca string vazia nem '{}' (AD-005).

-- Identidade editorial do mandato (FMC-05, FMC-06).
ALTER TABLE dim_mandato
  ADD COLUMN IF NOT EXISTS minibiografia     texto_limpo,
  ADD COLUMN IF NOT EXISTS principais_pautas TEXT[];

COMMENT ON COLUMN dim_mandato.minibiografia IS
'Texto livre da aba Informações Gerais (FMC-05). Ausente = NULL (AD-005), nunca string vazia.';

COMMENT ON COLUMN dim_mandato.principais_pautas IS
'Texto livre, um elemento por pauta (FMC-06, A-03). Distinto de rel_mandato_agenda_tematica, que é catálogo.';

-- Ponto Focal Legisla do contrato (FMC-11, A-05).
ALTER TABLE fat_contrato
  ADD COLUMN IF NOT EXISTS id_usuario_ponto_focal BIGINT REFERENCES dim_usuario(id_usuario);

COMMENT ON COLUMN fat_contrato.id_usuario_ponto_focal IS
'Tag de usuário Legisla como ponto focal do contrato (FMC-11). Só uma referência de menção -- não cria papel de RLS novo.';
