-- =============================================================================
-- Migration 0026: remove do ref_cargo os três cargos não utilizados
--
-- A 0007 (catalogos_fundacao) semeia 9 cargos. Três deles foram removidos
-- manualmente do projeto de dev pelo time, por não serem usados:
--
--   Prefeito(a)       (cd_cargo_tse 11)
--   Vice-Prefeito(a)  (cd_cargo_tse 12)
--   Governador(a)     (cd_cargo_tse  3)
--
-- A remoção foi feita direto no banco e nunca virou arquivo, então as
-- migrations produziam 9 cargos enquanto o banco tinha 6 -- divergência
-- detectada em 04/08/2026 pelo teste de integração T12 (catalogos).
--
-- Esta migration registra a decisão, para que qualquer ambiente criado do zero
-- (produção inclusive) chegue aos mesmos 6 cargos do dev.
--
-- Idempotente: DELETE por nome não falha se as linhas já não existirem.
-- =============================================================================

DELETE FROM ref_cargo
 WHERE nome IN ('Prefeito(a)', 'Vice-Prefeito(a)', 'Governador(a)');
