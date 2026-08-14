-- =============================================================================
-- FND-CTR-05 (.specs/roadmap.md §4 Trilha E): fat_contrato.id_cargo_no_contrato/
-- id_partido_no_contrato nunca eram populados no insert -- o snapshot histórico
-- do cargo/partido no momento da contratação (docs/schema_sistema.sql:488-489,
-- "o número de impacto de 2024 mostra o cargo de 2024, não o atual") ficava
-- sempre NULL.
--
-- Fonte confirmada por leitura de código (nenhuma tabela nova): o único lugar
-- que guarda "cargo/partido vigente do mandato" hoje é
-- dim_mandato.id_cargo_atual/id_partido_atual -- não existe update desses dois
-- campos em lugar nenhum do código depois da criação do mandato (marcar
-- candidatura vigente, 0015_fn_marcar_vigente.sql, só mexe em
-- rel_mandato_candidatura.eh_mandato_vigente). Ler a candidatura TSE
-- diretamente seria reimplementar o que dim_mandato já resolve.
--
-- app.criar_mandato (único INSERT em fat_contrato feito por RPC, 0022) passa a
-- gravar o snapshot em cada um dos dois ramos que abrem contrato:
--   - mandato novo: usa o id_cargo_atual/id_partido_atual que acabou de ir para
--     dim_mandato (v_mandato, já populado pelo p_mandato do chamador);
--   - contrato novo para mandato já existente (p_id_contratante_existente):
--     lê id_cargo_atual/id_partido_atual de dim_mandato pelo id_contratante.
-- Contrato de coalizão (sem linha em dim_mandato) resolve para NULL nos dois
-- casos -- coerente com a coluna ser nullable e não fazer sentido pra coalizão.
--
-- O outro call-site (ContratoForm, insert direto via PostgREST, sem RPC --
-- design.md "sem RPC") ganha a mesma leitura de dim_mandato antes do insert,
-- em src/frontend/components/fundacao/contrato-form.tsx -- não precisa de
-- migração, é mudança só de TypeScript.
-- =============================================================================

DROP FUNCTION IF EXISTS app.criar_mandato(jsonb, jsonb, jsonb, boolean, jsonb, jsonb, bigint);

CREATE OR REPLACE FUNCTION app.criar_mandato(
  p_contratante        jsonb DEFAULT NULL,
  p_mandato            jsonb DEFAULT NULL,
  p_candidatura        jsonb DEFAULT NULL,
  p_ignorar_duplicata  boolean DEFAULT false,
  p_contrato           jsonb DEFAULT NULL,
  p_coalizao           jsonb DEFAULT NULL,
  p_id_contratante_existente bigint DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_nome                   TEXT;
  v_sg_uf                  TEXT;
  v_nm_municipio           TEXT;
  v_similares              jsonb;
  v_id_contratante         BIGINT;
  v_id_mandato             BIGINT;
  v_id_vinculo_tse         BIGINT;
  v_id_contrato            BIGINT;
  v_mandato                dim_mandato;
  -- FND-CTR-05: snapshot de cargo/partido pro insert de fat_contrato, resolvido
  -- por ramo abaixo (NULL para contratante de coalizão).
  v_id_cargo_no_contrato   BIGINT;
  v_id_partido_no_contrato BIGINT;
BEGIN
  IF p_id_contratante_existente IS NOT NULL THEN
    v_id_contratante := p_id_contratante_existente;
    SELECT id_mandato, id_cargo_atual, id_partido_atual
      INTO v_id_mandato, v_id_cargo_no_contrato, v_id_partido_no_contrato
      FROM dim_mandato WHERE id_contratante = v_id_contratante;
  ELSE
    v_nome := p_contratante ->> 'nome';
    v_sg_uf := p_contratante ->> 'sg_uf';
    v_nm_municipio := p_contratante ->> 'nm_municipio';

    IF NOT p_ignorar_duplicata THEN
      SELECT jsonb_agg(jsonb_build_object(
               'idContratante', s.id_contratante, 'nome', s.nome,
               'sgUf', s.sg_uf, 'nmMunicipio', s.nm_municipio
             ))
        INTO v_similares
        FROM app.contratante_similar(v_nome, v_sg_uf, v_nm_municipio) AS s;

      IF v_similares IS NOT NULL THEN
        RAISE EXCEPTION 'Contratante(s) similar(es) já cadastrado(s) para "%"', v_nome
          USING ERRCODE = 'MDU01', DETAIL = v_similares::text;
      END IF;
    END IF;

    INSERT INTO dim_contratante (tipo_contratante, nome, sg_uf, nm_municipio, id_partido_relacionado, localizador_legado)
    VALUES (
      'mandato', v_nome, v_sg_uf, v_nm_municipio,
      (p_contratante ->> 'id_partido_relacionado')::bigint,
      p_contratante ->> 'localizador_legado'
    )
    RETURNING id_contratante INTO v_id_contratante;

    SELECT * INTO v_mandato FROM jsonb_populate_record(null::dim_mandato, p_mandato);

    INSERT INTO dim_mandato (
      id_contratante, nr_titulo_eleitoral, nm_civil, nm_urna, nm_social, ds_genero,
      ds_identidade_genero, ds_orientacao_sexual, ds_raca, fl_pcd, id_partido_atual,
      id_cargo_atual, origem_partido_cargo, atualizado_partido_cargo_em,
      potencial_futuro, relevancia_politica, confianca, risco_democratico,
      espectro_politico, id_mandato_legado
    ) VALUES (
      v_id_contratante, v_mandato.nr_titulo_eleitoral, v_mandato.nm_civil, v_mandato.nm_urna,
      v_mandato.nm_social, v_mandato.ds_genero, v_mandato.ds_identidade_genero,
      v_mandato.ds_orientacao_sexual, v_mandato.ds_raca, v_mandato.fl_pcd,
      v_mandato.id_partido_atual, v_mandato.id_cargo_atual,
      CASE WHEN p_candidatura IS NULL THEN 'manual' ELSE 'tse' END,
      v_mandato.atualizado_partido_cargo_em, v_mandato.potencial_futuro,
      v_mandato.relevancia_politica, v_mandato.confianca, v_mandato.risco_democratico,
      v_mandato.espectro_politico, v_mandato.id_mandato_legado
    )
    RETURNING id_mandato INTO v_id_mandato;

    v_id_cargo_no_contrato := v_mandato.id_cargo_atual;
    v_id_partido_no_contrato := v_mandato.id_partido_atual;

    IF p_candidatura IS NOT NULL THEN
      INSERT INTO rel_mandato_candidatura (
        id_mandato, ano_eleicao, sq_candidato, nr_turno, metodo_match, confianca,
        status, id_usuario_validou, validado_em
      ) VALUES (
        v_id_mandato,
        (p_candidatura ->> 'ano_eleicao')::smallint,
        (p_candidatura ->> 'sq_candidato')::bigint,
        (p_candidatura ->> 'nr_turno')::smallint,
        p_candidatura ->> 'metodo_match',
        p_candidatura ->> 'confianca',
        'confirmado',
        app.id_usuario(),
        now()
      )
      RETURNING id_vinculo_tse INTO v_id_vinculo_tse;
    END IF;
  END IF;

  IF p_contrato IS NOT NULL THEN
    INSERT INTO fat_contrato (
      id_contratante, id_produto, id_projeto, id_contrato_anterior, dt_inicio, status,
      id_cargo_no_contrato, id_partido_no_contrato
    )
    VALUES (
      v_id_contratante,
      (p_contrato->>'id_produto')::bigint,
      (p_contrato->>'id_projeto')::bigint,
      (p_contrato->>'id_contrato_anterior')::bigint,
      (p_contrato->>'dt_inicio')::date,
      'ativo',
      v_id_cargo_no_contrato,
      v_id_partido_no_contrato
    ) RETURNING id_contrato INTO v_id_contrato;

    IF p_coalizao IS NOT NULL THEN
      INSERT INTO rel_coalizao_membro (id_coalizao, id_contrato, papel, nome_grupo)
      VALUES (
        (p_coalizao->>'id_coalizao')::bigint,
        v_id_contrato,
        p_coalizao->>'papel',
        p_coalizao->>'nome_grupo'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id_contratante', v_id_contratante,
    'id_mandato', v_id_mandato,
    'id_vinculo_tse', v_id_vinculo_tse,
    'id_contrato', v_id_contrato
  );
END;
$$;

COMMENT ON FUNCTION app.criar_mandato IS 'Criar mandato e opcionalmente atrelar um contrato e vínculo de coalizão na mesma transação. Suporta abrir novo contrato para mandato existente via p_id_contratante_existente. FND-CTR-05: popula fat_contrato.id_cargo_no_contrato/id_partido_no_contrato com o snapshot de dim_mandato.id_cargo_atual/id_partido_atual no momento da contratação (NULL para contratante de coalizão).';
