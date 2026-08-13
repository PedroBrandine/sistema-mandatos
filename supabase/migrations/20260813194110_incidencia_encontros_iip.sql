-- =============================================================================
-- incidencia-encontros: T8 -- vw_iip_contrato (view nova, fora do texto
-- aprovado -- design.md "Achado real de Design", grão errado de vw_carteira
-- pra card de 1 contrato específico) + app.atualiza_iip_contrato()
-- (SECURITY DEFINER, AD-035 -- REFRESH MATERIALIZED VIEW exige ownership,
-- nenhuma role legisla_* tem) + grants.
-- =============================================================================

-- Raiz em fat_contrato (RLS já resolvida por p_por_carteira), não em
-- rel_usuario_contrato -- 1 linha por contrato, nunca 0 mesmo sem vínculo
-- ativo ou sem Fato Gerador (LEFT JOIN, spec.md AC7/AC9/Edge Case).
CREATE OR REPLACE VIEW vw_iip_contrato WITH (security_invoker = true) AS
SELECT c.id_contrato, iip.nr_fatos, iip.iip_provisorio
FROM fat_contrato c
LEFT JOIN mv_iip_contrato iip ON iip.id_contrato = c.id_contrato;

-- Recômputo determinístico sem parâmetro do chamador (AD-035, mesma classe
-- de app.recalcula_atingimento). REFRESH MATERIALIZED VIEW CONCURRENTLY
-- exige ser owner do objeto -- nenhuma role legisla_* é; SECURITY DEFINER
-- roda como o owner (quem criou a MV em T2).
CREATE OR REPLACE FUNCTION app.atualiza_iip_contrato() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_iip_contrato;
END $$;

-- GRANT SELECT na view aos 2 papéis que não vêm do bloco (legisla_app/admin/
-- gestora já têm via GRANT ... ON ALL TABLES IN SCHEMA public, que inclui
-- views -- comportamento padrão do Postgres).
GRANT SELECT ON vw_iip_contrato TO legisla_mentor, legisla_assessor;

-- Achado real (não previsto em design.md/tasks.md): vw_iip_contrato é
-- security_invoker = true -- diferente de uma view "normal" (que roda com
-- os privilégios do owner sobre as tabelas de base), aqui o Postgres checa
-- GRANT nas tabelas de base contra quem CHAMA a view, não contra o owner.
-- Sem SELECT direto em mv_iip_contrato (nenhuma role legisla_* tinha -- ela
-- só existe desde T2) e em fat_contrato (legisla_assessor nunca teve),
-- legisla_mentor/legisla_assessor receberiam "permission denied" ao
-- consultar vw_iip_contrato, mesmo com GRANT SELECT na view em si.
-- legisla_mentor já tem fat_contrato (0011_fundacao_rls.sql) -- só falta
-- mv_iip_contrato pros dois papéis, e fat_contrato pro Assessor.
GRANT SELECT ON mv_iip_contrato TO legisla_mentor, legisla_assessor;
GRANT SELECT ON fat_contrato TO legisla_assessor;
