-- =============================================================================
-- T20: app.criar_mandato -- cria dim_contratante (tipo_contratante='mandato')
-- + dim_mandato [+ rel_mandato_candidatura, se p_candidatura informado] numa
-- única transação, com checagem de duplicata de contratante por
-- nome_normalizado + UF/município (FND-TSE-01, 02, 05, 06).
--
-- SECURITY INVOKER (padrão do Postgres, AD-024) -- a função herda o papel de
-- quem chama; RLS/GRANT de dim_contratante/dim_mandato/rel_mandato_candidatura
-- continuam decidindo quem pode escrever, exatamente como um insert direto.
--
-- app.contratante_similar é extraída aqui (não dentro de app.criar_mandato)
-- porque T22 (app.criar_coalizao) reusa a mesma checagem de duplicata sem
-- reimplementá-la (ver tasks.md T22 "Reuses").
-- =============================================================================

-- Uma linha = um dim_contratante já cadastrado cujo nome_normalizado bate com
-- o nome informado, na mesma UF/município (comparação NULL-safe: dois
-- contratantes sem UF/município cadastrado também contam como parecidos).
CREATE OR REPLACE FUNCTION app.contratante_similar(p_nome text, p_sg_uf text, p_nm_municipio text)
RETURNS TABLE (id_contratante bigint, nome text, sg_uf text, nm_municipio text)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT id_contratante, nome, sg_uf, nm_municipio
    FROM dim_contratante
   WHERE nome_normalizado = app.normaliza_nome(p_nome)
     AND sg_uf IS NOT DISTINCT FROM p_sg_uf
     AND nm_municipio IS NOT DISTINCT FROM p_nm_municipio;
$$;

CREATE OR REPLACE FUNCTION app.criar_mandato(
  p_contratante        jsonb,
  p_mandato            jsonb,
  p_candidatura        jsonb DEFAULT NULL,
  p_ignorar_duplicata  boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_nome           TEXT := p_contratante ->> 'nome';
  v_sg_uf          TEXT := p_contratante ->> 'sg_uf';
  v_nm_municipio   TEXT := p_contratante ->> 'nm_municipio';
  v_similares      jsonb;
  v_id_contratante BIGINT;
  v_id_mandato     BIGINT;
  v_id_vinculo_tse BIGINT;
  v_mandato        dim_mandato;
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
    'mandato', v_nome, v_sg_uf, v_nm_municipio,
    (p_contratante ->> 'id_partido_relacionado')::bigint,
    p_contratante ->> 'localizador_legado'
  )
  RETURNING id_contratante INTO v_id_contratante;

  SELECT * INTO v_mandato FROM jsonb_populate_record(null::dim_mandato, p_mandato);

  INSERT INTO dim_mandato (
    id_contratante, nr_titulo_eleitoral, nm_civil, nm_urna, nm_social, ds_genero,
    ds_identidade_genero, ds_orientacao_sexual, ds_raca, fl_pcd, id_partido_atual,
    id_cargo_atual, origem_partido_cargo, atualizado_partido_cargo_em,
    potencial_futuro, relevancia_politica, confianca, risco_democratico,
    espectro_politico, id_mandato_legado
  ) VALUES (
    v_id_contratante, v_mandato.nr_titulo_eleitoral, v_mandato.nm_civil, v_mandato.nm_urna,
    v_mandato.nm_social, v_mandato.ds_genero, v_mandato.ds_identidade_genero,
    v_mandato.ds_orientacao_sexual, v_mandato.ds_raca, v_mandato.fl_pcd,
    v_mandato.id_partido_atual, v_mandato.id_cargo_atual,
    -- origem_partido_cargo é decidido aqui, nunca pelo caller (FND-TSE-02/06):
    -- 'tse' quando há candidatura confirmada, 'manual' no cadastro sem match.
    CASE WHEN p_candidatura IS NULL THEN 'manual' ELSE 'tse' END,
    v_mandato.atualizado_partido_cargo_em, v_mandato.potencial_futuro,
    v_mandato.relevancia_politica, v_mandato.confianca, v_mandato.risco_democratico,
    v_mandato.espectro_politico, v_mandato.id_mandato_legado
  )
  RETURNING id_mandato INTO v_id_mandato;

  IF p_candidatura IS NOT NULL THEN
    INSERT INTO rel_mandato_candidatura (
      id_mandato, ano_eleicao, sq_candidato, nr_turno, metodo_match, confianca,
      status, id_usuario_validou, validado_em
    ) VALUES (
      v_id_mandato,
      (p_candidatura ->> 'ano_eleicao')::smallint,
      (p_candidatura ->> 'sq_candidato')::bigint,
      (p_candidatura ->> 'nr_turno')::smallint,
      p_candidatura ->> 'metodo_match',
      p_candidatura ->> 'confianca',
      'confirmado',
      app.id_usuario(),
      now()
    )
    RETURNING id_vinculo_tse INTO v_id_vinculo_tse;
  END IF;

  RETURN jsonb_build_object(
    'id_contratante', v_id_contratante,
    'id_mandato', v_id_mandato,
    'id_vinculo_tse', v_id_vinculo_tse
  );
END;
$$;

COMMENT ON FUNCTION app.criar_mandato(jsonb, jsonb, jsonb, boolean) IS
'FND-TSE-01/02/05/06. eh_mandato_vigente permanece no default (false) mesmo com candidatura confirmada -- marcar como vigente é sempre ação explícita separada (app.marcar_candidatura_vigente, T21).';
