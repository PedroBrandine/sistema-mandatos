-- =============================================================================
-- kanban-etapas: T3 — app.mover_etapa_kanban(p_id_contrato, p_id_etapa_destino)
-- SECURITY INVOKER (AD-024). Única forma sancionada de gravar avanço/
-- retrocesso de etapa (AD-023) -- orquestra as 2-3 escritas da transição numa
-- única transação. RLS + GRANT continuam sendo a fronteira real de quem pode
-- escrever o quê (T1); esta função só adiciona a regra de negócio
-- (adjacência + papel na reversão) que uma policy de linha não consegue
-- expressar (design.md "Risks & Concerns").
--
-- Depende de T1 (GRANT/WITH CHECK) e T2 (trigger de auditoria já ligado --
-- toda UPDATE feita aqui é auditada de graça, sem INSERT explícito).
-- Estilo/estrutura replicados de app.substituir_vinculo (0017_fn_substituir_vinculo.sql).
-- =============================================================================

CREATE OR REPLACE FUNCTION app.mover_etapa_kanban(
  p_id_contrato       bigint,
  p_id_etapa_destino  bigint
) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_id_produto       BIGINT;
  v_id_etapa_atual   BIGINT;
  v_id_etapa_origem  BIGINT;
  v_ordem_origem     SMALLINT;
  v_ordem_destino    SMALLINT;
  v_delta            INT;
BEGIN
  SELECT id_produto, id_etapa_atual INTO v_id_produto, v_id_etapa_atual
    FROM fat_contrato WHERE id_contrato = p_id_contrato;

  -- Contrato não existe OU RLS de fat_contrato já filtrou por falta de
  -- vínculo -- nunca revelar qual dos dois é o caso (mesmo espírito de
  -- PermissaoNegadaError, reaproveitado via 42501).
  IF v_id_produto IS NULL THEN
    RAISE EXCEPTION 'Contrato não encontrado ou sem permissão.' USING ERRCODE = '42501';
  END IF;

  -- id_etapa_atual IS NULL (contrato recém-instanciado, nenhuma transição
  -- ainda): card está na coluna 1 por default (contexto confirmado).
  v_id_etapa_origem := COALESCE(v_id_etapa_atual, (SELECT id_etapa FROM ref_etapa WHERE id_produto = v_id_produto AND ordem = 1));

  SELECT ordem INTO v_ordem_origem FROM ref_etapa WHERE id_etapa = v_id_etapa_origem;

  -- p_id_etapa_destino precisa pertencer ao mesmo produto -- etapa de outro
  -- produto não é "salto inválido", é entrada malformada; mesma exceção
  -- genérica do passo anterior.
  SELECT ordem INTO v_ordem_destino FROM ref_etapa WHERE id_etapa = p_id_etapa_destino AND id_produto = v_id_produto;

  IF v_ordem_destino IS NULL THEN
    RAISE EXCEPTION 'Contrato não encontrado ou sem permissão.' USING ERRCODE = '42501';
  END IF;

  v_delta := v_ordem_destino - v_ordem_origem;

  IF v_delta = 1 THEN
    -- Avanço (N -> N+1): etapa origem concluída, etapa destino em andamento.
    UPDATE fat_etapa_contrato
       SET status = 'concluida', dt_conclusao = COALESCE(dt_conclusao, CURRENT_DATE)
     WHERE id_contrato = p_id_contrato AND id_etapa = v_id_etapa_origem;

    UPDATE fat_etapa_contrato
       SET status = 'em_andamento', dt_inicio = COALESCE(dt_inicio, CURRENT_DATE)
     WHERE id_contrato = p_id_contrato AND id_etapa = p_id_etapa_destino;

    UPDATE fat_contrato SET id_etapa_atual = p_id_etapa_destino WHERE id_contrato = p_id_contrato;

  ELSIF v_delta = -1 THEN
    -- Retrocesso (N+1 -> N, correção de erro): exclusivo de Admin/Gestora.
    IF app.papel_atual() NOT IN ('admin', 'gestora') THEN
      RAISE EXCEPTION 'Você não tem permissão para realizar esta operação.' USING ERRCODE = '42501';
    END IF;

    UPDATE fat_etapa_contrato
       SET status = 'em_andamento', dt_conclusao = NULL
     WHERE id_contrato = p_id_contrato AND id_etapa = p_id_etapa_destino;

    UPDATE fat_etapa_contrato
       SET status = 'nao_iniciada', dt_inicio = NULL, dt_conclusao = NULL
     WHERE id_contrato = p_id_contrato AND id_etapa = v_id_etapa_origem;

    UPDATE fat_contrato SET id_etapa_atual = p_id_etapa_destino WHERE id_contrato = p_id_contrato;

  ELSE
    -- Qualquer outro delta (0 ou |delta| > 1): salto de coluna não-adjacente.
    RAISE EXCEPTION 'Não é possível pular etapas — mova o card para a coluna adjacente.' USING ERRCODE = 'KAN01';
  END IF;
END;
$$;

COMMENT ON FUNCTION app.mover_etapa_kanban(bigint, bigint) IS
'KAN-04 a KAN-09. Única forma sancionada de gravar avanço/retrocesso de etapa no Kanban (AD-023). SECURITY INVOKER: herda RLS/GRANT do chamador (T1); só adiciona a regra de adjacência (KAN01) e de papel na reversão (42501) que uma policy de linha não consegue expressar.';
