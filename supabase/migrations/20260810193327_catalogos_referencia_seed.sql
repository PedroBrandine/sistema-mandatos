-- =============================================================================
-- Trilha C (.specs/features/catalogos-referencia/): seed do conteúdo já
-- aprovado das 9 tabelas (docs/schema_sistema.sql:2178-2316, verbatim) --
-- dado de negócio aprovado, não dado de teste (context.md desta feature),
-- vai tanto para dev quanto para produção, mesmo padrão de 0007/0020/0021.
--
-- ref_etapa aqui cobre só Estratégia (7) + PLL (5) -- a régua da Coalizão
-- (D9, CAT-17) é uma migração de seed separada (catalogos_referencia_seed_coalizao),
-- porque a clonagem depende desta seed já ter rodado.
--
-- As 3 tabelas sem conteúdo aprovado (ref_agenda_tematica, ref_indicador,
-- ref_tipologia) ficam de fora de propósito -- CAT-16, levantamento humano
-- com o time de Monitoramento, fora do escopo desta feature.
--
-- ON CONFLICT DO NOTHING em todo INSERT -- idempotência (spec P1-seed AC10).
-- =============================================================================

INSERT INTO ref_nivel_iip (codigo, rotulo, valor, ordem) VALUES
  ('baixo', 'Baixo', 1, 1), ('medio', 'Médio', 2, 2), ('alto', 'Alto', 3, 3)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO ref_preditor (nome, ordem) VALUES
  ('Priorizam sua Agenda', 1),
  ('Pautam os Debates', 2),
  ('Ocupam lugar nos espaços de decisão', 3),
  ('Constroem Partido', 4),
  ('Articulam e mobilizam para a entrega de resultados', 5)
ON CONFLICT (nome) DO NOTHING;

INSERT INTO ref_perfil_atuacao (nome, ordem) VALUES
  ('Fiscalizadora', 1), ('Legisladora', 2), ('Articuladora/Mobilizadora', 3)
ON CONFLICT (nome) DO NOTHING;

-- Derivados das 4 perguntas da aba "Registros Insights" (decisão D5: confirmada).
INSERT INTO ref_pilar_insight (codigo, nome, ordem) VALUES
  ('contexto_sociopolitico', 'Contexto sociopolítico do mandato', 1),
  ('incidencia_politica',    'Incidência política (sugestão, recomendação, direcionamento)', 2),
  ('desafio_problema',       'Desafio/problema do momento (técnico, político, relacional, interno)', 3),
  ('conquistas_praticas',    'Conquistas e boas práticas', 4)
ON CONFLICT (codigo) DO NOTHING;

-- As 4 dimensões da régua de db_DO_Gabinete.
INSERT INTO ref_dimensao_gip (codigo, nome, valor_min, valor_max, ordem) VALUES
  ('qualidade_planejamento',  'Qualidade do planejamento',       1, 4, 1),
  ('atingimento_planejamento','Atingimento do planejamento',     1, 4, 2),
  ('capacidade_gestao',       'Capacidade de gestão',            1, 4, 3),
  ('autonomia_metodologia',   'Autonomia sobre a metodologia',   1, 4, 4)
ON CONFLICT (codigo) DO NOTHING;

-- Régua da Estratégia: 7 blocos do checklist.
-- duracao_prevista_dias são valores iniciais sugeridos -- calibrar com a operação.
INSERT INTO ref_etapa (id_produto, codigo, nome, ordem, duracao_prevista_dias, gera_registro)
SELECT p.id_produto, v.codigo, v.nome, v.ordem, v.dias, v.gera
  FROM ref_produto p, (VALUES
    ('cadastro',       'Cadastro',                   1::smallint,   7::smallint, false),
    ('pontape',        'Pontapé',                    2,            14,           true),
    ('raio_x',         'Raio-X',                     3,            21,           true),
    ('imersao',        'Imersão',                    4,            14,           true),
    ('governanca',     'Governança / Organograma',   5,            45,           true),
    ('monitoramento',  'Monitoramento',              6,           120,           true),
    ('replicacao',     'Replicação',                 7,            14,           true)
  ) AS v(codigo, nome, ordem, dias, gera)
 WHERE p.nome = 'Estratégia'
ON CONFLICT (id_produto, codigo) DO NOTHING;

-- Régua do PLL: 5 blocos do checklist.
INSERT INTO ref_etapa (id_produto, codigo, nome, ordem, duracao_prevista_dias, gera_registro)
SELECT p.id_produto, v.codigo, v.nome, v.ordem, v.dias, v.gera
  FROM ref_produto p, (VALUES
    ('recrutamento', 'Recrutamento e seleção de participantes', 1::smallint, 30::smallint, false),
    ('selecao',      'Seleção e formação de mentores',          2,           30,           false),
    ('pontape',      'Pontapé',                                 3,           14,           false),
    ('imersao',      'Imersão e construção do planejamento',    4,            7,           true),
    ('mentorias',    'Mentorias e monitoramento',               5,          120,           true)
  ) AS v(codigo, nome, ordem, dias, gera)
 WHERE p.nome = 'PLL'
ON CONFLICT (id_produto, codigo) DO NOTHING;

-- Tipos de registro derivados literalmente das abas de "Registros Slack" e f_mentorias.
INSERT INTO ref_tipo_registro (id_etapa, codigo, nome, permite_multiplos, qtd_prevista)
SELECT e.id_etapa, v.codigo, v.nome, v.multiplos, v.qtd
  FROM ref_etapa e
  JOIN ref_produto p ON p.id_produto = e.id_produto
  JOIN (VALUES
    ('Estratégia','pontape',                 'pontape',                 'Pontapé',                        false, NULL::smallint),
    ('Estratégia','raio_x',                   'comite_politico',        'Comitê Político',                false, NULL),
    ('Estratégia','raio_x',                   'escuta_diagnostica',     'Escuta Diagnóstica',             false, NULL),
    ('Estratégia','imersao',                  'imersao',                'Imersão',                        false, NULL),
    ('Estratégia','governanca',               'sprint',                 'Sprint',                         true,  NULL),
    ('Estratégia','governanca',               'diagnostico_organograma','Diagnóstico de Organograma',     false, NULL),
    ('Estratégia','governanca',               'organograma',            'Proposta de Organograma',        false, NULL),
    ('Estratégia','monitoramento',            'monitoramento',          'Monitoramento mensal',           true,  4),
    ('Estratégia','replicacao',               'replicacao',             'Replicação',                     false, NULL),
    ('Estratégia','monitoramento',            'legisla_aliada',         'Legisla Aliada',                 true,  NULL),
    ('PLL',       'mentorias',                'mentoria',               'Mentoria',                       true,  5)
  ) AS v(produto, etapa, codigo, nome, multiplos, qtd)
    ON v.produto = p.nome AND v.etapa = e.codigo
ON CONFLICT (id_etapa, codigo) DO NOTHING;

-- Os 16 formulários do sistema.
INSERT INTO ref_formulario (id_etapa, codigo, nome, respondente, exige_anexo)
SELECT e.id_etapa, v.codigo, v.nome, v.respondente, v.anexo
  FROM ref_etapa e
  JOIN ref_produto p ON p.id_produto = e.id_produto
  JOIN (VALUES
    ('Estratégia','pontape',      'termo_compromisso',              'Termo de Compromisso',                  'assessor',            true),
    ('Estratégia','pontape',      'codigo_conduta',                 'Código de Conduta',                     'assessor',            true),
    ('Estratégia','pontape',      'introdutorio_assessores',        'Introdutório — Assessores',             'assessor',            false),
    ('Estratégia','pontape',      'introdutorio_cg_parlamentar',    'Introdutório — CG e Parlamentar',       'cargo_cg_parlamentar',false),
    ('Estratégia','pontape',      'organograma',                    'Organograma',                           'assessor',            false),
    ('Estratégia','raio_x',       'gip',                            'GIP (Início/Meio/Fim)',                 'gestora',             false),
    ('Estratégia','imersao',      'avaliacao_imersao',              'Avaliação da Imersão',                  'assessor',            false),
    ('Estratégia','replicacao',   'avaliacao_fim_ciclo',            'Avaliação de Fim de Ciclo',             'mandato',             false),
    ('PLL',       'recrutamento', 'inscricao_mentorado',            'Inscrição de Mentorados',               'mentorado',           false),
    ('PLL',       'recrutamento', 'diagnostico_tematicas',          'Diagnóstico e Temáticas de Interesse',  'mentorado',           false),
    ('PLL',       'selecao',      'inscricao_mentor',               'Inscrição de Mentores',                 'mentor',              false),
    ('PLL',       'imersao',      'avaliacao_imersao_pll',          'Avaliação da Imersão (PLL)',            'mentorado',           false),
    ('PLL',       'mentorias',    'avaliacao_parcial_participante', 'Avaliação Parcial — Participantes',     'mentorado',           false),
    ('PLL',       'mentorias',    'avaliacao_parcial_mentor',       'Avaliação Parcial — Mentores',          'mentor',              false),
    ('PLL',       'mentorias',    'avaliacao_final_participante',   'Avaliação Final — Participantes',       'mentorado',           false),
    ('PLL',       'mentorias',    'avaliacao_final_mentor',         'Avaliação Final — Mentores',            'mentor',              false)
  ) AS v(produto, etapa, codigo, nome, respondente, anexo)
    ON v.produto = p.nome AND v.etapa = e.codigo
ON CONFLICT (codigo) DO NOTHING;

-- Métrica de NPS presente em todos os formulários de avaliação.
INSERT INTO ref_metrica_formulario (id_formulario, codigo_campo, rotulo, tipo, eh_nps, agrupador)
SELECT f.id_formulario, 'nps_recomendacao', 'Recomendaria o programa (0-10)', 'escala_0_10', true, 'nps'
  FROM ref_formulario f
 WHERE f.codigo LIKE 'avaliacao%'
ON CONFLICT (id_formulario, codigo_campo) DO NOTHING;
