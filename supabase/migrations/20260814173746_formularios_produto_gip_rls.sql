-- =============================================================================
-- formularios-produto: T6 -- RLS de fat_gip + fat_gip_dimensao (T5).
--
-- p_por_contrato em fat_gip (mesmo padrão de fat_submissao/T2, sem cláusula
-- extra de autoria -- fat_gip não tem coluna de respondente próprio, é
-- derivada por trigger, nunca escrita direto pelo app). p_heranca em
-- fat_gip_dimensao (EXISTS contra fat_gip, que já tem FORCE ROW LEVEL
-- SECURITY) -- mesmo padrão de rel_encontro_participante em
-- 20260813192341_incidencia_encontros_rls.sql.
-- =============================================================================

ALTER TABLE fat_gip ENABLE ROW LEVEL SECURITY;
ALTER TABLE fat_gip FORCE ROW LEVEL SECURITY;

CREATE POLICY p_por_contrato ON fat_gip
  USING (app.papel_atual() IN ('admin','gestora')
         OR id_contrato = ANY(app.contratos_do_usuario()))
  WITH CHECK (app.papel_atual() IN ('admin','gestora')
         OR id_contrato = ANY(app.contratos_do_usuario()));

ALTER TABLE fat_gip_dimensao ENABLE ROW LEVEL SECURITY;
ALTER TABLE fat_gip_dimensao FORCE ROW LEVEL SECURITY;

CREATE POLICY p_heranca ON fat_gip_dimensao
  USING (EXISTS (SELECT 1 FROM fat_gip g WHERE g.id_gip = fat_gip_dimensao.id_gip))
  WITH CHECK (EXISTS (SELECT 1 FROM fat_gip g WHERE g.id_gip = fat_gip_dimensao.id_gip));
