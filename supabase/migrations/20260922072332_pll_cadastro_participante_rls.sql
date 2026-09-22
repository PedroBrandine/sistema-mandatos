-- =============================================================================
-- pll-cadastro-participantes: T2 -- RLS de fat_cadastro_participante.
--
-- p_por_contrato (mesmo padrão de 20260813192341_incidencia_encontros_rls.sql,
-- USING+WITH CHECK explícitos), com uma diferença exigida pela spec (D-4,
-- tasks.md T2 "Done when"): id_contrato é anulável aqui (staging pré-vínculo
-- TSE) e uma linha com id_contrato IS NULL não pertence à carteira de
-- ninguém ainda -- só Admin/Gestora a veem. Mentor só enxerga a linha depois
-- que o vínculo TSE preenche id_contrato E esse contrato está na própria
-- carteira (app.contratos_do_usuario()).
--
-- Assessor fica de fora desta política por completo (Out of Scope da spec:
-- "edição... pelo próprio Mentorado ou Assessor" não é desta fase) -- sem
-- GRANT para o papel, a RLS nem chega a ser avaliada para ele.
-- =============================================================================

ALTER TABLE fat_cadastro_participante ENABLE ROW LEVEL SECURITY;
ALTER TABLE fat_cadastro_participante FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'fat_cadastro_participante' AND policyname = 'p_por_contrato'
  ) THEN
    CREATE POLICY p_por_contrato ON fat_cadastro_participante
      USING (
        app.papel_atual() IN ('admin', 'gestora')
        OR (id_contrato IS NOT NULL AND id_contrato = ANY(app.contratos_do_usuario()))
      )
      WITH CHECK (
        app.papel_atual() IN ('admin', 'gestora')
        OR (id_contrato IS NOT NULL AND id_contrato = ANY(app.contratos_do_usuario()))
      );
  END IF;
END $$;
