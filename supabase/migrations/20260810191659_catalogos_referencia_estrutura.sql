-- =============================================================================
-- Trilha C (.specs/features/catalogos-referencia/): as 12 tabelas ref_* que
-- faltam do modelo aprovado (docs/schema_sistema.sql:170-301, verbatim),
-- pré-requisito estrutural de Operação/Planejamento/Incidência.
--
-- Sem RLS: catálogo somente-leitura sem id_contrato/carteira pra filtrar por
-- linha -- exceção documentada em AD-030 (.specs/STATE.md). RLS-disable +
-- GRANT ficam na próxima migração (catalogos_referencia_grants); esta aqui é
-- só DDL, na ordem de dependência interna do design.md:
--   Grupo A (independentes) -> Grupo C (ref_tipologia, depende de A) ->
--   Grupo B (cadeia de etapa, depende só de ref_produto, já existente).
--
-- CREATE TABLE IF NOT EXISTS em todas -- idempotência (spec AC17), mesmo
-- padrão de 0007_catalogos_fundacao.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Grupo A -- catálogos folha, independentes entre si.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ref_preditor (
  id_preditor BIGSERIAL PRIMARY KEY,
  nome        TEXT     NOT NULL UNIQUE,
  ordem       SMALLINT,
  ativo       BOOLEAN  NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS ref_agenda_tematica (
  id_agenda BIGSERIAL PRIMARY KEY,
  nome      TEXT     NOT NULL UNIQUE,
  ordem     SMALLINT,
  ativo     BOOLEAN  NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS ref_perfil_atuacao (
  id_perfil BIGSERIAL PRIMARY KEY,
  nome      TEXT     NOT NULL UNIQUE,
  ordem     SMALLINT,
  ativo     BOOLEAN  NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS ref_pilar_insight (
  id_pilar  BIGSERIAL PRIMARY KEY,
  codigo    TEXT     NOT NULL UNIQUE,
  nome      TEXT     NOT NULL UNIQUE,
  ordem     SMALLINT,
  ativo     BOOLEAN  NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS ref_indicador (
  id_indicador BIGSERIAL PRIMARY KEY,
  nome         TEXT          NOT NULL UNIQUE,
  peso_iip     NUMERIC(5,2)  NOT NULL,
  ativo        BOOLEAN       NOT NULL DEFAULT true,
  CONSTRAINT ck_indicador_peso CHECK (peso_iip >= 0)
);

CREATE TABLE IF NOT EXISTS ref_nivel_iip (
  codigo  TEXT          PRIMARY KEY,
  rotulo  TEXT          NOT NULL,
  valor   NUMERIC(5,2)  NOT NULL,
  ordem   SMALLINT      NOT NULL,
  CONSTRAINT ck_nivel_valor CHECK (valor >= 0)
);

CREATE TABLE IF NOT EXISTS ref_dimensao_gip (
  id_dimensao BIGSERIAL PRIMARY KEY,
  codigo      TEXT     NOT NULL UNIQUE,
  nome        TEXT     NOT NULL,
  valor_min   SMALLINT NOT NULL DEFAULT 1,
  valor_max   SMALLINT NOT NULL DEFAULT 4,
  ordem       SMALLINT NOT NULL,
  ativo       BOOLEAN  NOT NULL DEFAULT true,
  CONSTRAINT ck_dimensao_faixa CHECK (valor_max > valor_min)
);

-- ---------------------------------------------------------------------------
-- Grupo C -- depende do Grupo A (ref_preditor, ref_nivel_iip, ref_indicador).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ref_tipologia (
  id_tipologia      BIGSERIAL PRIMARY KEY,
  grupo             TEXT    NOT NULL,
  tipologia         TEXT    NOT NULL,
  estado            TEXT    NOT NULL,
  id_preditor_1     BIGINT  REFERENCES ref_preditor(id_preditor),
  id_preditor_2     BIGINT  REFERENCES ref_preditor(id_preditor),
  nivel_d1_padrao   TEXT    REFERENCES ref_nivel_iip(codigo),
  nivel_d2_padrao   TEXT    REFERENCES ref_nivel_iip(codigo),
  nivel_d3_padrao   TEXT    REFERENCES ref_nivel_iip(codigo),
  id_indicador      BIGINT  REFERENCES ref_indicador(id_indicador),
  observacao        TEXT,
  ativo             BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT uq_tipologia_tripla UNIQUE (grupo, tipologia, estado),
  CONSTRAINT ck_tipologia_preditores CHECK (
    id_preditor_2 IS NULL
    OR (id_preditor_1 IS NOT NULL AND id_preditor_2 <> id_preditor_1))
);

-- ---------------------------------------------------------------------------
-- Grupo B -- cadeia de etapa. Depende só de ref_produto (já existe, 0007).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ref_etapa (
  id_etapa               BIGSERIAL PRIMARY KEY,
  id_produto             BIGINT   NOT NULL REFERENCES ref_produto(id_produto),
  codigo                 TEXT     NOT NULL,
  nome                   TEXT     NOT NULL,
  ordem                  SMALLINT NOT NULL,
  duracao_prevista_dias  SMALLINT,
  gera_registro          BOOLEAN  NOT NULL DEFAULT true,
  CONSTRAINT uq_etapa_produto_codigo UNIQUE (id_produto, codigo),
  CONSTRAINT uq_etapa_produto_ordem  UNIQUE (id_produto, ordem),
  CONSTRAINT ck_etapa_duracao CHECK (duracao_prevista_dias IS NULL OR duracao_prevista_dias > 0)
);

CREATE TABLE IF NOT EXISTS ref_tipo_registro (
  id_tipo_registro   BIGSERIAL PRIMARY KEY,
  id_etapa           BIGINT  NOT NULL REFERENCES ref_etapa(id_etapa),
  codigo             TEXT    NOT NULL,
  nome               TEXT    NOT NULL,
  permite_multiplos  BOOLEAN NOT NULL DEFAULT false,
  qtd_prevista       SMALLINT,
  schema_campos      JSONB   NOT NULL DEFAULT '{}'::jsonb,
  ativo              BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT uq_tipo_registro_etapa_codigo UNIQUE (id_etapa, codigo),
  CONSTRAINT ck_tipo_registro_qtd CHECK (qtd_prevista IS NULL OR permite_multiplos)
);

CREATE TABLE IF NOT EXISTS ref_formulario (
  id_formulario         BIGSERIAL PRIMARY KEY,
  id_etapa              BIGINT   NOT NULL REFERENCES ref_etapa(id_etapa),
  codigo                TEXT     NOT NULL UNIQUE,
  nome                  TEXT     NOT NULL,
  respondente           TEXT,
  exige_anexo           BOOLEAN  NOT NULL DEFAULT false,
  permite_edicao_aberta BOOLEAN  NOT NULL DEFAULT true,
  versao                SMALLINT NOT NULL DEFAULT 1,
  schema_campos         JSONB    NOT NULL DEFAULT '{}'::jsonb,
  ativo                 BOOLEAN  NOT NULL DEFAULT true,
  CONSTRAINT ck_formulario_respondente CHECK (respondente IS NULL OR respondente IN
    ('assessor','cargo_cg_parlamentar','gestora','mentor','mentorado','mandato'))
);

CREATE TABLE IF NOT EXISTS ref_metrica_formulario (
  id_metrica     BIGSERIAL PRIMARY KEY,
  id_formulario  BIGINT  NOT NULL REFERENCES ref_formulario(id_formulario) ON DELETE CASCADE,
  codigo_campo   TEXT    NOT NULL,
  rotulo         TEXT    NOT NULL,
  tipo           TEXT    NOT NULL,
  eh_nps         BOOLEAN NOT NULL DEFAULT false,
  agrupador      TEXT,
  ativo          BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT uq_metrica_form_campo UNIQUE (id_formulario, codigo_campo),
  CONSTRAINT ck_metrica_tipo CHECK (tipo IN ('escala_0_10','escala_1_5','booleano','numero'))
);

-- Só uma pergunta por formulário pode ser a de recomendação (base do NPS).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_metrica_nps_por_formulario') THEN
    CREATE UNIQUE INDEX uq_metrica_nps_por_formulario
      ON ref_metrica_formulario (id_formulario) WHERE eh_nps;
  END IF;
END $$;
