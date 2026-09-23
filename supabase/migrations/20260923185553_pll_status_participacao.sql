-- Amplia fat_contrato.status para os status de participação do PLL
-- (informacoes-gerais-pll, Figma 449:4 + decisão do Pedro, 23/09/2026):
-- "Desistente" e "Desligado" são duas razões distintas dentro do que hoje é
-- só 'nao_concluido' + motivo_encerramento em texto livre. Em vez de criar
-- uma coluna nova, amplia o enum existente (mesma coluna usada por TODOS os
-- produtos hoje, Informações Gerais) -- Estratégia/Coalizão continuam vendo
-- só ativo/concluido/nao_concluido na UI (a UI decide o conjunto exibido por
-- produto; o banco só passa a aceitar os 2 valores novos).
--
-- ck_contrato_motivo também amplia: motivo_encerramento passa a ser
-- obrigatório também para 'desistente'/'desligado' (mesma regra que já vale
-- para 'nao_concluido' -- não deixa de ter motivo só porque o rótulo mudou).

ALTER TABLE fat_contrato DROP CONSTRAINT ck_contrato_status;
ALTER TABLE fat_contrato ADD CONSTRAINT ck_contrato_status
  CHECK (status IN ('ativo', 'concluido', 'nao_concluido', 'desistente', 'desligado'));

ALTER TABLE fat_contrato DROP CONSTRAINT ck_contrato_motivo;
ALTER TABLE fat_contrato ADD CONSTRAINT ck_contrato_motivo
  CHECK (status NOT IN ('nao_concluido', 'desistente', 'desligado') OR motivo_encerramento IS NOT NULL);
