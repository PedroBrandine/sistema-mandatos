-- =============================================================================
-- planejamento-planilha-monitoramento: T2 -- RLS das 4 tabelas criadas em
-- planejamento_planilha_estrutura.sql. Cadeia de herança (RLS não é
-- transitiva -- cada nível é declarado explicitamente), predicados EXISTS
-- verbatim (docs/schema_sistema.sql:1589-1597).
--
-- Desvio deliberado do texto aprovado: o schema só declara `USING` para
-- p_heranca (docs/schema_sistema.sql:1611: "CREATE POLICY p_heranca ON %I
-- USING (%s)"). Esta migration acrescenta `WITH CHECK` idêntico e explícito
-- -- mesma convenção já estabelecida por operacao-regua-instanciacao
-- (20260812001234_regua_instanciacao_rls.sql) pela mesma razão da correção
-- FND-USR-02: sem WITH CHECK explícito, uma policy FOR ALL reaproveita a
-- USING como critério de escrita, e "parecer equivalente" foi exatamente o
-- que escondeu aquele bug -- aqui o comportamento é o mesmo, só deixado
-- explícito por princípio.
-- =============================================================================

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('fat_objetivo_especifico',
     'EXISTS (SELECT 1 FROM dim_planejamento p WHERE p.id_planejamento = fat_objetivo_especifico.id_planejamento)'),
    ('rel_planejamento_preditor',
     'EXISTS (SELECT 1 FROM dim_planejamento p WHERE p.id_planejamento = rel_planejamento_preditor.id_planejamento)'),
    ('fat_meta',
     'EXISTS (SELECT 1 FROM fat_objetivo_especifico o WHERE o.id_objetivo = fat_meta.id_objetivo)'),
    ('fat_sucesso_mensal',
     'EXISTS (SELECT 1 FROM fat_meta m WHERE m.id_meta = fat_sucesso_mensal.id_meta)')
  ) AS v(tabela, predicado) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tabela);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', r.tabela);
    EXECUTE format($f$
      CREATE POLICY p_heranca ON %I
        USING (%s)
        WITH CHECK (%s)
    $f$, r.tabela, r.predicado, r.predicado);
  END LOOP;
END $$;
