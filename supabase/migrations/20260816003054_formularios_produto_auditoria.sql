-- =============================================================================
-- formularios-produto: achado do Verifier (Major, FRM-22) -- app.trg_auditoria()
-- nunca foi ligado a nenhuma das 4 tabelas novas desta feature. spec.md Edge
-- Cases afirmava que "fat_submissao/fat_gip/fat_gip_dimensao entram na
-- auditoria padrão" (AD-006), mas nenhuma migration de T1-T21 fez isso --
-- gap real, confirmado vazio contra o banco de dev (information_schema.
-- triggers não tinha nenhum trg_audit_* nas 4 tabelas).
--
-- Só fat_submissao e fat_gip recebem o trigger -- mesmo critério já usado no
-- projeto pras tabelas puramente derivadas (fat_resposta_metrica/
-- fat_gip_dimensao nunca são escritas por um usuário, só por trigger a
-- partir de fat_submissao/fat_gip já auditadas; auditar a derivada seria
-- duplicar a mesma mudança 2x em log_auditoria sem informação nova).
--
-- app.trg_auditoria() já existe (0012_fundacao_auditoria_gap.sql) -- não
-- recriada aqui, só ligada. Mesmo padrão idempotente (IF NOT EXISTS via
-- pg_trigger) de incidencia_encontros_triggers.sql/kanban_etapas_audit_trigger.sql.
-- =============================================================================

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('fat_submissao', 'id_submissao'),
    ('fat_gip',        'id_gip')
  ) AS v(tabela, pk) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_' || r.tabela) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_audit_%s AFTER INSERT OR UPDATE OR DELETE ON %I
           FOR EACH ROW EXECUTE FUNCTION app.trg_auditoria(%L)',
        r.tabela, r.tabela, r.pk);
    END IF;
  END LOOP;
END $$;
