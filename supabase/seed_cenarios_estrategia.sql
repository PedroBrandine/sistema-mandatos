-- =============================================================================
-- kpi-status-mandatos-ativos / T1 (KSM-11, KSM-13): cenários de classificação
-- de prazo do card "Mandatos ativos" (AD-050/AD-051).
--
-- POR QUE EXISTE: a quebra por status só é conferível na tela se houver pelo
-- menos um mandato em cada estado. Em dev, "atenção" ficava zerado, e o caso
-- "sem transição registrada" -- o que AD-051 passou a classificar pela etapa
-- de ordem 1 -- tinha um único exemplar. Sem esses casos, a validação ao vivo
-- (P4) não distingue "a view classifica certo" de "não havia o que classificar".
--
-- IDEMPOTENTE POR DESENHO, como supabase/seed_test.sql: cada linha é resolvida
-- por um nome estável antes de inserir, então rodar de novo não duplica nem
-- viola UNIQUE. As datas são todas relativas a CURRENT_DATE -- o seed não
-- envelhece e não precisa ser reescrito amanhã.
--
-- OS PERCENTUAIS VÊM DE ref_limiar_pendencia, não estão cravados aqui (AD-004:
-- limiar é dado, não código). Se a operação recalibrar 70/100, os cenários se
-- reposicionam sozinhos na próxima execução, em vez de passarem a mentir.
--
-- NÃO É MIGRATION: só mexe em dados, nunca em schema. Roda com
-- `supabase db query --linked --file supabase/seed_cenarios_estrategia.sql`
-- contra DEV (confira `supabase/.temp/project-ref` antes -- docs/ambientes.md).
-- Produção não recebe seed.
--
-- As linhas de fat_etapa_contrato NÃO são inseridas aqui: o trigger
-- app.trg_instancia_contrato (migration 20260812001347) instancia a régua
-- inteira no AFTER INSERT de fat_contrato. Este seed só reposiciona a etapa
-- atual e a data de início real depois que a régua já existe.
-- =============================================================================

DO $$
DECLARE
  v_id_produto     BIGINT;
  v_id_cargo       BIGINT;
  v_id_etapa_ref   BIGINT;   -- etapa de menor ordem (a do fallback de AD-051)
  v_dur_ref        INT;
  v_id_etapa_alvo  BIGINT;   -- etapa seguinte, onde os 3 estados são posicionados
  v_dur_alvo       INT;
  v_pct_atrasado   NUMERIC;
  v_pct_atencao    NUMERIC;
  v_dias           INT;
  v_id_contratante BIGINT;
  v_id_mandato     BIGINT;
  v_id_contrato    BIGINT;
  r                RECORD;
BEGIN
  SELECT id_produto INTO v_id_produto FROM ref_produto WHERE nome = 'Estratégia';
  SELECT id_cargo   INTO v_id_cargo   FROM ref_cargo   WHERE nome = 'Vereador(a)';

  SELECT id_etapa, duracao_prevista_dias INTO v_id_etapa_ref, v_dur_ref
    FROM ref_etapa
   WHERE id_produto = v_id_produto
   ORDER BY ordem
   LIMIT 1;

  SELECT id_etapa, duracao_prevista_dias INTO v_id_etapa_alvo, v_dur_alvo
    FROM ref_etapa
   WHERE id_produto = v_id_produto
     AND duracao_prevista_dias IS NOT NULL
     AND id_etapa <> v_id_etapa_ref
   ORDER BY ordem
   LIMIT 1;

  SELECT pct_duracao_etapa INTO v_pct_atrasado
    FROM ref_limiar_pendencia WHERE codigo = 'etapa_atrasado' AND ativo;
  SELECT pct_duracao_etapa INTO v_pct_atencao
    FROM ref_limiar_pendencia WHERE codigo = 'etapa_atencao' AND ativo;

  IF v_id_produto IS NULL OR v_id_etapa_ref IS NULL OR v_id_etapa_alvo IS NULL THEN
    RAISE EXCEPTION 'Catálogo de Estratégia incompleto: produto/etapas não encontrados';
  END IF;
  IF v_pct_atrasado IS NULL OR v_pct_atencao IS NULL THEN
    RAISE EXCEPTION 'Limiares etapa_atrasado/etapa_atencao inativos: os cenários não teriam estado definido';
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      ('KPI Cenario Atrasado',  'atrasado'),
      ('KPI Cenario Atencao',   'atencao'),
      ('KPI Cenario Normal',    'normal'),
      ('KPI Cenario Sem Etapa', 'sem_etapa'),
      ('KPI Cenario Encerrado', 'encerrado')
    ) AS v(nome, caso)
  LOOP
    SELECT id_contratante INTO v_id_contratante FROM dim_contratante WHERE nome = r.nome;
    IF v_id_contratante IS NULL THEN
      INSERT INTO dim_contratante (tipo_contratante, nome, sg_uf, nm_municipio)
      VALUES ('mandato', r.nome, 'SP', 'São Paulo')
      RETURNING id_contratante INTO v_id_contratante;
    END IF;

    SELECT id_mandato INTO v_id_mandato FROM dim_mandato WHERE id_contratante = v_id_contratante;
    IF v_id_mandato IS NULL THEN
      INSERT INTO dim_mandato (id_contratante, nm_urna, id_cargo_atual, origem_partido_cargo)
      VALUES (v_id_contratante, r.nome, v_id_cargo, 'manual')
      RETURNING id_mandato INTO v_id_mandato;
    END IF;

    -- O contrato "sem etapa" precisa de um início antigo: é dele que AD-051
    -- mede os dias, contra a duração da etapa de ordem 1.
    SELECT id_contrato INTO v_id_contrato
      FROM fat_contrato
     WHERE id_contratante = v_id_contratante AND id_produto = v_id_produto;
    IF v_id_contrato IS NULL THEN
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, id_cargo_no_contrato, status)
      VALUES (
        v_id_contratante,
        v_id_produto,
        CASE WHEN r.caso = 'sem_etapa'
             THEN CURRENT_DATE - (CEIL(v_dur_ref * v_pct_atrasado / 100.0)::int + 3)
             ELSE CURRENT_DATE - 1 END,
        v_id_cargo,
        CASE WHEN r.caso = 'encerrado' THEN 'concluido' ELSE 'ativo' END
      )
      RETURNING id_contrato INTO v_id_contrato;
    END IF;

    -- Reposiciona o cenário toda vez (não só na criação): assim o seed
    -- reancora datas que envelheceram desde a última execução.
    IF r.caso IN ('atrasado', 'atencao', 'normal') THEN
      v_dias := CASE r.caso
        -- Acima do limiar de atrasado.
        WHEN 'atrasado' THEN CEIL(v_dur_alvo * v_pct_atrasado / 100.0)::int + 2
        -- Entre os dois limiares: parte do de atenção e sobe metade da folga
        -- até o de atrasado, para não encostar em nenhuma das duas bordas.
        WHEN 'atencao'  THEN CEIL(v_dur_alvo * (v_pct_atencao + (v_pct_atrasado - v_pct_atencao) / 2) / 100.0)::int
        -- Metade do caminho até o limiar de atenção.
        ELSE FLOOR(v_dur_alvo * v_pct_atencao / 200.0)::int
      END;

      UPDATE fat_contrato
         SET id_etapa_atual = v_id_etapa_alvo,
             status = 'ativo',
             dt_inicio = CURRENT_DATE - 1
       WHERE id_contrato = v_id_contrato;

      UPDATE fat_etapa_contrato
         SET dt_inicio = CURRENT_DATE - v_dias,
             status = 'em_andamento'
       WHERE id_contrato = v_id_contrato AND id_etapa = v_id_etapa_alvo;

    ELSIF r.caso = 'sem_etapa' THEN
      -- O caso de AD-051: nenhuma transição registrada. id_etapa_atual nulo e
      -- nenhuma linha de etapa com dt_inicio -- a âncora tem de ser
      -- fat_contrato.dt_inicio, e a etapa de referência a de ordem 1.
      UPDATE fat_contrato
         SET id_etapa_atual = NULL,
             status = 'ativo',
             dt_inicio = CURRENT_DATE - (CEIL(v_dur_ref * v_pct_atrasado / 100.0)::int + 3)
       WHERE id_contrato = v_id_contrato;

      UPDATE fat_etapa_contrato
         SET dt_inicio = NULL,
             status = 'nao_iniciada'
       WHERE id_contrato = v_id_contrato;

    ELSE -- encerrado
      -- Contrato não ativo: fora do número grande e de toda linha de status.
      UPDATE fat_contrato
         SET status = 'concluido',
             id_etapa_atual = v_id_etapa_alvo
       WHERE id_contrato = v_id_contrato;
    END IF;
  END LOOP;
END $$;
