-- =============================================================================
-- T11: extensões e helpers imutáveis (docs/schema_sistema.sql:84-125, verbatim
-- exceto pg_trgm que é novo -- ver design.md "Risks & Concerns", mitigação da
-- busca por nome sobre tse.mv_candidatura_resumo usada por T18).
--
-- Renumerado: tasks.md nomeia este arquivo "0004_extensoes_helpers.sql";
-- deslocado para 0006 porque 0001-0005 já foram ocupados pelo pré-requisito de
-- Fase 0 (dim_usuario) e pelo Batch 1 (T1-T4) -- mesmo padrão de renumeração
-- documentado em T1-T9.
--
-- Já provisionado hoje (confirmado por T10, ver supabase/migrations/README.md):
-- extensão unaccent, schema app, app.f_unaccent, app.normaliza_nome, domínio
-- texto_limpo. Todos idempotentes (CREATE EXTENSION IF NOT EXISTS / CREATE OR
-- REPLACE / guarda manual de existência para o domínio) -- reaplicados aqui
-- sem risco, para que este arquivo seja a fonte completa e autocontida da
-- fatia "0. EXTENSÕES, SCHEMAS E HELPERS IMUTÁVEIS" do schema aprovado.
--
-- O que este arquivo efetivamente adiciona: btree_gin, pg_trgm, schemas
-- tse/stg, e GRANT USAGE ON SCHEMA tse aos 5 papéis (nota deixada pela
-- migração 0004: "quem criar tse deve regrantar USAGE aos 5 papéis").
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

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
-- CREATE DOMAIN não aceita IF NOT EXISTS -- guardado manualmente (já existe,
-- criado pelo pré-requisito de Fase 0; guarda evita erro de redeclaração).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'texto_limpo' AND typnamespace = 'public'::regnamespace
  ) THEN
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
  END IF;
END $$;

-- Correção de drift descoberta ao implementar T11: o domínio texto_limpo já
-- provisionado por 0001_plataforma_dim_usuario_prereq.sql ficou com uma
-- versão do CHECK contendo só 2 dos 12 sentinelas aprovados --
-- pg_get_constraintdef(texto_limpo_check) confirmou
-- "app.normaliza_nome(VALUE) <> ALL (ARRAY['pendente de atualizacao','nao coletado'])"
-- em vez da lista completa de docs/schema_sistema.sql:114-125. Reaplicado aqui
-- de forma idempotente (DROP + ADD da mesma constraint, sem recriar o tipo --
-- ALTER DOMAIN não afeta dim_usuario.telefone, que já usa este domínio).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'texto_limpo_check') THEN
    ALTER DOMAIN texto_limpo DROP CONSTRAINT texto_limpo_check;
  END IF;
  ALTER DOMAIN texto_limpo ADD CONSTRAINT texto_limpo_check CHECK (
    VALUE IS NULL OR (
      btrim(VALUE) <> ''
      AND app.normaliza_nome(VALUE) NOT IN (
        'pendente de atualizacao', 'nao coletado', 'nao informado',
        'nao se aplica', 'n/a', 'na', 'nd', '-', '--', 'null', 'undefined', 'sem nome'
      )
    )
  );
END $$;

-- tse é schema novo neste momento (T11): os 5 papéis precisam de USAGE para
-- que consultas futuras (busca de match TSE, T15+) funcionem sob RLS/GRANT
-- normal em vez de falhar por falta de USAGE no schema.
GRANT USAGE ON SCHEMA tse TO legisla_app, legisla_admin, legisla_gestora, legisla_mentor, legisla_assessor;
