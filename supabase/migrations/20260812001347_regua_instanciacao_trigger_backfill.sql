-- =============================================================================
-- operacao-regua-instanciacao: T4 — app.instancia_contrato (verbatim,
-- docs/schema_sistema.sql:1529-1559, AD-008: não redesenhada, só
-- provisionada) + o wiring que o schema aprovado nunca especificou (essa é a
-- decisão que esta feature resolve, design.md "Architecture"): um trigger
-- AFTER INSERT em fat_contrato, em vez de depender de cada call-site do
-- frontend lembrar de chamar a função (hoje são 3: mandato-wizard.tsx,
-- coalizoes/[id]/page.tsx via CMU-15, rota órfã /mandatos/[id]/contratos/novo).
--
-- SECURITY INVOKER (default, sem cláusula) nas duas funções -- AD-024 proíbe
-- SECURITY DEFINER em escrita de negócio multi-tabela. Quem cria um
-- fat_contrato hoje só passa pelo RLS de fat_contrato (p_por_carteira) sendo
-- admin/gestora (a branch de vínculo não pode ser satisfeita por um
-- id_contrato que acabou de nascer), então o trigger herda esse mesmo papel
-- e a WITH CHECK das 3 tabelas novas (T2) passa pela mesma branch --
-- nenhum privilégio novo é necessário.
--
-- Backfill na mesma migration que o trigger (RGI-06, AC1 do spec.md,
-- literal): cobre os contratos já existentes em dev (CMU-15, wizard) e,
-- quando esta migration chegar em produção, os contratos de lá também.
-- Idempotente por construção -- app.instancia_contrato já usa
-- ON CONFLICT DO NOTHING nas 3 tabelas; rodar o backfill de novo não duplica.
-- =============================================================================

-- Instancia o mandato (jornada A1.6): cria a régua com datas previstas.
-- Substitui a réplica de planilha, os Typeforms e a pasta do Drive.
CREATE OR REPLACE FUNCTION app.instancia_contrato(p_id_contrato BIGINT)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_id_produto BIGINT; v_dt DATE;
BEGIN
  SELECT id_produto, COALESCE(dt_inicio, CURRENT_DATE) INTO v_id_produto, v_dt
    FROM fat_contrato WHERE id_contrato = p_id_contrato;

  INSERT INTO fat_etapa_contrato (id_contrato, id_etapa, status, dt_prevista_inicio, dt_prevista_conclusao)
  SELECT p_id_contrato, e.id_etapa, 'nao_iniciada',
         -- SUM() devolve BIGINT e não existe operador date + bigint: cast explícito.
         v_dt + COALESCE(SUM(anterior.duracao_prevista_dias), 0)::INT,
         v_dt + COALESCE(SUM(anterior.duracao_prevista_dias), 0)::INT
              + COALESCE(e.duracao_prevista_dias, 0)::INT
    FROM ref_etapa e
    LEFT JOIN ref_etapa anterior
           ON anterior.id_produto = e.id_produto AND anterior.ordem < e.ordem
   WHERE e.id_produto = v_id_produto
   GROUP BY e.id_etapa, e.duracao_prevista_dias
  ON CONFLICT (id_contrato, id_etapa) DO NOTHING;

  INSERT INTO dim_planejamento (id_contrato)
  VALUES (p_id_contrato)
  ON CONFLICT (id_contrato) DO NOTHING;

  INSERT INTO rel_formulario_contrato (id_contrato, id_formulario, estado)
  SELECT p_id_contrato, f.id_formulario, 'fechado'
    FROM ref_formulario f
    JOIN ref_etapa e ON e.id_etapa = f.id_etapa
   WHERE e.id_produto = v_id_produto AND f.ativo
  ON CONFLICT (id_contrato, id_formulario) DO NOTHING;
END $$;

-- Wrapper: app.instancia_contrato espera BIGINT: um trigger AFTER INSERT
-- precisa de uma função que leia NEW.id_contrato (não existe no schema
-- aprovado -- detalhe de implementação resolvido em design.md).
CREATE OR REPLACE FUNCTION app.trg_instancia_contrato() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM app.instancia_contrato(NEW.id_contrato);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fat_contrato_instancia ON fat_contrato;
CREATE TRIGGER trg_fat_contrato_instancia
  AFTER INSERT ON fat_contrato
  FOR EACH ROW EXECUTE FUNCTION app.trg_instancia_contrato();

-- Backfill: contratos criados antes deste trigger existir.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id_contrato FROM fat_contrato LOOP
    PERFORM app.instancia_contrato(r.id_contrato);
  END LOOP;
END $$;
