-- =============================================================================
-- planejamento-planilha-monitoramento (.specs/features/planejamento-planilha-monitoramento/):
-- T1 -- DDL das 4 tabelas que faltam da hierarquia de Planejamento
-- (docs/schema_sistema.sql:895-980, verbatim) + a view derivada de atraso
-- (:1196-1200, verbatim). AD-025: provisionamento incremental, extraído do
-- documento aprovado -- não redesenhado. `dim_planejamento` já existe
-- (operacao-regua-instanciacao) e não é tocada aqui.
--
-- RLS, GRANT, cascata e auditoria ficam em migrations próprias
-- (planejamento_planilha_rls / _grants / _cascata / _auditoria) -- esta é só DDL.
-- =============================================================================

-- Uma linha = um dos 3 preditores prioritários de um planejamento.
CREATE TABLE IF NOT EXISTS rel_planejamento_preditor (
  id_planejamento BIGINT   NOT NULL REFERENCES dim_planejamento(id_planejamento) ON DELETE CASCADE,
  id_preditor     BIGINT   NOT NULL REFERENCES ref_preditor(id_preditor),
  ordem           SMALLINT NOT NULL,
  CONSTRAINT pk_planejamento_preditor PRIMARY KEY (id_planejamento, id_preditor),
  CONSTRAINT uq_planejamento_preditor_ordem UNIQUE (id_planejamento, ordem),
  CONSTRAINT ck_planejamento_preditor_ordem CHECK (ordem BETWEEN 1 AND 3)
);

-- Uma linha = um objetivo específico de um planejamento.
CREATE TABLE IF NOT EXISTS fat_objetivo_especifico (
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
CREATE TABLE IF NOT EXISTS fat_meta (
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
CREATE TABLE IF NOT EXISTS fat_sucesso_mensal (
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

-- dias_atraso/esta_atrasado derivados: usam CURRENT_DATE, logo não podem ser coluna gerada.
CREATE OR REPLACE VIEW vw_sucesso_mensal WITH (security_invoker = true) AS
SELECT sm.*,
       GREATEST(0, CURRENT_DATE - sm.dt_limite) AS dias_atraso,
       (sm.status = 'pendente' AND sm.dt_limite < CURRENT_DATE) AS esta_atrasado
FROM fat_sucesso_mensal sm;
