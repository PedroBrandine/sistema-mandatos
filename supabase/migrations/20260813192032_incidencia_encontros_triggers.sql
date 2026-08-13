-- =============================================================================
-- incidencia-encontros: T3 -- triggers verbatim (AD-008) + reaplica
-- app.trg_auditoria() às 7 tabelas de Incidência/Encontros criadas em T2.
--
-- app.trg_valida_registro_produto (docs/schema_sistema.sql:1908-1928) e
-- app.trg_valida_insight_contrato (docs/schema_sistema.sql:1931-1945),
-- verbatim, SEM ERRCODE customizado -- ver design.md, Tech Decisions
-- ("Triggers verbatim ... sem ERRCODE customizado"): ERRCODE novo só entra em
-- função nova (ex.: app.mover_etapa_kanban), não em extração verbatim.
--
-- app.trg_auditoria() já existe (0012_fundacao_auditoria_gap.sql) -- não
-- recriada aqui, só ligada às 7 tabelas novas. Mesmo padrão idempotente
-- (IF NOT EXISTS via pg_trigger) de 0012/kanban_etapas_audit_trigger/
-- planejamento_planilha_auditoria.
-- =============================================================================

-- Registro só existe para etapa cujo produto é o do contrato.
-- docs/schema_sistema.sql:1907-1928.
CREATE OR REPLACE FUNCTION app.trg_valida_registro_produto() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_ok BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
      FROM ref_tipo_registro tr
      JOIN ref_etapa e     ON e.id_etapa = tr.id_etapa
      JOIN fat_contrato c  ON c.id_contrato = NEW.id_contrato
     WHERE tr.id_tipo_registro = NEW.id_tipo_registro
       AND e.id_produto = c.id_produto)
  INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Tipo de registro % não pertence à régua do produto do contrato %',
      NEW.id_tipo_registro, NEW.id_contrato;
  END IF;
  RETURN NEW;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_registro_produto') THEN
    CREATE TRIGGER trg_registro_produto BEFORE INSERT OR UPDATE OF id_tipo_registro, id_contrato
      ON fat_registro FOR EACH ROW EXECUTE FUNCTION app.trg_valida_registro_produto();
  END IF;
END $$;

-- Insight herda o contrato do registro de origem, quando houver.
-- docs/schema_sistema.sql:1930-1945.
CREATE OR REPLACE FUNCTION app.trg_valida_insight_contrato() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_contrato BIGINT;
BEGIN
  IF NEW.id_registro IS NULL THEN RETURN NEW; END IF;
  SELECT id_contrato INTO v_contrato FROM fat_registro WHERE id_registro = NEW.id_registro;
  IF v_contrato IS DISTINCT FROM NEW.id_contrato THEN
    RAISE EXCEPTION 'Insight no contrato % aponta para registro do contrato %',
      NEW.id_contrato, v_contrato;
  END IF;
  RETURN NEW;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_insight_contrato') THEN
    CREATE TRIGGER trg_insight_contrato BEFORE INSERT OR UPDATE OF id_registro, id_contrato
      ON fat_insight FOR EACH ROW EXECUTE FUNCTION app.trg_valida_insight_contrato();
  END IF;
END $$;

-- app.trg_auditoria() (docs/schema_sistema.sql:1674-1710) reaplicado às 7
-- tabelas novas -- mesma função, sem alteração, mesmo padrão de
-- 0012_fundacao_auditoria_gap.sql / planejamento_planilha_auditoria.sql.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('fat_encontro',              'id_encontro'),
    ('rel_encontro_participante', 'id_participacao'),
    ('fat_registro',              'id_registro'),
    ('fat_insight',               'id_insight'),
    ('rel_insight_origem',        'id_vinculo'),
    ('fat_fato_gerador',          'id_fato_gerador'),
    ('rel_fato_origem',           'id_vinculo')
  ) AS v(tabela, pk) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_' || r.tabela) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_audit_%s AFTER INSERT OR UPDATE OR DELETE ON %I
           FOR EACH ROW EXECUTE FUNCTION app.trg_auditoria(%L)',
        r.tabela, r.tabela, r.pk);
    END IF;
  END LOOP;
END $$;
