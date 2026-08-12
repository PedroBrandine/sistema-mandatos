-- =============================================================================
-- operacao-regua-instanciacao: T2 — RLS das 3 tabelas criadas em
-- regua_instanciacao_estrutura.sql, mesmo padrão p_por_contrato aplicado a
-- rel_coalizao_membro em 0011_fundacao_rls.sql (docs/schema_sistema.sql:
-- 1568-1582).
--
-- Desvio deliberado do texto aprovado: o schema só declara `USING`. Esta
-- migration acrescenta `WITH CHECK` explícito e idêntico -- decisão
-- confirmada em design.md, mesma categoria de correção da FND-USR-02
-- (20260810181508_fix_with_check_p_usuario.sql): sem WITH CHECK explícito,
-- uma policy FOR ALL reaproveita a USING como critério de escrita, e
-- "parecer equivalente" foi exatamente o que escondeu aquele bug. Aqui a
-- condição é a mesma (id_contrato), mas fica explícita por princípio, não
-- por confiança na equivalência.
-- =============================================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['fat_etapa_contrato', 'rel_formulario_contrato', 'dim_planejamento'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($f$
      CREATE POLICY p_por_contrato ON %I
        USING (app.papel_atual() IN ('admin','gestora')
               OR id_contrato = ANY(app.contratos_do_usuario()))
        WITH CHECK (app.papel_atual() IN ('admin','gestora')
               OR id_contrato = ANY(app.contratos_do_usuario()))
    $f$, t);
  END LOOP;
END $$;
