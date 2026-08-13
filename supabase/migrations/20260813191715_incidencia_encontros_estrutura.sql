-- =============================================================================
-- incidencia-encontros: T2 -- DDL das 7 tabelas de Incidência + Encontros,
-- verbatim docs/schema_sistema.sql (AD-008), mais mv_iip_contrato. Nenhuma
-- coluna, CHECK, índice ou comentário alterado -- só CREATE ... IF NOT EXISTS
-- (AD-025, provisionamento incremental).
--
-- fat_encontro + rel_encontro_participante: docs/schema_sistema.sql:786-835.
-- fat_registro:                             docs/schema_sistema.sql:1035-1060.
-- fat_insight + rel_insight_origem:         docs/schema_sistema.sql:1063-1094.
-- fat_fato_gerador + rel_fato_origem:       docs/schema_sistema.sql:1098-1140.
-- mv_iip_contrato:                          docs/schema_sistema.sql:1247-1269.
-- =============================================================================

-- Uma linha = um encontro previsto ou realizado num contrato.
-- docs/schema_sistema.sql:786-808.
CREATE TABLE IF NOT EXISTS fat_encontro (
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
-- cancelado ficam de fora para permitir a substituição. (:810-814)
CREATE UNIQUE INDEX IF NOT EXISTS uq_encontro_sequencia
  ON fat_encontro (id_contrato, id_tipo_registro, nr_sequencia)
  WHERE nr_sequencia IS NOT NULL AND status IN ('planejado','realizado');

COMMENT ON TABLE fat_encontro IS
'Substitui fat_evento da v3 e introduz o lado planejado do ciclo. Com status e data prevista, três perguntas passam a ter resposta: a mentoria 3 aconteceu? quantos encontros foram remarcados nesta edição? quais mandatos estão com a agenda parada?';

-- Uma linha = a presença de uma pessoa em um encontro. docs/schema_sistema.sql:819-829.
CREATE TABLE IF NOT EXISTS rel_encontro_participante (
  id_participacao BIGSERIAL PRIMARY KEY,
  id_encontro     BIGINT  NOT NULL REFERENCES fat_encontro(id_encontro) ON DELETE CASCADE,
  id_usuario      BIGINT  REFERENCES dim_usuario(id_usuario),
  nome_livre      texto_limpo,
  origem          TEXT    NOT NULL,
  presente        BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT ck_participante_origem CHECK (origem IN ('legisla','mandato','externo')),
  CONSTRAINT ck_participante_identificacao CHECK ((id_usuario IS NULL) <> (nome_livre IS NULL))
);

-- (:831-832)
CREATE UNIQUE INDEX IF NOT EXISTS uq_encontro_participante_usuario
  ON rel_encontro_participante (id_encontro, id_usuario) WHERE id_usuario IS NOT NULL;

COMMENT ON TABLE rel_encontro_participante IS
'Substitui a coluna "Presentes" como texto livre em 8 abas de registro. Permite medir engajamento do gabinete e Legislers por encontro — hoje impossível sem interpretar string.';

-- Uma linha = um lançamento de reunião realizada, num contrato.
-- docs/schema_sistema.sql:1035-1050.
CREATE TABLE IF NOT EXISTS fat_registro (
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

-- (:1052-1054)
CREATE UNIQUE INDEX IF NOT EXISTS uq_registro_sequencia
  ON fat_registro (id_contrato, id_tipo_registro, nr_sequencia)
  WHERE nr_sequencia IS NOT NULL;

COMMENT ON TABLE fat_registro IS
'Substitui os comandos /registro - <etapa> do Slack. nr_sequencia resolve sprint xN, monitoramento 1-4 e mentoria 1-5 sem coluna por ocorrência.';

COMMENT ON COLUMN fat_registro.resumo IS
'Fora do JSONB de propósito: aparece em toda listagem. Campo sempre exibido não fica dentro de JSON.';

-- Uma linha = uma anotação qualitativa, opcionalmente num pilar.
-- docs/schema_sistema.sql:1063-1074.
CREATE TABLE IF NOT EXISTS fat_insight (
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
-- docs/schema_sistema.sql:1080-1086.
CREATE TABLE IF NOT EXISTS rel_insight_origem (
  id_vinculo   BIGSERIAL PRIMARY KEY,
  id_insight   BIGINT NOT NULL REFERENCES fat_insight(id_insight) ON DELETE CASCADE,
  id_meta      BIGINT REFERENCES fat_meta(id_meta) ON DELETE CASCADE,
  id_sucesso   BIGINT REFERENCES fat_sucesso_mensal(id_sucesso) ON DELETE CASCADE,
  CONSTRAINT ck_insight_origem CHECK (id_meta IS NOT NULL OR id_sucesso IS NOT NULL)
);

-- (:1088-1091)
CREATE UNIQUE INDEX IF NOT EXISTS uq_insight_origem_meta
  ON rel_insight_origem (id_insight, id_meta) WHERE id_meta IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_insight_origem_sucesso
  ON rel_insight_origem (id_insight, id_sucesso) WHERE id_sucesso IS NOT NULL;

COMMENT ON TABLE rel_insight_origem IS
'A base atual tem insight ligado a Meta (46%), a Sucesso Mensal (25%) e a nada. Duas colunas FK anuláveis não expressam "e/ou"; tabela de vínculo expressa.';

-- Uma linha = uma ação política observada, num contrato.
-- docs/schema_sistema.sql:1098-1117.
CREATE TABLE IF NOT EXISTS fat_fato_gerador (
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
-- docs/schema_sistema.sql:1126-1132.
CREATE TABLE IF NOT EXISTS rel_fato_origem (
  id_vinculo       BIGSERIAL PRIMARY KEY,
  id_fato_gerador  BIGINT NOT NULL REFERENCES fat_fato_gerador(id_fato_gerador) ON DELETE CASCADE,
  id_meta          BIGINT REFERENCES fat_meta(id_meta) ON DELETE CASCADE,
  id_insight       BIGINT REFERENCES fat_insight(id_insight) ON DELETE CASCADE,
  CONSTRAINT ck_fato_origem CHECK (id_meta IS NOT NULL OR id_insight IS NOT NULL)
);

-- (:1134-1137)
CREATE UNIQUE INDEX IF NOT EXISTS uq_fato_origem_meta
  ON rel_fato_origem (id_fato_gerador, id_meta) WHERE id_meta IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_fato_origem_insight
  ON rel_fato_origem (id_fato_gerador, id_insight) WHERE id_insight IS NOT NULL;

COMMENT ON TABLE rel_fato_origem IS
'Vínculo em tabela, não colunas no fato: a jornada permite Meta e/ou Insight, e permite fato sem origem — que é simplesmente a ausência de linha aqui.';

-- Uma linha = um contrato, com o IIP e seus componentes.
-- FÓRMULA PROVISÓRIA (decisão D2): os insumos estão certos e são suficientes;
-- a aritmética final é da área de conhecimento. Trocar a fórmula é alterar esta
-- expressão, não migrar dado. contribuicao_legisla não entra até D3 fechar.
-- docs/schema_sistema.sql:1247-1267. WITH NO DATA -- mesmo padrão idempotente
-- de tse.mv_perfil_eleitorado_candidatura (0019), CREATE dentro de
-- IF NOT EXISTS via pg_matviews.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'mv_iip_contrato') THEN
    EXECUTE $sql$
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
      WITH NO DATA
    $sql$;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_iip_contrato ON mv_iip_contrato (id_contrato);

-- Achado real de Design (design.md, "Migrations Plan" item 2): REFRESH
-- MATERIALIZED VIEW CONCURRENTLY (usada por app.atualiza_iip_contrato(), T8)
-- exige que a MV já tenha sido populada SEM CONCURRENTLY ao menos uma vez --
-- criar WITH NO DATA e só usar CONCURRENTLY depois falha com "materialized
-- view has not been populated". Populamos aqui (0 linhas -- nenhum Fato
-- Gerador existe ainda neste ponto da feature) só pra satisfazer esse
-- requisito do Postgres antes de qualquer CONCURRENTLY futuro. Roda sempre
-- (fora do IF NOT EXISTS acima) -- idempotente por natureza: um REFRESH
-- recalcula a partir de fat_fato_gerador, nunca destrói dado.
REFRESH MATERIALIZED VIEW mv_iip_contrato;
