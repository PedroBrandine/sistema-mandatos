-- =============================================================================
-- formularios-produto: T9 (2º achado real, descoberto rodando o teste de
-- integração desta task) -- app.trg_deriva_gip() (T8) só copiava
-- regua_sonhos pra dentro de um momento meio/fim NO INSTANTE em que ele
-- era derivado. Reeditar o GIP início DEPOIS que meio/fim já existem
-- (permitido -- nenhuma ordem é imposta, ver spec.md Assumptions) deixava a
-- cópia de regua_sonhos de meio/fim desatualizada, e vw_gip_evolucao
-- continuava mostrando o valor antigo (gap incorreto).
--
-- Fix: ao derivar momento='inicio', também repropaga os valores atuais de
-- regua_sonhos pra qualquer fat_gip de meio/fim já existente no mesmo
-- contrato -- sincronização nas 2 direções (meio/fim puxa do início ao
-- nascer; início empurra pra meio/fim já existentes ao ser reeditado).
-- =============================================================================

CREATE OR REPLACE FUNCTION app.trg_deriva_gip() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_id_gip BIGINT;
  v_eixo TEXT;
  v_id_formulario_gip BIGINT;
  v_id_gip_inicio BIGINT;
  v_id_gip_destino BIGINT;
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

  IF NEW.momento IN ('meio','fim') THEN
    -- Puxa a régua_sonhos do início pra dentro desta linha (nasce sincronizado).
    SELECT g.id_gip INTO v_id_gip_inicio
      FROM fat_gip g WHERE g.id_contrato = NEW.id_contrato AND g.momento = 'inicio';
    IF v_id_gip_inicio IS NOT NULL THEN
      DELETE FROM fat_gip_dimensao WHERE id_gip = v_id_gip AND eixo = 'regua_sonhos';
      INSERT INTO fat_gip_dimensao (id_gip, id_dimensao, eixo, valor)
      SELECT v_id_gip, r.id_dimensao, 'regua_sonhos', r.valor
        FROM fat_gip_dimensao r
       WHERE r.id_gip = v_id_gip_inicio AND r.eixo = 'regua_sonhos';
    END IF;
  ELSE
    -- momento='inicio' (re)editado: empurra a régua_sonhos nova pra
    -- qualquer meio/fim que já exista no mesmo contrato, senão a cópia
    -- deles fica desatualizada até o próximo envio deles.
    FOR v_id_gip_destino IN
      SELECT g2.id_gip FROM fat_gip g2
       WHERE g2.id_contrato = NEW.id_contrato AND g2.momento IN ('meio','fim')
    LOOP
      DELETE FROM fat_gip_dimensao WHERE id_gip = v_id_gip_destino AND eixo = 'regua_sonhos';
      INSERT INTO fat_gip_dimensao (id_gip, id_dimensao, eixo, valor)
      SELECT v_id_gip_destino, r.id_dimensao, 'regua_sonhos', r.valor
        FROM fat_gip_dimensao r
       WHERE r.id_gip = v_id_gip AND r.eixo = 'regua_sonhos';
    END LOOP;
  END IF;

  RETURN NULL;
END $$;
