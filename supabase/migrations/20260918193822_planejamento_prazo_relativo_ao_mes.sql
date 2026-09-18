-- =============================================================================
-- pente-fino-2026-09: T9 -- PF-03, prazo relativo ao mês em
-- app.cria_sucessos_mensais_lote (.specs/features/pente-fino-2026-09/tasks.md).
--
-- Hoje `dt_limite` do lote é uma DATA FIXA, aplicada literalmente a todos os
-- meses de p_meses. Bug relatado: atribuir um Sucesso Mensal a vários meses
-- com prazo "dia 10" gera a MESMA data em todo mundo, em vez de dia 10 EM
-- CADA mês da atribuição.
--
-- Esta migration troca a data fixa pelo DIA de dt_limite, aplicado a cada mes
-- de p_meses -- LEAST contra o último dia do mês trata o caso em que o dia
-- não existe no mês de destino (ex.: dia 31 aplicado a um mês de 30 dias),
-- clampando em vez de estourar erro (nenhuma AC/edge case da spec pede erro
-- aqui, e clampar preserva a intenção -- "o mais perto possível do dia
-- pedido" -- em vez de recusar o lote inteiro por um mês).
--
-- Assinatura do client não muda (CREATE OR REPLACE, mesmos parâmetros) --
-- PF-03 é mudança de COMPORTAMENTO da função de banco, não de contrato
-- (design.md "Interfaces": "sem mudança de assinatura no client").
-- =============================================================================

CREATE OR REPLACE FUNCTION app.cria_sucessos_mensais_lote(
  p_id_meta BIGINT,
  p_base    JSONB,
  p_meses   DATE[]
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_id_planejamento BIGINT;
  v_dia             INT;
BEGIN
  IF p_meses IS NULL OR array_length(p_meses, 1) IS NULL THEN
    RAISE EXCEPTION 'Selecione ao menos um mês de referência.' USING ERRCODE = 'PLN01';
  END IF;

  IF array_length(p_meses, 1) > 12 THEN
    RAISE EXCEPTION 'Selecione no máximo 12 meses por vez.' USING ERRCODE = 'PLN02';
  END IF;

  -- Resolve o planejamento pela Meta. Vem NULL tanto para Meta inexistente
  -- quanto para Meta fora da carteira do chamador (a RLS filtra em silêncio) --
  -- os dois casos são a mesma resposta, de propósito: dizer "existe, mas você
  -- não pode" já é vazar a existência.
  SELECT o.id_planejamento INTO v_id_planejamento
    FROM fat_meta m
    JOIN fat_objetivo_especifico o ON o.id_objetivo = m.id_objetivo
   WHERE m.id_meta = p_id_meta;

  IF v_id_planejamento IS NULL THEN
    RAISE EXCEPTION 'Meta não encontrada ou sem permissão.' USING ERRCODE = '42501';
  END IF;

  -- PF-03: dia do prazo informado, aplicado a cada mês de p_meses -- não mais
  -- a data fixa inteira. NULL quando o lote não tem prazo (dt_limite opcional).
  IF p_base ->> 'dt_limite' IS NOT NULL THEN
    v_dia := EXTRACT(DAY FROM (p_base ->> 'dt_limite')::DATE);
  END IF;

  INSERT INTO fat_sucesso_mensal (
    id_meta, descricao, mes_referencia, dt_limite, peso, pct_atingimento, status,
    id_usuario_responsavel, atualizado_por, atualizado_em)
  SELECT p_id_meta,
         p_base ->> 'descricao',
         mes,
         CASE WHEN v_dia IS NULL THEN NULL
              ELSE LEAST(
                     (date_trunc('month', mes) + ((v_dia - 1) || ' days')::interval)::date,
                     (date_trunc('month', mes) + interval '1 month' - interval '1 day')::date
                   )
         END,
         (p_base ->> 'peso')::NUMERIC,
         (p_base ->> 'pct_atingimento')::NUMERIC,
         COALESCE(p_base ->> 'status', 'pendente'),
         (p_base ->> 'id_usuario_responsavel')::BIGINT,
         app.id_usuario(),
         now()
    FROM unnest(p_meses) AS mes;

  PERFORM app.recalcula_atingimento(v_id_planejamento);
END $$;

COMMENT ON FUNCTION app.cria_sucessos_mensais_lote(BIGINT, JSONB, DATE[]) IS
'PLV-06/PF-03. N meses marcados viram N Sucessos Mensais irmãos e independentes, num único INSERT atômico, com UMA cascata ao final (AC6). O dia de dt_limite é aplicado a CADA mês do lote (PF-03), clampado ao último dia do mês quando o dia não existir nele. SECURITY INVOKER (AD-024).';
