-- =============================================================================
-- visao-gerencial-g3-g6: fix pós-Verifier (achado Cosmético, validation.md
-- rodada 1) -- o COMMENT ON VIEW de vw_resposta_formulario
-- (20260814210823_visao_gerencial_vw_resposta_formulario.sql) descrevia
-- `respondido` como "existe fat_submissao finalizada (enviada_em
-- preenchido) posterior à abertura", mas a view nunca checou enviada_em nem
-- posterioridade -- é EXISTS puro por (id_contrato, id_formulario)
-- (fat_submissao.enviada_em é NOT NULL DEFAULT now(), toda linha já nasce
-- "finalizada", ver comentário original da view). Migration forward-only:
-- não edita a migration já aplicada, só substitui o COMMENT.
-- =============================================================================

COMMENT ON VIEW vw_resposta_formulario IS
'G4 (Bloco 0, GER-08). 1 linha por abertura de formulário × contrato. respondido = existe ao menos uma linha em fat_submissao pra esse (id_contrato, id_formulario), sem checar enviada_em nem posterioridade em relação a dt_abertura (toda submissão já nasce com enviada_em preenchido, não há rascunho). Agregação por formulário fica na camada de query TS.';
