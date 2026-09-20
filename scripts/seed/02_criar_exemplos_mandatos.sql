-- =============================================================================
-- Cria 3 mandatos de exemplo "do zero", passando pelo fluxo real de cadastro
-- (base TSE -> app.criar_mandato -> planejamento estratégico completo ->
-- agenda), para verificação de KPIs e usabilidade em dev.
--
-- As 3 candidaturas de base vieram de SELECT aleatório em tse.dim_candidatura
-- (dados públicos do TSE, já restritos a cargos do Legislativo -- migration
-- 0022). Toda a camada de planejamento (objetivos, metas, sucessos mensais,
-- legado, objetivo do ano) e agenda é fictícia/ilustrativa.
--
-- Mandatos com 6+ meses de contrato e sucessos mensais com status variados
-- (realizado, não realizado, pendente vencido = "atrasado", pendente futuro)
-- para o gráfico de atingimento mensal ter o que mostrar.
--
-- NÃO É MIGRATION: só mexe em dados. Roda com
-- `supabase db query --linked --file scripts/seed/02_criar_exemplos_mandatos.sql`
-- contra DEV. Produção não recebe seed.
-- =============================================================================

BEGIN;

CREATE FUNCTION pg_temp.gera_sucessos_mensais(
  p_id_meta bigint,
  p_descricao text,
  p_mes_inicio date,
  p_mes_fim date,
  p_usuario bigint
) RETURNS void AS $$
DECLARE
  v_mes date := date_trunc('month', p_mes_inicio)::date;
  v_mes_fim date := date_trunc('month', p_mes_fim)::date;
  v_mes_atual date := date_trunc('month', current_date)::date;
  v_mes_atrasado date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_total_meses int;
  v_peso numeric;
  v_idx int := 0;
  v_status text;
  v_pct numeric;
  v_dt_limite date;
  v_atualizado_em timestamptz;
BEGIN
  v_total_meses := (extract(year from v_mes_fim)::int - extract(year from v_mes)::int) * 12
                  + (extract(month from v_mes_fim)::int - extract(month from v_mes)::int) + 1;
  v_peso := round(100.0 / v_total_meses, 2);

  WHILE v_mes <= v_mes_fim LOOP
    v_idx := v_idx + 1;
    v_dt_limite := v_mes + 24; -- dia 25 do mês de referência
    v_atualizado_em := NULL;

    IF v_mes >= v_mes_atual THEN
      -- mês corrente/futuro: ainda não venceu
      v_status := 'pendente';
      v_pct := NULL;
    ELSIF v_mes = v_mes_atrasado THEN
      -- mês passado imediatamente anterior, deixado pendente de propósito:
      -- é o caso "atrasado" (venceu e ninguém marcou o desfecho ainda)
      v_status := 'pendente';
      v_pct := NULL;
    ELSIF v_idx % 4 = 0 THEN
      -- 1 a cada 4 meses passados: não cumprido
      v_status := 'nao_realizado';
      v_pct := 15 + (v_idx % 3) * 5;
      v_atualizado_em := (v_dt_limite + 2)::timestamptz;
    ELSE
      v_status := 'realizado';
      v_pct := LEAST(100, 72 + (v_idx % 4) * 7);
      v_atualizado_em := (v_dt_limite - 1)::timestamptz;
    END IF;

    INSERT INTO fat_sucesso_mensal
      (id_meta, descricao, mes_referencia, dt_limite, peso, pct_atingimento, status, atualizado_por, atualizado_em, id_usuario_responsavel)
    VALUES (
      p_id_meta,
      p_descricao,
      v_mes,
      v_dt_limite,
      v_peso,
      v_pct,
      v_status,
      CASE WHEN v_status <> 'pendente' THEN p_usuario ELSE NULL END,
      v_atualizado_em,
      p_usuario
    );

    v_mes := (v_mes + interval '1 month')::date;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  v_id_produto bigint;
  v_id_usuario bigint;
  v_result jsonb;
  v_id_contratante bigint;
  v_id_mandato bigint;
  v_id_contrato bigint;
  v_id_planejamento bigint;
  v_id_objetivo bigint;
  v_id_meta bigint;
BEGIN
  SELECT id_produto INTO v_id_produto FROM ref_produto WHERE nome = 'Estratégia';
  SELECT id_usuario INTO v_id_usuario FROM dim_usuario WHERE email = 'conhecimento@legislabrasil.org';

  IF v_id_produto IS NULL OR v_id_usuario IS NULL THEN
    RAISE EXCEPTION 'Pré-requisito ausente: produto Estratégia ou usuário conhecimento@legislabrasil.org';
  END IF;

  -- ===========================================================================
  -- MANDATO 1 — Luizinho Garcia (MDB), Vereador em Igaraçu do Tietê/SP
  -- Candidatura real: tse.dim_candidatura ano_eleicao=2024 sq_candidato=250002326497 turno=1
  -- Contrato de Estratégia iniciado há ~7,5 meses (2026-02-02)
  -- ===========================================================================
  v_result := app.criar_mandato(
    p_contratante := jsonb_build_object(
      'nome', 'Luiz Antonio Garcia Guilhen',
      'sg_uf', 'SP',
      'nm_municipio', 'Igaraçu do Tietê'
    ),
    p_mandato := jsonb_build_object(
      'nr_titulo_eleitoral', '463268740116',
      'nm_civil', 'Luiz Antonio Garcia Guilhen',
      'nm_urna', 'Luizinho Garcia',
      'ds_genero', 'Masculino',
      'id_partido_atual', 42,
      'id_cargo_atual', 1,
      'potencial_futuro', 'Médio — primeiro mandato, boa avaliação na zona rural',
      'relevancia_politica', 'Local',
      'confianca', 'Alta',
      'risco_democratico', 'Baixo',
      'espectro_politico', 'Centro'
    ),
    p_candidatura := jsonb_build_object(
      'ano_eleicao', 2024, 'sq_candidato', 250002326497, 'nr_turno', 1,
      'metodo_match', 'titulo_eleitoral', 'confianca', 'alta'
    ),
    p_contrato := jsonb_build_object('id_produto', v_id_produto, 'dt_inicio', '2026-02-02')
  );
  v_id_contratante := (v_result->>'id_contratante')::bigint;
  v_id_mandato := (v_result->>'id_mandato')::bigint;
  v_id_contrato := (v_result->>'id_contrato')::bigint;

  UPDATE dim_mandato SET
    minibiografia = 'Vereador em primeiro mandato, eleito pela zona rural de Igaraçu do Tietê. Antes da política, atuava como técnico agrícola.',
    principais_pautas = ARRAY['Saúde', 'Agricultura Familiar e Segurança Alimentar']
  WHERE id_mandato = v_id_mandato;

  UPDATE dim_planejamento SET
    id_perfil_atuacao = 5, -- Fiscalizadora
    objetivo_ano = 'Consolidar a atuação fiscalizadora na Câmara Municipal e aprovar ao menos duas leis de iniciativa própria voltadas à saúde básica, ampliando a presença do mandato nos bairros da zona rural.',
    legado = 'Ser lembrado como o vereador que profissionalizou o acompanhamento do orçamento municipal e abriu o gabinete para escuta permanente da população.',
    analise_conjuntura = 'Câmara com maioria de situação, mas a pauta de saúde tem apoio bipartidário; eleição municipal de 2028 já movimenta articulações locais.'
  WHERE id_contrato = v_id_contrato
  RETURNING id_planejamento INTO v_id_planejamento;

  INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato, cargo)
  VALUES (v_id_contrato, v_id_usuario, 'gestora', 'nao_se_aplica');

  -- Objetivo 1: fiscalização do gasto em saúde
  INSERT INTO fat_objetivo_especifico (id_planejamento, ordem, descricao, id_preditor_primario, id_agenda, status)
  VALUES (v_id_planejamento, 1, 'Ampliar a fiscalização do gasto público municipal, com foco na Secretaria de Saúde', 7, 64, 'ativo')
  RETURNING id_objetivo INTO v_id_objetivo;

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 1, 'Protocolar pedidos de informação trimestrais sobre execução orçamentária da Saúde', 'alta', 'governanca', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta;
  PERFORM pg_temp.gera_sucessos_mensais(v_id_meta, 'Acompanhamento mensal da execução orçamentária da Saúde', '2026-02-01', '2026-09-01', v_id_usuario);

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 2, 'Realizar visitas mensais às unidades básicas de saúde da zona rural', 'media', 'programatica', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta;
  PERFORM pg_temp.gera_sucessos_mensais(v_id_meta, 'Visita mensal a UBS da zona rural com registro fotográfico e escuta', '2026-02-01', '2026-09-01', v_id_usuario);

  -- Objetivo 2: lei de ronda odontológica itinerante
  INSERT INTO fat_objetivo_especifico (id_planejamento, ordem, descricao, id_preditor_primario, id_agenda, status)
  VALUES (v_id_planejamento, 2, 'Aprovar lei de iniciativa própria criando ronda itinerante de atendimento odontológico na zona rural', 8, 64, 'ativo')
  RETURNING id_objetivo INTO v_id_objetivo;

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 1, 'Protocolar e tramitar o projeto de lei até dezembro de 2026', 'alta', 'governanca', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta;
  PERFORM pg_temp.gera_sucessos_mensais(v_id_meta, 'Avanço mensal da tramitação do PL de odontologia itinerante', '2026-03-01', '2026-09-01', v_id_usuario);

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 2, 'Construir apoio de pelo menos 6 vereadores para a aprovação do projeto', 'media', 'programatica', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta;
  PERFORM pg_temp.gera_sucessos_mensais(v_id_meta, 'Rodada mensal de conversas com vereadores para construir apoio ao PL', '2026-03-01', '2026-09-01', v_id_usuario);

  PERFORM app.recalcula_atingimento(v_id_planejamento);

  -- Agenda: um encontro realizado, um planejado próximo, um planejado mais à frente
  INSERT INTO fat_encontro (id_contrato, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (v_id_contrato, 8, 'Reunião semanal de gabinete', 'realizado', '2026-09-08 14:00-03', '2026-09-08 15:00-03', '2026-09-08 14:10-03', 'presencial', 'Gabinete do vereador, Câmara Municipal de Igaraçu do Tietê', 'Saúde');
  INSERT INTO fat_encontro (id_contrato, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, modalidade, local, tema_prioritario)
  VALUES (v_id_contrato, 6, 'Escuta diagnóstica com moradores da zona rural', 'planejado', '2026-09-26 09:00-03', '2026-09-26 11:00-03', 'presencial', 'Salão comunitário do Bairro Água Branca', 'Agricultura Familiar e Segurança Alimentar');
  INSERT INTO fat_encontro (id_contrato, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, modalidade, tema_prioritario)
  VALUES (v_id_contrato, 5, 'Comitê político — articulação do PL de odontologia itinerante', 'planejado', '2026-10-14 10:00-03', '2026-10-14 11:30-03', 'online', 'Saúde');

  INSERT INTO rel_encontro_participante (id_encontro, id_usuario, origem, presente)
  SELECT id_encontro, v_id_usuario, 'legisla', (status = 'realizado') FROM fat_encontro WHERE id_contrato = v_id_contrato;
  INSERT INTO rel_encontro_participante (id_encontro, nome_livre, origem, presente)
  SELECT id_encontro, 'Chefe de gabinete', 'mandato', (status = 'realizado') FROM fat_encontro WHERE id_contrato = v_id_contrato AND status = 'realizado';

  -- ===========================================================================
  -- MANDATO 2 — Gerson Pessoa (PODE), Deputado Estadual em SP
  -- Candidatura real: tse.dim_candidatura ano_eleicao=2022 sq_candidato=250001610498 turno=1
  -- Contrato de Estratégia iniciado há ~9,5 meses (2025-12-01)
  -- ===========================================================================
  v_result := app.criar_mandato(
    p_contratante := jsonb_build_object(
      'nome', 'Gerson Dias Pessoa',
      'sg_uf', 'SP',
      'nm_municipio', 'São Paulo'
    ),
    p_mandato := jsonb_build_object(
      'nr_titulo_eleitoral', '294545690175',
      'nm_civil', 'Gerson Dias Pessoa',
      'nm_urna', 'Gerson Pessoa',
      'ds_genero', 'Masculino',
      'id_partido_atual', 46,
      'id_cargo_atual', 4,
      'potencial_futuro', 'Alto — cotado para reeleição com folga',
      'relevancia_politica', 'Estadual',
      'confianca', 'Média',
      'risco_democratico', 'Baixo',
      'espectro_politico', 'Centro'
    ),
    p_candidatura := jsonb_build_object(
      'ano_eleicao', 2022, 'sq_candidato', 250001610498, 'nr_turno', 1,
      'metodo_match', 'titulo_eleitoral', 'confianca', 'alta'
    ),
    p_contrato := jsonb_build_object('id_produto', v_id_produto, 'dt_inicio', '2025-12-01')
  );
  v_id_contratante := (v_result->>'id_contratante')::bigint;
  v_id_mandato := (v_result->>'id_mandato')::bigint;
  v_id_contrato := (v_result->>'id_contrato')::bigint;

  UPDATE dim_mandato SET
    minibiografia = 'Deputado estadual em primeiro mandato, com base eleitoral pulverizada em municípios do interior paulista.',
    principais_pautas = ARRAY['Trabalho, Emprego e Renda', 'Segurança Pública']
  WHERE id_mandato = v_id_mandato;

  UPDATE dim_planejamento SET
    id_perfil_atuacao = 7, -- Articuladora/Mobilizadora
    objetivo_ano = 'Pautar a agenda de segurança pública e emprego no interior paulista, com pelo menos uma audiência pública por região administrativa visitada.',
    legado = 'Ser referência estadual em articulação com prefeituras do interior para captação de recursos e políticas de emprego.',
    analise_conjuntura = 'Governo estadual com pauta econômica favorável, mas orçamento de segurança disputado; mandato em primeiro ano de legislatura, ainda construindo capilaridade.'
  WHERE id_contrato = v_id_contrato
  RETURNING id_planejamento INTO v_id_planejamento;

  INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato, cargo)
  VALUES (v_id_contrato, v_id_usuario, 'gestora', 'nao_se_aplica');

  -- Objetivo 1: articulação com prefeituras do interior
  INSERT INTO fat_objetivo_especifico (id_planejamento, ordem, descricao, id_preditor_primario, id_agenda, status)
  VALUES (v_id_planejamento, 1, 'Ampliar a articulação com prefeituras do interior para captação de recursos e geração de emprego', 9, 76, 'ativo')
  RETURNING id_objetivo INTO v_id_objetivo;

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 1, 'Realizar rodada de reuniões com prefeitos de 10 municípios prioritários', 'alta', 'programatica', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta;
  PERFORM pg_temp.gera_sucessos_mensais(v_id_meta, 'Reuniões mensais com prefeituras do interior sobre captação de recursos', '2025-12-01', '2026-09-01', v_id_usuario);

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 2, 'Protocolar emendas parlamentares para projetos de geração de emprego', 'media', 'governanca', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta;
  PERFORM pg_temp.gera_sucessos_mensais(v_id_meta, 'Avanço mensal do protocolo de emendas para geração de emprego', '2025-12-01', '2026-09-01', v_id_usuario);

  -- Objetivo 2: segurança pública no interior
  INSERT INTO fat_objetivo_especifico (id_planejamento, ordem, descricao, id_preditor_primario, id_agenda, status)
  VALUES (v_id_planejamento, 2, 'Pautar o debate estadual sobre segurança pública no interior paulista', 8, 66, 'ativo')
  RETURNING id_objetivo INTO v_id_objetivo;

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 1, 'Organizar audiência pública regional sobre efetivo policial no interior', 'alta', 'programatica', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta;
  PERFORM pg_temp.gera_sucessos_mensais(v_id_meta, 'Preparação mensal da audiência pública sobre efetivo policial', '2026-01-01', '2026-09-01', v_id_usuario);

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 2, 'Apresentar requerimento de dados de criminalidade por região administrativa', 'media', 'governanca', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta;
  PERFORM pg_temp.gera_sucessos_mensais(v_id_meta, 'Acompanhamento mensal dos dados de criminalidade por região', '2026-01-01', '2026-09-01', v_id_usuario);

  PERFORM app.recalcula_atingimento(v_id_planejamento);

  INSERT INTO fat_encontro (id_contrato, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (v_id_contrato, 5, 'Comitê político — balanço do 1º semestre', 'realizado', '2026-09-05 10:00-03', '2026-09-05 12:00-03', '2026-09-05 10:15-03', 'presencial', 'Gabinete na Assembleia Legislativa de SP', 'Trabalho, Emprego e Renda');
  INSERT INTO fat_encontro (id_contrato, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, modalidade, local, tema_prioritario)
  VALUES (v_id_contrato, 6, 'Audiência pública regional — efetivo policial no interior', 'planejado', '2026-10-02 09:00-03', '2026-10-02 12:00-03', 'presencial', 'Câmara Municipal de Sorocaba', 'Segurança Pública');
  INSERT INTO fat_encontro (id_contrato, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, modalidade, tema_prioritario)
  VALUES (v_id_contrato, 8, 'Reunião semanal de equipe', 'planejado', '2026-09-28 15:00-03', '2026-09-28 16:00-03', 'online', 'Trabalho, Emprego e Renda');

  INSERT INTO rel_encontro_participante (id_encontro, id_usuario, origem, presente)
  SELECT id_encontro, v_id_usuario, 'legisla', (status = 'realizado') FROM fat_encontro WHERE id_contrato = v_id_contrato;

  -- ===========================================================================
  -- MANDATO 3 — Delegado da Cunha (PP), Deputado Federal em SP
  -- Candidatura real: tse.dim_candidatura ano_eleicao=2022 sq_candidato=250001611974 turno=1
  -- Contrato de Estratégia iniciado há ~8 meses (2026-01-15)
  -- ===========================================================================
  v_result := app.criar_mandato(
    p_contratante := jsonb_build_object(
      'nome', 'Carlos Alberto da Cunha',
      'sg_uf', 'SP',
      'nm_municipio', 'São Paulo'
    ),
    p_mandato := jsonb_build_object(
      'nr_titulo_eleitoral', '256721740124',
      'nm_civil', 'Carlos Alberto da Cunha',
      'nm_urna', 'Delegado da Cunha',
      'ds_genero', 'Masculino',
      'id_partido_atual', 38,
      'id_cargo_atual', 6,
      'potencial_futuro', 'Alto — figura técnica com histórico de segurança pública',
      'relevancia_politica', 'Nacional',
      'confianca', 'Alta',
      'risco_democratico', 'Baixo',
      'espectro_politico', 'Direita'
    ),
    p_candidatura := jsonb_build_object(
      'ano_eleicao', 2022, 'sq_candidato', 250001611974, 'nr_turno', 1,
      'metodo_match', 'titulo_eleitoral', 'confianca', 'alta'
    ),
    p_contrato := jsonb_build_object('id_produto', v_id_produto, 'dt_inicio', '2026-01-15')
  );
  v_id_contratante := (v_result->>'id_contratante')::bigint;
  v_id_mandato := (v_result->>'id_mandato')::bigint;
  v_id_contrato := (v_result->>'id_contrato')::bigint;

  UPDATE dim_mandato SET
    minibiografia = 'Deputado federal em primeiro mandato, ex-delegado de polícia, com pauta concentrada em segurança pública.',
    principais_pautas = ARRAY['Segurança Pública', 'Justiça e Cidadania']
  WHERE id_mandato = v_id_mandato;

  UPDATE dim_planejamento SET
    id_perfil_atuacao = 6, -- Legisladora
    objetivo_ano = 'Consolidar a pauta de segurança pública no Congresso e aprovar substitutivo de projeto de lei sobre policiamento comunitário.',
    legado = 'Ser um dos nomes de referência nacional em segurança pública, com histórico técnico (delegado) reconhecido por outros parlamentares.',
    analise_conjuntura = 'Câmara dos Deputados com pauta de segurança em alta após casos de repercussão nacional; disputa de protagonismo com outras bancadas da segurança.'
  WHERE id_contrato = v_id_contrato
  RETURNING id_planejamento INTO v_id_planejamento;

  INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato, cargo)
  VALUES (v_id_contrato, v_id_usuario, 'gestora', 'nao_se_aplica');

  -- Objetivo 1: substitutivo de policiamento comunitário
  INSERT INTO fat_objetivo_especifico (id_planejamento, ordem, descricao, id_preditor_primario, id_agenda, status)
  VALUES (v_id_planejamento, 1, 'Aprovar substitutivo do PL de policiamento comunitário', 8, 66, 'ativo')
  RETURNING id_objetivo INTO v_id_objetivo;

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 1, 'Reunir apoio da bancada da segurança pública para o substitutivo', 'alta', 'governanca', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta;
  PERFORM pg_temp.gera_sucessos_mensais(v_id_meta, 'Articulação mensal com a bancada da segurança pública', '2026-01-01', '2026-09-01', v_id_usuario);

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 2, 'Levar o substitutivo à pauta da Comissão de Segurança Pública', 'alta', 'governanca', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta;
  PERFORM pg_temp.gera_sucessos_mensais(v_id_meta, 'Avanço mensal da tramitação na Comissão de Segurança Pública', '2026-02-01', '2026-09-01', v_id_usuario);

  -- Objetivo 2: presença de base em SP
  INSERT INTO fat_objetivo_especifico (id_planejamento, ordem, descricao, id_preditor_primario, id_agenda, status)
  VALUES (v_id_planejamento, 2, 'Ampliar a presença de mídia e a base eleitoral em São Paulo', 11, 67, 'ativo')
  RETURNING id_objetivo INTO v_id_objetivo;

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 1, 'Realizar agenda mensal de rua em regiões estratégicas de São Paulo', 'media', 'programatica', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta;
  PERFORM pg_temp.gera_sucessos_mensais(v_id_meta, 'Agenda de rua mensal em regiões estratégicas de São Paulo', '2026-01-01', '2026-09-01', v_id_usuario);

  INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
  VALUES (v_id_objetivo, 2, 'Ampliar a base de assessoria de comunicação digital', 'baixa', 'governanca', v_id_usuario, 'ativa')
  RETURNING id_meta INTO v_id_meta;
  PERFORM pg_temp.gera_sucessos_mensais(v_id_meta, 'Evolução mensal da estrutura de comunicação digital', '2026-02-01', '2026-09-01', v_id_usuario);

  PERFORM app.recalcula_atingimento(v_id_planejamento);

  INSERT INTO fat_encontro (id_contrato, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade, local, tema_prioritario)
  VALUES (v_id_contrato, 5, 'Comitê político — estratégia do substitutivo de segurança pública', 'realizado', '2026-09-10 11:00-03', '2026-09-10 12:30-03', '2026-09-10 11:05-03', 'presencial', 'Gabinete em Brasília', 'Segurança Pública');
  INSERT INTO fat_encontro (id_contrato, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, modalidade, local, tema_prioritario)
  VALUES (v_id_contrato, 8, 'Reunião semanal de equipe', 'planejado', '2026-09-29 09:00-03', '2026-09-29 10:00-03', 'online', NULL, 'Justiça e Cidadania');
  INSERT INTO fat_encontro (id_contrato, id_tipo_registro, titulo, status, dt_prevista_inicio, dt_prevista_fim, modalidade, local, tema_prioritario)
  VALUES (v_id_contrato, 6, 'Agenda de rua na Zona Leste de São Paulo', 'planejado', '2026-10-05 10:00-03', '2026-10-05 13:00-03', 'presencial', 'Zona Leste, São Paulo/SP', 'Justiça e Cidadania');

  INSERT INTO rel_encontro_participante (id_encontro, id_usuario, origem, presente)
  SELECT id_encontro, v_id_usuario, 'legisla', (status = 'realizado') FROM fat_encontro WHERE id_contrato = v_id_contrato;
END $$;

COMMIT;
