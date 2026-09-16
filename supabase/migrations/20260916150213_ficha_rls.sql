-- ficha-mandato-contrato: T7 -- RLS das 3 tabelas transacionais criadas em
-- T2/T3/T4 (fat_artefato, rel_registro_participante,
-- rel_mandato_agenda_tematica), fechando a pendencia de AD-001 deixada em
-- aberto por aquelas migrations (comentario "RLS fica para T7" em cada uma).
--
-- fat_artefato: p_por_contrato -- tem id_contrato proprio, mesmo padrao
-- verbatim de fat_encontro/fat_insight/fat_fato_gerador
-- (20260813192341_incidencia_encontros_rls.sql). USING e WITH CHECK
-- explicitos (nao FOR ALL reaproveitando USING -- licao FND-USR-02).
--
-- rel_registro_participante: p_heranca via EXISTS contra fat_registro (que
-- ja tem p_por_contrato + FORCE RLS desde a mesma migration de incidencia) --
-- mesmo padrao de rel_encontro_participante/rel_insight_origem/
-- rel_fato_origem naquele arquivo.
--
-- rel_mandato_agenda_tematica: p_heranca pela cadeia mandato -> contratante
-- -> contrato (design.md, "Data Models"), mesmo predicado de dim_mandato em
-- 0011_fundacao_rls.sql (EXISTS fat_contrato c ON c.id_contratante =
-- m.id_contratante), com admin/gestora atravessando no USING e no WITH
-- CHECK, ja que aqui precisamos de escrita (vincular/desvincular tema), nao
-- so leitura como em dim_mandato.
DO $$
BEGIN
  ALTER TABLE fat_artefato ENABLE ROW LEVEL SECURITY;
  ALTER TABLE fat_artefato FORCE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fat_artefato' AND policyname = 'p_por_contrato'
  ) THEN
    CREATE POLICY p_por_contrato ON fat_artefato
      USING (app.papel_atual() IN ('admin','gestora')
             OR id_contrato = ANY(app.contratos_do_usuario()))
      WITH CHECK (app.papel_atual() IN ('admin','gestora')
             OR id_contrato = ANY(app.contratos_do_usuario()));
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE rel_registro_participante ENABLE ROW LEVEL SECURITY;
  ALTER TABLE rel_registro_participante FORCE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rel_registro_participante' AND policyname = 'p_heranca'
  ) THEN
    CREATE POLICY p_heranca ON rel_registro_participante
      USING (EXISTS (SELECT 1 FROM fat_registro r WHERE r.id_registro = rel_registro_participante.id_registro))
      WITH CHECK (EXISTS (SELECT 1 FROM fat_registro r WHERE r.id_registro = rel_registro_participante.id_registro));
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE rel_mandato_agenda_tematica ENABLE ROW LEVEL SECURITY;
  ALTER TABLE rel_mandato_agenda_tematica FORCE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rel_mandato_agenda_tematica' AND policyname = 'p_heranca'
  ) THEN
    CREATE POLICY p_heranca ON rel_mandato_agenda_tematica
      USING (app.papel_atual() IN ('admin','gestora')
             OR EXISTS (SELECT 1 FROM dim_mandato m JOIN fat_contrato c ON c.id_contratante = m.id_contratante
                         WHERE m.id_mandato = rel_mandato_agenda_tematica.id_mandato
                           AND c.id_contrato = ANY(app.contratos_do_usuario())))
      WITH CHECK (app.papel_atual() IN ('admin','gestora')
             OR EXISTS (SELECT 1 FROM dim_mandato m JOIN fat_contrato c ON c.id_contratante = m.id_contratante
                         WHERE m.id_mandato = rel_mandato_agenda_tematica.id_mandato
                           AND c.id_contrato = ANY(app.contratos_do_usuario())));
  END IF;
END $$;
