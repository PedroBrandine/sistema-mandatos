-- =============================================================================
-- saida-numeros-impacto: T2 -- app.atualiza_numeros_impacto() (SECURITY
-- DEFINER, AD-035 -- mesmo padrão de app.atualiza_iip_contrato/
-- app.atualiza_avaliacao_nps: REFRESH MATERIALIZED VIEW CONCURRENTLY exige
-- ser owner do objeto, nenhuma role legisla_* é) + GRANT SELECT em
-- mv_numeros_impacto a legisla_gestora/legisla_admin (AD-036 -- GRANT-only,
-- razão distinta de AD-030: a MV TEM id_contrato/id_contratante, mas a
-- leitura é deliberadamente organização-inteira, nunca legisla_mentor/
-- legisla_assessor).
--
-- Sem REVOKE explícito de legisla_mentor/legisla_assessor: mv_numeros_impacto
-- é relação nova (T1) -- nenhuma role legisla_* tem GRANT nela ainda (AD-025,
-- provisionamento incremental não é retroativo), então "nunca conceder" já
-- basta pra excluir os dois papéis, sem precisar do REVOKE que o schema
-- aprovado usa (docs/schema_sistema.sql:2103-2104) pra um cenário de GRANT
-- em bloco que este projeto não replica aqui.
-- =============================================================================

CREATE OR REPLACE FUNCTION app.atualiza_numeros_impacto() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_numeros_impacto;
END $$;

COMMENT ON FUNCTION app.atualiza_numeros_impacto() IS
'Recômputo determinístico sem parâmetro do chamador (AD-035, mesma classe de app.atualiza_iip_contrato()/app.atualiza_avaliacao_nps()). Sem pg_cron provisionado -- refresh é sempre sob demanda, acionado pela UI.';

GRANT SELECT ON mv_numeros_impacto TO legisla_gestora, legisla_admin;
