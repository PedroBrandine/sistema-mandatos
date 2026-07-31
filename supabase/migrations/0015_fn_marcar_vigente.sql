-- =============================================================================
-- T21: app.marcar_candidatura_vigente -- confirma uma candidatura como vigente
-- e desmarca qualquer outra vigente do mesmo mandato, na mesma transação
-- (FND-TSE-04). SECURITY INVOKER (AD-024).
-- =============================================================================

CREATE OR REPLACE FUNCTION app.marcar_candidatura_vigente(p_id_vinculo_tse bigint)
RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_id_mandato BIGINT;
BEGIN
  SELECT id_mandato INTO v_id_mandato
    FROM rel_mandato_candidatura
   WHERE id_vinculo_tse = p_id_vinculo_tse;

  -- Primeiro desmarca qualquer outra vigente do mesmo mandato (statement
  -- separado: ao final dele o índice único parcial uq_mandato_candidatura_vigente
  -- já não tem nenhuma linha vigente para v_id_mandato), depois marca a nova --
  -- nunca há um instante com duas linhas vigentes para o mesmo mandato.
  UPDATE rel_mandato_candidatura
     SET eh_mandato_vigente = false
   WHERE id_mandato = v_id_mandato
     AND id_vinculo_tse <> p_id_vinculo_tse
     AND eh_mandato_vigente;

  UPDATE rel_mandato_candidatura
     SET eh_mandato_vigente = true
   WHERE id_vinculo_tse = p_id_vinculo_tse;
END;
$$;

COMMENT ON FUNCTION app.marcar_candidatura_vigente(bigint) IS
'FND-TSE-04. Se p_id_vinculo_tse não existir, as duas UPDATE são no-op (0 linhas) -- sem candidatura para marcar, nada muda.';
