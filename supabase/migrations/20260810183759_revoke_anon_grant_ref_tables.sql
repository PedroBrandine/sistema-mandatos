-- =============================================================================
-- Achado da Trilha C (.specs/features/catalogos-referencia/) -- os 4 catálogos
-- ref_* já existentes (0024_ref_tables_rls_fix.sql) concedem SELECT a `anon`,
-- contradizendo o texto do AD-002 ("nenhum acesso é anônimo") e da Regra
-- Inegociável nº4 da Constituição (§6): "Nenhum acesso é anônimo -- nem
-- leitura, nem resposta de formulário."
--
-- Não é falha teórica: qualquer requisição PostgREST sem sessão (chave anon,
-- sem login) lê `ref_cargo`/`ref_partido`/`ref_produto`/`ref_projeto` hoje.
-- Baixo dano de dado (são catálogos, não dado pessoal/negocial sensível), mas
-- é uma exceção real e não documentada à regra inegociável -- tratada com a
-- mesma prioridade da FND-USR-02 (AD-030 em .specs/STATE.md).
--
-- RLS continua desligada nessas 4 tabelas (e nas 12 novas da Trilha C) --
-- catálogo somente-leitura não tem `id_contrato`/carteira pra filtrar por
-- linha; a exceção documentada em AD-030 é sobre RLS, não sobre GRANT. GRANT
-- a `anon` nunca teve justificativa equivalente e é revogado aqui.
-- =============================================================================

REVOKE SELECT ON public.ref_cargo, public.ref_partido, public.ref_produto, public.ref_projeto FROM anon;
