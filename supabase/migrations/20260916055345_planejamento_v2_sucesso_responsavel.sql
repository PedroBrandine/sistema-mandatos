-- =============================================================================
-- planejamento-estrategico-v2: T3 -- fat_sucesso_mensal ganha
-- id_usuario_responsavel (PLV-03 AC1, decisão D-2 de context.md).
--
-- POR QUE: a tela desenhada (nó 227:194) mostra avatares DIFERENTES por linha
-- de Sucesso Mensal. Hoje responsável é campo da Meta -- todos os Sucessos de
-- uma Meta teriam o mesmo rosto. O modal 271:856 traz person picker próprio.
--
-- NÃO É atualizado_por. `atualizado_por` (auditoria, AD-006) guarda QUEM MEXEU
-- POR ÚLTIMO e continua existindo em paralelo, intocado -- a coluna nova guarda
-- DE QUEM É A TAREFA. Confundir as duas foi exatamente o erro que a revisão de
-- mockup apontou.
--
-- ANULÁVEL de propósito: Sucesso Mensal sem responsável próprio exibe o da
-- Meta, marcado como herdado; ausência real dos dois é '—' (AD-005). Sentinela
-- não entra.
--
-- SEM COLUNA `ordem` (alterado em 2026-09-16, decisão de Pedro): o desenho
-- original previa `ordem SMALLINT` aqui para servir ao arrastar-e-soltar
-- (PLV-10). PLV-10 saiu do escopo, e migration é forward-only -- uma coluna
-- sem consumidor nasceria morta e só sairia com outro arquivo depois. Quando o
-- arrastar voltar, volta com a coluna na mesma migration.
--
-- AD-001 não é acionada: nenhuma tabela nova. A coluna entra numa tabela que
-- já tem RLS (p_heranca) e trigger de auditoria (trg_audit_fat_sucesso_mensal).
-- =============================================================================

ALTER TABLE fat_sucesso_mensal
  ADD COLUMN IF NOT EXISTS id_usuario_responsavel BIGINT REFERENCES dim_usuario(id_usuario);

COMMENT ON COLUMN fat_sucesso_mensal.id_usuario_responsavel IS
'De quem é a entrega deste Sucesso Mensal. Distinto de atualizado_por (auditoria, AD-006). Nulo significa herdar o responsável da Meta na exibição — nunca sentinela (AD-005).';
