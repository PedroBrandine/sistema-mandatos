-- =============================================================================
-- formularios-produto: achado do Verifier (Major, FRM-11) -- "somente
-- leitura pro respondente comum quando permite_edicao_aberta=false" era
-- imposto SÓ pela UI (botão desabilitado em formulario-generico-form.tsx),
-- nunca pela RLS. Qualquer respondente autenticado podia chamar
-- .from("fat_submissao").update(...) direto (devtools/API) e alterar uma
-- resposta já fechada -- viola AD-002 ("autorização é sempre decidida pela
-- RLS, nunca pela UI") e a decisão registrada em context.md.
--
-- Fix via política RESTRICTIVE nova, escopada a FOR UPDATE (não altera
-- p_por_contrato -- SELECT continua liberado pra leitura, só o UPDATE ganha
-- uma restrição extra que se soma via AND às políticas permissivas
-- existentes). USING de política de UPDATE enxerga a linha ANTES do update
-- (estado atual) -- como esta política só vale pra UPDATE, toda linha que
-- chega aqui já existe (INSERT nunca passa por FOR UPDATE), então não
-- precisa checar "é a 1a escrita" -- só precisa checar se o formulário
-- permite edição aberta.
-- =============================================================================

CREATE POLICY p_bloqueia_reenvio_fechado ON fat_submissao
  AS RESTRICTIVE FOR UPDATE
  USING (
    app.papel_atual() IN ('admin','gestora')
    OR EXISTS (
      SELECT 1 FROM ref_formulario rf
       WHERE rf.id_formulario = fat_submissao.id_formulario
         AND rf.permite_edicao_aberta = true
    )
  );
