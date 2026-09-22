-- RLS + GRANTs de fat_edicao/rel_edicao_mentor (mesmo padrão de
-- 20260922072332/072336 para fat_cadastro_participante).
--
-- fat_edicao não carrega id_contrato (é anterior a qualquer contrato -- uma
-- edição pode não ter nenhum participante vinculado ainda), então
-- app.contratos_do_usuario() não se aplica. Quem lê/escreve: Admin/Gestora
-- (CRUD completo -- é quem cria e organiza a operação do PLL) e Mentor
-- (SELECT -- precisa ver as edições para se situar, nunca cria/edita).
-- Assessor fica de fora (mesmo racional de fat_cadastro_participante).

ALTER TABLE fat_edicao ENABLE ROW LEVEL SECURITY;
ALTER TABLE fat_edicao FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'fat_edicao' AND policyname = 'p_leitura_ampla_escrita_gestora'
  ) THEN
    CREATE POLICY p_leitura_ampla_escrita_gestora ON fat_edicao
      USING (app.papel_atual() IN ('admin', 'gestora', 'mentor'))
      WITH CHECK (app.papel_atual() IN ('admin', 'gestora'));
  END IF;
END $$;

ALTER TABLE rel_edicao_mentor ENABLE ROW LEVEL SECURITY;
ALTER TABLE rel_edicao_mentor FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'rel_edicao_mentor' AND policyname = 'p_leitura_ampla_escrita_gestora'
  ) THEN
    CREATE POLICY p_leitura_ampla_escrita_gestora ON rel_edicao_mentor
      USING (app.papel_atual() IN ('admin', 'gestora', 'mentor'))
      WITH CHECK (app.papel_atual() IN ('admin', 'gestora'));
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;

GRANT SELECT ON fat_edicao, rel_edicao_mentor TO legisla_mentor;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO legisla_mentor;
