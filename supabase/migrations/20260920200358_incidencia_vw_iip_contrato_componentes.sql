-- =============================================================================
-- vw_iip_contrato passa a expor componente_d1/d2/d3 (já existem em
-- mv_iip_contrato desde sempre, mas a view segura só repassava nr_fatos e
-- iip_provisorio). Pedido de Pedro: mostrar no IipCard quais das 3 dimensões
-- os Fatos Geradores do contrato mais atingiram, não só o total somado
-- (AD-064, .specs/STATE.md).
--
-- CREATE OR REPLACE VIEW (não precisa de DROP CASCADE aqui): só ACRESCENTA
-- colunas no fim do SELECT, mesmas colunas/posições anteriores inalteradas --
-- Postgres aceita isso sem quebrar dependentes nem GRANTs existentes.
-- =============================================================================

CREATE OR REPLACE VIEW vw_iip_contrato WITH (security_invoker = true) AS
SELECT c.id_contrato,
       iip.nr_fatos,
       iip.iip_provisorio,
       iip.componente_d1,
       iip.componente_d2,
       iip.componente_d3
FROM fat_contrato c
LEFT JOIN mv_iip_contrato iip ON iip.id_contrato = c.id_contrato;
