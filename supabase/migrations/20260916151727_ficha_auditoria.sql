-- ficha-mandato-contrato: T9 -- liga o trigger de auditoria genérico
-- (app.trg_auditoria(), já aprovado e provisionado em
-- 0012_fundacao_auditoria_gap.sql -- NÃO recriado aqui) às 3 tabelas novas
-- do lote 1 (fat_artefato, rel_registro_participante,
-- rel_mandato_agenda_tematica), fechando AD-006 ("toda escrita guarda autor
-- e timestamp") para elas.
--
-- rel_mandato_agenda_tematica tem PK composta (id_mandato, id_agenda), sem
-- coluna surrogate -- mesmo caso de rel_planejamento_preditor
-- (20260812150038_planejamento_planilha_auditoria.sql), que usa a PRIMEIRA
-- coluna da PK composta como id_registro_alvo. Replicado aqui verbatim:
-- id_mandato.
--
-- IF NOT EXISTS guardado via pg_trigger, mesmo padrão idempotente de
-- 0012_fundacao_auditoria_gap.sql / kanban_etapas_audit_trigger.sql /
-- planejamento_planilha_auditoria.sql.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('fat_artefato',                'id_artefato'),
    ('rel_registro_participante',   'id_participacao'),
    ('rel_mandato_agenda_tematica', 'id_mandato')
  ) AS v(tabela, pk) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_' || r.tabela) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_audit_%s AFTER INSERT OR UPDATE OR DELETE ON %I
           FOR EACH ROW EXECUTE FUNCTION app.trg_auditoria(%L)',
        r.tabela, r.tabela, r.pk);
    END IF;
  END LOOP;
END $$;
