-- =============================================================================
-- redesenho-estrategia-tela-first (.specs/features/redesenho-estrategia-tela-first/):
-- T7 -- app.converter_prospeccao(p_id_prospeccao, p_dt_inicio).
-- EST-04 AC3/AC4, AD-024.
--
-- SECURITY INVOKER (padrao do Postgres, sem SECURITY DEFINER em lugar nenhum):
-- a funcao herda o papel de quem chama, entao a RLS de fat_prospeccao (T6) e o
-- GRANT de fat_contrato continuam sendo a fronteira real de quem pode
-- converter. A funcao so adiciona a atomicidade e a regra de mao unica, que
-- policy de linha nao expressa. Estilo replicado de app.mover_etapa_kanban
-- (20260812091115_kanban_etapas_fn_mover.sql).
--
-- Por que precisa ser funcao e nao duas chamadas do cliente (AD-024): a
-- conversao cruza duas tabelas -- cria fat_contrato e marca a prospeccao. Duas
-- chamadas Supabase soltas nao tem transacao entre si; uma falha no meio
-- deixaria contrato orfao (contrato criado, prospeccao ainda aberta), e a
-- proxima tentativa criaria um segundo contrato. Dentro da funcao as duas
-- escritas sao um bloco atomico: o erro desfaz o INSERT junto.
--
-- Ordem dos passos importa. A checagem de status vem ANTES do INSERT, para que
-- a segunda conversao (EST-04 AC4) falhe sem nunca ter criado contrato --
-- confiar no rollback para isso funcionaria, mas consumiria a sequence e
-- deixaria o buraco no id; recusar antes e o comportamento correto.
--
-- FOR UPDATE na leitura: trava a linha ate o fim da transacao. Duas conversoes
-- concorrentes da MESMA prospeccao serializam, e a segunda le status
-- 'convertida' ja gravado, caindo no PRO01 -- sem isso as duas leriam 'aberta'
-- e criariam dois contratos. E o par da trava de
-- uq_prospeccao_aberta_contratante (T5), que cobre o caso de duas prospeccoes
-- distintas do mesmo contratante.
--
-- ERRCODEs, na mesma convencao de KAN01/MDU01:
--   42501 -- prospeccao inexistente OU filtrada pela RLS. Nunca revelar qual
--            dos dois (mesmo espirito de PermissaoNegadaError, ja usado por
--            app.mover_etapa_kanban).
--   PRO01 -- prospeccao nao esta aberta: ja convertida ou descartada.
--            Conversao e mao unica (EST-04 AC4).
-- =============================================================================

CREATE OR REPLACE FUNCTION app.converter_prospeccao(
  p_id_prospeccao    bigint,
  p_dt_inicio        date DEFAULT CURRENT_DATE
) RETURNS bigint
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_id_contratante BIGINT;
  v_id_produto     BIGINT;
  v_id_projeto     BIGINT;
  v_status         TEXT;
  v_id_contrato    BIGINT;
BEGIN
  SELECT id_contratante, id_produto, id_projeto, status
    INTO v_id_contratante, v_id_produto, v_id_projeto, v_status
    FROM fat_prospeccao
   WHERE id_prospeccao = p_id_prospeccao
     FOR UPDATE;

  IF v_id_contratante IS NULL THEN
    RAISE EXCEPTION 'Prospecção não encontrada ou sem permissão.' USING ERRCODE = '42501';
  END IF;

  IF v_status <> 'aberta' THEN
    RAISE EXCEPTION 'Esta prospecção já foi encerrada e não pode ser convertida de novo.'
      USING ERRCODE = 'PRO01';
  END IF;

  -- O INSERT dispara trg_fat_contrato_instancia (operacao-regua-instanciacao),
  -- que instancia a régua do produto -- por isso o contrato nasce completo sem
  -- nenhuma escrita extra aqui.
  INSERT INTO fat_contrato (id_contratante, id_produto, id_projeto, dt_inicio, status)
  VALUES (v_id_contratante, v_id_produto, v_id_projeto, p_dt_inicio, 'ativo')
  RETURNING id_contrato INTO v_id_contrato;

  UPDATE fat_prospeccao
     SET status             = 'convertida',
         id_contrato_gerado = v_id_contrato,
         dt_desfecho        = CURRENT_DATE,
         atualizado_em      = now()
   WHERE id_prospeccao = p_id_prospeccao;

  RETURN v_id_contrato;
END;
$$;

COMMENT ON FUNCTION app.converter_prospeccao(bigint, date) IS
'EST-04 AC3/AC4. Única forma sancionada de converter prospecção em contrato (AD-024): cria o fat_contrato e marca a prospecção como convertida na mesma transação, de modo que falha no meio não deixa contrato órfão. SECURITY INVOKER: herda RLS/GRANT do chamador (T6); só adiciona a atomicidade e a mão única (PRO01), que policy de linha não expressa.';
