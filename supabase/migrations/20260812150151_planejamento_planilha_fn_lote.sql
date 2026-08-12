-- =============================================================================
-- planejamento-planilha-monitoramento: T6 -- RPC nova, fora do texto aprovado
-- (justificada em design.md "Tech Decisions" por AD-024: escrita que cruza
-- mais de uma linha precisa de atomicidade real -- N chamadas soltas
-- deixariam estado parcial se uma falhar no meio, exatamente o problema que
-- a AD-024 documenta).
--
-- app.atualiza_sucessos_mensais_lote: escreve uma faixa colada de
-- pct_atingimento (PLM-03) num único UPDATE -- atômico por construção (é 1
-- statement; se qualquer linha violar ck_sucesso_pct, o statement inteiro
-- reverte, nenhuma célula salva parcialmente). SECURITY INVOKER (sem
-- cláusula, AD-024) -- a RLS p_heranca (T2) e o GRANT UPDATE (T3) do
-- chamador continuam valendo linha a linha: uma linha fora da carteira do
-- chamador simplesmente não casa no UPDATE (RLS filtra silenciosamente, sem
-- erro) -- não é bypass de autorização.
--
-- Escopo travado em pct_atingimento -- peso/descricao/mes_referencia/
-- dt_limite são editados via dialog por linha (T15), não pela grade.
-- =============================================================================

CREATE OR REPLACE FUNCTION app.atualiza_sucessos_mensais_lote(p_valores JSONB)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE fat_sucesso_mensal sm
     SET pct_atingimento = v.pct_atingimento,
         atualizado_por  = app.id_usuario(),
         atualizado_em   = now()
    FROM jsonb_to_recordset(p_valores) AS v(id_sucesso BIGINT, pct_atingimento NUMERIC)
   WHERE sm.id_sucesso = v.id_sucesso;
END $$;
