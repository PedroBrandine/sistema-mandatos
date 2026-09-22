-- =============================================================================
-- fundacao: app.resumo_exclusao_incidencia + app.excluir_incidencia
--
-- Exclusão DEFINITIVA de UM item da Incidência (Registro, Pré-Insight, Insight
-- ou Fato Gerador) pela aba "Fatos Geradores e Registros" do contrato, pedida
-- por Pedro (2026-09-21) junto da exclusão de mandato
-- (20260921224737_fundacao_fn_excluir_contrato.sql). Mesmas regras: SECURITY
-- INVOKER (AD-024), só admin/gestora (42501 para os demais), auditoria por
-- trg_audit_* (quando a tabela tem), e nenhuma exclusão parcial.
--
-- O que cada exclusão leva junto (FKs levantadas em pg_constraint no dev):
--   * Fato Gerador -> rel_fato_origem (CASCADE): perde o vínculo de origem.
--   * Pré-Insight  -> rel_fato_origem.id_pre_insight (CASCADE): os fatos que
--                     nasceram dele NÃO são apagados, só perdem a origem.
--   * Insight      -> rel_insight_origem e rel_fato_origem.id_insight (CASCADE):
--                     idem, os fatos ficam.
--   * Registro     -> fat_insight.id_registro (SET NULL: o insight fica, sem o
--                     registro), rel_fato_origem.id_registro (CASCADE) e
--                     rel_registro_participante (CASCADE).
-- Fato "sem origem" é estado válido (spec fatos-geradores-ciclo-vida, AC4), por
-- isso apagar uma origem nunca precisa apagar o fato. O resumo diz quantos
-- itens sofrem isso ANTES de a tela pedir a confirmação.
--
-- Rede contra RLS silencioso: DELETE que a policy filtra apaga 0 linhas sem
-- erro; a função confere ROW_COUNT e levanta 42501 em vez de fingir sucesso.
-- =============================================================================

CREATE OR REPLACE FUNCTION app.resumo_exclusao_incidencia(p_tipo text, p_id bigint)
RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
DECLARE
  v_papel TEXT := app.papel_atual();
BEGIN
  -- papel NULL não pode cair em `NOT IN` (NULL NOT IN (...) é NULL e o IF não
  -- dispararia).
  IF v_papel IS NULL OR v_papel NOT IN ('admin', 'gestora') THEN
    RAISE EXCEPTION 'Você não tem permissão para realizar esta operação.' USING ERRCODE = '42501';
  END IF;

  IF p_tipo = 'registro' THEN
    IF NOT EXISTS (SELECT 1 FROM fat_registro WHERE id_registro = p_id) THEN
      RAISE EXCEPTION 'Item não encontrado ou sem permissão.' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object('tipo', p_tipo, 'id', p_id, 'contagens', jsonb_build_object(
      'insights_desvinculados', (SELECT count(*) FROM fat_insight WHERE id_registro = p_id),
      'fatos_origem_desfeita',  (SELECT count(DISTINCT id_fato_gerador) FROM rel_fato_origem WHERE id_registro = p_id),
      'participantes',          (SELECT count(*) FROM rel_registro_participante WHERE id_registro = p_id)));

  ELSIF p_tipo = 'insight' THEN
    IF NOT EXISTS (SELECT 1 FROM fat_insight WHERE id_insight = p_id) THEN
      RAISE EXCEPTION 'Item não encontrado ou sem permissão.' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object('tipo', p_tipo, 'id', p_id, 'contagens', jsonb_build_object(
      'fatos_origem_desfeita', (SELECT count(DISTINCT id_fato_gerador) FROM rel_fato_origem WHERE id_insight = p_id),
      'vinculos_meta_sucesso', (SELECT count(*) FROM rel_insight_origem WHERE id_insight = p_id)));

  ELSIF p_tipo = 'pre_insight' THEN
    IF NOT EXISTS (SELECT 1 FROM fat_pre_insight WHERE id_pre_insight = p_id) THEN
      RAISE EXCEPTION 'Item não encontrado ou sem permissão.' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object('tipo', p_tipo, 'id', p_id, 'contagens', jsonb_build_object(
      'fatos_origem_desfeita', (SELECT count(DISTINCT id_fato_gerador) FROM rel_fato_origem WHERE id_pre_insight = p_id)));

  ELSIF p_tipo = 'fato_gerador' THEN
    IF NOT EXISTS (SELECT 1 FROM fat_fato_gerador WHERE id_fato_gerador = p_id) THEN
      RAISE EXCEPTION 'Item não encontrado ou sem permissão.' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object('tipo', p_tipo, 'id', p_id,
      -- Só Fato Gerador realizado entra no IIP; a tela avisa que o número muda.
      'situacao', (SELECT situacao FROM fat_fato_gerador WHERE id_fato_gerador = p_id),
      'contagens', jsonb_build_object(
        'vinculos_origem', (SELECT count(*) FROM rel_fato_origem WHERE id_fato_gerador = p_id)));

  ELSE
    RAISE EXCEPTION 'Tipo de item inválido: %', p_tipo USING ERRCODE = '22023';
  END IF;
END;
$$;

COMMENT ON FUNCTION app.resumo_exclusao_incidencia(text, bigint) IS
'O que a exclusão de UM item da Incidência (registro | insight | pre_insight | fato_gerador) leva junto ou desfaz. Somente leitura, mesma permissão da exclusão (admin/gestora). A tela mostra isto antes de pedir confirmação.';

CREATE OR REPLACE FUNCTION app.excluir_incidencia(p_tipo text, p_id bigint)
RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_resumo JSONB;
  v_linhas INT;
BEGIN
  -- Valida permissão, tipo e existência (levanta 42501/22023) e devolve o
  -- efeito colateral, calculado ANTES de apagar.
  v_resumo := app.resumo_exclusao_incidencia(p_tipo, p_id);

  IF p_tipo = 'registro' THEN
    DELETE FROM fat_registro WHERE id_registro = p_id;
  ELSIF p_tipo = 'insight' THEN
    DELETE FROM fat_insight WHERE id_insight = p_id;
  ELSIF p_tipo = 'pre_insight' THEN
    DELETE FROM fat_pre_insight WHERE id_pre_insight = p_id;
  ELSE
    DELETE FROM fat_fato_gerador WHERE id_fato_gerador = p_id;
  END IF;

  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  IF v_linhas = 0 THEN
    RAISE EXCEPTION 'Item não encontrado ou sem permissão.' USING ERRCODE = '42501';
  END IF;

  RETURN v_resumo;
END;
$$;

COMMENT ON FUNCTION app.excluir_incidencia(text, bigint) IS
'Exclusão DEFINITIVA de UM item da Incidência (registro | insight | pre_insight | fato_gerador). Só admin/gestora. Apagar uma origem (registro, insight, pré-insight) não apaga os fatos geradores que nasceram dela: eles ficam sem origem, estado válido. Devolve o mesmo resumo de app.resumo_exclusao_incidencia.';
