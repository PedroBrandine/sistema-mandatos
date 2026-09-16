-- ficha-mandato-contrato: T12 -- seed dos 14 descritores de nível do GIP
-- (Anexo A de spec.md), verbatim da metodologia (Pedro, 2026-09-15). Fecha
-- FMC-24. Depende de T5 (estrutura de ref_nivel_dimensao_gip) e T11 (faixa
-- 0-3/0-2 já re-seedada em ref_dimensao_gip -- os valores abaixo respeitam
-- essa faixa, checada por trg_gip_dimensao_faixa só em fat_gip_dimensao, não
-- aqui, mas a intenção é a mesma escala).
--
-- 4 + 4 + 3 + 3 = 14 linhas, uma por par (dimensão, valor). ON CONFLICT DO
-- NOTHING: pk_nivel_dimensao_gip é (id_dimensao, valor) -- idempotente sob
-- reaplicação/db reset.
INSERT INTO ref_nivel_dimensao_gip (id_dimensao, valor, descricao)
SELECT id_dimensao, v.valor, v.descricao
  FROM ref_dimensao_gip d
  JOIN (VALUES
    ('qualidade_planejamento', 0, 'Não apresenta padrões de atuação de mandatos de sucesso'),
    ('qualidade_planejamento', 1, 'Apresenta algumas práticas e padrões de atuação de mandatos de sucesso'),
    ('qualidade_planejamento', 2, 'Progride menos de 60%, em média, nos objetivos específicos atrelados aos preditores de sucesso prioritários'),
    ('qualidade_planejamento', 3, 'Progride acima de 60%, em média, nos objetivos específicos atrelados aos preditores de sucesso prioritários'),

    ('atingimento_planejamento', 0, 'Não monitora metas'),
    ('atingimento_planejamento', 1, 'Monitora e cumpre até 30% do quadro de metas'),
    ('atingimento_planejamento', 2, 'Monitora e cumpre até 65% do quadro de metas'),
    ('atingimento_planejamento', 3, 'Monitora e cumpre mais de 65% do quadro de metas'),

    ('capacidade_gestao', 0, 'Não implementa rotinas de alinhamento entre a equipe e entre coordenações (ou o faz de modo esporádico/muito informal)'),
    ('capacidade_gestao', 1, 'Implementa rotinas de alinhamento entre a equipe e entre coordenações'),
    ('capacidade_gestao', 2, 'Implementa estratégia de gestão de pessoas (revisão de organograma, definição de escopos de trabalho e realização de devolutivas sobre o desempenho da assessoria)'),

    ('autonomia_metodologia', 0, 'Resistente à implementação de sugestões de incidência política'),
    ('autonomia_metodologia', 1, 'Implementa apenas uma sugestão de incidência política'),
    ('autonomia_metodologia', 2, 'Implementa mais de uma sugestão de incidência política')
  ) AS v(codigo, valor, descricao) ON v.codigo = d.codigo
ON CONFLICT (id_dimensao, valor) DO NOTHING;
