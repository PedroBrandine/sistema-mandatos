-- =============================================================================
-- planejamento-planilha-monitoramento: T4 fix -- achado real de Execute (só
-- aparece rodando o gate de integração de verdade, não por leitura de
-- código): as 5 funções de marcação (trg_marca_desatualizado_novos/antigos/
-- upd, trg_marca_por_meta_upd/ins) e app.recalcula_atingimento são
-- SECURITY INVOKER (verbatim do schema aprovado, T4) -- mas escrevem em
-- dim_planejamento/fat_meta/fat_objetivo_especifico, tabelas onde Mentor e
-- Assessor só têm GRANT SELECT (docs/schema_sistema.sql:2084-2089/2095-2098).
--
-- Reproduzido: Assessor faz UPDATE em fat_sucesso_mensal (coluna que ele TEM
-- GRANT UPDATE) -> dispara trg_sm_upd (STATEMENT-level) -> chama
-- app.trg_marca_desatualizado_upd() -> essa função tenta
-- "UPDATE dim_planejamento SET atingimento_desatualizado = true" como o
-- PRÓPRIO Assessor (SECURITY INVOKER) -> 42501, porque Assessor não tem
-- UPDATE em dim_planejamento. Mesma falha pra Mentor fazendo INSERT em
-- fat_sucesso_mensal (trg_sm_ins) e, por extensão, para qualquer papel sem
-- UPDATE amplo chamando app.recalcula_atingimento diretamente (ele escreve
-- fat_meta/fat_objetivo_especifico/dim_planejamento, e só Gestora/Admin/app
-- têm UPDATE nas 3).
--
-- Fix: SECURITY DEFINER + SET search_path (mesmo padrão já usado por
-- app.trg_auditoria(), 0012_fundacao_auditoria_gap.sql -- escrita de sistema
-- num valor derivado/cache que o papel chamador legitimamente não tem GRANT
-- direto, contra dado que o próprio chamador já podia SELECT). Não é a
-- exceção que AD-024 proíbe: essas 6 funções não deixam o chamador escrever
-- dado arbitrário -- recomputam determinística e automaticamente colunas
-- derivadas (pct_atingimento/atingimento_desatualizado) a partir de dados
-- que o chamador já lê, sem parâmetro que controle O QUE é escrito. Nenhuma
-- tabela muda de desenho -- só a característica de execução de função já
-- extraída verbatim. app.recalcula_pendentes fica INVOKER (não escreve nada
-- diretamente, só chama recalcula_atingimento via PERFORM, que já roda como
-- DEFINER independente de quem a chamou).
--
-- Registrado como AD-035 em .specs/STATE.md (decisão de arquitetura --
-- supera o alcance geral da AD-024 para esta classe estreita de função).
-- =============================================================================

ALTER FUNCTION app.recalcula_atingimento(BIGINT) SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION app.trg_marca_desatualizado_novos() SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION app.trg_marca_desatualizado_antigos() SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION app.trg_marca_desatualizado_upd() SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION app.trg_marca_por_meta_upd() SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION app.trg_marca_por_meta_ins() SECURITY DEFINER SET search_path = public, pg_temp;
