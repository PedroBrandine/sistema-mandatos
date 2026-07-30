-- =============================================================================
-- T18: índice de busca TSE por nome (fuzzy) -- suporte a FND-TSE-01/FND-TSM-01
-- (busca de candidaturas por nome sobre tse.mv_candidatura_resumo, que ainda
-- não tem nenhum índice de texto -- ver design.md "Risks & Concerns").
--
-- Renumerado: tasks.md nomeia este arquivo "0011_tse_busca_indices.sql";
-- deslocado para 0013 pelo mesmo motivo de renumeração de T11-T17.
--
-- Não é extração verbatim de docs/schema_sistema.sql (o schema aprovado não
-- tem este índice) -- é a mitigação de design.md, decidida com o usuário:
-- pg_trgm (T11) + índice GIN trigram sobre app.normaliza_nome(nm_urna),
-- técnica já usada em ix_contratante_nome_norm para dim_contratante.
-- =============================================================================

CREATE INDEX IF NOT EXISTS ix_tse_candidatura_nome_trgm
  ON tse.mv_candidatura_resumo USING gin (app.normaliza_nome(nm_urna) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ix_tse_candidatura_uf_cargo
  ON tse.mv_candidatura_resumo (sg_uf, cd_cargo);
