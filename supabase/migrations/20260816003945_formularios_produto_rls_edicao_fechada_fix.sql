-- =============================================================================
-- formularios-produto: fix da migration anterior
-- (20260816003235_formularios_produto_rls_edicao_fechada.sql), achado
-- rodando o teste que a comprova (não por leitura de código).
--
-- USING numa política RESTRICTIVE de UPDATE filtra a linha do conjunto
-- afetado ANTES do UPDATE rodar -- Postgres não levanta erro nesse caso, só
-- afeta 0 linhas silenciosamente. O frontend (mapeiaErroRpc/toast) nunca
-- saberia que a escrita foi bloqueada -- pareceria sucesso sem gravar nada,
-- pior UX que o objetivo original (AD-002 pede rejeição explícita, não
-- silêncio). O que precisa rejeitar com erro é o WITH CHECK, avaliado
-- contra a linha proposta -- isso sim levanta "new row violates row-level
-- security policy" (42501). USING vira `true` (não restringe quais linhas
-- são alvo do UPDATE -- isso já é papel da p_por_contrato original).
-- =============================================================================

ALTER POLICY p_bloqueia_reenvio_fechado ON fat_submissao
  USING (true)
  WITH CHECK (
    app.papel_atual() IN ('admin','gestora')
    OR EXISTS (
      SELECT 1 FROM ref_formulario rf
       WHERE rf.id_formulario = fat_submissao.id_formulario
         AND rf.permite_edicao_aberta = true
    )
  );
