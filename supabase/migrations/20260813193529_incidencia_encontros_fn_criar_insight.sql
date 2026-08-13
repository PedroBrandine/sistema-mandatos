-- =============================================================================
-- incidencia-encontros: T7 -- app.criar_insight, mesma forma de T6
-- (app.criar_fato_gerador). Função nova (fora do texto aprovado -- AD-024),
-- SECURITY INVOKER (default, sem cláusula). Insere fat_insight + até 1 linha
-- em rel_insight_origem (colunas id_meta/id_sucesso na mesma linha quando os
-- dois vínculos são informados -- mesmo padrão de rel_fato_origem em T6;
-- ck_insight_origem/os 2 índices UNIQUE parciais permitem essa forma).
--
-- Validações de mesmo-contrato pra Registro/Meta/Sucesso de origem:
--   - Registro: redundante com app.trg_valida_insight_contrato
--     (docs/schema_sistema.sql:1930-1945), mas falha com mensagem melhor
--     dentro da função, antes do INSERT.
--   - Meta: mesma cadeia de T6 (fat_meta -> fat_objetivo_especifico ->
--     dim_planejamento).
--   - Sucesso Mensal: cadeia de 4 níveis (Sucesso -> Meta -> Objetivo ->
--     Planejamento), mesmo padrão de p_heranca em
--     20260812145720_planejamento_planilha_rls.sql.
--
-- id_usuario_autor nunca é parâmetro do chamador -- resolvido via
-- app.id_usuario(), mesma regra de T6.
-- =============================================================================

CREATE OR REPLACE FUNCTION app.criar_insight(
  p_id_contrato BIGINT, p_conteudo TEXT,
  p_id_registro BIGINT DEFAULT NULL, p_id_pilar BIGINT DEFAULT NULL,
  p_desdobramentos TEXT DEFAULT NULL, p_comprovacao_dados TEXT DEFAULT NULL,
  p_ocorrido_em DATE DEFAULT NULL,
  p_id_meta_origem BIGINT DEFAULT NULL, p_id_sucesso_origem BIGINT DEFAULT NULL
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_id BIGINT;
BEGIN
  -- Registro de origem precisa pertencer ao mesmo contrato.
  IF p_id_registro IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM fat_registro r WHERE r.id_registro = p_id_registro AND r.id_contrato = p_id_contrato
  ) THEN
    RAISE EXCEPTION 'Registro % não pertence ao contrato %', p_id_registro, p_id_contrato;
  END IF;

  -- Meta de origem precisa pertencer ao mesmo contrato.
  IF p_id_meta_origem IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM fat_meta m JOIN fat_objetivo_especifico o ON o.id_objetivo = m.id_objetivo
      JOIN dim_planejamento pl ON pl.id_planejamento = o.id_planejamento
     WHERE m.id_meta = p_id_meta_origem AND pl.id_contrato = p_id_contrato
  ) THEN
    RAISE EXCEPTION 'Meta % não pertence ao contrato %', p_id_meta_origem, p_id_contrato;
  END IF;

  -- Sucesso Mensal de origem precisa pertencer ao mesmo contrato.
  IF p_id_sucesso_origem IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM fat_sucesso_mensal s
      JOIN fat_meta m ON m.id_meta = s.id_meta
      JOIN fat_objetivo_especifico o ON o.id_objetivo = m.id_objetivo
      JOIN dim_planejamento pl ON pl.id_planejamento = o.id_planejamento
     WHERE s.id_sucesso = p_id_sucesso_origem AND pl.id_contrato = p_id_contrato
  ) THEN
    RAISE EXCEPTION 'Sucesso Mensal % não pertence ao contrato %', p_id_sucesso_origem, p_id_contrato;
  END IF;

  INSERT INTO fat_insight (id_contrato, id_registro, id_pilar, conteudo, desdobramentos,
    comprovacao_dados, ocorrido_em, id_usuario_autor)
  VALUES (p_id_contrato, p_id_registro, p_id_pilar, p_conteudo, p_desdobramentos,
    p_comprovacao_dados, p_ocorrido_em, app.id_usuario())
  RETURNING id_insight INTO v_id;

  IF p_id_meta_origem IS NOT NULL OR p_id_sucesso_origem IS NOT NULL THEN
    INSERT INTO rel_insight_origem (id_insight, id_meta, id_sucesso)
    VALUES (v_id, p_id_meta_origem, p_id_sucesso_origem);
  END IF;

  RETURN v_id;
END $$;
