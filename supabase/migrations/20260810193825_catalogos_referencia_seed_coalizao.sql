-- =============================================================================
-- Trilha C (.specs/features/catalogos-referencia/), CAT-17: régua de etapas
-- da Coalizão. D9 (docs/schema_sistema.sql:35-36) estava em aberto no schema
-- aprovado -- RESOLVIDA por Pedro em 2026-08-10 (.specs/features/catalogos-referencia/spec.md):
-- a Coalizão clona a régua da Estratégia.
--
-- INSERT verbatim de docs/schema_sistema.sql:2254-2259 (estava escrito e
-- comentado no schema aprovado, esperando exatamente esta confirmação).
-- Migração de seed separada da estrutura, depois que a régua da Estratégia
-- já está semeada (20260810193327_catalogos_referencia_seed.sql) -- a
-- clonagem depende dela.
-- =============================================================================

INSERT INTO ref_etapa (id_produto, codigo, nome, ordem, duracao_prevista_dias, gera_registro)
SELECT (SELECT id_produto FROM ref_produto WHERE nome = 'Coalizão'),
       e.codigo, e.nome, e.ordem, e.duracao_prevista_dias, e.gera_registro
  FROM ref_etapa e JOIN ref_produto p ON p.id_produto = e.id_produto
 WHERE p.nome = 'Estratégia'
ON CONFLICT (id_produto, codigo) DO NOTHING;
