-- =============================================================================
-- kanban-etapas: T2 — liga o trigger de auditoria genérico (app.trg_auditoria(),
-- já aprovado e provisionado em 0012_fundacao_auditoria_gap.sql) em
-- fat_etapa_contrato. Gap real (achado em Design, ver design.md "Risks &
-- Concerns"): esta tabela nunca teve trg_audit_fat_etapa_contrato ligado, nem
-- no loop original do schema aprovado (docs/schema_sistema.sql:1712-1732) nem
-- no gap-fix de 0012 (que cobriu dim_contratante/dim_coalizao/
-- rel_coalizao_membro/fat_contrato/dim_mandato/rel_usuario_contrato/
-- rel_mandato_candidatura, mas não esta). fat_contrato já tem o seu (0012) --
-- o UPDATE de id_etapa_atual já é auditado sem ação nova.
--
-- IF NOT EXISTS guardado via pg_trigger, mesmo padrão de 0012_fundacao_auditoria_gap.sql.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_fat_etapa_contrato') THEN
    CREATE TRIGGER trg_audit_fat_etapa_contrato AFTER INSERT OR UPDATE OR DELETE ON fat_etapa_contrato
      FOR EACH ROW EXECUTE FUNCTION app.trg_auditoria('id_etapa_contrato');
  END IF;
END $$;
