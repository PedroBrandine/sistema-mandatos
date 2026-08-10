-- =============================================================================
-- FND-USR-02 (.specs/roadmap.md §1.5 e Trilha E) -- fix de segurança real e
-- explorável, não teórico.
--
-- A política `p_usuario` (0001_plataforma_dim_usuario_prereq.sql) só define
-- USING, sem WITH CHECK explícito. Pelo comportamento padrão do Postgres para
-- políticas FOR ALL, a ausência de WITH CHECK faz o INSERT/UPDATE reutilizar a
-- USING como critério de validação -- e a USING atual só testa o papel de
-- QUEM está escrevendo (`app.papel_atual() IN ('admin','gestora')`), nunca o
-- `papel_global` da linha sendo escrita. Resultado: qualquer Gestora
-- autenticada pode inserir uma linha nova em `dim_usuario` com
-- `papel_global = 'gestora'` OU `'admin'` -- escalonamento de privilégio via
-- RLS, não só "Gestora cadastrando Gestora" como o débito original registrava.
--
-- A UI (usuario-form.tsx) já só mostra as opções "Gestora"/"Admin" para quem
-- já é Admin -- mas isso é gate de UX, e o próprio comentário do componente
-- diz que "o backstop real é RLS/GRANT no banco". Este arquivo entrega esse
-- backstop que estava faltando.
--
-- Verificado no código (2026-08-10): nenhuma tela faz UPDATE de
-- `dim_usuario.papel_global` hoje (usuarios/page.tsx só faz INSERT e DELETE)
-- -- o WITH CHECK abaixo também cobre UPDATE por padrão de RLS, sem quebrar
-- nenhum fluxo existente.
-- =============================================================================

DROP POLICY IF EXISTS p_usuario ON dim_usuario;

CREATE POLICY p_usuario ON dim_usuario
  USING (app.papel_atual() IN ('admin', 'gestora') OR id_usuario = app.id_usuario())
  WITH CHECK (
    -- Criar/editar linha com papel_global 'admin' ou 'gestora' exige já ser
    -- Admin. Mentor/assessor continuam livres para quem já passa na USING.
    (papel_global NOT IN ('admin', 'gestora')) OR app.papel_atual() = 'admin'
  );
