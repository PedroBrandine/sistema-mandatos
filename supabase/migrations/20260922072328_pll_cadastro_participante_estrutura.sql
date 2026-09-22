-- =============================================================================
-- pll-cadastro-participantes: T2 -- DDL de fat_cadastro_participante (design.md,
-- Data Models). Staging da inscrição do PLL: dado autodeclarado pela planilha
-- externa (Anexo A, 25 campos), promovido a dim_mandato/fat_contrato só
-- quando vinculado ao TSE (id_contrato/id_vinculo_tse) -- nunca sobrescreve
-- dado confirmado do TSE (AD-040, D-4 de spec.md).
--
-- Nome sem sufixo `_pll` (AD-012): tabela genérica, discriminada por
-- id_produto -- mesmo padrão de fat_registro/fat_encontro.
-- =============================================================================

CREATE TABLE IF NOT EXISTS fat_cadastro_participante (
  id_cadastro_participante BIGSERIAL PRIMARY KEY,
  id_produto               BIGINT NOT NULL REFERENCES ref_produto(id_produto),
  id_projeto               BIGINT REFERENCES ref_projeto(id_projeto),
  id_contrato              BIGINT REFERENCES fat_contrato(id_contrato), -- nulo até vínculo TSE
  id_vinculo_tse           BIGINT REFERENCES rel_mandato_candidatura(id_vinculo_tse),

  -- Dados Pessoais (12 campos do Anexo A)
  papel                texto_limpo NOT NULL, -- 'mentorado' | 'mentor'
  nome_completo        texto_limpo NOT NULL,
  dt_nascimento        DATE,
  email                TEXT NOT NULL,
  telefone             texto_limpo,
  identidade_genero    texto_limpo,
  orientacao_sexual    texto_limpo,
  cor_raca             TEXT,
  deficiencias         texto_limpo,
  partido_filiado      texto_limpo,
  tempo_na_politica    texto_limpo,
  conhecia_legisla     BOOLEAN,

  -- Dados do Mandato autodeclarados (7 campos) -- pré-vínculo, nunca sobrescreve dim_mandato
  nome_parlamentar       texto_limpo,
  cor_raca_parlamentar   TEXT,
  partido_parlamentar    texto_limpo,
  estado_eleicao         CHAR(2),
  cargos_anteriores      texto_limpo,
  mandatos_anteriores    texto_limpo,
  rede_social            texto_limpo,

  -- Pautas Prioritárias (6 campos, D-5)
  nota_educacao             SMALLINT,
  nota_seguranca_publica    SMALLINT,
  nota_modernizacao_estado  SMALLINT,
  nota_clima                SMALLINT,
  outras_pautas             TEXT[],
  especifique_pauta         texto_limpo,

  -- Editáveis no sistema (PLL-CP-20…25), não vêm da planilha
  desafios              TEXT[] NOT NULL DEFAULT '{}',
  destaques             TEXT[] NOT NULL DEFAULT '{}',
  ambicao_texto         texto_limpo,
  ambicao_tags          TEXT[] NOT NULL DEFAULT '{}',
  swot_forcas           TEXT[] NOT NULL DEFAULT '{}',
  swot_fraquezas        TEXT[] NOT NULL DEFAULT '{}',
  swot_oportunidades    TEXT[] NOT NULL DEFAULT '{}',
  swot_ameacas          TEXT[] NOT NULL DEFAULT '{}',

  status_cadastro    TEXT NOT NULL DEFAULT 'incompleto',
  importado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  importado_por      BIGINT REFERENCES dim_usuario(id_usuario),
  atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ck_cadastro_papel CHECK (papel IN ('mentorado', 'mentor')),
  CONSTRAINT ck_cadastro_email CHECK (email = lower(btrim(email)) AND email LIKE '%@%.%'),
  CONSTRAINT ck_cadastro_status CHECK (status_cadastro IN ('completo', 'incompleto', 'pendente_revisao')),
  CONSTRAINT ck_cadastro_notas CHECK (
    (nota_educacao IS NULL OR nota_educacao BETWEEN 1 AND 5) AND
    (nota_seguranca_publica IS NULL OR nota_seguranca_publica BETWEEN 1 AND 5) AND
    (nota_modernizacao_estado IS NULL OR nota_modernizacao_estado BETWEEN 1 AND 5) AND
    (nota_clima IS NULL OR nota_clima BETWEEN 1 AND 5)
  ),
  CONSTRAINT ck_cadastro_estado_eleicao CHECK (estado_eleicao IS NULL OR estado_eleicao ~ '^[A-Z]{2}$')
);

-- Um e-mail não se repete dentro do mesmo projeto/edição -- sustenta o upsert
-- de reimportação (PLL-CP-03).
CREATE UNIQUE INDEX IF NOT EXISTS uq_cadastro_participante_email_projeto
  ON fat_cadastro_participante (id_projeto, email);

COMMENT ON TABLE fat_cadastro_participante IS
'Staging da inscrição do PLL: dado autodeclarado pela planilha externa, promovido a dim_mandato/fat_contrato
só quando vinculado ao TSE (id_contrato/id_vinculo_tse). Nunca sobrescreve dado confirmado do TSE.';
