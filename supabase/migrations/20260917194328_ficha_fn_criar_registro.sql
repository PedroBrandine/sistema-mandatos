-- ficha-mandato-contrato: T20 -- app.criar_registro(p_id_contrato,
-- p_id_encontro, p_id_tipo_registro, p_ocorrido_em, p_resumo, p_conteudo,
-- p_artefatos, p_presentes) -> BIGINT. FMC-15/FMC-16/FMC-17/FMC-18/FMC-21
-- (spec.md P1 Registro; design.md tabela de RPCs). Consumida pelo wrapper
-- rpc/registro.ts (T21, da885db), que chama por nome (PostgREST resolve RPC
-- por named notation -- confirmado em rpc/errors.ts/demais RPCs deste
-- projeto) -- os nomes e tipos dos 8 parâmetros são exatamente os do design,
-- nada muda para o wrapper.
--
-- SPEC_DEVIATION: a ORDEM dos parâmetros na assinatura abaixo não é a
-- listada em design.md (lá: p_id_contrato, p_id_encontro, p_id_tipo_registro,
-- p_ocorrido_em, p_resumo, p_conteudo, p_artefatos, p_presentes). Motivo:
-- Postgres exige que todo parâmetro com DEFAULT seja seguido só por
-- parâmetros que também têm DEFAULT ("input parameters after one with a
-- default value must also have defaults") -- e no design, p_id_encontro
-- (opcional) vem ANTES de p_id_tipo_registro/p_ocorrido_em/p_conteudo/
-- p_artefatos/p_presentes, que são sempre enviados pelo wrapper (T21) e por
-- isso não precisam de DEFAULT. Reordenado aqui: obrigatórios primeiro
-- (p_id_contrato, p_id_tipo_registro, p_ocorrido_em), depois os sempre-
-- enviados-mas-com-default-de-segurança (p_conteudo/p_artefatos/p_presentes
-- default para vazio), por fim os dois realmente opcionais
-- (p_id_encontro/p_resumo). PostgREST resolve a chamada por NOME (o `rpc()`
-- do supabase-js envia um objeto JSON, não uma lista posicional), então a
-- reordenação é invisível para rpc/registro.ts -- só a lista de nomes/tipos
-- precisa bater, e bate.
--
-- SECURITY INVOKER (AD-024, default do Postgres, sem cláusula -- mesmo
-- estilo de app.criar_encontro/app.criar_insight): herda RLS/GRANT de quem
-- chama.
--
-- nr_sequencia (FMC-15 AC3, A-13): MAX+1 por (id_contrato, id_tipo_registro),
-- sob FOR UPDATE. fat_registro não tem uma linha "contadora" própria para
-- travar (o primeiro registro de um par contrato+tipo não tem nenhuma linha
-- ainda) -- a trava cai na linha de ref_tipo_registro (catálogo, sempre
-- existe), que a função já precisa ler para schema_campos. Efeito colateral
-- aceito: duas criações concorrentes do MESMO tipo, em contratos
-- DIFERENTES, serializam entre si também (não só as do mesmo contrato) --
-- é mais travamento do que o estritamente necessário, mas nr_sequencia
-- nunca colide, que é a garantia que FMC-15 AC3 pede.
--
-- Chaves de p_conteudo são validadas contra ref_tipo_registro.schema_campos
-- (T13, 20260916153258_ficha_schema_campos_tipos.sql): só chave declarada
-- com tipo texto_curto/texto_longo é aceita -- chave estranha (typo, campo
-- de outro tipo de registro, chave de artefato/leitura_encontro) levanta
-- exceção antes de qualquer INSERT.
--
-- Artefatos (FMC-17): cada item de p_artefatos vira uma linha em
-- fat_artefato com escopo='registro' e id_referencia = o registro recém-
-- criado -- trg_valida_artefato_referencia (T2) confere que o contrato bate.
-- ck_artefato_tipo/ck_artefato_url continuam sendo a validação de forma; a
-- função não duplica essas checagens.
--
-- Presentes (FMC-18/B-01/A-21): cada item de p_presentes vira uma linha em
-- rel_registro_participante -- rel_encontro_participante NUNCA é escrita
-- aqui (é o plano do encontro, não o fato do registro).
--
-- id_usuario_autor / id_usuario_anexou resolvidos via app.id_usuario(),
-- nunca recebidos como parâmetro do chamador (AD-006).
--
-- Sem bloco EXCEPTION capturado: qualquer RAISE (explícito ou de CHECK/FK)
-- aborta a transação inteira -- é isso que garante que uma falha em
-- qualquer artefato desfaz o registro inteiro (FMC-21), sem registro órfão
-- nem artefato solto.
-- =============================================================================

CREATE OR REPLACE FUNCTION app.criar_registro(
  p_id_contrato      BIGINT,
  p_id_tipo_registro BIGINT,
  p_ocorrido_em      TIMESTAMPTZ,
  p_conteudo         JSONB DEFAULT '{}'::jsonb,
  p_artefatos        JSONB DEFAULT '[]'::jsonb,
  p_presentes        JSONB DEFAULT '[]'::jsonb,
  p_id_encontro      BIGINT DEFAULT NULL,
  p_resumo           TEXT DEFAULT NULL
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
  v_schema_campos JSONB;
  v_nr_sequencia  SMALLINT;
  v_id_registro   BIGINT;
  v_chave         TEXT;
  v_artefato      JSONB;
  v_participante  JSONB;
  v_id_usuario    BIGINT;
  v_nome_livre    TEXT;
  v_origem        TEXT;
BEGIN
  -- Trava a linha do tipo de registro: serializa a atribuição de
  -- nr_sequencia (FMC-15 AC3) e dá de onde ler schema_campos para validar
  -- p_conteudo logo abaixo.
  SELECT schema_campos INTO v_schema_campos
    FROM ref_tipo_registro
   WHERE id_tipo_registro = p_id_tipo_registro
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tipo de registro % não encontrado', p_id_tipo_registro;
  END IF;

  -- Toda chave de p_conteudo precisa ser um campo de texto declarado em
  -- schema_campos para este tipo -- chave estranha levanta exceção antes de
  -- qualquer INSERT.
  FOR v_chave IN SELECT jsonb_object_keys(COALESCE(p_conteudo, '{}'::jsonb))
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(v_schema_campos -> 'campos', '[]'::jsonb)) AS campo
       WHERE campo ->> 'chave' = v_chave AND campo ->> 'tipo' IN ('texto_curto', 'texto_longo')
    ) THEN
      RAISE EXCEPTION 'Chave % não é um campo de texto declarado para este tipo de registro', v_chave;
    END IF;
  END LOOP;

  SELECT COALESCE(MAX(nr_sequencia), 0) + 1 INTO v_nr_sequencia
    FROM fat_registro
   WHERE id_contrato = p_id_contrato AND id_tipo_registro = p_id_tipo_registro;

  INSERT INTO fat_registro (
    id_contrato, id_tipo_registro, nr_sequencia, id_encontro,
    ocorrido_em, resumo, conteudo, id_usuario_autor
  ) VALUES (
    p_id_contrato, p_id_tipo_registro, v_nr_sequencia, p_id_encontro,
    p_ocorrido_em, p_resumo, COALESCE(p_conteudo, '{}'::jsonb), app.id_usuario()
  ) RETURNING id_registro INTO v_id_registro;

  FOR v_artefato IN SELECT * FROM jsonb_array_elements(COALESCE(p_artefatos, '[]'::jsonb))
  LOOP
    INSERT INTO fat_artefato (id_contrato, escopo, id_referencia, tipo, url, descricao, id_usuario_anexou)
    VALUES (
      p_id_contrato, 'registro', v_id_registro,
      v_artefato ->> 'tipo', v_artefato ->> 'url', v_artefato ->> 'descricao', app.id_usuario()
    );
  END LOOP;

  FOR v_participante IN SELECT * FROM jsonb_array_elements(COALESCE(p_presentes, '[]'::jsonb))
  LOOP
    v_id_usuario := NULLIF(v_participante ->> 'id_usuario', '')::BIGINT;
    v_nome_livre := v_participante ->> 'nome_livre';
    v_origem     := v_participante ->> 'origem';

    IF v_id_usuario IS NOT NULL AND v_nome_livre IS NOT NULL THEN
      RAISE EXCEPTION 'Presente não pode ter id_usuario e nome_livre ao mesmo tempo';
    END IF;

    INSERT INTO rel_registro_participante (id_registro, id_usuario, nome_livre, origem)
    VALUES (v_id_registro, v_id_usuario, v_nome_livre, v_origem);
  END LOOP;

  RETURN v_id_registro;
END $$;

COMMENT ON FUNCTION app.criar_registro(BIGINT, BIGINT, TIMESTAMPTZ, JSONB, JSONB, JSONB, BIGINT, TEXT) IS
'FMC-15/FMC-16/FMC-17/FMC-18/FMC-21 (spec.md P1 Registro). Única forma sancionada de criar um registro com conteúdo, artefatos e presentes (AD-024): grava fat_registro (nr_sequencia = MAX+1 por contrato+tipo, sob FOR UPDATE), fat_artefato (escopo=registro) e rel_registro_participante na mesma transação -- rel_encontro_participante nunca é tocada (A-21). SECURITY INVOKER -- herda RLS/GRANT de quem chama.';
