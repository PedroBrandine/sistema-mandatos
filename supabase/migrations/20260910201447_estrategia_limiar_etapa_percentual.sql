-- =============================================================================
-- redesenho-estrategia-tela-first: T4b -- o limiar de atraso de etapa passa a
-- ser PERCENTUAL da duração prevista da própria etapa, não dias absolutos
-- (AD-045). Atenção a 70%, Atrasado a 100%.
--
-- Por quê: limiar absoluto não distingue contexto. As durações previstas vão
-- de 14 a 120 dias (Pontapé 14, Diagnóstico 21, Imersão 14, Governança 45,
-- Monitoramento 120, Replicação 14) -- 120 dias em Monitoramento é o
-- esperado, em Pontapé é abandono. Um corte único em dias marcaria metade da
-- carteira como atrasada ou não marcaria nada. Decisão de Pedro, 2026-09-10.
--
-- Forward-only: a migration 20260910145926 (T2), que criou a tabela com
-- `dias` absoluto para os quatro limiares, NÃO é editada. Esta corrige a
-- forma por acréscimo.
--
-- COMO AS DUAS BASES FICAM DISTINGUÍVEIS -- o requisito é que nenhuma coluna
-- seja ambígua, e a escolha aqui é que **o nome da coluna carrega a
-- unidade**:
--
--   dias              -> limiar em dias absolutos    (formulario_aberto 30,
--                                                     sem_registro_recente 45)
--   pct_duracao_etapa -> limiar em % de ref_etapa.duracao_prevista_dias
--                                                    (etapa_atencao 70,
--                                                     etapa_atrasado 100)
--
-- `ck_limiar_base` obriga exatamente uma das duas a estar preenchida. Assim
-- nenhum número pode ser lido na unidade errada: não existe linha onde "70"
-- possa significar 70 dias, nem linha onde a unidade tenha que ser inferida
-- de fora da tabela.
--
-- A alternativa considerada era uma coluna `valor` genérica mais um
-- discriminador `unidade`. Descartada por duas razões: exigiria renomear
-- `dias`, coluna da qual `vw_pendencias` (T3) já depende, e deixaria o
-- número legível só em conjunto com outra coluna -- exatamente a ambiguidade
-- que se quer eliminar. Com duas colunas nomeadas, um SELECT solto já é
-- autoexplicativo. O custo é que uma terceira base futura pediria uma
-- terceira coluna; aceitável num catálogo de quatro linhas.
--
-- vw_pendencias NÃO é tocada: ela lê os dois limiares em dias por `codigo`
-- ('formulario_aberto' e 'sem_registro_recente'), ambos inalterados nesta
-- migration. A não-regressão é asserida pelos testes da T3, que seguem
-- verdes.
--
-- Nenhum percentual e nenhuma duração fica escrita em código (AD-004): os
-- percentuais vivem aqui, as durações em ref_etapa.duracao_prevista_dias.
-- Etapa sem duracao_prevista_dias não é classificável -- a coluna é
-- nullable de origem e AD-045 define que esse caso renderiza `Normal`,
-- nunca um estado inventado (AD-005). Isso é regra de apresentação e vive
-- na função pura do frontend (T14), não aqui.
-- =============================================================================

ALTER TABLE ref_limiar_pendencia
  ADD COLUMN IF NOT EXISTS pct_duracao_etapa SMALLINT;

-- `dias` deixa de ser obrigatória: as linhas de etapa passam a se expressar
-- na outra coluna. A obrigatoriedade não some -- migra para ck_limiar_base,
-- que é mais forte (exige exatamente uma das duas, não "pelo menos dias").
ALTER TABLE ref_limiar_pendencia
  ALTER COLUMN dias DROP NOT NULL;

UPDATE ref_limiar_pendencia
   SET pct_duracao_etapa = 70,
       dias = NULL,
       nome = 'Percentual da duração prevista da etapa a partir do qual o card entra em Atenção'
 WHERE codigo = 'etapa_atencao';

UPDATE ref_limiar_pendencia
   SET pct_duracao_etapa = 100,
       dias = NULL,
       nome = 'Percentual da duração prevista da etapa a partir do qual o card fica Atrasado'
 WHERE codigo = 'etapa_atrasado';

ALTER TABLE ref_limiar_pendencia
  ADD CONSTRAINT ck_limiar_base CHECK (num_nonnulls(dias, pct_duracao_etapa) = 1);

ALTER TABLE ref_limiar_pendencia
  ADD CONSTRAINT ck_limiar_pct CHECK (pct_duracao_etapa IS NULL OR pct_duracao_etapa > 0);

COMMENT ON COLUMN ref_limiar_pendencia.dias IS
'Limiar em dias absolutos. Preenchida só para limiares sem etapa de referência (formulario_aberto, sem_registro_recente). Mutuamente exclusiva com pct_duracao_etapa (ck_limiar_base).';

COMMENT ON COLUMN ref_limiar_pendencia.pct_duracao_etapa IS
'Limiar em percentual de ref_etapa.duracao_prevista_dias (AD-045). Preenchida só para os limiares de estado de etapa (etapa_atencao 70, etapa_atrasado 100). Mutuamente exclusiva com dias (ck_limiar_base).';

COMMENT ON TABLE ref_limiar_pendencia IS
'Limiares editáveis de pendência e de estado de etapa (AD-041, correção da violação de AD-004 em vw_pendencias). Catálogo GRANT-only, sem RLS (AD-030). Duas bases mutuamente exclusivas, distinguidas pelo nome da coluna: `dias` para limiar absoluto, `pct_duracao_etapa` para percentual da duração prevista da etapa (AD-045). Alterar o valor muda o comportamento de vw_pendencias e do badge do Quadro sem deploy.';
