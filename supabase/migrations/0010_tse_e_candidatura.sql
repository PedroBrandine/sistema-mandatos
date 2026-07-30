-- =============================================================================
-- T15: schema tse (dim_candidatura, fat_votacao_zona, dim_perfil_eleitorado,
-- rel_rede_social, mv_candidatura_resumo) + rel_mandato_candidatura
-- (docs/schema_sistema.sql:521-700, verbatim).
--
-- Renumerado: tasks.md nomeia este arquivo "0008_tse_e_candidatura.sql";
-- deslocado para 0010 pelo mesmo motivo de renumeração de T11-T14.
--
-- Sem RLS em tse.* (dado público -- comentário do schema aprovado,
-- docs/schema_sistema.sql:515-517). rel_mandato_candidatura é "Fundação" e
-- sua RLS (p_por_carteira) é aplicada por T16, junto com as outras 5 tabelas.
-- =============================================================================

CREATE TABLE IF NOT EXISTS tse.dim_candidatura (
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

CREATE TABLE IF NOT EXISTS tse.dim_candidatura_2022 PARTITION OF tse.dim_candidatura FOR VALUES IN (2022);
CREATE TABLE IF NOT EXISTS tse.dim_candidatura_2024 PARTITION OF tse.dim_candidatura FOR VALUES IN (2024);
CREATE TABLE IF NOT EXISTS tse.dim_candidatura_outras PARTITION OF tse.dim_candidatura DEFAULT;

COMMENT ON TABLE tse.dim_candidatura IS
'consulta_cand do TSE, grão candidatura × turno. NR_CPF_CANDIDATO é descartado no staging e não existe aqui. Não tem CD_MUNICIPIO — para chegar ao município é preciso passar por fat_votacao_zona, e é por isso que dim_mandato guarda município próprio.';

CREATE TABLE IF NOT EXISTS tse.fat_votacao_zona (
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

CREATE TABLE IF NOT EXISTS tse.fat_votacao_zona_2022 PARTITION OF tse.fat_votacao_zona FOR VALUES IN (2022);
CREATE TABLE IF NOT EXISTS tse.fat_votacao_zona_2024 PARTITION OF tse.fat_votacao_zona FOR VALUES IN (2024);
CREATE TABLE IF NOT EXISTS tse.fat_votacao_zona_outras PARTITION OF tse.fat_votacao_zona DEFAULT;

COMMENT ON TABLE tse.fat_votacao_zona IS
'~4,3 GB na safra 2022 contra ~328 MB em 2024 (2022 inclui todos os cargos gerais). Motivo do particionamento e da regra de a operação nunca ler esta tabela direto.';

CREATE TABLE IF NOT EXISTS tse.dim_perfil_eleitorado (
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

CREATE TABLE IF NOT EXISTS tse.dim_perfil_eleitorado_2022 PARTITION OF tse.dim_perfil_eleitorado FOR VALUES IN (2022);
CREATE TABLE IF NOT EXISTS tse.dim_perfil_eleitorado_2024 PARTITION OF tse.dim_perfil_eleitorado FOR VALUES IN (2024);
CREATE TABLE IF NOT EXISTS tse.dim_perfil_eleitorado_outras PARTITION OF tse.dim_perfil_eleitorado DEFAULT;

COMMENT ON TABLE tse.dim_perfil_eleitorado IS
'Atenção aos nomes divergentes da fonte: AA_ELEICAO (não ANO_ELEICAO), CD_RACA_COR (não CD_COR_RACA), CD_GRAU_ESCOLARIDADE (não CD_GRAU_INSTRUCAO). Normalizados aqui.';

CREATE TABLE IF NOT EXISTS tse.rel_rede_social (
  sq_candidato            BIGINT   NOT NULL,
  nr_ordem_rede_social    SMALLINT NOT NULL,
  ano_eleicao             SMALLINT NOT NULL,
  ds_url                  TEXT     NOT NULL,
  carregado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_rede_social PRIMARY KEY (sq_candidato, nr_ordem_rede_social)
);

-- Projeção agregada: única superfície TSE que a aplicação consulta.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'tse' AND matviewname = 'mv_candidatura_resumo') THEN
    EXECUTE $sql$
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
      WITH NO DATA
    $sql$;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_candidatura_resumo
  ON tse.mv_candidatura_resumo (ano_eleicao, sq_candidato, nr_turno);

COMMENT ON MATERIALIZED VIEW tse.mv_candidatura_resumo IS
'Índice UNIQUE obrigatório para REFRESH MATERIALIZED VIEW CONCURRENTLY. Refresh apenas após carga de safra (evento raro).';

-- Uma linha = um vínculo aceito entre um mandato do sistema e uma candidatura.
CREATE TABLE IF NOT EXISTS rel_mandato_candidatura (
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_mandato_candidatura_vigente
  ON rel_mandato_candidatura (id_mandato) WHERE eh_mandato_vigente;

COMMENT ON TABLE rel_mandato_candidatura IS
'O match nunca acontece em tempo de consulta: casar por nome numa base de centenas de milhares de candidatos a cada abertura de tela é lento e erra. Vínculo materializado, revisado por pessoa, com método e confiança — para que um match fraco seja auditável em vez de invisível. Mandato reeleito tem duas linhas confirmadas e apenas uma vigente.';

-- Re-GRANT necessário (AD-025): rel_mandato_candidatura é tabela nova em
-- public; tse.* precisa de SELECT para os 3 papéis com acesso pleno
-- (docs/schema_sistema.sql:2077, "GRANT SELECT ON ALL TABLES IN SCHEMA tse").
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO legisla_app, legisla_admin, legisla_gestora;
GRANT SELECT ON ALL TABLES IN SCHEMA tse TO legisla_app, legisla_admin, legisla_gestora;
