-- Migration 0023: Coalizão - Classificação, Agenda Temática e simplificação de campos

ALTER TABLE dim_coalizao
  ADD COLUMN IF NOT EXISTS classificacao TEXT CHECK (classificacao IS NULL OR classificacao IN ('Nacional', 'Subnacional')),
  ADD COLUMN IF NOT EXISTS agenda_tematica TEXT[];

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
  v_agenda         TEXT[];
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

  INSERT INTO dim_contratante (tipo_contratante, nome, sg_uf, nm_municipio, localizador_legado)
  VALUES (
    'coalizao', v_nome, v_sg_uf, v_nm_municipio,
    p_contratante ->> 'localizador_legado'
  )
  RETURNING id_contratante INTO v_id_contratante;

  IF p_coalizao -> 'agenda_tematica' IS NOT NULL THEN
    SELECT array_agg(value::text)
    INTO v_agenda
    FROM jsonb_array_elements_text(p_coalizao -> 'agenda_tematica');
  END IF;

  INSERT INTO dim_coalizao (id_contratante, possui_planejamento_proprio, classificacao, agenda_tematica)
  VALUES (
    v_id_contratante,
    COALESCE((p_coalizao ->> 'possui_planejamento_proprio')::boolean, false),
    p_coalizao ->> 'classificacao',
    v_agenda
  )
  RETURNING id_coalizao INTO v_id_coalizao;

  RETURN jsonb_build_object('id_contratante', v_id_contratante, 'id_coalizao', v_id_coalizao);
END;
$$;
