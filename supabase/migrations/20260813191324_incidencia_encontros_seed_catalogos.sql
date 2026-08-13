-- =============================================================================
-- incidencia-encontros: T1 -- seed de catálogos pré-requisito de
-- fat_fato_gerador (spec.md Assumption #1/#1a).
--
-- ref_nivel_iip só tinha 3 níveis (baixo/médio/alto, seedados pela Trilha C em
-- 20260810193327_catalogos_referencia_seed.sql). O CSV aprovado usa um 4º
-- nível, "Máximo", em várias tipologias -- sem esta linha o INSERT abaixo
-- falharia por FK em nivel_d1_padrao/nivel_d2_padrao/nivel_d3_padrao
-- (docs/schema_sistema.sql:265-271, 280-282).
-- =============================================================================

INSERT INTO ref_nivel_iip (codigo, rotulo, valor, ordem) VALUES
  ('maximo', 'Máximo', 4, 4)
ON CONFLICT (codigo) DO NOTHING;

-- Conteúdo aprovado das 51 tipologias (docs/DB_Fatos_Geradores - Ref_Tipologias.csv,
-- Assumption #1) -- dado de negócio aprovado, mesmo tratamento de
-- catalogos_referencia_seed.sql. Grupo mantém o prefixo numérico verbatim
-- (Tech Decision de design.md: "não redesenhar dado aprovado" também vale
-- pra conteúdo, não só estrutura).
--
-- id_indicador fica sempre NULL (Assumption #1b, CAT-16 sem data) -- nenhuma
-- coluna de peso nesta migration.
--
-- Preditor_1/Preditor_2 do CSV mapeados para o nome completo já seedado em
-- ref_preditor (mesma Trilha C, 20260810193327_catalogos_referencia_seed.sql):
--   "Priorizar Agenda"      -> "Priorizam sua Agenda"
--   "Pautar Debates"        -> "Pautam os Debates"
--   "Protagonizar Espaços"  -> "Ocupam lugar nos espaços de decisão"
--   "Construir Partido"     -> "Constroem Partido"
--   "Articular Entrega"     -> "Articulam e mobilizam para a entrega de resultados"
--   "—" (sem preditor 2)    -> NULL
-- Status_D1/D2/D3 do CSV ("Baixo"/"Médio"/"Alto"/"Máximo") mapeados para o
-- codigo de ref_nivel_iip ('baixo'/'medio'/'alto'/'maximo') -- mesma
-- convenção de codigo já em uso pelas 3 linhas seedadas pela Trilha C.
INSERT INTO ref_tipologia (grupo, tipologia, estado, id_preditor_1, id_preditor_2,
                           nivel_d1_padrao, nivel_d2_padrao, nivel_d3_padrao, observacao)
SELECT v.grupo, v.tipologia, v.estado, p1.id_preditor, p2.id_preditor,
       v.nivel_d1, v.nivel_d2, v.nivel_d3, v.observacao
  FROM (VALUES
    ('1. Planejamento e Agenda','Planejamento estratégico do mandato','Diagnóstico realizado','Priorizam sua Agenda',NULL,'baixo','baixo','baixo','Ponto de partida; ainda sem impacto externo.'),
    ('1. Planejamento e Agenda','Planejamento estratégico do mandato','Pautas prioritárias definidas (≤3)','Priorizam sua Agenda',NULL,'baixo','baixo','baixo','Foco definido orienta toda a operação do mandato.'),
    ('1. Planejamento e Agenda','Planejamento estratégico do mandato','Planejamento em execução ativa','Priorizam sua Agenda','Articulam e mobilizam para a entrega de resultados','medio','medio','medio','Metas sendo perseguidas; primeiros avanços visíveis.'),
    ('1. Planejamento e Agenda','Planejamento estratégico do mandato','Meta estratégica concluída','Priorizam sua Agenda','Articulam e mobilizam para a entrega de resultados','medio','alto','alto','Entrega dentro da agenda priorizada — D3 avança.'),
    ('2. Produção Legislativa','Projeto de lei / proposição','Apresentado','Priorizam sua Agenda','Pautam os Debates','baixo','baixo','baixo','Sinaliza intenção dentro da pauta priorizada.'),
    ('2. Produção Legislativa','Projeto de lei / proposição','Em tramitação ativa','Articulam e mobilizam para a entrega de resultados','Pautam os Debates','baixo','medio','medio','Articula apoios; narrativa pública pode emergir.'),
    ('2. Produção Legislativa','Projeto de lei / proposição','Com co-autoria estratégica','Articulam e mobilizam para a entrega de resultados','Ocupam lugar nos espaços de decisão','medio','alto','medio','Co-autores ampliam rede e reduzem risco nas comissões.'),
    ('2. Produção Legislativa','Projeto de lei / proposição','Aprovado em comissão','Articulam e mobilizam para a entrega de resultados','Ocupam lugar nos espaços de decisão','medio','medio','alto','Vitória intermediária; credibilidade do mandato cresce.'),
    ('2. Produção Legislativa','Projeto de lei / proposição','Aprovado em plenário','Articulam e mobilizam para a entrega de resultados','Pautam os Debates','alto','alto','alto','Marco legislativo; impacto direto em D3.'),
    ('2. Produção Legislativa','Projeto de lei / proposição','Sancionado / promulgado','Articulam e mobilizam para a entrega de resultados','Pautam os Debates','alto','alto','maximo','Impacto formal máximo; consolida pauta e reputação.'),
    ('3. Relatoria','Relatoria estratégica','Indicado / designado','Ocupam lugar nos espaços de decisão','Priorizam sua Agenda','alto','medio','baixo','Posição formal impacta D1 antes da entrega. Deve estar na pauta priorizada.'),
    ('3. Relatoria','Relatoria estratégica','Em exercício com audiências','Ocupam lugar nos espaços de decisão','Pautam os Debates','alto','alto','medio','Centralidade decisória e narrativa crescem juntas.'),
    ('3. Relatoria','Relatoria estratégica','Relatório aprovado','Articulam e mobilizam para a entrega de resultados','Ocupam lugar nos espaços de decisão','alto','alto','alto','Entrega concreta com alto reconhecimento institucional.'),
    ('4. Cargos e Espaços de Poder','Cargo de liderança (comissão, bancada, bloco, mesa)','Candidato / articulando','Ocupam lugar nos espaços de decisão','Constroem Partido','medio','medio','baixo','Movimento visível; gera centralidade antes do ganho formal.'),
    ('4. Cargos e Espaços de Poder','Cargo de liderança (comissão, bancada, bloco, mesa)','Eleito / indicado','Ocupam lugar nos espaços de decisão','Constroem Partido','maximo','alto','baixo','Salto institucional imediato em D1.'),
    ('4. Cargos e Espaços de Poder','Cargo de liderança (comissão, bancada, bloco, mesa)','Em exercício ativo','Ocupam lugar nos espaços de decisão','Articulam e mobilizam para a entrega de resultados','maximo','maximo','medio','Centralidade máxima; D3 depende das entregas do cargo.'),
    ('4. Cargos e Espaços de Poder','Participação em negociação política de alto nível','Convidado a participar','Ocupam lugar nos espaços de decisão',NULL,'alto','alto','baixo','O convite já é evidência de centralidade decisória.'),
    ('4. Cargos e Espaços de Poder','Participação em negociação política de alto nível','Participante ativo','Ocupam lugar nos espaços de decisão','Articulam e mobilizam para a entrega de resultados','alto','alto','medio','Influência relacional aumenta; impacto depende do acordo.'),
    ('4. Cargos e Espaços de Poder','Participação em negociação política de alto nível','Papel de mediador / central','Ocupam lugar nos espaços de decisão','Articulam e mobilizam para a entrega de resultados','maximo','maximo','alto','Máxima centralidade; altera correlação de forças.'),
    ('5. Audiências e Eventos Institucionais','Audiência pública / evento institucional','Convocada / organizada','Pautam os Debates','Priorizam sua Agenda','baixo','baixo','baixo','Uso do cargo para pautar; coerente com agenda priorizada.'),
    ('5. Audiências e Eventos Institucionais','Audiência pública / evento institucional','Realizada com participação qualificada','Pautam os Debates','Ocupam lugar nos espaços de decisão','medio','medio','baixo','Debate qualificado; reconhecimento técnico do mandato aumenta.'),
    ('5. Audiências e Eventos Institucionais','Audiência pública / evento institucional','Com relatório ou recomendação institucional','Articulam e mobilizam para a entrega de resultados','Pautam os Debates','medio','alto','medio','Preditor muda quando resultado institucional emerge.'),
    ('5. Audiências e Eventos Institucionais','Audiência pública / evento institucional','Com impacto em política pública','Articulam e mobilizam para a entrega de resultados','Pautam os Debates','alto','alto','alto','Audiência gerou mudança concreta — D3 máximo para o formato.'),
    ('6. Fiscalização e Controle','Ação de fiscalização / controle','Requerimento ou pedido de informação apresentado','Pautam os Debates','Priorizam sua Agenda','baixo','baixo','baixo','Instrumento básico de controle; baixo custo e baixo impacto imediato.'),
    ('6. Fiscalização e Controle','Ação de fiscalização / controle','Com resposta do executivo','Pautam os Debates','Articulam e mobilizam para a entrega de resultados','medio','medio','medio','Mandato demonstra capacidade de pressionar e obter resposta.'),
    ('6. Fiscalização e Controle','Ação de fiscalização / controle','Com repercussão pública ou investigação aberta','Pautam os Debates','Ocupam lugar nos espaços de decisão','medio','alto','medio','Pauta entra no debate público; influência narrativa sobe.'),
    ('6. Fiscalização e Controle','Ação de fiscalização / controle','Com correção de política pública ou responsabilização','Articulam e mobilizam para a entrega de resultados','Pautam os Debates','alto','alto','alto','Fiscalização gerou mudança concreta — impacto substantivo confirmado.'),
    ('7. Coalizões e Articulação','Coalizão / articulação interpartidária','Em construção','Ocupam lugar nos espaços de decisão','Articulam e mobilizam para a entrega de resultados','medio','medio','baixo','Processo já gera centralidade antes de formalizar.'),
    ('7. Coalizões e Articulação','Coalizão / articulação interpartidária','Formalizada','Ocupam lugar nos espaços de decisão','Articulam e mobilizam para a entrega de resultados','medio','alto','baixo','Rede densa e diversa; D2 sobe com densidade relacional.'),
    ('7. Coalizões e Articulação','Coalizão / articulação interpartidária','Ativa com agenda política','Ocupam lugar nos espaços de decisão','Pautam os Debates','alto','maximo','medio','Influência relacional e narrativa no pico.'),
    ('7. Coalizões e Articulação','Coalizão / articulação interpartidária','Com entrega política concreta','Articulam e mobilizam para a entrega de resultados','Ocupam lugar nos espaços de decisão','alto','maximo','alto','Resultado real a partir de articulação; D3 avança.'),
    ('7. Coalizões e Articulação','Articulação com sociedade civil e movimentos','Reunião / escuta com organizações','Articulam e mobilizam para a entrega de resultados','Priorizam sua Agenda','baixo','medio','baixo','Constrói legitimidade e insumos para a pauta priorizada.'),
    ('7. Coalizões e Articulação','Articulação com sociedade civil e movimentos','Parceria formal ou carta conjunta','Articulam e mobilizam para a entrega de resultados','Pautam os Debates','medio','alto','medio','Mandato amplia sua rede e a pauta ganha respaldo externo.'),
    ('7. Coalizões e Articulação','Articulação com sociedade civil e movimentos','Ação conjunta com impacto público','Articulam e mobilizam para a entrega de resultados','Pautam os Debates','alto','alto','alto','Coordenação política + sociedade civil gera resultado concreto.'),
    ('8. Frente Parlamentar','Frente parlamentar','Em articulação','Ocupam lugar nos espaços de decisão','Priorizam sua Agenda','baixo','medio','baixo','Expansão de rede em torno da pauta priorizada.'),
    ('8. Frente Parlamentar','Frente parlamentar','Formalmente criada','Ocupam lugar nos espaços de decisão','Articulam e mobilizam para a entrega de resultados','medio','alto','baixo','D2 avança com densidade e diversidade da rede formada.'),
    ('8. Frente Parlamentar','Frente parlamentar','Ativa com agenda e reuniões','Ocupam lugar nos espaços de decisão','Pautam os Debates','medio','alto','medio','Reuniões e pauta pública contribuem para narrativa.'),
    ('8. Frente Parlamentar','Frente parlamentar','Com entrega concreta','Articulam e mobilizam para a entrega de resultados','Ocupam lugar nos espaços de decisão','alto','alto','alto','Preditor passa a ser entrega quando há resultado.'),
    ('9. Comunicação e Narrativa','Cobertura de mídia / presença pública','Menção pontual','Pautam os Debates',NULL,'baixo','baixo','baixo','Aparição isolada sem consolidação de narrativa.'),
    ('9. Comunicação e Narrativa','Cobertura de mídia / presença pública','Entrevista / matéria temática','Pautam os Debates','Priorizam sua Agenda','baixo','medio','baixo','Eleva influência narrativa na pauta priorizada.'),
    ('9. Comunicação e Narrativa','Cobertura de mídia / presença pública','Referência recorrente em tema','Pautam os Debates',NULL,'medio','alto','baixo','D1 cresce porque reconhecimento estratégico interno aumenta.'),
    ('9. Comunicação e Narrativa','Cobertura de mídia / presença pública','Referência consolidada / porta-voz de pauta','Pautam os Debates','Ocupam lugar nos espaços de decisão','medio','maximo','medio','Influência narrativa máxima; gera convites e relatorias.'),
    ('9. Comunicação e Narrativa','Publicação técnica / posicionamento estratégico','Publicado','Pautam os Debates','Priorizam sua Agenda','baixo','baixo','baixo','Contribuição técnica dentro da pauta; sem repercussão ainda.'),
    ('9. Comunicação e Narrativa','Publicação técnica / posicionamento estratégico','Com repercussão em pares e imprensa','Pautam os Debates',NULL,'baixo','medio','baixo','Referência técnica em formação; influência narrativa cresce.'),
    ('9. Comunicação e Narrativa','Publicação técnica / posicionamento estratégico','Adotado como referência política ou normativa','Pautam os Debates','Ocupam lugar nos espaços de decisão','medio','alto','medio','Referência técnica consolidada; pode gerar relatorias e convites.'),
    ('10. Partido e Estrutura','Fortalecimento da estrutura partidária','Ação de formação ou articulação interna','Constroem Partido','Priorizam sua Agenda','baixo','baixo','baixo','Investimento de longo prazo; baixo impacto imediato no IIP.'),
    ('10. Partido e Estrutura','Fortalecimento da estrutura partidária','Em desenvolvimento com protagonismo','Constroem Partido','Ocupam lugar nos espaços de decisão','medio','baixo','baixo','Capital político interno cresce; reconhecimento na legenda.'),
    ('10. Partido e Estrutura','Fortalecimento da estrutura partidária','Consolidado — cargo ou liderança partidária','Constroem Partido','Ocupam lugar nos espaços de decisão','alto','medio','baixo','D1 avança com reconhecimento estratégico dentro do partido.'),
    ('11. Emendas Orçamentárias','Emenda orçamentária','Apresentada','Articulam e mobilizam para a entrega de resultados','Priorizam sua Agenda','baixo','baixo','baixo','Intenção de entrega alinhada à agenda priorizada.'),
    ('11. Emendas Orçamentárias','Emenda orçamentária','Aprovada','Articulam e mobilizam para a entrega de resultados',NULL,'baixo','baixo','medio','Impacto formal registrado; D1/D2 pouco afetados isoladamente.'),
    ('11. Emendas Orçamentárias','Emenda orçamentária','Empenhada e executada','Articulam e mobilizam para a entrega de resultados','Pautam os Debates','baixo','medio','alto','Entrega real e visível; narrativa de resultado pode ser construída.')
  ) AS v(grupo, tipologia, estado, preditor_1, preditor_2, nivel_d1, nivel_d2, nivel_d3, observacao)
  LEFT JOIN ref_preditor p1 ON p1.nome = v.preditor_1
  LEFT JOIN ref_preditor p2 ON p2.nome = v.preditor_2
ON CONFLICT (grupo, tipologia, estado) DO NOTHING;
