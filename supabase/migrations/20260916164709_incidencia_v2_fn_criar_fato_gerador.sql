-- =============================================================================
-- fatos-geradores-ciclo-vida: T6 -- app.criar_fato_gerador ganha titulo/
-- situacao/dt_prevista/pre_insight/registro (FGC-06, FGC-09, FGC-15).
-- CREATE OR REPLACE sobre o corpo existente
-- (20260813193050_incidencia_encontros_fn_criar_fato_gerador.sql) -- os 12
-- parâmetros originais mantêm posição e tipo (CREATE OR REPLACE FUNCTION
-- exige isso); os 5 novos entram ao final, todos com DEFAULT (obrigatório em
-- Postgres depois de um parâmetro já opcional).
--
-- p_dt_ocorrencia: DEFAULT CURRENT_DATE -> DEFAULT NULL. Um fato projetado
-- não tem data de ocorrência (T2, ck_fato_situacao_data) -- o default antigo
-- gravaria a data de hoje mesmo quando o chamador não informa nada, o que
-- nunca fez sentido para "ainda vai acontecer" e passou despercebido antes
-- de existir situacao='projetado'.
--
-- Validação de mesmo-contrato para Pré-Insight/Registro: mesma forma das
-- duas já existentes (Meta/Insight) -- RAISE EXCEPTION se a origem
-- informada não pertence a p_id_contrato. Defesa em profundidade (a UI só
-- lista opções do próprio contrato -- SeletorOrigem, T15).
--
-- Nenhum GRANT novo necessário: CREATE OR REPLACE preserva a ACL existente
-- da função (EXECUTE a PUBLIC, padrão do Postgres para função nova -- ver
-- 20260810121100_alinha_grants_app_com_producao.sql -- e este projeto
-- decidiu não endurecer isso função por função ainda).
-- =============================================================================

CREATE OR REPLACE FUNCTION app.criar_fato_gerador(
  p_id_contrato BIGINT, p_id_tipologia BIGINT,
  p_nivel_d1 TEXT DEFAULT NULL, p_nivel_d2 TEXT DEFAULT NULL, p_nivel_d3 TEXT DEFAULT NULL,
  p_id_preditor_1 BIGINT DEFAULT NULL, p_id_preditor_2 BIGINT DEFAULT NULL,
  p_contribuicao_legisla SMALLINT DEFAULT NULL, p_descricao_evidencia TEXT DEFAULT NULL,
  p_dt_ocorrencia DATE DEFAULT NULL,
  p_id_meta_origem BIGINT DEFAULT NULL, p_id_insight_origem BIGINT DEFAULT NULL,
  p_titulo TEXT DEFAULT NULL, p_situacao TEXT DEFAULT 'realizado', p_dt_prevista DATE DEFAULT NULL,
  p_id_pre_insight_origem BIGINT DEFAULT NULL, p_id_registro_origem BIGINT DEFAULT NULL
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_id BIGINT;
BEGIN
  -- Meta de origem precisa pertencer ao mesmo contrato (cadeia
  -- fat_meta -> fat_objetivo_especifico -> dim_planejamento -> id_contrato).
  IF p_id_meta_origem IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM fat_meta m JOIN fat_objetivo_especifico o ON o.id_objetivo = m.id_objetivo
      JOIN dim_planejamento pl ON pl.id_planejamento = o.id_planejamento
     WHERE m.id_meta = p_id_meta_origem AND pl.id_contrato = p_id_contrato
  ) THEN
    RAISE EXCEPTION 'Meta % não pertence ao contrato %', p_id_meta_origem, p_id_contrato;
  END IF;

  -- Insight de origem precisa pertencer ao mesmo contrato.
  IF p_id_insight_origem IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM fat_insight i WHERE i.id_insight = p_id_insight_origem AND i.id_contrato = p_id_contrato
  ) THEN
    RAISE EXCEPTION 'Insight % não pertence ao contrato %', p_id_insight_origem, p_id_contrato;
  END IF;

  -- Pré-Insight de origem precisa pertencer ao mesmo contrato.
  IF p_id_pre_insight_origem IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM fat_pre_insight pi WHERE pi.id_pre_insight = p_id_pre_insight_origem AND pi.id_contrato = p_id_contrato
  ) THEN
    RAISE EXCEPTION 'Pré-Insight % não pertence ao contrato %', p_id_pre_insight_origem, p_id_contrato;
  END IF;

  -- Registro de origem precisa pertencer ao mesmo contrato.
  IF p_id_registro_origem IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM fat_registro r WHERE r.id_registro = p_id_registro_origem AND r.id_contrato = p_id_contrato
  ) THEN
    RAISE EXCEPTION 'Registro % não pertence ao contrato %', p_id_registro_origem, p_id_contrato;
  END IF;

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, nivel_d1, nivel_d2, nivel_d3,
    id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, dt_ocorrencia,
    titulo, situacao, dt_prevista, id_usuario_autor)
  VALUES (p_id_contrato, p_id_tipologia, p_nivel_d1, p_nivel_d2, p_nivel_d3,
    p_id_preditor_1, p_id_preditor_2, p_contribuicao_legisla, p_descricao_evidencia, p_dt_ocorrencia,
    p_titulo, p_situacao, p_dt_prevista, app.id_usuario())
  RETURNING id_fato_gerador INTO v_id;

  IF p_id_meta_origem IS NOT NULL OR p_id_insight_origem IS NOT NULL
     OR p_id_pre_insight_origem IS NOT NULL OR p_id_registro_origem IS NOT NULL THEN
    INSERT INTO rel_fato_origem (id_fato_gerador, id_meta, id_insight, id_pre_insight, id_registro)
    VALUES (v_id, p_id_meta_origem, p_id_insight_origem, p_id_pre_insight_origem, p_id_registro_origem);
  END IF;

  RETURN v_id;
END $$;
