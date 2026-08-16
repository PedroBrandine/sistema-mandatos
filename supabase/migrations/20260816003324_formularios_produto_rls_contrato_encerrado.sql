-- =============================================================================
-- formularios-produto: achado do Verifier (Minor, FRM-13 -- metade
-- "impedir abrir formulário novo" nunca foi implementada). T4 só bloqueou o
-- lado de fat_submissao ("nova submissão"); rel_formulario_contrato (T16,
-- toggle abrir/fechar) nunca ganhou o check de fat_contrato.status.
--
-- Decisão deliberada, DIFERENTE do bypass admin/gestora usado na WITH CHECK
-- de fat_submissao (T4): ali o bypass faz sentido porque a ação é
-- Gestora/Admin corrigindo/reabrindo a RESPOSTA de outra pessoa (pode ser
-- legítimo mesmo com o contrato já encerrado, ex.: correção histórica).
-- Aqui a ação é "sinalizar que este formulário está aberto pra novas
-- respostas" -- não existe engajamento em andamento pra coletar num
-- contrato encerrado, então NINGUÉM (nem admin/gestora) deveria poder abrir
-- um formulário nessas condições. Sem esse desvio do padrão irmão, o fix
-- não fecharia o gap de verdade: só admin/gestora têm GRANT pra essa ação
-- (FRM-03), então um bypass pra eles seria um no-op.
-- =============================================================================

ALTER POLICY p_por_contrato ON rel_formulario_contrato
  USING (app.papel_atual() IN ('admin','gestora')
         OR id_contrato = ANY(app.contratos_do_usuario()))
  WITH CHECK ((app.papel_atual() IN ('admin','gestora')
         OR id_contrato = ANY(app.contratos_do_usuario()))
         AND (
           estado <> 'aberto'
           OR EXISTS (
             SELECT 1 FROM fat_contrato c
              WHERE c.id_contrato = rel_formulario_contrato.id_contrato
                AND c.status = 'ativo'
           )
         ));
