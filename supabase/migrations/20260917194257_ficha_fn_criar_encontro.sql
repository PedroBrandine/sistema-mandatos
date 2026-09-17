-- ficha-mandato-contrato: T18 -- app.criar_encontro(p_id_contrato, p_titulo,
-- p_id_etapa, p_id_tipo_registro, p_dt_inicio, p_dt_fim, p_modalidade,
-- p_local, p_tema, p_participantes) -> BIGINT. FMC-30/FMC-31/FMC-32
-- (spec.md P2 Agenda AC2/AC3/AC4/AC6; design.md tabela de RPCs). Assinatura
-- já fechada em design.md e consumida pelo wrapper rpc/encontro.ts (T19,
-- 71b393b) -- não renomear nem reordenar parâmetro.
--
-- SECURITY INVOKER (AD-024, default do Postgres, sem cláusula -- mesmo
-- estilo de app.criar_insight/app.converter_prospeccao): herda RLS/GRANT de
-- quem chama; a função só acrescenta a atomicidade encontro+participantes
-- que duas chamadas soltas do cliente não teriam (uma falha no meio
-- deixaria encontro sem participante nenhum).
--
-- Validações antes do INSERT (falha explícita, mensagem própria por caso --
-- lição L-010, "teste cobre cada RAISE EXCEPTION do corpo, um a um"):
--   1. id_etapa precisa pertencer ao PRODUTO do contrato (fat_contrato.id_produto
--      = ref_etapa.id_produto) -- não ao contrato em si, ref_etapa é catálogo
--      de produto, compartilhado entre contratos do mesmo produto.
--   2. id_tipo_registro precisa pertencer à etapa informada (ref_tipo_registro.id_etapa).
--   3. Cada participante do array não pode ter id_usuario E nome_livre ao
--      mesmo tempo -- redundante com ck_participante_identificacao
--      (docs/schema_sistema.sql:910), mas falha com mensagem melhor dentro
--      da função, antes do INSERT (mesmo padrão de
--      app.trg_valida_insight_contrato vs. checagem em app.criar_insight).
--
-- fat_encontro NÃO tem id_usuario_autor (docs/schema_sistema.sql:868-890) --
-- "id_usuario_autor (quando existir) via app.id_usuario()" da task não se
-- aplica aqui; não há coluna de autoria nesta tabela.
--
-- Sem bloco EXCEPTION capturado: qualquer RAISE não tratado aborta a
-- transação inteira do plpgsql -- é isso que garante que uma falha no meio
-- do loop de participantes não deixa encontro sem participantes (nem
-- participante órfão): o INSERT em fat_encontro já feito é desfeito junto.
-- =============================================================================

CREATE OR REPLACE FUNCTION app.criar_encontro(
  p_id_contrato      BIGINT,
  p_titulo           TEXT,
  p_id_etapa         BIGINT,
  p_id_tipo_registro BIGINT,
  p_dt_inicio        TIMESTAMPTZ,
  p_dt_fim           TIMESTAMPTZ DEFAULT NULL,
  p_modalidade       TEXT DEFAULT NULL,
  p_local            TEXT DEFAULT NULL,
  p_tema             TEXT DEFAULT NULL,
  p_participantes    JSONB DEFAULT '[]'::jsonb
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
  v_id_encontro   BIGINT;
  v_participante  JSONB;
  v_id_usuario    BIGINT;
  v_nome_livre    TEXT;
  v_origem        TEXT;
BEGIN
  -- 1. Etapa precisa pertencer ao produto do contrato.
  IF NOT EXISTS (
    SELECT 1 FROM ref_etapa e
      JOIN fat_contrato c ON c.id_produto = e.id_produto
     WHERE e.id_etapa = p_id_etapa AND c.id_contrato = p_id_contrato
  ) THEN
    RAISE EXCEPTION 'Etapa % não pertence ao produto do contrato %', p_id_etapa, p_id_contrato;
  END IF;

  -- 2. Tipo de registro precisa pertencer à etapa informada.
  IF NOT EXISTS (
    SELECT 1 FROM ref_tipo_registro tr
     WHERE tr.id_tipo_registro = p_id_tipo_registro AND tr.id_etapa = p_id_etapa
  ) THEN
    RAISE EXCEPTION 'Tipo de registro % não pertence à etapa %', p_id_tipo_registro, p_id_etapa;
  END IF;

  INSERT INTO fat_encontro (
    id_contrato, id_etapa, id_tipo_registro, titulo,
    dt_prevista_inicio, dt_prevista_fim, modalidade, local, tema_prioritario
  ) VALUES (
    p_id_contrato, p_id_etapa, p_id_tipo_registro, p_titulo,
    p_dt_inicio, p_dt_fim, p_modalidade, p_local, p_tema
  ) RETURNING id_encontro INTO v_id_encontro;

  FOR v_participante IN SELECT * FROM jsonb_array_elements(COALESCE(p_participantes, '[]'::jsonb))
  LOOP
    v_id_usuario := NULLIF(v_participante->>'id_usuario', '')::BIGINT;
    v_nome_livre := v_participante->>'nome_livre';
    v_origem     := v_participante->>'origem';

    -- 3. Participante não pode ter id_usuario e nome_livre ao mesmo tempo.
    IF v_id_usuario IS NOT NULL AND v_nome_livre IS NOT NULL THEN
      RAISE EXCEPTION 'Participante não pode ter id_usuario e nome_livre ao mesmo tempo';
    END IF;

    INSERT INTO rel_encontro_participante (id_encontro, id_usuario, nome_livre, origem)
    VALUES (v_id_encontro, v_id_usuario, v_nome_livre, v_origem);
  END LOOP;

  RETURN v_id_encontro;
END $$;

COMMENT ON FUNCTION app.criar_encontro(BIGINT, TEXT, BIGINT, BIGINT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, JSONB) IS
'FMC-30/FMC-31/FMC-32 (spec.md P2 Agenda). Única forma sancionada de criar um encontro com seus participantes (AD-024): insere fat_encontro + N linhas de rel_encontro_participante na mesma transação, validando que Etapa pertence ao produto do contrato e que Tipo de Registro pertence à Etapa antes de gravar. SECURITY INVOKER -- herda RLS/GRANT de quem chama.';
