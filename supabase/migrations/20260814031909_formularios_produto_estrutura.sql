-- =============================================================================
-- formularios-produto: T1 -- DDL fat_submissao + fat_resposta_metrica,
-- verbatim docs/schema_sistema.sql:747-783 (AD-008). Nenhuma coluna, CHECK,
-- índice ou comentário alterado -- só CREATE ... IF NOT EXISTS (AD-025,
-- provisionamento incremental). Confirmado por introspecção antes desta
-- migration: nenhuma das 2 tabelas existia ainda no projeto de dev.
-- =============================================================================

-- Uma linha = uma resposta de uma pessoa a um formulário, num contrato.
-- docs/schema_sistema.sql:747-771.
CREATE TABLE IF NOT EXISTS fat_submissao (
  id_submissao            BIGSERIAL PRIMARY KEY,
  id_contrato             BIGINT   NOT NULL REFERENCES fat_contrato(id_contrato) ON DELETE RESTRICT,
  id_formulario           BIGINT   NOT NULL REFERENCES ref_formulario(id_formulario),
  versao_formulario       SMALLINT NOT NULL,
  id_usuario_respondente  BIGINT   REFERENCES dim_usuario(id_usuario),
  respostas               JSONB    NOT NULL,
  momento                 TEXT,
  aceite_em               TIMESTAMPTZ,
  enviada_em              TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizada_em           TIMESTAMPTZ,
  CONSTRAINT ck_submissao_momento CHECK (momento IS NULL OR momento IN ('inicio','meio','fim','parcial','final')),
  CONSTRAINT ck_submissao_respostas CHECK (jsonb_typeof(respostas) = 'object')
);

-- Uma submissão por respondente × formulário × momento. Reedição atualiza a linha.
CREATE UNIQUE INDEX IF NOT EXISTS uq_submissao_respondente
  ON fat_submissao (id_contrato, id_formulario, id_usuario_respondente, COALESCE(momento, 'unico'))
  WHERE id_usuario_respondente IS NOT NULL;

COMMENT ON COLUMN fat_submissao.id_usuario_respondente IS
'Nulo apenas em submissão importada de base legada, onde o respondente não é identificável.';

COMMENT ON COLUMN fat_submissao.versao_formulario IS
'A resposta sabe contra qual versão do formulário foi dada. Sem isso, comparar avaliações entre edições é comparar perguntas diferentes.';

-- Uma linha = o valor de uma métrica em uma submissão.
-- Escrita por trigger a partir de ref_metrica_formulario. O JSONB continua
-- sendo a verdade da resposta; esta tabela é a superfície de agregação.
-- docs/schema_sistema.sql:773-783.
CREATE TABLE IF NOT EXISTS fat_resposta_metrica (
  id_submissao  BIGINT NOT NULL REFERENCES fat_submissao(id_submissao) ON DELETE CASCADE,
  id_metrica    BIGINT NOT NULL REFERENCES ref_metrica_formulario(id_metrica) ON DELETE CASCADE,
  valor_num     NUMERIC(6,2),
  valor_bool    BOOLEAN,
  CONSTRAINT pk_resposta_metrica PRIMARY KEY (id_submissao, id_metrica),
  CONSTRAINT ck_resposta_metrica_valor CHECK (valor_num IS NOT NULL OR valor_bool IS NOT NULL)
);
