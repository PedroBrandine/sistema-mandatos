-- =============================================================================
-- Ajusta a cronologia dos 3 contratos populados em 04_popular_contratos_demo.sql
-- (Tabata 3301, Marina 3302, Abidan 3303): a agenda original empilhava vários
-- encontros no mesmo dia (todos "hoje", já que os 3 contratos nasceram com
-- dt_inicio = data de cadastro), o que fica ruim para demo.
--
-- Sorteio de dt_inicio entre julho e agosto/2026, em ordem coerente com o
-- quanto cada contrato já andou na régua (mais etapas concluídas = começou
-- mais cedo): Marina (Monitoramento em andamento) começou primeiro, Tabata
-- (Governança em andamento) no meio, Abidan (Imersão em andamento) por
-- último. Reescreve fat_encontro/fat_registro do zero, espalhados em
-- cadência semanal até hoje (2026-09-22), e ajusta fat_etapa_contrato.dt_inicio
-- da etapa concluída/em andamento para bater com a nova linha do tempo (usada
-- por fn_estrategia_kpi para classificar atraso).
--
-- NÃO É MIGRATION: só mexe em dados. Roda com
-- `supabase db query --linked --file scripts/seed/06_ajustar_cronologia_agenda.sql`
-- contra DEV. Produção não recebe seed.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_id_usuario bigint;
  v_id_encontro bigint;
BEGIN
  SELECT id_usuario INTO v_id_usuario FROM dim_usuario WHERE email = 'conhecimento@legislabrasil.org';
  IF v_id_usuario IS NULL THEN
    RAISE EXCEPTION 'Pré-requisito ausente: usuário conhecimento@legislabrasil.org';
  END IF;

  -- Limpa a agenda antiga (empilhada) dos 3 contratos.
  DELETE FROM rel_encontro_participante WHERE id_encontro IN (SELECT id_encontro FROM fat_encontro WHERE id_contrato IN (3301, 3302, 3303));
  DELETE FROM fat_registro WHERE id_contrato IN (3301, 3302, 3303);
  DELETE FROM fat_encontro WHERE id_contrato IN (3301, 3302, 3303);

  -- Novas datas de início.
  UPDATE fat_contrato SET dt_inicio = '2026-08-03' WHERE id_contrato = 3301; -- Tabata
  UPDATE fat_contrato SET dt_inicio = '2026-07-06' WHERE id_contrato = 3302; -- Marina
  UPDATE fat_contrato SET dt_inicio = '2026-08-31' WHERE id_contrato = 3303; -- Abidan

  -- ===========================================================================
  -- 3302 — MARINA BRAGANTE: início 06/07, régua concluída até Governança,
  -- Monitoramento em andamento.
  -- ===========================================================================
  UPDATE fat_etapa_contrato SET dt_inicio = '2026-07-06', dt_conclusao = '2026-07-12' WHERE id_contrato = 3302 AND id_etapa = 12;
  UPDATE fat_etapa_contrato SET dt_inicio = '2026-07-13', dt_conclusao = '2026-07-26' WHERE id_contrato = 3302 AND id_etapa = 13;
  UPDATE fat_etapa_contrato SET dt_inicio = '2026-07-27', dt_conclusao = '2026-08-02' WHERE id_contrato = 3302 AND id_etapa = 14;
  UPDATE fat_etapa_contrato SET dt_inicio = '2026-08-03', dt_conclusao = '2026-09-07' WHERE id_contrato = 3302 AND id_etapa = 15;
  UPDATE fat_etapa_contrato SET dt_inicio = '2026-09-08' WHERE id_contrato = 3302 AND id_etapa = 16;

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3302, 12, 4, 'Pontapé do mandato', 'realizado', '2026-07-06 09:00-03', '2026-07-06 10:00-03', '2026-07-06 09:05-03', 'presencial', 'Gabinete na Câmara Municipal', 'Assistência e Desenvolvimento Social')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3302, 4, v_id_encontro, '2026-07-06 09:05-03', 'presencial', 'Kickoff do mandato: alinhamento de prioridades e assinatura do termo de compromisso.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3302, 13, 5, 'Comitê político — diagnóstico inicial', 'realizado', '2026-07-13 10:30-03', '2026-07-13 11:30-03', '2026-07-13 10:35-03', 'presencial', 'Gabinete na Câmara Municipal', 'Assistência e Desenvolvimento Social')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3302, 5, v_id_encontro, '2026-07-13 10:35-03', 'presencial', 'Mapeamento político inicial: aliados, opositores e prioridades legislativas do ano.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3302, 13, 6, 'Escuta diagnóstica com a equipe de gabinete', 'realizado', '2026-07-20 14:00-03', '2026-07-20 15:30-03', '2026-07-20 14:10-03', 'presencial', 'Gabinete na Câmara Municipal', 'Assistência e Desenvolvimento Social')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3302, 6, v_id_encontro, '2026-07-20 14:10-03', 'presencial', 'Escuta diagnóstica com assessoria sobre desafios e oportunidades do mandato.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3302, 14, 7, 'Imersão de planejamento estratégico', 'realizado', '2026-07-27 16:00-03', '2026-07-27 18:00-03', '2026-07-27 16:05-03', 'presencial', 'Gabinete na Câmara Municipal', 'Assistência e Desenvolvimento Social')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3302, 7, v_id_encontro, '2026-07-27 16:05-03', 'presencial', 'Imersão de planejamento estratégico: definição dos objetivos do ano e da análise de conjuntura.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3302, 15, 9, 'Diagnóstico de organograma do gabinete', 'realizado', '2026-08-03 09:00-03', '2026-08-03 10:00-03', '2026-08-03 09:05-03', 'presencial', 'Gabinete na Câmara Municipal', 'Assistência e Desenvolvimento Social')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3302, 9, v_id_encontro, '2026-08-03 09:05-03', 'presencial', 'Diagnóstico do organograma atual e levantamento de adequações necessárias.', jsonb_build_object('adequacoes', 'Criar função dedicada de acompanhamento de fiscalização orçamentária.'), v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3302, 15, 10, 'Proposta de novo organograma do gabinete', 'realizado', '2026-08-10 11:00-03', '2026-08-10 12:00-03', '2026-08-10 11:05-03', 'presencial', 'Gabinete na Câmara Municipal', 'Assistência e Desenvolvimento Social')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3302, 10, v_id_encontro, '2026-08-10 11:05-03', 'presencial', 'Proposta de novo organograma aprovada com a gestora do mandato.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3302, 15, 8, 'Reunião semanal de gabinete', 'realizado', '2026-08-17 15:00-03', '2026-08-17 16:00-03', '2026-08-17 15:10-03', 'online', NULL, 'Assistência e Desenvolvimento Social')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, nr_sequencia, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3302, 8, v_id_encontro, 1, '2026-08-17 15:10-03', 'sistema', 'Reunião semanal 1: acompanhamento dos requerimentos de fiscalização orçamentária.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3302, 15, 8, 'Reunião semanal de gabinete', 'realizado', '2026-08-24 15:00-03', '2026-08-24 16:00-03', '2026-08-24 15:10-03', 'online', NULL, 'Assistência e Desenvolvimento Social')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, nr_sequencia, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3302, 8, v_id_encontro, 2, '2026-08-24 15:10-03', 'sistema', 'Reunião semanal 2: alinhamento sobre o PL de fortalecimento da rede de proteção à mulher.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3302, 15, 8, 'Reunião semanal de gabinete', 'realizado', '2026-08-31 15:00-03', '2026-08-31 16:00-03', '2026-08-31 15:10-03', 'online', NULL, 'Assistência e Desenvolvimento Social')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, nr_sequencia, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3302, 8, v_id_encontro, 3, '2026-08-31 15:10-03', 'sistema', 'Reunião semanal 3: balanço das visitas a equipamentos de assistência social.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3302, 15, 8, 'Reunião semanal de gabinete', 'realizado', '2026-09-07 15:00-03', '2026-09-07 16:00-03', '2026-09-07 15:10-03', 'online', NULL, 'Assistência e Desenvolvimento Social')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, nr_sequencia, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3302, 8, v_id_encontro, 4, '2026-09-07 15:10-03', 'sistema', 'Reunião semanal 4: fechamento da etapa de Governança e transição para o Monitoramento.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3302, 16, 11, 'Monitoramento 1', 'realizado', '2026-09-14 10:00-03', '2026-09-14 11:00-03', '2026-09-14 10:05-03', 'online', NULL, 'Assistência e Desenvolvimento Social')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, nr_sequencia, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3302, 11, v_id_encontro, 1, '2026-09-14 10:05-03', 'sistema', 'Monitoramento 1: primeiro requerimento de fiscalização respondido pela Secretaria de Assistência Social.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, modalidade, local, tema_prioritario)
  VALUES (3302, 16, 11, 'Monitoramento 2', 'planejado', '2026-09-28 10:00-03', '2026-09-28 11:00-03', 'online', NULL, 'Assistência e Desenvolvimento Social');

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, modalidade, local, tema_prioritario)
  VALUES (3302, 16, 13, 'Encontro Legisla Aliada — troca com outros gabinetes', 'planejado', '2026-10-05 14:00-03', '2026-10-05 15:30-03', 'online', NULL, 'Assistência e Desenvolvimento Social');

  -- ===========================================================================
  -- 3301 — TABATA AMARAL: início 03/08, régua concluída até Imersão,
  -- Governança em andamento.
  -- ===========================================================================
  UPDATE fat_etapa_contrato SET dt_inicio = '2026-08-03', dt_conclusao = '2026-08-09' WHERE id_contrato = 3301 AND id_etapa = 12;
  UPDATE fat_etapa_contrato SET dt_inicio = '2026-08-10', dt_conclusao = '2026-08-23' WHERE id_contrato = 3301 AND id_etapa = 13;
  UPDATE fat_etapa_contrato SET dt_inicio = '2026-08-24', dt_conclusao = '2026-08-30' WHERE id_contrato = 3301 AND id_etapa = 14;
  UPDATE fat_etapa_contrato SET dt_inicio = '2026-08-31' WHERE id_contrato = 3301 AND id_etapa = 15;

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3301, 12, 4, 'Pontapé do mandato', 'realizado', '2026-08-03 09:00-03', '2026-08-03 10:00-03', '2026-08-03 09:05-03', 'presencial', 'Gabinete em Brasília', 'Educação')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3301, 4, v_id_encontro, '2026-08-03 09:05-03', 'presencial', 'Kickoff do mandato: alinhamento de prioridades e assinatura do termo de compromisso.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3301, 13, 5, 'Comitê político — diagnóstico inicial', 'realizado', '2026-08-10 10:30-03', '2026-08-10 11:30-03', '2026-08-10 10:35-03', 'presencial', 'Gabinete em Brasília', 'Educação')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3301, 5, v_id_encontro, '2026-08-10 10:35-03', 'presencial', 'Mapeamento político inicial com a equipe: aliados, opositores e prioridades legislativas do ano.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3301, 13, 6, 'Escuta diagnóstica com a equipe de gabinete', 'realizado', '2026-08-17 14:00-03', '2026-08-17 15:30-03', '2026-08-17 14:10-03', 'presencial', 'Gabinete em Brasília', 'Educação')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3301, 6, v_id_encontro, '2026-08-17 14:10-03', 'presencial', 'Escuta diagnóstica com assessoria sobre desafios e oportunidades do mandato em educação.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3301, 14, 7, 'Imersão de planejamento estratégico', 'realizado', '2026-08-24 16:00-03', '2026-08-24 18:00-03', '2026-08-24 16:05-03', 'presencial', 'Gabinete em Brasília', 'Educação')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3301, 7, v_id_encontro, '2026-08-24 16:05-03', 'presencial', 'Imersão de planejamento estratégico: definição dos objetivos do ano e da análise de conjuntura.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3301, 15, 9, 'Diagnóstico de organograma do gabinete', 'realizado', '2026-08-31 09:00-03', '2026-08-31 10:00-03', '2026-08-31 09:05-03', 'presencial', 'Gabinete em Brasília', 'Educação')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3301, 9, v_id_encontro, '2026-08-31 09:05-03', 'presencial', 'Diagnóstico do organograma atual do gabinete e levantamento de adequações necessárias.', jsonb_build_object('adequacoes', 'Criar função dedicada de acompanhamento legislativo da pauta de educação.'), v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3301, 15, 10, 'Proposta de novo organograma do gabinete', 'realizado', '2026-09-01 10:00-03', '2026-09-01 11:00-03', '2026-09-01 10:05-03', 'online', NULL, 'Educação')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3301, 10, v_id_encontro, '2026-09-01 10:05-03', 'sistema', 'Proposta de novo organograma apresentada e ajustada com a gestora do mandato.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3301, 15, 8, 'Reunião semanal de gabinete', 'realizado', '2026-09-08 15:00-03', '2026-09-08 16:00-03', '2026-09-08 15:10-03', 'online', NULL, 'Educação')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, nr_sequencia, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3301, 8, v_id_encontro, 1, '2026-09-08 15:10-03', 'sistema', 'Reunião semanal 1: acompanhamento do PL do Compromisso Nacional pela Educação Integral.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3301, 15, 8, 'Reunião semanal de gabinete', 'realizado', '2026-09-15 15:00-03', '2026-09-15 16:00-03', '2026-09-15 15:10-03', 'online', NULL, 'Educação')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, nr_sequencia, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3301, 8, v_id_encontro, 2, '2026-09-15 15:10-03', 'sistema', 'Reunião semanal 2: alinhamento sobre articulação com a Frente Parlamentar da Educação.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3301, 15, 8, 'Reunião semanal de gabinete', 'realizado', '2026-09-22 15:00-03', '2026-09-22 16:00-03', '2026-09-22 15:10-03', 'online', NULL, 'Educação')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, nr_sequencia, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3301, 8, v_id_encontro, 3, '2026-09-22 15:10-03', 'sistema', 'Reunião semanal 3: revisão do mapeamento de apoio de parlamentares ao PL.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, modalidade, local, tema_prioritario)
  VALUES (3301, 15, 8, 'Reunião semanal de gabinete', 'planejado', '2026-09-29 15:00-03', '2026-09-29 16:00-03', 'online', NULL, 'Educação');

  -- ===========================================================================
  -- 3303 — ABIDAN HENRIQUE: início 31/08, régua concluída até Diagnóstico,
  -- Imersão em andamento.
  -- ===========================================================================
  UPDATE fat_etapa_contrato SET dt_inicio = '2026-08-31', dt_conclusao = '2026-09-06' WHERE id_contrato = 3303 AND id_etapa = 12;
  UPDATE fat_etapa_contrato SET dt_inicio = '2026-09-07', dt_conclusao = '2026-09-20' WHERE id_contrato = 3303 AND id_etapa = 13;
  UPDATE fat_etapa_contrato SET dt_inicio = '2026-09-21' WHERE id_contrato = 3303 AND id_etapa = 14;

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3303, 12, 4, 'Pontapé do mandato', 'realizado', '2026-08-31 09:00-03', '2026-08-31 10:00-03', '2026-08-31 09:05-03', 'presencial', 'Gabinete na Assembleia Legislativa', 'Segurança Pública')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3303, 4, v_id_encontro, '2026-08-31 09:05-03', 'presencial', 'Kickoff do mandato: alinhamento de prioridades e assinatura do termo de compromisso.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3303, 13, 5, 'Comitê político — diagnóstico inicial', 'realizado', '2026-09-07 10:30-03', '2026-09-07 11:30-03', '2026-09-07 10:35-03', 'presencial', 'Gabinete na Assembleia Legislativa', 'Segurança Pública')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3303, 5, v_id_encontro, '2026-09-07 10:35-03', 'presencial', 'Mapeamento político inicial: aliados, opositores e prioridades legislativas do ano.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3303, 13, 6, 'Escuta diagnóstica com a equipe de gabinete', 'realizado', '2026-09-14 14:00-03', '2026-09-14 15:30-03', '2026-09-14 14:10-03', 'presencial', 'Gabinete na Assembleia Legislativa', 'Segurança Pública')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3303, 6, v_id_encontro, '2026-09-14 14:10-03', 'presencial', 'Escuta diagnóstica com assessoria sobre desafios e oportunidades do mandato em segurança pública.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (3303, 14, 7, 'Imersão de planejamento estratégico', 'realizado', '2026-09-21 09:00-03', '2026-09-21 11:00-03', '2026-09-21 09:05-03', 'presencial', 'Gabinete na Assembleia Legislativa', 'Segurança Pública')
  RETURNING id_encontro INTO v_id_encontro;
  INSERT INTO fat_registro (id_contrato, id_tipo_registro, id_encontro, ocorrido_em, canal, resumo, conteudo, id_usuario_autor)
  VALUES (3303, 7, v_id_encontro, '2026-09-21 09:05-03', 'presencial', 'Imersão de planejamento estratégico: definição dos objetivos do ano e da análise de conjuntura.', '{}', v_id_usuario);

  INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, modalidade, local, tema_prioritario)
  VALUES (3303, 14, 7, 'Fechamento da imersão — validação do planejamento com a gestora', 'planejado', '2026-10-05 10:00-03', '2026-10-05 11:30-03', 'online', NULL, 'Segurança Pública');

  -- Participantes (mesma regra dos 3 contratos: gestora legisla presente quando realizado).
  INSERT INTO rel_encontro_participante (id_encontro, id_usuario, origem, presente)
  SELECT id_encontro, v_id_usuario, 'legisla', (status = 'realizado') FROM fat_encontro WHERE id_contrato IN (3301, 3302, 3303);
END $$;

COMMIT;
