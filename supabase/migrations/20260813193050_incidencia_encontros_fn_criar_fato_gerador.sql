-- =============================================================================
-- incidencia-encontros: T6 -- app.criar_fato_gerador, função nova (fora do
-- texto aprovado -- AD-024: 1 clique de "Salvar" escreve o fato + até 1 linha
-- de vínculo em rel_fato_origem, atomicamente). SECURITY INVOKER (default,
-- sem cláusula) -- roda com os privilégios/RLS de quem chama, mesmo padrão de
-- app.mover_etapa_kanban.
--
-- Validação de mesmo-contrato pra Meta/Insight de origem: o schema aprovado
-- não tem CHECK/trigger pra isso em rel_fato_origem (achado, spec.md
-- Assumptions) -- como já existe RPC por outro motivo (AD-024), a validação
-- entra aqui, defesa em profundidade (a UI normal já só lista opções do
-- próprio contrato).
--
-- id_usuario_autor nunca é parâmetro do chamador -- resolvido via
-- app.id_usuario() (0012_fundacao_auditoria_gap.sql), mesma regra de
-- app.criar_mandato/app.mover_etapa_kanban.
-- =============================================================================

CREATE OR REPLACE FUNCTION app.criar_fato_gerador(
  p_id_contrato BIGINT, p_id_tipologia BIGINT,
  p_nivel_d1 TEXT DEFAULT NULL, p_nivel_d2 TEXT DEFAULT NULL, p_nivel_d3 TEXT DEFAULT NULL,
  p_id_preditor_1 BIGINT DEFAULT NULL, p_id_preditor_2 BIGINT DEFAULT NULL,
  p_contribuicao_legisla SMALLINT DEFAULT NULL, p_descricao_evidencia TEXT DEFAULT NULL,
  p_dt_ocorrencia DATE DEFAULT CURRENT_DATE,
  p_id_meta_origem BIGINT DEFAULT NULL, p_id_insight_origem BIGINT DEFAULT NULL
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_id BIGINT;
BEGIN
  -- Meta de origem precisa pertencer ao mesmo contrato (cadeia
  -- fat_meta -> fat_objetivo_especifico -> dim_planejamento -> id_contrato).
  IF p_id_meta_origem IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM fat_meta m JOIN fat_objetivo_especifico o ON o.id_objetivo = m.id_objetivo
      JOIN dim_planejamento pl ON pl.id_planejamento = o.id_planejamento
     WHERE m.id_meta = p_id_meta_origem AND pl.id_contrato = p_id_contrato
  ) THEN
    RAISE EXCEPTION 'Meta % não pertence ao contrato %', p_id_meta_origem, p_id_contrato;
  END IF;

  -- Insight de origem precisa pertencer ao mesmo contrato.
  IF p_id_insight_origem IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM fat_insight i WHERE i.id_insight = p_id_insight_origem AND i.id_contrato = p_id_contrato
  ) THEN
    RAISE EXCEPTION 'Insight % não pertence ao contrato %', p_id_insight_origem, p_id_contrato;
  END IF;

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, nivel_d1, nivel_d2, nivel_d3,
    id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, dt_ocorrencia, id_usuario_autor)
  VALUES (p_id_contrato, p_id_tipologia, p_nivel_d1, p_nivel_d2, p_nivel_d3,
    p_id_preditor_1, p_id_preditor_2, p_contribuicao_legisla, p_descricao_evidencia, p_dt_ocorrencia,
    app.id_usuario())
  RETURNING id_fato_gerador INTO v_id;

  IF p_id_meta_origem IS NOT NULL OR p_id_insight_origem IS NOT NULL THEN
    INSERT INTO rel_fato_origem (id_fato_gerador, id_meta, id_insight)
    VALUES (v_id, p_id_meta_origem, p_id_insight_origem);
  END IF;

  RETURN v_id;
END $$;
