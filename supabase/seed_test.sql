-- =============================================================================
-- T19: seed mínimo de integração para as Fases 3-4 (funções RPC de negócio e
-- camada backend) -- 1 contratante/mandato de exemplo com um contrato aberto,
-- 1 coalizão de exemplo, e 2 usuários de teste (mentor/assessor) vinculados
-- ao contrato de exemplo.
--
-- Idempotente por desenho: toda linha é resolvida por um valor estável
-- (nome/email fixo) antes de inserir, então rodar este arquivo várias vezes
-- (ex.: toda execução de `npm run test:integration`) nunca duplica linha nem
-- viola CHECK/UNIQUE -- ao contrário dos outros arquivos de teste desta
-- feature, os dados aqui NÃO são apagados em teardown: o propósito de T19 é
-- deixá-los disponíveis para as fases seguintes (T20+).
-- =============================================================================

DO $$
DECLARE
  v_id_contratante_mandato BIGINT;
  v_id_mandato             BIGINT;
  v_id_contrato            BIGINT;
  v_id_contratante_col     BIGINT;
  v_id_coalizao            BIGINT;
  v_id_produto_estrategia  BIGINT;
  v_id_cargo_vereador      BIGINT;
BEGIN
  SELECT id_produto INTO v_id_produto_estrategia FROM ref_produto WHERE nome = 'Estratégia';
  SELECT id_cargo INTO v_id_cargo_vereador FROM ref_cargo WHERE nome = 'Vereador(a)';

  -- 1 contratante/mandato de exemplo -----------------------------------------
  SELECT id_contratante INTO v_id_contratante_mandato
    FROM dim_contratante WHERE nome = 'T19 Seed Mandato Exemplo';
  IF v_id_contratante_mandato IS NULL THEN
    INSERT INTO dim_contratante (tipo_contratante, nome, sg_uf, nm_municipio)
    VALUES ('mandato', 'T19 Seed Mandato Exemplo', 'SP', 'São Paulo')
    RETURNING id_contratante INTO v_id_contratante_mandato;
  END IF;

  SELECT id_mandato INTO v_id_mandato FROM dim_mandato WHERE id_contratante = v_id_contratante_mandato;
  IF v_id_mandato IS NULL THEN
    INSERT INTO dim_mandato (id_contratante, nm_urna, id_cargo_atual, origem_partido_cargo)
    VALUES (v_id_contratante_mandato, 'Vereador(a) Seed Teste', v_id_cargo_vereador, 'manual')
    RETURNING id_mandato INTO v_id_mandato;
  END IF;

  -- Contrato de exemplo (Estratégia, ativo) -----------------------------------
  SELECT id_contrato INTO v_id_contrato FROM fat_contrato WHERE id_contratante = v_id_contratante_mandato;
  IF v_id_contrato IS NULL THEN
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, id_cargo_no_contrato, status)
    VALUES (v_id_contratante_mandato, v_id_produto_estrategia, CURRENT_DATE, v_id_cargo_vereador, 'ativo')
    RETURNING id_contrato INTO v_id_contrato;
  END IF;

  -- 1 coalizão de exemplo ------------------------------------------------------
  SELECT id_contratante INTO v_id_contratante_col
    FROM dim_contratante WHERE nome = 'T19 Seed Coalizão Exemplo';
  IF v_id_contratante_col IS NULL THEN
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('coalizao', 'T19 Seed Coalizão Exemplo')
    RETURNING id_contratante INTO v_id_contratante_col;
  END IF;

  SELECT id_coalizao INTO v_id_coalizao FROM dim_coalizao WHERE id_contratante = v_id_contratante_col;
  IF v_id_coalizao IS NULL THEN
    INSERT INTO dim_coalizao (id_contratante, possui_planejamento_proprio)
    VALUES (v_id_contratante_col, false)
    RETURNING id_coalizao INTO v_id_coalizao;
  END IF;

  -- Usuários de teste adicionais (mentor/assessor) vinculados ao contrato ------
  INSERT INTO dim_usuario (email, nome, papel_global, ativo)
  VALUES ('t19-seed-mentor@legislabrasil.test', 'T19 Seed Mentor', 'mentor', true)
  ON CONFLICT (email) DO UPDATE SET ativo = true;

  INSERT INTO dim_usuario (email, nome, papel_global, ativo)
  VALUES ('t19-seed-assessor@legislabrasil.test', 'T19 Seed Assessor', 'assessor', true)
  ON CONFLICT (email) DO UPDATE SET ativo = true;

  INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato, cargo)
  SELECT v_id_contrato, id_usuario, 'mentor', 'nao_se_aplica'
    FROM dim_usuario WHERE email = 't19-seed-mentor@legislabrasil.test'
  ON CONFLICT (id_contrato, id_usuario, papel_no_contrato) DO NOTHING;

  INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato, cargo)
  SELECT v_id_contrato, id_usuario, 'assessor', 'assessor'
    FROM dim_usuario WHERE email = 't19-seed-assessor@legislabrasil.test'
  ON CONFLICT (id_contrato, id_usuario, papel_no_contrato) DO NOTHING;
END $$;
