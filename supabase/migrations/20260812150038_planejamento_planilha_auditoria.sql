-- =============================================================================
-- planejamento-planilha-monitoramento: T5 -- liga o trigger de auditoria
-- genérico (app.trg_auditoria(), já aprovado e provisionado em
-- 0012_fundacao_auditoria_gap.sql -- NÃO recriado aqui) às 5 tabelas que o
-- próprio comentário de 0012 e de 20260812090853_kanban_etapas_audit_trigger.sql
-- já apontam como fora de escopo daquelas features ("tabelas de Planejamento
-- que ainda não existiam"): dim_planejamento, fat_objetivo_especifico,
-- fat_meta, fat_sucesso_mensal, rel_planejamento_preditor
-- (docs/schema_sistema.sql:1712-1732, pk de cada uma).
--
-- IF NOT EXISTS guardado via pg_trigger, mesmo padrão idempotente de
-- 0012_fundacao_auditoria_gap.sql / kanban_etapas_audit_trigger.sql.
-- =============================================================================

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('dim_planejamento',         'id_planejamento'),
    ('fat_objetivo_especifico',  'id_objetivo'),
    ('fat_meta',                 'id_meta'),
    ('fat_sucesso_mensal',       'id_sucesso'),
    ('rel_planejamento_preditor','id_planejamento')
  ) AS v(tabela, pk) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_' || r.tabela) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_audit_%s AFTER INSERT OR UPDATE OR DELETE ON %I
           FOR EACH ROW EXECUTE FUNCTION app.trg_auditoria(%L)',
        r.tabela, r.tabela, r.pk);
    END IF;
  END LOOP;
END $$;
