-- =============================================================================
-- Migration 0025: restaura duas colunas que a 0023 perdeu em app.criar_coalizao
--
-- A 0023 (coalizao_classificacao_agenda) reescreveu a função com
-- CREATE OR REPLACE para acrescentar `classificacao` e `agenda_tematica`, mas
-- ao reescrever os INSERTs deixou de fora duas colunas que a versão de 0016
-- gravava:
--
--   dim_contratante.id_partido_relacionado  <- p_contratante->>'id_partido_relacionado'
--   dim_coalizao.id_projeto_origem          <- p_coalizao->>'id_projeto_origem'
--
-- Detectado pelo teste de integração T22 (fn-criar-coalizao) em 04/08/2026.
--
-- Impacto em dados: NENHUM. As 3 coalizões existentes no dev não foram
-- afetadas -- 2 são de 31/07 (anteriores à 0023, e já tinham os campos nulos
-- porque o chamador não os enviava) e 1 é o seed de teste T19, inserido por
-- SQL direto. Nenhuma coalizão foi criada via app.criar_coalizao durante a
-- janela da regressão. Ver docs/baseline-dev-2026-08-04.md.
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

  INSERT INTO dim_contratante (
    tipo_contratante, nome, sg_uf, nm_municipio,
    id_partido_relacionado,          -- restaurado (0016)
    localizador_legado
  )
  VALUES (
    'coalizao', v_nome, v_sg_uf, v_nm_municipio,
    (p_contratante ->> 'id_partido_relacionado')::bigint,
    p_contratante ->> 'localizador_legado'
  )
  RETURNING id_contratante INTO v_id_contratante;

  IF p_coalizao -> 'agenda_tematica' IS NOT NULL THEN
    SELECT array_agg(value::text)
    INTO v_agenda
    FROM jsonb_array_elements_text(p_coalizao -> 'agenda_tematica');
  END IF;

  INSERT INTO dim_coalizao (
    id_contratante,
    id_projeto_origem,               -- restaurado (0016)
    possui_planejamento_proprio,
    classificacao,                   -- 0023
    agenda_tematica                  -- 0023
  )
  VALUES (
    v_id_contratante,
    (p_coalizao ->> 'id_projeto_origem')::bigint,
    COALESCE((p_coalizao ->> 'possui_planejamento_proprio')::boolean, false),
    p_coalizao ->> 'classificacao',
    v_agenda
  )
  RETURNING id_coalizao INTO v_id_coalizao;

  RETURN jsonb_build_object('id_contratante', v_id_contratante, 'id_coalizao', v_id_coalizao);
END;
$$;

COMMENT ON FUNCTION app.criar_coalizao(jsonb, jsonb, boolean) IS
'FND-COL-01. Duplicata de contratante checada por app.contratante_similar -- mesma função e mesma regra usadas por app.criar_mandato (T20), não reimplementada. Grava id_partido_relacionado (dim_contratante) e id_projeto_origem (dim_coalizao), além de classificacao/agenda_tematica.';
