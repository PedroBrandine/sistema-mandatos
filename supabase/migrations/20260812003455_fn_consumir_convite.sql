-- =============================================================================
-- T3 (convite-contrato): app.consumir_convite -- valida o convite (hash, uso,
-- expiração, guarda de papel), garante dim_usuario (cria se e-mail não
-- existir, reusa se existir -- nunca sobrescreve papel_global existente),
-- insere rel_usuario_contrato (idempotente via uq_vinculo) e marca dt_uso,
-- tudo na mesma transação. SELECT ... FOR UPDATE serializa tentativas
-- concorrentes do mesmo token.
--
-- SECURITY INVOKER (AD-024, default do Postgres) -- só chamada pela rota de
-- servidor via createAdminClient() (service_role, AD-033), que já ignora
-- RLS/GRANT por conta própria (BYPASSRLS + grants de plataforma). EXECUTE
-- travado a service_role explicitamente abaixo -- mesmo padrão de lockdown
-- de app.custom_access_token_hook (0002_plataforma_auth_hook.sql): mesmo que
-- legisla_gestora tenha GRANT de tabela suficiente pra rodar isto sem
-- querer, não é o caminho pretendido (guarda explícita, nunca confiar que a
-- origem da chamada é benigna -- lição da FND-USR-02).
--
-- Não cria auth.users -- isso é chamada de Admin API (TypeScript), não SQL.
-- Esta função só garante o lado do banco; a rota de servidor decide se
-- chama auth.admin.createUser antes, com base em dim_usuario já existir ou
-- não (design.md Error Handling Strategy).
-- =============================================================================

CREATE OR REPLACE FUNCTION app.consumir_convite(
  p_token_hash TEXT,
  p_nome       TEXT
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_convite    convite_contrato;
  v_id_usuario BIGINT;
  v_conta_nova BOOLEAN;
BEGIN
  SELECT * INTO v_convite FROM convite_contrato WHERE token_hash = p_token_hash FOR UPDATE;

  IF v_convite IS NULL THEN
    RAISE EXCEPTION 'Convite inválido' USING ERRCODE = 'CNV01';
  END IF;

  IF v_convite.dt_uso IS NOT NULL THEN
    RAISE EXCEPTION 'Convite já utilizado' USING ERRCODE = 'CNV02';
  END IF;

  IF v_convite.dt_expiracao < now() THEN
    RAISE EXCEPTION 'Convite expirado' USING ERRCODE = 'CNV03';
  END IF;

  -- Guarda redundante (CVT-07) -- ck_convite_papel (T1) já devia ter impedido
  -- este dado de existir assim; checado de novo aqui porque "a UI/o CHECK não
  -- oferece essa opção" nunca é confiança suficiente (lição da FND-USR-02).
  IF v_convite.papel_no_contrato NOT IN ('mentor', 'assessor') THEN
    RAISE EXCEPTION 'Papel do convite inválido' USING ERRCODE = 'CNV04';
  END IF;

  SELECT id_usuario INTO v_id_usuario FROM dim_usuario WHERE email = v_convite.email;
  v_conta_nova := v_id_usuario IS NULL;

  IF v_conta_nova THEN
    INSERT INTO dim_usuario (email, nome, papel_global, ativo)
    VALUES (v_convite.email, p_nome, v_convite.papel_no_contrato, true)
    RETURNING id_usuario INTO v_id_usuario;
  END IF;
  -- e-mail já existente com outro papel_global: v_id_usuario já resolvido
  -- acima: nunca sobrescreve papel_global (spec.md Edge Cases) -- só garante
  -- o vínculo abaixo.

  INSERT INTO rel_usuario_contrato (
    id_contrato, id_usuario, papel_no_contrato, cargo, grau_responsabilidade, areas
  ) VALUES (
    v_convite.id_contrato, v_id_usuario, v_convite.papel_no_contrato,
    v_convite.cargo, v_convite.grau_responsabilidade, v_convite.areas
  )
  ON CONFLICT (id_contrato, id_usuario, papel_no_contrato) DO NOTHING;

  UPDATE convite_contrato SET dt_uso = now() WHERE id_convite = v_convite.id_convite;

  RETURN jsonb_build_object('id_usuario', v_id_usuario, 'conta_nova', v_conta_nova);
END;
$$;

COMMENT ON FUNCTION app.consumir_convite(TEXT, TEXT) IS
'CVT-06/07/08/09. SECURITY INVOKER, EXECUTE travado a service_role (ver REVOKE/GRANT abaixo). conta_nova=true sinaliza pra rota de servidor que este dim_usuario acabou de ser criado por esta chamada -- é o gatilho pra tentar signInWithPassword depois (design.md Tech Decisions).';

REVOKE EXECUTE ON FUNCTION app.consumir_convite(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.consumir_convite(TEXT, TEXT) TO service_role;
