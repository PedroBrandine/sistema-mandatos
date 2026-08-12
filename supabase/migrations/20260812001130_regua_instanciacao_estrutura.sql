-- =============================================================================
-- operacao-regua-instanciacao (.specs/features/operacao-regua-instanciacao/):
-- T1 — DDL das 3 tabelas de Operação/Planejamento que a instanciação de
-- contrato precisa (docs/schema_sistema.sql:708-889, verbatim) + a view
-- derivada de atraso (:1185-1194, verbatim). AD-025: provisionamento
-- incremental, extraído do documento aprovado — não redesenhado.
--
-- CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE VIEW: mesma idempotência de
-- 0007_catalogos_fundacao.sql e das migrations da Trilha C.
--
-- RLS, GRANT, função de instanciação e trigger ficam em migrations próprias
-- (regua_instanciacao_rls / _grants / _trigger_backfill) — esta é só DDL.
-- =============================================================================

-- Uma linha = o progresso de um contrato em uma etapa da régua.
-- dias_atraso é derivado em vw_etapa_contrato (C2 do schema aprovado), não armazenado.
CREATE TABLE IF NOT EXISTS fat_etapa_contrato (
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
CREATE TABLE IF NOT EXISTS rel_formulario_contrato (
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

-- Uma linha = o planejamento de um contrato.
CREATE TABLE IF NOT EXISTS dim_planejamento (
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

-- dias_atraso derivado (C2): usa CURRENT_DATE, logo não pode ser coluna gerada.
CREATE OR REPLACE VIEW vw_etapa_contrato WITH (security_invoker = true) AS
SELECT ec.*,
       e.codigo AS codigo_etapa,
       e.nome   AS nome_etapa,
       e.ordem,
       GREATEST(0, COALESCE(ec.dt_conclusao, CURRENT_DATE) - ec.dt_prevista_conclusao) AS dias_atraso,
       (ec.status <> 'concluida' AND ec.dt_prevista_conclusao < CURRENT_DATE)          AS esta_atrasada
FROM fat_etapa_contrato ec
JOIN ref_etapa e ON e.id_etapa = ec.id_etapa;
