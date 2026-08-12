-- =============================================================================
-- Fix T2 (convite-contrato): app.emitir_convite -- p_cargo/p_grau_responsabilidade/
-- p_areas passam a ter DEFAULT NULL.
--
-- Gap descoberto no gate check de T11 (npm run build): o gerador de types
-- (supabase gen types) tipa parâmetro sem DEFAULT como obrigatório e
-- não-nulo (`string`, nunca `string | undefined`), então o wrapper
-- (src/backend/rpc/convite.ts) não conseguia compilar passando `undefined`
-- pros campos opcionais -- e mesmo se compilasse, PostgREST rejeitaria a
-- chamada por omitir um parâmetro sem default. Mesmo padrão já usado em
-- app.substituir_vinculo (0017_fn_substituir_vinculo.sql:10-12): os 3
-- parâmetros opcionais têm DEFAULT NULL. CREATE OR REPLACE é idempotente --
-- não muda nenhum comportamento de negócio, só a assinatura.
-- =============================================================================

CREATE OR REPLACE FUNCTION app.emitir_convite(
  p_id_contrato           BIGINT,
  p_email                 TEXT,
  p_papel                 TEXT,
  p_cargo                 TEXT DEFAULT NULL,
  p_grau_responsabilidade TEXT DEFAULT NULL,
  p_areas                 TEXT[] DEFAULT NULL,
  p_token_hash            TEXT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_email      TEXT := lower(btrim(p_email));
  v_id_convite BIGINT;
BEGIN
  IF p_token_hash IS NULL THEN
    RAISE EXCEPTION 'p_token_hash é obrigatório' USING ERRCODE = '23502';
  END IF;

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
'CVT-01/02/03/04. SECURITY INVOKER -- RLS de convite_contrato (p_por_contrato) decide quem pode chamar. dt_expiracao fixo em 7 dias, nunca parâmetro do cliente. p_token_hash tem DEFAULT NULL só por simetria de assinatura com os demais parâmetros opcionais -- continua obrigatório de fato (checado no corpo).';
