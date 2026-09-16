-- =============================================================================
-- fatos-geradores-ciclo-vida: T2 -- titulo/situacao/dt_prevista em
-- fat_fato_gerador (AD-054, FGC-06/FGC-09/FGC-12).
--
-- titulo TEXT nullable (context.md D-7, decisão de Pedro): NOT NULL quebraria
-- fatos já gravados; obrigatoriedade fica no formulário novo (T8/T17), não no
-- schema. Fatos antigos exibem descricao_evidencia truncada como cabeçalho.
--
-- situacao TEXT NOT NULL DEFAULT 'realizado': todo fato pré-existente é
-- "já aconteceu" -- o DEFAULT preenche as linhas atuais sem mudar
-- comportamento.
--
-- A constraint mais delicada (design.md "A constraint mais delicada"):
-- dt_ocorrencia era NOT NULL -- um fato projetado não tem data de ocorrência
-- ainda. Sequência forward-only: solta o NOT NULL de coluna PRIMEIRO, ADD
-- CONSTRAINT ck_fato_situacao_data DEPOIS. Estruturalmente seguro sem
-- NOT VALID: toda linha existente já cai em situacao='realizado' (DEFAULT) +
-- dt_ocorrencia preenchida (garantido pela NOT NULL que só é solta aqui, na
-- mesma migration) -- não há sequência de eventos em que uma linha gravada
-- antes desta migration viole o CHECK novo, em nenhum ambiente.
-- =============================================================================

ALTER TABLE fat_fato_gerador
  ADD COLUMN IF NOT EXISTS titulo TEXT;

ALTER TABLE fat_fato_gerador
  ADD COLUMN IF NOT EXISTS situacao TEXT NOT NULL DEFAULT 'realizado';

ALTER TABLE fat_fato_gerador
  ADD COLUMN IF NOT EXISTS dt_prevista DATE;

ALTER TABLE fat_fato_gerador
  DROP CONSTRAINT IF EXISTS ck_fato_situacao;

ALTER TABLE fat_fato_gerador
  ADD CONSTRAINT ck_fato_situacao CHECK (situacao IN ('projetado', 'realizado'));

ALTER TABLE fat_fato_gerador
  ALTER COLUMN dt_ocorrencia DROP NOT NULL;

ALTER TABLE fat_fato_gerador
  DROP CONSTRAINT IF EXISTS ck_fato_situacao_data;

ALTER TABLE fat_fato_gerador
  ADD CONSTRAINT ck_fato_situacao_data CHECK (
    (situacao = 'realizado' AND dt_ocorrencia IS NOT NULL) OR
    (situacao = 'projetado' AND dt_prevista IS NOT NULL));

COMMENT ON COLUMN fat_fato_gerador.titulo IS
'Nullable de propósito (AD-054/context.md D-7): NOT NULL quebraria fatos já gravados, e forward-only não volta atrás. Obrigatório no formulário novo (wizard) -- fatos antigos exibem descricao_evidencia truncada como cabeçalho.';

COMMENT ON COLUMN fat_fato_gerador.situacao IS
'projetado = ainda vai acontecer (exige dt_prevista, proíbe dt_ocorrencia por ck_fato_situacao_data), realizado = já aconteceu (default, cobre todo fato existente). Projetado não entra no IIP -- mv_iip_contrato filtra por situacao (T4, AD-054).';

COMMENT ON COLUMN fat_fato_gerador.dt_prevista IS
'Nullable -- só preenchida quando situacao=''projetado''. Passar da data prevista sem realizar o fato NÃO transiciona automaticamente (Edge Case do spec.md).';
