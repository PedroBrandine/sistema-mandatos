-- =============================================================================
-- redesenho-estrategia-tela-first (.specs/features/redesenho-estrategia-tela-first/):
-- T6 -- RLS e GRANTs de fat_prospeccao (EST-04 AC6, AD-001, AD-002).
--
-- Por que a policy nao e p_por_contrato. Toda tabela de operacao recorta a
-- leitura por `id_contrato = ANY(app.contratos_do_usuario())`, que le
-- rel_usuario_contrato. fat_prospeccao nao tem id_contrato (AD-040) -- nao ha
-- vinculo de carteira a consultar, porque nao ha contrato. O dono da linha e
-- id_usuario_resp, e e ele que a policy usa, somado ao papel global de
-- Gestora/Admin, que enxerga tudo (mesmo predicado de papel de
-- p_por_contrato em 20260813192341_incidencia_encontros_rls.sql).
--
-- USING e WITH CHECK explicitos e identicos, mesma razao de
-- 20260812001234_regua_instanciacao_rls.sql e da correcao FND-USR-02: uma
-- policy FOR ALL sem WITH CHECK explicito reaproveita a USING como criterio
-- de escrita, e o reuso implicito ja foi fonte de bug neste projeto.
--
-- FORCE ROW LEVEL SECURITY: a policy vale tambem para o dono da tabela, como
-- nas 7 tabelas de Incidencia.
--
-- Escrita restrita as roles que podem criar contrato. Quem converte uma
-- prospeccao cria um fat_contrato (T7), e INSERT em fat_contrato so existe
-- para legisla_app/legisla_admin/legisla_gestora (0004_plataforma_roles_grants.sql,
-- "acesso pleno, recortado por RLS") -- dar escrita de prospeccao a mentor ou
-- assessor criaria um caminho para abrir uma prospeccao que eles nunca
-- poderiam converter. Mentor e assessor recebem apenas SELECT; a RLS acima
-- reduz esse SELECT as linhas de que sao responsaveis.
--
-- AD-002: anon segue sem nenhum privilegio. authenticated tambem nao -- o
-- acesso passa pelas roles legisla_*, para as quais o hook de JWT faz SET
-- ROLE (0002_plataforma_auth_hook.sql). Os REVOKEs foram feitos na T5 e sao
-- repetidos aqui porque o GRANT em bloco abaixo roda de novo sobre "ALL
-- TABLES IN SCHEMA public": repeti-los mantem a migration correta lida
-- isoladamente.
-- =============================================================================

ALTER TABLE public.fat_prospeccao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fat_prospeccao FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'fat_prospeccao'
       AND policyname = 'p_prospeccao_propria'
  ) THEN
    CREATE POLICY p_prospeccao_propria ON public.fat_prospeccao
      USING (app.papel_atual() IN ('admin','gestora')
             OR id_usuario_resp = app.id_usuario())
      WITH CHECK (app.papel_atual() IN ('admin','gestora')
             OR id_usuario_resp = app.id_usuario());
  END IF;
END $$;

COMMENT ON POLICY p_prospeccao_propria ON public.fat_prospeccao IS
'EST-04 AC6. Sem id_contrato nao ha carteira a consultar: o recorte de linha e por id_usuario_resp, mais o papel global de Gestora/Admin. WITH CHECK explicito de proposito -- nunca reuso implicito da USING.';

-- Re-GRANT em bloco (AD-025): "ALL TABLES/SEQUENCES IN SCHEMA public" so
-- cobriu as tabelas existentes no momento dos GRANTs anteriores.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;

-- Mentor e assessor: leitura apenas, ja recortada pela policy acima.
GRANT SELECT ON public.fat_prospeccao TO legisla_mentor, legisla_assessor;

REVOKE ALL ON public.fat_prospeccao FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.fat_prospeccao_id_prospeccao_seq FROM anon, authenticated;
