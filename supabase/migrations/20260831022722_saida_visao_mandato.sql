-- =============================================================================
-- saida-numeros-impacto: T3 -- vw_visao_mandato (verbatim
-- docs/schema_sistema.sql:1304-1324, AD-008) + GRANT SELECT a
-- legisla_gestora/legisla_admin.
--
-- security_invoker = true (não é MV): ao contrário de mv_numeros_impacto
-- (AD-036), esta view herda a RLS de fat_contrato/dim_contratante de quem a
-- consulta -- não precisa de exceção nova ao AD-001 (design.md, Assumption
-- confirmada em spec.md). O GRANT abaixo é só o mesmo re-GRANT explícito de
-- toda relação nova (AD-025) -- sem ele, nem Gestora/Admin conseguem ler a
-- view (relação não existia quando o GRANT em bloco de 0004 rodou). Mentor/
-- Assessor não recebem GRANT (Constituição §2.6: "uso exclusivo de usuários
-- Legisla") -- mesma decisão de escopo de papel de mv_numeros_impacto/
-- vw_gip_evolucao nesta feature.
-- =============================================================================

CREATE VIEW vw_visao_mandato WITH (security_invoker = true) AS
SELECT ct.id_contratante,
       ct.nome AS nome_contratante,
       ct.tipo_contratante,
       c.id_contrato,
       c.dt_inicio,
       c.dt_fim,
       c.status,
       p.nome  AS nome_produto,
       pj.nome AS nome_projeto,
       cg.nome AS cargo_no_contrato,
       pt.sigla AS partido_no_contrato,
       c.id_contrato_anterior,
       ROW_NUMBER() OVER (PARTITION BY ct.id_contratante ORDER BY c.dt_inicio) AS ordem_contrato
FROM dim_contratante ct
JOIN fat_contrato c      ON c.id_contratante = ct.id_contratante
JOIN ref_produto p       ON p.id_produto = c.id_produto
LEFT JOIN ref_projeto pj ON pj.id_projeto = c.id_projeto
LEFT JOIN ref_cargo cg   ON cg.id_cargo = c.id_cargo_no_contrato
LEFT JOIN ref_partido pt ON pt.id_partido = c.id_partido_no_contrato;

GRANT SELECT ON vw_visao_mandato TO legisla_gestora, legisla_admin;
