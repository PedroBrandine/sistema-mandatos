-- =============================================================================
-- planejamento-estrategico-v2: T1 -- fat_objetivo_especifico ganha `status`
-- (PLV-02 AC1, decisão D-1 de context.md).
--
-- POR QUE: o modal de Objetivo Específico desenhado em set/2026 (nó 271:808)
-- traz um select Status, e a tabela não tinha a coluna -- só fat_meta tinha.
-- Sem ela a Gestora não consegue pausar ou descartar um Objetivo inteiro sem
-- apagá-lo, que é justamente o que o redesenho pede.
--
-- GÊNERO MASCULINO, de propósito: ck_meta_status usa o feminino
-- ('ativa','pausada','descartada') porque Meta é feminina; Objetivo é
-- masculino. Concordância importa no rótulo da tela, e o valor gravado é o
-- que o select exibe. Não é divergência de vocabulário -- é a mesma decisão
-- escrita em context.md.
--
-- NOT NULL DEFAULT 'ativo': o DEFAULT preenche as linhas que já existem, então
-- nenhum Objetivo preexistente muda de comportamento (todos continuam contando
-- na média do Planejamento). O efeito do status sobre a cascata entra na
-- migration seguinte (AD-052), separada de propósito -- aqui é só DDL.
--
-- AD-001 não é acionada: nenhuma tabela nova. A coluna entra numa tabela que
-- já tem RLS (p_heranca, 20260812145720) e já tem trigger de auditoria
-- (trg_audit_fat_objetivo_especifico, 20260812150038) -- as duas passam a
-- cobri-la sem trabalho extra.
-- =============================================================================

ALTER TABLE fat_objetivo_especifico
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ativo';

ALTER TABLE fat_objetivo_especifico
  DROP CONSTRAINT IF EXISTS ck_objetivo_status;

ALTER TABLE fat_objetivo_especifico
  ADD CONSTRAINT ck_objetivo_status CHECK (status IN ('ativo', 'pausado', 'descartado'));

COMMENT ON COLUMN fat_objetivo_especifico.status IS
'Espelha fat_meta.status, no masculino (Objetivo é masculino, Meta é feminina). Objetivo não-ativo sai da média do Planejamento — ver app.recalcula_atingimento (AD-052).';
