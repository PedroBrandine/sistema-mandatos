-- =============================================================================
-- T12: catálogos dependentes de Fundação (docs/schema_sistema.sql:132-168,
-- verbatim) + seeds (docs/schema_sistema.sql:2172-2176, 2210-2220, verbatim).
--
-- Renumerado: tasks.md nomeia este arquivo "0005_catalogos_fundacao.sql";
-- deslocado para 0007 pelo mesmo motivo de renumeração de T11.
--
-- Apenas os 4 catálogos que a Fundação depende diretamente: ref_produto
-- (FND-CTR-01), ref_projeto (FND-COL-01), ref_cargo (snapshot em fat_contrato
-- e dim_mandato), ref_partido (idem). ref_etapa e os demais 12 catálogos do
-- schema aprovado pertencem a Planejamento/Operação -- fora desta feature.
--
-- Sem RLS: catálogos não têm política de RLS no schema aprovado (nenhum
-- ALTER TABLE ref_* ... ENABLE ROW LEVEL SECURITY existe em
-- docs/schema_sistema.sql) -- acesso é só por GRANT ("leitura para todos,
-- escrita só para admin", §14). Nenhuma tabela aqui tem id_contrato, então a
-- asserção de deploy do schema aprovado (§15, "toda tabela com id_contrato
-- tem RLS") não se aplica.
-- =============================================================================

CREATE TABLE IF NOT EXISTS ref_produto (
  id_produto            BIGSERIAL PRIMARY KEY,
  nome                  TEXT    NOT NULL UNIQUE,
  operado_pelo_sistema  BOOLEAN NOT NULL DEFAULT true,
  ativo                 BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS ref_projeto (
  id_projeto         BIGSERIAL PRIMARY KEY,
  nome               TEXT NOT NULL UNIQUE,
  tematica           TEXT,
  id_produto_padrao  BIGINT REFERENCES ref_produto(id_produto),
  dt_inicio          DATE,
  dt_fim             DATE,
  ativo              BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT ck_projeto_periodo CHECK (dt_fim IS NULL OR dt_inicio IS NULL OR dt_fim >= dt_inicio)
);

CREATE TABLE IF NOT EXISTS ref_cargo (
  id_cargo          BIGSERIAL PRIMARY KEY,
  nome              TEXT NOT NULL UNIQUE,
  nivel_federativo  TEXT NOT NULL,
  cd_cargo_tse      INTEGER,
  ativo             BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT ck_cargo_nivel CHECK (nivel_federativo IN ('federal','estadual','municipal','nao_se_aplica'))
);

CREATE TABLE IF NOT EXISTS ref_partido (
  id_partido       BIGSERIAL PRIMARY KEY,
  sigla            TEXT NOT NULL,
  nome             TEXT,
  numero           SMALLINT,
  dt_inicio_sigla  DATE,
  dt_fim_sigla     DATE,
  ativo            BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT uq_partido_sigla_vigencia UNIQUE (sigla, dt_inicio_sigla)
);

-- Re-GRANT necessário (AD-025, provisionamento incremental): "ALL TABLES IN
-- SCHEMA public" só cobre as tabelas existentes no momento do GRANT original
-- (migração 0004) -- toda migração que cria tabela nova em public precisa
-- repetir este GRANT (nota deixada explicitamente em 0004_plataforma_roles_grants.sql).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO legisla_app, legisla_admin, legisla_gestora;

-- Seeds (docs/schema_sistema.sql:2172-2176, 2210-2220, verbatim).
INSERT INTO ref_produto (nome, operado_pelo_sistema) VALUES
  ('Estratégia', true), ('PLL', true), ('Coalizão', true),
  ('Banco de Aceleradores', false), ('Seleção', false), ('Governança', false),
  ('Workshop', false), ('TELF', false)
ON CONFLICT (nome) DO NOTHING;

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
