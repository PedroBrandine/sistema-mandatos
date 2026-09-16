-- ficha-mandato-contrato: T2 -- fat_artefato verbatim de
-- docs/schema_sistema.sql:931-948 (AD-008), provisionada pela primeira vez
-- (AD-025, provisionamento incremental). Nenhuma coluna, CHECK ou índice
-- redesenhado -- só CREATE ... IF NOT EXISTS, mesmo padrão de
-- incidencia_encontros_estrutura.sql.
--
-- id_referencia é polimórfico por escopo e não tem FK -- o schema aprovado
-- já previa validação por trigger de aplicação (comentário original da
-- tabela). Entra app.trg_valida_artefato_referencia(): quando
-- escopo = 'registro', exige fat_registro existente no MESMO id_contrato
-- (design.md, "Data Models" > fat_artefato). RLS fica para T7 (AD-001).

-- Uma linha = um documento ou link associado a algo do sistema.
-- docs/schema_sistema.sql:931-948.
CREATE TABLE IF NOT EXISTS fat_artefato (
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

-- (:950 -- comentário original da tabela, preservado verbatim)
COMMENT ON TABLE fat_artefato IS
'Consolida 14 colunas "Link ..." espalhadas por 6 abas das planilhas. Durante a transição, os links das bases antigas ficam anexados ao contrato com tipo = planilha_legada, em vez de virarem colunas mortas no schema novo. id_referencia é polimórfico por escopo e por isso não tem FK -- a integridade é validada por trigger de aplicação.';

CREATE INDEX IF NOT EXISTS ix_artefato_referencia ON fat_artefato (escopo, id_referencia);

-- Artefato de escopo='registro' só existe para registro do MESMO contrato.
-- Mesmo padrão de app.trg_valida_insight_contrato
-- (20260813192032_incidencia_encontros_triggers.sql), sem ERRCODE
-- customizado -- extração verbatim da regra descrita no schema aprovado,
-- não função nova.
CREATE OR REPLACE FUNCTION app.trg_valida_artefato_referencia() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_contrato BIGINT;
BEGIN
  IF NEW.escopo <> 'registro' THEN RETURN NEW; END IF;
  SELECT id_contrato INTO v_contrato FROM fat_registro WHERE id_registro = NEW.id_referencia;
  IF v_contrato IS DISTINCT FROM NEW.id_contrato THEN
    RAISE EXCEPTION 'Artefato no contrato % aponta para registro do contrato %',
      NEW.id_contrato, v_contrato;
  END IF;
  RETURN NEW;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_artefato_referencia') THEN
    CREATE TRIGGER trg_artefato_referencia BEFORE INSERT OR UPDATE OF escopo, id_referencia, id_contrato
      ON fat_artefato FOR EACH ROW EXECUTE FUNCTION app.trg_valida_artefato_referencia();
  END IF;
END $$;
