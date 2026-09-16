-- =============================================================================
-- planejamento-estrategico-v2: T5 -- as duas escritas que cruzam mais de uma
-- linha (PLV-06 criação em lote, PLV-09 mover na hierarquia).
--
-- AD-024: as duas são SECURITY INVOKER, sem cláusula -- a RLS (p_heranca) e os
-- GRANTs do chamador continuam valendo linha a linha. Elas existem para dar
-- ATOMICIDADE e INVARIANTE, não para contornar autorização. A exceção AD-035
-- (SECURITY DEFINER) não se aplica: aqui o chamador controla O QUE é escrito,
-- que é exatamente o caso que AD-024 proíbe de rodar como dono.
--
-- ERRCODEs na convenção já estabelecida por KAN01/PRO01/CNV0x/MDU01:
--   PLN01  lote sem nenhum mês selecionado
--   PLN02  lote acima de 12 meses
--   PLN03  destino da movimentação pertence a outro contrato
--   PLN04  tipo de item inválido em move_item_hierarquia
-- =============================================================================

-- --- PLV-06: criação de Sucessos Mensais em lote -----------------------------
-- Um SM continua tendo UM mês (mes_referencia segue DATE NOT NULL, dia 1). O
-- lote é conveniência de cadastro: N meses marcados viram N registros IRMÃOS e
-- INDEPENDENTES -- ids distintos, cada um com seu próprio %, sem nenhum vínculo
-- de "irmandade" persistido (context.md D-3). Editar um depois não toca nos
-- outros porque não há o que os ligue.
--
-- POR QUE PRECISA SER RPC (AD-024), e não N inserts do cliente:
--   1. ATOMICIDADE -- é um ÚNICO INSERT ... SELECT unnest(). Se qualquer mês
--      violar ck_sucesso_mes (dia != 1) ou qualquer outra constraint, o
--      statement inteiro reverte e nenhuma linha fica para trás. N chamadas
--      soltas deixariam o lote pela metade (Edge Case da spec).
--   2. UMA CASCATA, NÃO N (PLV-06 AC6) -- o PERFORM abaixo roda uma vez, depois
--      de todas as linhas existirem. N inserts do cliente disparariam N
--      recálculos do plano inteiro.
--
-- O limite de 12 é o mesmo que a grade de meses do modal oferece -- marcar 12
-- meses em várias Metas cresce rápido, e a checagem mora aqui para valer
-- também fora da tela.
CREATE OR REPLACE FUNCTION app.cria_sucessos_mensais_lote(
  p_id_meta BIGINT,
  p_base    JSONB,
  p_meses   DATE[]
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_id_planejamento BIGINT;
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

  INSERT INTO fat_sucesso_mensal (
    id_meta, descricao, mes_referencia, dt_limite, peso, pct_atingimento, status,
    id_usuario_responsavel, atualizado_por, atualizado_em)
  SELECT p_id_meta,
         p_base ->> 'descricao',
         mes,
         (p_base ->> 'dt_limite')::DATE,
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
'PLV-06. N meses marcados viram N Sucessos Mensais irmãos e independentes, num único INSERT atômico, com UMA cascata ao final (AC6). SECURITY INVOKER (AD-024).';

-- --- PLV-09: mover Meta entre Objetivos, Sucesso Mensal entre Metas ----------
-- Uma função para os dois casos porque o invariante é o mesmo: trocar a FK e
-- deixar os dois lados com o número marcado como envelhecido. Duas funções
-- duplicariam a marcação.
--
-- AC4 -- destino de OUTRO contrato é recusado. Como dim_planejamento é 1:1 com
-- fat_contrato, "mesmo contrato" é o mesmo id_planejamento. É também por isso
-- que "marcar origem E destino" (AC1/AC2) resulta num único planejamento
-- marcado: os dois lados são obrigatoriamente do mesmo plano.
--
-- A MARCAÇÃO NÃO É FEITA AQUI, de propósito: os gatilhos de statement já
-- instalados em 20260812145917 cobrem exatamente estas duas colunas --
-- app.trg_marca_por_meta_upd dispara com `n.id_objetivo IS DISTINCT FROM
-- a.id_objetivo` e marca os planejamentos dos objetivos de origem E de destino;
-- app.trg_marca_desatualizado_upd dispara com `n.id_meta IS DISTINCT FROM
-- a.id_meta`. Repetir o UPDATE aqui seria uma segunda fonte de verdade para a
-- mesma regra.
--
-- O objetivo de um Sucesso Mensal é DERIVADO da Meta -- não existe caso
-- 'objetivo' aqui, e o modal exibe esse campo como leitura (AC3). A FK não
-- permite pendurar SM direto no Objetivo.
CREATE OR REPLACE FUNCTION app.move_item_hierarquia(
  p_tipo     TEXT,
  p_id       BIGINT,
  p_novo_pai BIGINT
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_origem  BIGINT;
  v_destino BIGINT;
BEGIN
  IF p_tipo NOT IN ('meta', 'sucesso') THEN
    RAISE EXCEPTION 'Tipo de item inválido: use meta ou sucesso.' USING ERRCODE = 'PLN04';
  END IF;

  IF p_tipo = 'meta' THEN
    SELECT o.id_planejamento INTO v_origem
      FROM fat_meta m
      JOIN fat_objetivo_especifico o ON o.id_objetivo = m.id_objetivo
     WHERE m.id_meta = p_id;

    SELECT o.id_planejamento INTO v_destino
      FROM fat_objetivo_especifico o
     WHERE o.id_objetivo = p_novo_pai;
  ELSE
    SELECT o.id_planejamento INTO v_origem
      FROM fat_sucesso_mensal sm
      JOIN fat_meta m                ON m.id_meta = sm.id_meta
      JOIN fat_objetivo_especifico o ON o.id_objetivo = m.id_objetivo
     WHERE sm.id_sucesso = p_id;

    SELECT o.id_planejamento INTO v_destino
      FROM fat_meta m
      JOIN fat_objetivo_especifico o ON o.id_objetivo = m.id_objetivo
     WHERE m.id_meta = p_novo_pai;
  END IF;

  IF v_origem IS NULL OR v_destino IS NULL THEN
    RAISE EXCEPTION 'Item ou destino não encontrado, ou sem permissão.' USING ERRCODE = '42501';
  END IF;

  IF v_origem <> v_destino THEN
    RAISE EXCEPTION 'O destino escolhido pertence a outro contrato.' USING ERRCODE = 'PLN03';
  END IF;

  IF p_tipo = 'meta' THEN
    UPDATE fat_meta SET id_objetivo = p_novo_pai WHERE id_meta = p_id;
  ELSE
    UPDATE fat_sucesso_mensal
       SET id_meta        = p_novo_pai,
           atualizado_por = app.id_usuario(),
           atualizado_em  = now()
     WHERE id_sucesso = p_id;
  END IF;
END $$;

COMMENT ON FUNCTION app.move_item_hierarquia(TEXT, BIGINT, BIGINT) IS
'PLV-09. Move Meta entre Objetivos e Sucesso Mensal entre Metas, recusando destino de outro contrato (PLN03). A marcação de desatualizado vem dos gatilhos de statement já existentes. SECURITY INVOKER (AD-024).';
