-- =============================================================================
-- Popula dados de demonstração nos 3 contratos de Estratégia recém-cadastrados
-- (Tabata Amaral id_contrato=3301, Marina Bragante id_contrato=3302, Abidan
-- Henrique id_contrato=3303): informações gerais do mandato, planejamento
-- estratégico completo (legado, objetivo do ano, análise de conjuntura,
-- objetivos específicos, metas, até 4 sucessos mensais por meta), agenda e
-- registros conforme a etapa em que cada contrato já se encontra, e Fatos
-- Geradores/cadeias de Incidência (a maioria realizado, sempre com pelo menos
-- 1 projetado por contrato, com origem em Meta e em Insight).
--
-- Tudo fictício/ilustrativo, só para demo. Os 3 contratos foram cadastrados
-- hoje (dt_inicio 2026-09-22); as etapas já concluídas na régua (Pontapé,
-- Diagnóstico, Imersão, Governança conforme o caso) foram tratadas como
-- ocorridas nesta mesma semana para não datar nada antes do início do
-- contrato.
--
-- NÃO É MIGRATION: só mexe em dados. Roda com
-- `supabase db query --linked --file scripts/seed/04_popular_contratos_demo.sql`
-- contra DEV. Produção não recebe seed.
-- =============================================================================

BEGIN;

CREATE FUNCTION pg_temp.gera_4_sucessos(
  p_id_meta bigint,
  p_descricao text,
  p_usuario bigint
) RETURNS void AS $$
DECLARE
  v_mes date := '2026-09-01'::date;
  v_idx int;
  v_status text;
  v_pct numeric;
  v_dt_limite date;
  v_atualizado_em timestamptz;
BEGIN
  FOR v_idx IN 1..4 LOOP
    v_dt_limite := v_mes + 24; -- dia 25 do mês de referência

    IF v_idx = 1 THEN
      v_status := 'realizado';
      v_pct := 85 + v_idx * 2;
      v_atualizado_em := (v_dt_limite - 2)::timestamptz;
    ELSE
      v_status := 'pendente';
      v_pct := NULL;
      v_atualizado_em := NULL;
    END IF;

    INSERT INTO fat_sucesso_mensal
      (id_meta, descricao, mes_referencia, dt_limite, peso, pct_atingimento, status, atualizado_por, atualizado_em, id_usuario_responsavel)
    VALUES (
      p_id_meta, p_descricao, v_mes, v_dt_limite, 25.00, v_pct, v_status,
      CASE WHEN v_status <> 'pendente' THEN p_usuario ELSE NULL END,
      v_atualizado_em, p_usuario
    );

    v_mes := (v_mes + interval '1 month')::date;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  v_id_usuario bigint;
  v_id_objetivo bigint;
  v_id_meta bigint;
  v_id_meta_a bigint;
  v_id_meta_b bigint;
  v_id_meta_c bigint;
  v_id_meta_d bigint;
  v_id_encontro bigint;
  v_id_registro bigint;
  v_id_insight bigint;
  v_id_fato bigint;
  v_nome_check text;
BEGIN
  SELECT id_usuario INTO v_id_usuario FROM dim_usuario WHERE email = 'conhecimento@legislabrasil.org';
  IF v_id_usuario IS NULL THEN
    RAISE EXCEPTION 'Pré-requisito ausente: usuário conhecimento@legislabrasil.org';
  END IF;

  -- ===========================================================================
  -- CONTRATO 3301 — TABATA AMARAL (Deputada Federal, PSB/SP)
  -- Régua: Pontapé, Diagnóstico e Imersão concluídos; Governança/Organograma
  -- em andamento.
  -- ===========================================================================
  SELECT dm.nm_urna INTO v_nome_check FROM dim_mandato dm
    JOIN fat_contrato fc ON fc.id_contratante = dm.id_contratante WHERE fc.id_contrato = 3301;
  IF v_nome_check IS DISTINCT FROM 'TABATA AMARAL' THEN
    RAISE EXCEPTION 'id_contrato=3301 não é mais Tabata Amaral (achei %); aborte e confira', v_nome_check;
  END IF;

  -- Informações gerais do mandato
  UPDATE dim_mandato SET
    espectro_politico = 'Centro-esquerda',
    minibiografia = 'Deputada federal em segundo mandato, reconhecida nacionalmente pela atuação em educação baseada em evidências. Antes da política, atuou em organizações de impacto social na área educacional.',
    principais_pautas = ARRAY['Educação', 'Ciência, Tecnologia e Inovação']
  WHERE id_contratante = 4326;

  -- Planejamento estratégico
  UPDATE dim_planejamento SET
    id_perfil_atuacao = 6, -- Legisladora
    objetivo_ano = 'Aprovar o marco legal do Compromisso Nacional pela Educação Integral na Comissão de Educação e consolidar-se como referência nacional em política educacional baseada em evidências.',
    legado = 'Ser lembrada como a parlamentar que profissionalizou o debate público sobre educação no Congresso Nacional, pautando decisões em dados e não em improviso.',
    analise_conjuntura = 'Câmara dos Deputados com pauta educacional disputando espaço com a agenda econômica, mas em ascensão após resultados recentes de avaliações nacionais de aprendizagem; disputa de protagonismo com outras lideranças históricas da educação.'
  WHERE id_contrato = 3301;

  -- Objetivo 1: Compromisso Nacional pela Educação Integral
  INSERT INTO fat_objetivo_especifico (id_planejamento, ordem, descricao, id_preditor_primario, id_agenda, status)
  VALUES (3709, 1, 'Aprovar o projeto de lei do Compromisso Nacional pela Educação Integral na Comissão de Educação', 8, 63, 'ativo')
  RETURNING id_objetivo INTO v_id_objetivo;

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 1, 'Reunir apoio de pelo menos 15 parlamentares da Frente Parlamentar da Educação para o PL', 'alta', 'governanca', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta_a;
  PERFORM pg_temp.gera_4_sucessos(v_id_meta_a, 'Avanço mensal da articulação de apoio na Frente Parlamentar da Educação', v_id_usuario);

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 2, 'Levar o PL à pauta da Comissão de Educação até o fim do ano legislativo', 'alta', 'governanca', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta_b;
  PERFORM pg_temp.gera_4_sucessos(v_id_meta_b, 'Avanço mensal da tramitação do PL na Comissão de Educação', v_id_usuario);

  -- Objetivo 2: educação baseada em evidências
  INSERT INTO fat_objetivo_especifico (id_planejamento, ordem, descricao, id_preditor_primario, id_agenda, status)
  VALUES (3709, 2, 'Ampliar a presença nacional da pauta de educação baseada em evidências', 8, 63, 'ativo')
  RETURNING id_objetivo INTO v_id_objetivo;

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 1, 'Publicar nota técnica trimestral com dados de aprendizagem por estado', 'media', 'programatica', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta_c;
  PERFORM pg_temp.gera_4_sucessos(v_id_meta_c, 'Produção mensal de dados e insumos para a nota técnica de aprendizagem', v_id_usuario);

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 2, 'Realizar ciclo de audiências públicas sobre alfabetização na idade certa', 'media', 'programatica', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta_d;
  PERFORM pg_temp.gera_4_sucessos(v_id_meta_d, 'Preparação mensal do ciclo de audiências sobre alfabetização na idade certa', v_id_usuario);

  PERFORM app.recalcula_atingimento(3709);

  -- Agenda e registros — Pontapé, Diagnóstico, Imersão (concluídos) + Governança (em andamento)
  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3301, 12, 4, 'Pontapé do mandato', 'realizado', '2026-09-22 09:00-03', '2026-09-22 10:00-03', '2026-09-22 09:05-03', 'presencial', 'Gabinete em Brasília', 'Educação')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3301, 4, v_id_encontro, '2026-09-22 09:05-03', 'presencial', 'Kickoff do mandato: alinhamento de prioridades e assinatura do termo de compromisso.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3301, 13, 5, 'Comitê político — diagnóstico inicial', 'realizado', '2026-09-22 10:30-03', '2026-09-22 11:30-03', '2026-09-22 10:35-03', 'presencial', 'Gabinete em Brasília', 'Educação')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3301, 5, v_id_encontro, '2026-09-22 10:35-03', 'presencial', 'Mapeamento político inicial com a equipe: aliados, opositores e prioridades legislativas do ano.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3301, 13, 6, 'Escuta diagnóstica com a equipe de gabinete', 'realizado', '2026-09-22 14:00-03', '2026-09-22 15:30-03', '2026-09-22 14:10-03', 'presencial', 'Gabinete em Brasília', 'Educação')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3301, 6, v_id_encontro, '2026-09-22 14:10-03', 'presencial', 'Escuta diagnóstica com assessoria sobre desafios e oportunidades do mandato em educação.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3301, 14, 7, 'Imersão de planejamento estratégico', 'realizado', '2026-09-22 16:00-03', '2026-09-22 18:00-03', '2026-09-22 16:05-03', 'presencial', 'Gabinete em Brasília', 'Educação')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3301, 7, v_id_encontro, '2026-09-22 16:05-03', 'presencial', 'Imersão de planejamento estratégico: definição dos objetivos do ano e da análise de conjuntura.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3301, 15, 9, 'Diagnóstico de organograma do gabinete', 'realizado', '2026-09-23 09:00-03', '2026-09-23 10:00-03', '2026-09-23 09:05-03', 'presencial', 'Gabinete em Brasília', 'Educação')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3301, 9, v_id_encontro, '2026-09-23 09:05-03', 'presencial', 'Diagnóstico do organograma atual do gabinete e levantamento de adequações necessárias.', jsonb_build_object('adequacoes', 'Criar função dedicada de acompanhamento legislativo da pauta de educação.'), v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, modalidade, local, tema_prioritario)
  VALUES (3301, 15, 10, 'Proposta de novo organograma do gabinete', 'planejado', '2026-09-30 10:00-03', '2026-09-30 11:00-03', 'online', NULL, 'Educação')
  RETURNING id_encontro INTO v_id_encontro;

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3301, 15, 8, 'Reunião semanal de gabinete', 'realizado', '2026-09-23 15:00-03', '2026-09-23 16:00-03', '2026-09-23 15:10-03', 'online', NULL, 'Educação')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, nr_sequencia, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3301, 8, v_id_encontro, 1, '2026-09-23 15:10-03', 'sistema', 'Reunião semanal 1: acompanhamento do PL do Compromisso Nacional pela Educação Integral.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3301, 15, 8, 'Reunião semanal de gabinete', 'realizado', '2026-09-30 15:00-03', '2026-09-30 16:00-03', '2026-09-30 15:10-03', 'online', NULL, 'Educação')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, nr_sequencia, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3301, 8, v_id_encontro, 2, '2026-09-30 15:10-03', 'sistema', 'Reunião semanal 2: alinhamento sobre articulação com a Frente Parlamentar da Educação.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, modalidade, local, tema_prioritario)
  VALUES (3301, 15, 8, 'Reunião semanal de gabinete', 'planejado', '2026-10-07 15:00-03', '2026-10-07 16:00-03', 'online', NULL, 'Educação');

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, modalidade, local, tema_prioritario)
  VALUES (3301, 15, 8, 'Reunião semanal de gabinete', 'planejado', '2026-10-14 15:00-03', '2026-10-14 16:00-03', 'online', NULL, 'Educação');

  INSERT INTO rel_encontro_participante (id_encontro, id_usuario, origem, presente)
  SELECT id_encontro, v_id_usuario, 'legisla', (status = 'realizado') FROM fat_encontro WHERE id_contrato = 3301;

  -- Fatos Geradores e cadeia via Insight
  INSERT INTO fat_insight (id_contrato, id_pilar, conteudo, desdobramentos, ocorrido_em, id_usuario_autor)
  VALUES (3301, 8, 'A Frente Parlamentar da Educação sinalizou apoio informal ao Compromisso Nacional pela Educação Integral já na primeira rodada de conversas.', 'Abre caminho para acelerar a coleta de assinaturas de apoio ao PL nas próximas semanas.', '2026-09-24', v_id_usuario)
  RETURNING id_insight INTO v_id_insight;
  INSERT INTO rel_insight_origem (id_insight, id_meta) VALUES (v_id_insight, v_id_meta_a);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3301, 108, 'Diagnóstico estratégico do mandato concluído', 'baixo', 'baixo', 'baixo', 7, 3, 'Imersão de planejamento estratégico concluída com definição de objetivos do ano.', 'realizado', '2026-09-22', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3301, 112, 'PL do Compromisso Nacional pela Educação Integral protocolado', 'baixo', 'baixo', 'baixo', 7, 8, 3, 'Projeto de lei protocolado na Câmara dos Deputados criando o Compromisso Nacional pela Educação Integral.', 'realizado', '2026-09-24', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_meta) VALUES (v_id_fato, v_id_meta_a);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3301, 135, 'Primeira rodada de apoio da Frente Parlamentar da Educação', 'medio', 'medio', 'baixo', 9, 11, 3, 'Conversas iniciais com a Frente Parlamentar da Educação indicam apoio informal ao PL.', 'realizado', '2026-09-24', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_insight) VALUES (v_id_fato, v_id_insight);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_prevista, id_usuario_autor)
  VALUES (3301, 113, 'PL entra em tramitação na Comissão de Educação', 'baixo', 'medio', 'medio', 11, 8, 3, 'Pauta prevista para a Comissão de Educação após consolidação do apoio de 15 parlamentares.', 'projetado', '2026-11-10', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_meta) VALUES (v_id_fato, v_id_meta_a);

  -- ===========================================================================
  -- CONTRATO 3302 — MARINA BRAGANTE (Vereadora, REDE)
  -- Régua: Pontapé, Diagnóstico, Imersão e Governança/Organograma concluídos;
  -- Monitoramento em andamento.
  -- ===========================================================================
  SELECT dm.nm_urna INTO v_nome_check FROM dim_mandato dm
    JOIN fat_contrato fc ON fc.id_contratante = dm.id_contratante WHERE fc.id_contrato = 3302;
  IF v_nome_check IS DISTINCT FROM 'MARINA BRAGANTE' THEN
    RAISE EXCEPTION 'id_contrato=3302 não é mais Marina Bragante (achei %); aborte e confira', v_nome_check;
  END IF;

  UPDATE dim_mandato SET
    espectro_politico = 'Centro-esquerda',
    minibiografia = 'Vereadora em primeiro mandato, com atuação histórica em movimentos sociais ligados à assistência social e aos direitos das mulheres.',
    principais_pautas = ARRAY['Assistência e Desenvolvimento Social', 'Mulheres']
  WHERE id_contratante = 4327;

  UPDATE dim_planejamento SET
    id_perfil_atuacao = 5, -- Fiscalizadora
    objetivo_ano = 'Consolidar a fiscalização do orçamento municipal de assistência social e aprovar lei municipal de fortalecimento da rede de proteção à mulher.',
    legado = 'Ser lembrada como a vereadora que deu transparência ao gasto social do município e ampliou a rede de proteção às mulheres em situação de vulnerabilidade.',
    analise_conjuntura = 'Câmara Municipal com maioria de situação, mas a pauta social tem apoio bipartidário; orçamento de assistência social sob pressão em ano de revisão orçamentária.'
  WHERE id_contrato = 3302;

  -- Objetivo 1: fiscalização do orçamento de assistência social
  INSERT INTO fat_objetivo_especifico (id_planejamento, ordem, descricao, id_preditor_primario, id_agenda, status)
  VALUES (3710, 1, 'Ampliar a fiscalização da execução do orçamento municipal de assistência social', 8, 65, 'ativo')
  RETURNING id_objetivo INTO v_id_objetivo;

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 1, 'Protocolar requerimentos trimestrais de informação sobre execução do orçamento de assistência social', 'alta', 'governanca', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta_a;
  PERFORM pg_temp.gera_4_sucessos(v_id_meta_a, 'Acompanhamento mensal da execução orçamentária da assistência social', v_id_usuario);

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 2, 'Realizar visitas mensais a equipamentos de assistência social do município', 'media', 'programatica', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta_b;
  PERFORM pg_temp.gera_4_sucessos(v_id_meta_b, 'Visita mensal a equipamento de assistência social com registro e escuta', v_id_usuario);

  -- Objetivo 2: rede de proteção à mulher
  INSERT INTO fat_objetivo_especifico (id_planejamento, ordem, descricao, id_preditor_primario, id_agenda, status)
  VALUES (3710, 2, 'Aprovar lei municipal de fortalecimento da rede de proteção à mulher', 7, 70, 'ativo')
  RETURNING id_objetivo INTO v_id_objetivo;

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 1, 'Protocolar e tramitar o projeto de lei até dezembro de 2026', 'alta', 'governanca', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta_c;
  PERFORM pg_temp.gera_4_sucessos(v_id_meta_c, 'Avanço mensal da tramitação do PL de fortalecimento da rede de proteção à mulher', v_id_usuario);

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 2, 'Construir apoio de pelo menos 5 vereadores para a aprovação do projeto', 'media', 'programatica', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta_d;
  PERFORM pg_temp.gera_4_sucessos(v_id_meta_d, 'Rodada mensal de conversas com vereadores para construir apoio ao PL', v_id_usuario);

  PERFORM app.recalcula_atingimento(3710);

  -- Agenda e registros — régua concluída até Governança, Monitoramento em andamento
  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3302, 12, 4, 'Pontapé do mandato', 'realizado', '2026-09-22 09:00-03', '2026-09-22 10:00-03', '2026-09-22 09:05-03', 'presencial', 'Gabinete na Câmara Municipal', 'Assistência e Desenvolvimento Social')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3302, 4, v_id_encontro, '2026-09-22 09:05-03', 'presencial', 'Kickoff do mandato: alinhamento de prioridades e assinatura do termo de compromisso.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3302, 13, 5, 'Comitê político — diagnóstico inicial', 'realizado', '2026-09-22 10:30-03', '2026-09-22 11:30-03', '2026-09-22 10:35-03', 'presencial', 'Gabinete na Câmara Municipal', 'Assistência e Desenvolvimento Social')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3302, 5, v_id_encontro, '2026-09-22 10:35-03', 'presencial', 'Mapeamento político inicial: aliados, opositores e prioridades legislativas do ano.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3302, 13, 6, 'Escuta diagnóstica com a equipe de gabinete', 'realizado', '2026-09-22 14:00-03', '2026-09-22 15:30-03', '2026-09-22 14:10-03', 'presencial', 'Gabinete na Câmara Municipal', 'Assistência e Desenvolvimento Social')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3302, 6, v_id_encontro, '2026-09-22 14:10-03', 'presencial', 'Escuta diagnóstica com assessoria sobre desafios e oportunidades do mandato.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3302, 14, 7, 'Imersão de planejamento estratégico', 'realizado', '2026-09-22 16:00-03', '2026-09-22 18:00-03', '2026-09-22 16:05-03', 'presencial', 'Gabinete na Câmara Municipal', 'Assistência e Desenvolvimento Social')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3302, 7, v_id_encontro, '2026-09-22 16:05-03', 'presencial', 'Imersão de planejamento estratégico: definição dos objetivos do ano e da análise de conjuntura.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3302, 15, 9, 'Diagnóstico de organograma do gabinete', 'realizado', '2026-09-23 09:00-03', '2026-09-23 10:00-03', '2026-09-23 09:05-03', 'presencial', 'Gabinete na Câmara Municipal', 'Assistência e Desenvolvimento Social')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3302, 9, v_id_encontro, '2026-09-23 09:05-03', 'presencial', 'Diagnóstico do organograma atual e levantamento de adequações necessárias.', jsonb_build_object('adequacoes', 'Criar função dedicada de acompanhamento de fiscalização orçamentária.'), v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3302, 15, 10, 'Proposta de novo organograma do gabinete', 'realizado', '2026-09-23 11:00-03', '2026-09-23 12:00-03', '2026-09-23 11:05-03', 'presencial', 'Gabinete na Câmara Municipal', 'Assistência e Desenvolvimento Social')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3302, 10, v_id_encontro, '2026-09-23 11:05-03', 'presencial', 'Proposta de novo organograma aprovada com a gestora do mandato.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3302, 15, 8, 'Reunião semanal de gabinete', 'realizado', '2026-09-24 15:00-03', '2026-09-24 16:00-03', '2026-09-24 15:10-03', 'online', NULL, 'Assistência e Desenvolvimento Social')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, nr_sequencia, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3302, 8, v_id_encontro, 1, '2026-09-24 15:10-03', 'sistema', 'Reunião semanal 1: acompanhamento dos requerimentos de fiscalização orçamentária.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3302, 15, 8, 'Reunião semanal de gabinete', 'realizado', '2026-10-01 15:00-03', '2026-10-01 16:00-03', '2026-10-01 15:10-03', 'online', NULL, 'Assistência e Desenvolvimento Social')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, nr_sequencia, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3302, 8, v_id_encontro, 2, '2026-10-01 15:10-03', 'sistema', 'Reunião semanal 2: alinhamento sobre o PL de fortalecimento da rede de proteção à mulher.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3302, 15, 8, 'Reunião semanal de gabinete', 'realizado', '2026-10-08 15:00-03', '2026-10-08 16:00-03', '2026-10-08 15:10-03', 'online', NULL, 'Assistência e Desenvolvimento Social')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, nr_sequencia, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3302, 8, v_id_encontro, 3, '2026-10-08 15:10-03', 'sistema', 'Reunião semanal 3: balanço das visitas a equipamentos de assistência social.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3302, 15, 8, 'Reunião semanal de gabinete', 'realizado', '2026-10-15 15:00-03', '2026-10-15 16:00-03', '2026-10-15 15:10-03', 'online', NULL, 'Assistência e Desenvolvimento Social')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, nr_sequencia, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3302, 8, v_id_encontro, 4, '2026-10-15 15:10-03', 'sistema', 'Reunião semanal 4: fechamento da etapa de Governança e transição para o Monitoramento.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3302, 16, 11, 'Monitoramento 1', 'realizado', '2026-10-21 10:00-03', '2026-10-21 11:00-03', '2026-10-21 10:05-03', 'online', NULL, 'Assistência e Desenvolvimento Social')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, nr_sequencia, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3302, 11, v_id_encontro, 1, '2026-10-21 10:05-03', 'sistema', 'Monitoramento 1: primeiro requerimento de fiscalização respondido pela Secretaria de Assistência Social.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, modalidade, local, tema_prioritario)
  VALUES (3302, 16, 11, 'Monitoramento 2', 'planejado', '2026-11-04 10:00-03', '2026-11-04 11:00-03', 'online', NULL, 'Assistência e Desenvolvimento Social');

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, modalidade, local, tema_prioritario)
  VALUES (3302, 16, 13, 'Encontro Legisla Aliada — troca com outros gabinetes', 'planejado', '2026-10-28 14:00-03', '2026-10-28 15:30-03', 'online', NULL, 'Assistência e Desenvolvimento Social');

  INSERT INTO rel_encontro_participante (id_encontro, id_usuario, origem, presente)
  SELECT id_encontro, v_id_usuario, 'legisla', (status = 'realizado') FROM fat_encontro WHERE id_contrato = 3302;

  -- Fatos Geradores e cadeia via Insight
  INSERT INTO fat_insight (id_contrato, id_pilar, conteudo, desdobramentos, ocorrido_em, id_usuario_autor)
  VALUES (3302, 8, 'A Secretaria de Assistência Social respondeu ao primeiro requerimento em prazo recorde, sinalizando abertura ao diálogo com o mandato.', 'Abre espaço para pautar reuniões técnicas recorrentes com a Secretaria ao longo do Monitoramento.', '2026-10-21', v_id_usuario)
  RETURNING id_insight INTO v_id_insight;
  INSERT INTO rel_insight_origem (id_insight, id_meta) VALUES (v_id_insight, v_id_meta_a);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3302, 108, 'Diagnóstico estratégico do mandato concluído', 'baixo', 'baixo', 'baixo', 7, 3, 'Imersão de planejamento estratégico concluída com definição de objetivos do ano.', 'realizado', '2026-09-22', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3302, 131, 'Primeiro requerimento de fiscalização orçamentária protocolado', 'baixo', 'baixo', 'baixo', 8, 7, 2, 'Requerimento protocolado cobrando execução do orçamento da Secretaria de Assistência Social.', 'realizado', '2026-09-25', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_meta) VALUES (v_id_fato, v_id_meta_a);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3302, 132, 'Secretaria de Assistência Social respondeu ao requerimento em prazo recorde', 'medio', 'medio', 'medio', 8, 11, 3, 'Resposta formal recebida com planilha de execução orçamentária do trimestre.', 'realizado', '2026-10-21', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_insight) VALUES (v_id_fato, v_id_insight);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_prevista, id_usuario_autor)
  VALUES (3302, 113, 'PL de fortalecimento da rede de proteção à mulher entra em tramitação', 'baixo', 'medio', 'medio', 11, 7, 3, 'Pauta prevista para a Comissão de Assistência Social após protocolo do projeto de lei.', 'projetado', '2026-11-20', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_meta) VALUES (v_id_fato, v_id_meta_c);

  -- ===========================================================================
  -- CONTRATO 3303 — ABIDAN HENRIQUE (Deputado Estadual, PSB)
  -- Régua: Pontapé e Diagnóstico concluídos; Imersão em andamento.
  -- ===========================================================================
  SELECT dm.nm_urna INTO v_nome_check FROM dim_mandato dm
    JOIN fat_contrato fc ON fc.id_contratante = dm.id_contratante WHERE fc.id_contrato = 3303;
  IF v_nome_check IS DISTINCT FROM 'ABIDAN HENRIQUE' THEN
    RAISE EXCEPTION 'id_contrato=3303 não é mais Abidan Henrique (achei %); aborte e confira', v_nome_check;
  END IF;

  UPDATE dim_mandato SET
    espectro_politico = 'Centro-esquerda',
    minibiografia = 'Deputado estadual em primeiro mandato, com atuação anterior em segurança pública municipal e forte base regional no interior do estado.',
    principais_pautas = ARRAY['Segurança Pública', 'Trabalho, Emprego e Renda']
  WHERE id_contratante = 4328;

  UPDATE dim_planejamento SET
    id_perfil_atuacao = 5, -- Fiscalizadora
    objetivo_ano = 'Consolidar a fiscalização do gasto estadual em segurança pública e aprovar emenda parlamentar de reforço de efetivo policial na região.',
    legado = 'Ser referência regional em fiscalização e articulação para segurança pública, com histórico de resultados concretos para os municípios da base.',
    analise_conjuntura = 'Assembleia Legislativa com pauta de segurança em alta após casos de repercussão regional, mas orçamento estadual sob restrição; mandato em primeiro ano, ainda construindo capilaridade com prefeitos da região.'
  WHERE id_contrato = 3303;

  -- Objetivo 1: fiscalização do gasto em segurança pública
  INSERT INTO fat_objetivo_especifico (id_planejamento, ordem, descricao, id_preditor_primario, id_agenda, status)
  VALUES (3711, 1, 'Ampliar a fiscalização do gasto público estadual em segurança pública', 8, 66, 'ativo')
  RETURNING id_objetivo INTO v_id_objetivo;

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 1, 'Protocolar pedidos de informação trimestrais sobre execução orçamentária da segurança pública', 'alta', 'governanca', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta_a;
  PERFORM pg_temp.gera_4_sucessos(v_id_meta_a, 'Acompanhamento mensal da execução orçamentária da segurança pública', v_id_usuario);

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 2, 'Realizar visitas mensais a unidades da polícia militar da região', 'media', 'programatica', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta_b;
  PERFORM pg_temp.gera_4_sucessos(v_id_meta_b, 'Visita mensal a unidade da polícia militar com registro e escuta', v_id_usuario);

  -- Objetivo 2: emenda de reforço de efetivo
  INSERT INTO fat_objetivo_especifico (id_planejamento, ordem, descricao, id_preditor_primario, id_agenda, status)
  VALUES (3711, 2, 'Construir articulação regional para aprovação de emenda de reforço de efetivo policial', 11, 66, 'ativo')
  RETURNING id_objetivo INTO v_id_objetivo;

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 1, 'Protocolar emenda parlamentar para reforço de efetivo policial na região', 'alta', 'governanca', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta_c;
  PERFORM pg_temp.gera_4_sucessos(v_id_meta_c, 'Avanço mensal do protocolo e tramitação da emenda de reforço de efetivo', v_id_usuario);

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 2, 'Reunir apoio de prefeitos da região para a emenda', 'media', 'programatica', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta_d;
  PERFORM pg_temp.gera_4_sucessos(v_id_meta_d, 'Rodada mensal de conversas com prefeitos da região sobre a emenda de segurança', v_id_usuario);

  PERFORM app.recalcula_atingimento(3711);

  -- Agenda e registros — Pontapé e Diagnóstico concluídos, Imersão em andamento
  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3303, 12, 4, 'Pontapé do mandato', 'realizado', '2026-09-22 09:00-03', '2026-09-22 10:00-03', '2026-09-22 09:05-03', 'presencial', 'Gabinete na Assembleia Legislativa', 'Segurança Pública')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3303, 4, v_id_encontro, '2026-09-22 09:05-03', 'presencial', 'Kickoff do mandato: alinhamento de prioridades e assinatura do termo de compromisso.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3303, 13, 5, 'Comitê político — diagnóstico inicial', 'realizado', '2026-09-22 10:30-03', '2026-09-22 11:30-03', '2026-09-22 10:35-03', 'presencial', 'Gabinete na Assembleia Legislativa', 'Segurança Pública')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3303, 5, v_id_encontro, '2026-09-22 10:35-03', 'presencial', 'Mapeamento político inicial: aliados, opositores e prioridades legislativas do ano.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3303, 13, 6, 'Escuta diagnóstica com a equipe de gabinete', 'realizado', '2026-09-22 14:00-03', '2026-09-22 15:30-03', '2026-09-22 14:10-03', 'presencial', 'Gabinete na Assembleia Legislativa', 'Segurança Pública')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3303, 6, v_id_encontro, '2026-09-22 14:10-03', 'presencial', 'Escuta diagnóstica com assessoria sobre desafios e oportunidades do mandato em segurança pública.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3303, 14, 7, 'Imersão de planejamento estratégico', 'realizado', '2026-09-23 09:00-03', '2026-09-23 11:00-03', '2026-09-23 09:05-03', 'presencial', 'Gabinete na Assembleia Legislativa', 'Segurança Pública')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3303, 7, v_id_encontro, '2026-09-23 09:05-03', 'presencial', 'Imersão de planejamento estratégico: definição dos objetivos do ano e da análise de conjuntura.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, modalidade, local, tema_prioritario)
  VALUES (3303, 14, 7, 'Fechamento da imersão — validação do planejamento com a gestora', 'planejado', '2026-10-06 10:00-03', '2026-10-06 11:30-03', 'online', NULL, 'Segurança Pública');

  INSERT INTO rel_encontro_participante (id_encontro, id_usuario, origem, presente)
  SELECT id_encontro, v_id_usuario, 'legisla', (status = 'realizado') FROM fat_encontro WHERE id_contrato = 3303;

  -- Fatos Geradores e cadeia via Insight
  INSERT INTO fat_insight (id_contrato, id_pilar, conteudo, desdobramentos, ocorrido_em, id_usuario_autor)
  VALUES (3303, 5, 'A escuta diagnóstica revelou forte demanda dos municípios da base por reforço de efetivo policial, mais do que qualquer outra pauta.', 'Reforça a priorização da emenda de reforço de efetivo como frente principal do Objetivo 2.', '2026-09-22', v_id_usuario)
  RETURNING id_insight INTO v_id_insight;
  INSERT INTO rel_insight_origem (id_insight, id_meta) VALUES (v_id_insight, v_id_meta_c);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3303, 108, 'Diagnóstico estratégico do mandato concluído', 'baixo', 'baixo', 'baixo', 7, 2, 'Levantamento das prioridades legislativas em segurança pública para o mandato.', 'realizado', '2026-09-23', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3303, 127, 'Escuta diagnóstica revela demanda por reforço de efetivo policial', 'medio', 'medio', 'baixo', 8, 7, 3, 'Escuta com lideranças locais aponta reforço de efetivo policial como prioridade número 1 da região.', 'realizado', '2026-09-22', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_insight) VALUES (v_id_fato, v_id_insight);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3303, 135, 'Primeiras conversas com prefeitos da região sobre a emenda de segurança', 'medio', 'medio', 'baixo', 9, 11, 2, 'Rodada inicial de conversas com 3 prefeitos da região sobre apoio à emenda de reforço de efetivo.', 'realizado', '2026-09-25', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_meta) VALUES (v_id_fato, v_id_meta_d);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_prevista, id_usuario_autor)
  VALUES (3303, 156, 'Emenda parlamentar de reforço de efetivo policial protocolada', 'baixo', 'baixo', 'baixo', 11, 7, 3, 'Protocolo previsto da emenda destinada ao reforço de efetivo policial na região.', 'projetado', '2026-10-30', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_meta) VALUES (v_id_fato, v_id_meta_c);
END $$;

COMMIT;

-- A UI dispara o refresh de mv_iip_contrato ao abrir a tela (atualizaIipContrato);
-- refresh explícito aqui só para quem quiser conferir nr_fatos direto no banco.
REFRESH MATERIALIZED VIEW mv_iip_contrato;
