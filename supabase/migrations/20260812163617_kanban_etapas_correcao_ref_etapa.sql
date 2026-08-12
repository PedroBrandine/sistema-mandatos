-- =============================================================================
-- kanban-etapas: correção pós-UAT (achado por Pedro ao usar o board pela
-- primeira vez, 2026-08-12) -- ref_etapa tinha 4 linhas que não são etapas
-- reais do fluxo que um contrato "passa por" depois de existir:
--
--   - 'cadastro' (Estratégia e Coalizão, ordem 1): é o ato de cadastrar o
--     contrato no sistema, não uma etapa da régua -- a primeira etapa real
--     das duas é Pontapé.
--   - 'recrutamento'/'selecao' (PLL, ordem 1-2): processos externos ao
--     sistema (acontecem antes do contrato existir) -- a primeira etapa
--     real do PLL também é Pontapé.
--
-- Eram seedadas verbatim de docs/schema_sistema.sql:2222-2249 pela
-- catalogos-referencia (Trilha C, já concluída e validada) --
-- 20260810193327_catalogos_referencia_seed.sql +
-- 20260810193825_catalogos_referencia_seed_coalizao.sql. Correção de
-- CONTEÚDO do dado (4 linhas erradas + renumeração), não de ESTRUTURA de
-- schema -- AD-008 continua valendo (docs/schema_sistema.sql também
-- corrigido nesta sessão, mesma justificativa).
--
-- Dependências reais confirmadas antes desta migration (nenhuma decisão
-- às cegas):
--   - fat_contrato.id_etapa_atual: 0 linhas apontam pras 4 etapas erradas.
--   - ref_tipo_registro: 0 linhas dependem delas.
--   - fat_etapa_contrato: 18 linhas (cadastro=10, recrutamento=4,
--     selecao=4) -- nenhum dado real a preservar, é "progresso" de uma
--     etapa que nunca deveria existir.
--   - ref_formulario: 3 linhas dependem de recrutamento/selecao
--     ('Inscrição de Mentorados', 'Diagnóstico e Temáticas de Interesse',
--     'Inscrição de Mentores') -- decisão de Pedro: reatribuir pro
--     Pontapé do PLL em vez de apagar (preserva o catálogo de formulário
--     já seedado; rel_formulario_contrato não precisa de nenhuma
--     alteração, referencia id_formulario, não id_etapa).
-- =============================================================================

DO $$
DECLARE
  v_id_estrategia  BIGINT := (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia');
  v_id_coalizao    BIGINT := (SELECT id_produto FROM ref_produto WHERE nome = 'Coalizão');
  v_id_pll         BIGINT := (SELECT id_produto FROM ref_produto WHERE nome = 'PLL');
  v_id_pontape_pll BIGINT;
BEGIN
  v_id_pontape_pll := (SELECT id_etapa FROM ref_etapa WHERE id_produto = v_id_pll AND codigo = 'pontape');

  -- 1) Reatribui os 3 formulários de recrutamento/seleção pro Pontapé do PLL.
  UPDATE ref_formulario
     SET id_etapa = v_id_pontape_pll
   WHERE id_etapa IN (
     SELECT id_etapa FROM ref_etapa WHERE id_produto = v_id_pll AND codigo IN ('recrutamento', 'selecao')
   );

  -- 2) fat_etapa_contrato das 4 etapas erradas (cadastro x2, recrutamento,
  --    selecao) -- sem isso o DELETE do passo 3 falha por FK.
  DELETE FROM fat_etapa_contrato
   WHERE id_etapa IN (
     SELECT id_etapa FROM ref_etapa WHERE codigo IN ('cadastro', 'recrutamento', 'selecao')
   );

  -- 3) Remove as 4 etapas erradas do catálogo.
  DELETE FROM ref_etapa WHERE codigo IN ('cadastro', 'recrutamento', 'selecao');

  -- 4) Renumera o restante. Offset seguro (+100) antes do valor final
  --    explícito -- o Postgres não garante ordem de processamento de linha
  --    dentro de um único UPDATE, então decrementar direto (`ordem - 1`)
  --    arrisca colidir com uq_etapa_produto_ordem transitoriamente. Com o
  --    offset, nenhum valor "antigo" (>100) nunca coincide com um valor
  --    "novo" (1-6) durante a execução, então a ordem de processamento
  --    deixa de importar.
  UPDATE ref_etapa SET ordem = ordem + 100 WHERE id_produto IN (v_id_estrategia, v_id_coalizao, v_id_pll);

  UPDATE ref_etapa SET ordem = 1 WHERE id_produto IN (v_id_estrategia, v_id_coalizao) AND codigo = 'pontape';
  UPDATE ref_etapa SET ordem = 2 WHERE id_produto IN (v_id_estrategia, v_id_coalizao) AND codigo = 'raio_x';
  UPDATE ref_etapa SET ordem = 3 WHERE id_produto IN (v_id_estrategia, v_id_coalizao) AND codigo = 'imersao';
  UPDATE ref_etapa SET ordem = 4 WHERE id_produto IN (v_id_estrategia, v_id_coalizao) AND codigo = 'governanca';
  UPDATE ref_etapa SET ordem = 5 WHERE id_produto IN (v_id_estrategia, v_id_coalizao) AND codigo = 'monitoramento';
  UPDATE ref_etapa SET ordem = 6 WHERE id_produto IN (v_id_estrategia, v_id_coalizao) AND codigo = 'replicacao';

  UPDATE ref_etapa SET ordem = 1 WHERE id_produto = v_id_pll AND codigo = 'pontape';
  UPDATE ref_etapa SET ordem = 2 WHERE id_produto = v_id_pll AND codigo = 'imersao';
  UPDATE ref_etapa SET ordem = 3 WHERE id_produto = v_id_pll AND codigo = 'mentorias';
END $$;
