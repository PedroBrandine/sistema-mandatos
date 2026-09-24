-- =============================================================================
-- Popula dados de demonstração nos contratos do PLL (Programa de Liderança
-- Parlamentar) que já existem no dev -- os criados pelo vínculo TSE da aba
-- Participantes. Pedido do Pedro em 2026-09-24: "mentorias, diagnóstico,
-- planejamento estratégico".
--
-- Por contrato:
--   * cronologia: início recuado para julho/agosto de 2026 (escalonado, 3 dias
--     entre contratos), para haver passado a mostrar -- decisão do Pedro. As
--     datas previstas da régua andam o mesmo tanto; Pontapé e Imersão ficam
--     concluídos e Mentorias em andamento;
--   * mentor(a): rodízio entre as gestoras bastidores / conhecimento /
--     aceleracao (decisão do Pedro), via rel_usuario_contrato papel 'mentor';
--   * mentorias: as 5 previstas (ref_tipo_registro 'mentoria', qtd lida do
--     banco) espaçadas a cada 24 dias; as passadas realizadas e com registro
--     do mentor, a próxima agendada, o resto sem agendamento. Variações: uma
--     mentoria cancelada e refeita, e alguns contratos com a última mentoria
--     passada ainda "planejada" (atrasada, sem registro);
--   * planejamento estratégico: objetivo do ano, legado, conjuntura, perfil de
--     atuação, 2 objetivos x 2 metas x 5 sucessos mensais (ago-dez/2026);
--     meses passados com atingimento, futuros pendentes; recalcula o %;
--   * diagnóstico do participante: desafios, destaques, ambição política
--     (texto + até 3 tags) e SWOT -- só quando ainda estão vazios;
--   * 2 contratos encerrados (1 desistente, 1 desligado) para a distribuição
--     de status do Dashboard não ficar 100% ativa.
--
-- Conteúdo 100% fictício e genérico por tema (5 temas em rodízio) -- não
-- afirma nada sobre os parlamentares reais cujos nomes estão no cadastro.
--
-- IDEMPOTENTE: contrato cujo planejamento já tem objetivo é pulado inteiro
-- (inclusive o que já foi populado por uma execução anterior deste arquivo);
-- diagnóstico só é preenchido se estiver vazio; mentor entra com ON CONFLICT.
--
-- NÃO É MIGRATION: só mexe em dados. Roda com
-- `supabase db query --linked --file scripts/seed/07_popular_pll_demo.sql`
-- contra DEV (confira `supabase/.temp/project-ref` antes -- docs/ambientes.md).
-- Produção não recebe seed.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_id_produto      bigint;
  v_id_etapa_pontape bigint;
  v_id_etapa_imersao bigint;
  v_id_etapa_mentor  bigint;
  v_id_tipo_mentoria bigint;
  v_qtd_mentorias    int;
  v_mentores         bigint[];
  v_temas            jsonb;
  v_tema             jsonb;
  v_obj              jsonb;
  v_meta             jsonb;
  r                  record;
  v_i                int := 0;
  v_inicio           date;
  v_delta            int;
  v_mentor           bigint;
  v_fim              date;
  v_encerrado        text;
  v_k                int;
  v_dia_slot         date;
  v_quando           timestamptz;
  v_id_encontro      bigint;
  v_proxima_marcada  boolean;
  v_ultima_passada   int;
  v_id_objetivo      bigint;
  v_id_meta          bigint;
  v_o                int;
  v_m                int;
  v_s                int;
  v_mes              date;
  v_pct              numeric;
  v_populados        int := 0;
  v_pulados          int := 0;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Pré-requisitos (falha alto em vez de popular pela metade)
  -- ---------------------------------------------------------------------------
  SELECT id_produto INTO v_id_produto FROM ref_produto WHERE nome = 'PLL';
  IF v_id_produto IS NULL THEN RAISE EXCEPTION 'Produto PLL não encontrado em ref_produto'; END IF;

  SELECT id_etapa INTO v_id_etapa_pontape FROM ref_etapa WHERE id_produto = v_id_produto AND codigo = 'pontape';
  SELECT id_etapa INTO v_id_etapa_imersao FROM ref_etapa WHERE id_produto = v_id_produto AND codigo = 'imersao';
  SELECT id_etapa INTO v_id_etapa_mentor  FROM ref_etapa WHERE id_produto = v_id_produto AND codigo = 'mentorias';
  IF v_id_etapa_pontape IS NULL OR v_id_etapa_imersao IS NULL OR v_id_etapa_mentor IS NULL THEN
    RAISE EXCEPTION 'Régua do PLL incompleta (pontape/imersao/mentorias)';
  END IF;

  SELECT id_tipo_registro, qtd_prevista INTO v_id_tipo_mentoria, v_qtd_mentorias
    FROM ref_tipo_registro WHERE id_etapa = v_id_etapa_mentor AND codigo = 'mentoria';
  IF v_id_tipo_mentoria IS NULL OR v_qtd_mentorias IS NULL THEN
    RAISE EXCEPTION 'Tipo de registro "mentoria" do PLL não encontrado';
  END IF;

  SELECT array_agg(id_usuario ORDER BY array_position(
           ARRAY['bastidores@legislabrasil.org','conhecimento@legislabrasil.org','aceleracao@legislabrasil.org'], email))
    INTO v_mentores
    FROM dim_usuario
   WHERE email IN ('bastidores@legislabrasil.org','conhecimento@legislabrasil.org','aceleracao@legislabrasil.org')
     AND ativo;
  IF coalesce(array_length(v_mentores, 1), 0) <> 3 THEN
    RAISE EXCEPTION 'Esperava as 3 gestoras (bastidores/conhecimento/aceleracao) ativas; achei %', coalesce(array_length(v_mentores, 1), 0);
  END IF;

  -- ---------------------------------------------------------------------------
  -- Conteúdo por tema (rodízio). preditor: ref_preditor 7..11; agenda:
  -- ref_agenda_tematica; perfil: ref_perfil_atuacao 5..7.
  -- ---------------------------------------------------------------------------
  v_temas := $json$[
  {
    "agenda": 63, "perfil": 6,
    "objetivo_ano": "Aprovar projeto de lei de busca ativa escolar e tornar o mandato referência regional em permanência estudantil.",
    "legado": "Ser lembrado(a) como quem tirou a evasão escolar da invisibilidade no município e no estado.",
    "conjuntura": "Pauta educacional com apoio amplo no plenário, mas disputando orçamento com obras; secretaria de educação aberta ao diálogo e dados de evasão recém-publicados.",
    "objetivos": [
      {"descricao": "Aprovar o projeto de lei de busca ativa escolar na comissão de educação", "preditor": 11,
       "metas": [
         {"descricao": "Reunir apoio formal de ao menos 8 parlamentares ao projeto", "prioridade": "alta", "classe": "governanca"},
         {"descricao": "Realizar audiência pública com redes de ensino e conselhos tutelares", "prioridade": "media", "classe": "programatica"}]},
      {"descricao": "Posicionar o mandato como referência em permanência estudantil", "preditor": 8,
       "metas": [
         {"descricao": "Publicar boletim bimestral com dados de evasão por região", "prioridade": "media", "classe": "programatica"},
         {"descricao": "Estruturar a assessoria com uma pessoa dedicada à pauta", "prioridade": "baixa", "classe": "governanca"}]}
    ],
    "desafios": ["Equipe pequena para acompanhar comissões e base ao mesmo tempo", "Pouca interlocução com a secretaria de educação", "Agenda do gabinete tomada por demandas pontuais"],
    "destaques": ["Boa relação com professores e grêmios estudantis", "Presença consistente nas redes com conteúdo sobre escola pública"],
    "ambicao_texto": "Consolidar a pauta de educação como marca do mandato e disputar a reeleição com votação ampliada.",
    "ambicao_tags": ["Reeleição", "Educação"],
    "swot": {"forcas": ["Credibilidade na pauta educacional", "Base organizada de professores"],
             "fraquezas": ["Pouca experiência em articulação de plenário", "Assessoria enxuta"],
             "oportunidades": ["Dados recentes de evasão mobilizam a imprensa", "Frente parlamentar da educação em formação"],
             "ameacas": ["Contingenciamento do orçamento da educação", "Concorrência de outros mandatos na mesma pauta"]}
  },
  {
    "agenda": 64, "perfil": 5,
    "objetivo_ano": "Fiscalizar a fila de exames e consultas especializadas e aprovar indicação de mutirões regionais.",
    "legado": "Ser lembrado(a) como o mandato que deu transparência à fila da saúde.",
    "conjuntura": "Fila de especialidades é a principal queixa da população; gestão da saúde pressionada e pouco transparente; imprensa local atenta ao tema.",
    "objetivos": [
      {"descricao": "Dar transparência pública à fila de exames e consultas especializadas", "preditor": 9,
       "metas": [
         {"descricao": "Protocolar pedidos de informação mensais à secretaria de saúde", "prioridade": "alta", "classe": "programatica"},
         {"descricao": "Lançar painel público com a evolução da fila", "prioridade": "alta", "classe": "programatica"}]},
      {"descricao": "Organizar a rede de apoio do mandato na pauta da saúde", "preditor": 7,
       "metas": [
         {"descricao": "Realizar rodas de escuta com conselhos locais de saúde", "prioridade": "media", "classe": "governanca"},
         {"descricao": "Definir fluxo de atendimento de demandas de saúde no gabinete", "prioridade": "baixa", "classe": "governanca"}]}
    ],
    "desafios": ["Volume alto de pedidos individuais de atendimento", "Dificuldade de obter dados oficiais da fila", "Pouco tempo para trabalho legislativo estruturado"],
    "destaques": ["Reconhecimento pelo atendimento direto à população", "Relação próxima com agentes comunitários de saúde"],
    "ambicao_texto": "Transformar o atendimento individual em pauta coletiva de fiscalização e ganhar projeção regional.",
    "ambicao_tags": ["Projeção regional", "Saúde"],
    "swot": {"forcas": ["Capilaridade nos bairros", "Escuta ativa da equipe"],
             "fraquezas": ["Gabinete reativo, pouco planejamento", "Baixa produção legislativa"],
             "oportunidades": ["Tema de alta visibilidade na mídia local", "Conselhos de saúde dispostos a colaborar"],
             "ameacas": ["Retaliação política da gestão", "Expectativa de atendimento individual que o mandato não consegue suprir"]}
  },
  {
    "agenda": 69, "perfil": 7,
    "objetivo_ano": "Articular a aprovação de plano municipal de adaptação climática com participação dos bairros mais expostos.",
    "legado": "Ser lembrado(a) como quem colocou a adaptação climática na agenda das periferias.",
    "conjuntura": "Eventos extremos recentes aumentaram a atenção ao tema; executivo sem plano de adaptação; coletivos locais organizados, mas dispersos.",
    "objetivos": [
      {"descricao": "Construir coalizão pela aprovação do plano de adaptação climática", "preditor": 11,
       "metas": [
         {"descricao": "Formar grupo de trabalho com coletivos e universidades", "prioridade": "alta", "classe": "governanca"},
         {"descricao": "Apresentar minuta do plano em audiência pública", "prioridade": "alta", "classe": "programatica"}]},
      {"descricao": "Pautar o debate climático no plenário e na imprensa", "preditor": 8,
       "metas": [
         {"descricao": "Realizar ciclo de visitas às áreas de risco com a imprensa", "prioridade": "media", "classe": "programatica"},
         {"descricao": "Produzir mapa das áreas mais expostas a enchentes e calor", "prioridade": "media", "classe": "programatica"}]}
    ],
    "desafios": ["Tema visto como distante das urgências cotidianas", "Coletivos parceiros com agendas concorrentes", "Pouca expertise técnica na assessoria"],
    "destaques": ["Forte legitimidade junto a movimentos ambientais", "Boa capacidade de mobilização em atos e audiências"],
    "ambicao_texto": "Liderar uma frente regional pelo clima e ampliar a base para além dos movimentos ambientais.",
    "ambicao_tags": ["Liderança de frente", "Clima"],
    "swot": {"forcas": ["Mobilização de base", "Pauta com apelo entre jovens"],
             "fraquezas": ["Pouca interlocução com o executivo", "Dependência de poucos parceiros técnicos"],
             "oportunidades": ["Financiamento internacional para adaptação", "Atenção pública após eventos extremos"],
             "ameacas": ["Resistência do setor imobiliário", "Esvaziamento do tema fora de períodos de crise"]}
  },
  {
    "agenda": 66, "perfil": 6,
    "objetivo_ano": "Aprovar lei de iluminação e ocupação de espaços públicos como política de prevenção à violência.",
    "legado": "Ser lembrado(a) por tratar segurança pública com prevenção e dados, não só com repressão.",
    "conjuntura": "Sensação de insegurança alta e debate polarizado; guarda municipal em reestruturação; espaço para propostas de prevenção com apoio de comerciantes.",
    "objetivos": [
      {"descricao": "Aprovar o projeto de lei de prevenção pela ocupação dos espaços públicos", "preditor": 9,
       "metas": [
         {"descricao": "Obter parecer favorável na comissão de segurança", "prioridade": "alta", "classe": "governanca"},
         {"descricao": "Mapear com moradores os pontos críticos de iluminação", "prioridade": "media", "classe": "programatica"}]},
      {"descricao": "Construir agenda comum com associações de bairro e comércio", "preditor": 10,
       "metas": [
         {"descricao": "Firmar compromisso público com 5 associações de bairro", "prioridade": "media", "classe": "governanca"},
         {"descricao": "Realizar encontros trimestrais de prestação de contas", "prioridade": "baixa", "classe": "governanca"}]}
    ],
    "desafios": ["Debate polarizado dificulta propostas de prevenção", "Pouca base de dados local sobre violência", "Pressão por respostas rápidas"],
    "destaques": ["Diálogo com comerciantes e associações", "Discurso equilibrado reconhecido por diferentes campos"],
    "ambicao_texto": "Ser referência em segurança pública baseada em evidências e preparar candidatura a cargo majoritário.",
    "ambicao_tags": ["Cargo majoritário", "Segurança pública"],
    "swot": {"forcas": ["Trânsito entre campos políticos diferentes", "Proposta concreta e mensurável"],
             "fraquezas": ["Pouca visibilidade nas redes", "Equipe sem experiência na pauta"],
             "oportunidades": ["Reestruturação da guarda municipal", "Comércio local interessado em parcerias"],
             "ameacas": ["Captura do debate por discursos punitivistas", "Episódios de violência que mudam a agenda de repente"]}
  },
  {
    "agenda": 70, "perfil": 7,
    "objetivo_ano": "Ampliar a rede de proteção às mulheres e aprovar a criação de centros de referência nos bairros.",
    "legado": "Ser lembrado(a) como quem levou a rede de proteção às mulheres para perto de onde elas vivem.",
    "conjuntura": "Aumento dos registros de violência doméstica; rede de proteção concentrada na região central; bancada feminina pequena, mas coesa.",
    "objetivos": [
      {"descricao": "Aprovar a criação de centros de referência da mulher nos bairros", "preditor": 11,
       "metas": [
         {"descricao": "Articular apoio da bancada feminina e de lideranças partidárias", "prioridade": "alta", "classe": "governanca"},
         {"descricao": "Garantir previsão orçamentária na lei orçamentária anual", "prioridade": "alta", "classe": "programatica"}]},
      {"descricao": "Fortalecer a presença do mandato junto a coletivos de mulheres", "preditor": 7,
       "metas": [
         {"descricao": "Realizar escutas em 6 bairros com coletivos de mulheres", "prioridade": "media", "classe": "programatica"},
         {"descricao": "Formar comitê consultivo do mandato para a pauta", "prioridade": "baixa", "classe": "governanca"}]}
    ],
    "desafios": ["Orçamento apertado para novos equipamentos", "Rede de proteção fragmentada entre secretarias", "Agenda do mandato dispersa em muitas pautas"],
    "destaques": ["Credibilidade junto a coletivos de mulheres", "Boa articulação com a bancada feminina"],
    "ambicao_texto": "Liderar a bancada feminina e ser a principal voz da pauta de proteção às mulheres na região.",
    "ambicao_tags": ["Liderança de bancada", "Mulheres"],
    "swot": {"forcas": ["Legitimidade na pauta", "Rede de coletivos parceiros"],
             "fraquezas": ["Dispersão de pautas", "Pouca estrutura de comunicação"],
             "oportunidades": ["Aumento da atenção pública ao tema", "Programas federais de financiamento"],
             "ameacas": ["Cortes orçamentários", "Resistência de parte do plenário"]}
  }
  ]$json$::jsonb;

  -- ---------------------------------------------------------------------------
  -- Um contrato PLL por vez, em ordem estável
  -- ---------------------------------------------------------------------------
  FOR r IN
    SELECT c.id_contrato, c.dt_inicio, d.id_planejamento
      FROM fat_contrato c
      JOIN dim_planejamento d ON d.id_contrato = c.id_contrato
     WHERE c.id_produto = v_id_produto
     ORDER BY c.id_contrato
  LOOP
    v_i := v_i + 1;

    IF EXISTS (SELECT 1 FROM fat_objetivo_especifico WHERE id_planejamento = r.id_planejamento) THEN
      v_pulados := v_pulados + 1;
      CONTINUE;
    END IF;

    v_tema   := v_temas -> ((v_i - 1) % jsonb_array_length(v_temas));
    v_mentor := v_mentores[((v_i - 1) % 3) + 1];
    v_inicio := date '2026-07-01' + (v_i - 1) * 3;
    v_delta  := v_inicio - r.dt_inicio;
    -- 6º e 12º contratos: encerrados (Desistente / Desligado).
    v_encerrado := CASE v_i WHEN 6 THEN 'desistencia' WHEN 12 THEN 'desligamento' END;
    v_fim := CASE WHEN v_encerrado IS NOT NULL THEN v_inicio + 60 END;

    -- Cronologia do contrato e da régua ------------------------------------
    UPDATE fat_contrato
       SET dt_inicio = v_inicio,
           id_etapa_atual = v_id_etapa_mentor,
           status = CASE WHEN v_encerrado IS NOT NULL THEN 'nao_concluido' ELSE status END,
           origem_encerramento = v_encerrado,
           motivo_encerramento = CASE v_encerrado
             WHEN 'desistencia' THEN 'Participante deixou o programa por mudança de função no gabinete.'
             WHEN 'desligamento' THEN 'Desligado(a) do programa por ausência recorrente nas mentorias.'
           END,
           dt_fim = v_fim
     WHERE id_contrato = r.id_contrato;

    UPDATE fat_etapa_contrato
       SET dt_prevista_inicio = dt_prevista_inicio + v_delta,
           dt_prevista_conclusao = dt_prevista_conclusao + v_delta
     WHERE id_contrato = r.id_contrato;

    UPDATE fat_etapa_contrato SET status = 'concluida', dt_inicio = v_inicio, dt_conclusao = v_inicio + 14
     WHERE id_contrato = r.id_contrato AND id_etapa = v_id_etapa_pontape;
    UPDATE fat_etapa_contrato SET status = 'concluida', dt_inicio = v_inicio + 14, dt_conclusao = v_inicio + 21
     WHERE id_contrato = r.id_contrato AND id_etapa = v_id_etapa_imersao;
    UPDATE fat_etapa_contrato SET status = 'em_andamento', dt_inicio = v_inicio + 21, dt_conclusao = NULL
     WHERE id_contrato = r.id_contrato AND id_etapa = v_id_etapa_mentor;

    -- Mentor(a) ---------------------------------------------------------------
    INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato, dt_inicio, dt_fim)
    VALUES (r.id_contrato, v_mentor, 'mentor', v_inicio, v_fim)
    ON CONFLICT (id_contrato, id_usuario, papel_no_contrato) DO NOTHING;

    -- Mentorias ---------------------------------------------------------------
    -- Última mentoria já passada (para o caso "atrasada"): a de maior k com
    -- data < hoje, dentro do período do contrato.
    v_ultima_passada := 0;
    FOR v_k IN 1..v_qtd_mentorias LOOP
      v_dia_slot := v_inicio + 28 + (v_k - 1) * 24;
      IF v_dia_slot < CURRENT_DATE AND (v_fim IS NULL OR v_dia_slot < v_fim) THEN v_ultima_passada := v_k; END IF;
    END LOOP;

    v_proxima_marcada := false;
    FOR v_k IN 1..v_qtd_mentorias LOOP
      v_dia_slot := v_inicio + 28 + (v_k - 1) * 24;
      v_quando := (v_dia_slot + time '14:00') AT TIME ZONE 'America/Sao_Paulo';

      IF v_fim IS NOT NULL AND v_dia_slot >= v_fim THEN
        EXIT;  -- contrato encerrado: nada depois do fim
      END IF;

      -- Slot 1 já tem um encontro "vivo" de antes (ex.: teste manual)? Respeita.
      IF EXISTS (SELECT 1 FROM fat_encontro
                  WHERE id_contrato = r.id_contrato AND id_tipo_registro = v_id_tipo_mentoria
                    AND nr_sequencia = v_k AND status IN ('planejado', 'realizado')) THEN
        CONTINUE;
      END IF;

      IF v_dia_slot < CURRENT_DATE THEN
        -- Variação: de vez em quando a mentoria foi cancelada e refeita.
        IF (v_i + v_k) % 7 = 0 THEN
          INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, nr_sequencia, titulo, status,
                                    dt_prevista_inicio, dt_prevista_fim, modalidade)
          VALUES (r.id_contrato, v_id_etapa_mentor, v_id_tipo_mentoria, v_k, 'Mentoria ' || v_k, 'cancelado',
                  v_quando - interval '5 days', v_quando - interval '5 days' + interval '1 hour', 'online');
        END IF;

        -- Variação: em 1 de cada 4 contratos ativos, a última mentoria passada
        -- ainda não foi registrada (atrasada).
        IF v_k = v_ultima_passada AND v_encerrado IS NULL AND v_i % 4 = 0 THEN
          INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, nr_sequencia, titulo, status,
                                    dt_prevista_inicio, dt_prevista_fim, modalidade)
          VALUES (r.id_contrato, v_id_etapa_mentor, v_id_tipo_mentoria, v_k, 'Mentoria ' || v_k, 'planejado',
                  v_quando, v_quando + interval '1 hour', 'online');
          v_proxima_marcada := true;
          CONTINUE;
        END IF;

        INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, nr_sequencia, titulo, status,
                                  dt_prevista_inicio, dt_prevista_fim, dt_realizada, modalidade)
        VALUES (r.id_contrato, v_id_etapa_mentor, v_id_tipo_mentoria, v_k, 'Mentoria ' || v_k, 'realizado',
                v_quando, v_quando + interval '1 hour', v_quando + interval '1 hour',
                CASE WHEN v_k % 2 = 0 THEN 'presencial' ELSE 'online' END)
        RETURNING id_encontro INTO v_id_encontro;

        INSERT INTO fat_registro (id_contrato, id_tipo_registro, nr_sequencia, id_encontro, ocorrido_em, canal,
                                  resumo, conteudo, id_usuario_autor)
        VALUES (r.id_contrato, v_id_tipo_mentoria, v_k, v_id_encontro, v_quando + interval '1 hour', 'sistema',
                CASE v_k
                  WHEN 1 THEN 'Apresentação do programa e leitura conjunta do diagnóstico. Combinamos as prioridades da imersão e o ritmo das próximas mentorias.'
                  WHEN 2 THEN 'Revisão do planejamento estratégico: ajustamos as metas do primeiro objetivo e definimos quem acompanha cada sucesso mensal.'
                  WHEN 3 THEN 'Acompanhamento das metas: avanço na articulação com parceiros, atraso no material de comunicação. Encaminhamos pedido de apoio da equipe.'
                  WHEN 4 THEN 'Balanço de meio de ciclo: metas de governança em dia, programáticas com atraso. Repriorizamos as entregas até dezembro.'
                  ELSE 'Fechamento do ciclo de mentorias: revisão dos resultados, lições aprendidas e próximos passos do mandato.'
                END,
                '{}'::jsonb, v_mentor);
      ELSIF NOT v_proxima_marcada AND v_encerrado IS NULL THEN
        INSERT INTO fat_encontro (id_contrato, id_etapa, id_tipo_registro, nr_sequencia, titulo, status,
                                  dt_prevista_inicio, dt_prevista_fim, modalidade)
        VALUES (r.id_contrato, v_id_etapa_mentor, v_id_tipo_mentoria, v_k, 'Mentoria ' || v_k, 'planejado',
                v_quando, v_quando + interval '1 hour', 'online');
        v_proxima_marcada := true;
      END IF;
    END LOOP;

    -- Planejamento estratégico ---------------------------------------------
    UPDATE dim_planejamento
       SET id_perfil_atuacao = (v_tema ->> 'perfil')::bigint,
           objetivo_ano = v_tema ->> 'objetivo_ano',
           legado = v_tema ->> 'legado',
           analise_conjuntura = v_tema ->> 'conjuntura'
     WHERE id_planejamento = r.id_planejamento;

    v_o := 0;
    FOR v_obj IN SELECT * FROM jsonb_array_elements(v_tema -> 'objetivos') LOOP
      v_o := v_o + 1;
      INSERT INTO fat_objetivo_especifico (id_planejamento, ordem, descricao, id_preditor_primario, id_agenda, status)
      VALUES (r.id_planejamento, v_o, v_obj ->> 'descricao', (v_obj ->> 'preditor')::bigint,
              (v_tema ->> 'agenda')::bigint, 'ativo')
      RETURNING id_objetivo INTO v_id_objetivo;

      v_m := 0;
      FOR v_meta IN SELECT * FROM jsonb_array_elements(v_obj -> 'metas') LOOP
        v_m := v_m + 1;
        INSERT INTO fat_meta (id_objetivo, ordem, descricao, prioridade, classe, id_usuario_responsavel, status)
        VALUES (v_id_objetivo, v_m, v_meta ->> 'descricao', v_meta ->> 'prioridade', v_meta ->> 'classe', v_mentor, 'ativa')
        RETURNING id_meta INTO v_id_meta;

        -- 5 sucessos mensais (ago-dez/2026), peso 20 cada. Mês já fechado
        -- recebe atingimento (varia por contrato/meta); o mês corrente, um
        -- parcial; os futuros ficam pendentes. Status vem do trigger
        -- trg_sm_deriva_situacao (100% = realizado).
        FOR v_s IN 1..5 LOOP
          v_mes := (date '2026-08-01' + make_interval(months => v_s - 1))::date;
          v_pct := CASE
            WHEN v_encerrado IS NOT NULL AND v_mes >= date_trunc('month', v_fim)::date THEN NULL
            WHEN (v_mes + interval '1 month')::date <= CURRENT_DATE THEN
              (ARRAY[100, 100, 80, 60, 100, 40])[((v_i + v_o * 2 + v_m + v_s) % 6) + 1]
            WHEN v_mes <= CURRENT_DATE THEN (ARRAY[30, 50, 70])[((v_i + v_m) % 3) + 1]
            ELSE NULL
          END;
          INSERT INTO fat_sucesso_mensal (id_meta, descricao, mes_referencia, dt_limite, peso, pct_atingimento,
                                          atualizado_por, atualizado_em, id_usuario_responsavel)
          VALUES (v_id_meta, 'Avanço do mês: ' || lower(left(v_meta ->> 'descricao', 1)) || substr(v_meta ->> 'descricao', 2),
                  v_mes, v_mes + 24, 20, v_pct,
                  CASE WHEN v_pct IS NOT NULL THEN v_mentor END,
                  CASE WHEN v_pct IS NOT NULL THEN least(now(), (v_mes + 24)::timestamptz) END,
                  v_mentor);
        END LOOP;
      END LOOP;
    END LOOP;

    PERFORM app.recalcula_atingimento(r.id_planejamento);

    -- Diagnóstico do participante (só se ainda vazio) ----------------------
    UPDATE fat_cadastro_participante
       SET desafios = ARRAY(SELECT jsonb_array_elements_text(v_tema -> 'desafios')),
           destaques = ARRAY(SELECT jsonb_array_elements_text(v_tema -> 'destaques')),
           ambicao_texto = v_tema ->> 'ambicao_texto',
           ambicao_tags = ARRAY(SELECT jsonb_array_elements_text(v_tema -> 'ambicao_tags')),
           swot_forcas = ARRAY(SELECT jsonb_array_elements_text(v_tema -> 'swot' -> 'forcas')),
           swot_fraquezas = ARRAY(SELECT jsonb_array_elements_text(v_tema -> 'swot' -> 'fraquezas')),
           swot_oportunidades = ARRAY(SELECT jsonb_array_elements_text(v_tema -> 'swot' -> 'oportunidades')),
           swot_ameacas = ARRAY(SELECT jsonb_array_elements_text(v_tema -> 'swot' -> 'ameacas'))
     WHERE id_contrato = r.id_contrato
       AND cardinality(desafios) = 0 AND cardinality(destaques) = 0 AND ambicao_texto IS NULL
       AND cardinality(swot_forcas) = 0 AND cardinality(swot_fraquezas) = 0
       AND cardinality(swot_oportunidades) = 0 AND cardinality(swot_ameacas) = 0;

    v_populados := v_populados + 1;
  END LOOP;

  RAISE NOTICE 'PLL demo: % contrato(s) populado(s), % pulado(s) (já tinham planejamento)', v_populados, v_pulados;
END $$;

COMMIT;
