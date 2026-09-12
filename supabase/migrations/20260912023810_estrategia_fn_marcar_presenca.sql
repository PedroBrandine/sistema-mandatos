-- =============================================================================
-- redesenho-estrategia-tela-first: T29 — app.marcar_presenca(p_id_encontro)
-- EST-13 AC4/AC5. SECURITY INVOKER (AD-024): herda o papel de quem chama, e a
-- RLS/GRANT de fat_encontro (20260813192341/20260813192816, feature
-- incidencia) continua sendo a fronteira real de quem pode escrever.
-- SECURITY DEFINER deliberadamente ausente.
--
-- A auditoria (AD-006) NÃO é escrita aqui: fat_encontro já tem
-- app.trg_auditoria() ligado desde 20260813192032 (linha 76), então o UPDATE
-- abaixo grava autor e timestamp em log_auditoria de graça -- mesmo mecanismo
-- de app.mover_etapa_kanban. Reusar um gatilho provado não é evidência de que
-- ele está ligado NESTA tabela: o teste de integração assere a linha
-- resultante em log_auditoria (lição L-013).
-- =============================================================================

CREATE OR REPLACE FUNCTION app.marcar_presenca(
  p_id_encontro bigint
) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM fat_encontro WHERE id_encontro = p_id_encontro;

  -- Encontro não existe OU a RLS de fat_encontro já filtrou por falta de
  -- vínculo -- nunca revelar qual dos dois é o caso (mesmo 42501 de
  -- app.mover_etapa_kanban).
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Encontro não encontrado ou sem permissão.' USING ERRCODE = '42501';
  END IF;

  -- EST-13 AC5: marcar presença num encontro já realizado não duplica a
  -- transição. Sai antes do UPDATE, então não há segunda linha em
  -- log_auditoria nem dt_realizada reescrita para um instante posterior.
  IF v_status = 'realizado' THEN
    RETURN;
  END IF;

  -- COALESCE preserva uma dt_realizada que já exista (encontro remarcado que
  -- guardou a data da realização anterior), em vez de sobrescrevê-la.
  UPDATE fat_encontro
     SET status = 'realizado',
         dt_realizada = COALESCE(dt_realizada, now())
   WHERE id_encontro = p_id_encontro;
END;
$$;

COMMENT ON FUNCTION app.marcar_presenca(bigint) IS
'EST-13 AC4/AC5. Fecha um encontro como realizado a partir da Agenda: grava status=realizado e dt_realizada numa transação só. SECURITY INVOKER (AD-024) -- RLS/GRANT de fat_encontro decidem quem pode. Idempotente: encontro já realizado retorna sem escrever, então não duplica a transição nem a linha de auditoria. SPEC-PRECISION GAP: EST-13 não define o que acontece ao marcar presença num encontro cancelado; hoje ele transiciona para realizado como qualquer outro não-realizado.';
