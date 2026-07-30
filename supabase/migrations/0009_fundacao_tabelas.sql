-- =============================================================================
-- T14: Fundação e âncora -- dim_contratante, dim_mandato, dim_coalizao,
-- fat_contrato, rel_coalizao_membro (docs/schema_sistema.sql:391-512, verbatim).
--
-- Renumerado: tasks.md nomeia este arquivo "0007_fundacao_tabelas.sql";
-- deslocado para 0009 pelo mesmo motivo de renumeração de T11-T13.
--
-- Sem RLS aqui de propósito: T16 ("Aplicar RLS já aprovada nas tabelas de
-- Fundação") é a task explicitamente dona da RLS destas 5 tabelas no
-- Execution Plan aprovado (docs/schema_sistema.sql:1615-1656) -- diferente de
-- rel_usuario_contrato/log_auditoria em T13, nenhuma tabela aqui fica sem
-- task dona de sua RLS (T16 cobre as 5 explicitamente), então a criação e a
-- RLS ficam em tasks separadas como o plano aprovado define.
-- =============================================================================

-- Uma linha = uma entidade que pode contratar (supertipo).
CREATE TABLE IF NOT EXISTS dim_contratante (
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
CREATE TABLE IF NOT EXISTS dim_mandato (
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

-- Uma linha = uma coalizão (subtipo 1:1 de contratante).
CREATE TABLE IF NOT EXISTS dim_coalizao (
  id_coalizao                 BIGSERIAL PRIMARY KEY,
  id_contratante              BIGINT  NOT NULL UNIQUE REFERENCES dim_contratante(id_contratante) ON DELETE RESTRICT,
  id_projeto_origem           BIGINT  REFERENCES ref_projeto(id_projeto),
  possui_planejamento_proprio BOOLEAN NOT NULL DEFAULT false
);

-- Uma linha = um contratante × um produto × uma edição.
CREATE TABLE IF NOT EXISTS fat_contrato (
  id_contrato              BIGSERIAL PRIMARY KEY,
  id_contratante           BIGINT NOT NULL REFERENCES dim_contratante(id_contratante) ON DELETE RESTRICT,
  id_produto               BIGINT NOT NULL REFERENCES ref_produto(id_produto),
  id_projeto               BIGINT REFERENCES ref_projeto(id_projeto),
  id_contrato_anterior     BIGINT REFERENCES fat_contrato(id_contrato),
  id_etapa_atual           BIGINT,
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

COMMENT ON COLUMN fat_contrato.id_etapa_atual IS
'FK para ref_etapa omitida nesta migração (SPEC_DEVIATION -- ref_etapa é Operação, fora do escopo de Fundação/T10-T19, AD-025 incremental). Coluna criada sem REFERENCES; a FK é adicionada por quem provisionar ref_etapa/Operação.';

-- FK adiada de T13 (rel_usuario_contrato precede a âncora por ser lida pelo RLS).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_vinculo_contrato') THEN
    ALTER TABLE rel_usuario_contrato
      ADD CONSTRAINT fk_vinculo_contrato
      FOREIGN KEY (id_contrato) REFERENCES fat_contrato(id_contrato) ON DELETE RESTRICT;
  END IF;
END $$;

-- Uma linha = a participação de um contrato de mandato numa coalizão, num período.
CREATE TABLE IF NOT EXISTS rel_coalizao_membro (
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

-- Suporte à checagem de duplicata de contratante (T14 Done-when).
CREATE INDEX IF NOT EXISTS ix_contratante_nome_norm ON dim_contratante (nome_normalizado);

-- NOTA DE ESCOPO: trg_atualizado_em (docs/schema_sistema.sql:1662-1670) NÃO é
-- criado nesta migração -- pertence a §12 TRIGGERS, fora da fatia §3/§4 que
-- T14 tem como Reuses (391-512), e nenhuma task de T10-T19 o reivindica (o
-- mesmo padrão já usado pelo pré-requisito de Fase 0: dim_usuario também não
-- tem trg_upd_usuario aplicado ainda). atualizado_em fica só com o DEFAULT
-- now() na criação até uma task futura de triggers cobrir isso.

-- Re-GRANT necessário (AD-025): tabelas novas em public precisam do GRANT
-- amplo reaplicado (nota de 0004_plataforma_roles_grants.sql).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO legisla_app, legisla_admin, legisla_gestora;
