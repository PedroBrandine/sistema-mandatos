-- diagnostico-participante-pll (Agenda do PLL, Figma 328:1262): a Agenda do
-- PLL mostra 5 slots fixos de "Mentoria" (nr_sequencia 1..5,
-- ref_tipo_registro 'PLL'/'mentorias'/'mentoria', qtd_prevista=5). Agendar a
-- Mentoria N precisa gravar esse nr_sequencia no encontro -- app.criar_encontro
-- (20260917194257) não aceitava o parâmetro, então todo encontro criado por
-- ele nascia com nr_sequencia NULL.
--
-- Parâmetro novo com DEFAULT NULL, acrescentado no FINAL da assinatura --
-- 100% compatível com as 2 chamadas existentes (EncontroForm/FMC-30), que
-- continuam funcionando sem passar o parâmetro novo.

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
  p_participantes    JSONB DEFAULT '[]'::jsonb,
  p_nr_sequencia     SMALLINT DEFAULT NULL
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
    dt_prevista_inicio, dt_prevista_fim, modalidade, local, tema_prioritario, nr_sequencia
  ) VALUES (
    p_id_contrato, p_id_etapa, p_id_tipo_registro, p_titulo,
    p_dt_inicio, p_dt_fim, p_modalidade, p_local, p_tema, p_nr_sequencia
  ) RETURNING id_encontro INTO v_id_encontro;

  FOR v_participante IN SELECT * FROM jsonb_array_elements(COALESCE(p_participantes, '[]'::jsonb))
  LOOP
    v_id_usuario := NULLIF(v_participante->>'id_usuario', '')::BIGINT;
    v_nome_livre := v_participante->>'nome_livre';
    v_origem     := v_participante->>'origem';

    IF v_id_usuario IS NOT NULL AND v_nome_livre IS NOT NULL THEN
      RAISE EXCEPTION 'Participante não pode ter id_usuario e nome_livre ao mesmo tempo';
    END IF;

    INSERT INTO rel_encontro_participante (id_encontro, id_usuario, nome_livre, origem)
    VALUES (v_id_encontro, v_id_usuario, v_nome_livre, v_origem);
  END LOOP;

  RETURN v_id_encontro;
END $$;

COMMENT ON FUNCTION app.criar_encontro(BIGINT, TEXT, BIGINT, BIGINT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, JSONB, SMALLINT) IS
'FMC-30/FMC-31/FMC-32 + diagnostico-participante-pll (Agenda PLL). Única forma sancionada de criar um encontro com seus participantes (AD-024). p_nr_sequencia (novo) resolve o slot fixo de Mentoria N do PLL -- mesma coluna que Sprint/Monitoramento já usam para o mesmo fim, ver uq_encontro_sequencia. SECURITY INVOKER -- herda RLS/GRANT de quem chama.';
