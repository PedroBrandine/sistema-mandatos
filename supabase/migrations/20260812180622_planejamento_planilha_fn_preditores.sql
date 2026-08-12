-- =============================================================================
-- planejamento-planilha-monitoramento: PLM-16 -- extensão de escopo (achado
-- ao entregar P1: faltava tela pra editar os até-3 preditores prioritários
-- do planejamento, rel_planejamento_preditor).
--
-- Nova (fora do texto aprovado), justificada por AD-024: DELETE+INSERT do
-- conjunto inteiro precisa de atomicidade real -- se o INSERT falhar no
-- meio (ex.: id_preditor duplicado, viola a PK composta), não queremos ter
-- apagado o conjunto antigo sem o novo ter entrado. SECURITY INVOKER (sem
-- cláusula): diferente da cascata (AD-035), aqui quem chama (Gestora/Admin)
-- já tem GRANT DELETE+INSERT completo em rel_planejamento_preditor (GRANT
-- amplo ALL TABLES) e passa pela RLS p_heranca normalmente (herda o mesmo
-- branch de admin/gestora de dim_planejamento) -- nenhum bypass necessário.
-- =============================================================================

CREATE OR REPLACE FUNCTION app.substitui_preditores_planejamento(p_id_planejamento BIGINT, p_preditores JSONB)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM rel_planejamento_preditor WHERE id_planejamento = p_id_planejamento;

  INSERT INTO rel_planejamento_preditor (id_planejamento, id_preditor, ordem)
  SELECT p_id_planejamento, (v ->> 'id_preditor')::BIGINT, (v ->> 'ordem')::SMALLINT
    FROM jsonb_array_elements(p_preditores) AS v;
END $$;
