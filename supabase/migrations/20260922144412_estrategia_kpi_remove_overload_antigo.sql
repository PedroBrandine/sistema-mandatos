-- =============================================================================
-- Corrige 20260922141917_estrategia_kpi_intervalo_data.sql: CREATE OR REPLACE
-- FUNCTION com parâmetros novos no final NÃO substitui a função em vigor --
-- Postgres identifica uma função por (nome, lista de TIPOS de argumento), e
-- adicionar 2 parâmetros muda essa lista mesmo com DEFAULT. O resultado foi
-- uma SEGUNDA função fn_estrategia_kpi (4 argumentos) convivendo com a nova
-- (6 argumentos), e uma chamada com os 4 argumentos originais passou a ser
-- ambígua para o Postgres -- exatamente o "não foi possível carregar os
-- KPIs" reportado no Dashboard mesmo sem filtro de data selecionado.
--
-- Remove a versão de 4 argumentos; só a de 6 (com p_data_inicio/p_data_fim
-- DEFAULT NULL) continua existindo, e ela já cobre toda chamada antiga.
-- =============================================================================

DROP FUNCTION IF EXISTS public.fn_estrategia_kpi(bigint, bigint[], bigint[], bigint[]);
