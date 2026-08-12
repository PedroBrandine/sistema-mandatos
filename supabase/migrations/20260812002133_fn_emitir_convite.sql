-- =============================================================================
-- T2 (convite-contrato): app.emitir_convite -- invalida qualquer convite
-- pendente pro mesmo e-mail+contrato+papel e insere o novo, na mesma
-- transação (2 operações na mesma tabela -- AD-024 exige RPC, não insert
-- direto, pra qualquer escrita multi-passo).
--
-- SECURITY INVOKER (AD-024) -- herda o papel de quem chama; RLS de
-- convite_contrato (p_por_contrato, T1) continua decidindo quem pode emitir.
--
-- dt_expiracao é sempre now() + 7 dias, fixo aqui dentro -- nunca parâmetro
-- do cliente (spec.md, decisão confirmada por Pedro 2026-08-11).
-- =============================================================================

CREATE OR REPLACE FUNCTION app.emitir_convite(
  p_id_contrato           BIGINT,
  p_email                 TEXT,
  p_papel                 TEXT,
  p_cargo                 TEXT,
  p_grau_responsabilidade TEXT,
  p_areas                 TEXT[],
  p_token_hash            TEXT
) RETURNS BIGINT
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_email      TEXT := lower(btrim(p_email));
  v_id_convite BIGINT;
BEGIN
  -- Invalida qualquer convite pendente pra mesma combinação -- reusa o
  -- predicado "expirado" que o consumo já checa (dt_expiracao < now()),
  -- sem precisar de coluna nova pra distinguir "expirado" de "invalidado"
  -- (design.md Data Models).
  UPDATE convite_contrato
     SET dt_expiracao = now()
   WHERE id_contrato = p_id_contrato
     AND email = v_email
     AND papel_no_contrato = p_papel
     AND dt_uso IS NULL
     AND dt_expiracao > now();

  INSERT INTO convite_contrato (
    id_contrato, email, papel_no_contrato, cargo, grau_responsabilidade, areas,
    token_hash, id_usuario_convidou, dt_expiracao
  ) VALUES (
    p_id_contrato, v_email, p_papel, p_cargo, p_grau_responsabilidade, p_areas,
    p_token_hash, app.id_usuario(), now() + INTERVAL '7 days'
  )
  RETURNING id_convite INTO v_id_convite;

  RETURN v_id_convite;
END;
$$;

COMMENT ON FUNCTION app.emitir_convite(BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT) IS
'CVT-01/02/03/04. SECURITY INVOKER -- RLS de convite_contrato (p_por_contrato) decide quem pode chamar. dt_expiracao fixo em 7 dias, nunca parâmetro do cliente.';
