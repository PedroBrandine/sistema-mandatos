-- Sessão ao vivo com Pedro (22/09): mentores selecionados na criação de uma
-- edição do PLL (rel_edicao_mentor) devem ser aplicados automaticamente a
-- cada contrato criado sob ela, no momento do vínculo TSE -- reduz
-- retrabalho manual de vincular mentor por participante.
--
-- Estende app.criar_mandato (não cria RPC nova -- é a MESMA transação que já
-- cria fat_contrato, AD-024: atomicidade de escrita multi-tabela) com
-- p_mentores_padrao bigint[]. DROP + CREATE porque adicionar parâmetro muda a
-- assinatura (mesmo padrão de 0022_cadastro_mandato_contrato_unificado.sql).

DROP FUNCTION IF EXISTS app.criar_mandato(jsonb, jsonb, jsonb, boolean, jsonb, jsonb, bigint);

CREATE OR REPLACE FUNCTION app.criar_mandato(
  p_contratante        jsonb DEFAULT NULL,
  p_mandato            jsonb DEFAULT NULL,
  p_candidatura        jsonb DEFAULT NULL,
  p_ignorar_duplicata  boolean DEFAULT false,
  p_contrato           jsonb DEFAULT NULL,
  p_coalizao           jsonb DEFAULT NULL,
  p_id_contratante_existente bigint DEFAULT NULL,
  p_mentores_padrao    bigint[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_nome           TEXT;
  v_sg_uf          TEXT;
  v_nm_municipio   TEXT;
  v_similares      jsonb;
  v_id_contratante BIGINT;
  v_id_mandato     BIGINT;
  v_id_vinculo_tse BIGINT;
  v_id_contrato    BIGINT;
  v_mandato        dim_mandato;
  v_id_mentor      BIGINT;
BEGIN
  IF p_id_contratante_existente IS NOT NULL THEN
    v_id_contratante := p_id_contratante_existente;
    SELECT id_mandato INTO v_id_mandato FROM dim_mandato WHERE id_contratante = v_id_contratante;
  ELSE
    v_nome := p_contratante ->> 'nome';
    v_sg_uf := p_contratante ->> 'sg_uf';
    v_nm_municipio := p_contratante ->> 'nm_municipio';

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
  END IF;

  IF p_contrato IS NOT NULL THEN
    INSERT INTO fat_contrato (id_contratante, id_produto, id_projeto, id_contrato_anterior, dt_inicio, status)
    VALUES (
      v_id_contratante,
      (p_contrato->>'id_produto')::bigint,
      (p_contrato->>'id_projeto')::bigint,
      (p_contrato->>'id_contrato_anterior')::bigint,
      (p_contrato->>'dt_inicio')::date,
      'ativo'
    ) RETURNING id_contrato INTO v_id_contrato;

    IF p_coalizao IS NOT NULL THEN
      INSERT INTO rel_coalizao_membro (id_coalizao, id_contrato, papel, nome_grupo)
      VALUES (
        (p_coalizao->>'id_coalizao')::bigint,
        v_id_contrato,
        p_coalizao->>'papel',
        p_coalizao->>'nome_grupo'
      );
    END IF;

    -- Pool de mentores padrão da edição (rel_edicao_mentor, via chamador):
    -- um INSERT por mentor, ON CONFLICT DO NOTHING porque uq_vinculo já
    -- impede duplicidade (id_contrato, id_usuario, papel_no_contrato) --
    -- chamar duas vezes com o mesmo pool (ex.: reimportação) não deve
    -- estourar erro.
    IF p_mentores_padrao IS NOT NULL THEN
      FOREACH v_id_mentor IN ARRAY p_mentores_padrao LOOP
        INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato, dt_inicio)
        VALUES (v_id_contrato, v_id_mentor, 'mentor', CURRENT_DATE)
        ON CONFLICT (id_contrato, id_usuario, papel_no_contrato) DO NOTHING;
      END LOOP;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id_contratante', v_id_contratante,
    'id_mandato', v_id_mandato,
    'id_vinculo_tse', v_id_vinculo_tse,
    'id_contrato', v_id_contrato
  );
END;
$$;

COMMENT ON FUNCTION app.criar_mandato IS 'Criar mandato e opcionalmente atrelar um contrato, vínculo de coalizão e pool de mentores padrão (rel_edicao_mentor via p_mentores_padrao) na mesma transação. Suporta abrir novo contrato para mandato existente via p_id_contratante_existente.';
