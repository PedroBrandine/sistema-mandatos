-- =============================================================================
-- incidencia-encontros: T4 -- RLS das 7 tabelas criadas em T2.
--
-- p_por_contrato (USING+WITH CHECK explícitos, mesmo padrão de
-- 20260812001234_regua_instanciacao_rls.sql -- schema aprovado só declara
-- USING; WITH CHECK explícito aqui pela mesma razão da correção FND-USR-02:
-- sem WITH CHECK explícito, uma policy FOR ALL reaproveita a USING como
-- critério de escrita) em fat_encontro/fat_registro/fat_insight/
-- fat_fato_gerador.
--
-- fat_registro ganha uma 2ª cláusula no WITH CHECK (design.md, "2º achado
-- real de Design"): é a única tabela nova com id_usuario_autor NOT NULL
-- recebida por INSERT direto (sem RPC) -- sem esta cláusula, RLS aceitaria
-- um id_usuario_autor diferente de quem está de fato autenticado (spoofing de
-- autoria, contra AD-006).
--
-- p_heranca (EXISTS, mesmo padrão de rel_planejamento_preditor em
-- 20260812145720_planejamento_planilha_rls.sql -- a tabela-pai já tem
-- p_por_contrato/FORCE RLS, então o EXISTS contra ela já embute o mesmo
-- corte por carteira, sem repetir app.papel_atual()/app.contratos_do_usuario()
-- aqui) em rel_encontro_participante (via fat_encontro), rel_insight_origem
-- (via fat_insight), rel_fato_origem (via fat_fato_gerador).
-- =============================================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['fat_encontro', 'fat_insight', 'fat_fato_gerador'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'p_por_contrato') THEN
      EXECUTE format($f$
        CREATE POLICY p_por_contrato ON %I
          USING (app.papel_atual() IN ('admin','gestora')
                 OR id_contrato = ANY(app.contratos_do_usuario()))
          WITH CHECK (app.papel_atual() IN ('admin','gestora')
                 OR id_contrato = ANY(app.contratos_do_usuario()))
      $f$, t);
    END IF;
  END LOOP;
END $$;

-- fat_registro: mesmo predicado, mais a cláusula de autoria no WITH CHECK.
DO $$
BEGIN
  ALTER TABLE fat_registro ENABLE ROW LEVEL SECURITY;
  ALTER TABLE fat_registro FORCE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fat_registro' AND policyname = 'p_por_contrato') THEN
    CREATE POLICY p_por_contrato ON fat_registro
      USING (app.papel_atual() IN ('admin','gestora')
             OR id_contrato = ANY(app.contratos_do_usuario()))
      WITH CHECK ((app.papel_atual() IN ('admin','gestora')
             OR id_contrato = ANY(app.contratos_do_usuario()))
             AND id_usuario_autor = app.id_usuario());
  END IF;
END $$;

-- Tabelas filhas sem id_contrato próprio: EXISTS contra a tabela-pai, que já
-- tem p_por_contrato/FORCE ROW LEVEL SECURITY (acima nesta mesma migration).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('rel_encontro_participante',
     'EXISTS (SELECT 1 FROM fat_encontro e WHERE e.id_encontro = rel_encontro_participante.id_encontro)'),
    ('rel_insight_origem',
     'EXISTS (SELECT 1 FROM fat_insight i WHERE i.id_insight = rel_insight_origem.id_insight)'),
    ('rel_fato_origem',
     'EXISTS (SELECT 1 FROM fat_fato_gerador f WHERE f.id_fato_gerador = rel_fato_origem.id_fato_gerador)')
  ) AS v(tabela, predicado) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tabela);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', r.tabela);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = r.tabela AND policyname = 'p_heranca') THEN
      EXECUTE format($f$
        CREATE POLICY p_heranca ON %I
          USING (%s)
          WITH CHECK (%s)
      $f$, r.tabela, r.predicado, r.predicado);
    END IF;
  END LOOP;
END $$;
