-- =============================================================================
-- T16: RLS já aprovada nas tabelas de Fundação (docs/schema_sistema.sql:
-- 1451-1473, 1615-1656, verbatim) -- app.contratos_do_usuario() (nova) +
-- políticas p_por_carteira sobre dim_contratante/dim_mandato/dim_coalizao/
-- rel_mandato_candidatura/fat_contrato, e p_por_contrato sobre
-- rel_coalizao_membro (extraído do loop genérico do schema aprovado, que
-- mistura tabelas de Operação ainda não provisionadas -- só rel_coalizao_membro
-- existe hoje).
--
-- Renumerado: tasks.md nomeia este arquivo "0009_fundacao_rls.sql"; deslocado
-- para 0011 pelo mesmo motivo de renumeração de T11-T15.
--
-- p_vinculo_proprio (rel_usuario_contrato) já foi aplicada em T13 -- guardada
-- aqui com IF NOT EXISTS, não recriada (T16 só confirma que existe).
-- p_usuario (dim_usuario) já existe desde o pré-requisito de Fase 0.
-- =============================================================================

-- Carteira do usuário como array (docs/schema_sistema.sql:1465-1473, verbatim).
-- SECURITY DEFINER de propósito: não é submetida ao RLS de rel_usuario_contrato
-- (que não tem FORCE justamente por isso).
CREATE OR REPLACE FUNCTION app.contratos_do_usuario() RETURNS BIGINT[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS
$$ SELECT COALESCE(array_agg(v.id_contrato), '{}'::BIGINT[])
     FROM rel_usuario_contrato v
    WHERE v.id_usuario = app.id_usuario()
      AND (v.dt_fim IS NULL OR v.dt_fim >= CURRENT_DATE) $$;

COMMENT ON FUNCTION app.contratos_do_usuario() IS
'SECURITY DEFINER de propósito: executa como dono da tabela e por isso não é submetida ao RLS de rel_usuario_contrato — sem isso a política se autorreferenciaria. É a razão de rel_usuario_contrato NÃO ter FORCE ROW LEVEL SECURITY.';

-- Confirma p_vinculo_proprio (T13) sem recriar -- AD-001 já satisfeito lá.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rel_usuario_contrato' AND policyname = 'p_vinculo_proprio'
  ) THEN
    RAISE EXCEPTION 'p_vinculo_proprio ausente em rel_usuario_contrato -- esperada de T13';
  END IF;
END $$;

-- Fundação: mandato/contratante/coalizão/candidatura visíveis por vínculo com
-- algum contrato da carteira do usuário; fat_contrato usa id_contrato direto.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('dim_contratante',
     'EXISTS (SELECT 1 FROM fat_contrato c WHERE c.id_contratante = dim_contratante.id_contratante
                AND c.id_contrato = ANY(app.contratos_do_usuario()))'),
    ('dim_mandato',
     'EXISTS (SELECT 1 FROM fat_contrato c WHERE c.id_contratante = dim_mandato.id_contratante
                AND c.id_contrato = ANY(app.contratos_do_usuario()))'),
    ('dim_coalizao',
     'EXISTS (SELECT 1 FROM fat_contrato c WHERE c.id_contratante = dim_coalizao.id_contratante
                AND c.id_contrato = ANY(app.contratos_do_usuario()))'),
    ('rel_mandato_candidatura',
     'EXISTS (SELECT 1 FROM dim_mandato m JOIN fat_contrato c ON c.id_contratante = m.id_contratante
               WHERE m.id_mandato = rel_mandato_candidatura.id_mandato
                 AND c.id_contrato = ANY(app.contratos_do_usuario()))'),
    ('fat_contrato',
     'id_contrato = ANY(app.contratos_do_usuario())')
  ) AS v(tabela, predicado) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tabela);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', r.tabela);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = r.tabela AND policyname = 'p_por_carteira') THEN
      EXECUTE format($f$CREATE POLICY p_por_carteira ON %I
                          USING (app.papel_atual() IN ('admin','gestora') OR (%s))$f$,
                     r.tabela, r.predicado);
    END IF;
  END LOOP;
END $$;

-- rel_coalizao_membro: extraído do loop genérico "p_por_contrato" do schema
-- aprovado (docs/schema_sistema.sql:1568-1582) -- só esta tabela do array
-- existe hoje; as demais (fat_etapa_contrato, rel_formulario_contrato, ...)
-- são Operação, fora do escopo desta feature.
DO $$
BEGIN
  ALTER TABLE rel_coalizao_membro ENABLE ROW LEVEL SECURITY;
  ALTER TABLE rel_coalizao_membro FORCE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rel_coalizao_membro' AND policyname = 'p_por_contrato') THEN
    EXECUTE $sql$
      CREATE POLICY p_por_contrato ON rel_coalizao_membro
        USING (app.papel_atual() IN ('admin','gestora')
               OR id_contrato = ANY(app.contratos_do_usuario()))
    $sql$;
  END IF;
END $$;

-- Mentor: acesso de leitura à carteira própria (docs/schema_sistema.sql:2084-2089,
-- escopado às tabelas que já existem hoje -- dim_planejamento, fat_objetivo_especifico,
-- fat_meta, fat_etapa_contrato, rel_formulario_contrato, fat_artefato,
-- fat_snapshot_mensal, vw_carteira, vw_etapa_contrato, vw_sucesso_mensal,
-- mv_iip_contrato ainda não existem -- fora do escopo desta feature).
--
-- SPEC_DEVIATION (bug found during Execute review of this task, not the
-- original scope): the line below originally granted only
-- fat_contrato/dim_contratante/dim_mandato. RLS just enabled dim_coalizao,
-- rel_mandato_candidatura and rel_coalizao_membro too (all 6 are this same
-- migration's RLS targets, right above), but GRANT is evaluated before RLS
-- -- with no SELECT privilege, mentor got 42501 ("permission denied") on the
-- 3 missing tables regardless of the policy, which the T16 test caught.
-- rel_usuario_contrato is also added: it's in the approved schema's own
-- mentor grant line (docs/schema_sistema.sql:2087) and was never granted by
-- any prior task (T13 only handled dim_usuario). All 4 additions are
-- read-only and still fully filtered by each table's own RLS policy.
GRANT SELECT ON
  fat_contrato, dim_contratante, dim_mandato, dim_coalizao,
  rel_mandato_candidatura, rel_coalizao_membro, rel_usuario_contrato
  TO legisla_mentor;
