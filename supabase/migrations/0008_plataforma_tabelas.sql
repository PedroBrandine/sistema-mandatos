-- =============================================================================
-- T13: rel_usuario_contrato e log_auditoria (docs/schema_sistema.sql:309-384,
-- verbatim). dim_usuario já existe (pré-requisito de Fase 0,
-- 0001_plataforma_dim_usuario_prereq.sql) -- não recriada aqui, só reforçada
-- defensivamente com IF NOT EXISTS.
--
-- Renumerado: tasks.md nomeia este arquivo "0006_plataforma_tabelas.sql";
-- deslocado para 0008 pelo mesmo motivo de renumeração de T11/T12.
--
-- RLS no mesmo DDL (AD-001, "nenhuma tabela é criada sem política de RLS
-- definida no mesmo momento do DDL"): p_vinculo_proprio e p_log_admin
-- aplicadas aqui, junto com a criação das tabelas -- mesmo padrão que
-- 0001_plataforma_dim_usuario_prereq.sql já usou para dim_usuario. Isso NÃO
-- duplica o trabalho de T16: T16 (RLS de Fundação) cita p_vinculo_proprio na
-- fatia que precisa aplicar, então sua criação lá é guardada por
-- IF NOT EXISTS -- e T16 nunca menciona p_log_admin no seu "What" (só está no
-- range de linhas citado como Reuses), então log_auditoria ficaria sem
-- nenhuma task dona de sua RLS se não fosse aplicada aqui -- AD-001 é regra
-- inegociável (§6), então é aplicada já.
-- =============================================================================

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

-- Uma linha = um vínculo de uma pessoa com um contrato, num papel.
CREATE TABLE IF NOT EXISTS rel_usuario_contrato (
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
CREATE TABLE IF NOT EXISTS log_auditoria (
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'log_auditoria_default') THEN
    CREATE TABLE log_auditoria_default PARTITION OF log_auditoria DEFAULT;
  END IF;
END $$;

SELECT app.cria_particoes_log(CURRENT_DATE, 18);

COMMENT ON TABLE log_auditoria IS
'Auditoria de alteração linha a linha. Cobre o CRUD auditado da Gestora sobre o planejamento (jornada A6) e a impersonação do Admin. Retenção: 24 meses quentes, partições anteriores exportadas e derrubadas com DROP.';

-- FK adiada (rel_usuario_contrato precede fat_contrato, criada só em T14).
-- Adicionada de forma condicional: se fat_contrato ainda não existir (caso
-- este arquivo rode antes de T14 num ambiente novo), a FK fica pendente e
-- T14 a adiciona -- neste batch, T13 roda antes de T14, então a tabela
-- ainda não existe e este bloco não executa; documentado para reprodutibilidade.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'fat_contrato' AND relnamespace = 'public'::regnamespace)
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_vinculo_contrato') THEN
    ALTER TABLE rel_usuario_contrato
      ADD CONSTRAINT fk_vinculo_contrato
      FOREIGN KEY (id_contrato) REFERENCES fat_contrato(id_contrato) ON DELETE RESTRICT;
  END IF;
END $$;

-- Re-GRANT necessário (AD-025): tabelas novas em public precisam do GRANT
-- amplo reaplicado (nota de 0004_plataforma_roles_grants.sql).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO legisla_app, legisla_admin, legisla_gestora;

-- --- RLS no mesmo DDL (AD-001) --------------------------------------------
-- Identidade: cada um vê o próprio vínculo; Legisla vê todos.
-- SEM FORCE (docs/schema_sistema.sql:1616-1617): app.contratos_do_usuario()
-- (T16 cria) precisa ler esta tabela como dono, sem FORCE ela ainda respeita
-- RLS para papéis normais mas não bloqueia a função SECURITY DEFINER.
DO $$
BEGIN
  ALTER TABLE rel_usuario_contrato ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rel_usuario_contrato' AND policyname = 'p_vinculo_proprio'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY p_vinculo_proprio ON rel_usuario_contrato
        USING (app.papel_atual() IN ('admin','gestora') OR id_usuario = app.id_usuario())
    $sql$;
  END IF;
END $$;

-- Auditoria: leitura restrita a admin.
DO $$
BEGIN
  ALTER TABLE log_auditoria ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'log_auditoria' AND policyname = 'p_log_admin'
  ) THEN
    EXECUTE $sql$ CREATE POLICY p_log_admin ON log_auditoria USING (app.papel_atual() = 'admin') $sql$;
  END IF;
END $$;
