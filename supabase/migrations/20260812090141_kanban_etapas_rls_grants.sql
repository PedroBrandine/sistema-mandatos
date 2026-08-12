-- =============================================================================
-- kanban-etapas: T1 — fecha os 2 gaps de infraestrutura achados durante Design
-- (.specs/features/kanban-etapas/design.md, "Risks & Concerns") que, sem
-- correção, tornam a US "Mentor/Assessor move card pra frente" (KAN-04/05)
-- impossível pelo GRANT (avaliado antes da RLS) e deixam fat_contrato.
-- p_por_carteira sem WITH CHECK explícito quando esta feature abre o primeiro
-- caminho de escrita não-Admin/Gestora nessa tabela.
--
-- 1) WITH CHECK explícito em p_por_carteira/fat_contrato (0011_fundacao_rls.sql
--    só declarou USING) — mesma categoria de correção da FND-USR-02
--    (20260810181508_fix_with_check_p_usuario.sql) e da regua-instanciacao_rls,
--    aplicada agora à tabela existente, não só às 3 tabelas novas de lá.
-- 2) GRANT UPDATE column-scoped (least privilege) em fat_etapa_contrato/
--    fat_contrato para legisla_mentor/legisla_assessor — hoje essas roles só
--    têm SELECT nas duas tabelas (0011_fundacao_rls.sql,
--    20260812001310_regua_instanciacao_grants.sql).
-- =============================================================================

ALTER POLICY p_por_carteira ON fat_contrato
  WITH CHECK (app.papel_atual() IN ('admin','gestora') OR id_contrato = ANY(app.contratos_do_usuario()));

GRANT UPDATE (status, dt_inicio, dt_conclusao) ON fat_etapa_contrato TO legisla_mentor, legisla_assessor;
GRANT UPDATE (id_etapa_atual) ON fat_contrato TO legisla_mentor, legisla_assessor;
