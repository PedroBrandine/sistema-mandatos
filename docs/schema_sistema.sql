-- =============================================================================
-- schema_v4.sql
-- Sistema de Operações (Mandatos) — Legisla Brasil
-- Modelo de Dados v4 · DDL de referência
--
-- Alvo: PostgreSQL 15+ (usa security_invoker em views e GENERATED ... STORED)
-- Ordem: extensões → schemas → catálogos → plataforma → fundação → âncora →
--        TSE → operação → planejamento → incidência → saída → funções →
--        RLS → triggers → índices → grants → comments → seeds
--
-- Convenção: snake_case · ref_ catálogo · dim_ identidade · fat_ evento
--            rel_ vínculo · vw_ view · mv_ materialized view · log_ auditoria
--            pk_ / fk_ / uq_ / ck_ / ix_ para constraints e índices
--
-- -----------------------------------------------------------------------------
-- DECISÕES APLICADAS (D1–D13 respondidas pela operação)
--
-- D1  Idioma do schema: português, exceção declarada na Constituição. Sem mudança.
-- D2  Fórmula do IIP: insumos confirmados; aritmética final permanece com a área
--     de conhecimento. mv_iip_contrato expõe os componentes separados para que
--     fechar a fórmula seja trocar uma expressão, não migrar dado.
-- D3  contribuicao_legisla: escala 0 a 5 -> CHECK aplicado. Entrada no IIP ainda
--     depende de D2.
-- D4  Prospecção NÃO EXISTE como status: 'prospeccao' removido do CHECK,
--     dt_inicio passa a NOT NULL, o filtro sai de mv_numeros_impacto e do índice
--     parcial. Consequência a registrar: o sistema não guarda material anterior
--     à assinatura. Se a operação precisar disso, volta como tabela própria.
-- D5  Os 4 pilares de insight estão corretos -> seed confirmado.
-- D6  Régua dos Sonhos É o eixo 'regua_sonhos' do diagnóstico do gabinete,
--     sempre lido contra 'onde_chegamos'. Deixa de ser formulário com JSONB TBD:
--     sai de ref_formulario e vira eixo de fat_gip_dimensao, com vw_gip_evolucao
--     entregando a comparação e o gap por dimensão.
-- D7  id_mentorado é timestamp, não CPF -> alarme de LGPD encerrado.
-- D8  'legisla_aliada' segue ativo -> mantido em ref_tipo_registro.
-- D9  Etapas da Coalizão seguem EM ABERTO (provável reuso da régua de
--     Estratégia). Sem seed; o INSERT de clonagem está pronto na §16.
-- D10 Planejamento sobrescreve; memória fica em log_auditoria + snapshot mensal.
-- D11 Peso do Sucesso Mensal em escala 0–100. Já implementado.
-- D12 Backfill pré-2022 fica para depois.
-- D13 Formulário versionado na própria linha (codigo UNIQUE + versao).
--
-- -----------------------------------------------------------------------------
-- CORREÇÕES AO DOCUMENTO v4 DESCOBERTAS AO ESCREVER O DDL
--
-- C1. `fat_contrato.nivel_federativo` NÃO pode ser GENERATED: coluna gerada só
--     referencia colunas da própria linha, e o nível vem de `ref_cargo`.
--     Resolvido: coluna removida da tabela e derivada em `vw_contrato` e em
--     `mv_numeros_impacto` por JOIN. Efeito colateral desejável — corrigir
--     `ref_cargo` corrige o histórico inteiro.
--
-- C2. `dias_atraso` NÃO pode ser GENERATED em `fat_etapa_contrato` nem em
--     `fat_sucesso_mensal`: a expressão usa CURRENT_DATE, que é STABLE e não
--     IMMUTABLE. Resolvido: derivado em `vw_etapa_contrato`,
--     `vw_sucesso_mensal` e `vw_pendencias`.
--
-- C3. `dim_contratante.nome_normalizado` exige wrapper IMMUTABLE de unaccent
--     (`app.f_unaccent`) — `unaccent()` é STABLE por depender de dicionário e
--     é rejeitada em coluna gerada e em índice.
--
-- C4. PK de tabela particionada precisa conter a chave de partição:
--     `log_auditoria` → PK (id_log, ocorrido_em);
--     `tse.dim_candidatura` → PK (ano_eleicao, sq_candidato, nr_turno).
--
-- C5. Sem FK de `public` para `tse`: o ETL recarrega safra inteira e uma FK
--     apontando para dentro bloquearia DROP/TRUNCATE de partição. O vínculo é
--     validado por trigger de aplicação, não por constraint.
--
-- C6. DECISÃO NOVA (D13) — versionamento de formulário. Este DDL assume
--     `ref_formulario.codigo` UNIQUE com `versao` incrementada na própria linha
--     (o schema histórico fica implícito em `fat_submissao.respostas`, que é
--     autodescritivo). A alternativa é uma linha por versão, com
--     UNIQUE (codigo, versao). Decidir antes de publicar o primeiro formulário.
-- =============================================================================

-- Reset em ambiente de desenvolvimento (descomentar com consciência):
-- DROP SCHEMA IF EXISTS app, tse, stg CASCADE;
-- DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;

BEGIN;

SET client_min_messages = warning;

-- =============================================================================
-- 0. EXTENSÕES, SCHEMAS E HELPERS IMUTÁVEIS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS btree_gin;

CREATE SCHEMA IF NOT EXISTS app;   -- funções de sessão, RLS e recálculo
CREATE SCHEMA IF NOT EXISTS tse;   -- espelho read-only do TSE, por safra
CREATE SCHEMA IF NOT EXISTS stg;   -- staging de migração, descartável

COMMENT ON SCHEMA app IS 'Funções de sessão, políticas de RLS e rotinas de recálculo. Sem tabelas de negócio.';
COMMENT ON SCHEMA tse IS 'Espelho read-only dos dados eleitorais do TSE, particionado por safra. Alimentado por ETL idempotente. Nunca contém CPF.';
COMMENT ON SCHEMA stg IS 'Staging da migração das planilhas. Descartado ao fim da carga.';

-- Wrapper IMMUTABLE de unaccent (C3): habilita coluna gerada e índice.
CREATE OR REPLACE FUNCTION app.f_unaccent(TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

COMMENT ON FUNCTION app.f_unaccent(TEXT) IS
'unaccent() é STABLE e por isso rejeitada em coluna gerada e em índice. Este wrapper a declara IMMUTABLE, o que é seguro enquanto o dicionário unaccent não for alterado.';

-- Normalização usada em deduplicação e busca por nome.
CREATE OR REPLACE FUNCTION app.normaliza_nome(TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS
$$ SELECT btrim(regexp_replace(lower(app.f_unaccent($1)), '\s+', ' ', 'g')) $$;

-- Gate "ausência é NULL" aplicado no schema, não só na documentação.
-- Impede que os sentinelas encontrados nas planilhas atuais entrem no banco:
-- 'Pendente de Atualização' (8 colunas), 'Não Coletado' (4 colunas), '—', ''.
CREATE DOMAIN texto_limpo AS TEXT CHECK (
  VALUE IS NULL OR (
    btrim(VALUE) <> ''
    AND app.normaliza_nome(VALUE) NOT IN (
      'pendente de atualizacao', 'nao coletado', 'nao informado',
      'nao se aplica', 'n/a', 'na', 'nd', '-', '--', 'null', 'undefined', 'sem nome'
    )
  )
);

COMMENT ON DOMAIN texto_limpo IS
'TEXT que recusa string vazia e sentinelas de ausência. Pendência é derivada em vw_pendencias, nunca digitada. Aplicado nas colunas de atributo onde as planilhas atuais usam sentinela.';

-- =============================================================================
-- 1. CATÁLOGOS (ref_) — 16 tabelas
-- Domínio pequeno e estável vira CHECK; domínio editável pela operação vira ref_.
-- =============================================================================

CREATE TABLE ref_produto (
  id_produto            BIGSERIAL PRIMARY KEY,
  nome                  TEXT    NOT NULL UNIQUE,
  operado_pelo_sistema  BOOLEAN NOT NULL DEFAULT true,
  ativo                 BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE ref_projeto (
  id_projeto         BIGSERIAL PRIMARY KEY,
  nome               TEXT NOT NULL UNIQUE,
  tematica           TEXT,
  id_produto_padrao  BIGINT REFERENCES ref_produto(id_produto),
  dt_inicio          DATE,
  dt_fim             DATE,
  ativo              BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT ck_projeto_periodo CHECK (dt_fim IS NULL OR dt_inicio IS NULL OR dt_fim >= dt_inicio)
);

CREATE TABLE ref_cargo (
  id_cargo          BIGSERIAL PRIMARY KEY,
  nome              TEXT NOT NULL UNIQUE,
  nivel_federativo  TEXT NOT NULL,
  cd_cargo_tse      INTEGER,
  ativo             BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT ck_cargo_nivel CHECK (nivel_federativo IN ('federal','estadual','municipal','nao_se_aplica'))
);

CREATE TABLE ref_partido (
  id_partido       BIGSERIAL PRIMARY KEY,
  sigla            TEXT NOT NULL,
  nome             TEXT,
  numero           SMALLINT,
  dt_inicio_sigla  DATE,
  dt_fim_sigla     DATE,
  ativo            BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT uq_partido_sigla_vigencia UNIQUE (sigla, dt_inicio_sigla)
);

CREATE TABLE ref_etapa (
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

CREATE TABLE ref_tipo_registro (
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

CREATE TABLE ref_formulario (
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

CREATE TABLE ref_metrica_formulario (
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
CREATE UNIQUE INDEX uq_metrica_nps_por_formulario
  ON ref_metrica_formulario (id_formulario) WHERE eh_nps;

CREATE TABLE ref_preditor (
  id_preditor BIGSERIAL PRIMARY KEY,
  nome        TEXT     NOT NULL UNIQUE,
  ordem       SMALLINT,
  ativo       BOOLEAN  NOT NULL DEFAULT true
);

CREATE TABLE ref_agenda_tematica (
  id_agenda BIGSERIAL PRIMARY KEY,
  nome      TEXT     NOT NULL UNIQUE,
  ordem     SMALLINT,
  ativo     BOOLEAN  NOT NULL DEFAULT true
);

CREATE TABLE ref_perfil_atuacao (
  id_perfil BIGSERIAL PRIMARY KEY,
  nome      TEXT     NOT NULL UNIQUE,
  ordem     SMALLINT,
  ativo     BOOLEAN  NOT NULL DEFAULT true
);

CREATE TABLE ref_pilar_insight (
  id_pilar  BIGSERIAL PRIMARY KEY,
  codigo    TEXT     NOT NULL UNIQUE,
  nome      TEXT     NOT NULL UNIQUE,
  ordem     SMALLINT,
  ativo     BOOLEAN  NOT NULL DEFAULT true
);

CREATE TABLE ref_indicador (
  id_indicador BIGSERIAL PRIMARY KEY,
  nome         TEXT          NOT NULL UNIQUE,
  peso_iip     NUMERIC(5,2)  NOT NULL,
  ativo        BOOLEAN       NOT NULL DEFAULT true,
  CONSTRAINT ck_indicador_peso CHECK (peso_iip >= 0)
);

CREATE TABLE ref_nivel_iip (
  codigo  TEXT          PRIMARY KEY,
  rotulo  TEXT          NOT NULL,
  valor   NUMERIC(5,2)  NOT NULL,
  ordem   SMALLINT      NOT NULL,
  CONSTRAINT ck_nivel_valor CHECK (valor >= 0)
);

CREATE TABLE ref_tipologia (
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

CREATE TABLE ref_dimensao_gip (
  id_dimensao BIGSERIAL PRIMARY KEY,
  codigo      TEXT     NOT NULL UNIQUE,
  nome        TEXT     NOT NULL,
  valor_min   SMALLINT NOT NULL DEFAULT 1,
  valor_max   SMALLINT NOT NULL DEFAULT 4,
  ordem       SMALLINT NOT NULL,
  ativo       BOOLEAN  NOT NULL DEFAULT true,
  CONSTRAINT ck_dimensao_faixa CHECK (valor_max > valor_min)
);

-- =============================================================================
-- 2. PLATAFORMA — identidade, vínculo e auditoria
-- =============================================================================

-- Uma linha = uma pessoa com login no sistema.
-- Principal concentração de dado pessoal LGPD do modelo.
CREATE TABLE dim_usuario (
  id_usuario        BIGSERIAL PRIMARY KEY,
  email             TEXT        NOT NULL UNIQUE,
  nome              TEXT        NOT NULL,
  telefone          texto_limpo,
  papel_global      TEXT        NOT NULL,
  ativo             BOOLEAN     NOT NULL DEFAULT true,
  ultimo_acesso_em  TIMESTAMPTZ,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_usuario_papel CHECK (papel_global IN ('admin','gestora','mentor','assessor')),
  CONSTRAINT ck_usuario_email CHECK (email = lower(btrim(email)) AND email LIKE '%@%.%')
);

-- Uma linha = um vínculo de uma pessoa com um contrato, num papel.
-- Resolve carteira, cargo no gabinete, pareamento PLL e o predicado do RLS.
-- (FK para fat_contrato adicionada na §4, depois da criação da âncora.)
CREATE TABLE rel_usuario_contrato (
  id_vinculo             BIGSERIAL PRIMARY KEY,
  id_contrato            BIGINT NOT NULL,
  id_usuario             BIGINT NOT NULL REFERENCES dim_usuario(id_usuario),
  papel_no_contrato      TEXT   NOT NULL,
  cargo                  TEXT,
  grau_responsabilidade  texto_limpo,
  areas                  TEXT[],
  dt_inicio              DATE   NOT NULL DEFAULT CURRENT_DATE,
  dt_fim                 DATE,
  criado_em              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_vinculo UNIQUE (id_contrato, id_usuario, papel_no_contrato),
  CONSTRAINT ck_vinculo_papel CHECK (papel_no_contrato IN ('gestora','mentor','assessor','leitura')),
  CONSTRAINT ck_vinculo_cargo CHECK (cargo IS NULL OR cargo IN
    ('parlamentar','chefe_gabinete','assessor','secretaria_executiva','nao_se_aplica')),
  CONSTRAINT ck_vinculo_periodo CHECK (dt_fim IS NULL OR dt_fim >= dt_inicio)
);

-- Uma linha = uma alteração em uma linha de uma tabela auditada.
-- Particionada por mês: é a tabela de maior crescimento do sistema (C4).
CREATE TABLE log_auditoria (
  id_log                 BIGSERIAL,
  id_usuario             BIGINT      NOT NULL REFERENCES dim_usuario(id_usuario),
  id_usuario_impersonado BIGINT      REFERENCES dim_usuario(id_usuario),
  tabela                 TEXT        NOT NULL,
  id_registro_alvo       BIGINT      NOT NULL,
  acao                   TEXT        NOT NULL,
  valor_anterior         JSONB,
  valor_novo             JSONB,
  ocorrido_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_log_auditoria PRIMARY KEY (id_log, ocorrido_em),
  CONSTRAINT ck_log_acao CHECK (acao IN ('insert','update','delete'))
) PARTITION BY RANGE (ocorrido_em);

-- Cria partições mensais em lote. Chamar num job mensal com antecedência.
CREATE OR REPLACE FUNCTION app.cria_particoes_log(p_de DATE, p_meses INT DEFAULT 12)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_ini DATE := date_trunc('month', p_de)::date;
  v_fim DATE;
  v_nome TEXT;
BEGIN
  FOR i IN 0 .. p_meses - 1 LOOP
    v_fim  := (v_ini + INTERVAL '1 month')::date;
    v_nome := format('log_auditoria_%s', to_char(v_ini, 'YYYY_MM'));
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = v_nome) THEN
      EXECUTE format(
        'CREATE TABLE %I PARTITION OF log_auditoria FOR VALUES FROM (%L) TO (%L)',
        v_nome, v_ini, v_fim);
    END IF;
    v_ini := v_fim;
  END LOOP;
END $$;

CREATE TABLE log_auditoria_default PARTITION OF log_auditoria DEFAULT;
SELECT app.cria_particoes_log(CURRENT_DATE, 18);

COMMENT ON TABLE log_auditoria IS
'Auditoria de alteração linha a linha. Cobre o CRUD auditado da Gestora sobre o planejamento (jornada A6) e a impersonação do Admin. Retenção: 24 meses quentes, partições anteriores exportadas e derrubadas com DROP.';

-- =============================================================================
-- 3. FUNDAÇÃO — quem e o quê existe
-- =============================================================================

-- Uma linha = uma entidade que pode contratar (supertipo).
CREATE TABLE dim_contratante (
  id_contratante         BIGSERIAL PRIMARY KEY,
  tipo_contratante       TEXT NOT NULL,
  nome                   TEXT NOT NULL,
  nome_normalizado       TEXT GENERATED ALWAYS AS (app.normaliza_nome(nome)) STORED,
  sg_uf                  CHAR(2),
  nm_municipio           texto_limpo,
  id_partido_relacionado BIGINT REFERENCES ref_partido(id_partido),
  localizador_legado     TEXT,
  criado_em              TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_contratante_tipo CHECK (tipo_contratante IN
    ('mandato','coalizao','diretorio_partidario','partido','fundacao_partidaria','organizacao','bancada')),
  CONSTRAINT ck_contratante_uf CHECK (sg_uf IS NULL OR sg_uf ~ '^[A-Z]{2}$')
);

COMMENT ON COLUMN dim_contratante.localizador_legado IS
'Localizador das planilhas. Sem constraint de unicidade de propósito: duplica em 3 casos e falta em 44 (todas as contratações de 2026). Morto como chave, útil como rastro.';

-- Uma linha = um parlamentar apoiado. É registro, não usuário.
CREATE TABLE dim_mandato (
  id_mandato                  BIGSERIAL PRIMARY KEY,
  id_contratante              BIGINT NOT NULL UNIQUE REFERENCES dim_contratante(id_contratante) ON DELETE RESTRICT,
  nr_titulo_eleitoral         TEXT UNIQUE,
  nm_civil                    texto_limpo,
  nm_urna                     texto_limpo,
  nm_social                   texto_limpo,
  ds_genero                   texto_limpo,
  ds_identidade_genero        texto_limpo,
  ds_orientacao_sexual        texto_limpo,
  ds_raca                     TEXT,
  fl_pcd                      BOOLEAN,
  id_partido_atual            BIGINT REFERENCES ref_partido(id_partido),
  id_cargo_atual              BIGINT REFERENCES ref_cargo(id_cargo),
  origem_partido_cargo        TEXT,
  atualizado_partido_cargo_em TIMESTAMPTZ,
  potencial_futuro            texto_limpo,
  relevancia_politica         texto_limpo,
  confianca                   texto_limpo,
  risco_democratico           texto_limpo,
  espectro_politico           texto_limpo,
  id_mandato_legado           BIGINT,
  CONSTRAINT ck_mandato_raca CHECK (ds_raca IS NULL OR ds_raca IN
    ('Branca','Preta','Parda','Amarela','Indígena')),
  CONSTRAINT ck_mandato_origem CHECK (origem_partido_cargo IS NULL OR origem_partido_cargo IN ('tse','manual')),
  CONSTRAINT ck_mandato_titulo CHECK (nr_titulo_eleitoral IS NULL OR nr_titulo_eleitoral ~ '^\d{12}$')
);

COMMENT ON COLUMN dim_mandato.nr_titulo_eleitoral IS
'Única chave estável de pessoa entre eleições. NUNCA CPF. Acesso restrito: não aparece em nenhuma view de saída. O CHECK de 12 dígitos é a segunda barreira contra carga acidental de CPF (11 dígitos).';

COMMENT ON COLUMN dim_mandato.espectro_politico IS
'Preenchida em 0 de 362 linhas na base atual. Mantida porque é avaliação prevista; não é migrada. Se seguir vazia por mais um ciclo, remover.';

-- Uma linha = uma coalizão (subtipo 1:1 de contratante).
CREATE TABLE dim_coalizao (
  id_coalizao                 BIGSERIAL PRIMARY KEY,
  id_contratante              BIGINT  NOT NULL UNIQUE REFERENCES dim_contratante(id_contratante) ON DELETE RESTRICT,
  id_projeto_origem           BIGINT  REFERENCES ref_projeto(id_projeto),
  possui_planejamento_proprio BOOLEAN NOT NULL DEFAULT false
);

-- =============================================================================
-- 4. ÂNCORA — fat_contrato
-- Invariante do modelo: toda tabela de operação carrega id_contrato NOT NULL.
-- =============================================================================

-- Uma linha = um contratante × um produto × uma edição.
CREATE TABLE fat_contrato (
  id_contrato              BIGSERIAL PRIMARY KEY,
  id_contratante           BIGINT NOT NULL REFERENCES dim_contratante(id_contratante) ON DELETE RESTRICT,
  id_produto               BIGINT NOT NULL REFERENCES ref_produto(id_produto),
  id_projeto               BIGINT REFERENCES ref_projeto(id_projeto),
  id_contrato_anterior     BIGINT REFERENCES fat_contrato(id_contrato),
  id_etapa_atual           BIGINT REFERENCES ref_etapa(id_etapa),
  dt_inicio                DATE   NOT NULL,
  dt_fim_prevista          DATE,
  dt_fim                   DATE,
  id_cargo_no_contrato     BIGINT REFERENCES ref_cargo(id_cargo),
  id_partido_no_contrato   BIGINT REFERENCES ref_partido(id_partido),
  status                   TEXT NOT NULL,
  motivo_encerramento      texto_limpo,
  profundidade_impacto     TEXT,
  localizador_legado       TEXT,
  criado_em                TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- D4: prospecção não é estado de contrato. Contrato existe quando há contrato.
  CONSTRAINT ck_contrato_status CHECK (status IN ('ativo','concluido','nao_concluido')),
  CONSTRAINT ck_contrato_profundidade CHECK (profundidade_impacto IS NULL OR profundidade_impacto IN ('alto','medio')),
  CONSTRAINT ck_contrato_periodo CHECK (dt_fim IS NULL OR dt_inicio IS NULL OR dt_fim >= dt_inicio),
  CONSTRAINT ck_contrato_nao_e_proprio_anterior CHECK (id_contrato_anterior IS DISTINCT FROM id_contrato),
  CONSTRAINT ck_contrato_motivo CHECK (status <> 'nao_concluido' OR motivo_encerramento IS NOT NULL)
);

COMMENT ON TABLE fat_contrato IS
'A âncora. Um mandato reeleito, uma frente que contrata duas vezes ou uma organização que volta anos depois geram novo contrato sobre o mesmo contratante — e todo o material daquele ciclo fica amarrado a ele. É o que faz a visão do mandato sair de LEFT JOINs em vez de coluna achatada.';

COMMENT ON COLUMN fat_contrato.id_cargo_no_contrato IS
'Snapshot: o número de impacto de 2024 mostra o cargo de 2024, não o atual. dim_mandato guarda só o estado presente.';

-- FK adiada da §2 (rel_usuario_contrato precede a âncora por ser lida pelo RLS).
ALTER TABLE rel_usuario_contrato
  ADD CONSTRAINT fk_vinculo_contrato
  FOREIGN KEY (id_contrato) REFERENCES fat_contrato(id_contrato) ON DELETE RESTRICT;

-- Uma linha = a participação de um contrato de mandato numa coalizão, num período.
CREATE TABLE rel_coalizao_membro (
  id_membro         BIGSERIAL PRIMARY KEY,
  id_coalizao       BIGINT NOT NULL REFERENCES dim_coalizao(id_coalizao) ON DELETE RESTRICT,
  id_contrato       BIGINT NOT NULL REFERENCES fat_contrato(id_contrato) ON DELETE RESTRICT,
  papel             TEXT   NOT NULL,
  nome_grupo        texto_limpo,
  dt_entrada        DATE   NOT NULL DEFAULT CURRENT_DATE,
  dt_saida          DATE,
  CONSTRAINT uq_coalizao_membro UNIQUE (id_coalizao, id_contrato, papel),
  CONSTRAINT ck_membro_papel CHECK (papel IN ('membro','secretaria_executiva','grupo_trabalho')),
  CONSTRAINT ck_membro_grupo CHECK ((papel = 'grupo_trabalho') = (nome_grupo IS NOT NULL)),
  CONSTRAINT ck_membro_periodo CHECK (dt_saida IS NULL OR dt_saida >= dt_entrada)
);

COMMENT ON COLUMN rel_coalizao_membro.id_contrato IS
'A adesão é do contrato, não do contratante: um mandato pode ser membro num ciclo e não no seguinte.';

-- =============================================================================
-- 5. CAMADA TSE (schema tse) — read-only, particionada por safra
-- Sem RLS (dado público). Sem CPF em nenhuma coluna. Nunca em JOIN
-- transacional: a operação consulta apenas tse.mv_candidatura_resumo.
-- =============================================================================

-- Uma linha = uma candidatura de uma pessoa, em um turno de uma eleição.
CREATE TABLE tse.dim_candidatura (
  ano_eleicao              SMALLINT NOT NULL,
  sq_candidato             BIGINT   NOT NULL,
  nr_turno                 SMALLINT NOT NULL,
  cd_eleicao               INTEGER,
  ds_eleicao               TEXT,
  nr_titulo_eleitoral      TEXT,
  nm_candidato             TEXT,
  nm_urna                  TEXT,
  nm_social                TEXT,
  sg_uf                    CHAR(2),
  sg_ue                    TEXT,
  nm_ue                    TEXT,
  cd_cargo                 INTEGER,
  ds_cargo                 TEXT,
  nr_partido               SMALLINT,
  sg_partido               TEXT,
  sg_federacao             TEXT,
  nm_coligacao             TEXT,
  dt_nascimento            DATE,
  ds_genero                TEXT,
  ds_cor_raca              TEXT,
  ds_grau_instrucao        TEXT,
  ds_ocupacao              TEXT,
  ds_situacao_candidatura  TEXT,
  ds_sit_tot_turno         TEXT,
  carregado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_candidatura PRIMARY KEY (ano_eleicao, sq_candidato, nr_turno),
  CONSTRAINT ck_candidatura_turno CHECK (nr_turno IN (1,2))
) PARTITION BY LIST (ano_eleicao);

CREATE TABLE tse.dim_candidatura_2022 PARTITION OF tse.dim_candidatura FOR VALUES IN (2022);
CREATE TABLE tse.dim_candidatura_2024 PARTITION OF tse.dim_candidatura FOR VALUES IN (2024);
CREATE TABLE tse.dim_candidatura_outras PARTITION OF tse.dim_candidatura DEFAULT;

COMMENT ON TABLE tse.dim_candidatura IS
'consulta_cand do TSE, grão candidatura × turno. NR_CPF_CANDIDATO é descartado no staging e não existe aqui. Não tem CD_MUNICIPIO — para chegar ao município é preciso passar por fat_votacao_zona, e é por isso que dim_mandato guarda município próprio.';

-- Uma linha = votos de uma candidatura em uma zona de um município, num turno.
CREATE TABLE tse.fat_votacao_zona (
  ano_eleicao               SMALLINT NOT NULL,
  cd_eleicao                INTEGER  NOT NULL,
  nr_turno                  SMALLINT NOT NULL,
  sq_candidato              BIGINT   NOT NULL,
  cd_municipio              INTEGER  NOT NULL,
  nm_municipio              TEXT,
  nr_zona                   INTEGER  NOT NULL,
  st_voto_em_transito       BOOLEAN  NOT NULL DEFAULT false,
  qt_votos_nominais         INTEGER,
  qt_votos_nominais_validos INTEGER,
  ds_sit_tot_turno          TEXT,
  carregado_em              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_votacao_zona PRIMARY KEY
    (ano_eleicao, cd_eleicao, nr_turno, sq_candidato, cd_municipio, nr_zona, st_voto_em_transito)
) PARTITION BY LIST (ano_eleicao);

CREATE TABLE tse.fat_votacao_zona_2022 PARTITION OF tse.fat_votacao_zona FOR VALUES IN (2022);
CREATE TABLE tse.fat_votacao_zona_2024 PARTITION OF tse.fat_votacao_zona FOR VALUES IN (2024);
CREATE TABLE tse.fat_votacao_zona_outras PARTITION OF tse.fat_votacao_zona DEFAULT;

COMMENT ON TABLE tse.fat_votacao_zona IS
'~4,3 GB na safra 2022 contra ~328 MB em 2024 (2022 inclui todos os cargos gerais). Motivo do particionamento e da regra de a operação nunca ler esta tabela direto.';

-- Uma linha = uma combinação demográfica em uma zona de um município, num ano.
-- qt_eleitores é contagem agregada, não pessoa: somar por cd_municipio + nr_zona.
CREATE TABLE tse.dim_perfil_eleitorado (
  ano_eleicao            SMALLINT NOT NULL,
  id_perfil              BIGSERIAL,
  sg_uf                  CHAR(2),
  cd_municipio           INTEGER,
  nm_municipio           TEXT,
  nr_zona                INTEGER,
  ds_genero              TEXT,
  ds_estado_civil        TEXT,
  ds_faixa_etaria        TEXT,
  ds_grau_escolaridade   TEXT,
  ds_raca_cor            TEXT,
  ds_identidade_genero   TEXT,
  ds_quilombola          TEXT,
  ds_interprete_libras   TEXT,
  qt_eleitores           INTEGER,
  qt_eleitores_deficiencia INTEGER,
  carregado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_perfil_eleitorado PRIMARY KEY (ano_eleicao, id_perfil)
) PARTITION BY LIST (ano_eleicao);

CREATE TABLE tse.dim_perfil_eleitorado_2022 PARTITION OF tse.dim_perfil_eleitorado FOR VALUES IN (2022);
CREATE TABLE tse.dim_perfil_eleitorado_2024 PARTITION OF tse.dim_perfil_eleitorado FOR VALUES IN (2024);
CREATE TABLE tse.dim_perfil_eleitorado_outras PARTITION OF tse.dim_perfil_eleitorado DEFAULT;

COMMENT ON TABLE tse.dim_perfil_eleitorado IS
'Atenção aos nomes divergentes da fonte: AA_ELEICAO (não ANO_ELEICAO), CD_RACA_COR (não CD_COR_RACA), CD_GRAU_ESCOLARIDADE (não CD_GRAU_INSTRUCAO). Normalizados aqui.';

-- Uma linha = uma URL declarada por uma candidatura. Só existe para 2024.
CREATE TABLE tse.rel_rede_social (
  sq_candidato            BIGINT   NOT NULL,
  nr_ordem_rede_social    SMALLINT NOT NULL,
  ano_eleicao             SMALLINT NOT NULL,
  ds_url                  TEXT     NOT NULL,
  carregado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_rede_social PRIMARY KEY (sq_candidato, nr_ordem_rede_social)
);

-- Projeção agregada: única superfície TSE que a aplicação consulta.
CREATE MATERIALIZED VIEW tse.mv_candidatura_resumo AS
WITH votos AS (
  SELECT ano_eleicao, sq_candidato, nr_turno,
         SUM(qt_votos_nominais_validos) AS qt_votos_total
  FROM tse.fat_votacao_zona
  GROUP BY ano_eleicao, sq_candidato, nr_turno
),
por_municipio AS (
  SELECT ano_eleicao, sq_candidato, nr_turno, nm_municipio,
         SUM(qt_votos_nominais_validos) AS votos_municipio
  FROM tse.fat_votacao_zona
  GROUP BY ano_eleicao, sq_candidato, nr_turno, nm_municipio
),
municipio_principal AS (
  SELECT DISTINCT ON (ano_eleicao, sq_candidato, nr_turno)
         ano_eleicao, sq_candidato, nr_turno, nm_municipio
  FROM por_municipio
  ORDER BY ano_eleicao, sq_candidato, nr_turno, votos_municipio DESC NULLS LAST
)
SELECT c.ano_eleicao,
       c.sq_candidato,
       c.nr_turno,
       c.nr_titulo_eleitoral,
       c.nm_candidato,
       c.nm_urna,
       c.sg_uf,
       m.nm_municipio AS nm_municipio_principal,
       c.cd_cargo,
       c.ds_cargo,
       c.nr_partido,
       c.sg_partido,
       COALESCE(v.qt_votos_total, 0) AS qt_votos_total,
       c.ds_situacao_candidatura,
       c.ds_sit_tot_turno
FROM tse.dim_candidatura c
LEFT JOIN votos v
       ON v.ano_eleicao = c.ano_eleicao AND v.sq_candidato = c.sq_candidato AND v.nr_turno = c.nr_turno
LEFT JOIN municipio_principal m
       ON m.ano_eleicao = c.ano_eleicao AND m.sq_candidato = c.sq_candidato AND m.nr_turno = c.nr_turno
WITH NO DATA;

CREATE UNIQUE INDEX uq_mv_candidatura_resumo
  ON tse.mv_candidatura_resumo (ano_eleicao, sq_candidato, nr_turno);

COMMENT ON MATERIALIZED VIEW tse.mv_candidatura_resumo IS
'Índice UNIQUE obrigatório para REFRESH MATERIALIZED VIEW CONCURRENTLY. Refresh apenas após carga de safra (evento raro).';

-- Uma linha = um vínculo aceito entre um mandato do sistema e uma candidatura.
-- Sem FK para tse (C5): o ETL recarrega partições inteiras.
CREATE TABLE rel_mandato_candidatura (
  id_vinculo_tse      BIGSERIAL PRIMARY KEY,
  id_mandato          BIGINT   NOT NULL REFERENCES dim_mandato(id_mandato) ON DELETE RESTRICT,
  ano_eleicao         SMALLINT NOT NULL,
  sq_candidato        BIGINT   NOT NULL,
  nr_turno            SMALLINT NOT NULL,
  metodo_match        TEXT     NOT NULL,
  confianca           TEXT     NOT NULL,
  status              TEXT     NOT NULL DEFAULT 'sugerido',
  eh_mandato_vigente  BOOLEAN  NOT NULL DEFAULT false,
  id_usuario_validou  BIGINT   REFERENCES dim_usuario(id_usuario),
  validado_em         TIMESTAMPTZ,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_mandato_candidatura UNIQUE (id_mandato, ano_eleicao, sq_candidato, nr_turno),
  CONSTRAINT ck_match_metodo CHECK (metodo_match IN ('titulo_eleitoral','nome_uf_cargo','manual')),
  CONSTRAINT ck_match_confianca CHECK (confianca IN ('alta','media','baixa')),
  CONSTRAINT ck_match_status CHECK (status IN ('sugerido','confirmado','rejeitado')),
  CONSTRAINT ck_match_validacao CHECK (status = 'sugerido' OR validado_em IS NOT NULL),
  CONSTRAINT ck_match_vigente CHECK (NOT eh_mandato_vigente OR status = 'confirmado')
);

-- Um mandato tem no máximo uma candidatura vigente.
CREATE UNIQUE INDEX uq_mandato_candidatura_vigente
  ON rel_mandato_candidatura (id_mandato) WHERE eh_mandato_vigente;

COMMENT ON TABLE rel_mandato_candidatura IS
'O match nunca acontece em tempo de consulta: casar por nome numa base de centenas de milhares de candidatos a cada abertura de tela é lento e erra. Vínculo materializado, revisado por pessoa, com método e confiança — para que um match fraco seja auditável em vez de invisível. Mandato reeleito tem duas linhas confirmadas e apenas uma vigente.';

-- =============================================================================
-- 6. OPERAÇÃO — o que aconteceu dentro do contrato
-- =============================================================================

-- Uma linha = o progresso de um contrato em uma etapa da régua.
-- dias_atraso é derivado em vw_etapa_contrato (C2), não armazenado.
CREATE TABLE fat_etapa_contrato (
  id_etapa_contrato     BIGSERIAL PRIMARY KEY,
  id_contrato           BIGINT NOT NULL REFERENCES fat_contrato(id_contrato) ON DELETE RESTRICT,
  id_etapa              BIGINT NOT NULL REFERENCES ref_etapa(id_etapa),
  status                TEXT   NOT NULL DEFAULT 'nao_iniciada',
  dt_prevista_inicio    DATE,
  dt_prevista_conclusao DATE,
  dt_inicio             DATE,
  dt_conclusao          DATE,
  atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_etapa_contrato UNIQUE (id_contrato, id_etapa),
  CONSTRAINT ck_etapa_contrato_status CHECK (status IN ('nao_iniciada','em_andamento','concluida','dispensada')),
  CONSTRAINT ck_etapa_contrato_concluida CHECK (status <> 'concluida' OR dt_conclusao IS NOT NULL),
  CONSTRAINT ck_etapa_contrato_periodo CHECK (dt_conclusao IS NULL OR dt_inicio IS NULL OR dt_conclusao >= dt_inicio),
  CONSTRAINT ck_etapa_contrato_previsto CHECK (dt_prevista_conclusao IS NULL OR dt_prevista_inicio IS NULL
                                               OR dt_prevista_conclusao >= dt_prevista_inicio)
);

COMMENT ON TABLE fat_etapa_contrato IS
'Sustenta "quantos mandatos por etapa" e "quais atrasados" sem varrer registros. As datas previstas são geradas na instanciação do mandato a partir de ref_etapa.duracao_prevista_dias e substituem a coluna manual "Dias corridos" da Tabela Datas-Etapa (preenchida em 61% das linhas).';

-- Uma linha = o estado de abertura de um formulário para um contrato.
CREATE TABLE rel_formulario_contrato (
  id_abertura       BIGSERIAL PRIMARY KEY,
  id_contrato       BIGINT NOT NULL REFERENCES fat_contrato(id_contrato) ON DELETE RESTRICT,
  id_formulario     BIGINT NOT NULL REFERENCES ref_formulario(id_formulario),
  estado            TEXT   NOT NULL DEFAULT 'fechado',
  dt_abertura       TIMESTAMPTZ,
  dt_fechamento     TIMESTAMPTZ,
  id_usuario_abriu  BIGINT REFERENCES dim_usuario(id_usuario),
  CONSTRAINT uq_formulario_contrato UNIQUE (id_contrato, id_formulario),
  CONSTRAINT ck_abertura_estado CHECK (estado IN ('fechado','aberto')),
  CONSTRAINT ck_abertura_data CHECK (estado <> 'aberto' OR dt_abertura IS NOT NULL)
);

COMMENT ON COLUMN rel_formulario_contrato.dt_abertura IS
'Alimenta "formulários abertos há muito tempo" em vw_pendencias. A Gestora (Estratégia) ou a coordenação (PLL) alterna o estado; o respondente só responde.';

-- Uma linha = uma resposta de uma pessoa a um formulário, num contrato.
CREATE TABLE fat_submissao (
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
CREATE UNIQUE INDEX uq_submissao_respondente
  ON fat_submissao (id_contrato, id_formulario, id_usuario_respondente, COALESCE(momento, 'unico'))
  WHERE id_usuario_respondente IS NOT NULL;

COMMENT ON COLUMN fat_submissao.id_usuario_respondente IS
'Nulo apenas em submissão importada de base legada, onde o respondente não é identificável.';

COMMENT ON COLUMN fat_submissao.versao_formulario IS
'A resposta sabe contra qual versão do formulário foi dada. Sem isso, comparar avaliações entre edições é comparar perguntas diferentes.';

-- Uma linha = o valor de uma métrica em uma submissão.
-- Escrita por trigger a partir de ref_metrica_formulario. O JSONB continua
-- sendo a verdade da resposta; esta tabela é a superfície de agregação.
CREATE TABLE fat_resposta_metrica (
  id_submissao  BIGINT NOT NULL REFERENCES fat_submissao(id_submissao) ON DELETE CASCADE,
  id_metrica    BIGINT NOT NULL REFERENCES ref_metrica_formulario(id_metrica) ON DELETE CASCADE,
  valor_num     NUMERIC(6,2),
  valor_bool    BOOLEAN,
  CONSTRAINT pk_resposta_metrica PRIMARY KEY (id_submissao, id_metrica),
  CONSTRAINT ck_resposta_metrica_valor CHECK (valor_num IS NOT NULL OR valor_bool IS NOT NULL)
);

-- Uma linha = um encontro previsto ou realizado num contrato.
CREATE TABLE fat_encontro (
  id_encontro          BIGSERIAL PRIMARY KEY,
  id_contrato          BIGINT NOT NULL REFERENCES fat_contrato(id_contrato) ON DELETE RESTRICT,
  id_etapa             BIGINT REFERENCES ref_etapa(id_etapa),
  id_tipo_registro     BIGINT REFERENCES ref_tipo_registro(id_tipo_registro),
  nr_sequencia         SMALLINT,
  titulo               TEXT   NOT NULL,
  status               TEXT   NOT NULL DEFAULT 'planejado',
  dt_prevista_inicio   TIMESTAMPTZ,
  dt_prevista_fim      TIMESTAMPTZ,
  dt_realizada         TIMESTAMPTZ,
  modalidade           TEXT,
  local                texto_limpo,
  tema_prioritario     texto_limpo,
  id_externo_calendar  TEXT,
  url_meet             TEXT,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_encontro_status CHECK (status IN ('planejado','realizado','cancelado','remarcado')),
  CONSTRAINT ck_encontro_modalidade CHECK (modalidade IS NULL OR modalidade IN ('presencial','online')),
  CONSTRAINT ck_encontro_realizado CHECK (status <> 'realizado' OR dt_realizada IS NOT NULL),
  CONSTRAINT ck_encontro_planejado CHECK (status <> 'planejado' OR dt_prevista_inicio IS NOT NULL),
  CONSTRAINT ck_encontro_sequencia CHECK (nr_sequencia IS NULL OR nr_sequencia > 0)
);

-- Não existem dois "Monitoramento 2" vivos no mesmo contrato; remarcado e
-- cancelado ficam de fora para permitir a substituição.
CREATE UNIQUE INDEX uq_encontro_sequencia
  ON fat_encontro (id_contrato, id_tipo_registro, nr_sequencia)
  WHERE nr_sequencia IS NOT NULL AND status IN ('planejado','realizado');

COMMENT ON TABLE fat_encontro IS
'Substitui fat_evento da v3 e introduz o lado planejado do ciclo. Com status e data prevista, três perguntas passam a ter resposta: a mentoria 3 aconteceu? quantos encontros foram remarcados nesta edição? quais mandatos estão com a agenda parada?';

-- Uma linha = a presença de uma pessoa em um encontro.
CREATE TABLE rel_encontro_participante (
  id_participacao BIGSERIAL PRIMARY KEY,
  id_encontro     BIGINT  NOT NULL REFERENCES fat_encontro(id_encontro) ON DELETE CASCADE,
  id_usuario      BIGINT  REFERENCES dim_usuario(id_usuario),
  nome_livre      texto_limpo,
  origem          TEXT    NOT NULL,
  presente        BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT ck_participante_origem CHECK (origem IN ('legisla','mandato','externo')),
  CONSTRAINT ck_participante_identificacao CHECK ((id_usuario IS NULL) <> (nome_livre IS NULL))
);

CREATE UNIQUE INDEX uq_encontro_participante_usuario
  ON rel_encontro_participante (id_encontro, id_usuario) WHERE id_usuario IS NOT NULL;

COMMENT ON TABLE rel_encontro_participante IS
'Substitui a coluna "Presentes" como texto livre em 8 abas de registro. Permite medir engajamento do gabinete e Legislers por encontro — hoje impossível sem interpretar string.';

-- Uma linha = um recurso externo provisionado para um contrato.
CREATE TABLE rel_integracao_contrato (
  id_integracao          BIGSERIAL PRIMARY KEY,
  id_contrato            BIGINT NOT NULL REFERENCES fat_contrato(id_contrato) ON DELETE RESTRICT,
  tipo                   TEXT   NOT NULL,
  identificador_externo  TEXT   NOT NULL,
  provisionado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_integracao_contrato UNIQUE (id_contrato, tipo),
  CONSTRAINT ck_integracao_tipo CHECK (tipo IN ('slack_canal','drive_pasta','calendar_agenda'))
);

-- Uma linha = um documento ou link associado a algo do sistema.
CREATE TABLE fat_artefato (
  id_artefato        BIGSERIAL PRIMARY KEY,
  id_contrato        BIGINT NOT NULL REFERENCES fat_contrato(id_contrato) ON DELETE RESTRICT,
  escopo             TEXT   NOT NULL,
  id_referencia      BIGINT,
  tipo               TEXT   NOT NULL,
  url                TEXT   NOT NULL,
  descricao          texto_limpo,
  id_usuario_anexou  BIGINT REFERENCES dim_usuario(id_usuario),
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_artefato_escopo CHECK (escopo IN ('contrato','registro','submissao','encontro','etapa')),
  CONSTRAINT ck_artefato_referencia CHECK ((escopo = 'contrato') = (id_referencia IS NULL)),
  CONSTRAINT ck_artefato_tipo CHECK (tipo IN
    ('termo_assinado','mapa_politico','escuta_diagnostica','cronograma','pre_planejamento',
     'mural','organograma','material_replicacao','foto','planilha_legada','pasta_drive','outro')),
  CONSTRAINT ck_artefato_url CHECK (url ~* '^https?://')
);

COMMENT ON TABLE fat_artefato IS
'Consolida 14 colunas "Link ..." espalhadas por 6 abas das planilhas. Durante a transição, os links das bases antigas ficam anexados ao contrato com tipo = planilha_legada, em vez de virarem colunas mortas no schema novo. id_referencia é polimórfico por escopo e por isso não tem FK — a integridade é validada por trigger de aplicação.';

-- =============================================================================
-- 7. PLANEJAMENTO — tabelas unificadas, discriminadas pelo produto do contrato
-- Decisão D1 da v3 resolvida: as hierarquias de Estratégia e PLL são
-- estruturalmente idênticas; separar duplicaria cascata, RLS e cada view.
-- =============================================================================

-- Uma linha = o planejamento de um contrato.
CREATE TABLE dim_planejamento (
  id_planejamento             BIGSERIAL PRIMARY KEY,
  id_contrato                 BIGINT NOT NULL UNIQUE REFERENCES fat_contrato(id_contrato) ON DELETE RESTRICT,
  id_perfil_atuacao           BIGINT REFERENCES ref_perfil_atuacao(id_perfil),
  objetivo_ano                TEXT,
  legado                      TEXT,
  analise_conjuntura          TEXT,
  pct_atingimento             NUMERIC(5,2),
  atingimento_desatualizado   BOOLEAN NOT NULL DEFAULT false,
  criado_em                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_planejamento_pct CHECK (pct_atingimento IS NULL OR pct_atingimento BETWEEN 0 AND 100)
);

COMMENT ON COLUMN dim_planejamento.atingimento_desatualizado IS
'Marca de recálculo. Evita cascata síncrona quando a Gestora edita 20 sucessos mensais de uma vez; o recálculo acontece ao abrir a tela ou em job curto.';

-- Uma linha = um dos 3 preditores prioritários de um planejamento.
CREATE TABLE rel_planejamento_preditor (
  id_planejamento BIGINT   NOT NULL REFERENCES dim_planejamento(id_planejamento) ON DELETE CASCADE,
  id_preditor     BIGINT   NOT NULL REFERENCES ref_preditor(id_preditor),
  ordem           SMALLINT NOT NULL,
  CONSTRAINT pk_planejamento_preditor PRIMARY KEY (id_planejamento, id_preditor),
  CONSTRAINT uq_planejamento_preditor_ordem UNIQUE (id_planejamento, ordem),
  CONSTRAINT ck_planejamento_preditor_ordem CHECK (ordem BETWEEN 1 AND 3)
);

-- Uma linha = um objetivo específico de um planejamento.
CREATE TABLE fat_objetivo_especifico (
  id_objetivo             BIGSERIAL PRIMARY KEY,
  id_planejamento         BIGINT   NOT NULL REFERENCES dim_planejamento(id_planejamento) ON DELETE CASCADE,
  ordem                   SMALLINT,
  descricao               TEXT     NOT NULL,
  id_preditor_primario    BIGINT   REFERENCES ref_preditor(id_preditor),
  id_preditor_secundario  BIGINT   REFERENCES ref_preditor(id_preditor),
  id_agenda               BIGINT   REFERENCES ref_agenda_tematica(id_agenda),
  oportunidade            TEXT,
  ameaca                  TEXT,
  pct_atingimento         NUMERIC(5,2),
  criado_em               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_objetivo_pct CHECK (pct_atingimento IS NULL OR pct_atingimento BETWEEN 0 AND 100),
  -- Secundário exige primário e não pode repeti-lo. Escrito como OR e não com
  -- IS DISTINCT FROM porque NULL IS DISTINCT FROM NULL é FALSO, o que reprovaria
  -- todo objetivo sem preditor.
  CONSTRAINT ck_objetivo_preditores CHECK (
    id_preditor_secundario IS NULL
    OR (id_preditor_primario IS NOT NULL AND id_preditor_secundario <> id_preditor_primario))
);

COMMENT ON COLUMN fat_objetivo_especifico.oportunidade IS
'SWOT por objetivo, não por planejamento: na base de PLL (f_swot) oportunidade e ameaça vêm por objetivo e por preditor, com 88% e 72% de preenchimento.';

-- Uma linha = uma meta de um objetivo específico.
CREATE TABLE fat_meta (
  id_meta                 BIGSERIAL PRIMARY KEY,
  id_objetivo             BIGINT   NOT NULL REFERENCES fat_objetivo_especifico(id_objetivo) ON DELETE CASCADE,
  ordem                   SMALLINT,
  descricao               TEXT     NOT NULL,
  id_preditor_primario    BIGINT   REFERENCES ref_preditor(id_preditor),
  id_preditor_secundario  BIGINT   REFERENCES ref_preditor(id_preditor),
  id_agenda               BIGINT   REFERENCES ref_agenda_tematica(id_agenda),
  prioridade              TEXT,
  classe                  TEXT,
  id_usuario_responsavel  BIGINT   REFERENCES dim_usuario(id_usuario),
  status                  TEXT     NOT NULL DEFAULT 'ativa',
  pct_atingimento         NUMERIC(5,2),
  criado_em               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_meta_pct CHECK (pct_atingimento IS NULL OR pct_atingimento BETWEEN 0 AND 100),
  CONSTRAINT ck_meta_classe CHECK (classe IS NULL OR classe IN ('programatica','governanca')),
  CONSTRAINT ck_meta_prioridade CHECK (prioridade IS NULL OR prioridade IN ('alta','media','baixa')),
  CONSTRAINT ck_meta_status CHECK (status IN ('ativa','pausada','descartada')),
  CONSTRAINT ck_meta_preditores CHECK (
    id_preditor_secundario IS NULL
    OR (id_preditor_primario IS NOT NULL AND id_preditor_secundario <> id_preditor_primario))
);

COMMENT ON COLUMN fat_meta.id_preditor_secundario IS
'Só a Estratégia usa dois preditores. No PLL a Meta carrega apenas o primário — é a única diferença estrutural entre os dois planejamentos e o motivo de as tabelas serem unificadas.';

-- Uma linha = um sucesso mensal de uma meta, num mês de referência.
-- pct_atingimento é a ÚNICA entrada manual da cascata.
CREATE TABLE fat_sucesso_mensal (
  id_sucesso       BIGSERIAL PRIMARY KEY,
  id_meta          BIGINT       NOT NULL REFERENCES fat_meta(id_meta) ON DELETE CASCADE,
  descricao        TEXT         NOT NULL,
  mes_referencia   DATE         NOT NULL,
  dt_limite        DATE,
  peso             NUMERIC(5,2) NOT NULL,
  pct_atingimento  NUMERIC(5,2),
  status           TEXT         NOT NULL DEFAULT 'pendente',
  atualizado_por   BIGINT       REFERENCES dim_usuario(id_usuario),
  atualizado_em    TIMESTAMPTZ,
  criado_em        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ck_sucesso_mes CHECK (EXTRACT(DAY FROM mes_referencia) = 1),
  CONSTRAINT ck_sucesso_peso CHECK (peso >= 0 AND peso <= 100),
  CONSTRAINT ck_sucesso_pct CHECK (pct_atingimento IS NULL OR pct_atingimento BETWEEN 0 AND 100),
  CONSTRAINT ck_sucesso_status CHECK (status IN ('pendente','realizado','nao_realizado'))
);

COMMENT ON COLUMN fat_sucesso_mensal.peso IS
'Escala 0–100 (decisão D11). A base de Estratégia usa 0–1 (0.08) e a de PLL usa 0–100; a carga converte. A soma dos pesos dos sucessos de uma meta deve fechar 100 — validado na migração.';

COMMENT ON COLUMN fat_sucesso_mensal.mes_referencia IS
'Primeiro dia do mês. Substitui os formatos "Mês 1 - Março" e "março" das planilhas.';

-- Uma linha = uma aplicação do GIP num contrato, num momento.
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
'A v3 tratou isso como payload JSONB com "campos TBD". O schema já estava fechado na prática: a aba db_DO_Gabinete tem as 4 dimensões × 2 eixos, os dois booleanos e o quadrante, com 76 a 100% de preenchimento. Modelar em coluna agora custa nada e evita migrar JSONB para coluna depois.';

COMMENT ON COLUMN fat_gip.quadrante IS
'Coluna gerada dos dois booleanos. Deixa de ser texto digitado ("Q3 - Entrega sem estrutura") e passa a ser impossível de divergir.';

-- Uma linha = a nota de uma dimensão da régua, num eixo, numa aplicação do GIP.
CREATE TABLE fat_gip_dimensao (
  id_gip      BIGINT   NOT NULL REFERENCES fat_gip(id_gip) ON DELETE CASCADE,
  id_dimensao BIGINT   NOT NULL REFERENCES ref_dimensao_gip(id_dimensao),
  eixo        TEXT     NOT NULL,
  valor       SMALLINT NOT NULL,
  CONSTRAINT pk_gip_dimensao PRIMARY KEY (id_gip, id_dimensao, eixo),
  CONSTRAINT ck_gip_dimensao_eixo CHECK (eixo IN ('regua_sonhos','onde_chegamos'))
);

COMMENT ON TABLE fat_gip_dimensao IS
'Formato longo em vez de quatro colunas: acrescentar uma quinta dimensão passa a ser INSERT em ref_dimensao_gip, não ALTER TABLE em produção. A faixa válida de valor é validada por trigger contra ref_dimensao_gip.';

COMMENT ON COLUMN fat_gip_dimensao.eixo IS
'D6: regua_sonhos é a Régua dos Sonhos — a aspiração pactuada no Raio-X. onde_chegamos é a leitura posterior. As duas convivem na mesma aplicação porque o instrumento só faz sentido comparado: a distância entre os eixos É a medida.';

-- =============================================================================
-- 8. INCIDÊNCIA — registros, insights, fatos geradores
-- =============================================================================

-- Uma linha = um lançamento de reunião realizada, num contrato.
CREATE TABLE fat_registro (
  id_registro       BIGSERIAL PRIMARY KEY,
  id_contrato       BIGINT   NOT NULL REFERENCES fat_contrato(id_contrato) ON DELETE RESTRICT,
  id_tipo_registro  BIGINT   NOT NULL REFERENCES ref_tipo_registro(id_tipo_registro),
  nr_sequencia      SMALLINT,
  id_encontro       BIGINT   REFERENCES fat_encontro(id_encontro),
  ocorrido_em       TIMESTAMPTZ NOT NULL,
  canal             TEXT,
  resumo            TEXT,
  conteudo          JSONB    NOT NULL DEFAULT '{}'::jsonb,
  id_usuario_autor  BIGINT   NOT NULL REFERENCES dim_usuario(id_usuario),
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_registro_canal CHECK (canal IS NULL OR canal IN ('sistema','slack','presencial')),
  CONSTRAINT ck_registro_conteudo CHECK (jsonb_typeof(conteudo) = 'object'),
  CONSTRAINT ck_registro_sequencia CHECK (nr_sequencia IS NULL OR nr_sequencia > 0)
);

CREATE UNIQUE INDEX uq_registro_sequencia
  ON fat_registro (id_contrato, id_tipo_registro, nr_sequencia)
  WHERE nr_sequencia IS NOT NULL;

COMMENT ON TABLE fat_registro IS
'Substitui os comandos /registro - <etapa> do Slack. nr_sequencia resolve sprint xN, monitoramento 1-4 e mentoria 1-5 sem coluna por ocorrência.';

COMMENT ON COLUMN fat_registro.resumo IS
'Fora do JSONB de propósito: aparece em toda listagem. Campo sempre exibido não fica dentro de JSON.';

-- Uma linha = uma anotação qualitativa, opcionalmente num pilar.
CREATE TABLE fat_insight (
  id_insight          BIGSERIAL PRIMARY KEY,
  id_contrato         BIGINT NOT NULL REFERENCES fat_contrato(id_contrato) ON DELETE RESTRICT,
  id_registro         BIGINT REFERENCES fat_registro(id_registro) ON DELETE SET NULL,
  id_pilar            BIGINT REFERENCES ref_pilar_insight(id_pilar),
  conteudo            TEXT   NOT NULL,
  desdobramentos      TEXT,
  comprovacao_dados   TEXT,
  ocorrido_em         DATE,
  id_usuario_autor    BIGINT REFERENCES dim_usuario(id_usuario),
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN fat_insight.id_registro IS
'Anulável de propósito. A v3 exigia NOT NULL ("insight sempre nasce de um registro"), verdade na Estratégia e falso no PLL: nenhum insight da base atual de PLL tem registro de origem. Manter NOT NULL inviabilizaria a migração de toda a incidência do PLL. A regra segue valendo na Estratégia, aplicada na feature, não no schema.';

-- Uma linha = o vínculo de um insight a uma Meta ou a um Sucesso Mensal.
CREATE TABLE rel_insight_origem (
  id_vinculo   BIGSERIAL PRIMARY KEY,
  id_insight   BIGINT NOT NULL REFERENCES fat_insight(id_insight) ON DELETE CASCADE,
  id_meta      BIGINT REFERENCES fat_meta(id_meta) ON DELETE CASCADE,
  id_sucesso   BIGINT REFERENCES fat_sucesso_mensal(id_sucesso) ON DELETE CASCADE,
  CONSTRAINT ck_insight_origem CHECK (id_meta IS NOT NULL OR id_sucesso IS NOT NULL)
);

CREATE UNIQUE INDEX uq_insight_origem_meta
  ON rel_insight_origem (id_insight, id_meta) WHERE id_meta IS NOT NULL;
CREATE UNIQUE INDEX uq_insight_origem_sucesso
  ON rel_insight_origem (id_insight, id_sucesso) WHERE id_sucesso IS NOT NULL;

COMMENT ON TABLE rel_insight_origem IS
'A base atual tem insight ligado a Meta (46%), a Sucesso Mensal (25%) e a nada. Duas colunas FK anuláveis não expressam "e/ou"; tabela de vínculo expressa.';

-- Uma linha = uma ação política observada, num contrato.
-- Correção estrutural da v4: três dimensões simultâneas, cada uma com nível.
CREATE TABLE fat_fato_gerador (
  id_fato_gerador       BIGSERIAL PRIMARY KEY,
  id_contrato           BIGINT   NOT NULL REFERENCES fat_contrato(id_contrato) ON DELETE RESTRICT,
  id_tipologia          BIGINT   NOT NULL REFERENCES ref_tipologia(id_tipologia),
  nivel_d1              TEXT     REFERENCES ref_nivel_iip(codigo),
  nivel_d2              TEXT     REFERENCES ref_nivel_iip(codigo),
  nivel_d3              TEXT     REFERENCES ref_nivel_iip(codigo),
  id_preditor_1         BIGINT   REFERENCES ref_preditor(id_preditor),
  id_preditor_2         BIGINT   REFERENCES ref_preditor(id_preditor),
  contribuicao_legisla  SMALLINT,
  descricao_evidencia   TEXT,
  dt_ocorrencia         DATE     NOT NULL,
  id_usuario_autor      BIGINT   REFERENCES dim_usuario(id_usuario),
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_fato_niveis CHECK (COALESCE(nivel_d1, nivel_d2, nivel_d3) IS NOT NULL),
  CONSTRAINT ck_fato_contribuicao CHECK (contribuicao_legisla IS NULL OR contribuicao_legisla BETWEEN 0 AND 5),
  CONSTRAINT ck_fato_preditores CHECK (
    id_preditor_2 IS NULL
    OR (id_preditor_1 IS NOT NULL AND id_preditor_2 <> id_preditor_1))
);

COMMENT ON TABLE fat_fato_gerador IS
'A v3 modelou status_dimensao CHECK (D1, D2, D3) — como se o fato escolhesse UMA dimensão. O dado real (Fatos_Geradores_Log) tem as três simultâneas, cada uma em Baixo/Médio/Alto, 100% preenchidas, mais contribuicao_legisla e dois preditores. Com o modelo da v3 o IIP não é calculável.';

COMMENT ON COLUMN fat_fato_gerador.contribuicao_legisla IS
'Escala 0 a 5 (decisão D3). Entra no cálculo do IIP somente quando D2 fechar a fórmula — hoje é atributo descritivo do fato.';

-- Uma linha = o vínculo de um fato gerador a uma Meta ou a um Insight.
CREATE TABLE rel_fato_origem (
  id_vinculo       BIGSERIAL PRIMARY KEY,
  id_fato_gerador  BIGINT NOT NULL REFERENCES fat_fato_gerador(id_fato_gerador) ON DELETE CASCADE,
  id_meta          BIGINT REFERENCES fat_meta(id_meta) ON DELETE CASCADE,
  id_insight       BIGINT REFERENCES fat_insight(id_insight) ON DELETE CASCADE,
  CONSTRAINT ck_fato_origem CHECK (id_meta IS NOT NULL OR id_insight IS NOT NULL)
);

CREATE UNIQUE INDEX uq_fato_origem_meta
  ON rel_fato_origem (id_fato_gerador, id_meta) WHERE id_meta IS NOT NULL;
CREATE UNIQUE INDEX uq_fato_origem_insight
  ON rel_fato_origem (id_fato_gerador, id_insight) WHERE id_insight IS NOT NULL;

COMMENT ON TABLE rel_fato_origem IS
'Vínculo em tabela, não colunas no fato: a jornada permite Meta e/ou Insight, e permite fato sem origem — que é simplesmente a ausência de linha aqui.';

-- =============================================================================
-- 9. SAÍDA — série histórica, views e projeções
-- =============================================================================

-- Uma linha = a fotografia de um contrato ao fim de um mês.
CREATE TABLE fat_snapshot_mensal (
  id_contrato                    BIGINT   NOT NULL REFERENCES fat_contrato(id_contrato) ON DELETE RESTRICT,
  mes_referencia                 DATE     NOT NULL,
  pct_atingimento_planejamento   NUMERIC(5,2),
  iip                            NUMERIC(10,2),
  nr_registros_mes               SMALLINT NOT NULL DEFAULT 0,
  nr_fatos_mes                   SMALLINT NOT NULL DEFAULT 0,
  nr_insights_mes                SMALLINT NOT NULL DEFAULT 0,
  id_etapa_no_mes                BIGINT   REFERENCES ref_etapa(id_etapa),
  gerado_em                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_snapshot PRIMARY KEY (id_contrato, mes_referencia),
  CONSTRAINT ck_snapshot_mes CHECK (EXTRACT(DAY FROM mes_referencia) = 1)
);

COMMENT ON TABLE fat_snapshot_mensal IS
'Escrita por job no fechamento do mês. Coluna materializada guarda o valor de agora; série histórica exige fato próprio. É o que torna possível "evolução no tempo" (jornada do Mentor) e "atingimento estagnado" (jornada gerencial). Sem esta tabela os gráficos de evolução seriam reconstruídos varrendo log_auditoria — caro, frágil e incompleto.';

-- --- Views de derivação (existem por causa das correções C1 e C2) ------------

-- nivel_federativo derivado do cargo (C1): corrigir ref_cargo corrige o histórico.
CREATE VIEW vw_contrato WITH (security_invoker = true) AS
SELECT c.*,
       ct.nome              AS nome_contratante,
       ct.tipo_contratante,
       ct.sg_uf,
       ct.nm_municipio,
       p.nome               AS nome_produto,
       pj.nome              AS nome_projeto,
       cg.nome              AS cargo_no_contrato,
       cg.nivel_federativo,
       pt.sigla             AS partido_no_contrato
FROM fat_contrato c
JOIN dim_contratante ct   ON ct.id_contratante = c.id_contratante
JOIN ref_produto p        ON p.id_produto = c.id_produto
LEFT JOIN ref_projeto pj  ON pj.id_projeto = c.id_projeto
LEFT JOIN ref_cargo cg    ON cg.id_cargo = c.id_cargo_no_contrato
LEFT JOIN ref_partido pt  ON pt.id_partido = c.id_partido_no_contrato;

-- dias_atraso derivado (C2): usa CURRENT_DATE, logo não pode ser coluna gerada.
CREATE VIEW vw_etapa_contrato WITH (security_invoker = true) AS
SELECT ec.*,
       e.codigo AS codigo_etapa,
       e.nome   AS nome_etapa,
       e.ordem,
       GREATEST(0, COALESCE(ec.dt_conclusao, CURRENT_DATE) - ec.dt_prevista_conclusao) AS dias_atraso,
       (ec.status <> 'concluida' AND ec.dt_prevista_conclusao < CURRENT_DATE)          AS esta_atrasada
FROM fat_etapa_contrato ec
JOIN ref_etapa e ON e.id_etapa = ec.id_etapa;

CREATE VIEW vw_sucesso_mensal WITH (security_invoker = true) AS
SELECT sm.*,
       GREATEST(0, CURRENT_DATE - sm.dt_limite) AS dias_atraso,
       (sm.status = 'pendente' AND sm.dt_limite < CURRENT_DATE) AS esta_atrasado
FROM fat_sucesso_mensal sm;

-- --- Projeções materializadas -----------------------------------------------

-- Uma linha = um contrato, com as agregações que hoje são digitadas à mão.
CREATE MATERIALIZED VIEW mv_numeros_impacto AS
SELECT c.id_contrato,
       c.id_contratante,
       ct.nome                AS nome_contratante,
       ct.tipo_contratante,
       ct.sg_uf,
       ct.nm_municipio,
       c.id_produto,
       p.nome                 AS nome_produto,
       c.id_projeto,
       pj.nome                AS nome_projeto,
       pj.tematica,
       c.dt_inicio,
       c.dt_fim,
       EXTRACT(YEAR FROM c.dt_inicio)::INT AS ano_inicio,
       c.status,
       c.profundidade_impacto,
       cg.nome                AS cargo_no_contrato,
       cg.nivel_federativo,
       pt.sigla               AS partido_no_contrato,
       m.ds_raca,
       m.ds_genero,
       m.fl_pcd,
       -- Agregações que substituem "Nº de produtos" (divergia em 46 contratantes)
       -- e "Ano da 1ª vez" (divergia em 41).
       COUNT(*)      OVER (PARTITION BY c.id_contratante) AS nr_contratos_contratante,
       MIN(c.dt_inicio) OVER (PARTITION BY c.id_contratante) AS dt_primeira_contratacao,
       ROW_NUMBER()  OVER (PARTITION BY c.id_contratante ORDER BY c.dt_inicio) AS ordem_contrato
FROM fat_contrato c
JOIN dim_contratante ct  ON ct.id_contratante = c.id_contratante
JOIN ref_produto p       ON p.id_produto = c.id_produto
LEFT JOIN ref_projeto pj ON pj.id_projeto = c.id_projeto
LEFT JOIN ref_cargo cg   ON cg.id_cargo = c.id_cargo_no_contrato
LEFT JOIN ref_partido pt ON pt.id_partido = c.id_partido_no_contrato
LEFT JOIN dim_mandato m  ON m.id_contratante = c.id_contratante
WITH NO DATA;

CREATE UNIQUE INDEX uq_mv_numeros_impacto ON mv_numeros_impacto (id_contrato);

COMMENT ON MATERIALIZED VIEW mv_numeros_impacto IS
'Única porta de saída dos números de impacto — ninguém consulta fat_contrato cru. Sem filtro de status desde D4: todo contrato é contrato assinado. Refresh diário CONCURRENTLY. Não respeita RLS: acesso por GRANT a papéis Legisla.';

-- Uma linha = um contrato, com o IIP e seus componentes.
-- FÓRMULA PROVISÓRIA (decisão D2): os insumos estão certos e são suficientes;
-- a aritmética final é da área de conhecimento. Trocar a fórmula é alterar esta
-- expressão, não migrar dado. contribuicao_legisla não entra até D3 fechar.
CREATE MATERIALIZED VIEW mv_iip_contrato AS
SELECT f.id_contrato,
       COUNT(*)                                                    AS nr_fatos,
       SUM(COALESCE(n1.valor, 0) * i.peso_iip / 100.0)              AS componente_d1,
       SUM(COALESCE(n2.valor, 0) * i.peso_iip / 100.0)              AS componente_d2,
       SUM(COALESCE(n3.valor, 0) * i.peso_iip / 100.0)              AS componente_d3,
       SUM((COALESCE(n1.valor, 0) + COALESCE(n2.valor, 0) + COALESCE(n3.valor, 0))
           * i.peso_iip / 100.0)                                    AS iip_provisorio,
       MAX(f.dt_ocorrencia)                                         AS dt_ultimo_fato
FROM fat_fato_gerador f
JOIN ref_tipologia t         ON t.id_tipologia = f.id_tipologia
LEFT JOIN ref_indicador i    ON i.id_indicador = t.id_indicador
LEFT JOIN ref_nivel_iip n1   ON n1.codigo = f.nivel_d1
LEFT JOIN ref_nivel_iip n2   ON n2.codigo = f.nivel_d2
LEFT JOIN ref_nivel_iip n3   ON n3.codigo = f.nivel_d3
GROUP BY f.id_contrato
WITH NO DATA;

CREATE UNIQUE INDEX uq_mv_iip_contrato ON mv_iip_contrato (id_contrato);

-- Uma linha = formulário × projeto × métrica.
CREATE MATERIALIZED VIEW mv_avaliacao_nps AS
SELECT s.id_formulario,
       COALESCE(c.id_projeto, 0)                                AS id_projeto_grupo,
       rm.id_metrica,
       rm.rotulo,
       rm.agrupador,
       rm.eh_nps,
       COUNT(*)                                                 AS nr_respostas,
       ROUND(AVG(r.valor_num), 2)                               AS media,
       COUNT(*) FILTER (WHERE rm.eh_nps AND r.valor_num >= 9)   AS promotores,
       COUNT(*) FILTER (WHERE rm.eh_nps AND r.valor_num BETWEEN 7 AND 8) AS neutros,
       COUNT(*) FILTER (WHERE rm.eh_nps AND r.valor_num <= 6)   AS detratores,
       CASE WHEN rm.eh_nps AND COUNT(*) > 0 THEN ROUND(
              (COUNT(*) FILTER (WHERE r.valor_num >= 9)
             - COUNT(*) FILTER (WHERE r.valor_num <= 6)) * 100.0 / COUNT(*), 2)
       END                                                      AS nps
FROM fat_resposta_metrica r
JOIN ref_metrica_formulario rm ON rm.id_metrica = r.id_metrica
JOIN fat_submissao s           ON s.id_submissao = r.id_submissao
JOIN fat_contrato c            ON c.id_contrato = s.id_contrato
WHERE r.valor_num IS NOT NULL
GROUP BY s.id_formulario, COALESCE(c.id_projeto, 0), rm.id_metrica, rm.rotulo, rm.agrupador, rm.eh_nps
WITH NO DATA;

CREATE UNIQUE INDEX uq_mv_avaliacao_nps
  ON mv_avaliacao_nps (id_formulario, id_projeto_grupo, id_metrica);

COMMENT ON MATERIALIZED VIEW mv_avaliacao_nps IS
'Substitui a aba "Médias e NPS", que hoje é planilha calculada. Agregação sobre fat_resposta_metrica (~120 mil linhas em 5 anos) em vez de jsonb_path_query sobre o histórico de submissões.';

-- --- Views de leitura -------------------------------------------------------

-- Linha do tempo do contratante. Uso exclusivo de usuários Legisla (OUT-02).
CREATE VIEW vw_visao_mandato WITH (security_invoker = true) AS
SELECT ct.id_contratante,
       ct.nome AS nome_contratante,
       ct.tipo_contratante,
       c.id_contrato,
       c.dt_inicio,
       c.dt_fim,
       c.status,
       p.nome  AS nome_produto,
       pj.nome AS nome_projeto,
       cg.nome AS cargo_no_contrato,
       pt.sigla AS partido_no_contrato,
       c.id_contrato_anterior,
       ROW_NUMBER() OVER (PARTITION BY ct.id_contratante ORDER BY c.dt_inicio) AS ordem_contrato
FROM dim_contratante ct
JOIN fat_contrato c      ON c.id_contratante = ct.id_contratante
JOIN ref_produto p       ON p.id_produto = c.id_produto
LEFT JOIN ref_projeto pj ON pj.id_projeto = c.id_projeto
LEFT JOIN ref_cargo cg   ON cg.id_cargo = c.id_cargo_no_contrato
LEFT JOIN ref_partido pt ON pt.id_partido = c.id_partido_no_contrato;

-- A mesma view serve Gestora e Mentor; o recorte vem do RLS.
CREATE VIEW vw_carteira WITH (security_invoker = true) AS
SELECT v.id_usuario,
       v.papel_no_contrato,
       c.id_contrato,
       ct.nome AS nome_contratante,
       p.nome  AS nome_produto,
       pj.nome AS nome_projeto,
       c.status,
       e.nome  AS etapa_atual,
       pl.pct_atingimento,
       pl.atingimento_desatualizado,
       iip.iip_provisorio,
       iip.nr_fatos,
       (SELECT MAX(r.ocorrido_em) FROM fat_registro r WHERE r.id_contrato = c.id_contrato) AS dt_ultimo_registro
FROM rel_usuario_contrato v
JOIN fat_contrato c            ON c.id_contrato = v.id_contrato
JOIN dim_contratante ct        ON ct.id_contratante = c.id_contratante
JOIN ref_produto p             ON p.id_produto = c.id_produto
LEFT JOIN ref_projeto pj       ON pj.id_projeto = c.id_projeto
LEFT JOIN ref_etapa e          ON e.id_etapa = c.id_etapa_atual
LEFT JOIN dim_planejamento pl  ON pl.id_contrato = c.id_contrato
LEFT JOIN mv_iip_contrato iip  ON iip.id_contrato = c.id_contrato
WHERE v.dt_fim IS NULL OR v.dt_fim >= CURRENT_DATE;

COMMENT ON VIEW vw_carteira IS
'O JOIN com mv_iip_contrato (que não tem RLS) é seguro porque as linhas já vêm restritas por rel_usuario_contrato e fat_contrato: a materialized view só acrescenta colunas ao conjunto autorizado.';

-- D6: a Régua dos Sonhos lida contra Onde Chegamos, por dimensão.
-- O gap é a entrega do instrumento; guardar os dois eixos e não expor a
-- diferença seria repetir o erro da planilha, que soma "total regua" e
-- "total onde chegamos" em colunas separadas e deixa a comparação por conta
-- de quem olha.
CREATE VIEW vw_gip_evolucao WITH (security_invoker = true) AS
SELECT g.id_contrato,
       g.momento,
       g.aplicado_em,
       d.codigo                AS dimensao,
       d.nome                  AS nome_dimensao,
       d.ordem,
       r.valor                 AS regua_sonhos,
       o.valor                 AS onde_chegamos,
       o.valor - r.valor       AS gap,
       CASE WHEN r.valor IS NULL OR o.valor IS NULL THEN NULL
            WHEN o.valor >= r.valor THEN 'atingiu'
            WHEN o.valor >= r.valor - 1 THEN 'proximo'
            ELSE 'distante'
       END                     AS situacao,
       g.quadrante
FROM fat_gip g
CROSS JOIN ref_dimensao_gip d
LEFT JOIN fat_gip_dimensao r ON r.id_gip = g.id_gip AND r.id_dimensao = d.id_dimensao AND r.eixo = 'regua_sonhos'
LEFT JOIN fat_gip_dimensao o ON o.id_gip = g.id_gip AND o.id_dimensao = d.id_dimensao AND o.eixo = 'onde_chegamos'
WHERE d.ativo;

-- Pendência é derivada, nunca digitada.
CREATE VIEW vw_pendencias WITH (security_invoker = true) AS
-- 1. Campos de cadastro em branco
SELECT c.id_contrato, 'cadastro' AS categoria, x.campo AS detalhe, NULL::date AS referencia_em
FROM fat_contrato c
JOIN dim_mandato m ON m.id_contratante = c.id_contratante
CROSS JOIN LATERAL (VALUES
    ('ds_genero',   m.ds_genero IS NULL),
    ('ds_raca',     m.ds_raca IS NULL),
    ('fl_pcd',      m.fl_pcd IS NULL),
    ('confianca',   m.confianca IS NULL),
    ('titulo_eleitoral', m.nr_titulo_eleitoral IS NULL)
  ) AS x(campo, vazio)
WHERE x.vazio AND c.status = 'ativo'
UNION ALL
-- 2. Formulário aberto há mais de 30 dias
SELECT f.id_contrato, 'formulario_aberto', rf.codigo, f.dt_abertura::date
FROM rel_formulario_contrato f
JOIN ref_formulario rf ON rf.id_formulario = f.id_formulario
WHERE f.estado = 'aberto' AND f.dt_abertura < now() - INTERVAL '30 days'
UNION ALL
-- 3. Etapa atrasada
SELECT ec.id_contrato, 'etapa_atrasada', e.codigo, ec.dt_prevista_conclusao
FROM fat_etapa_contrato ec
JOIN ref_etapa e ON e.id_etapa = ec.id_etapa
WHERE ec.status <> 'concluida' AND ec.status <> 'dispensada'
  AND ec.dt_prevista_conclusao < CURRENT_DATE
UNION ALL
-- 4. Encontro planejado que já venceu
SELECT en.id_contrato, 'encontro_vencido', en.titulo, en.dt_prevista_inicio::date
FROM fat_encontro en
WHERE en.status = 'planejado' AND en.dt_prevista_inicio < now()
UNION ALL
-- 5. Contrato ativo sem registro nos últimos 45 dias
SELECT c.id_contrato, 'sem_registro_recente', NULL,
       (SELECT MAX(r.ocorrido_em)::date FROM fat_registro r WHERE r.id_contrato = c.id_contrato)
FROM fat_contrato c
WHERE c.status = 'ativo'
  AND COALESCE((SELECT MAX(r.ocorrido_em) FROM fat_registro r WHERE r.id_contrato = c.id_contrato),
               c.dt_inicio::timestamptz) < now() - INTERVAL '45 days'
UNION ALL
-- 6. Sucesso mensal vencido e não atualizado
SELECT pl.id_contrato, 'sucesso_mensal_atrasado', sm.descricao, sm.dt_limite
FROM fat_sucesso_mensal sm
JOIN fat_meta mt              ON mt.id_meta = sm.id_meta
JOIN fat_objetivo_especifico o ON o.id_objetivo = mt.id_objetivo
JOIN dim_planejamento pl       ON pl.id_planejamento = o.id_planejamento
WHERE sm.status = 'pendente' AND sm.dt_limite < CURRENT_DATE;

-- =============================================================================
-- 10. STAGING DA MIGRAÇÃO (descartável)
-- =============================================================================

CREATE TABLE stg.map_legado (
  origem         TEXT NOT NULL,
  chave_legada   TEXT NOT NULL,
  tipo_entidade  TEXT NOT NULL,
  id_novo        BIGINT,
  observacao     TEXT,
  CONSTRAINT pk_map_legado PRIMARY KEY (origem, chave_legada, tipo_entidade)
);

COMMENT ON TABLE stg.map_legado IS
'Mapeia as três chaves legadas (id_mandato timestamp-like, Localizador, id_mentorado) para os IDs novos. Existe durante a migração, é auditada na validação e DESCARTADA depois — as colunas *_legado nas tabelas finais bastam para rastreabilidade. D7 esclarecida: id_mentorado é timestamp de criação da linha, não CPF — o alarme de LGPD está encerrado, e as três chaves legadas são apenas identificadores técnicos sem dado pessoal.';

-- =============================================================================
-- 11. FUNÇÕES DE SESSÃO, RLS E RECÁLCULO
-- =============================================================================

-- A aplicação faz SET app.id_usuario = '<id>' ao abrir a transação.
CREATE OR REPLACE FUNCTION app.id_usuario() RETURNS BIGINT
LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('app.id_usuario', true), '')::BIGINT $$;

CREATE OR REPLACE FUNCTION app.id_usuario_sistema() RETURNS BIGINT
LANGUAGE sql STABLE AS
$$ SELECT id_usuario FROM dim_usuario WHERE email = 'sistema@legislabrasil.org.br' $$;

CREATE OR REPLACE FUNCTION app.papel_atual() RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS
$$ SELECT papel_global FROM dim_usuario WHERE id_usuario = app.id_usuario() $$;

-- Carteira do usuário como array: UMA avaliação por query em vez de um EXISTS
-- por linha candidata. Carteira tem dezenas de contratos, não milhares.
CREATE OR REPLACE FUNCTION app.contratos_do_usuario() RETURNS BIGINT[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS
$$ SELECT COALESCE(array_agg(v.id_contrato), '{}'::BIGINT[])
     FROM rel_usuario_contrato v
    WHERE v.id_usuario = app.id_usuario()
      AND (v.dt_fim IS NULL OR v.dt_fim >= CURRENT_DATE) $$;

COMMENT ON FUNCTION app.contratos_do_usuario() IS
'SECURITY DEFINER de propósito: executa como dono da tabela e por isso não é submetida ao RLS de rel_usuario_contrato — sem isso a política se autorreferenciaria. É a razão de rel_usuario_contrato NÃO ter FORCE ROW LEVEL SECURITY.';

-- Recalcula a cascata inteira em três UPDATEs, sem recursão de trigger.
CREATE OR REPLACE FUNCTION app.recalcula_atingimento(p_id_planejamento BIGINT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Nível 1: Meta = média dos Sucessos Mensais ponderada pelo Peso
  UPDATE fat_meta m
     SET pct_atingimento = s.pct
    FROM (SELECT sm.id_meta,
                 CASE WHEN SUM(sm.peso) > 0
                      THEN ROUND(SUM(sm.peso * COALESCE(sm.pct_atingimento, 0)) / SUM(sm.peso), 2)
                 END AS pct
            FROM fat_sucesso_mensal sm
            JOIN fat_meta mm               ON mm.id_meta = sm.id_meta
            JOIN fat_objetivo_especifico oo ON oo.id_objetivo = mm.id_objetivo
           WHERE oo.id_planejamento = p_id_planejamento
           GROUP BY sm.id_meta) s
   WHERE m.id_meta = s.id_meta;

  -- Nível 2: Objetivo Específico = média das Metas ativas
  UPDATE fat_objetivo_especifico o
     SET pct_atingimento = t.pct
    FROM (SELECT mm.id_objetivo, ROUND(AVG(COALESCE(mm.pct_atingimento, 0)), 2) AS pct
            FROM fat_meta mm
            JOIN fat_objetivo_especifico oo ON oo.id_objetivo = mm.id_objetivo
           WHERE oo.id_planejamento = p_id_planejamento
             AND mm.status = 'ativa'
           GROUP BY mm.id_objetivo) t
   WHERE o.id_objetivo = t.id_objetivo;

  -- Raiz: Planejamento = média dos Objetivos Específicos
  UPDATE dim_planejamento p
     SET pct_atingimento = (SELECT ROUND(AVG(COALESCE(o.pct_atingimento, 0)), 2)
                              FROM fat_objetivo_especifico o
                             WHERE o.id_planejamento = p.id_planejamento),
         atingimento_desatualizado = false,
         atualizado_em = now()
   WHERE p.id_planejamento = p_id_planejamento;
END $$;

-- Job curto de fundo: recalcula só o que foi marcado.
CREATE OR REPLACE FUNCTION app.recalcula_pendentes(p_limite INT DEFAULT 200)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_id BIGINT; v_n INT := 0;
BEGIN
  FOR v_id IN SELECT id_planejamento FROM dim_planejamento
               WHERE atingimento_desatualizado ORDER BY atualizado_em LIMIT p_limite LOOP
    PERFORM app.recalcula_atingimento(v_id);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $$;

-- Instancia o mandato (jornada A1.6): cria a régua com datas previstas.
-- Substitui a réplica de planilha, os Typeforms e a pasta do Drive.
CREATE OR REPLACE FUNCTION app.instancia_contrato(p_id_contrato BIGINT)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_id_produto BIGINT; v_dt DATE;
BEGIN
  SELECT id_produto, COALESCE(dt_inicio, CURRENT_DATE) INTO v_id_produto, v_dt
    FROM fat_contrato WHERE id_contrato = p_id_contrato;

  INSERT INTO fat_etapa_contrato (id_contrato, id_etapa, status, dt_prevista_inicio, dt_prevista_conclusao)
  SELECT p_id_contrato, e.id_etapa, 'nao_iniciada',
         -- SUM() devolve BIGINT e não existe operador date + bigint: cast explícito.
         v_dt + COALESCE(SUM(anterior.duracao_prevista_dias), 0)::INT,
         v_dt + COALESCE(SUM(anterior.duracao_prevista_dias), 0)::INT
              + COALESCE(e.duracao_prevista_dias, 0)::INT
    FROM ref_etapa e
    LEFT JOIN ref_etapa anterior
           ON anterior.id_produto = e.id_produto AND anterior.ordem < e.ordem
   WHERE e.id_produto = v_id_produto
   GROUP BY e.id_etapa, e.duracao_prevista_dias
  ON CONFLICT (id_contrato, id_etapa) DO NOTHING;

  INSERT INTO dim_planejamento (id_contrato)
  VALUES (p_id_contrato)
  ON CONFLICT (id_contrato) DO NOTHING;

  INSERT INTO rel_formulario_contrato (id_contrato, id_formulario, estado)
  SELECT p_id_contrato, f.id_formulario, 'fechado'
    FROM ref_formulario f
    JOIN ref_etapa e ON e.id_etapa = f.id_etapa
   WHERE e.id_produto = v_id_produto AND f.ativo
  ON CONFLICT (id_contrato, id_formulario) DO NOTHING;
END $$;

-- --- Políticas de RLS -------------------------------------------------------
-- UMA política, replicada literalmente em toda tabela que carrega id_contrato.
-- É o ganho concreto de amarrar tudo na âncora.

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'fat_etapa_contrato', 'rel_formulario_contrato', 'fat_submissao', 'fat_encontro',
    'rel_integracao_contrato', 'fat_artefato', 'dim_planejamento', 'fat_gip',
    'fat_registro', 'fat_insight', 'fat_fato_gerador', 'rel_coalizao_membro',
    'fat_snapshot_mensal'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($f$
      CREATE POLICY p_por_contrato ON %I
        USING (app.papel_atual() IN ('admin','gestora')
               OR id_contrato = ANY(app.contratos_do_usuario()))
    $f$, t);
  END LOOP;
END $$;

-- Tabelas filhas sem id_contrato herdam via JOIN no pai.
-- RLS não é transitiva: cada herança é declarada explicitamente.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('fat_objetivo_especifico',
     'EXISTS (SELECT 1 FROM dim_planejamento p WHERE p.id_planejamento = fat_objetivo_especifico.id_planejamento)'),
    ('rel_planejamento_preditor',
     'EXISTS (SELECT 1 FROM dim_planejamento p WHERE p.id_planejamento = rel_planejamento_preditor.id_planejamento)'),
    ('fat_meta',
     'EXISTS (SELECT 1 FROM fat_objetivo_especifico o WHERE o.id_objetivo = fat_meta.id_objetivo)'),
    ('fat_sucesso_mensal',
     'EXISTS (SELECT 1 FROM fat_meta m WHERE m.id_meta = fat_sucesso_mensal.id_meta)'),
    ('fat_gip_dimensao',
     'EXISTS (SELECT 1 FROM fat_gip g WHERE g.id_gip = fat_gip_dimensao.id_gip)'),
    ('fat_resposta_metrica',
     'EXISTS (SELECT 1 FROM fat_submissao s WHERE s.id_submissao = fat_resposta_metrica.id_submissao)'),
    ('rel_encontro_participante',
     'EXISTS (SELECT 1 FROM fat_encontro e WHERE e.id_encontro = rel_encontro_participante.id_encontro)'),
    ('rel_fato_origem',
     'EXISTS (SELECT 1 FROM fat_fato_gerador f WHERE f.id_fato_gerador = rel_fato_origem.id_fato_gerador)'),
    ('rel_insight_origem',
     'EXISTS (SELECT 1 FROM fat_insight i WHERE i.id_insight = rel_insight_origem.id_insight)')
  ) AS v(tabela, predicado) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tabela);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', r.tabela);
    EXECUTE format('CREATE POLICY p_heranca ON %I USING (%s)', r.tabela, r.predicado);
  END LOOP;
END $$;

-- Identidade: cada um vê o próprio vínculo; Legisla vê todos.
-- SEM FORCE: app.contratos_do_usuario() precisa ler esta tabela como dono.
ALTER TABLE rel_usuario_contrato ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_vinculo_proprio ON rel_usuario_contrato
  USING (app.papel_atual() IN ('admin','gestora') OR id_usuario = app.id_usuario());

ALTER TABLE dim_usuario ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_usuario ON dim_usuario
  USING (app.papel_atual() IN ('admin','gestora') OR id_usuario = app.id_usuario());

-- Auditoria: leitura restrita a admin.
ALTER TABLE log_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_log_admin ON log_auditoria USING (app.papel_atual() = 'admin');

-- Fundação: mandato e contratante são visíveis por vínculo com algum contrato.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('dim_contratante',
     'EXISTS (SELECT 1 FROM fat_contrato c WHERE c.id_contratante = dim_contratante.id_contratante
                AND c.id_contrato = ANY(app.contratos_do_usuario()))'),
    ('dim_mandato',
     'EXISTS (SELECT 1 FROM fat_contrato c WHERE c.id_contratante = dim_mandato.id_contratante
                AND c.id_contrato = ANY(app.contratos_do_usuario()))'),
    ('dim_coalizao',
     'EXISTS (SELECT 1 FROM fat_contrato c WHERE c.id_contratante = dim_coalizao.id_contratante
                AND c.id_contrato = ANY(app.contratos_do_usuario()))'),
    ('rel_mandato_candidatura',
     'EXISTS (SELECT 1 FROM dim_mandato m JOIN fat_contrato c ON c.id_contratante = m.id_contratante
               WHERE m.id_mandato = rel_mandato_candidatura.id_mandato
                 AND c.id_contrato = ANY(app.contratos_do_usuario()))'),
    ('fat_contrato',
     'id_contrato = ANY(app.contratos_do_usuario())')
  ) AS v(tabela, predicado) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tabela);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', r.tabela);
    EXECUTE format($f$CREATE POLICY p_por_carteira ON %I
                        USING (app.papel_atual() IN ('admin','gestora') OR (%s))$f$,
                   r.tabela, r.predicado);
  END LOOP;
END $$;

-- =============================================================================
-- 12. TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION app.trg_atualizado_em() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN NEW.atualizado_em := now(); RETURN NEW; END $$;

CREATE TRIGGER trg_upd_usuario      BEFORE UPDATE ON dim_usuario      FOR EACH ROW EXECUTE FUNCTION app.trg_atualizado_em();
CREATE TRIGGER trg_upd_contratante  BEFORE UPDATE ON dim_contratante  FOR EACH ROW EXECUTE FUNCTION app.trg_atualizado_em();
CREATE TRIGGER trg_upd_contrato     BEFORE UPDATE ON fat_contrato     FOR EACH ROW EXECUTE FUNCTION app.trg_atualizado_em();
CREATE TRIGGER trg_upd_planejamento BEFORE UPDATE ON dim_planejamento FOR EACH ROW EXECUTE FUNCTION app.trg_atualizado_em();
CREATE TRIGGER trg_upd_etapa_contr  BEFORE UPDATE ON fat_etapa_contrato FOR EACH ROW EXECUTE FUNCTION app.trg_atualizado_em();

-- --- Auditoria genérica ------------------------------------------------------
-- Recebe o nome da PK como argumento e resolve por to_jsonb: sem SQL dinâmico.
CREATE OR REPLACE FUNCTION app.trg_auditoria() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_pk    TEXT  := TG_ARGV[0];
  v_ant   JSONB;
  v_novo  JSONB;
  v_id    BIGINT;
  v_real  BIGINT;
  v_imp   BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_ant := to_jsonb(OLD);
    v_id  := (v_ant ->> v_pk)::BIGINT;
  ELSIF TG_OP = 'UPDATE' THEN
    v_ant  := to_jsonb(OLD);
    v_novo := to_jsonb(NEW);
    IF v_ant = v_novo THEN RETURN NULL; END IF;   -- update que não mudou nada não vira log
    v_id   := (v_novo ->> v_pk)::BIGINT;
  ELSE
    v_novo := to_jsonb(NEW);
    v_id   := (v_novo ->> v_pk)::BIGINT;
  END IF;

  -- app.id_usuario é a identidade EFETIVA (a que o RLS usa).
  -- app.id_usuario_real é o Admin, quando está atuando como outro papel.
  v_real := COALESCE(NULLIF(current_setting('app.id_usuario_real', true), '')::BIGINT, app.id_usuario());
  v_imp  := CASE WHEN v_real IS DISTINCT FROM app.id_usuario() THEN app.id_usuario() END;

  INSERT INTO log_auditoria (id_usuario, id_usuario_impersonado, tabela, id_registro_alvo,
                             acao, valor_anterior, valor_novo)
  VALUES (COALESCE(v_real, app.id_usuario_sistema()), v_imp,
          TG_TABLE_NAME, v_id, lower(TG_OP), v_ant, v_novo);
  RETURN NULL;
END $$;

COMMENT ON FUNCTION app.trg_auditoria() IS
'Cobre o CRUD auditado da Gestora sobre o planejamento e a impersonação do Admin. Quando o Admin atua como outro papel, id_usuario guarda o Admin e id_usuario_impersonado guarda quem ele está representando — o contrário perderia o responsável real.';

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('dim_planejamento',        'id_planejamento'),
    ('fat_objetivo_especifico', 'id_objetivo'),
    ('fat_meta',                'id_meta'),
    ('fat_sucesso_mensal',      'id_sucesso'),
    ('rel_planejamento_preditor','id_planejamento'),
    ('fat_contrato',            'id_contrato'),
    ('dim_mandato',             'id_mandato'),
    ('rel_usuario_contrato',    'id_vinculo'),
    ('fat_gip',                 'id_gip'),
    ('rel_mandato_candidatura', 'id_vinculo_tse')
  ) AS v(tabela, pk) LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%s AFTER INSERT OR UPDATE OR DELETE ON %I
         FOR EACH ROW EXECUTE FUNCTION app.trg_auditoria(%L)',
      r.tabela, r.tabela, r.pk);
  END LOOP;
END $$;

-- --- Cascata: marcação em nível de statement, nunca recálculo síncrono -------
-- Duas funções em vez de uma com IF: tabela de transição inexistente num
-- branch não executado é armadilha silenciosa.

CREATE OR REPLACE FUNCTION app.trg_marca_desatualizado_novos() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE dim_planejamento p SET atingimento_desatualizado = true
   WHERE p.id_planejamento IN (
     SELECT DISTINCT o.id_planejamento
       FROM novos n
       JOIN fat_meta m                ON m.id_meta = n.id_meta
       JOIN fat_objetivo_especifico o ON o.id_objetivo = m.id_objetivo);
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION app.trg_marca_desatualizado_antigos() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE dim_planejamento p SET atingimento_desatualizado = true
   WHERE p.id_planejamento IN (
     SELECT DISTINCT o.id_planejamento
       FROM antigos a
       JOIN fat_meta m                ON m.id_meta = a.id_meta
       JOIN fat_objetivo_especifico o ON o.id_objetivo = m.id_objetivo);
  RETURN NULL;
END $$;

-- PostgreSQL proíbe AFTER UPDATE OF <colunas> junto com REFERENCING: o filtro
-- de "quais colunas mudaram" desce para dentro da função, comparando as duas
-- tabelas de transição. Fica mais preciso do que a cláusula OF, que dispara
-- mesmo quando o UPDATE grava o mesmo valor.
CREATE OR REPLACE FUNCTION app.trg_marca_desatualizado_upd() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE dim_planejamento p SET atingimento_desatualizado = true
   WHERE p.id_planejamento IN (
     SELECT DISTINCT o.id_planejamento
       FROM novos n
       JOIN antigos a                 ON a.id_sucesso = n.id_sucesso
       JOIN fat_meta m                ON m.id_meta = n.id_meta
       JOIN fat_objetivo_especifico o ON o.id_objetivo = m.id_objetivo
      WHERE n.pct_atingimento IS DISTINCT FROM a.pct_atingimento
         OR n.peso            IS DISTINCT FROM a.peso
         OR n.status          IS DISTINCT FROM a.status
         OR n.id_meta         IS DISTINCT FROM a.id_meta);
  RETURN NULL;
END $$;

CREATE TRIGGER trg_sm_ins AFTER INSERT ON fat_sucesso_mensal
  REFERENCING NEW TABLE AS novos
  FOR EACH STATEMENT EXECUTE FUNCTION app.trg_marca_desatualizado_novos();

CREATE TRIGGER trg_sm_upd AFTER UPDATE ON fat_sucesso_mensal
  REFERENCING NEW TABLE AS novos OLD TABLE AS antigos
  FOR EACH STATEMENT EXECUTE FUNCTION app.trg_marca_desatualizado_upd();

CREATE TRIGGER trg_sm_del AFTER DELETE ON fat_sucesso_mensal
  REFERENCING OLD TABLE AS antigos
  FOR EACH STATEMENT EXECUTE FUNCTION app.trg_marca_desatualizado_antigos();

-- Mudança de status ou de pai da Meta altera a média do Objetivo — nos dois
-- objetivos envolvidos, quando a meta troca de objetivo.
CREATE OR REPLACE FUNCTION app.trg_marca_por_meta_upd() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE dim_planejamento p SET atingimento_desatualizado = true
   WHERE p.id_planejamento IN (
     SELECT DISTINCT o.id_planejamento
       FROM (SELECT n.id_objetivo
               FROM metas_novas n JOIN metas_antigas a ON a.id_meta = n.id_meta
              WHERE n.status IS DISTINCT FROM a.status OR n.id_objetivo IS DISTINCT FROM a.id_objetivo
              UNION
             SELECT a.id_objetivo
               FROM metas_novas n JOIN metas_antigas a ON a.id_meta = n.id_meta
              WHERE n.status IS DISTINCT FROM a.status OR n.id_objetivo IS DISTINCT FROM a.id_objetivo) x
       JOIN fat_objetivo_especifico o ON o.id_objetivo = x.id_objetivo);
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION app.trg_marca_por_meta_ins() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE dim_planejamento p SET atingimento_desatualizado = true
   WHERE p.id_planejamento IN (
     SELECT DISTINCT o.id_planejamento
       FROM metas_novas n
       JOIN fat_objetivo_especifico o ON o.id_objetivo = n.id_objetivo);
  RETURN NULL;
END $$;

CREATE TRIGGER trg_meta_upd AFTER UPDATE ON fat_meta
  REFERENCING NEW TABLE AS metas_novas OLD TABLE AS metas_antigas
  FOR EACH STATEMENT EXECUTE FUNCTION app.trg_marca_por_meta_upd();

CREATE TRIGGER trg_meta_ins AFTER INSERT ON fat_meta
  REFERENCING NEW TABLE AS metas_novas
  FOR EACH STATEMENT EXECUTE FUNCTION app.trg_marca_por_meta_ins();

-- --- Extração de métricas do JSONB ------------------------------------------
-- O JSONB continua sendo a verdade da resposta; a tabela normalizada é a
-- superfície de agregação. Escrita na submissão, não na leitura do painel.
CREATE OR REPLACE FUNCTION app.trg_extrai_metricas() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM fat_resposta_metrica WHERE id_submissao = NEW.id_submissao;

  INSERT INTO fat_resposta_metrica (id_submissao, id_metrica, valor_num, valor_bool)
  SELECT NEW.id_submissao,
         rm.id_metrica,
         CASE WHEN rm.tipo <> 'booleano' THEN (NEW.respostas ->> rm.codigo_campo)::NUMERIC END,
         CASE WHEN rm.tipo  = 'booleano' THEN (NEW.respostas ->> rm.codigo_campo)::BOOLEAN END
    FROM ref_metrica_formulario rm
   WHERE rm.id_formulario = NEW.id_formulario
     AND rm.ativo
     AND NEW.respostas ? rm.codigo_campo
     AND NULLIF(btrim(NEW.respostas ->> rm.codigo_campo), '') IS NOT NULL;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_submissao_metricas
  AFTER INSERT OR UPDATE OF respostas ON fat_submissao
  FOR EACH ROW EXECUTE FUNCTION app.trg_extrai_metricas();

COMMENT ON FUNCTION app.trg_extrai_metricas() IS
'O cast falha de propósito se uma pergunta declarada como métrica receber texto: métrica declarada que não é número é erro de configuração do formulário, e é melhor descobrir na escrita do que num painel silenciosamente vazio.';

-- --- Validações que a constraint declarativa não alcança ---------------------

-- Faixa da dimensão do GIP vive em ref_dimensao_gip, não em CHECK fixo.
CREATE OR REPLACE FUNCTION app.trg_valida_gip_dimensao() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_min SMALLINT; v_max SMALLINT;
BEGIN
  SELECT valor_min, valor_max INTO v_min, v_max
    FROM ref_dimensao_gip WHERE id_dimensao = NEW.id_dimensao;
  IF NEW.valor < v_min OR NEW.valor > v_max THEN
    RAISE EXCEPTION 'Valor % fora da faixa (%..%) da dimensão %', NEW.valor, v_min, v_max, NEW.id_dimensao;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_gip_dimensao_faixa BEFORE INSERT OR UPDATE ON fat_gip_dimensao
  FOR EACH ROW EXECUTE FUNCTION app.trg_valida_gip_dimensao();

-- Referência polimórfica de fat_artefato: sem FK possível, valida por trigger.
CREATE OR REPLACE FUNCTION app.trg_valida_artefato() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_ok BOOLEAN;
BEGIN
  IF NEW.escopo = 'contrato' THEN RETURN NEW; END IF;
  EXECUTE format(
    'SELECT EXISTS (SELECT 1 FROM %I WHERE %I = $1 AND id_contrato = $2)',
    CASE NEW.escopo WHEN 'registro'  THEN 'fat_registro'
                    WHEN 'submissao' THEN 'fat_submissao'
                    WHEN 'encontro'  THEN 'fat_encontro'
                    WHEN 'etapa'     THEN 'fat_etapa_contrato' END,
    CASE NEW.escopo WHEN 'registro'  THEN 'id_registro'
                    WHEN 'submissao' THEN 'id_submissao'
                    WHEN 'encontro'  THEN 'id_encontro'
                    WHEN 'etapa'     THEN 'id_etapa_contrato' END)
  INTO v_ok USING NEW.id_referencia, NEW.id_contrato;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Artefato aponta para % % inexistente no contrato %',
      NEW.escopo, NEW.id_referencia, NEW.id_contrato;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_artefato_referencia BEFORE INSERT OR UPDATE ON fat_artefato
  FOR EACH ROW EXECUTE FUNCTION app.trg_valida_artefato();

-- Registro só existe para etapa cujo produto é o do contrato.
CREATE OR REPLACE FUNCTION app.trg_valida_registro_produto() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_ok BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
      FROM ref_tipo_registro tr
      JOIN ref_etapa e     ON e.id_etapa = tr.id_etapa
      JOIN fat_contrato c  ON c.id_contrato = NEW.id_contrato
     WHERE tr.id_tipo_registro = NEW.id_tipo_registro
       AND e.id_produto = c.id_produto)
  INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Tipo de registro % não pertence à régua do produto do contrato %',
      NEW.id_tipo_registro, NEW.id_contrato;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_registro_produto BEFORE INSERT OR UPDATE OF id_tipo_registro, id_contrato
  ON fat_registro FOR EACH ROW EXECUTE FUNCTION app.trg_valida_registro_produto();

-- Insight herda o contrato do registro de origem, quando houver.
CREATE OR REPLACE FUNCTION app.trg_valida_insight_contrato() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_contrato BIGINT;
BEGIN
  IF NEW.id_registro IS NULL THEN RETURN NEW; END IF;
  SELECT id_contrato INTO v_contrato FROM fat_registro WHERE id_registro = NEW.id_registro;
  IF v_contrato IS DISTINCT FROM NEW.id_contrato THEN
    RAISE EXCEPTION 'Insight no contrato % aponta para registro do contrato %',
      NEW.id_contrato, v_contrato;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_insight_contrato BEFORE INSERT OR UPDATE OF id_registro, id_contrato
  ON fat_insight FOR EACH ROW EXECUTE FUNCTION app.trg_valida_insight_contrato();

-- =============================================================================
-- 13. ÍNDICES POR CAMINHO DE ACESSO
-- Não se indexa "tabela": indexa-se pergunta. Cada índice abaixo tem uma tela
-- ou relatório correspondente. Índice sem consulta é só custo de escrita.
-- =============================================================================

-- Carteira do usuário e suporte ao RLS (o índice mais importante do schema:
-- app.contratos_do_usuario() roda uma vez por query e cai aqui)
CREATE INDEX ix_vinculo_usuario_ativo ON rel_usuario_contrato (id_usuario, id_contrato) WHERE dt_fim IS NULL;
CREATE INDEX ix_vinculo_contrato      ON rel_usuario_contrato (id_contrato);

-- Visão do mandato (linha do tempo) e números de impacto
CREATE INDEX ix_contrato_contratante  ON fat_contrato (id_contratante, dt_inicio);
CREATE INDEX ix_contrato_produto      ON fat_contrato (id_produto, dt_inicio);
CREATE INDEX ix_contrato_projeto      ON fat_contrato (id_projeto);
CREATE INDEX ix_contrato_etapa_atual  ON fat_contrato (id_etapa_atual);
CREATE INDEX ix_contrato_anterior     ON fat_contrato (id_contrato_anterior);
CREATE INDEX ix_contratante_nome_norm ON dim_contratante (nome_normalizado);

-- Últimos registros do contrato
CREATE INDEX ix_registro_contrato_data ON fat_registro (id_contrato, ocorrido_em DESC);
CREATE INDEX ix_registro_tipo          ON fat_registro (id_tipo_registro);
CREATE INDEX ix_registro_encontro      ON fat_registro (id_encontro);

-- IIP do contrato
CREATE INDEX ix_fato_contrato_data ON fat_fato_gerador (id_contrato, dt_ocorrencia);
CREATE INDEX ix_fato_tipologia     ON fat_fato_gerador (id_tipologia);

-- Incidência por mandato
CREATE INDEX ix_insight_contrato ON fat_insight (id_contrato, criado_em DESC);
CREATE INDEX ix_insight_registro ON fat_insight (id_registro);

-- Etapas atrasadas (jornada gerencial 7.4.1)
CREATE INDEX ix_etapa_contrato_atraso ON fat_etapa_contrato (dt_prevista_conclusao)
  WHERE status NOT IN ('concluida','dispensada');
CREATE INDEX ix_etapa_contrato_etapa  ON fat_etapa_contrato (id_etapa);

-- Formulários abertos há muito tempo
CREATE INDEX ix_formulario_aberto ON rel_formulario_contrato (dt_abertura) WHERE estado = 'aberto';
CREATE INDEX ix_formulario_ref    ON rel_formulario_contrato (id_formulario);

-- Encontros planejados vencidos e agenda do contrato
CREATE INDEX ix_encontro_vencido  ON fat_encontro (dt_prevista_inicio) WHERE status = 'planejado';
CREATE INDEX ix_encontro_contrato ON fat_encontro (id_contrato, dt_prevista_inicio DESC);
CREATE INDEX ix_participante_usuario ON rel_encontro_participante (id_usuario);

-- Cascata de atingimento
CREATE INDEX ix_sucesso_meta      ON fat_sucesso_mensal (id_meta);
CREATE INDEX ix_sucesso_atrasado  ON fat_sucesso_mensal (dt_limite) WHERE status = 'pendente';
CREATE INDEX ix_meta_objetivo     ON fat_meta (id_objetivo);
CREATE INDEX ix_meta_responsavel  ON fat_meta (id_usuario_responsavel);
CREATE INDEX ix_objetivo_plan     ON fat_objetivo_especifico (id_planejamento);
CREATE INDEX ix_plan_desatualizado ON dim_planejamento (atualizado_em) WHERE atingimento_desatualizado;

-- Submissões e métricas
CREATE INDEX ix_submissao_contrato   ON fat_submissao (id_contrato, id_formulario);
CREATE INDEX ix_submissao_formulario ON fat_submissao (id_formulario);          -- agregação de NPS por formulário
CREATE INDEX ix_submissao_respondente ON fat_submissao (id_usuario_respondente); -- "meus formulários"
CREATE INDEX ix_resposta_metrica     ON fat_resposta_metrica (id_metrica) INCLUDE (valor_num);

-- Navegação reversa dos vínculos de origem: "quais fatos/insights apontam
-- para esta Meta". Os índices UNIQUE parciais só cobrem o sentido fato → meta.
CREATE INDEX ix_fato_origem_meta      ON rel_fato_origem (id_meta)      WHERE id_meta IS NOT NULL;
CREATE INDEX ix_fato_origem_insight   ON rel_fato_origem (id_insight)   WHERE id_insight IS NOT NULL;
CREATE INDEX ix_insight_origem_meta   ON rel_insight_origem (id_meta)   WHERE id_meta IS NOT NULL;
CREATE INDEX ix_insight_origem_suc    ON rel_insight_origem (id_sucesso) WHERE id_sucesso IS NOT NULL;

-- Autoria: "o que eu lancei" (Mentor e Gestora)
CREATE INDEX ix_registro_autor ON fat_registro (id_usuario_autor);
CREATE INDEX ix_fato_autor     ON fat_fato_gerador (id_usuario_autor);
CREATE INDEX ix_insight_autor  ON fat_insight (id_usuario_autor);

-- Exceções aceitas da asserção de FK indexada (§15): colunas de "quem fez"
-- que não são caminho de consulta, cobertas pelo log de auditoria —
-- fat_artefato.id_usuario_anexou, fat_gip.id_submissao,
-- fat_sucesso_mensal.atualizado_por, rel_formulario_contrato.id_usuario_abriu,
-- rel_mandato_candidatura.id_usuario_validou.
-- O WARNING no deploy é esperado e revisado, não ignorado.

-- Auditoria de impersonação
CREATE INDEX ix_log_impersonado ON log_auditoria (id_usuario_impersonado, ocorrido_em DESC)
  WHERE id_usuario_impersonado IS NOT NULL;

-- Artefatos de um registro/submissão/encontro
CREATE INDEX ix_artefato_referencia ON fat_artefato (escopo, id_referencia);
CREATE INDEX ix_artefato_contrato   ON fat_artefato (id_contrato);

-- Coalizão
CREATE INDEX ix_membro_coalizao ON rel_coalizao_membro (id_coalizao) WHERE dt_saida IS NULL;
CREATE INDEX ix_membro_contrato ON rel_coalizao_membro (id_contrato);

-- Série histórica
CREATE INDEX ix_snapshot_mes ON fat_snapshot_mensal (mes_referencia);

-- Vínculo e resolução de identidade TSE
CREATE INDEX ix_mandato_candidatura_sq ON rel_mandato_candidatura (ano_eleicao, sq_candidato);
CREATE INDEX ix_candidatura_titulo     ON tse.dim_candidatura (nr_titulo_eleitoral);
CREATE INDEX ix_votacao_candidato      ON tse.fat_votacao_zona (ano_eleicao, sq_candidato);

-- Auditoria
CREATE INDEX ix_log_alvo    ON log_auditoria (tabela, id_registro_alvo, ocorrido_em DESC);
CREATE INDEX ix_log_usuario ON log_auditoria (id_usuario, ocorrido_em DESC);

-- GIN em JSONB: criar SOMENTE quando existir busca por chave interna.
-- Até então é peso morto na escrita. Deixado documentado, não criado.
-- CREATE INDEX ix_registro_conteudo_gin  ON fat_registro USING gin (conteudo);
-- CREATE INDEX ix_submissao_respostas_gin ON fat_submissao USING gin (respostas);

-- =============================================================================
-- 14. PAPÉIS E PRIVILÉGIOS
-- RLS recorta linha; GRANT recorta tabela. Números de impacto e IIP são negados
-- ao Assessor por GRANT, não por política — não existe linha "dele" ali.
-- =============================================================================

DO $$
DECLARE r TEXT;
BEGIN
  FOREACH r IN ARRAY ARRAY['legisla_app','legisla_admin','legisla_gestora','legisla_mentor','legisla_assessor'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', r);
    END IF;
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public, app, tse TO legisla_app, legisla_admin, legisla_gestora, legisla_mentor, legisla_assessor;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO legisla_app, legisla_admin, legisla_gestora, legisla_mentor, legisla_assessor;

-- Aplicação e papéis Legisla: acesso pleno, recortado por RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO legisla_app, legisla_admin, legisla_gestora;
GRANT SELECT ON ALL TABLES IN SCHEMA tse TO legisla_app, legisla_admin, legisla_gestora;

-- Mentor: opera a própria carteira; não vê saída agregada global.
GRANT SELECT, INSERT, UPDATE ON
  fat_registro, fat_insight, fat_fato_gerador, rel_fato_origem, rel_insight_origem,
  fat_sucesso_mensal, fat_encontro, rel_encontro_participante, fat_submissao
  TO legisla_mentor;
GRANT SELECT ON
  fat_contrato, dim_contratante, dim_mandato, dim_planejamento, fat_objetivo_especifico,
  fat_meta, fat_etapa_contrato, rel_formulario_contrato, fat_artefato, fat_snapshot_mensal,
  rel_usuario_contrato, dim_usuario, vw_carteira, vw_etapa_contrato, vw_sucesso_mensal,
  mv_iip_contrato
  TO legisla_mentor;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO legisla_mentor;

-- Assessor: responde formulário e atualiza Sucesso Mensal. Nada além.
GRANT SELECT, UPDATE ON fat_sucesso_mensal TO legisla_assessor;
GRANT SELECT, INSERT, UPDATE ON fat_submissao TO legisla_assessor;
GRANT SELECT ON
  dim_planejamento, fat_objetivo_especifico, fat_meta, rel_formulario_contrato,
  ref_formulario, ref_preditor, ref_agenda_tematica, vw_sucesso_mensal
  TO legisla_assessor;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO legisla_assessor;

-- Catálogos: leitura para todos, escrita só para admin.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO legisla_mentor;
REVOKE SELECT ON mv_numeros_impacto, mv_avaliacao_nps, log_auditoria FROM legisla_mentor;
REVOKE SELECT ON mv_numeros_impacto, mv_avaliacao_nps, mv_iip_contrato, log_auditoria FROM legisla_assessor;

COMMENT ON MATERIALIZED VIEW mv_iip_contrato IS
'Materialized views não respeitam RLS. O recorte por carteira do Mentor acontece no JOIN de vw_carteira; o Assessor não recebe GRANT nenhum aqui. Refresh horário CONCURRENTLY (exige o índice UNIQUE acima).';

-- =============================================================================
-- 15. ASSERÇÕES DE DEPLOY
-- Transformam as regras inegociáveis em falha de deploy, não em item de revisão.
-- =============================================================================

-- "Nenhuma tabela é criada sem RLS definida" (Constituição §6).
DO $$
DECLARE v_faltando TEXT[];
BEGIN
  SELECT array_agg(c.relname ORDER BY c.relname) INTO v_faltando
    FROM pg_class c
    JOIN pg_namespace n  ON n.oid = c.relnamespace
    JOIN pg_attribute a  ON a.attrelid = c.oid AND a.attname = 'id_contrato' AND a.attnum > 0
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
  IF v_faltando IS NOT NULL THEN
    RAISE EXCEPTION 'Tabelas com id_contrato sem RLS habilitada: %', v_faltando;
  END IF;
END $$;

-- "Toda FK usada em filtro ou JOIN tem índice" — aviso, não bloqueio.
-- FK que aponta para catálogo ref_ é ignorada de propósito: indexar coluna de
-- baixa cardinalidade (5 preditores sobre 5 mil metas) não ajuda o planner.
-- Partições herdam o índice do pai e também são ignoradas.
DO $$
DECLARE v TEXT[];
BEGIN
  SELECT array_agg(DISTINCT format('%s.%s', c.conrelid::regclass, a.attname)) INTO v
    FROM pg_constraint c
    JOIN pg_attribute a  ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN pg_class cls    ON cls.oid = c.conrelid
   WHERE c.contype = 'f'
     AND c.connamespace = 'public'::regnamespace
     AND c.confrelid::regclass::text NOT LIKE 'ref_%'
     AND NOT cls.relispartition
     AND NOT EXISTS (SELECT 1 FROM pg_index i
                      WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1]);
  IF v IS NOT NULL THEN
    RAISE WARNING 'FKs sem índice na primeira coluna (revisar caso a caso): %', v;
  END IF;
END $$;

-- Nenhuma coluna de CPF em nenhum schema (regra de LGPD do modelo).
DO $$
DECLARE v TEXT[];
BEGIN
  SELECT array_agg(format('%s.%s.%s', table_schema, table_name, column_name)) INTO v
    FROM information_schema.columns WHERE column_name ILIKE '%cpf%';
  IF v IS NOT NULL THEN
    RAISE EXCEPTION 'Coluna de CPF encontrada: %', v;
  END IF;
END $$;

-- =============================================================================
-- 16. SEEDS DOS CATÁLOGOS
-- Os enums reais da operação, extraídos dos checklists e das planilhas atuais.
-- Partido, tipologia, indicador e agenda temática vêm por ETL/carga.
-- =============================================================================

-- Usuário técnico: garante que toda linha de auditoria tenha responsável.
INSERT INTO dim_usuario (email, nome, papel_global, ativo)
VALUES ('sistema@legislabrasil.org.br', 'Sistema (jobs e ETL)', 'admin', false)
ON CONFLICT (email) DO NOTHING;

INSERT INTO ref_produto (nome, operado_pelo_sistema) VALUES
  ('Estratégia', true), ('PLL', true), ('Coalizão', true),
  ('Banco de Aceleradores', false), ('Seleção', false), ('Governança', false),
  ('Workshop', false), ('TELF', false)
ON CONFLICT (nome) DO NOTHING;

INSERT INTO ref_nivel_iip (codigo, rotulo, valor, ordem) VALUES
  ('baixo', 'Baixo', 1, 1), ('medio', 'Médio', 2, 2), ('alto', 'Alto', 3, 3)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO ref_preditor (nome, ordem) VALUES
  ('Priorizam sua Agenda', 1),
  ('Pautam os Debates', 2),
  ('Ocupam lugar nos espaços de decisão', 3),
  ('Constroem Partido', 4),
  ('Articulam e mobilizam para a entrega de resultados', 5)
ON CONFLICT (nome) DO NOTHING;

INSERT INTO ref_perfil_atuacao (nome, ordem) VALUES
  ('Fiscalizadora', 1), ('Legisladora', 2), ('Articuladora/Mobilizadora', 3)
ON CONFLICT (nome) DO NOTHING;

-- Derivados das 4 perguntas da aba "Registros Insights" (decisão D5: confirmar).
INSERT INTO ref_pilar_insight (codigo, nome, ordem) VALUES
  ('contexto_sociopolitico', 'Contexto sociopolítico do mandato', 1),
  ('incidencia_politica',    'Incidência política (sugestão, recomendação, direcionamento)', 2),
  ('desafio_problema',       'Desafio/problema do momento (técnico, político, relacional, interno)', 3),
  ('conquistas_praticas',    'Conquistas e boas práticas', 4)
ON CONFLICT (codigo) DO NOTHING;

-- As 4 dimensões da régua de db_DO_Gabinete.
INSERT INTO ref_dimensao_gip (codigo, nome, valor_min, valor_max, ordem) VALUES
  ('qualidade_planejamento',  'Qualidade do planejamento',       1, 4, 1),
  ('atingimento_planejamento','Atingimento do planejamento',     1, 4, 2),
  ('capacidade_gestao',       'Capacidade de gestão',            1, 4, 3),
  ('autonomia_metodologia',   'Autonomia sobre a metodologia',   1, 4, 4)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO ref_cargo (nome, nivel_federativo, cd_cargo_tse) VALUES
  ('Vereador(a)',              'municipal', 13),
  ('Prefeito(a)',              'municipal', 11),
  ('Vice-Prefeito(a)',         'municipal', 12),
  ('Deputado(a) Estadual',     'estadual',   7),
  ('Deputado(a) Distrital',    'estadual',   8),
  ('Deputado(a) Federal',      'federal',    6),
  ('Senador(a)',               'federal',    5),
  ('Governador(a)',            'estadual',   3),
  ('Não se aplica',            'nao_se_aplica', NULL)
ON CONFLICT (nome) DO NOTHING;

-- Régua da Estratégia: 7 blocos do checklist.
-- duracao_prevista_dias são valores iniciais sugeridos — calibrar com a operação.
INSERT INTO ref_etapa (id_produto, codigo, nome, ordem, duracao_prevista_dias, gera_registro)
SELECT p.id_produto, v.codigo, v.nome, v.ordem, v.dias, v.gera
  FROM ref_produto p, (VALUES
    ('cadastro',       'Cadastro',                   1::smallint,   7::smallint, false),
    ('pontape',        'Pontapé',                    2,            14,           true),
    ('raio_x',         'Raio-X',                     3,            21,           true),
    ('imersao',        'Imersão',                    4,            14,           true),
    ('governanca',     'Governança / Organograma',   5,            45,           true),
    ('monitoramento',  'Monitoramento',              6,           120,           true),
    ('replicacao',     'Replicação',                 7,            14,           true)
  ) AS v(codigo, nome, ordem, dias, gera)
 WHERE p.nome = 'Estratégia'
ON CONFLICT (id_produto, codigo) DO NOTHING;

-- Régua do PLL: 5 blocos do checklist.
INSERT INTO ref_etapa (id_produto, codigo, nome, ordem, duracao_prevista_dias, gera_registro)
SELECT p.id_produto, v.codigo, v.nome, v.ordem, v.dias, v.gera
  FROM ref_produto p, (VALUES
    ('recrutamento', 'Recrutamento e seleção de participantes', 1::smallint, 30::smallint, false),
    ('selecao',      'Seleção e formação de mentores',          2,           30,           false),
    ('pontape',      'Pontapé',                                 3,           14,           false),
    ('imersao',      'Imersão e construção do planejamento',    4,            7,           true),
    ('mentorias',    'Mentorias e monitoramento',               5,          120,           true)
  ) AS v(codigo, nome, ordem, dias, gera)
 WHERE p.nome = 'PLL'
ON CONFLICT (id_produto, codigo) DO NOTHING;

-- D9: a régua da Coalizão segue EM ABERTO. A hipótese de trabalho é reusar a
-- régua da Estratégia; quando a operação confirmar, é este INSERT — nada mais:
--
-- INSERT INTO ref_etapa (id_produto, codigo, nome, ordem, duracao_prevista_dias, gera_registro)
-- SELECT (SELECT id_produto FROM ref_produto WHERE nome = 'Coalizão'),
--        e.codigo, e.nome, e.ordem, e.duracao_prevista_dias, e.gera_registro
--   FROM ref_etapa e JOIN ref_produto p ON p.id_produto = e.id_produto
--  WHERE p.nome = 'Estratégia'
-- ON CONFLICT (id_produto, codigo) DO NOTHING;
--
-- Coalizão sem planejamento próprio não tem régua: é visão filtrada por projeto
-- sobre os contratos membros, cada um com a régua da Estratégia.

-- Tipos de registro derivados literalmente das abas de "Registros Slack" e f_mentorias.
INSERT INTO ref_tipo_registro (id_etapa, codigo, nome, permite_multiplos, qtd_prevista)
SELECT e.id_etapa, v.codigo, v.nome, v.multiplos, v.qtd
  FROM ref_etapa e
  JOIN ref_produto p ON p.id_produto = e.id_produto
  JOIN (VALUES
    ('Estratégia','pontape',                 'pontape',                 'Pontapé',                        false, NULL::smallint),
    ('Estratégia','raio_x',                   'comite_politico',        'Comitê Político',                false, NULL),
    ('Estratégia','raio_x',                   'escuta_diagnostica',     'Escuta Diagnóstica',             false, NULL),
    ('Estratégia','imersao',                  'imersao',                'Imersão',                        false, NULL),
    ('Estratégia','governanca',               'sprint',                 'Sprint',                         true,  NULL),
    ('Estratégia','governanca',               'diagnostico_organograma','Diagnóstico de Organograma',     false, NULL),
    ('Estratégia','governanca',               'organograma',            'Proposta de Organograma',        false, NULL),
    ('Estratégia','monitoramento',            'monitoramento',          'Monitoramento mensal',           true,  4),
    ('Estratégia','replicacao',               'replicacao',             'Replicação',                     false, NULL),
    ('Estratégia','monitoramento',            'legisla_aliada',         'Legisla Aliada',                 true,  NULL),
    ('PLL',       'mentorias',                'mentoria',               'Mentoria',                       true,  5)
  ) AS v(produto, etapa, codigo, nome, multiplos, qtd)
    ON v.produto = p.nome AND v.etapa = e.codigo
ON CONFLICT (id_etapa, codigo) DO NOTHING;

-- Os 16 formulários do sistema.
INSERT INTO ref_formulario (id_etapa, codigo, nome, respondente, exige_anexo)
SELECT e.id_etapa, v.codigo, v.nome, v.respondente, v.anexo
  FROM ref_etapa e
  JOIN ref_produto p ON p.id_produto = e.id_produto
  JOIN (VALUES
    ('Estratégia','pontape',      'termo_compromisso',              'Termo de Compromisso',                  'assessor',            true),
    ('Estratégia','pontape',      'codigo_conduta',                 'Código de Conduta',                     'assessor',            true),
    ('Estratégia','pontape',      'introdutorio_assessores',        'Introdutório — Assessores',             'assessor',            false),
    ('Estratégia','pontape',      'introdutorio_cg_parlamentar',    'Introdutório — CG e Parlamentar',       'cargo_cg_parlamentar',false),
    ('Estratégia','pontape',      'organograma',                    'Organograma',                           'assessor',            false),
    ('Estratégia','raio_x',       'gip',                            'GIP (Início/Meio/Fim)',                 'gestora',             false),
    ('Estratégia','imersao',      'avaliacao_imersao',              'Avaliação da Imersão',                  'assessor',            false),
    ('Estratégia','replicacao',   'avaliacao_fim_ciclo',            'Avaliação de Fim de Ciclo',             'mandato',             false),
    ('PLL',       'recrutamento', 'inscricao_mentorado',            'Inscrição de Mentorados',               'mentorado',           false),
    ('PLL',       'recrutamento', 'diagnostico_tematicas',          'Diagnóstico e Temáticas de Interesse',  'mentorado',           false),
    ('PLL',       'selecao',      'inscricao_mentor',               'Inscrição de Mentores',                 'mentor',              false),
    ('PLL',       'imersao',      'avaliacao_imersao_pll',          'Avaliação da Imersão (PLL)',            'mentorado',           false),
    ('PLL',       'mentorias',    'avaliacao_parcial_participante', 'Avaliação Parcial — Participantes',     'mentorado',           false),
    ('PLL',       'mentorias',    'avaliacao_parcial_mentor',       'Avaliação Parcial — Mentores',          'mentor',              false),
    ('PLL',       'mentorias',    'avaliacao_final_participante',   'Avaliação Final — Participantes',       'mentorado',           false),
    ('PLL',       'mentorias',    'avaliacao_final_mentor',         'Avaliação Final — Mentores',            'mentor',              false)
  ) AS v(produto, etapa, codigo, nome, respondente, anexo)
    ON v.produto = p.nome AND v.etapa = e.codigo
ON CONFLICT (codigo) DO NOTHING;

-- Métrica de NPS presente em todos os formulários de avaliação.
INSERT INTO ref_metrica_formulario (id_formulario, codigo_campo, rotulo, tipo, eh_nps, agrupador)
SELECT f.id_formulario, 'nps_recomendacao', 'Recomendaria o programa (0-10)', 'escala_0_10', true, 'nps'
  FROM ref_formulario f
 WHERE f.codigo LIKE 'avaliacao%'
ON CONFLICT (id_formulario, codigo_campo) DO NOTHING;

COMMIT;

-- =============================================================================
-- 17. PÓS-DEPLOY (executar fora da transação)
-- =============================================================================

ANALYZE;

-- Primeira carga das projeções (WITH NO DATA na criação).
-- REFRESH MATERIALIZED VIEW mv_numeros_impacto;
-- REFRESH MATERIALIZED VIEW mv_iip_contrato;
-- REFRESH MATERIALIZED VIEW mv_avaliacao_nps;
-- REFRESH MATERIALIZED VIEW tse.mv_candidatura_resumo;

-- Jobs recomendados (pg_cron, Airflow ou equivalente):
--   * / 1h    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_iip_contrato;
--   diário    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_numeros_impacto;
--   diário    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_avaliacao_nps;
--   * / 5min  SELECT app.recalcula_pendentes(200);
--   mensal    SELECT app.cria_particoes_log(CURRENT_DATE + INTERVAL '6 months', 6);
--   mensal    INSERT em fat_snapshot_mensal (fechamento do mês);
--   safra     ETL do schema tse + REFRESH de tse.mv_candidatura_resumo.

-- =============================================================================
-- 18. TESTE DE RLS — tratar como regra de negócio, não como configuração
--
-- ATENÇÃO: superusuário IGNORA RLS mesmo com FORCE ROW LEVEL SECURITY. Testar
-- como superusuário dá falso "passou". Sempre assumir um papel não-privilegiado.
--
-- Resultado esperado: gestora e admin veem todos os contratos; cada mentor vê
-- só a própria carteira; e o mentor sem planejamento na carteira vê ZERO metas
-- — é o que prova que a herança de RLS via JOIN no pai está funcionando.
-- =============================================================================

-- DO $$
-- DECLARE r RECORD; v_reg INT; v_contratos TEXT; v_metas INT;
-- BEGIN
--   FOR r IN SELECT id_usuario, email, papel_global FROM dim_usuario ORDER BY id_usuario LOOP
--     PERFORM set_config('app.id_usuario', r.id_usuario::text, false);
--     SET LOCAL ROLE legisla_app;
--     SELECT count(*), string_agg(DISTINCT id_contrato::text, ',') INTO v_reg, v_contratos FROM fat_registro;
--     SELECT count(*) INTO v_metas FROM fat_meta;
--     RESET ROLE;
--     RAISE NOTICE '% (%): % registros em [%], % metas', r.email, r.papel_global, v_reg, v_contratos, v_metas;
--   END LOOP;
-- END $$;