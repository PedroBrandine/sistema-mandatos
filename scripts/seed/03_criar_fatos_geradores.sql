-- =============================================================================
-- Cria 10 Fatos Geradores de exemplo para cada um dos 3 mandatos criados em
-- 02_criar_exemplos_mandatos.sql, para testar os indicadores de Incidência
-- (IipCard, contagem realizados/projetados, Linha do Tempo / Ciclo de Vida).
--
-- Insert direto em fat_fato_gerador (não via app.criar_fato_gerador, que exige
-- app.id_usuario()/sessão autenticada) -- replica o que a RPC faria.
--
-- Variação proposital nas dimensões que a tela hoje usa: situacao
-- (realizado/projetado), tipologia (espalhada pelos 11 grupos do catálogo),
-- niveis D1/D2/D3 (usando o padrão de cada tipologia), preditores,
-- contribuicao_legisla (0-5) e origem (rel_fato_origem apontando para Metas
-- já existentes, com alguns fatos deliberadamente sem origem -- caminho
-- válido no modelo).
--
-- CAVEAT (não resolvido aqui, decisão deliberada CAT-16 "não inventar peso de
-- negócio"): ref_tipologia.id_indicador está NULL em todas as 51 linhas do
-- catálogo, então mv_iip_contrato.iip_provisorio permanece NULL e o IipCard
-- mostra "sem dado suficiente" mesmo com estes fatos. nr_fatos e a contagem
-- realizados/projetados SIM vão refletir os dados novos. Se quiser o número
-- de IIP aparecendo de verdade, é preciso popular ref_indicador.peso_iip e
-- apontar id_indicador em algumas tipologias -- decisão de negócio, não feita
-- aqui sem confirmação.
--
-- NÃO É MIGRATION: só mexe em dados. Roda com
-- `supabase db query --linked --file scripts/seed/03_criar_fatos_geradores.sql`
-- contra DEV. Produção não recebe seed.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_id_usuario bigint;
  v_id_fato bigint;
BEGIN
  SELECT id_usuario INTO v_id_usuario FROM dim_usuario WHERE email = 'conhecimento@legislabrasil.org';
  IF v_id_usuario IS NULL THEN
    RAISE EXCEPTION 'Usuário conhecimento@legislabrasil.org não encontrado';
  END IF;

  -- ===========================================================================
  -- MANDATO 1 — Luiz Antonio Garcia Guilhen "Luizinho Garcia" (id_contrato=3119)
  -- ===========================================================================

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3119, 108, 'Diagnóstico estratégico do mandato concluído', 'baixo', 'baixo', 'baixo', 7, NULL, 3, 'Levantamento inicial de prioridades legislativas e territoriais do gabinete.', 'realizado', '2026-02-10', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3119, 131, 'Pedido de informação sobre execução orçamentária da Saúde', 'baixo', 'baixo', 'baixo', 8, 7, 2, 'Requerimento protocolado cobrando execução do orçamento da Secretaria de Saúde.', 'realizado', '2026-03-05', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_meta) VALUES (v_id_fato, 642);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3119, 132, 'Secretaria de Saúde respondeu ao requerimento', 'medio', 'medio', 'medio', 8, 11, 3, 'Resposta formal recebida com planilha de execução orçamentária do trimestre.', 'realizado', '2026-04-20', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3119, 127, 'Escuta diagnóstica convocada nos bairros rurais', 'baixo', 'baixo', 'baixo', 8, 7, 2, 'Convocação de escuta com moradores do Bairro Água Branca sobre saúde e agricultura familiar.', 'realizado', '2026-05-12', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3119, 128, 'Visita às UBS da zona rural realizada com boa adesão', 'medio', 'medio', 'baixo', 8, 9, 4, 'Visita a 3 unidades básicas de saúde da zona rural, com registro fotográfico e lista de presença.', 'realizado', '2026-05-28', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_meta) VALUES (v_id_fato, 643);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3119, 112, 'PL de ronda odontológica itinerante apresentado', 'baixo', 'baixo', 'baixo', 7, 8, 3, 'Projeto de lei protocolado na Câmara Municipal criando ronda odontológica para a zona rural.', 'realizado', '2026-06-15', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_meta) VALUES (v_id_fato, 644);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3119, 113, 'PL de odontologia itinerante entra em tramitação ativa', 'baixo', 'medio', 'medio', 11, 8, 3, 'Projeto pautado na Comissão de Saúde e Assistência Social da Câmara.', 'realizado', '2026-08-01', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_prevista, id_usuario_autor)
  VALUES (3119, 139, 'Reunião com associação de produtores rurais', NULL, 'medio', 'baixo', 11, 7, 2, 'Escuta com a associação local sobre segurança alimentar, a confirmar em outubro.', 'projetado', '2026-10-05', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_prevista, id_usuario_autor)
  VALUES (3119, 114, 'Coautoria estratégica planejada para o PL de odontologia', 'medio', 'alto', 'medio', 11, 9, 4, 'Negociação em curso para somar 2 coautores estratégicos ao projeto.', 'projetado', '2026-10-25', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_meta) VALUES (v_id_fato, 645);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_prevista, id_usuario_autor)
  VALUES (3119, 115, 'Votação do PL na Comissão de Saúde prevista', 'medio', 'medio', 'alto', 11, 9, 3, 'Pauta prevista para a Comissão de Saúde e Assistência Social em dezembro.', 'projetado', '2026-12-01', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;

  -- ===========================================================================
  -- MANDATO 2 — Gerson Dias Pessoa "Gerson Pessoa" (id_contrato=3120)
  -- ===========================================================================

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3120, 135, 'Articulação com prefeituras do interior em construção', 'medio', 'medio', 'baixo', 9, 11, 2, 'Primeiras conversas com prefeitos de municípios prioritários sobre captação de recursos.', 'realizado', '2026-01-15', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_meta) VALUES (v_id_fato, 646);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3120, 136, 'Rede de articulação com prefeituras formalizada', 'medio', 'alto', 'baixo', 9, 11, 3, 'Formalizado grupo de trabalho com 6 prefeituras do interior.', 'realizado', '2026-03-10', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3120, 156, 'Emenda parlamentar de geração de emprego apresentada', 'baixo', 'baixo', 'baixo', 11, 7, 2, 'Emenda destinada a programa de qualificação profissional no interior paulista.', 'realizado', '2026-02-20', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_meta) VALUES (v_id_fato, 647);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3120, 157, 'Emenda de geração de emprego aprovada', 'baixo', 'baixo', 'medio', 11, NULL, 3, 'Emenda aprovada no orçamento estadual para o próximo exercício.', 'realizado', '2026-05-05', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3120, 131, 'Requerimento de dados de criminalidade por região apresentado', 'baixo', 'baixo', 'baixo', 8, 7, 2, 'Requerimento pedindo dados de criminalidade por região administrativa à Secretaria de Segurança.', 'realizado', '2026-04-12', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_meta) VALUES (v_id_fato, 649);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3120, 132, 'Secretaria de Segurança respondeu com dados regionais', 'medio', 'medio', 'medio', 8, 11, 3, 'Dados de criminalidade por região administrativa recebidos e sistematizados.', 'realizado', '2026-06-22', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3120, 127, 'Audiência pública sobre efetivo policial convocada', 'baixo', 'baixo', 'baixo', 8, 9, 2, 'Convocação da audiência pública regional em Sorocaba sobre efetivo policial no interior.', 'realizado', '2026-07-30', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_meta) VALUES (v_id_fato, 648);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3120, 146, 'Menção em matéria sobre pauta do interior paulista', 'baixo', 'baixo', 'baixo', 8, NULL, 1, 'Citado em matéria de jornal regional sobre a pauta de emprego no interior.', 'realizado', '2026-08-25', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_prevista, id_usuario_autor)
  VALUES (3120, 128, 'Audiência pública regional sobre efetivo policial', 'medio', 'medio', 'baixo', 8, 9, 3, 'Realização prevista da audiência pública em Sorocaba, já com pauta e convidados definidos.', 'projetado', '2026-10-02', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_prevista, id_usuario_autor)
  VALUES (3120, 158, 'Emenda de geração de emprego empenhada e executada', 'baixo', 'medio', 'alto', 11, 8, 3, 'Execução do recurso prevista para o último trimestre do ano.', 'projetado', '2026-11-15', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;

  -- ===========================================================================
  -- MANDATO 3 — Carlos Alberto da Cunha "Delegado da Cunha" (id_contrato=3121)
  -- ===========================================================================

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3121, 108, 'Diagnóstico estratégico do mandato concluído', 'baixo', 'baixo', 'baixo', 7, NULL, 2, 'Levantamento das prioridades legislativas em segurança pública para o mandato.', 'realizado', '2026-01-25', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3121, 112, 'PL de policiamento comunitário apresentado', 'baixo', 'baixo', 'baixo', 7, 8, 3, 'Projeto de lei sobre policiamento comunitário protocolado na Câmara dos Deputados.', 'realizado', '2026-02-18', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_meta) VALUES (v_id_fato, 651);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3121, 135, 'Bancada da segurança pública em articulação', 'medio', 'medio', 'baixo', 9, 11, 3, 'Primeiras conversas com deputados da bancada da segurança sobre apoio ao substitutivo.', 'realizado', '2026-03-01', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_meta) VALUES (v_id_fato, 650);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3121, 113, 'PL de policiamento comunitário em tramitação ativa', 'baixo', 'medio', 'medio', 11, 8, 3, 'Projeto pautado na Comissão de Segurança Pública e Combate ao Crime Organizado.', 'realizado', '2026-04-02', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3121, 136, 'Bancada da segurança pública formalizada em torno do substitutivo', 'medio', 'alto', 'baixo', 9, 11, 4, 'Grupo de trabalho formal com 12 deputados apoiando o substitutivo.', 'realizado', '2026-05-14', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3121, 146, 'Menção pontual em matéria sobre segurança pública', 'baixo', 'baixo', 'baixo', 8, NULL, 1, 'Citado em matéria sobre o debate de segurança pública no Congresso.', 'realizado', '2026-06-10', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3121, 147, 'Entrevista sobre comunicação digital do mandato', 'baixo', 'medio', 'baixo', 8, 7, 2, 'Entrevista concedida a veículo especializado sobre a estratégia de comunicação digital do gabinete.', 'realizado', '2026-07-22', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_meta) VALUES (v_id_fato, 653);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_ocorrencia, id_usuario_autor)
  VALUES (3121, 127, 'Agenda de rua na Zona Leste convocada', 'baixo', 'baixo', 'baixo', 8, 7, 2, 'Organização da primeira agenda de rua estratégica na Zona Leste de São Paulo.', 'realizado', '2026-08-05', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
  INSERT INTO rel_fato_origem (id_fato_gerador, id_meta) VALUES (v_id_fato, 652);

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_prevista, id_usuario_autor)
  VALUES (3121, 114, 'Coautoria estratégica prevista para o substitutivo', 'medio', 'alto', 'medio', 11, 9, 3, 'Negociação em curso para somar coautores de peso ao substitutivo antes da votação na comissão.', 'projetado', '2026-10-15', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;

  INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, titulo, nivel_d1, nivel_d2, nivel_d3, id_preditor_1, id_preditor_2, contribuicao_legisla, descricao_evidencia, situacao, dt_prevista, id_usuario_autor)
  VALUES (3121, 148, 'Consolidação como referência de mídia em segurança pública', 'medio', 'alto', 'baixo', 8, NULL, 3, 'Estratégia de comunicação prevê pauta recorrente sobre segurança pública até o fim do ano.', 'projetado', '2026-11-01', v_id_usuario)
  RETURNING id_fato_gerador INTO v_id_fato;
END $$;

COMMIT;

-- A UI dispara o refresh de mv_iip_contrato ao abrir a tela (atualizaIipContrato);
-- refresh explícito aqui só para quem quiser conferir nr_fatos direto no banco.
REFRESH MATERIALIZED VIEW mv_iip_contrato;
