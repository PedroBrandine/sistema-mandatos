-- =============================================================================
-- formularios-produto: T8 -- app.trg_deriva_gip() (nova, análoga a
-- app.trg_extrai_metricas()) + trigger trg_submissao_gip.
--
-- SECURITY DEFINER SET search_path desde o primeiro commit (conforma AD-035
-- -- mesma classe de app.trg_extrai_metricas()/T4: recômputo determinístico
-- de coluna derivada, sem parâmetro de escrita livre do chamador, disparado
-- por papel que pode não ter GRANT amplo na tabela de destino).
--
-- Convive com trg_submissao_metricas (T4) sem conflito: para os outros 15
-- formulários, o id_formulario não bate com o do GIP e a função retorna
-- cedo; trg_extrai_metricas() roda pra todos, mas não encontra linha em
-- ref_metrica_formulario pro GIP (nunca cadastrada) e não escreve nada.
--
-- Contrato JSONB do GIP (design.md, "Data Models" -- não descoberto via
-- ref_metrica_formulario/schema_campos, que ficam vazios pra este
-- formulário; tela sob medida, T20 do lote de frontend):
--   { posicao_lideranca, rotina_trabalho, comunicacao_interna,
--     rotinas_feedback, gip_estrutura_organizada, gip_entregas_acontecendo,
--     dimensoes: { <ref_dimensao_gip.codigo>: 1..4, ... } }
-- =============================================================================

CREATE OR REPLACE FUNCTION app.trg_deriva_gip() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id_gip BIGINT; v_eixo TEXT; v_id_formulario_gip BIGINT;
BEGIN
  SELECT id_formulario INTO v_id_formulario_gip FROM ref_formulario WHERE codigo = 'gip';
  IF v_id_formulario_gip IS NULL OR NEW.id_formulario IS DISTINCT FROM v_id_formulario_gip THEN
    RETURN NULL;
  END IF;

  INSERT INTO fat_gip (id_contrato, momento, id_submissao, posicao_lideranca, rotina_trabalho,
                        comunicacao_interna, rotinas_feedback, gip_estrutura_organizada,
                        gip_entregas_acontecendo, aplicado_em)
  VALUES (NEW.id_contrato, NEW.momento, NEW.id_submissao,
          (NEW.respostas ->> 'posicao_lideranca')::BOOLEAN,
          NEW.respostas ->> 'rotina_trabalho',
          NEW.respostas ->> 'comunicacao_interna',
          NEW.respostas ->> 'rotinas_feedback',
          (NEW.respostas ->> 'gip_estrutura_organizada')::BOOLEAN,
          (NEW.respostas ->> 'gip_entregas_acontecendo')::BOOLEAN,
          CURRENT_DATE)
  ON CONFLICT (id_contrato, momento) DO UPDATE SET
    id_submissao = EXCLUDED.id_submissao,
    posicao_lideranca = EXCLUDED.posicao_lideranca,
    rotina_trabalho = EXCLUDED.rotina_trabalho,
    comunicacao_interna = EXCLUDED.comunicacao_interna,
    rotinas_feedback = EXCLUDED.rotinas_feedback,
    gip_estrutura_organizada = EXCLUDED.gip_estrutura_organizada,
    gip_entregas_acontecendo = EXCLUDED.gip_entregas_acontecendo
  RETURNING id_gip INTO v_id_gip;

  v_eixo := CASE WHEN NEW.momento = 'inicio' THEN 'regua_sonhos' ELSE 'onde_chegamos' END;

  DELETE FROM fat_gip_dimensao WHERE id_gip = v_id_gip AND eixo = v_eixo;
  INSERT INTO fat_gip_dimensao (id_gip, id_dimensao, eixo, valor)
  SELECT v_id_gip, d.id_dimensao, v_eixo, (NEW.respostas -> 'dimensoes' ->> d.codigo)::SMALLINT
    FROM ref_dimensao_gip d
   WHERE d.ativo AND NEW.respostas -> 'dimensoes' ? d.codigo;

  RETURN NULL;
END $$;

COMMENT ON FUNCTION app.trg_deriva_gip() IS
'Deriva fat_gip/fat_gip_dimensao a partir de uma submissão do formulário GIP. O JSONB de fat_submissao.respostas continua sendo a verdade da resposta; estas 2 tabelas são a superfície estruturada (quadrante, evolução por dimensão). SECURITY DEFINER (AD-035): quem submete o GIP pode não ter GRANT em fat_gip/fat_gip_dimensao (só Gestora/Admin têm, T7) -- mesmo raciocínio de app.trg_extrai_metricas().';

CREATE TRIGGER trg_submissao_gip
  AFTER INSERT OR UPDATE OF respostas ON fat_submissao
  FOR EACH ROW EXECUTE FUNCTION app.trg_deriva_gip();
