-- =============================================================================
-- T22: app.criar_coalizao -- cria dim_contratante (tipo_contratante='coalizao')
-- + dim_coalizao na mesma transação, reusando app.contratante_similar (T20)
-- para a mesma checagem de duplicata de app.criar_mandato (FND-COL-01).
-- SECURITY INVOKER (AD-024).
-- =============================================================================

CREATE OR REPLACE FUNCTION app.criar_coalizao(
  p_contratante        jsonb,
  p_coalizao           jsonb,
  p_ignorar_duplicata  boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_nome           TEXT := p_contratante ->> 'nome';
  v_sg_uf          TEXT := p_contratante ->> 'sg_uf';
  v_nm_municipio   TEXT := p_contratante ->> 'nm_municipio';
  v_similares      jsonb;
  v_id_contratante BIGINT;
  v_id_coalizao    BIGINT;
BEGIN
  IF NOT p_ignorar_duplicata THEN
    SELECT jsonb_agg(jsonb_build_object(
             'idContratante', s.id_contratante, 'nome', s.nome,
             'sgUf', s.sg_uf, 'nmMunicipio', s.nm_municipio
           ))
      INTO v_similares
      FROM app.contratante_similar(v_nome, v_sg_uf, v_nm_municipio) AS s;

    IF v_similares IS NOT NULL THEN
      RAISE EXCEPTION 'Contratante(s) similar(es) já cadastrado(s) para "%"', v_nome
        USING ERRCODE = 'MDU01', DETAIL = v_similares::text;
    END IF;
  END IF;

  INSERT INTO dim_contratante (tipo_contratante, nome, sg_uf, nm_municipio, id_partido_relacionado, localizador_legado)
  VALUES (
    'coalizao', v_nome, v_sg_uf, v_nm_municipio,
    (p_contratante ->> 'id_partido_relacionado')::bigint,
    p_contratante ->> 'localizador_legado'
  )
  RETURNING id_contratante INTO v_id_contratante;

  INSERT INTO dim_coalizao (id_contratante, id_projeto_origem, possui_planejamento_proprio)
  VALUES (
    v_id_contratante,
    (p_coalizao ->> 'id_projeto_origem')::bigint,
    COALESCE((p_coalizao ->> 'possui_planejamento_proprio')::boolean, false)
  )
  RETURNING id_coalizao INTO v_id_coalizao;

  RETURN jsonb_build_object('id_contratante', v_id_contratante, 'id_coalizao', v_id_coalizao);
END;
$$;

COMMENT ON FUNCTION app.criar_coalizao(jsonb, jsonb, boolean) IS
'FND-COL-01. Duplicata de contratante checada por app.contratante_similar -- mesma função e mesma regra usadas por app.criar_mandato (T20), não reimplementada.';
