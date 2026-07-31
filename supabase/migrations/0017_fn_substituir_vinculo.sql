-- =============================================================================
-- T23: app.substituir_vinculo -- fecha o vínculo antigo (dt_fim = hoje) e cria
-- um novo para a pessoa nova, no mesmo id_contrato/papel_no_contrato, na mesma
-- transação. Nunca apaga a linha antiga (FND-USR-05). SECURITY INVOKER (AD-024).
-- =============================================================================

CREATE OR REPLACE FUNCTION app.substituir_vinculo(
  p_id_vinculo_antigo      bigint,
  p_id_usuario_novo        bigint,
  p_cargo                  text DEFAULT NULL,
  p_grau_responsabilidade  text DEFAULT NULL,
  p_areas                  text[] DEFAULT NULL
) RETURNS bigint
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_id_contrato       BIGINT;
  v_papel_no_contrato TEXT;
  v_dt_fim            DATE;
  v_id_vinculo_novo   BIGINT;
BEGIN
  SELECT id_contrato, papel_no_contrato, dt_fim
    INTO v_id_contrato, v_papel_no_contrato, v_dt_fim
    FROM rel_usuario_contrato
   WHERE id_vinculo = p_id_vinculo_antigo;

  IF v_id_contrato IS NULL THEN
    RAISE EXCEPTION 'Vínculo % não encontrado', p_id_vinculo_antigo;
  END IF;

  IF v_dt_fim IS NOT NULL THEN
    RAISE EXCEPTION 'Vínculo % já está encerrado (dt_fim = %)', p_id_vinculo_antigo, v_dt_fim;
  END IF;

  UPDATE rel_usuario_contrato
     SET dt_fim = CURRENT_DATE
   WHERE id_vinculo = p_id_vinculo_antigo;

  INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato, cargo, grau_responsabilidade, areas)
  VALUES (v_id_contrato, p_id_usuario_novo, v_papel_no_contrato, p_cargo, p_grau_responsabilidade, p_areas)
  RETURNING id_vinculo INTO v_id_vinculo_novo;

  RETURN v_id_vinculo_novo;
END;
$$;

COMMENT ON FUNCTION app.substituir_vinculo(bigint, bigint, text, text, text[]) IS
'FND-USR-05. A linha antiga nunca é apagada -- só ganha dt_fim. Erro claro (RAISE EXCEPTION) quando o vínculo não existe ou já está encerrado.';
