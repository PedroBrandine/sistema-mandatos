-- =============================================================================
-- T3: os 5 ROLEs do Postgres (docs/schema_sistema.sql:2061-2104, "Papéis e
-- Privilégios") e os GRANTs associados, mais `authenticator` como membro dos
-- 5 -- é isso que permite ao PostgREST fazer SET ROLE para o papel que a
-- claim `role` do JWT indicar (definida pelo hook de T1).
--
-- Renumerado: tasks.md nomeia este arquivo "0003_...", deslocado para 0004
-- pela mesma razão de 0002_plataforma_auth_hook.sql.
--
-- SPEC_DEVIATION -- escopo dos GRANTs adaptado a AD-025 (provisionamento
-- incremental): o bloco aprovado em docs/schema_sistema.sql:2074-2104 GRANTa
-- sobre tabelas específicas de Planejamento/Incidência/Operação (fat_registro,
-- dim_planejamento, fat_meta, etc.) e sobre o schema `tse` -- nenhum desses
-- existe ainda neste ambiente (só `dim_usuario`, criada como pré-requisito
-- de Fase 0). Reason: rodar o GRANT verbatim contra uma tabela/schema
-- inexistente falha (Postgres não tem "GRANT ... IF EXISTS"). Aplicado aqui:
--   - os 5 CREATE ROLE (verbatim)
--   - GRANT USAGE ON SCHEMA public, app (tse fica de fora -- T11 cria o
--     schema tse; quem criar `tse` deve regrantar USAGE aos 5 papéis)
--   - GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app (verbatim, seguro agora)
--   - GRANT SELECT/INSERT/UPDATE/DELETE ON ALL TABLES IN SCHEMA public TO
--     legisla_app/admin/gestora (verbatim) -- IMPORTANTE: "ALL TABLES IN
--     SCHEMA public" só cobre as tabelas que já existem no momento do GRANT.
--     Toda migração futura (T12+) que criar tabela nova em `public` deve
--     re-rodar este GRANT (ou usar ALTER DEFAULT PRIVILEGES) -- o schema
--     aprovado não precisa disso porque lá o bloco de GRANTs roda depois de
--     TODAS as tabelas já criadas (deploy de uma vez só); aqui o
--     provisionamento é incremental (AD-025).
--   - GRANT SELECT ON dim_usuario TO legisla_mentor (a única linha do GRANT
--     específico de mentor/assessor cuja tabela já existe -- as demais
--     ficam para quando Planejamento/Incidência/Operação criarem suas
--     tabelas, fora do escopo desta Fase 0/Fundação)
--   - GRANT USAGE/SELECT ON ALL SEQUENCES IN SCHEMA public (mesma ressalva
--     de "ALL ... IN SCHEMA" acima)
-- Os REVOKEs de mv_numeros_impacto/mv_avaliacao_nps/log_auditoria e os
-- GRANTs específicos de assessor ficam de fora -- nenhuma dessas tabelas
-- existe ainda e nenhum GRANT amplo foi dado a mentor/assessor que precise
-- ser revogado.
-- =============================================================================

DO $$
DECLARE r TEXT;
BEGIN
  FOREACH r IN ARRAY ARRAY['legisla_app','legisla_admin','legisla_gestora','legisla_mentor','legisla_assessor'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', r);
    END IF;
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public, app TO legisla_app, legisla_admin, legisla_gestora, legisla_mentor, legisla_assessor;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO legisla_app, legisla_admin, legisla_gestora, legisla_mentor, legisla_assessor;

-- Aplicação e papéis Legisla: acesso pleno, recortado por RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO legisla_app, legisla_admin, legisla_gestora;

-- Mentor: só o que já existe do seu GRANT aprovado (docs/schema_sistema.sql:2087).
GRANT SELECT ON dim_usuario TO legisla_mentor;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO legisla_mentor;

-- authenticator precisa ser membro dos 5 papéis para o PostgREST poder
-- SET ROLE para o papel indicado pela claim `role` do JWT.
GRANT legisla_admin, legisla_gestora, legisla_mentor, legisla_assessor, legisla_app TO authenticator;
