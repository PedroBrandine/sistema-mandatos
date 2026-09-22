-- =============================================================================
-- Cria 2 contratos de Estratégia HISTÓRICOS (já concluídos) para Tabata
-- Amaral, vinculados ao projeto GAIA (id_projeto=27), para testar o filtro
-- de intervalo de data do Dashboard (20260922141917_estrategia_kpi_intervalo_data)
-- contra um mandatário com mais de um contrato no mesmo produto.
--
-- Contrato A: jan/2025, ciclo de 4 meses (dt_fim em maio/2025).
-- Contrato B: dez/2025, ciclo de 5 meses (dt_fim em abril/2026).
-- Ambos concluídos com sucesso (status='concluido', atingimento > 70%: todos
-- os sucessos mensais fecham como 'realizado'). Sem agenda/encontros -- só
-- planejamento estratégico + Fatos Geradores/Insights, com datas de FG e de
-- Insight dentro da janela de vigência de cada contrato (inclusive o FG
-- projetado de cada um).
--
-- NÃO É MIGRATION: só mexe em dados. Roda com
-- `supabase db query --linked --file scripts/seed/05_tabata_contratos_historicos_gaia.sql`
-- contra DEV. Produção não recebe seed.
-- =============================================================================

BEGIN;

CREATE FUNCTION pg_temp.gera_4_sucessos_realizados(
  p_id_meta bigint,
  p_descricao text,
  p_mes_inicio date,
  p_usuario bigint
) RETURNS void AS $$
DECLARE
  v_mes date := p_mes_inicio;
  v_idx int;
  v_dt_limite date;
BEGIN
  FOR v_idx IN 1..4 LOOP
    v_dt_limite := v_mes + 24; -- dia 25 do mês de referência
    INSERT INTO fat_sucesso_mensal
      (id_meta, descricao, mes_referencia, dt_limite, peso, pct_atingimento, status, atualizado_por, atualizado_em, id_usuario_responsavel)
    VALUES (
      p_id_meta, p_descricao, v_mes, v_dt_limite, 25.00, 78 + (v_idx * 4), 'realizado',
      p_usuario, (v_dt_limite - 1)::timestamptz, p_usuario
    );
    v_mes := (v_mes + interval '1 month')::date;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  v_id_usuario bigint;
  v_id_contrato bigint;
  v_id_planejamento bigint;
  v_id_objetivo bigint;
  v_id_meta_a bigint;
  v_id_meta_b bigint;
  v_id_meta_c bigint;
  v_id_meta_d bigint;
  v_id_insight bigint;
  v_id_fato bigint;
BEGIN
  SELECT id_usuario INTO v_id_usuario FROM dim_usuario WHERE email = 'conhecimento@legislabrasil.org';
  IF v_id_usuario IS NULL THEN
    RAISE EXCEPTION 'Pré-requisito ausente: usuário conhecimento@legislabrasil.org';
  END IF;

  -- ===========================================================================
  -- CONTRATO A — jan/2025 a mai/2025 (GAIA): diagnóstico e agenda legislativa
  -- de Ciência, Tecnologia e Inovação.
  -- ===========================================================================
  INSERT INTO fat_contrato (id_contratante, id_produto, id_projeto, dt_inicio, dt_fim_prevista, dt_fim, id_cargo_no_contrato, id_partido_no_contrato, status, motivo_encerramento)
  VALUES (4326, 1, 27, '2025-01-13', '2025-05-30', '2025-05-30', 6, 59, 'concluido', 'Ciclo de curto prazo do Projeto GAIA concluído conforme escopo previsto; mandato seguiu para o ciclo padrão de Estratégia.')
  RETURNING id_contrato INTO v_id_contrato;

  SELECT id_planejamento INTO v_id_planejamento FROM dim_planejamento WHERE id_contrato = v_id_contrato;

  INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato, cargo)
  VALUES (v_id_contrato, v_id_usuario, 'gestora', 'nao_se_aplica');

  UPDATE dim_planejamento SET
    id_perfil_atuacao = 6, -- Legisladora
    objetivo_ano = 'Consolidar diagnóstico legislativo de Ciência, Tecnologia e Inovação e protocolar agenda de fomento a startups de impacto social dentro do ciclo GAIA.',
    legado = 'Deixar mapeado o ecossistema legislativo de inovação do mandato, com agenda propositiva pronta para os ciclos seguintes.',
    analise_conjuntura = 'Início de legislatura com pauta de inovação ainda pouco disputada, janela favorável para posicionamento pioneiro antes que outras lideranças ocupem o tema.'
  WHERE id_contrato = v_id_contrato;

  INSERT INTO fat_objetivo_especifico (id_planejamento, ordem, descricao, id_preditor_primario, id_agenda, status)
  VALUES (v_id_planejamento, 1, 'Consolidar diagnóstico legislativo de Ciência, Tecnologia e Inovação para orientar o ciclo GAIA', 7, 80, 'ativo')
  RETURNING id_objetivo INTO v_id_objetivo;

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 1, 'Mapear projetos de lei de Ciência, Tecnologia e Inovação em tramitação relevantes ao mandato', 'alta', 'governanca', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta_a;
  PERFORM pg_temp.gera_4_sucessos_realizados(v_id_meta_a, 'Mapeamento mensal de PLs de C&T em tramitação', '2025-01-01', v_id_usuario);

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 2, 'Reunir-se mensalmente com especialistas do ecossistema de inovação', 'media', 'programatica', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta_b;
  PERFORM pg_temp.gera_4_sucessos_realizados(v_id_meta_b, 'Reunião mensal com especialistas do ecossistema de inovação', '2025-01-01', v_id_usuario);

  INSERT INTO fat_objetivo_especifico (id_planejamento, ordem, descricao, id_preditor_primario, id_agenda, status)
  VALUES (v_id_planejamento, 2, 'Protocolar agenda legislativa de fomento a startups de impacto social', 8, 80, 'ativo')
  RETURNING id_objetivo INTO v_id_objetivo;

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 1, 'Protocolar projeto de lei de fomento a startups de impacto social', 'alta', 'governanca', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta_c;
  PERFORM pg_temp.gera_4_sucessos_realizados(v_id_meta_c, 'Avanço mensal da redação e protocolo do PL de fomento a startups de impacto social', '2025-01-01', v_id_usuario);

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 2, 'Construir coalizão de apoio com pelo menos 8 parlamentares da bancada de inovação', 'media', 'programatica', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta_d;
  PERFORM pg_temp.gera_4_sucessos_realizados(v_id_meta_d, 'Rodada mensal de conversas com a bancada de inovação', '2025-01-01', v_id_usuario);

  PERFORM app.recalcula_atingimento(v_id_planejamento);

  -- Régua: contrato curto, chegou até o Monitoramento e encerrou (não houve Replicação).
  UPDATE fat_etapa_contrato SET status = 'concluida', dt_inicio = '2025-01-13', dt_conclusao = '2025-01-20'
   WHERE id_contrato = v_id_contrato AND id_etapa = 12; -- Pontapé
  UPDATE fat_etapa_contrato SET status = 'concluida', dt_inicio = '2025-01-21', dt_conclusao = '2025-02-10'
   WHERE id_contrato = v_id_contrato AND id_etapa = 13; -- Diagnóstico
  UPDATE fat_etapa_contrato SET status = 'concluida', dt_inicio = '2025-02-11', dt_conclusao = '2025-02-28'
   WHERE id_contrato = v_id_contrato AND id_etapa = 14; -- Imersão
  UPDATE fat_etapa_contrato SET status = 'concluida', dt_inicio = '2025-03-01', dt_conclusao = '2025-03-25'
   WHERE id_contrato = v_id_contrato AND id_etapa = 15; -- Governança
  UPDATE fat_etapa_contrato SET status = 'concluida', dt_inicio = '2025-03-26', dt_conclusao = '2025-05-30'
   WHERE id_contrato = v_id_contrato AND id_etapa = 16; -- Monitoramento
  UPDATE fat_etapa_contrato SET status = 'dispensada'
   WHERE id_contrato = v_id_contrato AND id_etapa = 17; -- Replicação
  UPDATE fat_contrato SET id_etapa_atual = 16 WHERE id_contrato = v_id_contrato;

  -- Insight + Fatos Geradores (3 realizados + 1 projetado), datados dentro de jan-mai/2025.
  INSERT INTO fat_insight (id_contrato, id_pilar, conteudo, desdobramentos, ocorrido_em, id_usuario_autor)
  VALUES (v_id_contrato, 8, 'A bancada de inovação demonstrou adesão inédita ao tema logo nas primeiras conversas, superando a expectativa inicial de apoio.', 'Acelera a meta de coalizão: possível ultrapassar os 8 parlamentares previstos ainda no primeiro trimestre.', '2025-03-05', v_id_usuario)
  RETURNING id_insight INTO v_id_insight;
  INSERT INTO rel_insight_origem (id_insight, id_meta) VALUES (v_id_insight, v_id_meta_d);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (v_id_contrato, 108, 'Diagnóstico legislativo de C&T concluído', 'baixo', 'baixo', 'baixo', 7, 3, 'Mapeamento completo dos PLs de Ciência, Tecnologia e Inovação em tramitação relevantes ao mandato.', 'realizado', '2025-01-20', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (v_id_contrato, 112, 'PL de fomento a startups de impacto social protocolado', 'baixo', 'baixo', 'baixo', 7, 8, 3, 'Projeto de lei protocolado criando linha de fomento a startups de impacto social.', 'realizado', '2025-02-18', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_meta) VALUES (v_id_fato, v_id_meta_c);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (v_id_contrato, 135, 'Adesão inédita da bancada de inovação à coalizão de apoio', 'medio', 'alto', 'baixo', 9, 11, 4, 'Bancada de inovação sinaliza apoio acima do esperado já na primeira rodada de conversas.', 'realizado', '2025-03-05', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_insight) VALUES (v_id_fato, v_id_insight);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_prevista, id_usuario_autor)
  VALUES (v_id_contrato, 113, 'PL de fomento a startups de impacto social entra em tramitação', 'baixo', 'medio', 'medio', 11, 8, 3, 'Pauta prevista para a Comissão de Ciência e Tecnologia até o fim do ciclo GAIA.', 'projetado', '2025-05-20', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_meta) VALUES (v_id_fato, v_id_meta_c);

  -- ===========================================================================
  -- CONTRATO B — dez/2025 a abr/2026 (GAIA): fiscalização e articulação de
  -- conectividade escolar.
  -- ===========================================================================
  INSERT INTO fat_contrato (id_contratante, id_produto, id_projeto, dt_inicio, dt_fim_prevista, dt_fim, id_cargo_no_contrato, id_partido_no_contrato, status, motivo_encerramento)
  VALUES (4326, 1, 27, '2025-12-08', '2026-04-20', '2026-04-20', 6, 59, 'concluido', 'Ciclo intermediário do Projeto GAIA concluído conforme escopo previsto; mandato seguiu para o contrato de Estratégia vigente em setembro de 2026.')
  RETURNING id_contrato INTO v_id_contrato;

  SELECT id_planejamento INTO v_id_planejamento FROM dim_planejamento WHERE id_contrato = v_id_contrato;

  INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato, cargo)
  VALUES (v_id_contrato, v_id_usuario, 'gestora', 'nao_se_aplica');

  UPDATE dim_planejamento SET
    id_perfil_atuacao = 5, -- Fiscalizadora
    objetivo_ano = 'Fiscalizar a execução do programa federal de conectividade escolar e consolidar rede de prefeituras parceiras dentro do ciclo GAIA.',
    legado = 'Deixar uma rede de prefeituras engajadas na conectividade escolar e um balanço público dos resultados do programa.',
    analise_conjuntura = 'Programa federal de conectividade escolar em fase de expansão, com prefeituras disputando adesão antecipada; janela de visibilidade antes da consolidação nacional do programa.'
  WHERE id_contrato = v_id_contrato;

  INSERT INTO fat_objetivo_especifico (id_planejamento, ordem, descricao, id_preditor_primario, id_agenda, status)
  VALUES (v_id_planejamento, 1, 'Fiscalizar a execução de investimentos federais em conectividade escolar', 8, 63, 'ativo')
  RETURNING id_objetivo INTO v_id_objetivo;

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 1, 'Protocolar requerimentos trimestrais sobre execução do programa de conectividade escolar', 'alta', 'governanca', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta_a;
  PERFORM pg_temp.gera_4_sucessos_realizados(v_id_meta_a, 'Acompanhamento mensal da execução do programa de conectividade escolar', '2025-12-01', v_id_usuario);

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 2, 'Visitar mensalmente escolas piloto do programa de conectividade', 'media', 'programatica', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta_b;
  PERFORM pg_temp.gera_4_sucessos_realizados(v_id_meta_b, 'Visita mensal a escola piloto do programa de conectividade', '2025-12-01', v_id_usuario);

  INSERT INTO fat_objetivo_especifico (id_planejamento, ordem, descricao, id_preditor_primario, id_agenda, status)
  VALUES (v_id_planejamento, 2, 'Consolidar rede de prefeituras parceiras do programa de conectividade escolar', 9, 63, 'ativo')
  RETURNING id_objetivo INTO v_id_objetivo;

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 1, 'Formalizar parceria com pelo menos 10 prefeituras para expansão do programa', 'alta', 'governanca', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta_c;
  PERFORM pg_temp.gera_4_sucessos_realizados(v_id_meta_c, 'Avanço mensal da formalização de parcerias com prefeituras', '2025-12-01', v_id_usuario);

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 2, 'Publicar balanço público dos resultados do programa de conectividade escolar', 'media', 'programatica', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta_d;
  PERFORM pg_temp.gera_4_sucessos_realizados(v_id_meta_d, 'Produção mensal de insumos para o balanço público do programa', '2025-12-01', v_id_usuario);

  PERFORM app.recalcula_atingimento(v_id_planejamento);

  UPDATE fat_etapa_contrato SET status = 'concluida', dt_inicio = '2025-12-08', dt_conclusao = '2025-12-15'
   WHERE id_contrato = v_id_contrato AND id_etapa = 12; -- Pontapé
  UPDATE fat_etapa_contrato SET status = 'concluida', dt_inicio = '2025-12-16', dt_conclusao = '2026-01-10'
   WHERE id_contrato = v_id_contrato AND id_etapa = 13; -- Diagnóstico
  UPDATE fat_etapa_contrato SET status = 'concluida', dt_inicio = '2026-01-11', dt_conclusao = '2026-01-31'
   WHERE id_contrato = v_id_contrato AND id_etapa = 14; -- Imersão
  UPDATE fat_etapa_contrato SET status = 'concluida', dt_inicio = '2026-02-01', dt_conclusao = '2026-02-25'
   WHERE id_contrato = v_id_contrato AND id_etapa = 15; -- Governança
  UPDATE fat_etapa_contrato SET status = 'concluida', dt_inicio = '2026-02-26', dt_conclusao = '2026-04-20'
   WHERE id_contrato = v_id_contrato AND id_etapa = 16; -- Monitoramento
  UPDATE fat_etapa_contrato SET status = 'dispensada'
   WHERE id_contrato = v_id_contrato AND id_etapa = 17; -- Replicação
  UPDATE fat_contrato SET id_etapa_atual = 16 WHERE id_contrato = v_id_contrato;

  INSERT INTO fat_insight (id_contrato, id_pilar, conteudo, desdobramentos, ocorrido_em, id_usuario_autor)
  VALUES (v_id_contrato, 6, 'Prefeituras parceiras relatam gargalo recorrente de manutenção da infraestrutura de conectividade após a instalação inicial.', 'Direciona o balanço público a incluir recomendação específica de manutenção continuada, não só de instalação.', '2026-02-12', v_id_usuario)
  RETURNING id_insight INTO v_id_insight;
  INSERT INTO rel_insight_origem (id_insight, id_meta) VALUES (v_id_insight, v_id_meta_d);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (v_id_contrato, 108, 'Diagnóstico do programa de conectividade escolar concluído', 'baixo', 'baixo', 'baixo', 7, 2, 'Levantamento inicial do estágio de execução do programa de conectividade escolar na base do mandato.', 'realizado', '2025-12-15', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (v_id_contrato, 131, 'Primeiro requerimento sobre execução do programa protocolado', 'baixo', 'baixo', 'baixo', 8, 7, 2, 'Requerimento protocolado cobrando execução orçamentária do programa de conectividade escolar.', 'realizado', '2026-01-12', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_meta) VALUES (v_id_fato, v_id_meta_a);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (v_id_contrato, 132, 'Prefeituras parceiras relatam gargalo de manutenção da infraestrutura', 'medio', 'medio', 'baixo', 8, 9, 3, 'Visitas técnicas às escolas piloto revelam gargalo recorrente de manutenção pós-instalação.', 'realizado', '2026-02-12', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_insight) VALUES (v_id_fato, v_id_insight);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_prevista, id_usuario_autor)
  VALUES (v_id_contrato, 128, 'Audiência pública de balanço do programa de conectividade escolar', 'medio', 'medio', 'baixo', 8, 9, 3, 'Audiência pública prevista para apresentar o balanço público dos resultados do programa antes do encerramento do ciclo.', 'projetado', '2026-04-15', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_meta) VALUES (v_id_fato, v_id_meta_d);
END $$;

COMMIT;

REFRESH MATERIALIZED VIEW mv_iip_contrato;
