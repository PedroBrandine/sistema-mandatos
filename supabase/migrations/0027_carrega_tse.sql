-- =============================================================================
-- Migration 0027: versiona public.carrega_tse
--
-- Esta função existia apenas no projeto de dev, criada fora de banda (SQL
-- Editor) e nunca versionada. Detectada em 04/08/2026 ao comparar os advisors
-- do dev com os do projeto de produção recém-criado: o dev acusava 3 achados
-- em `public.carrega_tse` que o prod não tinha, simplesmente porque a função
-- não existia lá.
--
-- É usada por `DADOS TSE/carga_amostral.js` para carga em lote das tabelas do
-- schema `tse`, e já aparece em src/backend/supabase/database.types.ts.
--
-- Definição extraída de pg_get_functiondef() no dev, com uma única alteração:
-- acrescentado `SET search_path`. A função é SECURITY DEFINER e sem search_path
-- fixo fica sujeita a sequestro de resolução de nomes (advisor
-- `function_search_path_mutable`). Como o corpo já qualifica todos os objetos
-- com `tse.`, a mudança é neutra em comportamento.
--
-- NOTA DE SEGURANÇA: no dev esta função está executável por `anon` e
-- `authenticated` via /rest/v1/rpc/carrega_tse (advisors
-- `anon_security_definer_function_executable` e
-- `authenticated_security_definer_function_executable`). Um REVOKE não é feito
-- aqui de propósito -- é decisão em aberto, registrada em
-- docs/baseline-dev-2026-08-04.md, e merece migration própria.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.carrega_tse(tabela text, dados jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, tse, pg_temp
AS $function$
BEGIN
  IF tabela = 'dim_candidatura' THEN
    INSERT INTO tse.dim_candidatura SELECT * FROM jsonb_populate_recordset(null::tse.dim_candidatura, dados) ON CONFLICT DO NOTHING;
  ELSIF tabela = 'fat_votacao_zona' THEN
    INSERT INTO tse.fat_votacao_zona SELECT * FROM jsonb_populate_recordset(null::tse.fat_votacao_zona, dados) ON CONFLICT DO NOTHING;
  ELSIF tabela = 'dim_perfil_eleitorado' THEN
    INSERT INTO tse.dim_perfil_eleitorado (ano_eleicao, sg_uf, cd_municipio, nm_municipio, nr_zona, ds_genero, ds_estado_civil, ds_faixa_etaria, ds_grau_escolaridade, ds_raca_cor, ds_identidade_genero, ds_quilombola, ds_interprete_libras, qt_eleitores, qt_eleitores_deficiencia)
    SELECT ano_eleicao, sg_uf, cd_municipio, nm_municipio, nr_zona, ds_genero, ds_estado_civil, ds_faixa_etaria, ds_grau_escolaridade, ds_raca_cor, ds_identidade_genero, ds_quilombola, ds_interprete_libras, qt_eleitores, qt_eleitores_deficiencia FROM jsonb_populate_recordset(null::tse.dim_perfil_eleitorado, dados);
  ELSIF tabela = 'rel_rede_social' THEN
    INSERT INTO tse.rel_rede_social SELECT * FROM jsonb_populate_recordset(null::tse.rel_rede_social, dados) ON CONFLICT DO NOTHING;
  END IF;
END;
$function$;
