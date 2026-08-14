-- =============================================================================
-- formularios-produto: T5 -- DDL fat_gip + fat_gip_dimensao, verbatim
-- docs/schema_sistema.sql:983-1022 (AD-008). Seção 7 (Planejamento) do schema
-- aprovado, mas provisionada aqui por decisão explícita de Pedro (Discuss,
-- ver context.md "Escopo do GIP") -- sem isso, capturar o GIP como JSONB
-- genérico em fat_submissao não teria consumidor real.
--
-- Depende de fat_submissao (T1, já aplicada -- fat_gip.id_submissao) e de
-- ref_dimensao_gip (Trilha C, já provisionada e seedada com 4 dimensões
-- ativas -- confirmado antes desta migration, AD-025).
-- =============================================================================

CREATE TABLE fat_gip (
  id_gip                    BIGSERIAL PRIMARY KEY,
  id_contrato               BIGINT NOT NULL REFERENCES fat_contrato(id_contrato) ON DELETE RESTRICT,
  momento                   TEXT   NOT NULL,
  id_submissao              BIGINT REFERENCES fat_submissao(id_submissao),
  posicao_lideranca         BOOLEAN,
  rotina_trabalho           texto_limpo,
  comunicacao_interna       texto_limpo,
  rotinas_feedback          texto_limpo,
  gip_estrutura_organizada  BOOLEAN,
  gip_entregas_acontecendo  BOOLEAN,
  quadrante                 TEXT GENERATED ALWAYS AS (
    CASE
      WHEN gip_estrutura_organizada IS NULL OR gip_entregas_acontecendo IS NULL THEN NULL
      WHEN gip_estrutura_organizada AND gip_entregas_acontecendo         THEN 'Q1 - Estrutura e entrega'
      WHEN gip_estrutura_organizada AND NOT gip_entregas_acontecendo     THEN 'Q2 - Estrutura sem entrega'
      WHEN NOT gip_estrutura_organizada AND gip_entregas_acontecendo     THEN 'Q3 - Entrega sem estrutura'
      ELSE 'Q4 - Sem estrutura e sem entrega'
    END) STORED,
  aplicado_em               DATE NOT NULL,
  criado_em                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_gip_contrato_momento UNIQUE (id_contrato, momento),
  CONSTRAINT ck_gip_momento CHECK (momento IN ('inicio','meio','fim'))
);

COMMENT ON TABLE fat_gip IS
'Uma linha = uma aplicação do GIP (início/meio/fim) num contrato. id_submissao rastreia qual envio de fat_submissao a gerou -- o JSONB continua sendo a verdade da resposta, esta tabela é a superfície estruturada (quadrante calculado, evolução por dimensão).';

CREATE TABLE fat_gip_dimensao (
  id_gip      BIGINT   NOT NULL REFERENCES fat_gip(id_gip) ON DELETE CASCADE,
  id_dimensao BIGINT   NOT NULL REFERENCES ref_dimensao_gip(id_dimensao),
  eixo        TEXT     NOT NULL,
  valor       SMALLINT NOT NULL,
  CONSTRAINT pk_gip_dimensao PRIMARY KEY (id_gip, id_dimensao, eixo),
  CONSTRAINT ck_gip_dimensao_eixo CHECK (eixo IN ('regua_sonhos','onde_chegamos'))
);

COMMENT ON COLUMN fat_gip_dimensao.eixo IS
'D6: regua_sonhos é a Régua dos Sonhos (aspiração pactuada no Raio-X, momento=inicio). onde_chegamos é a leitura posterior (momento=meio/fim). A distância entre os eixos é a medida (vw_gip_evolucao, T9).';
