-- RPC de criação de edição (fat_edicao) + pool de mentores padrão
-- (rel_edicao_mentor) na mesma transação -- AD-024, escrita cruzando duas
-- tabelas exige RPC SECURITY INVOKER (omitido = INVOKER por padrão, mesmo
-- padrão de app.criar_mandato).

CREATE OR REPLACE FUNCTION app.criar_edicao_pll(
  p_id_produto  bigint,
  p_id_projeto  bigint,
  p_nome        text,
  p_dt_inicio   date,
  p_mentores    bigint[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_id_edicao BIGINT;
  v_id_mentor BIGINT;
BEGIN
  INSERT INTO fat_edicao (id_produto, id_projeto, nome, dt_inicio, criado_por)
  VALUES (p_id_produto, p_id_projeto, p_nome, p_dt_inicio, app.id_usuario())
  RETURNING id_edicao INTO v_id_edicao;

  IF p_mentores IS NOT NULL THEN
    FOREACH v_id_mentor IN ARRAY p_mentores LOOP
      INSERT INTO rel_edicao_mentor (id_edicao, id_usuario) VALUES (v_id_edicao, v_id_mentor);
    END LOOP;
  END IF;

  RETURN jsonb_build_object('id_edicao', v_id_edicao);
END;
$$;

COMMENT ON FUNCTION app.criar_edicao_pll IS 'Cria uma edição de produto e seu pool de mentores padrão (rel_edicao_mentor) na mesma transação.';

GRANT EXECUTE ON FUNCTION app.criar_edicao_pll TO legisla_app, legisla_admin, legisla_gestora, legisla_mentor, legisla_assessor;
