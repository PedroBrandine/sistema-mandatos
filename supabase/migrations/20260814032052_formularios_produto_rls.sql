-- =============================================================================
-- formularios-produto: T2 -- RLS de fat_submissao/fat_resposta_metrica.
--
-- fat_submissao: p_por_contrato (mesmo texto de USING/WITH CHECK de
-- 20260813192341_incidencia_encontros_rls.sql), mais uma 2ª cláusula no
-- WITH CHECK (design.md, Tech Decisions/Risks & Concerns): diferente do
-- padrão de fat_registro (autoria travada sem exceção), aqui a autoria só é
-- exigida de quem NÃO é admin/gestora -- `id_usuario_respondente =
-- app.id_usuario() OR app.papel_atual() IN ('admin','gestora')`. Sem essa
-- disjunção, Gestora/Admin nunca conseguiriam reabrir/editar a resposta de
-- outra pessoa (spec.md P1 AC11, FRM-11).
--
-- fat_resposta_metrica: p_heranca (EXISTS contra fat_submissao, que já tem
-- p_por_contrato/FORCE ROW LEVEL SECURITY nesta mesma migration), mesmo
-- padrão de rel_encontro_participante em 20260813192341_incidencia_encontros_rls.sql.
-- =============================================================================

DO $$
BEGIN
  ALTER TABLE fat_submissao ENABLE ROW LEVEL SECURITY;
  ALTER TABLE fat_submissao FORCE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fat_submissao' AND policyname = 'p_por_contrato') THEN
    CREATE POLICY p_por_contrato ON fat_submissao
      USING (app.papel_atual() IN ('admin','gestora')
             OR id_contrato = ANY(app.contratos_do_usuario()))
      WITH CHECK ((app.papel_atual() IN ('admin','gestora')
             OR id_contrato = ANY(app.contratos_do_usuario()))
             AND (id_usuario_respondente = app.id_usuario()
                  OR app.papel_atual() IN ('admin','gestora')));
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE fat_resposta_metrica ENABLE ROW LEVEL SECURITY;
  ALTER TABLE fat_resposta_metrica FORCE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fat_resposta_metrica' AND policyname = 'p_heranca') THEN
    CREATE POLICY p_heranca ON fat_resposta_metrica
      USING (EXISTS (SELECT 1 FROM fat_submissao s WHERE s.id_submissao = fat_resposta_metrica.id_submissao))
      WITH CHECK (EXISTS (SELECT 1 FROM fat_submissao s WHERE s.id_submissao = fat_resposta_metrica.id_submissao));
  END IF;
END $$;
