-- =============================================================================
-- fundacao: app.resumo_exclusao_contrato + app.excluir_contrato
--
-- Exclusão DEFINITIVA de um mandato (contrato) pela aba Mandatos do produto,
-- pedida por Pedro (2026-09-21): apaga do banco o contrato e tudo que pendura
-- nele, e o cadastro da pessoa (dim_contratante + dim_mandato) quando ela
-- ficaria órfã. Não há "lixeira": o que sai daqui não volta.
--
-- Por que uma função e não DELETEs soltos do frontend: nenhuma FK para
-- fat_contrato tem ON DELETE CASCADE (são 16 dependentes, quase todos RESTRICT),
-- então a ordem folha->raiz precisa acontecer numa única transação, ou uma
-- falha no meio deixa o mandato pela metade. Mapa de FKs levantado em
-- pg_constraint no dev em 2026-09-21 (não pelas migrations).
--
-- SECURITY INVOKER (AD-024), como app.mover_etapa_kanban: RLS + GRANT continuam
-- sendo a fronteira real. As policies p_por_carteira/p_por_contrato liberam
-- Admin e Gestora em todos os contratos, e é isso que esta função exige em
-- cima (papel_atual IN ('admin','gestora')) -- Mentor/Assessor recebem 42501
-- mesmo tendo acesso de leitura ao contrato.
--
-- Rede de segurança contra RLS silencioso: DELETE que a policy filtra apaga 0
-- linhas SEM erro. O DELETE final de fat_contrato só passa se todos os
-- dependentes realmente saíram (FK RESTRICT), e a função confere ROW_COUNT dele
-- -- qualquer coisa que a RLS tenha barrado no meio derruba a transação
-- inteira, nunca deixa exclusão parcial.
--
-- Auditoria: trg_audit_fat_contrato / trg_audit_dim_mandato /
-- trg_audit_dim_contratante já gravam o DELETE em log_auditoria com
-- valor_anterior (quem apagou, quando e o que era).
--
-- O cadastro da pessoa (dim_contratante + dim_mandato) só é apagado quando:
--   * é tipo 'mandato' (contratante de coalizão nunca é apagado aqui);
--   * não sobra nenhum outro contrato dela (em qualquer produto);
--   * não sobra nenhuma prospecção dela (a prospecção que GEROU este contrato é
--     apagada junto -- é histórico dele --, mas outra, aberta, segura o cadastro);
--   * ela não é dona de uma dim_coalizao.
-- Sem essa regra, o nr_titulo_eleitoral UNIQUE de dim_mandato travaria o
-- recadastro da mesma pessoa em Novo Contrato.
-- =============================================================================

CREATE OR REPLACE FUNCTION app.resumo_exclusao_contrato(p_id_contrato bigint)
RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
DECLARE
  v_papel           TEXT := app.papel_atual();
  v_id_contratante  BIGINT;
  v_nome            TEXT;
  v_tipo            TEXT;
  v_apaga           BOOLEAN;
BEGIN
  -- papel NULL (anon/sem perfil) não pode cair em `NOT IN` -- NULL NOT IN (...)
  -- é NULL, o IF não dispararia e a função liberaria a exclusão.
  IF v_papel IS NULL OR v_papel NOT IN ('admin', 'gestora') THEN
    RAISE EXCEPTION 'Você não tem permissão para realizar esta operação.' USING ERRCODE = '42501';
  END IF;

  SELECT c.id_contratante, ct.nome, ct.tipo_contratante
    INTO v_id_contratante, v_nome, v_tipo
    FROM fat_contrato c
    JOIN dim_contratante ct ON ct.id_contratante = c.id_contratante
   WHERE c.id_contrato = p_id_contrato;

  -- Não existe OU a RLS filtrou -- nunca revelar qual dos dois.
  IF v_id_contratante IS NULL THEN
    RAISE EXCEPTION 'Contrato não encontrado ou sem permissão.' USING ERRCODE = '42501';
  END IF;

  v_apaga := v_tipo = 'mandato'
    AND NOT EXISTS (SELECT 1 FROM fat_contrato
                     WHERE id_contratante = v_id_contratante AND id_contrato <> p_id_contrato)
    AND NOT EXISTS (SELECT 1 FROM fat_prospeccao
                     WHERE id_contratante = v_id_contratante
                       AND id_contrato_gerado IS DISTINCT FROM p_id_contrato)
    AND NOT EXISTS (SELECT 1 FROM dim_coalizao WHERE id_contratante = v_id_contratante);

  RETURN jsonb_build_object(
    'id_contrato',       p_id_contrato,
    'nome_contratante',  v_nome,
    'tipo_contratante',  v_tipo,
    'apaga_contratante', v_apaga,
    -- Contagens de cada dependente, inclusive as de 2º nível (objetivos, metas,
    -- sucessos mensais, respostas): consentimento dado sobre lista incompleta
    -- não vale.
    'contagens', jsonb_build_object(
      'planejamento',     (SELECT count(*) FROM dim_planejamento WHERE id_contrato = p_id_contrato),
      'objetivos',        (SELECT count(*) FROM fat_objetivo_especifico o
                             JOIN dim_planejamento p ON p.id_planejamento = o.id_planejamento
                            WHERE p.id_contrato = p_id_contrato),
      'metas',            (SELECT count(*) FROM fat_meta m
                             JOIN fat_objetivo_especifico o ON o.id_objetivo = m.id_objetivo
                             JOIN dim_planejamento p ON p.id_planejamento = o.id_planejamento
                            WHERE p.id_contrato = p_id_contrato),
      'sucessos_mensais', (SELECT count(*) FROM fat_sucesso_mensal s
                             JOIN fat_meta m ON m.id_meta = s.id_meta
                             JOIN fat_objetivo_especifico o ON o.id_objetivo = m.id_objetivo
                             JOIN dim_planejamento p ON p.id_planejamento = o.id_planejamento
                            WHERE p.id_contrato = p_id_contrato),
      'encontros',        (SELECT count(*) FROM fat_encontro WHERE id_contrato = p_id_contrato),
      'registros',        (SELECT count(*) FROM fat_registro WHERE id_contrato = p_id_contrato),
      'insights',         (SELECT count(*) FROM fat_insight WHERE id_contrato = p_id_contrato),
      'pre_insights',     (SELECT count(*) FROM fat_pre_insight WHERE id_contrato = p_id_contrato),
      'fatos_geradores',  (SELECT count(*) FROM fat_fato_gerador WHERE id_contrato = p_id_contrato),
      'submissoes',       (SELECT count(*) FROM fat_submissao WHERE id_contrato = p_id_contrato),
      'respostas',        (SELECT count(*) FROM fat_resposta_metrica r
                             JOIN fat_submissao s ON s.id_submissao = r.id_submissao
                            WHERE s.id_contrato = p_id_contrato),
      'gips',             (SELECT count(*) FROM fat_gip WHERE id_contrato = p_id_contrato),
      'artefatos',        (SELECT count(*) FROM fat_artefato WHERE id_contrato = p_id_contrato),
      'etapas',           (SELECT count(*) FROM fat_etapa_contrato WHERE id_contrato = p_id_contrato),
      'convites',         (SELECT count(*) FROM convite_contrato WHERE id_contrato = p_id_contrato),
      'vinculos_usuarios',(SELECT count(*) FROM rel_usuario_contrato WHERE id_contrato = p_id_contrato),
      'formularios',      (SELECT count(*) FROM rel_formulario_contrato WHERE id_contrato = p_id_contrato),
      'membros_coalizao', (SELECT count(*) FROM rel_coalizao_membro WHERE id_contrato = p_id_contrato),
      'prospeccao_origem',(SELECT count(*) FROM fat_prospeccao WHERE id_contrato_gerado = p_id_contrato)
    )
  );
END;
$$;

COMMENT ON FUNCTION app.resumo_exclusao_contrato(bigint) IS
'Quanto de cada dependente será apagado por app.excluir_contrato, e se o cadastro da pessoa (contratante+mandato) sai junto. Somente leitura, mesma permissão da exclusão (admin/gestora). A tela mostra isto ANTES de pedir confirmação.';

CREATE OR REPLACE FUNCTION app.excluir_contrato(p_id_contrato bigint)
RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_resumo          JSONB;
  v_id_contratante  BIGINT;
  v_linhas          INT;
BEGIN
  -- Valida permissão e existência (levanta 42501) e devolve o que vai sair.
  v_resumo := app.resumo_exclusao_contrato(p_id_contrato);

  SELECT id_contratante INTO v_id_contratante FROM fat_contrato WHERE id_contrato = p_id_contrato;

  -- Ordem folha -> raiz. Os dependentes de 2º nível saem por CASCADE:
  -- fat_gip_dimensao, fat_resposta_metrica, rel_fato_origem, rel_insight_origem,
  -- rel_registro_participante, rel_encontro_participante e a árvore
  -- dim_planejamento -> objetivo -> meta -> sucesso mensal (+ preditores).

  -- fat_gip.id_submissao é NO ACTION: o GIP sai antes da submissão.
  DELETE FROM fat_gip        WHERE id_contrato = p_id_contrato;
  DELETE FROM fat_submissao  WHERE id_contrato = p_id_contrato;

  DELETE FROM fat_fato_gerador WHERE id_contrato = p_id_contrato;
  DELETE FROM fat_insight      WHERE id_contrato = p_id_contrato;
  DELETE FROM fat_pre_insight  WHERE id_contrato = p_id_contrato;
  -- fat_registro.id_encontro é NO ACTION: registros saem antes dos encontros.
  DELETE FROM fat_registro     WHERE id_contrato = p_id_contrato;
  DELETE FROM fat_encontro     WHERE id_contrato = p_id_contrato;

  DELETE FROM dim_planejamento WHERE id_contrato = p_id_contrato;

  DELETE FROM fat_artefato            WHERE id_contrato = p_id_contrato;
  DELETE FROM fat_etapa_contrato      WHERE id_contrato = p_id_contrato;
  DELETE FROM convite_contrato        WHERE id_contrato = p_id_contrato;
  DELETE FROM rel_usuario_contrato    WHERE id_contrato = p_id_contrato;
  DELETE FROM rel_coalizao_membro     WHERE id_contrato = p_id_contrato;
  DELETE FROM rel_formulario_contrato WHERE id_contrato = p_id_contrato;

  -- A prospecção que gerou este contrato é histórico dele; sai junto.
  DELETE FROM fat_prospeccao WHERE id_contrato_gerado = p_id_contrato;

  -- Corrente de renovação: contratos posteriores apontam para este como
  -- "anterior" (FK NO ACTION). Quebra o elo, não apaga os posteriores.
  UPDATE fat_contrato SET id_contrato_anterior = NULL WHERE id_contrato_anterior = p_id_contrato;

  DELETE FROM fat_contrato WHERE id_contrato = p_id_contrato;
  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  IF v_linhas = 0 THEN
    RAISE EXCEPTION 'Contrato não encontrado ou sem permissão.' USING ERRCODE = '42501';
  END IF;

  IF (v_resumo->>'apaga_contratante')::boolean THEN
    -- Vínculo com o espelho TSE é só o link (a tabela tse.* não é tocada).
    DELETE FROM rel_mandato_candidatura
     WHERE id_mandato IN (SELECT id_mandato FROM dim_mandato WHERE id_contratante = v_id_contratante);
    -- rel_mandato_agenda_tematica sai por CASCADE.
    DELETE FROM dim_mandato     WHERE id_contratante = v_id_contratante;
    DELETE FROM dim_contratante WHERE id_contratante = v_id_contratante;
  END IF;

  RETURN v_resumo;
END;
$$;

COMMENT ON FUNCTION app.excluir_contrato(bigint) IS
'Exclusão DEFINITIVA de um contrato (mandato) e de tudo que depende dele, numa transação só; apaga também o cadastro da pessoa (contratante+mandato) quando ela ficaria órfã. Só admin/gestora (42501 para os demais). Devolve o mesmo resumo de app.resumo_exclusao_contrato. Auditoria via trg_audit_* em fat_contrato/dim_mandato/dim_contratante.';

-- Nada de GRANT: funções de app seguem o EXECUTE padrão (0004), e a permissão
-- real está no corpo (papel_atual) + RLS, como app.mover_etapa_kanban.
