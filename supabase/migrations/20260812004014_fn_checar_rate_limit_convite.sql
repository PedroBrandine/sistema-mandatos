-- =============================================================================
-- T4 (convite-contrato): app.checar_rate_limit_convite -- registra uma
-- tentativa de acesso a /convite/<token> e devolve se o IP está dentro do
-- limite (20 tentativas / 15 minutos). Limpeza leve das linhas fora da
-- janela+1h de margem a cada chamada (design.md Risks & Concerns -- não há
-- job de limpeza dedicado nesta fatia; volume esperado é baixo).
--
-- Mecanismo em tabela Postgres, não em memória: serverless multi-instância
-- (Vercel) invalida qualquer contador em memória, e não há Redis/Upstash no
-- projeto (design.md Tech Decisions).
--
-- SECURITY INVOKER (AD-024, default) -- EXECUTE travado a service_role,
-- mesmo padrão de T3: só a rota de servidor pré-sessão chama isto, antes de
-- consultar convite_contrato (CVT-10).
-- =============================================================================

CREATE OR REPLACE FUNCTION app.checar_rate_limit_convite(p_ip INET) RETURNS BOOLEAN
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_janela     INTERVAL := INTERVAL '15 minutes';
  v_limite     INT := 20;
  v_tentativas INT;
BEGIN
  DELETE FROM convite_tentativa WHERE ocorrido_em < now() - v_janela - INTERVAL '1 hour';

  INSERT INTO convite_tentativa (ip) VALUES (p_ip);

  SELECT count(*) INTO v_tentativas
    FROM convite_tentativa
   WHERE ip = p_ip AND ocorrido_em > now() - v_janela;

  RETURN v_tentativas <= v_limite;
END;
$$;

COMMENT ON FUNCTION app.checar_rate_limit_convite(INET) IS
'CVT-10. 20 tentativas / 15 minutos por IP, constante nesta função (não em ref_*: parâmetro de proteção técnica, não regra de negócio configurável -- AD-004 tem escopo explícito de Planejamento/Incidência/Operação/Saída). EXECUTE travado a service_role.';

REVOKE EXECUTE ON FUNCTION app.checar_rate_limit_convite(INET) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.checar_rate_limit_convite(INET) TO service_role;
