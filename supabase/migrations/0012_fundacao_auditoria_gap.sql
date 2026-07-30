-- =============================================================================
-- T17: estende o padrão de auditoria (app.trg_auditoria(), já aprovado em
-- docs/schema_sistema.sql:1674-1710) a dim_contratante, dim_coalizao e
-- rel_coalizao_membro -- as 3 tabelas que o loop original do schema aprovado
-- (docs/schema_sistema.sql:1712-1732) deixou de fora, violando AD-006 ("toda
-- escrita guarda autor e timestamp"). Gap documentado e decidido com o
-- usuário em design.md ("## Risks & Concerns") como aditivo -- mesma função,
-- sem alteração, só estendendo o loop de triggers para estas 3 tabelas.
--
-- Renumerado: tasks.md nomeia este arquivo "0010_fundacao_auditoria_gap.sql";
-- deslocado para 0012 pelo mesmo motivo de renumeração de T11-T16.
-- =============================================================================

-- app.trg_auditoria() (docs/schema_sistema.sql:1674-1710, verbatim) -- não
-- redesenhada, só (re)criada aqui porque nenhuma task anterior de T10-T19 a
-- provisionou ainda (T13/T14 criam log_auditoria/as tabelas de Fundação, mas
-- não a função de trigger em si).
CREATE OR REPLACE FUNCTION app.trg_auditoria() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_pk    TEXT  := TG_ARGV[0];
  v_ant   JSONB;
  v_novo  JSONB;
  v_id    BIGINT;
  v_real  BIGINT;
  v_imp   BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_ant := to_jsonb(OLD);
    v_id  := (v_ant ->> v_pk)::BIGINT;
  ELSIF TG_OP = 'UPDATE' THEN
    v_ant  := to_jsonb(OLD);
    v_novo := to_jsonb(NEW);
    IF v_ant = v_novo THEN RETURN NULL; END IF;   -- update que não mudou nada não vira log
    v_id   := (v_novo ->> v_pk)::BIGINT;
  ELSE
    v_novo := to_jsonb(NEW);
    v_id   := (v_novo ->> v_pk)::BIGINT;
  END IF;

  -- app.id_usuario é a identidade EFETIVA (a que o RLS usa).
  -- app.id_usuario_real é o Admin, quando está atuando como outro papel.
  v_real := COALESCE(NULLIF(current_setting('app.id_usuario_real', true), '')::BIGINT, app.id_usuario());
  v_imp  := CASE WHEN v_real IS DISTINCT FROM app.id_usuario() THEN app.id_usuario() END;

  INSERT INTO log_auditoria (id_usuario, id_usuario_impersonado, tabela, id_registro_alvo,
                             acao, valor_anterior, valor_novo)
  VALUES (COALESCE(v_real, app.id_usuario_sistema()), v_imp,
          TG_TABLE_NAME, v_id, lower(TG_OP), v_ant, v_novo);
  RETURN NULL;
END $$;

COMMENT ON FUNCTION app.trg_auditoria() IS
'Cobre o CRUD auditado da Gestora sobre o planejamento e a impersonação do Admin. Quando o Admin atua como outro papel, id_usuario guarda o Admin e id_usuario_impersonado guarda quem ele está representando — o contrário perderia o responsável real.';

-- app.id_usuario_sistema() (docs/schema_sistema.sql:1455-1457, verbatim) --
-- dependência direta de app.trg_auditoria() (usuário técnico de fallback),
-- ainda não provisionada por nenhuma task anterior.
CREATE OR REPLACE FUNCTION app.id_usuario_sistema() RETURNS BIGINT
LANGUAGE sql STABLE AS
$$ SELECT id_usuario FROM dim_usuario WHERE email = 'sistema@legislabrasil.org.br' $$;

-- Usuário técnico (docs/schema_sistema.sql:2167-2170, verbatim) -- garante que
-- toda linha de auditoria tenha responsável mesmo sem sessão (ex.: job/ETL).
INSERT INTO dim_usuario (email, nome, papel_global, ativo)
VALUES ('sistema@legislabrasil.org.br', 'Sistema (jobs e ETL)', 'admin', false)
ON CONFLICT (email) DO NOTHING;

-- Extensão aditiva do loop de triggers (docs/schema_sistema.sql:1712-1732) --
-- só as 3 tabelas do gap; as demais linhas do loop aprovado (dim_planejamento,
-- fat_objetivo_especifico, ...) já estão fora do escopo desta feature e não
-- são tocadas aqui.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('dim_contratante',    'id_contratante'),
    ('dim_coalizao',       'id_coalizao'),
    ('rel_coalizao_membro','id_membro')
  ) AS v(tabela, pk) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_' || r.tabela) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_audit_%s AFTER INSERT OR UPDATE OR DELETE ON %I
           FOR EACH ROW EXECUTE FUNCTION app.trg_auditoria(%L)',
        r.tabela, r.tabela, r.pk);
    END IF;
  END LOOP;
END $$;

-- SPEC_DEVIATION (found during Execute review of this task, not in the
-- original T17 "What"): the loop above only covers the 3 tables that were
-- entirely missing from the schema-approved trigger loop
-- (docs/schema_sistema.sql:1712-1732). But that same approved loop ALSO
-- covers fat_contrato, dim_mandato, rel_usuario_contrato and
-- rel_mandato_candidatura -- all 4 created in-scope by T13/T14/T15 -- and no
-- task in T10-T19 ever applies that slice of the loop for them. Leaving them
-- out would violate AD-006 ("nenhuma linha entra no sistema sem saber quem
-- criou e quando") for the core Fundação tables. Applied here as the natural
-- continuation of the same "gap" fix, verbatim pk mapping from the approved
-- loop; the remaining rows of that loop (dim_planejamento,
-- fat_objetivo_especifico, fat_meta, fat_sucesso_mensal,
-- rel_planejamento_preditor, fat_gip) stay untouched -- genuinely out of
-- scope (Planejamento/Incidência tables that don't exist yet).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('fat_contrato',            'id_contrato'),
    ('dim_mandato',             'id_mandato'),
    ('rel_usuario_contrato',    'id_vinculo'),
    ('rel_mandato_candidatura', 'id_vinculo_tse')
  ) AS v(tabela, pk) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_' || r.tabela) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_audit_%s AFTER INSERT OR UPDATE OR DELETE ON %I
           FOR EACH ROW EXECUTE FUNCTION app.trg_auditoria(%L)',
        r.tabela, r.tabela, r.pk);
    END IF;
  END LOOP;
END $$;
