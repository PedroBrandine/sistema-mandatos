-- =============================================================================
-- visao-gerencial-g3-g6 (.specs/features/visao-gerencial-g3-g6/): T2 --
-- vw_resposta_formulario (Bloco 0 "Saúde da operação", G4, GER-08). 1 linha
-- por (id_contrato, id_formulario) -- a "abertura" (rel_formulario_contrato)
-- é a unidade natural: um formulário pode ter sido reaberto/fechado mais de
-- uma vez pro mesmo contrato, mas cada abertura é sua própria expectativa de
-- resposta. `respondido` reflete existência de ao menos uma linha em
-- fat_submissao pra esse (contrato, formulário) -- ver achado abaixo sobre
-- enviada_em (design.md, Novos objetos de banco).
--
-- security_invoker=true (padrão de toda view da camada Saída, AD-011/AD-015).
-- Agregação por formulário (taxa de resposta, ordenação por taxa) fica na
-- camada de query TS (buscarSaudeFormularios, T10) -- mesmo padrão já usado
-- em buscarCarteiraPonderada, nunca pré-agregada em SQL.
--
-- Achado real (não estava no design.md original): fat_submissao.enviada_em é
-- NOT NULL DEFAULT now() (20260814031909_formularios_produto_estrutura.sql)
-- -- toda linha já nasce com timestamp, não existe "rascunho" sinalizado por
-- enviada_em NULL. `respondido` é só a existência de qualquer submissão pra
-- aquele (contrato, formulário), não uma checagem de campo específico.
-- =============================================================================

CREATE VIEW vw_resposta_formulario WITH (security_invoker = true) AS
SELECT
  rfc.id_abertura,
  rfc.id_contrato,
  rfc.id_formulario,
  rf.nome AS nome_formulario,
  fc.id_produto,
  rfc.estado,
  rfc.dt_abertura,
  EXISTS (
    SELECT 1 FROM fat_submissao fs
     WHERE fs.id_contrato = rfc.id_contrato
       AND fs.id_formulario = rfc.id_formulario
  ) AS respondido
FROM rel_formulario_contrato rfc
JOIN ref_formulario rf ON rf.id_formulario = rfc.id_formulario
JOIN fat_contrato fc   ON fc.id_contrato = rfc.id_contrato;

COMMENT ON VIEW vw_resposta_formulario IS
'G4 (Bloco 0, GER-08). 1 linha por abertura de formulário × contrato. respondido = existe fat_submissao finalizada (enviada_em preenchido) posterior à abertura -- rascunho não conta. Agregação por formulário fica na camada de query TS.';

-- Re-GRANT obrigatório (AD-025, mesmo padrão de 20260812181238_visao_gerencial_views_grants.sql
-- e da vw_pendencias de T1): "ALL TABLES IN SCHEMA public" só cobre as
-- relations que já existiam no momento do GRANT anterior.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
