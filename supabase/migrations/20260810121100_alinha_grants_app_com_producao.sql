-- Alinha o banco de dev com produção: retira das roles do PostgREST as
-- concessões em bloco sobre as funções do schema `app`.
--
-- O QUE FOI ENCONTRADO
--
-- O primeiro `drift-check` real (10/08/2026) mostrou 30 concessões
-- `GRANT ALL ON FUNCTION app.* TO anon, authenticated, service_role` no banco
-- de DEV e **zero** em produção. Nenhuma migration concede isso: a `0004` dá
-- EXECUTE em `app.*` apenas aos cinco papéis `legisla_*`, e a `0002` revoga o
-- hook de auth de `anon`/`authenticated` explicitamente.
--
-- Assinatura de SQL rodado à mão. O suspeito é a receita padrão de "expor um
-- schema no Supabase", que faz GRANT USAGE + GRANT ALL ON ALL TABLES + GRANT
-- ALL ON ALL FUNCTIONS de uma vez -- sendo que a `0028` precisava só do
-- GRANT USAGE. Produção, provisionada do zero a partir das migrations, saiu
-- correta; dev carregava o excedente.
--
-- POR QUE ISSO NÃO QUEBRA NADA
--
-- O Postgres concede EXECUTE a PUBLIC em toda função nova, e é por PUBLIC que
-- `anon`/`authenticated` alcançam `app.pre_request` (o `db-pre-request` do
-- PostgREST roda já com o papel trocado, então precisa desse acesso -- foi a
-- falta do GRANT USAGE no schema que derrubou a produção em 06/08).
-- `REVOKE ... FROM anon` não toca a concessão a PUBLIC.
--
-- A prova está em produção: ela nunca teve essas 30 concessões e funciona.
--
-- Em produção esta migration é no-op.

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM anon, authenticated, service_role;

-- Sem isso, função nova criada em `app` volta a receber as concessões em bloco
-- se as default privileges do projeto estiverem valendo, e a deriva renasce.
ALTER DEFAULT PRIVILEGES IN SCHEMA app
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;

-- NOTA, deliberadamente fora do escopo desta migration: continua valendo o
-- EXECUTE a PUBLIC que o Postgres dá por padrão, inclusive em funções
-- `SECURITY DEFINER` do schema `app`. Endurecer isso (REVOKE ... FROM PUBLIC
-- + GRANT explícito por papel) é uma mudança de superfície de ataque que
-- precisa ser testada função por função, não um efeito colateral de um
-- alinhamento de ambientes.
