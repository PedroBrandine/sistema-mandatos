-- =============================================================================
-- formularios-produto: T9 -- vw_gip_evolucao (verbatim
-- docs/schema_sistema.sql:1359-1379) + fix em app.trg_deriva_gip() (T8).
--
-- ACHADO REAL (descoberto escrevendo o teste desta task, não por leitura de
-- código): a view aprovada faz o JOIN de regua_sonhos/onde_chegamos POR
-- id_gip (1 linha de fat_gip = 1 momento) via CROSS JOIN ref_dimensao_gip +
-- 2 LEFT JOIN em fat_gip_dimensao. Como o trigger de T8 grava cada eixo só
-- na linha do SEU PRÓPRIO momento (inicio -> regua_sonhos; meio/fim ->
-- onde_chegamos), uma linha de "meio" nunca tinha o valor de regua_sonhos
-- ao seu lado -- gap/situacao saíam sempre NULL, o que contradiz spec.md
-- P2 AC5 ("quando os 2 eixos existem, vw_gip_evolucao expõe... o gap
-- calculado") e o próprio comentário D6 do schema aprovado ("a distância
-- entre os eixos É a medida").
--
-- Migrations são forward-only (CLAUDE.md) -- T8 não foi editada. Este
-- CREATE OR REPLACE acrescenta: ao derivar meio/fim, copia os valores de
-- regua_sonhos da linha de "inicio" do mesmo contrato pra dentro da linha
-- de fat_gip_dimensao do momento atual (mesmo id_gip que já recebeu
-- onde_chegamos) -- assim a view, que junta por id_gip, encontra os 2 eixos
-- na mesma linha. A view em si continua 100% verbatim do schema aprovado,
-- nenhuma coluna redesenhada -- só o trigger que a alimenta ficou mais
-- completo.
-- =============================================================================

CREATE OR REPLACE FUNCTION app.trg_deriva_gip() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id_gip BIGINT; v_eixo TEXT; v_id_formulario_gip BIGINT; v_id_gip_inicio BIGINT;
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

  -- D6: meio/fim carregam a régua_sonhos (aspiração pactuada no início) na
  -- MESMA linha de fat_gip -- vw_gip_evolucao junta por id_gip, não por
  -- contrato, então sem isso o gap nunca aparece numa linha de meio/fim.
  IF NEW.momento IN ('meio','fim') THEN
    SELECT g.id_gip INTO v_id_gip_inicio
      FROM fat_gip g WHERE g.id_contrato = NEW.id_contrato AND g.momento = 'inicio';
    IF v_id_gip_inicio IS NOT NULL THEN
      DELETE FROM fat_gip_dimensao WHERE id_gip = v_id_gip AND eixo = 'regua_sonhos';
      INSERT INTO fat_gip_dimensao (id_gip, id_dimensao, eixo, valor)
      SELECT v_id_gip, r.id_dimensao, 'regua_sonhos', r.valor
        FROM fat_gip_dimensao r
       WHERE r.id_gip = v_id_gip_inicio AND r.eixo = 'regua_sonhos';
    END IF;
  END IF;

  RETURN NULL;
END $$;

-- --- Leitura -----------------------------------------------------------------

CREATE VIEW vw_gip_evolucao WITH (security_invoker = true) AS
SELECT g.id_contrato,
       g.momento,
       g.aplicado_em,
       d.codigo                AS dimensao,
       d.nome                  AS nome_dimensao,
       d.ordem,
       r.valor                 AS regua_sonhos,
       o.valor                 AS onde_chegamos,
       o.valor - r.valor       AS gap,
       CASE WHEN r.valor IS NULL OR o.valor IS NULL THEN NULL
            WHEN o.valor >= r.valor THEN 'atingiu'
            WHEN o.valor >= r.valor - 1 THEN 'proximo'
            ELSE 'distante'
       END                     AS situacao,
       g.quadrante
FROM fat_gip g
CROSS JOIN ref_dimensao_gip d
LEFT JOIN fat_gip_dimensao r ON r.id_gip = g.id_gip AND r.id_dimensao = d.id_dimensao AND r.eixo = 'regua_sonhos'
LEFT JOIN fat_gip_dimensao o ON o.id_gip = g.id_gip AND o.id_dimensao = d.id_dimensao AND o.eixo = 'onde_chegamos'
WHERE d.ativo;
