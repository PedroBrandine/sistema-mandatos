-- Bug achado em 24/09: app.excluir_contrato (21/09) é anterior a
-- fat_cadastro_participante (22/09), cujas FKs id_contrato/id_vinculo_tse
-- (NO ACTION) travavam a exclusão de qualquer contrato criado pelo vínculo
-- TSE do PLL -- tanto pela aba Mandatos quanto pela troca de vínculo
-- ("Editar vínculo" para outro parlamentar, decisão do Pedro em 24/09:
-- o contrato vinculado errado é excluído para não contar nos KPIs).
--
-- A linha de staging não é apagada: ela é a planilha importada, não um
-- dependente do contrato. Só perde o vínculo (id_contrato/id_vinculo_tse
-- NULL) e o trigger de status a devolve para "pendente de revisão".
--
-- Mesma assinatura; o resto do corpo é idêntico a
-- 20260921224737_fundacao_fn_excluir_contrato.sql.

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

  -- PLL (24/09): a linha de fat_cadastro_participante é a planilha importada,
  -- não pertence ao contrato -- fica, só volta a "não vinculada".
  UPDATE fat_cadastro_participante
     SET id_contrato = NULL, id_vinculo_tse = NULL
   WHERE id_contrato = p_id_contrato;

  -- Corrente de renovação: contratos posteriores apontam para este como
  -- "anterior" (FK NO ACTION). Quebra o elo, não apaga os posteriores.
  UPDATE fat_contrato SET id_contrato_anterior = NULL WHERE id_contrato_anterior = p_id_contrato;

  DELETE FROM fat_contrato WHERE id_contrato = p_id_contrato;
  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  IF v_linhas = 0 THEN
    RAISE EXCEPTION 'Contrato não encontrado ou sem permissão.' USING ERRCODE = '42501';
  END IF;

  IF (v_resumo->>'apaga_contratante')::boolean THEN
    -- Outra linha do PLL ainda apontando para um vínculo deste mandato
    -- (contrato de outro participante já apagado antes) também é solta.
    UPDATE fat_cadastro_participante
       SET id_vinculo_tse = NULL
     WHERE id_vinculo_tse IN (
       SELECT c.id_vinculo_tse FROM rel_mandato_candidatura c
         JOIN dim_mandato m ON m.id_mandato = c.id_mandato
        WHERE m.id_contratante = v_id_contratante
     );
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
'Exclusão DEFINITIVA de um contrato (mandato) e de tudo que depende dele, numa transação só; apaga também o cadastro da pessoa (contratante+mandato) quando ela ficaria órfã. Linhas do cadastro de participantes do PLL que apontavam para o contrato não são apagadas, só desvinculadas. Só admin/gestora (42501 para os demais). Devolve o mesmo resumo de app.resumo_exclusao_contrato. Auditoria via trg_audit_* em fat_contrato/dim_mandato/dim_contratante.';
