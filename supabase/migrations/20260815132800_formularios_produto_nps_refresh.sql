-- =============================================================================
-- formularios-produto: T11 -- app.atualiza_avaliacao_nps(), verbatim
-- design.md "Data Models" (não está em docs/schema_sistema.sql -- wrapper de
-- refresh novo, mesmo padrão de app.atualiza_iip_contrato(), AD-035).
--
-- SECURITY DEFINER aqui não é sobre GRANT de tabela (a função não escreve
-- nenhuma tabela) -- é porque REFRESH MATERIALIZED VIEW exige ser owner do
-- objeto ou superusuário; nenhuma role legisla_* é owner de mv_avaliacao_nps
-- (T10 criou a MV como o role de conexão da migration). Sem SECURITY
-- DEFINER, nem a Gestora conseguiria rodar o refresh. A barreira real de
-- leitura continua sendo o GRANT SELECT da MV em si (T10, FRM-23): Mentor/
-- Assessor conseguem CHAMAR esta função (ela roda e atualiza a MV
-- normalmente, já que GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app cobre
-- todos os papéis), mas continuam sem conseguir LER o resultado depois.
-- =============================================================================

CREATE OR REPLACE FUNCTION app.atualiza_avaliacao_nps() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_avaliacao_nps;
END $$;

COMMENT ON FUNCTION app.atualiza_avaliacao_nps() IS
'Recômputo determinístico sem parâmetro do chamador (AD-035, mesma classe de app.atualiza_iip_contrato()). Sem pg_cron provisionado (spec.md, Out of Scope) -- refresh é sempre sob demanda, acionado pela UI (T21).';
