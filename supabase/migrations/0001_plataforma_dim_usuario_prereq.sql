-- =============================================================================
-- Pré-requisito de Fase 0 (Plataforma minima -- sessão e RBAC)
--
-- Fundação (T1-T9, batch atual) precisa de `dim_usuario` e das funções de
-- sessão `app.id_usuario()`/`app.papel_atual()` para que os hooks de sessão
-- (T1, T2) e o teste de sessão fim-a-fim (T5) sejam testáveis. Essas 3 peças
-- pertencem à Plataforma (schema aprovado, docs/schema_sistema.sql), não à
-- Fundação -- e o provisionamento é incremental por feature (AD-025).
--
-- `dim_usuario` propriamente dita (com rel_usuario_contrato e log_auditoria)
-- é criada por completo na Fase 2 / T13 (fora deste batch). Este arquivo
-- adianta APENAS o necessário para T1/T2/T3/T5 não ficarem bloqueados:
--   - extensão `unaccent` + `app.f_unaccent`/`app.normaliza_nome` (usados pelo
--     domínio `texto_limpo`, que a coluna `telefone` de `dim_usuario` exige)
--   - domínio `texto_limpo`
--   - tabela `dim_usuario` (DDL verbatim de docs/schema_sistema.sql:309-321)
--   - RLS de `dim_usuario` (AD-001: nenhuma tabela sem RLS no mesmo DDL) --
--     política `p_usuario` verbatim de docs/schema_sistema.sql:1621-1623
--   - `app.id_usuario()`/`app.papel_atual()` (verbatim de
--     docs/schema_sistema.sql:1451-1461), referenciadas como "já aprovadas"
--     no `Reuses` de T2 e testadas diretamente pelo Done-when de T5
--
-- T13 (Fase 2) NÃO deve recriar `dim_usuario` -- usar `CREATE TABLE IF NOT
-- EXISTS` ou checar antes. T11 (Fase 2, extensões/helpers) NÃO deve falhar ao
-- reaplicar `unaccent`/`app.f_unaccent`/`app.normaliza_nome` (idempotentes,
-- via CREATE OR REPLACE / IF NOT EXISTS) nem `texto_limpo` (guardado abaixo
-- com checagem de existência, já que CREATE DOMAIN não aceita IF NOT EXISTS).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0a. Extensão + helpers imutáveis (docs/schema_sistema.sql:87-109, verbatim)
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.f_unaccent(TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

CREATE OR REPLACE FUNCTION app.normaliza_nome(TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS
$$ SELECT btrim(regexp_replace(lower(app.f_unaccent($1)), '\s+', ' ', 'g')) $$;

-- ---------------------------------------------------------------------------
-- 0b. Domínio texto_limpo (docs/schema_sistema.sql:114-125, verbatim)
-- CREATE DOMAIN não aceita IF NOT EXISTS -- guardado manualmente.
-- ---------------------------------------------------------------------------

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
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. dim_usuario (docs/schema_sistema.sql:309-321, verbatim)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dim_usuario (
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

-- RLS no mesmo DDL (AD-001). Política verbatim de docs/schema_sistema.sql:1621-1623.
-- app.papel_atual() é SECURITY DEFINER (definida abaixo) e por isso não recorre
-- nesta própria política.
ALTER TABLE dim_usuario ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'dim_usuario' AND policyname = 'p_usuario'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY p_usuario ON dim_usuario
        USING (app.papel_atual() IN ('admin','gestora') OR id_usuario = app.id_usuario())
    $sql$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Funções de sessão (docs/schema_sistema.sql:1451-1461, verbatim)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.id_usuario() RETURNS BIGINT
LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('app.id_usuario', true), '')::BIGINT $$;

CREATE OR REPLACE FUNCTION app.papel_atual() RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS
$$ SELECT papel_global FROM dim_usuario WHERE id_usuario = app.id_usuario() $$;
